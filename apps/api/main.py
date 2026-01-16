import os
import json
import requests
from fastapi import FastAPI, HTTPException
from dotenv import load_dotenv # <--- ADDED THIS
from consensus_board.schemas.contracts import CaseInput, ConsensusOutput, DiscrepancyAlert, AgentReport, Claim
from consensus_board.agents.stub_agents import history_stub 

# 1. LOAD ENVIRONMENT VARIABLES
load_dotenv() 

app = FastAPI(title="Consensus Board API", version="0.4.1 (Stable)")

API_URL = os.getenv("API_URL")

# --- 1. CLOUD AGENTS ---

def call_vision_agent(case_id: str) -> AgentReport:
    image_path = f"artifacts/runs/{case_id}/xray.jpg"
    if not os.path.exists(image_path):
        return AgentReport(agent_name="imaging", model="Error", claims=[Claim(label="error", value="File missing", confidence=0.0)])

    try:
        if not API_URL: raise ValueError("API_URL is missing in .env")
        
        # --- THE FIX: Manually add <image> here ---
        # This forces the model to see the image token, regardless of Colab server state.
        params = {"prompt": "<image>\nDescribe the chest X-ray findings briefly."} 
        
        with open(image_path, "rb") as f:
            response = requests.post(
                f"{API_URL}/agent/vision",
                files={"image": f},
                data=params,
                timeout=60
            )
        
        if response.status_code != 200:
             # Return the exact error from Colab so we can see it
             return AgentReport(agent_name="imaging", model="Error", claims=[Claim(label="error", value=f"Server Error: {response.text}", confidence=0.0)])

        finding = response.json().get("finding", "No finding")
        return AgentReport(
            agent_name="imaging",
            model="MedGemma (Cloud)",
            claims=[Claim(label="finding", value=finding, confidence=0.95)]
        )
    except Exception as e:
        return AgentReport(
            agent_name="imaging", 
            model="Offline", 
            claims=[Claim(label="error", value=f"Connection Error: {str(e)}", confidence=0.0)]
        )

def call_audio_agent(case_id: str) -> AgentReport:
    audio_path = f"artifacts/runs/{case_id}/audio.wav"
    if not os.path.exists(audio_path):
        # FIX: Added confidence=0.0
        return AgentReport(agent_name="acoustics", model="Error", claims=[Claim(label="error", value="File missing", confidence=0.0)])

    try:
        if not API_URL: raise ValueError("API_URL is missing in .env")

        with open(audio_path, "rb") as f:
            response = requests.post(f"{API_URL}/agent/audio", files={"file": f}, timeout=60)
        data = response.json()
        return AgentReport(
            agent_name="acoustics",
            model="HeAR (Cloud)",
            claims=[Claim(label="classification", value=data.get("prediction", "unknown"), confidence=data.get("confidence", 0.0))]
        )
    except Exception as e:
        # FIX: Added confidence=0.0
        return AgentReport(
            agent_name="acoustics", 
            model="Offline", 
            claims=[Claim(label="error", value=f"Connection Error: {str(e)}", confidence=0.0)]
        )

# --- 2. CLOUD CONSENSUS ---

def call_cloud_consensus(imaging_txt, audio_txt, history_txt):
    """Sends the debate to Colab."""
    print("⚖️ Sending Debate to Cloud Moderator...")
    payload = {
        "imaging_text": imaging_txt,
        "audio_text": audio_txt,
        "history_text": history_txt
    }
    
    raw_json_str = "No response" # Default
    
    try:
        if not API_URL: raise ValueError("API_URL missing")
        
        response = requests.post(f"{API_URL}/agent/consensus", json=payload, timeout=60)
        response.raise_for_status()
        
        # Get the string the AI wrote
        raw_json_str = response.json().get("raw_response", "")
        
        # DEBUG: Print it to your terminal so you can see it immediately
        print(f"🕵️ RAW LLM OUTPUT: {raw_json_str}")

        # Try to parse it
        data = json.loads(raw_json_str)
        return data.get("score", 0.5), data.get("reasoning", "No reasoning"), data.get("recommendation", "Review")
        
    except json.JSONDecodeError:
        print("❌ JSON Parse Failed. Falling back to raw text.")
        # FALLBACK: Return the raw messy text so you can read it in the UI
        return 0.5, f"JSON Error. Raw Output: {raw_json_str}", "Check Terminal for details"
        
    except Exception as e:
        print(f"❌ Consensus Failed: {e}")
        return 0.5, f"Connection Error: {e}", "Manual Check"

# --- 3. MAIN FLOW ---

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

    # B. The Verdict (Cloud)
    score, reasoning, recommendation = call_cloud_consensus(img_txt, aud_txt, hist_txt)
    
    level = "high" if score > 0.7 else ("medium" if score > 0.4 else "low")
    final_reasoning = [reasoning, f"Recommendation: {recommendation}"]

    return ConsensusOutput(
        case_id=case.case_id,
        discrepancy_alert=DiscrepancyAlert(level=level, score=score, summary=reasoning),
        key_contradictions=[],
        recommended_data_actions=[recommendation],
        reasoning_trace=final_reasoning,
        limitations=["Full Cloud Architecture (MedGemma + HeAR)"],
        agent_reports=[imaging, acoustics, history],
    )