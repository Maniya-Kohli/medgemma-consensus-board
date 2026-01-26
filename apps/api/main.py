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
from typing import Dict, Any, Optional
import httpx
import asyncio
from fastapi.responses import StreamingResponse


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

async def call_vision_agent(client: httpx.AsyncClient, case_id: str, note_text: str):
    """
    Dispatches clinical note and streams agentic reasoning tokens.
    Uses detailed error reporting to diagnose connection issues.
    """
    print(f"\n[🚀 START] Agentic Vision Loop | Case: {case_id}")
    image_path = f"artifacts/runs/{case_id}/xray.jpg"

    if not os.path.exists(image_path):
        yield json.dumps({"type": "error", "message": "Image artifact missing on local server"})
        return

    try:
        # Check if API_URL exists
        if not API_URL:
            yield json.dumps({"type": "error", "message": "API_URL missing in .env file"})
            return

        payload = {"context_hint": f"Clinical History: {note_text}"}
        
        with open(image_path, "rb") as img_file:
            files = {"image": ("xray.jpg", img_file, "image/jpeg")}
            
            # Use a fresh client instance with specific settings for tunnels
            async with httpx.AsyncClient(timeout=None, verify=False) as streaming_client:
                async with streaming_client.stream(
                    "POST", 
                    f"{API_URL}/agent/vision", 
                    data=payload, 
                    files=files
                ) as response:
                    
                    if response.status_code != 200:
                        error_body = await response.aread()
                        error_text = error_body.decode()
                        yield json.dumps({"type": "error", "message": f"Colab rejected ({response.status_code}): {error_text}"})
                        return

                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            yield line.replace("data: ", "").strip()
                        elif line.strip():
                            # Wrap raw text chunks as thoughts
                            yield json.dumps({"type": "thought", "delta": line})

        print(f"[✅ SUCCESS] Vision streaming finished for {case_id}\n")

    except httpx.ConnectError:
        yield json.dumps({"type": "error", "message": "Connection Refused. Is ngrok running on Colab?"})
    except Exception as e:
        # Use repr(e) to get the specific class of the error (e.g., Timeout, DNS error)
        error_detail = repr(e)
        print(f"[💥 BRIDGE CRASH] {error_detail}")
        yield json.dumps({"type": "error", "message": f"Vision Stream Bridge Failed: {error_detail}"})

    except Exception as e:
        print(f"[💥 CRASH] Agentic Loop Failure: {str(e)}")
        yield json.dumps({"type": "error", "message": f"Vision Stream Error: {str(e)}"})


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
async def call_cloud_consensus(case_id: str, imaging_txt: str, audio_txt: str, history_txt: str):
    image_path = f"artifacts/runs/{case_id}/xray.jpg"
    
    if not os.path.exists(image_path):
        yield json.dumps({"type": "error", "message": "Image Missing"})
        return

    payload = {
        "imaging_text": imaging_txt,
        "audio_text": audio_txt,
        "history_text": history_txt
    }

    try:
        async with httpx.AsyncClient(timeout=None,  verify=False) as client:
            with open(image_path, "rb") as f:
                files = {"image": ("xray.jpg", f, "image/jpeg")}
                
                # 🟢 Use client.stream to pipe word-by-word thoughts to the UI
                async with client.stream(
                    "POST", 
                    f"{API_URL}/agent/consensus", 
                    data=payload, 
                    files=files
                ) as response:
                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            yield line.replace("data: ", "").strip()
    except Exception as e:
        yield json.dumps({"type": "error", "message": f"Cloud Adjudicator Bridge Failed: {str(e)}"})

# -----------------------------
# 4) MAIN FLOW
# -----------------------------

