from consensus_board.schemas.contracts import AgentReport, Claim, EvidenceRef, QualityFlag


def imaging_stub() -> AgentReport:
    return AgentReport(
        agent_name="imaging",
        model="MedSigLIP (stub)",
        claims=[
            Claim(
                label="imaging_stability",
                value="stable",
                confidence=0.86,
                evidence=[EvidenceRef(type="metric", id="img_change_score", value=0.07)],
            )
        ],
        quality_flags=[],
        uncertainties=["No prior CT series; using single view placeholder."],
        requested_data=[],
    )


def acoustics_stub() -> AgentReport:
    return AgentReport(
        agent_name="acoustics",
        model="HeAR (stub)",
        claims=[
            Claim(
                label="resp_abnormal",
                value="present_new",
                confidence=0.88,
                evidence=[EvidenceRef(type="audio_segment", id="audio_current_12s_20s")],
            )
        ],
        quality_flags=[QualityFlag(type="noise", severity="low", detail="Mild background noise.")],
        uncertainties=["Short clip duration."],
        requested_data=["Repeat recording in quiet environment (10–15s)."],
    )

