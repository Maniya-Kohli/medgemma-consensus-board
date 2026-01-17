import os
import json
import requests  # <--- Changed from huggingface_hub
from consensus_board.schemas.contracts import AgentReport
from dotenv import load_dotenv

load_dotenv() 

# OLLAMA CONFIGURATION (Local)
OLLAMA_URL = "http://localhost:11434/api/chat"
MODEL_NAME = "gemma2:2b"  # Make sure you ran 'ollama pull gemma2:9b'
import os
import json
import requests
from consensus_board.schemas.contracts import AgentReport
from dotenv import load_dotenv

load_dotenv()

OLLAMA_URL = "http://localhost:11434/api/chat"
MODEL_NAME = "gemma2:9b"  # Or your MedGemma-4B local instance

def compute_discrepancy_score(reports: list[AgentReport]) -> tuple[float, list[str]]:
    """
    Orchestrates a clinical debate using Chain-of-Thought reasoning.
    """
    # 1. Prepare Data for the Brain
    imaging = next((r for r in reports if r.agent_name == "imaging"), None)
    history = next((r for r in reports if r.agent_name == "history"), None)
    audio = next((r for r in reports if r.agent_name == "acoustics"), None)

    context_str = f"""
    [AGENT: RADIOLOGIST (Vision)]
    Finding: {imaging.claims[0].value if imaging and imaging.claims else "No Data"}
    Confidence: {imaging.claims[0].confidence if imaging and imaging.claims else 0.0}

    [AGENT: ACOUSTICIAN (Audio)]
    Finding: {audio.claims[0].value if audio and audio.claims else "No Data"}
    Confidence: {audio.claims[0].confidence if audio and audio.claims else 0.0}

    [AGENT: HISTORIAN (Clinical Notes)]
    Patient Claims: {", ".join([c.value for c in history.claims]) if history and history.claims else "No Data"}
    """

    # 2. The "Medical Consultant" Prompt
    system_prompt = """
    You are the 'Chief Medical Consensus Officer'. Your goal is to catch life-threatening mismatches.
    
    CLINICAL LOGIC RULES:
    1. If Audio finds 'Crackles/Wheeze' but Imaging is 'Stable', this is a HIGH DISCREPANCY (possible early pneumonia/CHF).
    2. If History mentions 'Weight Loss' but Imaging is 'Stable', flag for further cancer screening.
    3. Low confidence signals should be weighted less unless they are life-threatening.

    OUTPUT FORMAT: You must return valid JSON.
    {
        "thought_process": "Briefly explain the conflict between signals.",
        "discrepancy_score": <0.0 to 1.0>,
        "key_conflict": "The specific mismatch (e.g. History says sick, X-ray says healthy).",
        "action": "Immediate medical recommendation."
    }
    """

    try:
        payload = {
            "model": MODEL_NAME,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Review these agent reports:\n{context_str}"}
            ],
            "stream": False,
            "format": "json"
        }
        
        response = requests.post(OLLAMA_URL, json=payload, timeout=30)
        response.raise_for_status()
        
        data = json.loads(response.json()['message']['content'])
        
        score = data.get("discrepancy_score", 0.5)
        reasoning = f"🤔 Logic: {data.get('thought_process')}"
        conflict = f"⚠️ Conflict: {data.get('key_conflict')}"
        recommendation = data.get("action", "Manual Review Required.")
        
        return score, [reasoning, conflict, f"Action: {recommendation}"]
        
    except Exception as e:
        return 0.5, [f"Consensus Error: {e}"]

def score_to_level(score: float) -> str:
    if score > 0.75: return "high"
    if score > 0.4: return "medium"
    return "low"