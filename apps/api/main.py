import os
import json
import re
import ast
import requests
from fastapi import FastAPI
from dotenv import load_dotenv
import ollama

from consensus_board.schemas.contracts import (
    CaseInput,
    ConsensusOutput,
    DiscrepancyAlert,
    AgentReport,
    Claim,
)

# 1. LOAD ENVIRONMENT VARIABLES
load_dotenv()

app = FastAPI(title="Consensus Board API", version="0.5.0 (MedGemma-Native)")

API_URL = os.getenv("API_URL")

# -----------------------------
# HELPER: ROBUST JSON PARSER
# -----------------------------
def _extract_first_valid_json_object(text: str):
    if not text or not isinstance(text, str):
        return None

    if "```" in text:
        pattern = r"```(?:json)?\s*(.*?)\s*```"
        match = re.search(pattern, text, re.DOTALL)
        if match:
            text = match.group(1)

    start = text.find("{")
    end = text.rfind("}")
    
    if start != -1 and end != -1 and end > start:
        candidate = text[start : end + 1]
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            pass
        try:
            return ast.literal_eval(candidate)
        except (ValueError, SyntaxError):
            pass
    return None

# -----------------------------
# 1) LOCAL AGENTS (Gemma-2-2B)
# -----------------------------

# In medgemma-consensus-board/apps/api/main.py

import ollama
import json

