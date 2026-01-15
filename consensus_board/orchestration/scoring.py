import os
import json
from huggingface_hub import InferenceClient
from consensus_board.schemas.contracts import AgentReport
from dotenv import load_dotenv

# Force load the .env file
load_dotenv() 

# Using Gemma 2 (9B) as the "Consensus Agent"
REPO_ID = "google/gemma-2-9b-it"

def compute_discrepancy_score(reports: list[AgentReport]) -> tuple[float, list[str]]:
    """
    Sends the agent reports to an LLM to determine if there is a discrepancy.
    Uses Chat Completion API.
    """
    client = InferenceClient(token=os.getenv("HF_TOKEN"))

    # 1. Prepare the input for the LLM
    agent_text = ""
    for r in reports:
        claim_str = "No claim"
        if r.claims:
            claim_str = f"{r.claims[0].value} (Confidence: {r.claims[0].confidence})"
        
        agent_text += f"- Specialist '{r.agent_name}': {claim_str}\n"
        if r.uncertainties:
            agent_text += f"  - Notes/Uncertainties: {', '.join(r.uncertainties)}\n"

    # 2. Define the Messages (Chat Format)
    messages = [
        {
            "role": "system",
            "content": (
                "You are the 'Consensus Moderator', a senior medical AI. "
                "Your task is to review reports from three specialists: Imaging, Acoustics, and History. "
                "Determine if there is a meaningful clinical discrepancy between them.\n"
                "Rules:\n"
                "- If Imaging says 'Stable' but History/Acoustics show 'Worsening', this is a HIGH discrepancy.\n"
                "- Output ONLY valid JSON in this format: "
                "{ \"score\": <float 0.0 to 1.0>, \"reasoning\": \"<short explanation>\" }"
            )
        },
        {
            "role": "user",
            "content": f"Here are the reports:\n{agent_text}\n\nAnalyze for discrepancies."
        }
    ]

    try:
        # 3. Call the Chat API
        response = client.chat_completion(
            messages=messages,
            max_tokens=500,
            model=REPO_ID
        )
        
        # 4. Extract the content
        # The response object structure is slightly different for chat
        content = response.choices[0].message.content
        
        # 5. Clean and Parse the JSON output
        json_str = content.strip()
        # Attempt to strip markdown code blocks if present
        if "```json" in json_str:
            json_str = json_str.split("```json")[1].split("```")[0]
        elif "```" in json_str:
             json_str = json_str.split("```")[1]
            
        data = json.loads(json_str)
        return data.get("score", 0.0), data.get("reasoning", "No reasoning provided.")
        
    except Exception as e:
        print(f"LLM Error: {e}")
        # Fallback to a safe default if the API fails
        return 0.5, ["Error calling Consensus Agent. Manual review required."]

def score_to_level(score: float) -> str:
    if score > 0.7: return "high"
    if score > 0.4: return "medium"
    return "low"