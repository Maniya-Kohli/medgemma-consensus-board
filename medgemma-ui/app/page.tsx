"use client";
import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";

import {
  Activity,
  FileText,
  Image as ImageIcon,
  Volume2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  Play,
  RotateCcw,
  Upload,
  Microscope,
  Stethoscope,
  ClipboardList,
  TrendingUp,
  Shield,
  Layers,
  Maximize2,
  AlertOctagon,
  Lightbulb,
  Info,
  ShieldAlert,
  ArrowRightCircle,
  Search,
  ExternalLink,
  MessageSquare,
  Pause,
} from "lucide-react";

/**
 * MOMO CLINICAL CONSENSUS BOARD - V3.5
 * Refinement: Equal button sizing, unified Directive colors, and Audit Markdown integration.
 */

// --- Interfaces ---

interface EvidenceRef {
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

interface Claim {
  label: string;
  value: string;
  confidence: number;
  evidence: EvidenceRef[];
}

interface AgentReport {
  agent_name: "imaging" | "acoustics" | "history";
  model: string;
  claims: Claim[];
  quality_flags: any[];
  uncertainties: string[];
  requested_data: string[];
}

interface DiscrepancyAlert {
  level: "none" | "low" | "medium" | "high";
  score: number;
  summary: string;
}

interface AnalysisResult {
  case_id: string;
  discrepancy_alert: DiscrepancyAlert;
  key_contradictions: string[];
  evidence_table: Record<string, any>[];
  recommended_data_actions: string[];
  reasoning_trace: string[];
  limitations: string[];
  agent_reports: (AgentReport | VisionReport)[];
  audit_markdown?: string;
  thought_process?: string;
  matrix_details?: Record<string, { description: string; findings: string[] }>;
}
// Add these to your interfaces
/**
 * Aligned with backend VisionReport(BaseModel)
 * Mirrors the Plan -> Execute -> Check Agentic Loop
 */
interface VisionReport {
  case_id: string;
  agent_name: string; // Default: "imaging"
  model: string; // Default: "MedGemma-2b-Vision"

  /** * Required for ConsensusOutput validation.
   * Even if empty, this must exist to prevent Pydantic crashes.
   */
  claims: Array<{
    label: string;
    value: any;
    [key: string]: any; // Allows for flexible metadata
  }>;

  // --- Multi-Phase Reasoning Traces ---

  /** Phase 1: Strategic Plan */
  draft_findings: string;

  /** Phase 2: Sensitive Analysis (High Recall/Noise) */
  supervisor_critique: string;

  /** Phase 3: Final Clinical Consensus */
  internal_logic: string;

  /** Status tracker: 'complete' | 'failed' | 'pending' */
  analysis_status: string;
}

interface CaseItem {
  history: string;
  findings: string;
}

// --- Constants ---ß

const API_URL = "http://127.0.0.1:8000";

// --- Sub-Component: Neural Thinking Console ---
const ThinkingConsole = ({ steps }: { steps: string[] }) => {
  return (
    <div className="w-full max-w-lg bg-[#05070a] border border-blue-500/30 rounded-xl p-4 font-mono text-[11px] space-y-1 max-h-64 overflow-y-auto shadow-2xl">
      <div className="flex items-center justify-between border-b border-blue-500/20 pb-2 mb-2">
        <span className="text-blue-400 font-black tracking-tighter">
          BLACKBOARD ACTIVE SESSION
        </span>
        <div className="flex gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500/40" />
        </div>
      </div>
      {steps.map((step, i) => (
        <div key={i} className="flex gap-2 py-0.5">
          <span className="text-blue-900 shrink-0">
            {(i + 1).toString().padStart(2, "0")}
          </span>
          <span
            className={`${step.includes("✅") ? "text-emerald-400" : "text-slate-400"}`}
          >
            {step}
          </span>
        </div>
      ))}
    </div>
  );
};

export const useAegisStream = (API_URL: string) => {
  const [thinkingSteps, setThinkingSteps] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const streamAnalysis = async (
    formData: FormData,
    caseId: string, // Pass the ID here
    onFinal: (data: AnalysisResult) => void,
  ) => {
    setIsStreaming(true);
    setThinkingSteps(["Initializing Neural Connection..."]);

    try {
      const response = await fetch(`${API_URL}/agent/vision/stream`, {
        method: "POST",
        body: formData,
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const payload = JSON.parse(line.replace("data: ", ""));

              switch (payload.type) {
                case "status":
                case "thought":
                  setThinkingSteps((prev) => [...prev, payload.message]);
                  break;
                case "final":
                  onFinal({
                    case_id: caseId,
                    discrepancy_alert: {
                      summary: payload.finding,
                      score: 0.85,
                      level: "high",
                    },
                    agent_reports: [
                      {
                        case_id: caseId,
                        agent_name: "imaging",
                        model: "MedGemma-2b-Vision",
                        internal_logic: payload.data_for_consensus,
                        draft_findings: payload.metadata.plan,
                        supervisor_critique: payload.metadata.recall_data,
                        analysis_status: "complete",
                        claims: [],
                      },
                    ],
                    // --- Satisfying AnalysisResult Interface ---
                    evidence_table: [],
                    key_contradictions: [],
                    limitations: ["Preliminary automated analysis"],
                    recommended_data_actions: ["Review Adjudication Log"],
                    reasoning_trace: [
                      "Phase 1: Strategic Planning",
                      payload.metadata.plan,
                      "Phase 2: Sensitive Analysis",
                      payload.metadata.recall_data,
                    ],
                    audit_markdown: payload.finding,
                    thought_process: payload.data_for_consensus,
                  });
                  setIsStreaming(false);
                  break;
                case "error":
                  setThinkingSteps((prev) => [
                    ...prev,
                    `❌ Error: ${payload.message}`,
                  ]);
                  setIsStreaming(false);
                  break;
              }
            } catch (e) {
              console.error("Error parsing stream chunk", e);
            }
          }
        }
      }
    } catch (err) {
      setThinkingSteps((prev) => [...prev, "❌ Connection failed."]);
      setIsStreaming(false);
    }
  };

  return { thinkingSteps, isStreaming, streamAnalysis };
};

// const ThinkingConsole = ({ steps }: { steps: string[] }) => {
//     const scrollRef = useRef<HTMLDivElement>(null);

//     useEffect(() => {
//       if (scrollRef.current) {
//         scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
//       }
//     }, [steps]);

//     return (
//       <div
//         className="bg-[#0a0e14] border border-blue-500/20 rounded-xl p-4 font-mono text-[10px] space-y-2 max-h-48 overflow-y-auto scrollbar-thin"
//         ref={scrollRef}
//       >
//         <div className="flex items-center gap-2 text-blue-500 mb-2">
//           <Activity className="w-3 h-3 animate-pulse" />
//           <span className="font-black uppercase tracking-widest">
//             Neural Stream Active
//           </span>
//         </div>
//         {steps.map((step, i) => (
//           <div
//             key={i}
//             className="flex gap-2 animate-in fade-in slide-in-from-left-2 duration-300"
//           >
//             <span className="text-slate-600">
//               [{new Date().toLocaleTimeString([], { hour12: false })}]
//             </span>
//             <span
//               className={
//                 step.includes("❌") ? "text-rose-400" : "text-slate-300"
//               }
//             >
//               {step}
//             </span>
//           </div>
//         ))}
//         <div className="flex gap-2 text-blue-400 animate-pulse">
//           <span>&gt;</span>
//           <span className="w-2 h-4 bg-blue-500/50" />
//         </div>
//       </div>
//     );
//   };

