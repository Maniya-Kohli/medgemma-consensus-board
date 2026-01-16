import os
import json
import re
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

app = FastAPI(title="Consensus Board API", version="0.4.2 (Stable)")

API_URL = os.getenv("API_URL")


# -----------------------------
# JSON EXTRACTION (ROBUST)
# -----------------------------
def _extract_first_valid_json_object(text: str):
    """
    Extract the FIRST valid JSON object from messy LLM output.
    Handles:
      - extra text before/after JSON
      - repeated JSON blocks
      - nested braces (fallback brace-balance scan)
    """
    if not text or not isinstance(text, str):
        return None

    # Strategy 1: parse non-greedy { ... } candidates
    candidates = re.findall(r"\{.*?\}", text, flags=re.DOTALL)
    for c in candidates:
        c2 = c.replace("“", '"').replace("”", '"').replace("’", "'")
        try:
            obj = json.loads(c2)
            if isinstance(obj, dict):
                return obj
        except Exception:
            continue

    # Strategy 2: brace-balance scan (supports nested braces)
    start = text.find("{")
    if start == -1:
        return None

    depth = 0
    for i in range(start, len(text)):
        ch = text[i]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                chunk = text[start : i + 1]
                chunk = chunk.replace("“", '"').replace("”", '"').replace("’", "'")
                try:
                    obj = json.loads(chunk)
                    if isinstance(obj, dict):
                        return obj
                except Exception:
                    return None

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
        if not API_URL:
            raise ValueError("API_URL is missing in .env")

        # Keep client sending <image>; Colab server translates to <start_of_image> now
        params = {"prompt": "<image>\nDescribe the chest X-ray findings briefly."}

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
                claims=[
                    Claim(
                        label="error",
                        value=f"Server Error: {response.text}",
                        confidence=0.0,
                    )
                ],
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
        if not API_URL:
            raise ValueError("API_URL is missing in .env")

        with open(audio_path, "rb") as f:
            response = requests.post(f"{API_URL}/agent/audio", files={"file": f}, timeout=60)

        data = response.json()
        return AgentReport(
            agent_name="acoustics",
            model="HeAR (Cloud)",
            claims=[
                Claim(
                    label="classification",
                    value=data.get("prediction", "unknown"),
                    confidence=float(data.get("confidence", 0.0)),
                )
            ],
        )
    except Exception as e:
        return AgentReport(
            agent_name="acoustics",
            model="Offline",
            claims=[Claim(label="error", value=f"Connection Error: {str(e)}", confidence=0.0)],
        )


# -----------------------------
# 2) CLOUD CONSENSUS (NO RAW IN UI)
# -----------------------------
def call_cloud_consensus(imaging_txt: str, audio_txt: str, history_txt: str):
    """
    Calls Colab /agent/consensus and returns clean:
      score (float), reasoning (str), recommendation (str)

    This function NEVER returns the raw LLM dump to the UI.
    It tries:
      1) {"parsed": {...}} response (preferred)
      2) extract JSON from "raw_response" string (legacy)
      3) fallback clean message
    """
    print("⚖️ Sending Debate to Cloud Moderator...")
    payload = {"imaging_text": imaging_txt, "audio_text": audio_txt, "history_text": history_txt}

    try:
        if not API_URL:
            raise ValueError("API_URL missing")

        response = requests.post(f"{API_URL}/agent/consensus", json=payload, timeout=60)
        response.raise_for_status()
        data = response.json() if response.content else {}

        # Preferred: server returns parsed JSON
        if isinstance(data, dict) and isinstance(data.get("parsed"), dict):
            parsed = data["parsed"]
            score = float(parsed.get("score", 0.5))
            reasoning = str(parsed.get("reasoning", "No reasoning provided."))
            recommendation = str(parsed.get("recommendation", "Manual review"))
            return score, reasoning, recommendation

        # Legacy: server returns raw_response containing JSON somewhere
        raw_json_str = data.get("raw_response", "") if isinstance(data, dict) else ""
        print(f"🕵️ RAW LLM OUTPUT (truncated): {raw_json_str[:500]}")

        obj = _extract_first_valid_json_object(raw_json_str)
        if isinstance(obj, dict) and "score" in obj:
            score = float(obj.get("score", 0.5))
            reasoning = str(obj.get("reasoning", "No reasoning provided."))
            recommendation = str(obj.get("recommendation", "Manual review"))
            return score, reasoning, recommendation

        print("❌ Could not extract valid JSON from moderator output.")
        return 0.5, "Moderator output was not valid JSON. Please retry.", "Manual review"

    except Exception as e:
        print(f"❌ Consensus Failed: {e}")
        return 0.5, f"Consensus connection error: {e}", "Manual check"


# -----------------------------
# 3) MAIN FLOW
# -----------------------------
@app.post("/run", response_model=ConsensusOutput)
def run_case(case: CaseInput):
    # A. Gather Intelligence
    imaging = call_vision_agent(case.case_id)
    acoustics = call_audio_agent(case.case_id)
    history = history_stub(case.clinical_note_text)

    # Extract text for the Moderator
    img_txt = imaging.claims[0].value if imaging.claims else "No Image Data"
    aud_txt = acoustics.claims[0].value if acoustics.claims else "No Audio Data"
    hist_txt = case.clinical_note_text

    # B. Moderator Verdict (Cloud)
    score, reasoning, recommendation = call_cloud_consensus(img_txt, aud_txt, hist_txt)

    level = "high" if score > 0.7 else ("medium" if score > 0.4 else "low")

    # Clean summary for UI (no raw dumps)
    summary_text = f"{reasoning} (Recommendation: {recommendation})"
    final_reasoning = [reasoning, f"Recommendation: {recommendation}"]

    return ConsensusOutput(
        case_id=case.case_id,
        discrepancy_alert=DiscrepancyAlert(level=level, score=score, summary=summary_text),
        key_contradictions=[],
        recommended_data_actions=[recommendation],
        reasoning_trace=final_reasoning,
        limitations=["Full Cloud Architecture (MedGemma + HeAR)"],
        agent_reports=[imaging, acoustics, history],
    )
