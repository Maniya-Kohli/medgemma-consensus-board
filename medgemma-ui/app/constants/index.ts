// ============================================================================
// CONSTANTS
// ============================================================================

export const NEXT_PUBLIC_API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

console.log(
  "Current API URL:",
  process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_API_URL,
);

// constants/index.ts
export const getSeverityTheme = (
  severity: "low" | "medium" | "high",
): { color: string; stroke: string; bg: string; border: string } => {
  return SEVERITY_MAP[severity];
};

export const SEVERITY_MAP: Record<
  "low" | "medium" | "high",
  { color: string; stroke: string; bg: string; border: string }
> = {
  low: {
    color: "text-emerald-500",
    stroke: "#10b981",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
  },
  medium: {
    color: "text-amber-500",
    stroke: "#f59e0b",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
  },
  high: {
    color: "text-rose-500",
    stroke: "#f43f5e",
    bg: "bg-rose-500/10",
    border: "border-rose-500/20",
  },
};

export const AGENT_ICONS: Record<string, string> = {
  AudioAgent: "🎤",
  VisionAgent: "👁️",
  LeadClinician: "🧠",
};

export const CASES: Record<string, { history: string; findings: string }> = {
  "CASE_A-2401": {
    history:
      "72yo Male, history of COPD and HF. Presents with productive cough and fever. Decreased breath sounds at right base.",
    findings: "Pneumonia vs Heart Failure",
  },
  "CASE_B-9920": {
    history:
      "45yo Female, non-smoker. Persistent dry cough for 2 months. Sharp localized chest pain.",
    findings: "Inconclusive - Requires further imaging",
  },
  "CASE_C-1033": {
    history:
      "29yo Male, athlete. Sudden onset dyspnea during exercise. Normal vitals except slight tachycardia.",
    findings: "Pneumothorax risk",
  },
};

export const COLOR_MAP = {
  blue: "border-blue-500/30 bg-blue-500/5 text-blue-400 icon-bg-blue-500/10",
  amber:
    "border-amber-500/30 bg-amber-500/5 text-amber-400 icon-bg-amber-500/10",
  emerald:
    "border-emerald-500/30 bg-emerald-500/5 text-emerald-400 icon-bg-emerald-500/10",
};
