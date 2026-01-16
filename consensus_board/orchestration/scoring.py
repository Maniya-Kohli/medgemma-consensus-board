import os
import json
import requests  # <--- Changed from huggingface_hub
from consensus_board.schemas.contracts import AgentReport
from dotenv import load_dotenv

load_dotenv() 

# OLLAMA CONFIGURATION (Local)
OLLAMA_URL = "http://localhost:11434/api/chat"
MODEL_NAME = "gemma2:9b"  # Make sure you ran 'ollama pull gemma2:9b'

def compute_discrepancy_score(reports: list[AgentReport]) -> tuple[float, list[str]]:
    """
    Orchestrates a clinical debate using LOCAL Gemma 2.
    """
    
    # 1. Extract Rich Context (Same as before)
    imaging_desc = "No imaging available."
    imaging_conf = 0.0
    
    for r in reports:
        if r.agent_name == "imaging":
            if hasattr(r, "visual_description") and r.visual_description:
                 imaging_desc = r.visual_description
            elif r.claims:
                 imaging_desc = r.claims[0].value
            if r.claims:
                imaging_conf = r.claims[0].confidence

    history_report = next((r for r in reports if r.agent_name == "history"), None)
    history_text = "No history provided."
    if history_report and history_report.claims:
        history_text = ", ".join([f"{c.value}" for c in history_report.claims])

    audio_report = next((r for r in reports if r.agent_name == "acoustics"), None)
    audio_text = "No audio analysis."
    if audio_report and audio_report.claims:
        audio_text = f"{audio_report.claims[0].value} (Confidence: {audio_report.claims[0].confidence})"

    # 2. Construct Prompt (Same as before)
    system_prompt = """
    You are the 'MedGemma Consensus Agent'.
    Review raw data signals. Identify "Hidden Discrepancies".
    
    Output purely valid JSON:
    {
        "clinical_reasoning": "A 2-3 sentence explanation.",
        "discrepancy_score": <float between 0.0 and 1.0>,
        "recommendation": "One specific action."
    }
    """

    user_prompt = f"""
    [VISUAL]: "{imaging_desc}" (Conf: {imaging_conf})
    [AUDIO]: "{audio_text}"
    [HISTORY]: "{history_text}"
    
    Analyze consistency. Return JSON.
    """

    try:
        # 3. Call OLLAMA (Local)
        payload = {
            "model": MODEL_NAME,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "stream": False,
            "format": "json"  # Ollama supports forced JSON mode!
        }
        
        response = requests.post(OLLAMA_URL, json=payload)
        response.raise_for_status()
        
        # 4. Parse Response
        # Ollama returns the JSON object directly in 'message' -> 'content'
        content = response.json()['message']['content']
        data = json.loads(content)
        
        score = data.get("discrepancy_score", 0.5)
        reasoning = data.get("clinical_reasoning", "Analysis complete.")
        recommendation = data.get("recommendation", "Review required.")
        
        return score, [reasoning, f"Recommendation: {recommendation}"]
        
    except Exception as e:
        print(f"❌ Local Inference Error: {e}")
        return 0.5, [f"Error connecting to Local MedGemma: {e}"]

def score_to_level(score: float) -> str:
    if score > 0.75: return "high"
    if score > 0.4: return "medium"
    return "low"