from consensus_board.schemas.contracts import AgentReport


def compute_discrepancy_score(reports: list[AgentReport]) -> tuple[float, list[str]]:
    # Extract key signals
    imaging = next((r for r in reports if r.agent_name == "imaging"), None)
    acoustics = next((r for r in reports if r.agent_name == "acoustics"), None)
    history = next((r for r in reports if r.agent_name == "history"), None)

    def claim_value(r: AgentReport | None, label: str) -> str | None:
        if not r:
            return None
        for c in r.claims:
            if c.label == label:
                return c.value
        return None

    imaging_stability = claim_value(imaging, "imaging_stability")
    resp_abnormal = claim_value(acoustics, "resp_abnormal")
    weight_loss = claim_value(history, "weight_loss")

    contradictions = []
    score = 0.0

    worsening_signals = 0
    if resp_abnormal in {"present_new", "present_worse"}:
        worsening_signals += 1
    if weight_loss is not None:
        worsening_signals += 1

    if imaging_stability == "stable" and worsening_signals >= 1:
        contradictions.append("Imaging suggests stability while other modalities indicate deterioration signals.")
        score += 0.35

    if worsening_signals >= 2:
        score += 0.20

    # Confidence bonus: if at least two claims have high confidence
    high_conf = 0
    for r in reports:
        for c in r.claims:
            if c.confidence >= 0.8:
                high_conf += 1
                break
    if high_conf >= 2:
        score += 0.15

    # Quality penalty
    severe_flags = sum(1 for r in reports for q in r.quality_flags if q.severity == "high")
    score -= 0.20 * severe_flags

    score = max(0.0, min(1.0, score))
    return score, contradictions


def score_to_level(score: float) -> str:
    if score > 0.60:
        return "high"
    if score >= 0.30:
        return "medium"
    if score > 0.0:
        return "low"
    return "none"
