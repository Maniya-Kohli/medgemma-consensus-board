import os
import json
import re
import ast
import requests
from dotenv import load_dotenv
import ollama
from fastapi.middleware.cors import CORSMiddleware
import shutil  # Added for file saving
from fastapi import FastAPI, UploadFile, File, Form  # Added UploadFile, File, Form
from typing import Dict, Any
import httpx
import asyncio


from consensus_board.schemas.contracts import (
    CaseInput,
    ConsensusOutput,
    DiscrepancyAlert,
    AgentReport,
    Claim,
    VisionReport
)

# 1. LOAD ENVIRONMENT VARIABLES
load_dotenv()

app = FastAPI(title="Consensus Board API", version="0.5.0 (MedGemma-Native)")

# --- CORS CONFIGURATION ---
# Define the origins that are allowed to make requests to this API
origins = [
    "http://localhost:3000",    # React/Next.js default port
    "http://127.0.0.1:3000",
    # Add any other origins (production domains) here
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,      # Or ["*"] to allow all (less secure, but okay for local dev)
    allow_credentials=True,
    allow_methods=["*"],        # Allows GET, POST, OPTIONS, etc.
    allow_headers=["*"],        # Allows all headers
)
# --------------------------

API_URL = os.getenv("API_URL")

# -----------------------------
# NEW: UPLOAD ENDPOINT
# -----------------------------
@app.post("/upload/{case_id}")
async def upload_case_artifacts(
    case_id: str, 
    xray: UploadFile = File(None), 
    audio: UploadFile = File(None)
):
    """
    Saves uploaded files to the local disk so agents can find them.
    Path: artifacts/runs/{case_id}/xray.jpg (or audio.wav)
    """
    target_dir = f"artifacts/runs/{case_id}"
    os.makedirs(target_dir, exist_ok=True)

    # Save X-Ray
    if xray:
        file_location = os.path.join(target_dir, "xray.jpg")
        with open(file_location, "wb+") as file_object:
            shutil.copyfileobj(xray.file, file_object)

    # Save Audio
    if audio:
        file_location = os.path.join(target_dir, "audio.wav")
        with open(file_location, "wb+") as file_object:
            shutil.copyfileobj(audio.file, file_object)

    return {"message": "Files cached successfully", "case_id": case_id}

# -----------------------------
# HELPER: ROBUST JSON PARSER
# -----------------------------


def extract_json(text: str) -> Dict[str, Any]:
    if not text:
        return {"score": 0.5, "reasoning": "Empty input", "recommendation": "Review"}

    # 1. Clean common LLM formatting errors
    cleaned = text.replace("```json", "").replace("```", "").strip()

    # 2. Try to find the boundaries of the JSON object
    start = cleaned.find("{")
    end = cleaned.rfind("}")

    if start == -1 or end == -1:
        return {"score": 0.5, "reasoning": "JSON boundaries not found", "recommendation": "Review"}

    json_str = cleaned[start:end+1]

    # 3. Attempt Standard Parse
    try:
        return json.loads(json_str)
    except Exception:
        # 4. Fallback: Repair single quotes and common trailing commas
        try:
            # Replace single quotes with double quotes
            repaired = json_str.replace("'", '"')
            # Remove trailing commas before closing braces
            repaired = re.sub(r",\s*}", "}", repaired)
            return json.loads(repaired)
        except Exception:
            # 5. Last Resort: Regex Extraction
            try:
                score_match = re.search(r'"score":\s*(\d?\.\d+)', json_str)
                reason_match = re.search(r'"reasoning":\s*"(.*?)"', json_str)
                rec_match = re.search(r'"recommendation":\s*"(.*?)"', json_str)

                return {
                    "score": float(score_match.group(1)) if score_match else 0.5,
                    "reasoning": reason_match.group(1) if reason_match else "Regex recovery",
                    "recommendation": rec_match.group(1) if rec_match else "Manual Review"
                }
            except:
                return {"score": 0.5, "reasoning": "Total parse failure", "recommendation": "Manual Review"}
    
def _extract_tag(text: str, tag: str) -> str:
        m = re.search(fr"<{tag}>(.*?)</{tag}>", text, flags=re.S)
        return m.group(1).strip() if m else ""

