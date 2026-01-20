"use client";
import React, { useState, useRef, useEffect } from "react";
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
} from "lucide-react";

/**
 * AEGIS CLINICAL CONSENSUS BOARD
 * Aligned with MedGemma main.py and contracts.py
 */

// --- Interfaces aligned with schemas/contracts.py ---

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

interface QualityFlag {
  type: string;
  severity: "low" | "medium" | "high";
  detail?: string;
}

interface AgentReport {
  agent_name: "imaging" | "acoustics" | "history";
  model: string;
  claims: Claim[];
  quality_flags: QualityFlag[];
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
  agent_reports: AgentReport[];
  audit_markdown?: string;
  thought_process?: string;
}

interface CaseItem {
  history: string;
  findings: string;
}

const API_URL = "http://127.0.0.1:8000";

export default function App() {
  // --- State Management ---
  const [selectedCase, setSelectedCase] = useState("CASE_A-2401");
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

  // Data Inputs
  const [clinicalHistory, setClinicalHistory] = useState(
    "72yo Male, history of COPD and HF. Presents with productive cough and fever. Decreased breath sounds at right base.",
  );
  const [xrayFile, setXrayFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);

  // Refs
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

  useEffect(() => {
    if (mode === "library" && cases[selectedCase]) {
      setClinicalHistory(cases[selectedCase].history);
    }
  }, [selectedCase, mode]);

  // --- API Logic ---

  const analyzeCase = async () => {
    setLoading(true);
    setError(null);

    const currentCaseId = mode === "library" ? selectedCase : sessionId;

    try {
      // 1. UPLOAD FILES FIRST (if in upload mode)
      if (mode === "upload") {
        const formData = new FormData();
        if (xrayFile) formData.append("xray", xrayFile);
        if (audioFile) formData.append("audio", audioFile);

        const uploadRes = await fetch(`${API_URL}/upload/${currentCaseId}`, {
          method: "POST",
          body: formData, // Do NOT set headers, browser will set multipart boundary
        });

        if (!uploadRes.ok)
          throw new Error("File upload to local cache failed.");
      }

      // 2. RUN ANALYSIS
      const payload = {
        case_id: currentCaseId,
        clinical_note_text: clinicalHistory,
        image_current_path:
          mode === "library"
            ? `data/cases/${selectedCase}/xray.jpg`
            : `artifacts/runs/${currentCaseId}/xray.jpg`,
        audio_current_path:
          mode === "library"
            ? `data/cases/${selectedCase}/audio.wav`
            : `artifacts/runs/${currentCaseId}/audio.wav`,
      };

      const response = await fetch(`${API_URL}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Analysis engine failed.");

      const data = await response.json();
      setAnalysisResult(data);
      setActiveTab("overview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Workflow failed.");
    } finally {
      setLoading(false);
    }
  };

  const resetSession = () => {
    setAnalysisResult(null);
    setClinicalHistory("");
    setXrayFile(null);
    setAudioFile(null);
    setMode("library");
    setError(null);
    setSessionId(
      `UPLOAD-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
    );
  };

  // --- Visual Components ---

  const HeatmapTile = ({ value }: { value: number }) => (
    <div
      className={`h-7 w-full rounded-sm transition-all duration-700 ${value > 0.7 ? "bg-blue-500" : value > 0.4 ? "bg-blue-400" : "bg-slate-700"}`}
      style={{ opacity: Math.max(0.1, value) }}
      title={`Confidence: ${Math.round(value * 100)}%`}
    />
  );

  const ConfidenceHeatmap = () => {
    const categories = ["Consolidation", "Effusion", "Airway", "Risk Factor"];
    // Mocking heatmap matrix for visual representation
    const mockMatrix = [
      [0.9, 0.8, 0.4, 0.2],
      [0.3, 0.2, 0.9, 0.9],
      [0.5, 0.6, 0.7, 0.9],
    ];

    return (
      <div className="bg-[#151b26] border border-[#2a3441] rounded-xl p-5 mt-6 shadow-sm">
        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Layers className="w-3 h-3" /> Consensus Confidence Matrix
        </h4>
        <div className="grid grid-cols-[100px_1fr] gap-4">
          <div className="space-y-2">
            <div className="h-7" />
            {analysisResult?.agent_reports.map((agent, i) => (
              <div
                key={i}
                className="h-7 flex items-center text-[10px] font-bold text-slate-500 uppercase"
              >
                {agent.agent_name}
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
            {analysisResult?.agent_reports.map((agent, i) => (
              <div key={i} className="flex gap-2">
                {mockMatrix[i].map((val, j) => (
                  <HeatmapTile key={j} value={val} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0a0e14] text-slate-200 flex overflow-hidden">
      {/* --- SIDEBAR --- */}
      <aside
        className={`transition-all duration-300 ease-in-out bg-[#151b26] border-r border-[#2a3441] flex flex-col z-20 shrink-0 ${sidebarOpen ? "w-72" : "w-0 overflow-hidden border-none"}`}
      >
        <div className="flex flex-col h-full min-w-[18rem]">
          {/* Header */}
          <div className="p-4 border-b border-[#2a3441] flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center shrink-0 shadow-lg shadow-blue-900/20">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div className="truncate">
              <h1 className="text-md font-bold text-white tracking-tight leading-tight">
                Aegis Clinical
              </h1>
              <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">
                Neural Consensus
              </p>
            </div>
          </div>

          {/* Sidebar Content - Grouped tightly */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <section className="space-y-4">
              <div className="grid grid-cols-2 bg-[#0a0e14] p-1 rounded-lg border border-[#2a3441]">
                <button
                  onClick={() => setMode("library")}
                  className={`py-1 text-[10px] font-black rounded-md transition-all ${mode === "library" ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"}`}
                >
                  LIBRARY
                </button>
                <button
                  onClick={() => setMode("upload")}
                  className={`py-1 text-[10px] font-black rounded-md transition-all ${mode === "upload" ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"}`}
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
                    className="w-full bg-[#1a212d] border border-[#2a3441] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none cursor-pointer focus:border-blue-500/50"
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
                    <button
                      onClick={() => xrayInputRef.current?.click()}
                      className="flex flex-col items-center justify-center gap-1.5 bg-[#1a212d] border border-[#2a3441] rounded-lg p-2.5 text-[10px] hover:border-blue-500 transition-colors"
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-blue-500" />
                      <span className="truncate w-full text-center text-slate-400 font-bold uppercase">
                        {xrayFile ? "FILE OK" : "X-RAY"}
                      </span>
                    </button>
                    <button
                      onClick={() => audioInputRef.current?.click()}
                      className="flex flex-col items-center justify-center gap-1.5 bg-[#1a212d] border border-[#2a3441] rounded-lg p-2.5 text-[10px] hover:border-blue-500 transition-colors"
                    >
                      <Volume2 className="w-3.5 h-3.5 text-green-500" />
                      <span className="truncate w-full text-center text-slate-400 font-bold uppercase">
                        {audioFile ? "FILE OK" : "AUDIO"}
                      </span>
                    </button>
                  </div>
                  <input
                    type="file"
                    ref={xrayInputRef}
                    className="hidden"
                    onChange={(e) => setXrayFile(e.target.files?.[0] || null)}
                  />
                  <input
                    type="file"
                    ref={audioInputRef}
                    className="hidden"
                    onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest">
                  Patient History
                </label>
                <textarea
                  value={clinicalHistory}
                  onChange={(e) => setClinicalHistory(e.target.value)}
                  rows={8}
                  className="w-full bg-[#1a212d] border border-[#2a3441] rounded-lg p-2.5 text-xs text-slate-200 resize-none outline-none leading-relaxed focus:border-blue-500/50 transition-colors"
                  placeholder="History agent notes..."
                />
              </div>

              {/* ACTION ROW: Grouped closely below history */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={analyzeCase}
                  disabled={loading}
                  className="flex-[2] bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 py-2.5 rounded-lg font-black text-[10px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] tracking-widest shadow-lg shadow-blue-900/20"
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
                  className="flex-1 bg-[#1a212d] hover:bg-[#232b3a] border border-[#2a3441] text-slate-400 hover:text-white py-2.5 rounded-lg font-black text-[10px] flex items-center justify-center gap-2 transition-all tracking-widest"
                >
                  <RotateCcw className="w-3 h-3" />
                  RESET
                </button>
              </div>
            </section>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex gap-2 items-start animate-in fade-in">
                <AlertOctagon className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-0.5 min-w-0">
                  <p className="text-[9px] font-black text-red-500 uppercase tracking-widest leading-none">
                    Diagnostic Fault
                  </p>
                  <p className="text-[10px] text-slate-300 leading-tight break-words">
                    {error}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 flex flex-col relative overflow-hidden transition-all duration-300">
        <header className="h-14 bg-[#151b26]/50 backdrop-blur-md border-b border-[#2a3441] px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-[#2a3441] rounded-md transition-colors text-slate-400 hover:text-white"
            >
              {sidebarOpen ? (
                <X className="w-4 h-4" />
              ) : (
                <Menu className="w-4 h-4" />
              )}
            </button>
            <div className="flex flex-col">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                Case{" "}
                <span className="text-blue-500">
                  {mode === "library" ? selectedCase : sessionId}
                </span>
              </h2>
            </div>
          </div>

          {analysisResult && (
            <div
              className={`px-3 py-1 rounded-full text-[9px] font-black border uppercase tracking-widest flex items-center gap-1.5 ${
                analysisResult.discrepancy_alert.level === "high"
                  ? "bg-red-500/10 text-red-500 border-red-500/30"
                  : "bg-amber-500/10 text-amber-500 border-amber-500/30"
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              {analysisResult.discrepancy_alert.level} Conflict
            </div>
          )}
        </header>

        <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
          <div className="max-w-5xl mx-auto space-y-6">
            {!analysisResult && !loading && (
              <div className="h-[70vh] flex flex-col items-center justify-center text-center space-y-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full" />
                  <Shield className="w-16 h-16 text-slate-800 relative z-10" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-white tracking-tight">
                    Consensus Standby
                  </h3>
                  <p className="text-slate-500 text-xs max-w-sm px-4">
                    Provide modality evidence and clinical context to initiate
                    neural adjudication chain.
                  </p>
                </div>
              </div>
            )}

            {loading && (
              <div className="h-[70vh] flex flex-col items-center justify-center space-y-6">
                <div className="relative w-20 h-20">
                  <div className="absolute inset-0 border-4 border-blue-500/10 rounded-full" />
                  <div className="absolute inset-0 border-4 border-t-blue-500 rounded-full animate-spin" />
                  <Activity className="absolute inset-0 m-auto w-6 h-6 text-blue-500" />
                </div>
                <div className="text-center animate-pulse">
                  <p className="text-xs font-black text-blue-500 tracking-[0.2em] uppercase">
                    Syncing latent representations...
                  </p>
                </div>
              </div>
            )}

            {analysisResult && (
              <>
                <div className="flex gap-1 p-1 bg-[#151b26] rounded-xl border border-[#2a3441] w-fit">
                  {[
                    { id: "overview", label: "Verdict", icon: TrendingUp },
                    { id: "evidence", label: "Evidence", icon: Microscope },
                    { id: "audit", label: "Audit", icon: ClipboardList },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${
                        activeTab === tab.id
                          ? "bg-[#2a3441] text-blue-400 shadow-sm"
                          : "text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      <tab.icon className="w-3 h-3" />
                      {tab.label}
                    </button>
                  ))}
                </div>

                {activeTab === "overview" && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2">
                    <div className="lg:col-span-3 bg-gradient-to-r from-blue-600/10 to-transparent border-l-4 border-blue-600 p-6 rounded-r-2xl shadow-xl shadow-blue-950/10">
                      <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2">
                        Multi-Agent Adjudication
                      </p>
                      <h2 className="text-2xl font-bold text-white mb-2">
                        {analysisResult.discrepancy_alert.summary}
                      </h2>
                      <p className="text-slate-300 font-medium text-xs leading-relaxed">
                        {analysisResult.recommended_data_actions &&
                          analysisResult.recommended_data_actions[0]}
                      </p>
                    </div>

                    <div className="bg-[#151b26] border border-[#2a3441] rounded-2xl p-6 flex flex-col items-center justify-center space-y-4">
                      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        Consensus Score
                      </h4>
                      <div className="relative flex items-center justify-center">
                        <svg className="w-28 h-28 transform -rotate-90">
                          <circle
                            cx="56"
                            cy="56"
                            r="52"
                            stroke="currentColor"
                            strokeWidth="6"
                            fill="transparent"
                            className="text-slate-800"
                          />
                          <circle
                            cx="56"
                            cy="56"
                            r="52"
                            stroke="currentColor"
                            strokeWidth="6"
                            fill="transparent"
                            className="text-blue-500 transition-all duration-1000"
                            strokeDasharray={326}
                            strokeDashoffset={
                              326 - 326 * analysisResult.discrepancy_alert.score
                            }
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-2xl font-black text-white">
                            {Math.round(
                              analysisResult.discrepancy_alert.score * 100,
                            )}
                            %
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#151b26] border border-[#2a3441] rounded-2xl p-6 flex flex-col space-y-4">
                      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        Agent Confidence
                      </h4>
                      <div className="space-y-4">
                        {analysisResult.agent_reports.map((agent, i) => (
                          <div key={i} className="flex flex-col space-y-1.5">
                            <div className="flex justify-between items-end">
                              <span className="text-[11px] font-bold text-slate-200 capitalize">
                                {agent.agent_name}
                              </span>
                              <span className="text-[10px] font-bold text-blue-400">
                                {agent.claims && agent.claims[0]
                                  ? Math.round(agent.claims[0].confidence * 100)
                                  : 0}
                                %
                              </span>
                            </div>
                            <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500"
                                style={{
                                  width: `${agent.claims && agent.claims[0] ? agent.claims[0].confidence * 100 : 0}%`,
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-[#151b26] border border-[#2a3441] rounded-2xl p-6 space-y-4">
                      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        Key Contradictions
                      </h4>
                      <div className="space-y-3">
                        {analysisResult.key_contradictions &&
                          analysisResult.key_contradictions.map((item, i) => (
                            <div
                              key={i}
                              className="flex gap-2.5 items-start text-[11px] bg-[#0a0e14] p-3 rounded-lg border border-red-500/20 text-slate-300"
                            >
                              <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                              {item}
                            </div>
                          ))}
                      </div>
                    </div>

                    <div className="lg:col-span-3">
                      <ConfidenceHeatmap />
                    </div>
                  </div>
                )}

                {activeTab === "evidence" && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-right-4">
                    <div className="bg-[#151b26] border border-[#2a3441] rounded-2xl p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <ImageIcon className="w-4 h-4 text-purple-400" />
                        <h4 className="text-xs font-bold text-white uppercase tracking-widest">
                          Imaging Findings
                        </h4>
                      </div>
                      <div className="aspect-[3/4] bg-[#0a0e14] rounded-xl flex items-center justify-center border border-[#2a3441] relative group">
                        {xrayFile ? (
                          <img
                            src={URL.createObjectURL(xrayFile)}
                            className="w-full h-full object-cover rounded-xl"
                            alt="Imaging"
                          />
                        ) : (
                          <div className="opacity-20 text-center">
                            <ImageIcon className="w-8 h-8 mx-auto mb-2" />
                            <p className="text-[10px] font-bold uppercase">
                              No Image
                            </p>
                          </div>
                        )}
                        <div className="absolute bottom-3 right-3 p-2 bg-black/60 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-zoom-in shadow-xl">
                          <Maximize2 className="w-3 h-3" />
                        </div>
                      </div>
                      {analysisResult.agent_reports
                        .find((a) => a.agent_name === "imaging")
                        ?.claims.map((c, i) => (
                          <p
                            key={i}
                            className="mt-4 text-[11px] text-slate-400 leading-relaxed italic"
                          >
                            {c.value}
                          </p>
                        ))}
                    </div>

                    <div className="bg-[#151b26] border border-[#2a3441] rounded-2xl p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <Stethoscope className="w-4 h-4 text-green-400" />
                        <h4 className="text-xs font-bold text-white uppercase tracking-widest">
                          Acoustic Logic
                        </h4>
                      </div>
                      <div className="bg-[#0a0e14] rounded-xl p-4 border border-[#2a3441] h-32 flex flex-col justify-center space-y-4">
                        {audioFile ? (
                          <>
                            <div className="h-6 flex items-center gap-1">
                              {[...Array(15)].map((_, i) => (
                                <div
                                  key={i}
                                  className="flex-1 bg-green-500/30 rounded-full"
                                  style={{ height: `${Math.random() * 100}%` }}
                                />
                              ))}
                            </div>
                            <audio
                              controls
                              className="w-full h-8 scale-[0.8]"
                              src={URL.createObjectURL(audioFile)}
                            />
                          </>
                        ) : (
                          <div className="opacity-20 text-center">
                            <Volume2 className="w-8 h-8 mx-auto mb-2" />
                            <p className="text-[10px] font-bold uppercase">
                              No Audio
                            </p>
                          </div>
                        )}
                      </div>
                      {analysisResult.agent_reports
                        .find((a) => a.agent_name === "acoustics")
                        ?.claims.map((c, i) => (
                          <p
                            key={i}
                            className="mt-4 text-[11px] text-slate-400 leading-relaxed italic"
                          >
                            {c.value}
                          </p>
                        ))}
                    </div>

                    <div className="bg-[#151b26] border border-[#2a3441] rounded-2xl p-5 flex flex-col">
                      <div className="flex items-center gap-2 mb-4">
                        <ClipboardList className="w-4 h-4 text-blue-400" />
                        <h4 className="text-xs font-bold text-white uppercase tracking-widest">
                          History Extracted
                        </h4>
                      </div>
                      <div className="flex-1 bg-[#0a0e14] rounded-xl p-4 border border-[#2a3441] text-[11px] text-slate-300 leading-relaxed overflow-y-auto max-h-[300px]">
                        {analysisResult.agent_reports
                          .find((a) => a.agent_name === "history")
                          ?.claims.map((c, i) => (
                            <div
                              key={i}
                              className="mb-2 pb-2 border-b border-white/5 last:border-0"
                            >
                              {c.value}
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "audit" && (
                  <div className="space-y-4 animate-in slide-in-from-top-4 max-w-3xl mx-auto">
                    {analysisResult.reasoning_trace &&
                      analysisResult.reasoning_trace.map((step, i) => (
                        <div
                          key={i}
                          className="flex gap-4 p-4 bg-[#151b26] border border-[#2a3441] rounded-2xl items-start hover:border-blue-500/30 transition-colors"
                        >
                          <div className="shrink-0 w-6 h-6 rounded-full bg-[#0a0e14] border border-[#2a3441] flex items-center justify-center text-[10px] font-black text-blue-400">
                            {i + 1}
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed pt-0.5">
                            {step}
                          </p>
                        </div>
                      ))}
                    {analysisResult.thought_process && (
                      <div className="mt-8 p-6 bg-blue-500/5 border border-blue-500/20 rounded-2xl">
                        <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-4">
                          Internal Adjudication Chain
                        </h4>
                        <p className="text-xs text-slate-400 whitespace-pre-wrap leading-relaxed italic">
                          {analysisResult.thought_process}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <footer className="h-8 px-6 border-t border-[#2a3441] flex items-center justify-between text-[9px] font-bold text-slate-600 uppercase tracking-[0.2em] bg-[#151b26]/30 shrink-0">
          <span>MedGemma v0.5.0</span>
          <span>Proprietary Clinical Consensus Protocol</span>
        </footer>
      </main>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        body { font-family: 'Plus Jakarta Sans', sans-serif; font-feature-settings: "cv02", "cv03", "cv04"; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2a3441; border-radius: 10px; }
      `,
        }}
      />
    </div>
  );
}
