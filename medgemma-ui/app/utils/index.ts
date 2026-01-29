// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

import { AnalysisResult, StreamEvent, AgentReport, Claim } from "../types";
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
  const verdict = data.parsed || {};
  const agentReports = data.agent_reports || [];
  const auditTrail = data.audit_trail || [];
  const rawLogic = data.raw_logic || "";
  const metadata = data.metadata || {};

  // Extract confidence from multiple possible locations
  let confidence = 0;
  if (typeof verdict.confidence === "number") {
    confidence = verdict.confidence;
  } else if (typeof data.confidence === "number") {
    confidence = data.confidence;
  }

  // Extract differential_diagnosis
  const differentialDiagnosis =
    verdict.differential_diagnosis || data.differential_diagnosis || [];

  console.log("🔍 DEBUG - Raw Agent Reports:", agentReports);

  // Map backend agent reports to frontend structure
  const detailedReports = agentReports.map((report: any) => {
    let agentName = "unknown";
    if (report.agent === "AudioAgent") agentName = "acoustics";
    else if (report.agent === "VisionAgent") agentName = "imaging";
    else if (report.agent === "LeadClinician") agentName = "clinician";

    const agentIcon =
      AGENT_ICONS[report.agent as keyof typeof AGENT_ICONS] || "🤖";

    // ✅ FIX 1: Map status: "completed" to success: true
    const isSuccess = report.status === "completed";

    // ✅ FIX 2: Extract claims from backend - they should be in report.claims
    let claims: Claim[] = [];

    if (
      report.claims &&
      Array.isArray(report.claims) &&
      report.claims.length > 0
    ) {
      // Backend sends claims directly
      claims = report.claims.map((claim: any) => ({
        label: claim.label || "Finding",
        value: claim.value || "",
        confidence: claim.confidence || 0.8,
        evidence: claim.evidence || [],
        source_agent: claim.source_agent || report.agent,
      }));
      console.log(
        `✅ ${report.agent} has ${claims.length} claims from backend`,
      );
    } else if (report.metadata?.structured_reasoning) {
      // ✅ FIX 3: Build claims from structured_reasoning if claims[] is empty
      const structured = report.metadata.structured_reasoning;
      const conf = report.metadata?.final_confidence || 0.85;

      console.log(
        `🔧 Building claims for ${report.agent} from structured_reasoning`,
      );

      if (structured.observations) {
        claims.push({
          label:
            report.agent === "VisionAgent"
              ? "Radiographic Observations"
              : "Acoustic Observations",
          value: structured.observations,
          confidence: conf,
          evidence: [],
          source_agent: report.agent,
        });
      }

      if (structured.patterns) {
        claims.push({
          label: "Pattern Recognition",
          value: structured.patterns,
          confidence: conf,
          evidence: [],
          source_agent: report.agent,
        });
      }

      if (structured.hypotheses) {
        claims.push({
          label: "Clinical Hypotheses",
          value: structured.hypotheses,
          confidence: conf - 0.05,
          evidence: [],
          source_agent: report.agent,
        });
      }

      if (structured.evidence_evaluation) {
        claims.push({
          label: "Evidence Evaluation",
          value: structured.evidence_evaluation,
          confidence: conf,
          evidence: [],
          source_agent: report.agent,
        });
      }

      console.log(`✅ Built ${claims.length} claims for ${report.agent}`);
    }

    // ✅ FIX 4: Observation fallback chain
    let observation = report.observation || "";
    if (!observation && report.metadata?.structured_reasoning) {
      const sr = report.metadata.structured_reasoning;
      observation = sr.conclusion || sr.hypotheses || sr.patterns || "";
    }
    if (!observation && report.metadata?.full_reasoning_chain) {
      observation = report.metadata.full_reasoning_chain.substring(0, 500);
    }

    // ✅ FIX 5: Format execution time
    let executionTime = "N/A";
    if (typeof report.execution_time === "number") {
      executionTime = `${report.execution_time.toFixed(2)}s`;
    } else if (typeof report.execution_time === "string") {
      executionTime = report.execution_time;
    }

    // Build differential_evaluated for LeadClinician
    let differential_evaluated = report.metadata?.differential_evaluated;
    if (
      !differential_evaluated &&
      report.agent === "LeadClinician" &&
      differentialDiagnosis.length > 0
    ) {
      differential_evaluated = differentialDiagnosis.map(
        (diagnosis: string, idx: number) => {
          const baseScore = 90 - idx * 15;
          const score = Math.max(10, Math.min(100, baseScore));
          return {
            diagnosis: diagnosis,
            evaluation: `Multi-agent analysis suggests ${diagnosis} as a differential diagnosis.`,
            score: score,
          };
        },
      );
    }

    const mappedReport: AgentReport = {
      agent_name: agentName,
      agent: report.agent,
      model:
        report.agent === "VisionAgent"
          ? "MedGemma-1.5-4b"
          : report.agent === "AudioAgent"
            ? "Google-HeAR"
            : "MedGemma-1.5-4b",
      analysis_status: report.status || "complete",
      observation: observation,
      execution_time: executionTime,
      claims: claims, // ✅ FIX: Now properly populated
      icon: agentIcon,
      success: isSuccess, // ✅ FIX: Now properly mapped
      status: report.status,
      error: report.error,
      metadata: {
        draft: report.metadata?.draft || "",
        critique: report.metadata?.critique || "",
        differential_evaluated,
        reasoning_chain: report.metadata?.reasoning_chain,
        was_revised: report.metadata?.was_revised,
        final_confidence: report.metadata?.final_confidence,
        evidence_summary: report.metadata?.evidence_summary,
        focus_areas: report.metadata?.focus_areas,
      },
      quality_flags: [],
      uncertainties: report.error ? [report.error] : [],
      requested_data: [],
    };

    console.log(`📊 Mapped ${report.agent}:`, {
      success: mappedReport.success,
      claimsCount: mappedReport.claims?.length || 0,
      hasObservation: !!mappedReport.observation,
    });

    return mappedReport;
  });

  // Get confidence level
  const getConfidenceLevel = (
    conf: number,
  ): "high" | "medium" | "low" | "none" => {
    if (conf > 70) return "high";
    if (conf > 40) return "medium";
    if (conf > 0) return "low";
    return "none";
  };

  const finalResult: AnalysisResult = {
    case_id: currentCaseId,
    discrepancy_alert: {
      level: getConfidenceLevel(confidence),
      score: confidence / 100,
      summary:
        verdict.consensus_summary ||
        verdict.reasoning ||
        data.reasoning ||
        "Adjudication complete.",
    },
    key_contradictions: differentialDiagnosis,
    recommended_data_actions: differentialDiagnosis,
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

  console.log("✅ Final Result:", {
    agentCount: finalResult.agent_reports.length,
    hasDiscrepancy: !!finalResult.discrepancy_alert,
    agents: finalResult.agent_reports.map((a) => ({
      name: a.agent_name,
      success: a.success,
      claims: a.claims?.length || 0,
    })),
  });

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
