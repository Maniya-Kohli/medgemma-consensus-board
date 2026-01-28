// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type AgentType = "AudioAgent" | "VisionAgent" | "LeadClinician";

export interface EvidenceRef {
  type:
    | "metric"
    | "note_span"
    | "audio_segment"
    | "image_ref"
    | "text"
    | "vector_embedding";
  id: string;
  value?: any;
}

export interface Claim {
  label: string;
  value: string;
  confidence: number;
  evidence?: EvidenceRef[];
  source_agent?: string;
  timestamp?: number;
}

// ============================================================================
// NEW: Hypothesis Evaluation Types
// ============================================================================
export interface EvaluatedHypothesis {
  diagnosis: string;
  evaluation: string;
  score: number;
}

export interface ReasoningChain {
  full_chain: string;
  steps: string[];
  working_hypothesis: string;
}

// ============================================================================
// ENHANCED: AgentReport with all metadata
// ============================================================================
export interface AgentReport {
  agent_name?: string;
  agent?: string;
  model?: string;
  claims?: Claim[];
  quality_flags?: any[];
  uncertainties?: string[];
  requested_data?: string[];
  analysis_status?: string;
  observation?: string;
  execution_time?: string;
  icon?: string;
  success?: boolean;
  status?: string;
  error?: string;
  metadata?: {
    draft?: string;
    critique?: string;
    // ✅ ADD: New fields for agentic reasoning
    reasoning_chain?: ReasoningChain;
    differential_evaluated?: EvaluatedHypothesis[];
    was_revised?: boolean;
    final_confidence?: number;
    evidence_summary?: any;
    focus_areas?: string;
    initial_finding?: any;
    consistency_check?: any;
    execution_log?: any[];
    signal_mean?: number;
    signal_std?: number;
  };
}

export interface VisionReport extends AgentReport {
  case_id?: string;
  draft_findings?: string;
  supervisor_critique?: string;
  internal_logic?: string;
}

export interface DiscrepancyAlert {
  level: "none" | "low" | "medium" | "high";
  score: number;
  summary: string;
}

export interface AnalysisResult {
  case_id: string;
  discrepancy_alert: DiscrepancyAlert;
  key_contradictions: string[];
  evidence_table: Record<string, any>[];
  recommended_data_actions: string[];
  reasoning_trace: string[];
  limitations: string[];
  agent_reports: (AgentReport | VisionReport)[]; // ✅ Kept original type
  audit_markdown?: string;
  thought_process?: string;
  matrix_details?: Record<string, { description: string; findings: string[] }>;
  moderator_metadata?: {
    total_iterations?: number;
    total_agents?: number;
    successful_agents?: number;
    execution_times?: Record<string, number>;
    focus_areas?: string[];
    blackboard_state?: string;
  };
}

export interface CaseItem {
  history: string;
  findings: string;
}

// Backend stream event types
export interface StreamEvent {
  type:
    | "status"
    | "agent_start"
    | "agent_complete"
    | "thought"
    | "final"
    | "error";
  message?: string;
  metadata?: any;
  agent?: string;
  delta?: string;
  parsed?: any;
  agent_reports?: any[];
  audit_trail?: string[];
  raw_logic?: string;
  condition?: string;
  confidence?: number;
  reasoning?: string;
  differential_diagnosis?: string[];
  consensus_summary?: string;
}
