import os
import json
import re
import ast
import requests
from fastapi import FastAPI
from dotenv import load_dotenv

from consensus_board.schemas.contracts import (
    CaseInput,
    ConsensusOutput,
    DiscrepancyAlert,
    AgentReport,
    Claim,
)
from consensus_board.agents.stub_agents import history_stub

# 1. LOAD ENVIRONMENT VARIABLES
load_dotenv()

app = FastAPI(title="Consensus Board API", version="0.4.5 (Robust)")

API_URL = os.getenv("API_URL")

# -----------------------------
# ROBUST JSON PARSER
# -----------------------------
def _extract_first_valid_json_object(text: str):
    """
    Super-robust extractor that handles:
    1. Markdown code blocks (```json ... ```)
    2. Standard JSON ({ "key": "val" })
    3. Python Dicts ({ 'key': 'val' }) - Common LLM error
    """
    if not text or not isinstance(text, str):
        return None

    # 1. Strip Markdown Code Blocks
    if "```" in text:
        # Try to extract content inside ```json ... ``` or just ``` ... ```
        pattern = r"```(?:json)?\s*(.*?)\s*```"
        match = re.search(pattern, text, re.DOTALL)
        if match:
            text = match.group(1)

    # 2. Find anything that looks like a JSON object { ... }
    # We look for the first '{' and the last '}'
    start = text.find("{")
    end = text.rfind("}")
    
    if start != -1 and end != -1 and end > start:
        candidate = text[start : end + 1]
        
        # Attempt A: Standard JSON
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            pass
        
        # Attempt B: Python Dictionary (Single quotes)
        try:
            # ast.literal_eval safely evaluates a string containing a Python literal
            return ast.literal_eval(candidate)
        except (ValueError, SyntaxError):
            pass

    return None

# -----------------------------
# 1) CLOUD AGENTS
# -----------------------------
def call_vision_agent(case_id: str) -> AgentReport:
    image_path = f"artifacts/runs/{case_id}/xray.jpg"
    if not os.path.exists(image_path):
        return AgentReport(
            agent_name="imaging",
            model="Error",
            claims=[Claim(label="error", value="File missing", confidence=0.0)],
        )

    try:
        if not API_URL: raise ValueError("API_URL is missing in .env")

        # The backend now handles the "Ghost Image" logic, so we just send the prompt.
        params = {"prompt": "Describe the chest X-ray findings briefly."}

        with open(image_path, "rb") as f:
            response = requests.post(
                f"{API_URL}/agent/vision",
                files={"image": f},
                data=params,
                timeout=60,
            )

        if response.status_code != 200:
            return AgentReport(
                agent_name="imaging",
                model="Error",
                claims=[Claim(label="error", value=f"Server Error: {response.text}", confidence=0.0)],
            )

        finding = response.json().get("finding", "No finding")
        return AgentReport(
            agent_name="imaging",
            model="MedGemma (Cloud)",
            claims=[Claim(label="finding", value=finding, confidence=0.95)],
        )

    except Exception as e:
        return AgentReport(
            agent_name="imaging",
            model="Offline",
            claims=[Claim(label="error", value=f"Connection Error: {str(e)}", confidence=0.0)],
        )


def call_audio_agent(case_id: str) -> AgentReport:
    audio_path = f"artifacts/runs/{case_id}/audio.wav"
    if not os.path.exists(audio_path):
        return AgentReport(
            agent_name="acoustics",
            model="Error",
            claims=[Claim(label="error", value="File missing", confidence=0.0)],
        )

    try:
        if not API_URL: raise ValueError("API_URL is missing in .env")

        with open(audio_path, "rb") as f:
            response = requests.post(f"{API_URL}/agent/audio", files={"file": f}, timeout=60)
        
        if response.status_code != 200:
             return AgentReport(agent_name="acoustics", model="Error", claims=[Claim(label="error", value=f"Server Error: {response.text}", confidence=0.0)])

        data = response.json()
        
        # Clamp confidence to be safe
        raw_conf = float(data.get("confidence", 0.0))
        clamped_conf = max(0.0, min(1.0, raw_conf))
        
        return AgentReport(
            agent_name="acoustics",
            model="HeAR (Cloud)",
            claims=[Claim(label="classification", value=data.get("prediction", "unknown"), confidence=clamped_conf)]
        )
    except Exception as e:
        return AgentReport(agent_name="acoustics", model="Offline", claims=[Claim(label="error", value=f"Connection Error: {str(e)}", confidence=0.0)])


# -----------------------------
# 2) CLOUD CONSENSUS
# -----------------------------
def call_cloud_consensus(imaging_txt: str, audio_txt: str, history_txt: str):
    print("⚖️ Sending Debate to Cloud Moderator...")
    payload = {"imaging_text": imaging_txt, "audio_text": audio_txt, "history_text": history_txt}

    try:
        if not API_URL: raise ValueError("API_URL missing")

        response = requests.post(f"{API_URL}/agent/consensus", json=payload, timeout=60)
        response.raise_for_status()
        data = response.json() if response.content else {}

        # 1. Preferred: Server parsed it
        if isinstance(data, dict) and isinstance(data.get("parsed"), dict):
            parsed = data["parsed"]
            return (
                float(parsed.get("score", 0.5)),
                str(parsed.get("reasoning", "No reasoning")),
                str(parsed.get("recommendation", "Manual review"))
            )

        # 2. Legacy: Extract from raw text string
        raw_str = data.get("raw_response", "")
        
        # DEBUG: Print exact output to terminal so we can see what's wrong
        print(f"🕵️ RAW LLM OUTPUT: {raw_str}") 

        obj = _extract_first_valid_json_object(raw_str)
        
        if isinstance(obj, dict) and "score" in obj:
            return (
                float(obj.get("score", 0.5)),
                str(obj.get("reasoning", "No reasoning")),
                str(obj.get("recommendation", "Manual review"))
            )

        # 3. Last Resort: Show the raw text in the UI so you can read it
        error_msg = f"Valid JSON not found. Raw output: {raw_str[:100]}..."
        return 0.5, error_msg, "Check Raw Output Tab"

    except Exception as e:
        print(f"❌ Consensus Failed: {e}")
        return 0.5, f"Consensus Error: {e}", "Manual check"


# -----------------------------
# 3) MAIN FLOW
# -----------------------------
@app.post("/run", response_model=ConsensusOutput)
def run_case(case: CaseInput):
    # A. Gather Intelligence
    imaging = call_vision_agent(case.case_id)
    acoustics = call_audio_agent(case.case_id)
    history = history_stub(case.clinical_note_text)

    # Extract text
    img_txt = imaging.claims[0].value if imaging.claims else "No Data"
    aud_txt = acoustics.claims[0].value if acoustics.claims else "No Data"
    hist_txt = case.clinical_note_text

    # B. Verdict
    score, reasoning, recommendation = call_cloud_consensus(img_txt, aud_txt, hist_txt)

    level = "high" if score > 0.7 else ("medium" if score > 0.4 else "low")
    
    # If reasoning contains "Valid JSON not found", the summary will show the error
    summary = f"{reasoning}"

    return ConsensusOutput(
        case_id=case.case_id,
        discrepancy_alert=DiscrepancyAlert(level=level, score=score, summary=summary),
        key_contradictions=[],
        recommended_data_actions=[recommendation],
        reasoning_trace=[reasoning, f"Next Step: {recommendation}"],
        limitations=["Hybrid Architecture"],
        agent_reports=[imaging, acoustics, history],
    )