# -----------------------------
# 1) LOCAL AGENTS (Gemma-2-2B)
# -----------------------------


async def extract_history_with_medgemma(client: httpx.AsyncClient, note_text: str) -> AgentReport:
    """
    Asynchronous Context Agent: Translates clinical notes into structured profiles
    concurrently with other diagnostic streams.
    """
    print(f"  [📄 CONTEXT START] Analyzing clinical notes...")
    
    try:
        # 1. ASYNC INFERENCE
        # Using AsyncClient ensures the CPU/GPU work on the local model 
        # allows the event loop to still handle network IO for other agents.
        client = ollama.AsyncClient()
        response = await client.chat(
            model='koesn/llama3-openbiollm-8b',
            messages=[
                {
                    'role': 'system', 
                    'content': (
                        "You are a Clinical Data Extractor. Extract findings into: "
                        "[ACTIVE], [BASELINE], [RISK], [NEGATION]. \n"
                        "Search specifically for symptoms (e.g., weight loss, fever, cough). "
                        "Format: '[CATEGORY] Finding'. Example: ['[ACTIVE] 102F fever']"
                    )
                },
                {'role': 'user', 'content': f"Extract: {note_text}"}
            ],
            format='json',
        )
        
        raw_data = json.loads(response['message']['content'])

        print('Patient history findings : ' , raw_data)
        findings = []

        # 2. ROBUST PARSING (Same logic as before)
        if isinstance(raw_data, list):
            findings = raw_data
        elif isinstance(raw_data, dict):
            for cat, val in raw_data.items():
                if isinstance(val, list):
                    for v in val: findings.append(f"[{cat.upper()}] {v}")
                else:
                    findings.append(f"[{cat.upper()}] {val}")

        # 3. DEDUPLICATION & CLEANUP
        valid_prefixes = ["[ACTIVE]", "[BASELINE]", "[RISK]", "[NEGATION]"]
        final_claims = []
        
        for f in findings:
            f_str = str(f).strip()
            if any(f_str.startswith(p) for p in valid_prefixes):
                for p in valid_prefixes:
                    double_p = f"{p} {p}"
                    if f_str.startswith(double_p):
                        f_str = f_str.replace(double_p, p, 1)
                
                if len(f_str) > 10:
                    final_claims.append(f_str)

        # 4. SIGNALING STATUS
        if not final_claims:
            print(f"  [⚠️  CONTEXT WARNING] No entities extracted. Manual review flagged.")
            return AgentReport(
                agent_name="history",
                model="OpenBioLLM-8B (Local)",
                claims=[
                    Claim(
                        label="extraction_status", 
                        value="[SYSTEM] Manual History Review Required - No findings extracted.", 
                        confidence=0.0  
                    )
                ],
                uncertainties=["Local extraction failed to identify clinical entities."]
            )

        print(f"  [✅ CONTEXT SUCCESS] Extracted {len(final_claims)} clinical entities.")
        return AgentReport(
            agent_name="history",
            model="OpenBioLLM-8B (Local)",
            claims=[Claim(label="finding", value=f, confidence=0.9) for f in final_claims]
        )
        
    except Exception as e:
        print(f"  [💥 CONTEXT CRASH] Exception: {str(e)}")
        return AgentReport(
            agent_name="history", 
            model="Error", 
            claims=[Claim(label="error", value=f"Service Offline: {str(e)}", confidence=0.0)]
        )

# -----------------------------
# 2) CLOUD AGENTS (MedGemma 4B / HeAR)
# -----------------------------