def extract_history_with_medgemma(note_text: str) -> AgentReport:
    """
    Translates messy notes into a structured profile. 
    If extraction fails, it flags for manual review with 0.0 confidence 
    to avoid misleading the consensus engine.
    """
    try:
        response = ollama.chat(
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
        findings = []

        # 1. ROBUST PARSING: Handle both JSON List and Dictionary
        if isinstance(raw_data, list):
            findings = raw_data
        elif isinstance(raw_data, dict):
            for cat, val in raw_data.items():
                if isinstance(val, list):
                    for v in val: findings.append(f"[{cat.upper()}] {v}")
                else:
                    findings.append(f"[{cat.upper()}] {val}")

        # 2. DEDUPLICATION & CLEANUP
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

        # 3. THE FIX: REMOVE SILENT FALSE NEGATIVE
        # Instead of defaulting to "Healthy", we signal that data is missing.
        if not final_claims:
            return AgentReport(
                agent_name="history",
                model="OpenBioLLM-8B (Local)",
                claims=[
                    Claim(
                        label="extraction_status", 
                        value="[SYSTEM] Manual History Review Required - No findings extracted.", 
                        confidence=0.0  # Zero confidence tells the Brain to ignore this signal
                    )
                ],
                uncertainties=["Local extraction failed to identify clinical entities in note."]
            )

        return AgentReport(
            agent_name="history",
            model="OpenBioLLM-8B (Local)",
            claims=[Claim(label="finding", value=f, confidence=0.9) for f in final_claims]
        )
        
    except Exception as e:
        # Ensure error fallbacks also use 0.0 confidence
        return AgentReport(
            agent_name="history", 
            model="Error", 
            claims=[Claim(label="error", value=f"Service Offline: {str(e)}", confidence=0.0)]
        )
# -----------------------------
# 2) CLOUD AGENTS (MedGemma 4B / HeAR)
# -----------------------------
def call_vision_agent(case_id: str, note_text: str) -> AgentReport:
    """Multimodal Vision Agent: Analyzes X-ray through the lens of patient notes."""
    image_path = f"artifacts/runs/{case_id}/xray.jpg"
    if not os.path.exists(image_path):
        return AgentReport(agent_name="imaging", model="Error", claims=[Claim(label="error", value="File missing", confidence=0.0)])

    try:
        if not API_URL: raise ValueError("API_URL is missing in .env")

        # Context-aware multimodal prompt
        multimodal_prompt = f"""
        Analyze this chest X-ray in the context of this patient history: "{note_text}".
        Focus on finding evidence that supports or contradicts the reported symptoms.
        Output a one-sentence clinical finding.
        """

        with open(image_path, "rb") as f:
            response = requests.post(
                f"{API_URL}/agent/vision",
                files={"image": f},
                data={"prompt": multimodal_prompt},
                timeout=120,
            )

        finding = response.json().get("finding", "No finding")
        return AgentReport(
            agent_name="imaging",
            model="MedGemma (Cloud)",
            claims=[Claim(label="finding", value=finding, confidence=0.95)],
        )
    except Exception as e:
        return AgentReport(agent_name="imaging", model="Offline", claims=[Claim(label="error", value=str(e), confidence=0.0)])

def call_audio_agent(case_id: str) -> AgentReport:
    audio_path = f"artifacts/runs/{case_id}/audio.wav"
    if not os.path.exists(audio_path):
        return AgentReport(agent_name="acoustics", model="Error", claims=[Claim(label="error", value="File missing", confidence=0.0)])

    try:
        if not API_URL: raise ValueError("API_URL is missing in .env")
        with open(audio_path, "rb") as f:
            response = requests.post(f"{API_URL}/agent/audio", files={"file": f}, timeout=120)
        
        data = response.json()
        
        # --- THE FIX STARTS HERE ---
        raw_confidence = data.get("confidence", 0.0)
        
        # Use max(0.0, ...) to ensure Pydantic never sees a negative number.
        # min(1.0, ...) ensures we never exceed 100% confidence.
        safe_confidence = max(0.0, min(1.0, float(raw_confidence)))
        # --- THE FIX ENDS HERE ---

        return AgentReport(
            agent_name="acoustics",
            model="HeAR (Cloud)",
            claims=[
                Claim(
                    label="classification", 
                    value=data.get("prediction", "unknown"), 
                    confidence=safe_confidence # Use the safe clamped value
                )
            ]
        )
    except Exception as e:
        # Also ensure error fallbacks use a valid 0.0 float
        return AgentReport(agent_name="acoustics", model="Offline", claims=[Claim(label="error", value=str(e), confidence=0.0)])
# -----------------------------
# 3) CLOUD CONSENSUS
# -----------------------------
# apps/api/main.py

# apps/api/main.py

# def call_cloud_consensus(imaging_txt: str, audio_txt: str, history_txt: str):
#     payload = {"imaging_text": imaging_txt, "audio_text": audio_txt, "history_text": history_txt}
#     try:
#         response = requests.post(f"{API_URL}/agent/consensus", json=payload, timeout=300)
#         data = response.json()
        
#         parsed = data.get("parsed", {})
#         audit_md = data.get("audit_markdown", "Audit report unavailable.")
#         # Key Alignment: Match the Cloud API's return
#         thought_process = data.get("thought_process", "Reasoning not captured.")
        
#         # Robust score extraction
#         try:
#             score = float(parsed.get("score", 0.5))
#         except:
#             score = 0.5
            
#         reasoning = parsed.get("reasoning", "Signals reconciled.")
#         rec = parsed.get("recommendation", "Manual correlation required.")
        
#         return score, reasoning, rec, audit_md, thought_process
    
#     except Exception as e:
#         return 0.5, f"Consensus Error: {e}", "Check Logs", f"System Error: {str(e)}", ""

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
def run_case(case: CaseInput):
    # Stage 1: Individual Agent Analysis
    imaging = call_vision_agent(case.case_id, case.clinical_note_text)
    acoustics = call_audio_agent(case.case_id)
    history = extract_history_with_medgemma(case.clinical_note_text)

    img_txt = imaging.claims[0].value if imaging.claims else "No Data"
    aud_txt = acoustics.claims[0].value if acoustics.claims else "No Data"
    hist_txt = ", ".join([c.value for c in history.claims])

    # Stage 2: MULTIMODAL CONSENSUS (Now passing case_id to fetch the image)
    score, reasoning, recommendation, audit_markdown, thought_process = call_cloud_consensus(
        case.case_id, img_txt, aud_txt, hist_txt
    )

    level = "high" if score > 0.7 else ("medium" if score > 0.4 else "low")
    
    return {
        "case_id": case.case_id,
        "discrepancy_alert": {"level": level, "score": score, "summary": reasoning},
        "recommended_data_actions": [recommendation],
        "reasoning_trace": [reasoning, f"Recommendation: {recommendation}", f"Audit: {audit_markdown[:100]}..."],
        "agent_reports": [imaging, acoustics, history],
        "audit_markdown": audit_markdown,
        "thought_process": thought_process 
    }

# @app.post("/run", response_model=ConsensusOutput)
# def run_case(case: CaseInput):
#     imaging = call_vision_agent(case.case_id, case.clinical_note_text)
#     acoustics = call_audio_agent(case.case_id)
#     history = extract_history_with_medgemma(case.clinical_note_text)

#     img_txt = imaging.claims[0].value if imaging.claims else "No Data"
#     aud_txt = acoustics.claims[0].value if acoustics.claims else "No Data"
#     hist_txt = ", ".join([c.value for c in history.claims])

#     # UPDATED: Now receives 4 values
#     score, reasoning, recommendation, audit_markdown, thought_process = call_cloud_consensus(img_txt, aud_txt, hist_txt)

#     level = "high" if score > 0.7 else ("medium" if score > 0.4 else "low")
    
#     return {
#         "case_id": case.case_id,
#         "discrepancy_alert": {"level": level, "score": score, "summary": reasoning},
#         "recommended_data_actions": [recommendation],
#         "reasoning_trace": [reasoning, f"Recommendation: {recommendation}", f"Audit: {audit_markdown[:100]}..."],
#         "agent_reports": [imaging, acoustics, history],
#         "audit_markdown": audit_markdown,
#         "thought_process": thought_process 
#     }

