# consensus_board/orchestration/moderator.py
import os
from huggingface_hub import InferenceClient
from consensus_board.schemas.contracts import AgentReport, DiscrepancyAlert

# Use Gemma 2 9B (accessible via free HF API usually) as the "Moderator"
# Since you can't run MedGemma 27B locally, this is the best proxy for development
REPO_ID = "google/gemma-2-9b-it" 

def moderate_discrepancy(reports: list[AgentReport], note_text: str) -> dict:
    client = InferenceClient(token=os.getenv("HF_TOKEN"))
    
    # Construct the "Context" from the specialized agents
    agent_summaries = "\n".join([
        f"- {r.agent_name.upper()}: Claim '{r.claims[0].value}' (Conf: {r.claims[0].confidence})" 
        for r in reports if r.claims
    ])

    system_prompt = """
    You are the Senior Medical Moderator (MedGemma Consensus Agent).
    Your Goal: Review reports from a Radiologist, an Acoustician, and a Historian. 
    Identify if there is a clinical DISCREPANCY between the objective signals (imaging/audio) and the patient history.
    
    Output JSON only:
    {
      "reasoning": "Step-by-step analysis of conflicts...",
      "discrepancy_score": 0.0 to 1.0 (0=perfect agreement, 1=critical conflict),
      "summary": "One sentence summary for the doctor."
    }
    """

    user_prompt = f"""
    Patient Note Segment: "{note_text[:200]}..."
    
    Agent Reports:
    {agent_summaries}
    
    Analyze for contradictions. specifically look for 'Stable' imaging vs 'Worsening' symptoms.
    """

    # Call API (Pseudo-code)
    response = client.text_generation(
        f"<start_of_turn>user\n{system_prompt}\n{user_prompt}<end_of_turn>\n<start_of_turn>model",
        max_new_tokens=500,
        model=REPO_ID
    )
    
    # Parse the JSON from the response and return it
    # You will use this to replace the logic in your current scoring.py
    return parse_json(response)