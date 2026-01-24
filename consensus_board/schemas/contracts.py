from __future__ import annotations
from typing import Any, Literal, Optional, Dict, List, Union
from pydantic import BaseModel, Field


class EvidenceRef(BaseModel):
    # UPDATE: Added "vector_embedding" to the list of allowed types
    type: Literal["metric", "note_span", "audio_segment", "image_ref", "text", "vector_embedding"]
    id: str
    value: Optional[Any] = None


class Claim(BaseModel):
    label: str
    value: str
    confidence: float = Field(ge=0.0, le=1.0)
    evidence: list[EvidenceRef] = Field(default_factory=list)


class QualityFlag(BaseModel):
    type: str
    severity: Literal["low", "medium", "high"] = "low"
    detail: Optional[str] = None


class AgentReport(BaseModel):
    agent_name: Literal["imaging", "acoustics", "history"]
    model: str
    claims: list[Claim]
    quality_flags: list[QualityFlag] = Field(default_factory=list)
    uncertainties: list[str] = Field(default_factory=list)
    requested_data: list[str] = Field(default_factory=list)


class VisionReport(BaseModel):
    case_id: str
    agent_name: str = "imaging"
    model: str = "MedGemma-2b-Vision"
    claims: List[Dict[str, Any]] = Field(default_factory=list)

    # Reasoning Traces from the Agentic Loop
    draft_findings: str      # Phase 1: Strategic Plan
    supervisor_critique: str # Phase 2: Sensitive Analysis (High Recall/Noise)
    internal_logic: str      # Phase 3: Final Clinical Consensus
    
    analysis_status: str = "complete"

class CaseInput(BaseModel):
    case_id: str
    # In Day 1 we pass paths/ids; later you'll pass uploaded bytes and store to disk
    image_current_path: Optional[str] = None
    image_prior_path: Optional[str] = None
    audio_current_path: Optional[str] = None
    audio_prior_path: Optional[str] = None
    clinical_note_text: str


class DiscrepancyAlert(BaseModel):
    level: Literal["none", "low", "medium", "high"]
    score: float = Field(ge=0.0, le=1.0)
    summary: str


class ConsensusOutput(BaseModel):
    case_id: str
    discrepancy_alert: DiscrepancyAlert
    key_contradictions: list[str] = Field(default_factory=list)
    evidence_table: list[dict[str, Any]] = Field(default_factory=list)
    recommended_data_actions: list[str] = Field(default_factory=list)
    reasoning_trace: list[str] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
    agent_reports: List[Union[VisionReport, AgentReport]] 
    audit_markdown: Optional[str] = None
    thought_process : Optional[str] = None
    