async def call_vision_agent(client: httpx.AsyncClient, case_id: str, note_text: str) -> VisionReport:
    """
    Dispatches clinical note and triggers the agentic reasoning loop.
    Console logs added for real-time tracking in Colab.
    """
    print(f"\n[🚀 START] Agentic Vision Loop | Case: {case_id}")
    image_path = f"artifacts/runs/{case_id}/xray.jpg"

    if not os.path.exists(image_path):
        print(f"[❌ ERROR] File not found: {image_path}")
        return VisionReport(
            case_id=case_id,
            draft_findings="Error: Image missing",
            supervisor_critique="N/A",
            internal_logic="Analysis failed due to missing input.",
            analysis_status="failed"
        )

    try:
        # Prepare context for Phase 1 (Triage/Planning)
        payload = {"context_hint": f"Clinical History: {note_text}"}
        
        with open(image_path, "rb") as img_file:
            files = {"image": ("xray.jpg", img_file, "image/jpeg")}
            
            print(f"[📡 SEND] Dispatching to /agent/vision (Timeout: 300s)...")
            response = await client.post(
                f"{API_URL}/agent/vision",
                data=payload,
                files=files,
                timeout=300.0 
            )
            response.raise_for_status()
            
        data = response.json()
        metadata = data.get("agent_metadata", {})
        final_finding = data.get("finding", "No consensus reached.")
        data_for_consensus = data.get("data_for_consensus")

        # Console Logs for Agentic Traces
        print(f"[🧠 PHASE 1 - PLAN] Strategy generated.")
        print(f"[🔍 PHASE 2 - EXECUTE] Sensitive analysis complete ({len(metadata.get('recall_data', ''))} chars).")
        print(f"[⚖️  PHASE 3 - CHECK] Consensus achieved.")
        print(f"[✅ SUCCESS] Report constructed for {case_id}\n")

        res = VisionReport(
            case_id=case_id,
            # Phase 1: Strategic Plan
            draft_findings=metadata.get("plan", "No strategy generated."),
            # Phase 2: Sensitive Analysis (Recall)
            supervisor_critique=metadata.get("recall_data", "No sensitive data captured."),
            # Phase 3: Final Clinical Consensus
            internal_logic=final_finding,
            data_for_consensus = data_for_consensus,
            analysis_status="complete"
        )

        print('VISION REPORT : ' , res)
        return res

    except Exception as e:
        print(f"[💥 CRASH] Agentic Loop Failure: {str(e)}")
        return VisionReport(
            case_id=case_id,
            draft_findings="System Crash",
            supervisor_critique="N/A",
            internal_logic=f"AI Adjudication Error: {str(e)}",
            analysis_status="failed"
        )

async def call_audio_agent(client: httpx.AsyncClient, case_id: str) -> AgentReport:
    """
    Asynchronous Audio Agent: Analyzes bio-acoustic signatures (HeAR) 
    in parallel with other diagnostic streams.
    """
    print(f"  [🎤 AUDIO START] Processing Case: {case_id}")
    audio_path = f"artifacts/runs/{case_id}/audio.wav"
    
    if not os.path.exists(audio_path):
        print(f"  [❌ AUDIO ERROR] Audio file missing: {audio_path}")
        return AgentReport(
            agent_name="acoustics", 
            model="Error", 
            claims=[Claim(label="error", value="File missing", confidence=0.0)]
        )

    try:
        if not API_URL: 
            raise ValueError("API_URL is missing in .env")

        print(f"  [☁️  CLOUD REQUEST] Dispatching to HeAR Acoustic Endpoint (Async)...")
        
        # Async file handling with httpx
        files = {"file": ("audio.wav", open(audio_path, "rb"), "audio/wav")}
        
        response = await client.post(
            f"{API_URL}/agent/audio", 
            files=files, 
            timeout=300.0
        )
        response.raise_for_status()
        
        data = response.json()
        
        # --- THE FIX: SAFETY CLAMPING ---
        # Ensures confidence is always within [0.0, 1.0] for Pydantic validation
        raw_confidence = data.get("confidence", 0.0)
        safe_confidence = max(0.0, min(1.0, float(raw_confidence)))

        print(f"  [✅ AUDIO SUCCESS] Acoustic classification: {data.get('prediction', 'unknown')}")

        return AgentReport(
            agent_name="acoustics",
            model="HeAR (Cloud)",
            claims=[
                Claim(
                    label="classification", 
                    value=data.get("prediction", "unknown"), 
                    confidence=safe_confidence 
                )
            ]
        )
    except Exception as e:
        print(f"  [💥 AUDIO CRASH] Exception: {str(e)}")
        return AgentReport(
            agent_name="acoustics", 
            model="Offline", 
            claims=[Claim(label="error", value=str(e), confidence=0.0)]
        )

