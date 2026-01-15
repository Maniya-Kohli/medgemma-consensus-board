from __future__ import annotations
import json
from pathlib import Path
from typing import Optional
from consensus_board.schemas.contracts import AgentReport

RUNS_DIR = Path("artifacts/runs")


def _read_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def load_agent_report(case_id: str, agent_name: str) -> Optional[AgentReport]:
    """
    Loads artifacts/runs/<case_id>/<agent_name>.json if it exists.
    Returns None if missing.
    """
    path = RUNS_DIR / case_id / f"{agent_name}.json"
    if not path.exists():
        return None
    data = _read_json(path)
    return _validate_agent_report(data)


def artifacts_exist(case_id: str) -> bool:
    folder = RUNS_DIR / case_id
    return folder.exists() and any(folder.glob("*.json"))

def _validate_agent_report(data: dict) -> AgentReport:
    # Pydantic v2
    if hasattr(AgentReport, "model_validate"):
        return AgentReport.model_validate(data)
    # Pydantic v1
    return AgentReport.parse_obj(data)

