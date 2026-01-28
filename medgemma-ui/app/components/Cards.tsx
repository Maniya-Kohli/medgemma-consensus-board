import React from "react";
import ReactMarkdown from "react-markdown";
import {
  Activity,
  ArrowRightCircle,
  CheckCircle,
  Maximize2,
  ImageIcon,
  Volume2,
  Brain,
  Play,
  Pause,
} from "lucide-react";
import { AnalysisResult, VisionReport } from "../types";
import { getSeverityTheme, API_URL } from "../constants";
import { getSeverity } from "../utils";

// ============================================================================
// RADIOGRAPHIC CARD (UNIFIED DESIGN)
// ============================================================================
interface RadiographicCardProps {
  xrayFile: File | null;
  analysisResult: AnalysisResult | null;
  setShowImagingModal: (show: boolean) => void;
}

export const RadiographicCard: React.FC<RadiographicCardProps> = ({
  xrayFile,
  analysisResult,
  setShowImagingModal,
}) => {
  const rawImgReport = analysisResult?.agent_reports?.find(
    (a: any) => a.agent_name === "imaging" || a.agent === "VisionAgent",
  ) as any;

  const imgReport: VisionReport | null = rawImgReport
    ? {
        agent_name: rawImgReport.agent_name,
        agent: rawImgReport.agent,
        model: rawImgReport.model,
        claims: rawImgReport.claims || [],
        quality_flags: rawImgReport.quality_flags || [],
        uncertainties: rawImgReport.uncertainties || [],
        requested_data: rawImgReport.requested_data || [],
        analysis_status:
          rawImgReport.analysis_status ||
          (rawImgReport.observation ? "complete" : "pending"),
        observation: rawImgReport.observation,
        execution_time: rawImgReport.execution_time,
        icon: rawImgReport.icon,
        success: rawImgReport.success,
        status: rawImgReport.status,
        error: rawImgReport.error,
        metadata: rawImgReport.metadata,
        internal_logic:
          rawImgReport.internal_logic || rawImgReport.observation || "",
        draft_findings: rawImgReport.draft_findings || "",
        supervisor_critique: rawImgReport.supervisor_critique || "",
        case_id: analysisResult?.case_id,
      }
    : null;

  const hasFindings = Boolean(
    imgReport?.claims &&
      Array.isArray(imgReport.claims) &&
      imgReport.claims.length > 0,
  );

  return (
    <div
      className="bg-[#151b26] border border-[#2a3441] hover:border-blue-500/30 rounded-2xl shadow-lg transition-all duration-300 cursor-pointer"
      onClick={() => setShowImagingModal(true)}
    >
      <div className="p-5 flex flex-col h-full">
        {/* Header */}
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
            {imgReport?.success ? "Verified" : "Pending"}
          </span>
        </div>

        {/* X-ray Image */}
        <div className="aspect-square bg-[#0a0e14] rounded-xl flex items-center justify-center border border-[#2a3441] relative overflow-hidden group mb-4">
          {xrayFile ? (
            <img
              src={URL.createObjectURL(xrayFile)}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              alt="X-Ray"
            />
          ) : analysisResult?.case_id ? (
            <img
              src={`${API_URL}/xray/${analysisResult.case_id}`}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              alt="X-Ray"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = "none";
                target.parentElement!.innerHTML = `
                  <div class="text-center flex flex-col items-center opacity-30">
                    <svg class="w-16 h-16 mb-3 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p class="text-xs font-medium text-slate-500">No imaging available</p>
                  </div>
                `;
              }}
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

        {/* Findings */}
        {!imgReport || !imgReport.success ? (
          <div className="flex-1 flex flex-col items-center justify-center py-8 space-y-3">
            <div className="w-5 h-5 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest animate-pulse">
              Awaiting Neural Feedback...
            </p>
          </div>
        ) : (
          <div className="flex-1 space-y-3 overflow-y-auto max-h-[300px] scrollbar-thin">
            {hasFindings && imgReport.claims ? (
              imgReport.claims.slice(0, 2).map((claim: any, i: number) => (
                <div
                  key={i}
                  className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-blue-400">
                      Finding {i + 1}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-blue-500/20 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all duration-1000"
                          style={{ width: `${claim.confidence * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-blue-400">
                        {Math.round(claim.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">
                    {claim.label}
                  </p>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-10 opacity-20">
                <Activity className="w-6 h-6 mb-2 text-blue-500 animate-pulse" />
                <p className="text-[10px] font-black uppercase tracking-widest text-center">
                  Processing Evidence...
                </p>
              </div>
            )}
          </div>
        )}

        {/* View Full Analysis Button */}
        {imgReport?.success && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowImagingModal(true);
            }}
            className="w-full mt-4 py-2 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 rounded-lg text-[10px] font-black text-blue-400 uppercase tracking-widest transition-all flex items-center justify-center gap-2 group"
          >
            <Maximize2 className="w-3 h-3 group-hover:scale-110 transition-transform" />
            View Full Analysis
          </button>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// ACOUSTIC CARD (UNIFIED DESIGN)
// ============================================================================
interface AcousticCardProps {
  audioFile: File | null;
  isAudioPlaying: boolean;
  setIsAudioPlaying: (playing: boolean) => void;
  analysisResult: AnalysisResult | null;
  setShowAcousticModal: (show: boolean) => void;
}

export const AcousticCard: React.FC<AcousticCardProps> = ({
  audioFile,
  isAudioPlaying,
  setIsAudioPlaying,
  analysisResult,
  setShowAcousticModal,
}) => {
  const acousticReport = analysisResult?.agent_reports?.find(
    (a: any) => a.agent_name === "acoustics" || a.agent === "AudioAgent",
  );

  const hasFindings = Boolean(
    acousticReport?.claims &&
      Array.isArray(acousticReport.claims) &&
      acousticReport.claims.length > 0,
  );

  return (
    <div
      className="bg-[#151b26] border border-[#2a3441] hover:border-emerald-500/30 rounded-2xl shadow-lg transition-all duration-300 cursor-pointer"
      onClick={() => setShowAcousticModal(true)}
    >
      <div className="p-5 flex flex-col h-full">
        {/* Header */}
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
          <span
            className={`text-xs font-bold px-3 py-1 rounded-full border ${acousticReport?.success ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-slate-500/5 text-slate-500 border-slate-500/10"}`}
          >
            {acousticReport?.success ? "Verified" : "Pending"}
          </span>
        </div>

        {/* Audio Visualization */}
        <div className="bg-[#0a0e14] rounded-xl p-4 border border-[#2a3441] mb-4 aspect-square flex flex-col justify-center">
          {audioFile ? (
            <div className="space-y-4">
              <div className="h-32 flex items-end gap-1">
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
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsAudioPlaying(!isAudioPlaying);
                  }}
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
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 opacity-30">
              <Volume2 className="w-16 h-16 mb-3 text-slate-600 mx-auto" />
              <p className="text-xs font-medium text-slate-500">
                No audio available
              </p>
            </div>
          )}
        </div>

        {/* Findings */}
        <div className="flex-1 space-y-3 overflow-y-auto max-h-[300px] scrollbar-thin">
          {!acousticReport || !hasFindings ? (
            <div className="flex flex-col items-center justify-center py-10 opacity-20">
              <Activity className="w-6 h-6 mb-2 text-emerald-500 animate-pulse" />
              <p className="text-[10px] font-black uppercase tracking-widest text-center">
                Processing Evidence...
              </p>
            </div>
          ) : (
            acousticReport.claims?.slice(0, 2).map((claim: any, i: number) => (
              <div
                key={i}
                className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3"
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
                <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">
                  {claim.label}
                </p>
              </div>
            ))
          )}
        </div>

        {/* View Full Analysis Button */}
        {acousticReport?.success && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowAcousticModal(true);
            }}
            className="w-full mt-4 py-2 bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/20 rounded-lg text-[10px] font-black text-emerald-400 uppercase tracking-widest transition-all flex items-center justify-center gap-2 group"
          >
            <Maximize2 className="w-3 h-3 group-hover:scale-110 transition-transform" />
            View Full Analysis
          </button>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// LEAD CLINICIAN CARD (UNIFIED DESIGN)
// ============================================================================
interface LeadClinicianCardProps {
  analysisResult: AnalysisResult | null;
  setShowClinicianModal: (show: boolean) => void;
}

export const LeadClinicianCard: React.FC<LeadClinicianCardProps> = ({
  analysisResult,
  setShowClinicianModal,
}) => {
  const clinicianReport = analysisResult?.agent_reports?.find(
    (a: any) => a.agent_name === "clinician" || a.agent === "LeadClinician",
  );

  const hasFindings = Boolean(
    clinicianReport?.claims &&
      Array.isArray(clinicianReport.claims) &&
      clinicianReport.claims.length > 0,
  );

  return (
    <div
      className="bg-[#151b26] border border-[#2a3441] hover:border-purple-500/30 rounded-2xl shadow-lg transition-all duration-300 cursor-pointer"
      onClick={() => setShowClinicianModal(true)}
    >
      <div className="p-5 flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
              <Brain className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Lead Clinician</h4>
              <p className="text-xs text-slate-400">Clinical synthesis</p>
            </div>
          </div>
          <span
            className={`text-xs font-bold px-3 py-1 rounded-full border ${clinicianReport?.success ? "bg-purple-500/10 text-purple-400 border-purple-500/20" : "bg-slate-500/5 text-slate-500 border-slate-500/10"}`}
          >
            {clinicianReport?.success ? "Complete" : "Pending"}
          </span>
        </div>

        {/* Visual Placeholder */}
        <div className="bg-[#0a0e14] rounded-xl border border-[#2a3441] mb-4 aspect-square flex items-center justify-center">
          <div className="text-center opacity-30">
            <Brain className="w-16 h-16 mb-3 text-slate-600 mx-auto" />
            <p className="text-xs font-medium text-slate-500">
              Clinical Integration
            </p>
          </div>
        </div>

        {/* Findings */}
        <div className="flex-1 space-y-3 overflow-y-auto max-h-[300px] scrollbar-thin">
          {!clinicianReport || !clinicianReport.observation ? (
            <div className="flex flex-col items-center justify-center py-10 opacity-20">
              <Activity className="w-6 h-6 mb-2 text-purple-500 animate-pulse" />
              <p className="text-[10px] font-black uppercase tracking-widest text-center">
                Synthesizing Evidence...
              </p>
            </div>
          ) : (
            <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-purple-400">
                  Clinical Summary
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed line-clamp-6">
                {clinicianReport.observation}
              </p>
            </div>
          )}
        </div>

        {/* View Full Analysis Button */}
        {clinicianReport?.success && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowClinicianModal(true);
            }}
            className="w-full mt-4 py-2 bg-purple-600/10 hover:bg-purple-600/20 border border-purple-500/20 rounded-lg text-[10px] font-black text-purple-400 uppercase tracking-widest transition-all flex items-center justify-center gap-2 group"
          >
            <Maximize2 className="w-3 h-3 group-hover:scale-110 transition-transform" />
            View Full Analysis
          </button>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// HISTORY CARD (KEPT FOR BACKWARDS COMPATIBILITY)
// ============================================================================
interface HistoryCardProps {
  analysisResult: AnalysisResult | null;
}

export const HistoryCard: React.FC<HistoryCardProps> = ({ analysisResult }) => {
  return null; // Removed as requested
};

// ============================================================================
// VERDICT CARD
// ============================================================================
interface VerdictCardProps {
  analysisResult: AnalysisResult;
  setShowFullVerdict: (show: boolean) => void;
}

export const VerdictCard: React.FC<VerdictCardProps> = ({
  analysisResult,
  setShowFullVerdict,
}) => {
  return (
    <div className="lg:col-span-5 flex flex-col gap-4 min-h-full">
      <div
        onClick={() => setShowFullVerdict(true)}
        className="bg-gradient-to-br from-[#1a212d] to-[#151b26] border border-[#2a3441] p-5 rounded-2xl shadow-xl relative overflow-hidden group cursor-pointer hover:border-blue-500/50 transition-all active:scale-[0.995] flex-1"
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
            <Maximize2 className="w-3.5 h-3.5 text-slate-600 group-hover:text-blue-400 transition-colors" />
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
                {agent.icon} {agent.agent_name || agent.agent || "Specialist"}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// DIRECTIVES CARD
// ============================================================================
interface DirectivesCardProps {
  analysisResult: AnalysisResult;
  setShowFullDirectives: (show: boolean) => void;
}

export const DirectivesCard: React.FC<DirectivesCardProps> = ({
  analysisResult,
  setShowFullDirectives,
}) => {
  const actions = analysisResult?.recommended_data_actions ?? [];

  return (
    <div className="lg:col-span-4 flex flex-col min-h-full">
      <div
        onClick={() => setShowFullDirectives(true)}
        className="bg-gradient-to-br from-[#1a212d] to-[#151b26] border border-[#2a3441] p-5 rounded-2xl shadow-xl relative overflow-hidden group cursor-pointer hover:border-emerald-500/50 transition-all active:scale-[0.995] flex-1"
      >
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
          <ArrowRightCircle className="w-24 h-24 text-white" />
        </div>
        <div className="relative z-10 h-full flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.2em]">
                Clinical Directives
              </p>
            </div>
            <Maximize2 className="w-3.5 h-3.5 text-slate-600 group-hover:text-emerald-400 transition-colors" />
          </div>

          <div className="flex-1 space-y-3 mb-3 overflow-y-auto pr-1 scrollbar-thin max-h-[220px]">
            {actions.length > 0 ? (
              actions.map((action: string, i: number) => (
                <div
                  key={i}
                  className="flex gap-2 items-start animate-in fade-in slide-in-from-left-2 duration-300"
                >
                  <div className="w-3.5 h-3.5 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle className="w-2.5 h-2.5 text-emerald-500" />
                  </div>
                  <h2 className="text-sm font-bold text-white leading-relaxed">
                    {action}
                  </h2>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-32 opacity-20">
                <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mb-2" />
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
            <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest group-hover:underline">
              Inspect Protocols →
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// SEVERITY CARD
// ============================================================================
interface SeverityCardProps {
  analysisResult: AnalysisResult;
}

export const SeverityCard: React.FC<SeverityCardProps> = ({
  analysisResult,
}) => {
  const rawScore = analysisResult?.discrepancy_alert?.score;
  const score =
    typeof rawScore === "number" && !isNaN(rawScore)
      ? Math.max(0, Math.min(1, rawScore))
      : 0;

  const severity = getSeverity(score);
  const theme = getSeverityTheme(severity);
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
            <circle
              cx="64"
              cy="64"
              r="58"
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              className="text-slate-800"
            />
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
                strokeDashoffset: CIRCUMFERENCE - CIRCUMFERENCE * score,
                filter: `drop-shadow(0 0 6px ${theme.stroke}44)`,
              }}
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className={`text-2xl font-black leading-none ${theme.color}`}>
              {Math.round(score * 100)}%
            </span>
            <span className="text-[7px] font-black text-slate-500 uppercase tracking-tighter mt-1">
              Conflict
            </span>
          </div>
        </div>

        <p
          className={`text-[8px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${theme.color} ${theme.border}`}
        >
          {severity} Alert
        </p>
      </div>
    </div>
  );
};