@app.post("/run")
async def run_case(case: CaseInput):
    async def stream_protocol():
        def yield_json(data: dict):
            return f"data: {json.dumps(data)}\n\n"

        try:
            yield yield_json({"type": "thought", "delta": f"🚀 Momo System: Initiating analysis for {case.case_id}..."})
            
            # 🛡️ Store the structured vision report here when it arrives in the stream
            captured_vision_data = None

            async with httpx.AsyncClient(timeout=300.0) as client:
                yield yield_json({"type": "thought", "delta": "⚡ Launching Vision Agentic Loop..."})
                
                async for vision_chunk in call_vision_agent(client, case.case_id, case.clinical_note_text):
                    # Forward the chunk to frontend immediately
                    yield f"data: {vision_chunk}\n\n"
                    
                    # 🔍 Check if this chunk is the 'final' structured data from the vision agent
                    try:
                        chunk_data = json.loads(vision_chunk)
                        if chunk_data.get("type") == "final":
                            captured_vision_data = chunk_data
                            # if "claims" not in captured_vision_data:
                            #     captured_vision_data["claims"] = [] # 🛡️ CRITICAL: Prevents UI .map() crashes
                    except:
                        continue 

                yield yield_json({"type": "thought", "delta": "🎤 Processing Acoustic and Context streams..."})
                
                audio_task = call_audio_agent(client, case.case_id)
                history_task = extract_history_with_medgemma(client, case.clinical_note_text)
                
                acoustics, history = await asyncio.gather(audio_task, history_task)
                yield yield_json({"type": "thought", "delta": "✅ Evidence gathered. Entering Consensus Board..."})

            # ⚖️ CONSENSUS BOARD 
            # Use the actual 'data_for_consensus' we just captured from the vision stream
            img_summary = captured_vision_data.get("data_for_consensus", "Imaging analysis complete.") if captured_vision_data else "Imaging analysis complete."
            
            aud_txt = acoustics.claims[0].value if acoustics.claims else "No Data"
            hist_txt = ", ".join([c.value for c in history.claims])

            yield yield_json({"type": "thought", "delta": "⚖️ Adjudicating evidence and resolving discrepancies..."})

            final_consensus_data = None

            # 🟢 PIPE CONSENSUS THOUGHTS: Colab -> Local -> Frontend
            async for consensus_chunk in call_cloud_consensus(case.case_id, img_summary, aud_txt, hist_txt):
                try:
                    chunk_data = json.loads(consensus_chunk)
                    if chunk_data.get("type") == "thought":
                        # Forward thoughts immediately to UI "Neural Stream"
                        yield f"data: {consensus_chunk}\n\n"
                    elif chunk_data.get("type") == "final":
                        # Capture the structured final result
                        final_consensus_data = chunk_data
                except:
                    continue

            # 🛡️ Extract consensus fields safely
            parsed = final_consensus_data.get("parsed", {}) if final_consensus_data else {}
            score = parsed.get("score", 0.5)
            reasoning = parsed.get("reasoning", "Consensus bridge disconnected.")
            recommendation = parsed.get("recommendation", "Manual review required.")
            audit_markdown = final_consensus_data.get("audit_markdown", "Audit unavailable.") if final_consensus_data else "Cloud error."
            thought_process = final_consensus_data.get("thought_process", "") if final_consensus_data else "Adjudicator offline."
            
            # score, reasoning, recommendation, audit_markdown, thought_process = await asyncio.to_thread(
            #     call_cloud_consensus, case.case_id, img_summary, aud_txt, hist_txt
            # )

            level = "high" if score > 0.7 else ("medium" if score > 0.4 else "low")
            
            if captured_vision_data:
                # Start with the data we have
                imaging_report = {
                    "agent_name": "imaging",
                    "model": "MedGemma-2b-Vision",
                    "analysis_status": "complete",
                    "internal_logic": captured_vision_data.get("finding", ""),
                    "draft_findings": captured_vision_data.get("agent_metadata", {}).get("plan", ""),
                    "supervisor_critique": captured_vision_data.get("agent_metadata", {}).get("recall_data", ""),
                }
                
                # 🛡️ ONLY add empty claims if captured_vision_data doesn't already have them
                if "claims" in captured_vision_data:
                    imaging_report["claims"] = captured_vision_data["claims"]
                else:
                    imaging_report["claims"] = []
            else:
                imaging_report = {
                    "agent_name": "imaging",
                    "model": "MedGemma-2b-Vision",
                    "analysis_status": "failed",
                    "claims": [], # Safety fallback for failed state
                    "internal_logic": "No imaging data captured.",
                    "draft_findings": "",
                    "supervisor_critique": ""
                }

            # 🎁 FINAL AGGREGATE PAYLOAD
            final_res = {
                "type": "final",
                "case_id": case.case_id,
                "discrepancy_alert": {"level": level, "score": score, "summary": reasoning},
                "recommended_data_actions": [recommendation],
                "reasoning_trace": [f"Consensus Logic: {thought_process}"],
                "agent_reports": [
                    acoustics.dict(), 
                    history.dict(),
                    imaging_report  
                ], 
                "audit_markdown": audit_markdown,
                "thought_process": thought_process 
            }

            yield yield_json(final_res)

        except Exception as e:
            yield yield_json({"type": "error", "message": str(e)})

    return StreamingResponse(stream_protocol(), media_type="text/event-stream")
