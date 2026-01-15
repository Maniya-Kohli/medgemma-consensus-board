from fastapi import FastAPI, HTTPException
from consensus_board.schemas.contracts import CaseInput, ConsensusOutput, DiscrepancyAlert
from consensus_board.agents.stub_agents import imaging_stub, acoustics_stub, history_stub
from consensus_board.orchestration.scoring import compute_discrepancy_score, score_to_level
from consensus_board.orchestration.artifacts import load_agent_report

app = FastAPI(title="Consensus Board API", version="0.2.0")

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/run", response_model=ConsensusOutput)
def run_case(case: CaseInput):
    try:
        # 1. Load the "Specialist" Reports (Simulating the AI Agents)
        # We try to load from disk (Artifacts) first. If missing, we use the Stub (Simulated).
        imaging = load_agent_report(case.case_id, "imaging") or imaging_stub()
        acoustics = load_agent_report(case.case_id, "acoustics") or acoustics_stub()
        
        # History is special because it reads the live text from the UI
        history_artifact = load_agent_report(case.case_id, "history")
        if history_artifact:
            history = history_artifact
        else:
            history = history_stub(case.clinical_note_text)
            
        reports = [imaging, acoustics, history]

        # 2. Call the Moderator (The LLM Brain)
        # This now calls the code you updated in Phase 1 which uses Hugging Face
        score, reasoning_output = compute_discrepancy_score(reports)
        
        # 3. Format the Output
        level = score_to_level(score)
        
        # Ensure reasoning is always a list of strings for the UI
        if isinstance(reasoning_output, str):
            reasoning_trace = [reasoning_output]
        else:
            reasoning_trace = reasoning_output

        # Add a final summary line
        reasoning_trace.append(f"Final Computed Score: {score:.2f} ({level.upper()})")

        # 4. Return the Response to the Frontend
        return ConsensusOutput(
            case_id=case.case_id,
            discrepancy_alert=DiscrepancyAlert(
                level=level,
                score=score,
                summary=reasoning_trace[0] if reasoning_trace else "Analysis Complete"
            ),
            key_contradictions=[], # The LLM prompt usually embeds these in the reasoning text
            recommended_data_actions=list({a for r in reports for a in r.requested_data}),
            reasoning_trace=reasoning_trace, 
            limitations=["Phase 2: Hybrid Architecture (Mac + Cloud Inference)"],
            agent_reports=reports,
        )
    except Exception as e:
        print(f"Server Error: {e}")
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {e}")