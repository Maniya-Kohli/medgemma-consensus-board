from fastapi import FastAPI
from consensus_board.schemas.contracts import CaseInput, ConsensusOutput, DiscrepancyAlert
from consensus_board.agents.stub_agents import imaging_stub, acoustics_stub, history_stub
from consensus_board.orchestration.scoring import compute_discrepancy_score, score_to_level

app = FastAPI(title="Consensus Board API", version="0.1.0")


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/run", response_model=ConsensusOutput)
def run_case(case: CaseInput):
    reports = [imaging_stub(), acoustics_stub(), history_stub(case.clinical_note_text)]
    score, contradictions = compute_discrepancy_score(reports)
    level = score_to_level(score)

    reasoning = [
        f"Imaging: {reports[0].claims[0].value} (conf {reports[0].claims[0].confidence})",
        f"Acoustics: {reports[1].claims[0].value} (conf {reports[1].claims[0].confidence})",
        f"History: {reports[2].claims[0].value} (conf {reports[2].claims[0].confidence})",
        f"Computed discrepancy score={score:.2f} => level={level}",
    ]

    return ConsensusOutput(
        case_id=case.case_id,
        discrepancy_alert=DiscrepancyAlert(
            level=level,
            score=score,
            summary="Cross-modal non-concordance detected. Manual clinician review recommended."
            if level in {"medium", "high"}
            else "No strong cross-modal discrepancy detected.",
        ),
        key_contradictions=contradictions,
        recommended_data_actions=list({a for r in reports for a in r.requested_data}),
        reasoning_trace=reasoning,
        limitations=[
            "Stub agents (Day 1). Replace with HAI-DEF inference outputs from Kaggle GPU notebooks."
        ],
        agent_reports=reports,
    )
