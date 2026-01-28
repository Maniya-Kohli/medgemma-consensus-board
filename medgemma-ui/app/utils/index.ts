// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

import { AnalysisResult, StreamEvent, AgentReport } from "../types";
import { AGENT_ICONS } from "../constants";

export const getSeverity = (score: number): "low" | "medium" | "high" => {
  if (score > 0.7) return "high";
  if (score > 0.4) return "medium";
  return "low";
};

export const generateSessionId = (): string => {
  return `UPLOAD-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
};

/**
 * FIXED: Parse backend stream data into frontend AnalysisResult format
 * Handles both nested and flat confidence structures
 */
export const parseStreamFinalEvent = (
  data: StreamEvent,
  currentCaseId: string,
): AnalysisResult => {
  // ✅ FIX: Handle both nested (data.parsed.confidence) and flat (data.confidence) structures
  const verdict = data.parsed || {};
  const agentReports = data.agent_reports || [];
  const auditTrail = data.audit_trail || [];
  const rawLogic = data.raw_logic || "";
  const metadata = data.metadata || {};

  // ✅ FIX: Extract confidence from multiple possible locations
  let confidence = 0;
  if (typeof verdict.confidence === "number") {
    confidence = verdict.confidence;
  } else if (typeof data.confidence === "number") {
    confidence = data.confidence;
  }

  // Map backend agent reports to frontend structure
  const detailedReports = agentReports.map((report: any) => {
    let agentName = "unknown";
    if (report.agent === "AudioAgent") agentName = "acoustics";
    else if (report.agent === "VisionAgent") agentName = "imaging";
    else if (report.agent === "LeadClinician") agentName = "clinician";

    const agentIcon =
      AGENT_ICONS[report.agent as keyof typeof AGENT_ICONS] || "🤖";

    return {
      agent_name: agentName,
      model:
        report.agent === "VisionAgent"
          ? "MedGemma-1.5-4b"
          : report.agent === "AudioAgent"
            ? "Google-HeAR"
            : "MedGemma-1.5-4b",
      analysis_status: report.status || "complete",
      observation: report.observation || "",
      execution_time: report.execution_time || "0s",
      claims: report.claims || [
        {
          label: "Raw Evidence",
          value: report.observation || "",
          confidence: 0.9,
          evidence: [],
        },
      ],
      icon: agentIcon,
      success: report.status === "completed",
      internal_logic: report.observation || "",
      draft_findings: report.metadata?.draft || "",
      supervisor_critique: report.metadata?.critique || "",
      quality_flags: [],
      uncertainties: report.error ? [report.error] : [],
      requested_data: [],
    };
  });

  // ✅ FIX: Properly type the level as one of the allowed values
  const getConfidenceLevel = (
    conf: number,
  ): "high" | "medium" | "low" | "none" => {
    if (conf > 70) return "high";
    if (conf > 40) return "medium";
    if (conf > 0) return "low";
    return "none";
  };

  // ✅ FIX: Use extracted confidence value with proper typing
  const finalResult: AnalysisResult = {
    case_id: currentCaseId,
    discrepancy_alert: {
      level: getConfidenceLevel(confidence),
      score: confidence / 100, // Normalize to 0-1 range
      summary:
        verdict.consensus_summary ||
        verdict.reasoning ||
        data.reasoning ||
        "Adjudication complete.",
    },
    key_contradictions:
      verdict.differential_diagnosis || data.differential_diagnosis || [],
    recommended_data_actions:
      verdict.differential_diagnosis || data.differential_diagnosis || [],
    reasoning_trace: auditTrail.map((entry: string) => {
      return entry
        .replace(/^✅\s*/, "")
        .replace(/^📋\s*/, "")
        .replace(/^🎯\s*/, "");
    }),
    agent_reports: detailedReports,
    evidence_table: [],
    limitations: ["Automated analysis requires clinical correlation"],
    audit_markdown: `### Blackboard Session Audit\n\n${auditTrail.map((entry: string, i: number) => `${i + 1}. ${entry}`).join("\n")}`,
    thought_process: rawLogic,
    matrix_details: metadata.matrix_details || {},
    moderator_metadata: {
      total_iterations: metadata.total_iterations,
      total_agents: metadata.total_agents || agentReports.length,
      successful_agents:
        metadata.successful_agents ||
        agentReports.filter((r: any) => r.status === "completed").length,
      execution_times: metadata.execution_times || {},
      focus_areas: metadata.focus_areas || [],
    },
  };

  return finalResult;
};

/**
 * Parse step metadata from thinking console messages
 */
export const parseStepMetadata = (
  step: string,
): {
  hasMetadata: boolean;
  findingsCount?: number;
  focusArea?: string;
} => {
  const findingsMatch = step.match(/\[(\d+) findings\]/);
  const focusMatch = step.match(/🎯 Focus: ([\w\s,]+)/);

  return {
    hasMetadata: !!(findingsMatch || focusMatch),
    findingsCount: findingsMatch ? parseInt(findingsMatch[1]) : undefined,
    focusArea: focusMatch ? focusMatch[1] : undefined,
  };
};

/**
 * Get styling for thinking console steps
 */
export const getStepStyle = (step: string): string => {
  if (
    step.includes("Iteration") ||
    step.includes("Dispatching") ||
    step.includes("Moderator") ||
    step.includes("🎯") ||
    step.includes("🔄")
  ) {
    return "text-blue-400 font-bold";
  }
  if (step.includes("🎤") || step.includes("👁️") || step.includes("🧠")) {
    return "text-cyan-400 font-semibold";
  }
  if (step.includes("✅") || step.includes("complete")) {
    return "text-emerald-400";
  }
  if (step.includes("⚠️") || step.includes("WARNING")) {
    return "text-amber-400";
  }
  if (step.includes("❌") || step.includes("Error") || step.includes("💥")) {
    return "text-rose-400";
  }
  if (step.includes("Focus:") || step.includes("findings")) {
    return "text-purple-400";
  }
  return "text-blue-300/60";
};

/**
 * Extract icon from step message
 */
export const getStepIcon = (step: string): string | null => {
  if (step.includes("🎤")) return "🎤";
  if (step.includes("👁️")) return "👁️";
  if (step.includes("🧠")) return "🧠";
  if (step.includes("🎯")) return "🎯";
  if (step.includes("🔄")) return "🔄";
  if (step.includes("✅")) return "✅";
  if (step.includes("⚠️")) return "⚠️";
  if (step.includes("❌")) return "❌";
  if (step.includes("📋")) return "📋";
  if (step.includes("🚀")) return "🚀";
  if (step.includes("🏁")) return "🏁";
  return null;
};