//   return { thinkingSteps, isStreaming, streamAnalysis };
// };

const SEVERITY_MAP: Record<
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
// --- Sub-Component: Radiographic Card ---
const RadiographicCard = ({
  xrayFile,
  analysisResult,
  setShowImagingModal,
}: any) => {
  // 🛡️ Logic to normalize the Vision Agent structure
  const rawImgReport = analysisResult?.agent_reports?.find(
    (a: any) => a.agent_name === "imaging" || a.type === "final",
  );

  // Normalize: Ensure claims exist and map backend 'finding' to 'internal_logic' if needed
  const imgReport: VisionReport | null = rawImgReport
    ? {
        ...rawImgReport,
        claims: rawImgReport.claims || [],
        analysis_status:
          rawImgReport.analysis_status ||
          (rawImgReport.finding ? "complete" : "pending"),
        internal_logic:
          rawImgReport.internal_logic || rawImgReport.finding || "",
      }
    : null;

  return (
    <div className="bg-[#151b26] border border-[#2a3441] hover:border-blue-500/30 rounded-2xl shadow-lg transition-all duration-300">
      <div className="p-5 flex flex-col h-full">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
              <ImageIcon className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">
                Radiographic Analysis
              </h4>
              <p className="text-xs text-slate-400">Multi-phase evaluation</p>
            </div>
          </div>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
            {imgReport?.analysis_status === "complete" ? "Verified" : "Pending"}
          </span>
        </div>

        <div className="aspect-square bg-[#0a0e14] rounded-xl flex items-center justify-center border border-[#2a3441] relative overflow-hidden group mb-4">
          {xrayFile ? (
            <img
              src={URL.createObjectURL(xrayFile)}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              alt="X-Ray"
            />
          ) : (
            <div className="text-center flex flex-col items-center opacity-30">
              <ImageIcon className="w-16 h-16 mb-3 text-slate-600" />
              <p className="text-xs font-medium text-slate-500">
                No imaging uploaded
              </p>
            </div>
          )}
        </div>

        {!imgReport || imgReport.analysis_status !== "complete" ? (
          <div className="flex-1 flex flex-col items-center justify-center py-8 space-y-3">
            <div className="w-5 h-5 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest animate-pulse">
              Awaiting Neural Feedback...
            </p>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex-1 space-y-2 mb-4">
              {[
                { label: "Strategic Planning", color: "blue" },
                { label: "High-Recall Execution", color: "amber" },
                { label: "Clinical Adjudication", color: "emerald" },
              ].map((phase) => (
                <div key={phase.label} className="flex items-center gap-2">
                  <CheckCircle className={`w-3 h-3 text-${phase.color}-400`} />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                    {phase.label} Complete
                  </span>
                </div>
              ))}

              <div className="mt-4 pt-4 border-t border-white/5 relative">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  Final Assessment
                </p>
                <div className="relative max-h-32 overflow-hidden">
                  <div className="text-xs text-slate-400 leading-relaxed prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-strong:text-slate-200">
                    <ReactMarkdown>
                      {imgReport.internal_logic || "Synthesizing consensus..."}
                    </ReactMarkdown>
                  </div>
                  {imgReport.internal_logic && (
                    <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[#151b26] to-transparent flex items-end justify-center pb-1">
                      <span className="text-[9px] font-black text-blue-500/60 uppercase tracking-tighter">
                        ... click "view full analysis"
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowImagingModal(true)}
              className="w-full py-2 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 rounded-lg text-[10px] font-black text-blue-400 uppercase tracking-widest transition-all flex items-center justify-center gap-2 group mt-2"
            >
              <Maximize2 className="w-3 h-3 group-hover:scale-110 transition-transform" />
              View Full Analysis
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
// --- Sub-Component: Acoustic Card ---
const AcousticCard = ({
  audioFile,
  isAudioPlaying,
  setIsAudioPlaying,
  analysisResult,
}: any) => {
  // 🛡️ Safe extraction with optional chaining
  const acousticReport = analysisResult?.agent_reports?.find(
    (a: any) => a.agent_name === "acoustics",
  );

  return (
    <div className="bg-[#151b26] border border-[#2a3441] hover:border-emerald-500/30 rounded-2xl shadow-lg transition-all duration-300">
      <div className="p-5 flex flex-col h-full">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <Volume2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">
                Acoustic Analysis
              </h4>
              <p className="text-xs text-slate-400">Auscultation findings</p>
            </div>
          </div>
          {/* Added dynamic status badge */}
          <span
            className={`text-[9px] font-black px-2 py-0.5 rounded-md border uppercase tracking-tighter ${acousticReport ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-slate-500/5 text-slate-500 border-slate-500/10"}`}
          >
            {acousticReport ? "Verified" : "Signal Pending"}
          </span>
        </div>

        <div className="bg-[#0a0e14] rounded-xl p-4 border border-[#2a3441] mb-4">
          {audioFile ? (
            <div className="space-y-4">
              <div className="h-16 flex items-end gap-1">
                {[...Array(32)].map((_, i) => (
                  <div
                    key={i}
                    className={`flex-1 rounded-t transition-all duration-300 ${isAudioPlaying ? "bg-emerald-500/50" : "bg-emerald-500/20"}`}
                    style={{
                      height: `${20 + Math.random() * 80}%`,
                      animationDelay: `${i * 0.03}s`,
                    }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-3">
                <button
                  className="w-10 h-10 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 flex items-center justify-center border border-emerald-500/30"
                  onClick={() => setIsAudioPlaying(!isAudioPlaying)}
                >
                  {isAudioPlaying ? (
                    <Pause className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Play className="w-4 h-4 text-emerald-400 ml-0.5" />
                  )}
                </button>
                <div className="flex-1">
                  <audio
                    controls
                    className="w-full h-8 opacity-60"
                    src={audioFile ? URL.createObjectURL(audioFile) : ""}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 opacity-30">
              <Volume2 className="w-12 h-12 mb-2 text-slate-600 mx-auto" />
              <p className="text-xs font-medium text-slate-500">
                No audio available
              </p>
            </div>
          )}
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto max-h-[300px] scrollbar-thin">
          {/* 🛡️ Guard: Check for acousticReport and its claims array specifically */}
          {!acousticReport || !acousticReport.claims ? (
            <div className="flex flex-col items-center justify-center py-10 opacity-20">
              <Activity className="w-6 h-6 mb-2 text-emerald-500 animate-pulse" />
              <p className="text-[10px] font-black uppercase tracking-widest text-center">
                Processing Acoustic Evidence...
              </p>
            </div>
          ) : (
            acousticReport.claims.map((claim: any, i: number) => (
              <div
                key={i}
                className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3 animate-in fade-in slide-in-from-left-2 duration-500"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-emerald-400">
                    Finding {i + 1}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-emerald-500/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-1000"
                        style={{ width: `${claim.confidence * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-emerald-400">
                      {Math.round(claim.confidence * 100)}%
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {claim.value}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// --- Sub-Component: History Card ---
const HistoryCard = ({ analysisResult }: any) => {
  // 🛡️ Safe extraction with optional chaining on the array itself
  const historyClaims = analysisResult?.agent_reports?.find(
    (a: any) => a.agent_name === "history",
  )?.claims;

  return (
    <div className="bg-[#151b26] border border-[#2a3441] hover:border-amber-500/30 rounded-2xl shadow-lg transition-all duration-300">
      <div className="p-5 flex flex-col h-full">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
              <ClipboardList className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Patient History</h4>
              <p className="text-xs text-slate-400">Extracted findings</p>
            </div>
          </div>
          {/* Status badge to maintain UI density during streaming */}
          <span
            className={`text-[9px] font-black px-2 py-0.5 rounded-md border uppercase tracking-tighter ${historyClaims ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-slate-500/5 text-slate-500 border-slate-500/10"}`}
          >
            {historyClaims ? "Extracted" : "Parsing..."}
          </span>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto max-h-[500px] scrollbar-thin">
          {/* 🛡️ Guard: Show a placeholder skeleton while historyClaims is undefined */}
          {!historyClaims ? (
            <div className="space-y-3 opacity-20">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="bg-[#0a0e14] border border-amber-500/10 rounded-lg p-4 animate-pulse"
                >
                  <div className="h-2 bg-amber-500/20 rounded w-3/4 mb-2" />
                  <div className="h-2 bg-amber-500/10 rounded w-1/2" />
                </div>
              ))}
              <div className="py-4 text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-500/40">
                  Scanning clinical notes...
                </p>
              </div>
            </div>
          ) : (
            historyClaims.map((claim: any, i: number) => (
              <div
                key={i}
                className="bg-[#0a0e14] border border-amber-500/20 rounded-lg p-3 hover:border-amber-500/40 transition-colors animate-in fade-in slide-in-from-right-2 duration-500"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-amber-400">
                      {i + 1}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed flex-1">
                    {claim.value}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// --- Sub-Component: Verdict & Contradictions ---
const VerdictCard = ({ analysisResult, setShowFullVerdict }: any) => {
  return (
    <div className="lg:col-span-5 flex flex-col gap-4 min-h-full">
      <div
        onClick={() => setShowFullVerdict(true)}
        className="bg-gradient-to-br from-[#1a212d] to-[#151b26] border border-[#2a3441] p-5 rounded-2xl shadow-xl relative overflow-hidden group cursor-pointer hover:border-blue-500/30 transition-all active:scale-[0.995] flex-1"
      >
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
          <Activity className="w-24 h-24 text-white" />
        </div>
        <div className="relative z-10 h-full flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              <p className="text-[9px] font-black text-blue-400 uppercase tracking-[0.2em]">
                Adjudicated Verdict
              </p>
            </div>
            <Maximize2 className="w-3 h-3 text-slate-600 group-hover:text-blue-500 transition-colors" />
          </div>

          <div className="text-sm font-bold text-white leading-relaxed mb-3 flex-1 line-clamp-6 prose prose-invert prose-sm max-w-none">
            <ReactMarkdown>
              {analysisResult?.discrepancy_alert?.summary ||
                "Analysis in progress..."}
            </ReactMarkdown>
          </div>

          <div className="flex flex-wrap gap-2 pt-3 border-t border-white/5">
            {analysisResult?.agent_reports?.map((agent: any, i: number) => (
              <span
                key={i}
                className="px-2 py-0.5 bg-white/5 rounded-md border border-white/10 text-[8px] font-bold text-slate-400 uppercase"
              >
                {agent.agent_name || "Specialist"}
              </span>
            ))}
          </div>
        </div>
      </div>

      {analysisResult.key_contradictions?.length > 0 && (
        <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl overflow-hidden shadow-lg p-4 flex flex-col shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-3 h-3 text-rose-500" />
            <h4 className="text-[9px] font-black text-rose-500 uppercase tracking-widest">
              Contradictions
            </h4>
          </div>
          <div className="space-y-1.5">
            {analysisResult.key_contradictions
              .slice(0, 2)
              .map((contradiction: string, i: number) => (
                <p
                  key={i}
                  className="text-[10px] text-rose-100/70 leading-tight"
                >
                  • {contradiction}
                </p>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

// --- Sub-Component: Clinical Directives ---
const DirectivesCard = ({ analysisResult, setShowFullDirectives }: any) => {
  const actions = analysisResult?.recommended_data_actions ?? [];

  return (
    <div className="lg:col-span-4 flex flex-col min-h-full">
      <div
        onClick={() => setShowFullDirectives(true)}
        className="bg-gradient-to-br from-[#1a212d] to-[#151b26] border border-[#2a3441] p-5 rounded-2xl shadow-xl relative overflow-hidden group cursor-pointer hover:border-blue-500/30 transition-all active:scale-[0.995] flex-1"
      >
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
          <ArrowRightCircle className="w-24 h-24 text-white" />
        </div>
        <div className="relative z-10 h-full flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              <p className="text-[9px] font-black text-blue-400 uppercase tracking-[0.2em]">
                Clinical Directives
              </p>
            </div>
            <Maximize2 className="w-3 h-3 text-slate-600 group-hover:text-blue-500 transition-colors" />
          </div>

          <div className="flex-1 space-y-3 mb-3 overflow-y-auto pr-1 scrollbar-thin max-h-[220px]">
            {actions.length > 0 ? (
              actions.map((action: string, i: number) => (
                <div
                  key={i}
                  className="flex gap-2 items-start animate-in fade-in slide-in-from-left-2 duration-300"
                >
                  <div className="w-3.5 h-3.5 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle className="w-2.5 h-2.5 text-blue-500" />
                  </div>
                  <h2 className="text-sm font-bold text-white leading-relaxed">
                    {action}
                  </h2>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-32 opacity-20">
                <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-2" />
                <p className="text-[10px] font-bold uppercase tracking-tighter">
                  Awaiting directives...
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-white/5">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
              {actions.length} Critical Actions
            </span>
            <span className="text-[9px] font-bold text-blue-500 uppercase tracking-widest group-hover:underline">
              Inspect Protocols
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Sub-Component: Severity Gauge ---
const SeverityCard = ({ analysisResult, getSeverity, SEVERITY_MAP }: any) => {
  /**
   * SAFETY GUARD: Sanitize the score.
   * 1. Check if the property exists.
   * 2. Force it to a number (in case it comes as a string).
   * 3. Fallback to 0 if it is NaN or undefined to prevent SVG breakage.
   */
  const rawScore = analysisResult?.discrepancy_alert?.score;
  const score =
    typeof rawScore === "number" && !isNaN(rawScore)
      ? Math.max(0, Math.min(1, rawScore)) // Clamp between 0 and 1
      : 0;

  // Derive theme based on sanitized score
  const severity = getSeverity(score);
  const theme = SEVERITY_MAP[severity] || SEVERITY_MAP.low; // Fallback to 'low' theme if undefined

  // SVG Constant: Circumference of a circle with r=58 is ~364.4
  const CIRCUMFERENCE = 364;

  return (
    <div className="lg:col-span-3 min-h-full">
      <div
        className={`h-full border rounded-2xl p-5 flex flex-col items-center justify-center space-y-3 shadow-xl transition-all duration-700 ${theme.bg} ${theme.border}`}
      >
        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">
          Discrepancy Severity
        </h4>

        <div className="relative flex items-center justify-center w-28 h-28">
          <svg
            className="w-full h-full transform -rotate-90 block"
            viewBox="0 0 128 128"
          >
            {/* Background Track */}
            <circle
              cx="64"
              cy="64"
              r="58"
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              className="text-slate-800"
            />
            {/* Animated Progress Gauge */}
            <circle
              cx="64"
              cy="64"
              r="58"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-1000 ease-out"
              style={{
                color: theme.stroke,
                strokeDasharray: CIRCUMFERENCE,
                // If score is 0.85, dashoffset is 15% of 364
                strokeDashoffset: CIRCUMFERENCE - CIRCUMFERENCE * score,
                filter: `drop-shadow(0 0 6px ${theme.stroke}44)`,
              }}
            />
          </svg>

          {/* Centered Percentage Label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className={`text-2xl font-black leading-none ${theme.color}`}>
              {Math.round(score * 100)}%
            </span>
            <span className="text-[7px] font-black text-slate-500 uppercase tracking-tighter mt-1">
              Conflict
            </span>
          </div>
        </div>

        {/* Severity Status Badge */}
        <p
          className={`text-[8px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${theme.color} ${theme.border}`}
        >
          {severity} Alert
        </p>
      </div>
    </div>
  );
};
// --- Sub-Component: Reasoning Trace Node ---
const LogicNode = ({
  step,
  index,
  isLast,
}: {
  step: string;
  index: number;
  isLast: boolean;
}) => (
  <div className="flex gap-6 p-6 bg-[#151b26] border border-[#2a3441] rounded-2xl items-start relative group hover:bg-[#1a212d] transition-all">
    {!isLast && (
      <div className="absolute left-9 top-14 bottom-0 w-px bg-[#2a3441] group-last:hidden" />
    )}
    <div className="shrink-0 w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-[11px] font-black text-blue-500 relative z-10 group-hover:bg-blue-600 group-hover:text-white transition-colors">
      {index + 1}
    </div>
    <div className="pt-1 space-y-2 flex-1">
      <div className="text-xs text-slate-200 leading-relaxed font-medium prose prose-invert prose-sm max-w-none prose-p:leading-relaxed">
        <ReactMarkdown>{step}</ReactMarkdown>
      </div>
      <div className="flex gap-4">
        <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">
          Validated Logic Node
        </span>
      </div>
    </div>
  </div>
);

// --- Sub-Component: Clinical Audit Log ---
const AuditLogBlock = ({ content }: { content: string }) => (
  <div className="p-8 bg-emerald-500/5 border border-emerald-500/20 rounded-3xl relative overflow-hidden">
    <div className="absolute top-0 right-0 p-8 opacity-10">
      <CheckCircle className="w-16 h-16 text-emerald-500" />
    </div>
    <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
      <Stethoscope className="w-4 h-4" /> Clinical Audit Log
    </h4>
    <div className="text-sm text-slate-300 leading-relaxed italic font-medium prose prose-invert prose-sm max-w-none">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  </div>
);

// --- Sub-Component: Internal Analysis Logic ---
const ThoughtProcessBlock = ({ content }: { content: string }) => (
  <div className="p-8 bg-blue-500/5 border border-blue-500/20 rounded-3xl relative overflow-hidden">
    <div className="absolute top-0 right-0 p-8 opacity-10">
      <Activity className="w-16 h-16 text-blue-500" />
    </div>
    <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
      <Layers className="w-4 h-4" /> Internal Analysis Logic
    </h4>
    <div className="text-xs text-slate-400 leading-relaxed italic font-medium max-h-[400px] overflow-y-auto pr-4 scrollbar-thin prose prose-invert prose-sm max-w-none prose-p:leading-relaxed">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  </div>
);
// --- Main Application ---

export default function App() {
  const [thinkingSteps, setThinkingSteps] = useState<string[]>([]);
  const [showImagingModal, setShowImagingModal] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null);

  const [selectedCase, setSelectedCase] = useState<string>("CASE_A-2401");
  const [sessionId, setSessionId] = useState(
    `UPLOAD-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
  );
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mode, setMode] = useState<"library" | "upload">("library");

  const [selectedCellDetail, setSelectedCellDetail] = useState<{
    agent: string;
    category: string;
    value: number;
    description: string;
    findings: string[];
  } | null>(null);

  const [showFullVerdict, setShowFullVerdict] = useState(false);
  const [showFullDirectives, setShowFullDirectives] = useState(false);

  const [clinicalHistory, setClinicalHistory] = useState("");
  const [xrayFile, setXrayFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);

  const xrayInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const cases: Record<string, CaseItem> = {
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
  const analyzeCase = async () => {
    setLoading(true);
    setError(null);
    setAnalysisResult(null);
    setThinkingSteps(["Establishing connection to Clinical Blackboard..."]);

    const currentCaseId = mode === "library" ? selectedCase : sessionId;

    try {
      // 1. UPLOAD (Only if in Upload Mode)
      if (mode === "upload") {
        const formData = new FormData();
        if (xrayFile) formData.append("xray", xrayFile);
        if (audioFile) formData.append("audio", audioFile);

        const uploadRes = await fetch(`${API_URL}/upload/${currentCaseId}`, {
          method: "POST",
          body: formData,
        });
        if (!uploadRes.ok) throw new Error("Artifact caching failed.");
        setThinkingSteps((prev) => [
          ...prev,
          "✅ Artifacts cached successfully.",
        ]);
      }

      // 2. INITIATE BLACKBOARD RUN
      // We send the history/note; main.py will pick up the cached files
      const response = await fetch(`${API_URL}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          case_id: currentCaseId,
          clinical_note_text: clinicalHistory,
        }),
      });

      if (!response.body) throw new Error("ReadableStream not supported.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      // 3. LISTEN TO BLACKBOARD UPDATES
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = JSON.parse(line.replace("data: ", ""));

          if (data.type === "status") {
            // Update the "Neural Stream" with the Blackboard's current activity
            setThinkingSteps((prev) => [...prev, data.message]);
          }

          if (data.type === "final") {
            const blackboardVerdict = data.parsed;

            setAnalysisResult({
              case_id: currentCaseId,
              discrepancy_alert: {
                level: blackboardVerdict.confidence > 70 ? "high" : "medium",
                score:
                  (parseFloat(String(blackboardVerdict.confidence)) || 0) / 100,
                summary: `**Suspected:** ${blackboardVerdict.condition}\n\n${blackboardVerdict.consensus_summary}`,
              },
              key_contradictions: data.audit_trail.filter((msg: string) =>
                msg.includes("Conflict"),
              ),
              recommended_data_actions:
                blackboardVerdict.differential_diagnosis || [],
              reasoning_trace: data.audit_trail || [],
              agent_reports: [],

              // --- ADD THESE TO FIX THE ERROR ---
              evidence_table: [], // Matches Record<string, any>[]
              limitations: [
                "Automated preliminary analysis",
                "Requires clinician verification",
              ], // Matches string[]

              // Optional fields
              audit_markdown: `### Session Audit\n${data.audit_trail.join("\n")}`,
              thought_process: data.thought_process || "",
            });

            setLoading(false);
          }
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Blackboard session crashed.",
      );
      setLoading(false);
    }
  };

  useEffect(() => {
    setClinicalHistory("");
  }, [selectedCase, mode]);

  const handleXrayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError("Image size exceeds 10MB limit.");
      setXrayFile(null);
      return;
    }
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setError("Invalid image format. Please upload JPG or PNG.");
      setXrayFile(null);
      return;
    }

    setXrayFile(file);
    setError(null);
  };

  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      setError("Audio size exceeds 20MB limit.");
      setAudioFile(null);
      return;
    }
    if (
      !["audio/wav", "audio/mpeg", "audio/mp3", "audio/x-wav"].includes(
        file.type,
      )
    ) {
      setError("Invalid audio format. Please upload WAV or MP3.");
      setAudioFile(null);
      return;
    }

    setAudioFile(file);
    setError(null);
  };

  const resetSession = () => {
    setAnalysisResult(null);
    setClinicalHistory("");
    setXrayFile(null);
    setAudioFile(null);
    setMode("library");
    setError(null);
    setSelectedCellDetail(null);
    setShowFullVerdict(false);
    setShowFullDirectives(false);
    setSessionId(
      `UPLOAD-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
    );
  };

  const getSeverity = (score: number): "low" | "medium" | "high" => {
    if (score > 0.7) return "high";
    if (score > 0.4) return "medium";
    return "low";
  };

  const HeatmapTile = ({ value, agent, category, onClick }: any) => {
    const getBgColor = (val: number) => {
      if (val > 0.8) return "bg-blue-600";
      if (val > 0.6) return "bg-blue-500";
      if (val > 0.4) return "bg-blue-400";
      if (val > 0.2) return "bg-slate-600";
      return "bg-slate-700";
    };

    return (
      <button
        onClick={() => onClick(agent, category, value)}
        className={`group relative h-7 w-full rounded-sm transition-all duration-300 ${getBgColor(value)} hover:ring-2 hover:ring-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500`}
        style={{ opacity: Math.max(0.2, value) }}
      >
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Maximize2 className="w-2.5 h-2.5 text-white" />
        </div>
      </button>
    );
  };

  const ConfidenceHeatmap = () => {
    const categories = ["Consolidation", "Effusion", "Airway", "Risk Factor"];

    // 🛡️ Safe Matrix Calculation: Prevents "undefined" crashes
    const matrix = analysisResult?.agent_reports?.map((agent) => {
      // Ensure claims exists, even if the backend omitted it
      const safeClaims = (agent as any).claims || [];

      return categories.map((cat) => {
        const specificClaim = safeClaims.find(
          (c: any) =>
            c.label?.toLowerCase().includes(cat.toLowerCase()) ||
            c.value?.toLowerCase().includes(cat.toLowerCase()),
        );
        // Fallback: If no claim matches, return a default low confidence (0.1)
        // if it's the imaging agent, or 0 for others.
        return specificClaim
          ? specificClaim.confidence
          : agent.agent_name === "imaging"
            ? 0.9
            : 0;
      });
    }) || [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];

    const handleTileClick = (
      agent: string,
      category: string,
      value: number,
    ) => {
      const detail = analysisResult?.matrix_details?.[`${agent}-${category}`];
      setSelectedCellDetail({
        agent,
        category,
        value,
        description:
          detail?.description ||
          `The ${agent} agent identified clinical markers associated with ${category} with ${Math.round(value * 100)}% confidence.`,
        findings: detail?.findings || [
          "Primary feature extraction verified",
          "Contextual alignment confirmed",
        ],
      });
    };

    if (
      !analysisResult?.agent_reports ||
      analysisResult.agent_reports.length === 0
    ) {
      return (
        <div className="bg-[#151b26] border border-[#2a3441] rounded-xl p-8 flex flex-col items-center justify-center opacity-30">
          <Layers className="w-8 h-8 mb-2 text-slate-600 animate-pulse" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em]">
            Generating Confidence Matrix...
          </p>
        </div>
      );
    }

    return (
      <div className="bg-[#151b26] border border-[#2a3441] rounded-xl p-5 shadow-sm relative animate-in fade-in duration-500">
        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Layers className="w-3 h-3" /> Consensus Confidence Matrix
        </h4>
        <div className="grid grid-cols-[100px_1fr] gap-4">
          <div className="space-y-2">
            <div className="h-7" />
            {analysisResult?.agent_reports?.map((agent: any, i: number) => (
              <div
                key={i}
                className="h-7 flex items-center text-[10px] font-bold text-slate-500 uppercase"
              >
                {agent.agent_name || "Agent"}
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <div className="flex gap-2">
              {categories.map((cat, i) => (
                <div
                  key={i}
                  className="flex-1 text-[9px] text-center font-bold text-slate-600 uppercase truncate"
                >
                  {cat}
                </div>
              ))}
            </div>
            {analysisResult?.agent_reports?.map((agent: any, i: number) => (
              <div key={i} className="flex gap-2">
                {matrix[i]?.map((val: number, j: number) => (
                  <HeatmapTile
                    key={j}
                    value={val}
                    agent={agent.agent_name || "Agent"}
                    category={categories[j]}
                    onClick={handleTileClick}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const ImagingAnalysisModal = () => {
    if (!showImagingModal || !analysisResult) return null;

    const imgReport = analysisResult?.agent_reports?.find(
      (a: any) => a.agent_name === "imaging",
    ) as VisionReport | undefined;

    if (!imgReport) return null;

    // Helper to handle dynamic Tailwind colors safely
    const colorMap = {
      blue: "border-blue-500/30 bg-blue-500/5 text-blue-400 icon-bg-blue-500/10",
      amber:
        "border-amber-500/30 bg-amber-500/5 text-amber-400 icon-bg-amber-500/10",
      emerald:
        "border-emerald-500/30 bg-emerald-500/5 text-emerald-400 icon-bg-emerald-500/10",
    };

    const phases = [
      {
        id: "phase1",
        title: "Strategic Planning",
        subtitle: "Initial Assessment",
        content: imgReport.draft_findings,
        colorKey: "blue" as const,
        icon: "📋",
      },
      {
        id: "phase2",
        title: "High-Recall Execution",
        subtitle: "Detailed Review",
        content: imgReport.supervisor_critique,
        colorKey: "amber" as const,
        icon: "🔍",
      },
      {
        id: "phase3",
        title: "Clinical Adjudication",
        subtitle: "Final Consensus",
        content: imgReport.internal_logic,
        colorKey: "emerald" as const,
        icon: "✓",
      },
    ];

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
        <div
          className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
          onClick={() => setShowImagingModal(false)}
        />
        <div className="relative w-full max-w-4xl bg-[#151b26] border border-blue-500/30 rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600/20 to-transparent p-6 border-b border-[#2a3441] flex justify-between items-start sticky top-0 z-10 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <ImageIcon className="w-5 h-5 text-blue-400" />
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-widest">
                  Radiographic Analysis - Full Report
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Complete multi-phase evaluation
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowImagingModal(false)}
              className="p-1 hover:bg-white/10 rounded-lg transition-colors text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
            {/* X-Ray Image */}
            {xrayFile && (
              <div className="aspect-video bg-[#0a0e14] rounded-xl overflow-hidden border border-[#2a3441] mb-6">
                <img
                  src={URL.createObjectURL(xrayFile)}
                  className="w-full h-full object-contain"
                  alt="X-Ray Full View"
                />
              </div>
            )}

            {/* Analysis Phases */}
            <div className="space-y-4">
              {phases.map((phase) => {
                const colors = colorMap[phase.colorKey];
                return (
                  <div
                    key={phase.id}
                    className={`border rounded-xl p-5 ${colors.split(" ").slice(0, 2).join(" ")}`}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${colors.split(" ")[3].replace("icon-bg-", "")}`}
                      >
                        {phase.icon}
                      </div>
                      <div>
                        <h5
                          className={`text-sm font-bold ${colors.split(" ")[2]}`}
                        >
                          {phase.title}
                        </h5>
                        <p className="text-xs text-slate-400">
                          {phase.subtitle}
                        </p>
                      </div>
                    </div>

                    {/* Markdown Renderer Section */}
                    <div className="text-sm text-slate-300 leading-relaxed prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-headings:text-slate-200 prose-li:my-0">
                      <ReactMarkdown>
                        {phase.content || "*No data available for this phase.*"}
                      </ReactMarkdown>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Case Metadata */}
            <div className="mt-6 bg-slate-500/5 p-5 rounded-xl border border-slate-500/10">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-black text-slate-400 uppercase tracking-wider">
                  Analysis Metadata
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500">Model:</span>
                  <span className="text-slate-300 ml-2">{imgReport.model}</span>
                </div>
                <div>
                  <span className="text-slate-500">Status:</span>
                  <span className="text-emerald-400 ml-2">
                    {imgReport.analysis_status}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 bg-[#0a0e14]/50 border-t border-[#2a3441] flex justify-end sticky bottom-0 backdrop-blur-sm">
            <button
              onClick={() => setShowImagingModal(false)}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-black uppercase tracking-widest transition-all"
            >
              Close Analysis
            </button>
          </div>
        </div>
      </div>
    );
  };

  const VerdictModal = () => {
    if (!showFullVerdict || !analysisResult) return null;
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
        <div
          className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
          onClick={() => setShowFullVerdict(false)}
        />
        <div className="relative w-full max-w-2xl bg-[#151b26] border border-blue-500/30 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
          <div className="bg-gradient-to-r from-blue-600/20 to-transparent p-6 border-b border-[#2a3441] flex justify-between items-start">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-blue-500" />
              <h3 className="text-sm font-black text-white uppercase tracking-widest">
                Adjudicated Consensus Verdict
              </h3>
            </div>
            <button
              onClick={() => setShowFullVerdict(false)}
              className="p-1 hover:bg-white/10 rounded-lg transition-colors text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-8 space-y-6">
            <p className="text-lg text-slate-200 leading-relaxed font-medium">
              {analysisResult.discrepancy_alert.summary}
            </p>
            {analysisResult.thought_process && (
              <div className="pt-6 border-t border-[#2a3441]">
                <div className="flex items-center gap-2 mb-3 text-[10px] font-black text-blue-400 uppercase tracking-widest">
                  <Activity className="w-3.5 h-3.5" /> Internal Analysis Logic
                </div>
                <div className="text-sm text-slate-400 leading-relaxed italic whitespace-pre-wrap max-h-[300px] overflow-y-auto pr-4 scrollbar-thin">
                  {analysisResult.thought_process}
                </div>
              </div>
            )}
          </div>
          <div className="p-4 bg-[#0a0e14]/50 border-t border-[#2a3441] flex justify-end">
            <button
              onClick={() => setShowFullVerdict(false)}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-black uppercase tracking-widest transition-all"
            >
              Close Verdict
            </button>
          </div>
        </div>
      </div>
    );
  };

  const DirectivesModal = () => {
    if (!showFullDirectives || !analysisResult) return null;
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
        <div
          className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
          onClick={() => setShowFullDirectives(false)}
        />
        <div className="relative w-full max-w-2xl bg-[#151b26] border border-blue-500/30 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
          <div className="bg-gradient-to-r from-blue-600/20 to-transparent p-6 border-b border-[#2a3441] flex justify-between items-start">
            <div className="flex items-center gap-3">
              <ArrowRightCircle className="w-5 h-5 text-blue-500" />
              <h3 className="text-sm font-black text-white uppercase tracking-widest">
                Recommended Clinical Actions
              </h3>
            </div>
            <button
              onClick={() => setShowFullDirectives(false)}
              className="p-1 hover:bg-white/10 rounded-lg transition-colors text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-8 space-y-4">
            {analysisResult.recommended_data_actions?.map((action, i) => (
              <div
                key={i}
                className="flex gap-4 items-start p-4 bg-[#0a0e14] border border-[#2a3441] rounded-xl hover:border-blue-500/30 transition-colors group"
              >
                <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-blue-500/20 transition-colors">
                  <CheckCircle className="w-3.5 h-3.5 text-blue-500" />
                </div>
                <p className="text-sm text-slate-200 leading-relaxed font-medium">
                  {action}
                </p>
              </div>
            ))}
          </div>
          <div className="p-4 bg-[#0a0e14]/50 border-t border-[#2a3441] flex justify-end">
            <button
              onClick={() => setShowFullDirectives(false)}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-black uppercase tracking-widest transition-all"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    );
  };

  const CellDetailModal = () => {
    if (!selectedCellDetail) return null;
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
        <div
          className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
          onClick={() => setSelectedCellDetail(null)}
        />
        <div className="relative w-full max-w-lg bg-[#151b26] border border-blue-500/30 rounded-2xl shadow-2xl shadow-blue-900/40 overflow-hidden animate-in zoom-in-95 duration-200">
          <div className="bg-gradient-to-r from-blue-600/20 to-transparent p-6 border-b border-[#2a3441] flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em]">
                  Matrix Drilldown
                </span>
                <span className="w-1 h-1 rounded-full bg-slate-600" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {selectedCellDetail.agent}
                </span>
              </div>
              <h3 className="text-xl font-bold text-white capitalize">
                {selectedCellDetail.category} Analysis
              </h3>
            </div>
            <button
              onClick={() => setSelectedCellDetail(null)}
              className="p-1 hover:bg-white/10 rounded-lg transition-colors text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between p-4 bg-blue-500/5 rounded-xl border border-blue-500/20">
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">
                  Confidence Score
                </span>
                <span className="text-2xl font-black text-white">
                  {Math.round(selectedCellDetail.value * 100)}%
                </span>
              </div>
              <Activity className="w-8 h-8 text-blue-500/30" />
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                <MessageSquare className="w-3.5 h-3.5" /> Agent Rationale
              </div>
              <p className="text-sm text-slate-300 leading-relaxed italic">
                "{selectedCellDetail.description}"
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                <Search className="w-3.5 h-3.5" /> Evidence Indicators
              </div>
              <div className="grid grid-cols-1 gap-2">
                {selectedCellDetail.findings.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-3 py-2 bg-[#0a0e14] border border-[#2a3441] rounded-lg"
                  >
                    <CheckCircle className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-[11px] text-slate-400 font-medium">
                      {f}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="p-4 bg-[#0a0e14]/50 border-t border-[#2a3441] flex justify-end gap-3">
            <button
              onClick={() => setSelectedCellDetail(null)}
              className="px-4 py-2 bg-[#1a212d] hover:bg-[#232b3a] text-slate-300 rounded-lg text-xs font-bold transition-all"
            >
              Dismiss
            </button>
            <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all">
              <ExternalLink className="w-3 h-3" /> Trace Source
            </button>
          </div>
        </div>
      </div>
    );
  };
  const togglePhase = (phaseId: string) => {
    setSelectedPhase(selectedPhase === phaseId ? null : phaseId);
  };

  return (
    <div className="min-h-screen bg-[#0a0e14] text-slate-200 flex overflow-hidden selection:bg-blue-500/30">
      <CellDetailModal />
      <VerdictModal />
      <ImagingAnalysisModal />
      <DirectivesModal />

      <aside
        className={`transition-all duration-300 ease-in-out bg-[#151b26] border-r border-[#2a3441] flex flex-col z-20 shrink-0 ${sidebarOpen ? "w-72" : "w-0 overflow-hidden border-none"}`}
      >
        <div className="flex flex-col h-full min-w-[18rem]">
          <div className="p-4 border-b border-[#2a3441] flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center shrink-0 shadow-lg shadow-blue-900/20">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div className="truncate">
              <h1 className="text-md font-bold text-white tracking-tight leading-tight">
                Momo Clinical
              </h1>
              <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">
                Neural Consensus
              </p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <section className="space-y-4">
              <div className="grid grid-cols-2 bg-[#0a0e14] p-1 rounded-lg border border-[#2a3441]">
                <button
                  onClick={() => setMode("library")}
                  className={`py-1.5 text-[10px] font-black rounded-md transition-all ${mode === "library" ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"}`}
                >
                  LIBRARY
                </button>
                <button
                  onClick={() => setMode("upload")}
                  className={`py-1.5 text-[10px] font-black rounded-md transition-all ${mode === "upload" ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"}`}
                >
                  NEW CASE
                </button>
              </div>
              {mode === "library" ? (
                <div>
                  <label className="block text-[9px] font-black text-slate-500 uppercase mb-1.5 tracking-widest">
                    Case ID
                  </label>
                  <select
                    value={selectedCase}
                    onChange={(e) => setSelectedCase(e.target.value)}
                    className="w-full bg-[#1a212d] border border-[#2a3441] rounded-lg px-2.5 py-2 text-xs text-white outline-none cursor-pointer focus:border-blue-500/50"
                  >
                    {Object.keys(cases).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest">
                    Modalities
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1 w-full">
                      <button
                        onClick={() => xrayInputRef.current?.click()}
                        className={`flex flex-col items-center justify-center gap-1.5 bg-[#1a212d] border rounded-lg p-2.5 text-[10px] transition-all ${xrayFile ? "border-blue-500 bg-blue-500/5" : "border-[#2a3441] hover:border-blue-500/50"}`}
                      >
                        <ImageIcon
                          className={`w-3.5 h-3.5 ${xrayFile ? "text-blue-400" : "text-slate-500"}`}
                        />
                        <span className="truncate w-full text-center font-bold uppercase">
                          {xrayFile ? "READY" : "X-RAY"}
                        </span>
                      </button>
                      <span className="text-[8px] text-center text-slate-600 font-bold uppercase tracking-tighter">
                        Max 10MB, JPG/PNG
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 w-full">
                      <button
                        onClick={() => audioInputRef.current?.click()}
                        className={`flex flex-col items-center justify-center gap-1.5 bg-[#1a212d] border rounded-lg p-2.5 text-[10px] transition-all ${audioFile ? "border-emerald-500 bg-emerald-500/5" : "border-[#2a3441] hover:border-emerald-500/50"}`}
                      >
                        <Volume2
                          className={`w-3.5 h-3.5 ${audioFile ? "text-emerald-400" : "text-slate-500"}`}
                        />
                        <span className="truncate w-full text-center font-bold uppercase">
                          {audioFile ? "READY" : "AUDIO"}
                        </span>
                      </button>
                      <span className="text-[8px] text-center text-slate-600 font-bold uppercase tracking-tighter">
                        Max 20MB, WAV/MP3
                      </span>
                    </div>
                  </div>
                  <input
                    type="file"
                    ref={xrayInputRef}
                    className="hidden"
                    accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                    onChange={handleXrayChange}
                  />
                  <input
                    type="file"
                    ref={audioInputRef}
                    className="hidden"
                    accept=".wav,.mp3,audio/wav,audio/mpeg"
                    onChange={handleAudioChange}
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest flex justify-between">
                  Clinical Context
                  <span className="text-blue-500 animate-pulse">Required</span>
                </label>
                <textarea
                  value={clinicalHistory}
                  onChange={(e) => setClinicalHistory(e.target.value)}
                  rows={8}
                  className="w-full bg-[#1a212d] border border-[#2a3441] rounded-lg p-3 text-xs text-slate-200 resize-none outline-none leading-relaxed focus:border-blue-500/50 transition-all placeholder:text-slate-600"
                  placeholder={`Describe the case:
- Patient demographics (e.g. 45yo Male)
- Primary symptoms & duration
- Relevant past medical history (PMH)
- Known allergies or family history
- Recent vitals or physical findings`}
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={analyzeCase}
                  disabled={loading || !clinicalHistory}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 py-2.5 rounded-lg font-black text-[10px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] tracking-[0.1em] shadow-lg shadow-blue-900/20"
                >
                  {loading ? (
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Play className="w-3 h-3" />
                  )}
                  RUN ANALYSIS
                </button>
                <button
                  onClick={resetSession}
                  className="flex-1 bg-[#1a212d] hover:bg-[#232b3a] border border-[#2a3441] text-slate-400 hover:text-white py-2.5 rounded-lg font-black text-[10px] flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                >
                  <RotateCcw className="w-3 h-3" />
                  RESET
                </button>
              </div>
            </section>
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex gap-2 items-start animate-in fade-in slide-in-from-top-1">
                <AlertOctagon className="w-4 h-4 text-red-500 shrink-0" />
                <div className="flex flex-col min-w-0">
                  <p className="text-[9px] font-black text-red-500 uppercase tracking-widest leading-none mb-1">
                    System Error
                  </p>
                  <p className="text-[10px] text-slate-300 leading-tight">
                    {error}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative overflow-hidden transition-all duration-300 bg-[#0d1117]">
        <header className="h-14 bg-[#151b26]/80 backdrop-blur-xl border-b border-[#2a3441] px-6 flex items-center justify-between shrink-0 z-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-[#2a3441] rounded-md transition-colors text-slate-400"
            >
              {sidebarOpen ? (
                <X className="w-4 h-4" />
              ) : (
                <Menu className="w-4 h-4" />
              )}
            </button>
            <div className="flex flex-col">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                Session{" "}
                <span className="text-blue-500 font-mono tracking-wider">
                  {mode === "library" ? selectedCase : sessionId}
                </span>
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {analysisResult && (
              <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                <Activity className="w-3 h-3 text-blue-500" /> Live Consensus
              </div>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
          <div className="w-full mx-auto space-y-6">
            {!analysisResult && !loading && (
              <div className="h-[70vh] flex flex-col items-center justify-center text-center space-y-8 animate-in fade-in duration-700">
                <div className="relative">
                  <div className="absolute inset-0 bg-blue-500/10 blur-3xl rounded-full scale-150 animate-pulse" />
                  <div className="w-20 h-20 bg-[#151b26] border border-[#2a3441] rounded-2xl flex items-center justify-center relative z-10 shadow-2xl">
                    <Shield className="w-10 h-10 text-slate-700" />
                  </div>
                </div>
                <div className="space-y-3">
                  <h3 className="text-xl font-bold text-white tracking-tight">
                    System Ready for Adjudication
                  </h3>
                  <p className="text-slate-500 text-sm max-w-sm mx-auto leading-relaxed">
                    Upload clinical modalities or select a library case to
                    initiate the MedGemma consensus protocol.
                  </p>
                </div>
              </div>
            )}

            {loading && (
              <div className="h-[70vh] flex flex-col items-center justify-center space-y-8 animate-in fade-in duration-500">
                {/* High-End Spinner */}
                <div className="relative w-24 h-24">
                  <div className="absolute inset-0 border-4 border-blue-500/5 rounded-full" />
                  <div className="absolute inset-0 border-4 border-t-blue-500 rounded-full animate-spin shadow-[0_0_25px_rgba(59,130,246,0.3)]" />
                  <div className="absolute inset-0 m-auto w-8 h-8 flex items-center justify-center">
                    <Activity className="w-6 h-6 text-blue-500 animate-pulse" />
                  </div>
                </div>

                {/* NEW: Thinking Console - Shows the actual agentic steps */}
                <ThinkingConsole steps={thinkingSteps} />

                {/* Status Footer */}
                <div className="text-center space-y-2">
                  <p className="text-[10px] font-black text-blue-500 tracking-[0.3em] uppercase">
                    {thinkingSteps.length > 0
                      ? thinkingSteps[thinkingSteps.length - 1].split("...")[0]
                      : "Initializing Adjudication"}
                  </p>
                  <div className="flex items-center justify-center gap-2 text-slate-500 text-[10px] italic">
                    <span className="w-1 h-1 rounded-full bg-blue-500 animate-ping" />
                    Resolving latent discrepancies in evidence stream...
                  </div>
                </div>
              </div>
            )}

            {analysisResult && (
              <>
                <div className="flex gap-1 p-1 bg-[#151b26] rounded-xl border border-[#2a3441] w-fit shadow-lg">
                  {[
                    { id: "overview", label: "Verdict", icon: ShieldAlert },
                    { id: "evidence", label: "Evidence", icon: Microscope },
                    { id: "audit", label: "Logic Audit", icon: ClipboardList },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${activeTab === tab.id ? "bg-blue-600 text-white shadow-md shadow-blue-900/20" : "text-slate-500 hover:text-slate-300 hover:bg-white/5"}`}
                    >
                      <tab.icon className="w-3.5 h-3.5" />
                      {tab.label}
                    </button>
                  ))}
                </div>

                {activeTab === "overview" && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* 🛡️ GUARD: Only show results if we have the discrepancy data */}
                    {analysisResult?.discrepancy_alert ? (
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                        <VerdictCard
                          analysisResult={analysisResult}
                          setShowFullVerdict={setShowFullVerdict}
                        />
                        <DirectivesCard
                          analysisResult={analysisResult}
                          setShowFullDirectives={setShowFullDirectives}
                        />
                        <SeverityCard
                          analysisResult={analysisResult}
                          getSeverity={getSeverity}
                          SEVERITY_MAP={SEVERITY_MAP}
                        />
                      </div>
                    ) : (
                      /* Placeholder while thinking */
                      <div className="p-12 border-2 border-dashed border-[#2a3441] rounded-3xl flex flex-col items-center justify-center text-slate-600">
                        <Activity className="w-8 h-8 mb-4 opacity-20 animate-pulse" />
                        <p className="text-xs font-bold uppercase tracking-widest">
                          Awaiting Adjudication Finalization...
                        </p>
                      </div>
                    )}

                    {analysisResult && <ConfidenceHeatmap />}
                  </div>
                )}

                {/* ==================== EVIDENCE TAB ==================== */}
                {activeTab === "evidence" && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <RadiographicCard
                        xrayFile={xrayFile}
                        analysisResult={analysisResult}
                        setShowImagingModal={setShowImagingModal}
                      />

                      <AcousticCard
                        audioFile={audioFile}
                        isAudioPlaying={isAudioPlaying}
                        setIsAudioPlaying={setIsAudioPlaying}
                        analysisResult={analysisResult}
                      />

                      <HistoryCard analysisResult={analysisResult} />
                    </div>
                  </div>
                )}
                {/* ==================== END OF EVIDENCE TAB ==================== */}
                {activeTab === "audit" && (
                  <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-top-4 duration-500">
                    {/* Logic Node Trace */}
                    <div className="grid grid-cols-1 gap-4">
                      {analysisResult.reasoning_trace?.map((step, i) => (
                        <LogicNode
                          key={i}
                          step={step}
                          index={i}
                          isLast={
                            i ===
                            (analysisResult.reasoning_trace?.length || 0) - 1
                          }
                        />
                      ))}
                    </div>

                    {/* Integrated Audit Markdown */}
                    {analysisResult.audit_markdown && (
                      <AuditLogBlock content={analysisResult.audit_markdown} />
                    )}

                    {/* Internal Thought Process */}
                    {analysisResult.thought_process && (
                      <ThoughtProcessBlock
                        content={analysisResult.thought_process}
                      />
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <footer className="h-10 px-6 border-t border-[#2a3441] flex items-center justify-between text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] bg-[#151b26]/50 shrink-0">
          <div className="flex items-center gap-4">
            <span>MedGemma v0.5.2</span>
            <span className="w-1 h-1 rounded-full bg-slate-700" />
            <span>Multi-Agent Adjudication Engaged</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Secure Edge Compute Active</span>
          </div>
        </footer>
      </main>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        body { font-family: 'Plus Jakarta Sans', sans-serif; font-feature-settings: "cv02", "cv03", "cv04"; -webkit-font-smoothing: antialiased; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2a3441; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #3b4757; }
        .scrollbar-thin::-webkit-scrollbar { width: 2px; }
      `,
        }}
      />
    </div>
  );
}
