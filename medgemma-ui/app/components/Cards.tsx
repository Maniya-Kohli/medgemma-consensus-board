import React from "react";
import ReactMarkdown from "react-markdown";
import {
  Activity,
  Maximize2,
  ImageIcon,
  Volume2,
  Brain,
  Play,
  Pause,
} from "lucide-react";
import { AnalysisResult, VisionReport } from "../types";
import { API_URL } from "../constants";

// ============================================================================
// RADIOGRAPHIC CARD (MINIMAL DESIGN)
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
      className="bg-[#151b26] border border-[#2a3441] hover:border-blue-500/30 rounded-lg transition-all duration-300 cursor-pointer"
      onClick={() => setShowImagingModal(true)}
    >
      <div className="p-4 flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
              <ImageIcon className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h4 className="text-sm text-white">Radiographic Analysis</h4>
              <p className="text-[10px] text-slate-500">
                Multi-phase evaluation
              </p>
            </div>
          </div>
          <span className="text-[9px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase tracking-wider">
            {imgReport?.success ? "Verified" : "Pending"}
          </span>
        </div>

        {/* X-ray Image */}
        <div className="aspect-square bg-[#0a0e14] rounded-lg flex items-center justify-center border border-[#2a3441] relative overflow-hidden group mb-3">
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
                    <svg class="w-12 h-12 mb-2 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p class="text-[10px] text-slate-500">No imaging available</p>
                  </div>
                `;
              }}
            />
          ) : (
            <div className="text-center flex flex-col items-center opacity-30">
              <ImageIcon className="w-12 h-12 mb-2 text-slate-600" />
              <p className="text-[10px] text-slate-500">No imaging uploaded</p>
            </div>
          )}
        </div>

        {/* Findings */}
        {!imgReport || !imgReport.success ? (
          <div className="flex-1 flex flex-col items-center justify-center py-6 space-y-2">
            <div className="w-4 h-4 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
            <p className="text-[9px] text-slate-500 uppercase tracking-wider">
              Awaiting Neural Feedback...
            </p>
          </div>
        ) : (
          <div className="flex-1 space-y-2 overflow-y-auto max-h-[240px] scrollbar-thin">
            {hasFindings && imgReport.claims ? (
              imgReport.claims.slice(0, 2).map((claim: any, i: number) => (
                <div
                  key={i}
                  className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-2.5"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] text-blue-400 uppercase tracking-wider">
                      Finding {i + 1}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <div className="h-1 w-12 bg-blue-500/20 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all duration-1000"
                          style={{ width: `${claim.confidence * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-blue-400">
                        {Math.round(claim.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">
                    {claim.label}
                  </p>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-8 opacity-20">
                <Activity className="w-5 h-5 mb-2 text-blue-500 animate-pulse" />
                <p className="text-[9px] uppercase tracking-wider text-center">
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
            className="w-full mt-3 py-1.5 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 rounded-lg text-[9px] text-blue-400 uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 group"
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
// ACOUSTIC CARD (MINIMAL DESIGN)
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
      className="bg-[#151b26] border border-[#2a3441] hover:border-emerald-500/30 rounded-lg transition-all duration-300 cursor-pointer"
      onClick={() => setShowAcousticModal(true)}
    >
      <div className="p-4 flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <Volume2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h4 className="text-sm text-white">Acoustic Analysis</h4>
              <p className="text-[10px] text-slate-500">
                Auscultation findings
              </p>
            </div>
          </div>
          <span
            className={`text-[9px] px-2 py-0.5 rounded border uppercase tracking-wider ${acousticReport?.success ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-slate-500/5 text-slate-500 border-slate-500/10"}`}
          >
            {acousticReport?.success ? "Verified" : "Pending"}
          </span>
        </div>

        {/* Audio Visualization */}
        <div className="bg-[#0a0e14] rounded-lg p-3 border border-[#2a3441] mb-3 aspect-square flex flex-col justify-center">
          {audioFile ? (
            <div className="space-y-3">
              <div className="h-24 flex items-end gap-0.5">
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
              <div className="flex items-center gap-2">
                <button
                  className="w-8 h-8 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 flex items-center justify-center border border-emerald-500/30"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsAudioPlaying(!isAudioPlaying);
                  }}
                >
                  {isAudioPlaying ? (
                    <Pause className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Play className="w-3.5 h-3.5 text-emerald-400 ml-0.5" />
                  )}
                </button>
                <div className="flex-1">
                  <audio
                    controls
                    className="w-full h-6 opacity-60"
                    src={audioFile ? URL.createObjectURL(audioFile) : ""}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 opacity-30">
              <Volume2 className="w-12 h-12 mb-2 text-slate-600 mx-auto" />
              <p className="text-[10px] text-slate-500">No audio available</p>
            </div>
          )}
        </div>

        {/* Findings */}
        <div className="flex-1 space-y-2 overflow-y-auto max-h-[240px] scrollbar-thin">
          {!acousticReport || !hasFindings ? (
            <div className="flex flex-col items-center justify-center py-8 opacity-20">
              <Activity className="w-5 h-5 mb-2 text-emerald-500 animate-pulse" />
              <p className="text-[9px] uppercase tracking-wider text-center">
                Processing Evidence...
              </p>
            </div>
          ) : (
            acousticReport.claims?.slice(0, 2).map((claim: any, i: number) => (
              <div
                key={i}
                className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-2.5"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] text-emerald-400 uppercase tracking-wider">
                    Finding {i + 1}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <div className="h-1 w-12 bg-emerald-500/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-1000"
                        style={{ width: `${claim.confidence * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-emerald-400">
                      {Math.round(claim.confidence * 100)}%
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">
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
            className="w-full mt-3 py-1.5 bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/20 rounded-lg text-[9px] text-emerald-400 uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 group"
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
// LEAD CLINICIAN CARD (MINIMAL DESIGN)
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

  return (
    <div
      className="bg-[#151b26] border border-[#2a3441] hover:border-purple-500/30 rounded-lg transition-all duration-300 cursor-pointer"
      onClick={() => setShowClinicianModal(true)}
    >
      <div className="p-4 flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
              <Brain className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h4 className="text-sm text-white">Lead Clinician</h4>
              <p className="text-[10px] text-slate-500">Clinical synthesis</p>
            </div>
          </div>
          <span
            className={`text-[9px] px-2 py-0.5 rounded border uppercase tracking-wider ${clinicianReport?.success ? "bg-purple-500/10 text-purple-400 border-purple-500/20" : "bg-slate-500/5 text-slate-500 border-slate-500/10"}`}
          >
            {clinicianReport?.success ? "Complete" : "Pending"}
          </span>
        </div>

        {/* Visual Placeholder */}
        <div className="bg-[#0a0e14] rounded-lg border border-[#2a3441] mb-3 aspect-square flex items-center justify-center">
          <div className="text-center opacity-30">
            <Brain className="w-12 h-12 mb-2 text-slate-600 mx-auto" />
            <p className="text-[10px] text-slate-500">Clinical Integration</p>
          </div>
        </div>

        {/* Findings */}
        <div className="flex-1 space-y-2 overflow-y-auto max-h-[240px] scrollbar-thin">
          {!clinicianReport || !clinicianReport.observation ? (
            <div className="flex flex-col items-center justify-center py-8 opacity-20">
              <Activity className="w-5 h-5 mb-2 text-purple-500 animate-pulse" />
              <p className="text-[9px] uppercase tracking-wider text-center">
                Synthesizing Evidence...
              </p>
            </div>
          ) : (
            <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] text-purple-400 uppercase tracking-wider">
                  Clinical Summary
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed line-clamp-5">
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
            className="w-full mt-3 py-1.5 bg-purple-600/10 hover:bg-purple-600/20 border border-purple-500/20 rounded-lg text-[9px] text-purple-400 uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 group"
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