# -----------------------------
# 3) UPDATED CLOUD CONSENSUS (main.py)
# -----------------------------

def call_cloud_consensus(case_id: str, imaging_txt: str, audio_txt: str, history_txt: str):
    image_path = f"artifacts/runs/{case_id}/xray.jpg"
    
    if not os.path.exists(image_path):
        return 0.5, "Image Missing", "Verify path", "X-ray not found.", ""

    try:
        with open(image_path, "rb") as f:
            # Files dictionary handles binary data
            files = {"image": ("xray.jpg", f, "image/jpeg")}
            # Data dictionary handles the Form fields
            data = {
                "imaging_text": imaging_txt,
                "audio_text": audio_txt,
                "history_text": history_txt
            }
            
            response = requests.post(
                f"{API_URL}/agent/consensus", 
                files=files, 
                data=data, 
                timeout=300
            )
            
            
        data_json = response.json()
        parsed = data_json.get("parsed", {})
        audit_md = data_json.get("audit_markdown", "Audit report unavailable.")
        thought_process = data_json.get("thought_process", "Reasoning not captured.")
        
        try: score = float(parsed.get("score", 0.5))
        except: score = 0.5
            
        reasoning = parsed.get("reasoning", "Signals reconciled.")
        rec = parsed.get("recommendation", "Manual correlation required.")
        
        return score, reasoning, rec, audit_md, thought_process
    
    except Exception as e:
        return 0.5, f"Consensus Error: {e}", "Check Logs", f"System Error: {str(e)}", ""

# -----------------------------
# 4) MAIN FLOW
# -----------------------------

@app.post("/run", response_model=ConsensusOutput)
async def run_case(case: CaseInput):
    print(f"\n{'='*60}")
    print(f"[🚀 AEGis SYSTEM] Initiating PARALLEL Analysis | CASE: {case.case_id}")
    print(f"{'='*60}")
    
    start_time = asyncio.get_event_loop().time()

    async with httpx.AsyncClient(timeout=300.0) as client:
        # Stage 1: Trigger all specialized agents concurrently
        print(f"[⚡] Launching Vision, Acoustic, and Context agents in parallel...")
        
        vision_task = call_vision_agent(client, case.case_id, case.clinical_note_text)
        audio_task = call_audio_agent(client, case.case_id)
        history_task = extract_history_with_medgemma(client, case.clinical_note_text)

        # Wait for all three to return
        imaging, acoustics, history = await asyncio.gather(vision_task, audio_task, history_task)

    print(f"[✅] All specialists reported. Latency: {asyncio.get_event_loop().time() - start_time:.2f}s")
    print('Imaging analysis , ' , imaging)

    # Prepare summaries for the Multimodal Consensus stage
   # Use the claims if available, fallback to draft findings to prevent "silent" agents
    img_summary = imaging.data_for_consensus
    aud_txt = acoustics.claims[0].value if acoustics.claims else "No Data"
    hist_txt = ", ".join([c.value for c in history.claims])

    # Stage 2: MULTIMODAL CONSENSUS (This remains sequential as it depends on Stage 1)
    print(f"\n[⚖️ CONSENSUS BOARD] Adjudicating gathered evidence...")
    score, reasoning, recommendation, audit_markdown, thought_process =  call_cloud_consensus(
        case.case_id, img_summary, aud_txt, hist_txt
    )

    level = "high" if score > 0.7 else ("medium" if score > 0.4 else "low")
    
    print(f"\n[🏁 FINAL VERDICT] Score: {score} ({level.upper()} RISK)")
    print(f"{'='*60}\n")


    res = {
        "case_id": case.case_id,
        "discrepancy_alert": {"level": level, "score": score, "summary": reasoning},
        "recommended_data_actions": [recommendation],
        "reasoning_trace": [
            f"Vision Trace: {imaging.internal_logic}",
            f"Consensus Logic: {thought_process}"
        ],
        # Ensure full report objects are passed for the UI Accordions
        "agent_reports": [imaging, acoustics, history], 
        "audit_markdown": audit_markdown,
        "thought_process": thought_process 
    }

    print('Final result : ' , res)
    return res
