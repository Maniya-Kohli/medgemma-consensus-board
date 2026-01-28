"use client";
import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import {
  Activity,
  FileText,
  Menu,
  X,
  Play,
  RotateCcw,
  Shield,
  ShieldAlert,
  Microscope,
  ClipboardList,
  AlertOctagon,
  Layers,
  Volume2, // ✅ ADD THIS
  Brain,
} from "lucide-react";

// Import all types
import type { AnalysisResult, CaseItem } from "./types";

// Import constants
import { API_URL, CASES } from "./constants";

// Import utilities
import { generateSessionId, parseStreamFinalEvent } from "./utils";

// Import components
import {
  ThinkingConsole,
  AgentMetricsPanel,
  RadiographicCard,
  AcousticCard,
  LeadClinicianCard,
  HistoryCard,
  VerdictCard,
  DirectivesCard,
  SeverityCard,
} from "./components";

/**
 * Custom Hook: Stream Analysis Handler
 * Manages WebSocket-style streaming of backend events
 */
const useAnalysisStream = () => {
  const [thinkingSteps, setThinkingSteps] = useState<string[]>([]);
  const [streamingThought, setStreamingThought] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const streamAnalysis = async (
    currentCaseId: string,
    clinicalHistory: string,
    onFinal: (result: AnalysisResult) => void,
    onError: (error: string) => void,
  ) => {
    setIsStreaming(true);
    setStreamingThought("");
    setThinkingSteps(["🎯 Establishing connection to Clinical Blackboard..."]);

    try {
      const response = await fetch(`${API_URL}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          case_id: currentCaseId,
          clinical_note_text: clinicalHistory,
        }),
      });

      if (!response.body) throw new Error("Stream not supported.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;

          try {
            const data = JSON.parse(line.replace("data: ", ""));
            const dataType = data.type || "";

            switch (dataType) {
              case "status": {
                const msg = data.message || "";
                const metadata = data.metadata || {};
                let enrichedMsg = msg;

                if (metadata.findings_count !== undefined) {
                  enrichedMsg = `${msg} [${metadata.findings_count} findings]`;
                }
                if (metadata.focus_areas && metadata.focus_areas.length > 0) {
                  enrichedMsg += ` 🎯 Focus: ${metadata.focus_areas.join(", ")}`;
                }
                setThinkingSteps((prev) => [...prev, enrichedMsg]);
                break;
              }

              case "agent_start": {
                const agentName = data.agent || "Agent";
                const agentIcons: Record<string, string> = {
                  AudioAgent: "🎤",
                  VisionAgent: "👁️",
                  LeadClinician: "🧠",
                };
                const icon = agentIcons[agentName] || "🤖";
                setThinkingSteps((prev) => [
                  ...prev,
                  `${icon} ${agentName} analysis initiated...`,
                ]);
                break;
              }

              case "agent_complete": {
                const agentName = data.agent || "Agent";
                setThinkingSteps((prev) => [
                  ...prev,
                  `✅ ${agentName} completed successfully`,
                ]);
                break;
              }

              case "thought": {
                const token = data.delta || "";
                setStreamingThought((prev) => prev + token);
                break;
              }

              case "final": {
                // ✅ USE THE FIXED PARSING FUNCTION
                const finalResult = parseStreamFinalEvent(data, currentCaseId);
                onFinal(finalResult);
                setStreamingThought("");
                setThinkingSteps((prev) => [
                  ...prev,
                  `🏁 Analysis complete: ${finalResult.agent_reports.length} agents contributed`,
                ]);
                setIsStreaming(false);
                break;
              }

              case "error": {
                const errorMsg = data.message || "Unknown error occurred";
                setThinkingSteps((prev) => [...prev, `❌ Error: ${errorMsg}`]);
                onError(errorMsg);
                setIsStreaming(false);
                break;
              }
            }
          } catch (parseError) {
            console.warn("Failed to parse stream data:", parseError);
            continue;
          }
        }
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Analysis session crashed";
      onError(errorMessage);
      setThinkingSteps((prev) => [...prev, `💥 Fatal Error: ${errorMessage}`]);
      setIsStreaming(false);
    }
  };

  return { thinkingSteps, streamingThought, isStreaming, streamAnalysis };
};

export default function App() {
  // State Management
  const [selectedCase, setSelectedCase] = useState<string>("CASE_A-2401");
  const [sessionId, setSessionId] = useState(generateSessionId());
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mode, setMode] = useState<"library" | "upload">("library");

  // Modal states (add these two new ones)
  const [showImagingModal, setShowImagingModal] = useState(false);
  const [showAcousticModal, setShowAcousticModal] = useState(false);
  const [showClinicianModal, setShowClinicianModal] = useState(false);
  const [showFullVerdict, setShowFullVerdict] = useState(false);
  const [showFullDirectives, setShowFullDirectives] = useState(false);

  // Audio state
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  // Clinical data
  const [clinicalHistory, setClinicalHistory] = useState("");
  const [xrayFile, setXrayFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);

  // Refs
  const xrayInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // Custom hook
  const { thinkingSteps, streamingThought, isStreaming, streamAnalysis } =
    useAnalysisStream();

  // Effect: Reset clinical history when case/mode changes
  useEffect(() => {
    setClinicalHistory("");
  }, [selectedCase, mode]);

  // Event Handlers
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
    setShowFullVerdict(false);
    setShowFullDirectives(false);
    setShowImagingModal(false);
    setSessionId(generateSessionId());
  };

  /**
   * Main Analysis Function
   * Handles file uploads and initiates streaming analysis
   */
  const analyzeCase = async () => {
    setLoading(true);
    setError(null);
    setAnalysisResult(null);

    const currentCaseId = mode === "library" ? selectedCase : sessionId;

    try {
      // 1. UPLOAD PHASE (if in upload mode)
      if (mode === "upload") {
        const formData = new FormData();
        if (xrayFile) formData.append("xray", xrayFile);
        if (audioFile) formData.append("audio", audioFile);

        const uploadRes = await fetch(`${API_URL}/upload/${currentCaseId}`, {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) throw new Error("Artifact caching failed.");
      }

      // 2. STREAM ANALYSIS
      await streamAnalysis(
        currentCaseId,
        clinicalHistory,
        (result) => {
          setAnalysisResult(result);
          setLoading(false);
        },
        (errorMsg) => {
          setError(errorMsg);
          setLoading(false);
        },
      );
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Analysis failed";
      setError(errorMessage);
      setLoading(false);
    }
  };

  // Continued in Part 3...

  return (
    <div className="min-h-screen bg-[#0a0e14] text-slate-200 flex overflow-hidden selection:bg-blue-500/30">
      {/* Sidebar */}
      <aside
        className={`transition-all duration-300 ease-in-out bg-[#151b26] border-r border-[#2a3441] flex flex-col z-20 shrink-0 ${
          sidebarOpen ? "w-72" : "w-0 overflow-hidden border-none"
        }`}
      >
        <div className="flex flex-col h-full min-w-[18rem]">
          {/* Sidebar Header */}
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

          {/* Sidebar Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <section className="space-y-4">
              {/* Mode Toggle */}
              <div className="grid grid-cols-2 bg-[#0a0e14] p-1 rounded-lg border border-[#2a3441]">
                <button
                  onClick={() => setMode("library")}
                  className={`py-1.5 text-[10px] font-black rounded-md transition-all ${
                    mode === "library"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  LIBRARY
                </button>
                <button
                  onClick={() => setMode("upload")}
                  className={`py-1.5 text-[10px] font-black rounded-md transition-all ${
                    mode === "upload"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  NEW CASE
                </button>
              </div>

              {/* Case Selection / File Upload */}
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
                    {Object.keys(CASES).map((c) => (
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
                        className={`flex flex-col items-center justify-center gap-1.5 bg-[#1a212d] border rounded-lg p-2.5 text-[10px] transition-all ${
                          xrayFile
                            ? "border-blue-500 bg-blue-500/5"
                            : "border-[#2a3441] hover:border-blue-500/50"
                        }`}
                      >
                        <FileText
                          className={`w-3.5 h-3.5 ${
                            xrayFile ? "text-blue-400" : "text-slate-500"
                          }`}
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
                        className={`flex flex-col items-center justify-center gap-1.5 bg-[#1a212d] border rounded-lg p-2.5 text-[10px] transition-all ${
                          audioFile
                            ? "border-emerald-500 bg-emerald-500/5"
                            : "border-[#2a3441] hover:border-emerald-500/50"
                        }`}
                      >
                        <Activity
                          className={`w-3.5 h-3.5 ${
                            audioFile ? "text-emerald-400" : "text-slate-500"
                          }`}
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

              {/* Clinical History */}
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

              {/* Action Buttons */}
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

            {/* Error Display */}
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

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden transition-all duration-300 bg-[#0d1117]">
        {/* Header */}
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

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
          <div className="w-full mx-auto space-y-6">
            {/* Initial State */}
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

            {/* Loading State */}
            {loading && (
              <div className="h-[70vh] flex flex-col items-center justify-center space-y-8 animate-in fade-in duration-500">
                <div className="relative w-24 h-24">
                  <div className="absolute inset-0 border-4 border-blue-500/5 rounded-full" />
                  <div className="absolute inset-0 border-4 border-t-blue-500 rounded-full animate-spin shadow-[0_0_25px_rgba(59,130,246,0.3)]" />
                  <div className="absolute inset-0 m-auto w-8 h-8 flex items-center justify-center">
                    <Activity className="w-6 h-6 text-blue-500 animate-pulse" />
                  </div>
                </div>

                <ThinkingConsole
                  steps={thinkingSteps}
                  streamingThought={streamingThought}
                />

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

            {/* Results State */}
            {analysisResult && (
              <>
                {/* Tab Navigation */}
                <div className="flex gap-1 p-1 bg-[#151b26] rounded-xl border border-[#2a3441] w-fit shadow-lg">
                  {[
                    { id: "overview", label: "Verdict", icon: ShieldAlert },
                    { id: "evidence", label: "Evidence", icon: Microscope },
                    { id: "audit", label: "Logic Audit", icon: ClipboardList },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${
                        activeTab === tab.id
                          ? "bg-blue-600 text-white shadow-md shadow-blue-900/20"
                          : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
                      }`}
                    >
                      <tab.icon className="w-3.5 h-3.5" />
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                {activeTab === "overview" && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
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
                        <SeverityCard analysisResult={analysisResult} />
                      </div>
                    ) : (
                      <div className="p-12 border-2 border-dashed border-[#2a3441] rounded-3xl flex flex-col items-center justify-center text-slate-600">
                        <Activity className="w-8 h-8 mb-4 opacity-20 animate-pulse" />
                        <p className="text-xs font-bold uppercase tracking-widest">
                          Awaiting Adjudication Finalization...
                        </p>
                      </div>
                    )}

                    {/* Confidence Heatmap placeholder */}
                    {analysisResult && (
                      <div className="bg-[#151b26] border border-[#2a3441] rounded-xl p-5">
                        <div className="flex items-center gap-2 mb-4">
                          <Layers className="w-3 h-3 text-slate-400" />
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Consensus Confidence Matrix
                          </h4>
                        </div>
                        <p className="text-xs text-slate-500 italic">
                          Matrix visualization component would go here
                        </p>
                      </div>
                    )}
                  </div>
                )}

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
                        setShowAcousticModal={setShowAcousticModal}
                      />
                      <LeadClinicianCard
                        analysisResult={analysisResult}
                        setShowClinicianModal={setShowClinicianModal}
                      />
                    </div>
                    <AgentMetricsPanel analysisResult={analysisResult} />
                  </div>
                )}

                {activeTab === "audit" && (
                  <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-top-4 duration-500">
                    {analysisResult.reasoning_trace?.map((step, i) => (
                      <div
                        key={i}
                        className="bg-[#151b26] border border-[#2a3441] rounded-xl p-6"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-xs font-black text-blue-500">
                            {i + 1}
                          </div>
                          <h4 className="text-xs font-bold text-white">
                            Logic Node
                          </h4>
                        </div>
                        <div className="text-xs text-slate-300 leading-relaxed prose prose-invert prose-sm max-w-none">
                          <ReactMarkdown>{step}</ReactMarkdown>
                        </div>
                      </div>
                    ))}

                    {analysisResult.audit_markdown && (
                      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-6">
                        <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-4">
                          Clinical Audit Log
                        </h4>
                        <div className="text-sm text-slate-300 prose prose-invert prose-sm max-w-none">
                          <ReactMarkdown>
                            {analysisResult.audit_markdown}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer */}
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

      {/* Imaging Modal */}
      {/* Imaging Modal */}
      {showImagingModal && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-in fade-in duration-300"
          onClick={() => setShowImagingModal(false)}
        >
          <div
            className="bg-[#151b26] border border-[#2a3441] rounded-2xl w-full max-w-6xl max-h-[85vh] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 duration-500"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Compact Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a3441] bg-gradient-to-r from-blue-500/5 to-purple-500/5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                  <Microscope className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">
                    Radiographic Analysis
                  </h2>
                  <p className="text-[10px] text-slate-400">
                    Multi-phase evaluation
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowImagingModal(false)}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors group"
              >
                <X className="w-4 h-4 text-slate-400 group-hover:text-white" />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto max-h-[calc(85vh-80px)]">
              {analysisResult &&
                (() => {
                  const visionAgent = analysisResult.agent_reports.find(
                    (r) =>
                      r.agent_name === "imaging" || r.agent === "VisionAgent",
                  );

                  return (
                    <div className="grid grid-cols-2 gap-6 p-6">
                      {/* Left Column: Image + Metadata */}
                      <div className="space-y-4">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Radiographic Image
                        </h3>

                        {/* Image */}
                        <div className="aspect-square bg-[#0a0e14] rounded-xl border border-[#2a3441] overflow-hidden">
                          {xrayFile ? (
                            <img
                              src={URL.createObjectURL(xrayFile)}
                              alt="Chest X-ray"
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <img
                              src={`${API_URL}/xray/${analysisResult.case_id}`}
                              alt="Chest X-ray"
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = "none";
                              }}
                            />
                          )}
                        </div>

                        {/* Metadata */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-2.5">
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-0.5">
                              Model
                            </p>
                            <p className="text-xs font-bold text-white truncate">
                              {visionAgent?.model || "MedGemma-1.5-4b"}
                            </p>
                          </div>
                          <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-2.5">
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-0.5">
                              Time
                            </p>
                            <p className="text-xs font-bold text-white">
                              {visionAgent?.execution_time || "N/A"}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Right Column: Clinical Assessment */}
                      <div className="space-y-4">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Clinical Assessment
                        </h3>

                        <div className="bg-[#0a0e14] border border-[#2a3441] rounded-xl p-5 h-[calc(100%-32px)] overflow-y-auto scrollbar-thin">
                          {visionAgent?.observation ? (
                            <div className="prose prose-invert prose-sm max-w-none">
                              <ReactMarkdown
                                components={{
                                  p: ({ children }) => (
                                    <p className="text-sm text-slate-300 leading-relaxed mb-3 last:mb-0">
                                      {children}
                                    </p>
                                  ),
                                  strong: ({ children }) => (
                                    <strong className="text-white font-semibold">
                                      {children}
                                    </strong>
                                  ),
                                  ul: ({ children }) => (
                                    <ul className="space-y-2 my-3">
                                      {children}
                                    </ul>
                                  ),
                                  li: ({ children }) => (
                                    <li className="text-sm text-slate-300 leading-relaxed flex gap-2">
                                      <span className="text-blue-400 mt-0.5 shrink-0">
                                        •
                                      </span>
                                      <span className="flex-1">{children}</span>
                                    </li>
                                  ),
                                  h3: ({ children }) => (
                                    <h3 className="text-sm font-bold text-white mt-4 mb-2 first:mt-0">
                                      {children}
                                    </h3>
                                  ),
                                  h4: ({ children }) => (
                                    <h4 className="text-xs font-bold text-blue-400 mt-3 mb-1.5">
                                      {children}
                                    </h4>
                                  ),
                                }}
                              >
                                {visionAgent.observation}
                              </ReactMarkdown>
                            </div>
                          ) : (
                            <p className="text-sm text-slate-500 italic">
                              No detailed observation available
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}

              {/* Key Findings Section (Below, Full Width) */}
              {/* Key Findings Section (Below, Full Width) */}
              {analysisResult &&
                (() => {
                  const visionAgent = analysisResult.agent_reports.find(
                    (r) =>
                      r.agent_name === "imaging" || r.agent === "VisionAgent",
                  );

                  return visionAgent?.claims &&
                    visionAgent.claims.length > 0 ? (
                    <div className="border-t border-[#2a3441] px-6 py-4 bg-[#0a0e14]/50">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-widest">
                          Key Findings
                        </h3>
                        <span className="text-[10px] font-bold text-slate-500">
                          {visionAgent.claims.length} Total
                        </span>
                      </div>
                      <div
                        className="grid gap-3"
                        style={{
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(300px, 1fr))",
                        }}
                      >
                        {visionAgent.claims.map((claim: any, idx: number) => (
                          <div
                            key={idx}
                            className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 hover:bg-blue-500/10 transition-colors"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-1.5">
                                <div className="w-5 h-5 rounded bg-blue-500/20 flex items-center justify-center">
                                  <span className="text-[10px] font-black text-blue-400">
                                    {idx + 1}
                                  </span>
                                </div>
                                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">
                                  Finding {idx + 1}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <div className="h-1 w-12 bg-slate-800 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-blue-500 rounded-full"
                                    style={{
                                      width: `${(claim.confidence || 0) * 100}%`,
                                    }}
                                  />
                                </div>
                                <span className="text-[10px] font-bold text-blue-400">
                                  {Math.round((claim.confidence || 0) * 100)}%
                                </span>
                              </div>
                            </div>

                            {/* Render with ReactMarkdown for proper formatting */}
                            <div className="prose prose-invert prose-sm max-w-none">
                              <ReactMarkdown
                                components={{
                                  p: ({ children }) => (
                                    <p className="text-sm text-slate-300 leading-relaxed mb-2 last:mb-0">
                                      {children}
                                    </p>
                                  ),
                                  strong: ({ children }) => (
                                    <strong className="text-white font-semibold">
                                      {children}
                                    </strong>
                                  ),
                                  ul: ({ children }) => (
                                    <ul className="space-y-1 my-2">
                                      {children}
                                    </ul>
                                  ),
                                  li: ({ children }) => (
                                    <li className="text-sm text-slate-300 leading-relaxed flex gap-2 items-start">
                                      <span className="text-blue-400 mt-0.5 shrink-0">
                                        •
                                      </span>
                                      <span className="flex-1">{children}</span>
                                    </li>
                                  ),
                                  h3: ({ children }) => (
                                    <h3 className="text-sm font-bold text-white mt-3 mb-1.5 first:mt-0">
                                      {children}
                                    </h3>
                                  ),
                                  h4: ({ children }) => (
                                    <h4 className="text-xs font-bold text-blue-400 mt-2 mb-1">
                                      {children}
                                    </h4>
                                  ),
                                }}
                              >
                                {claim.value}
                              </ReactMarkdown>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null;
                })()}
            </div>
          </div>
        </div>
      )}
      {/* Acoustic Modal */}
      {showAcousticModal && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-in fade-in duration-300"
          onClick={() => setShowAcousticModal(false)}
        >
          <div
            className="bg-[#151b26] border border-[#2a3441] rounded-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 duration-500"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a3441] bg-gradient-to-r from-emerald-500/5 to-cyan-500/5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">
                    Acoustic Analysis
                  </h2>
                  <p className="text-[10px] text-slate-400">
                    Auscultation findings
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAcousticModal(false)}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors group"
              >
                <X className="w-4 h-4 text-slate-400 group-hover:text-white" />
              </button>
            </div>

            <div className="overflow-y-auto max-h-[calc(85vh-80px)] p-6 space-y-6">
              {analysisResult &&
                (() => {
                  const acousticAgent = analysisResult.agent_reports.find(
                    (r) =>
                      r.agent_name === "acoustics" || r.agent === "AudioAgent",
                  );

                  return (
                    <>
                      {/* Observation */}
                      {acousticAgent?.observation && (
                        <div>
                          <h3 className="text-xs font-black text-emerald-400 uppercase tracking-widest mb-3">
                            Clinical Observation
                          </h3>
                          <div className="bg-[#0a0e14] border border-[#2a3441] rounded-xl p-5 prose prose-invert prose-sm max-w-none">
                            <p className="text-sm text-slate-300 leading-relaxed">
                              {acousticAgent.observation}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* All Claims */}
                      {acousticAgent?.claims &&
                        acousticAgent.claims.length > 0 && (
                          <div>
                            <h3 className="text-xs font-black text-emerald-400 uppercase tracking-widest mb-3">
                              All Findings ({acousticAgent.claims.length})
                            </h3>
                            <div className="space-y-3">
                              {acousticAgent.claims.map(
                                (claim: any, idx: number) => (
                                  <div
                                    key={idx}
                                    className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4"
                                  >
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-xs font-bold text-emerald-400">
                                        {claim.label}
                                      </span>
                                      <div className="flex items-center gap-2">
                                        <div className="h-1.5 w-20 bg-slate-800 rounded-full overflow-hidden">
                                          <div
                                            className="h-full bg-emerald-500 rounded-full"
                                            style={{
                                              width: `${(claim.confidence || 0) * 100}%`,
                                            }}
                                          />
                                        </div>
                                        <span className="text-xs font-bold text-emerald-400">
                                          {Math.round(
                                            (claim.confidence || 0) * 100,
                                          )}
                                          %
                                        </span>
                                      </div>
                                    </div>
                                    <p className="text-sm text-slate-300 leading-relaxed">
                                      {claim.value}
                                    </p>
                                  </div>
                                ),
                              )}
                            </div>
                          </div>
                        )}

                      {/* Metadata */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">
                          <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-0.5">
                            Model
                          </p>
                          <p className="text-xs font-bold text-white">
                            {acousticAgent?.model || "Google-HeAR"}
                          </p>
                        </div>
                        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">
                          <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-0.5">
                            Time
                          </p>
                          <p className="text-xs font-bold text-white">
                            {acousticAgent?.execution_time || "N/A"}
                          </p>
                        </div>
                      </div>
                    </>
                  );
                })()}
            </div>
          </div>
        </div>
      )}

      {/* Lead Clinician Modal */}
      {showClinicianModal && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-in fade-in duration-300"
          onClick={() => setShowClinicianModal(false)}
        >
          <div
            className="bg-[#151b26] border border-[#2a3441] rounded-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 duration-500"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a3441] bg-gradient-to-r from-purple-500/5 to-pink-500/5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                  <Brain className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">
                    Lead Clinician Analysis
                  </h2>
                  <p className="text-[10px] text-slate-400">
                    Clinical synthesis
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowClinicianModal(false)}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors group"
              >
                <X className="w-4 h-4 text-slate-400 group-hover:text-white" />
              </button>
            </div>

            <div className="overflow-y-auto max-h-[calc(85vh-80px)] p-6 space-y-6">
              {analysisResult &&
                (() => {
                  const clinicianAgent = analysisResult.agent_reports.find(
                    (r) =>
                      r.agent_name === "clinician" ||
                      r.agent === "LeadClinician",
                  );

                  return (
                    <>
                      {/* Observation */}
                      {clinicianAgent?.observation && (
                        <div>
                          <h3 className="text-xs font-black text-purple-400 uppercase tracking-widest mb-3">
                            Clinical Synthesis
                          </h3>
                          <div className="bg-[#0a0e14] border border-[#2a3441] rounded-xl p-5 prose prose-invert prose-sm max-w-none">
                            <ReactMarkdown
                              components={{
                                p: ({ children }) => (
                                  <p className="text-sm text-slate-300 leading-relaxed mb-3 last:mb-0">
                                    {children}
                                  </p>
                                ),
                                strong: ({ children }) => (
                                  <strong className="text-white font-semibold">
                                    {children}
                                  </strong>
                                ),
                              }}
                            >
                              {clinicianAgent.observation}
                            </ReactMarkdown>
                          </div>
                        </div>
                      )}

                      {/* Metadata */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-3">
                          <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-0.5">
                            Model
                          </p>
                          <p className="text-xs font-bold text-white">
                            {clinicianAgent?.model || "MedGemma-1.5-4b"}
                          </p>
                        </div>
                        <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-3">
                          <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-0.5">
                            Time
                          </p>
                          <p className="text-xs font-bold text-white">
                            {clinicianAgent?.execution_time || "N/A"}
                          </p>
                        </div>
                      </div>
                    </>
                  );
                })()}
            </div>
          </div>
        </div>
      )}

      {/* Verdict Modal */}
      {showFullVerdict && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-in fade-in duration-300"
          onClick={() => setShowFullVerdict(false)}
        >
          <div
            className="bg-[#151b26] border border-[#2a3441] rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 duration-500"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-[#2a3441] bg-gradient-to-r from-blue-500/5 to-purple-500/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                  <ShieldAlert className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">
                    Complete Adjudicated Verdict
                  </h2>
                  <p className="text-xs text-slate-400">
                    Multi-agent clinical consensus
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowFullVerdict(false)}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors group"
              >
                <X className="w-5 h-5 text-slate-400 group-hover:text-white" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="overflow-y-auto max-h-[calc(90vh-80px)] p-6 space-y-6">
              {/* Confidence Meter */}
              <div className="bg-gradient-to-r from-blue-500/5 to-purple-500/5 border border-blue-500/20 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-white">
                    Consensus Confidence
                  </h3>
                  <span className="text-2xl font-black text-blue-400">
                    {Math.round(
                      (analysisResult?.discrepancy_alert?.score || 0) * 100,
                    )}
                    %
                  </span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-1000"
                    style={{
                      width: `${(analysisResult?.discrepancy_alert?.score || 0) * 100}%`,
                    }}
                  />
                </div>
              </div>

              {/* Summary */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-widest">
                  Clinical Summary
                </h3>
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => (
                        <p className="text-base text-slate-300 leading-relaxed mb-4">
                          {children}
                        </p>
                      ),
                      strong: ({ children }) => (
                        <strong className="text-white font-bold">
                          {children}
                        </strong>
                      ),
                      ul: ({ children }) => (
                        <ul className="list-disc list-inside space-y-2 ml-4">
                          {children}
                        </ul>
                      ),
                      li: ({ children }) => (
                        <li className="text-base text-slate-300">{children}</li>
                      ),
                    }}
                  >
                    {analysisResult?.discrepancy_alert?.summary ||
                      "Analysis in progress..."}
                  </ReactMarkdown>
                </div>
              </div>

              {/* Full Reasoning */}
              {analysisResult?.thought_process && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-widest">
                    Detailed Clinical Reasoning
                  </h3>
                  <div className="bg-[#0a0e14] border border-[#2a3441] rounded-xl p-6 prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => (
                          <p className="text-sm text-slate-300 leading-relaxed mb-3">
                            {children}
                          </p>
                        ),
                        strong: ({ children }) => (
                          <strong className="text-white font-bold">
                            {children}
                          </strong>
                        ),
                      }}
                    >
                      {analysisResult.thought_process}
                    </ReactMarkdown>
                  </div>
                </div>
              )}

              {/* Contributing Agents */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-white uppercase tracking-widest">
                  Contributing Agents
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {analysisResult?.agent_reports?.map(
                    (agent: any, i: number) => (
                      <div
                        key={i}
                        className="bg-[#0a0e14] border border-[#2a3441] rounded-lg p-4 hover:border-blue-500/30 transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xl">{agent.icon}</span>
                          <span className="text-xs font-bold text-white capitalize">
                            {agent.agent_name || agent.agent}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] text-slate-500 uppercase tracking-widest">
                            Status
                          </span>
                          <span
                            className={`text-[9px] font-bold uppercase ${agent.success ? "text-emerald-400" : "text-slate-500"}`}
                          >
                            {agent.success ? "Complete" : "Pending"}
                          </span>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Directives Modal */}
      {showFullDirectives && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-in fade-in duration-300"
          onClick={() => setShowFullDirectives(false)}
        >
          <div
            className="bg-[#151b26] border border-[#2a3441] rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 duration-500"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-[#2a3441] bg-gradient-to-r from-emerald-500/5 to-cyan-500/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                  <ClipboardList className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">
                    Clinical Directives & Protocols
                  </h2>
                  <p className="text-xs text-slate-400">
                    Recommended diagnostic pathways
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowFullDirectives(false)}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors group"
              >
                <X className="w-5 h-5 text-slate-400 group-hover:text-white" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="overflow-y-auto max-h-[calc(90vh-80px)] p-6 space-y-4">
              {(analysisResult?.recommended_data_actions &&
              analysisResult.recommended_data_actions.length > 0
                ? analysisResult.recommended_data_actions
                : [
                    "Pneumonia",
                    "Atelectasis",
                    "Lung Mass (non-cancerous)",
                    "Tuberculosis",
                  ]
              ).map((directive: string, idx: number) => (
                <div
                  key={idx}
                  className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-5 hover:bg-emerald-500/10 transition-colors group"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shrink-0 group-hover:scale-110 transition-transform">
                      <span className="text-sm font-black text-emerald-400">
                        {idx + 1}
                      </span>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base font-bold text-white mb-2">
                        {directive}
                      </h3>
                      <p className="text-sm text-slate-400 leading-relaxed">
                        Clinical consideration based on multi-agent consensus
                        analysis
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {/* Summary Footer */}
              <div className="mt-6 pt-6 border-t border-[#2a3441]">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    Total critical actions identified
                  </span>
                  <span className="text-xl font-black text-emerald-400">
                    {analysisResult?.recommended_data_actions?.length || 4}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global Styles */}
      {/* Global Styles */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
      
      /* Global Typography System */
      body { 
        font-family: 'Plus Jakarta Sans', sans-serif; 
        font-feature-settings: "cv02", "cv03", "cv04"; 
        -webkit-font-smoothing: antialiased; 
      }
      
      /* Consistent Font Sizes */
      .text-xs { font-size: 0.75rem !important; line-height: 1.5 !important; }
      .text-sm { font-size: 0.875rem !important; line-height: 1.5 !important; }
      .text-base { font-size: 1rem !important; line-height: 1.5 !important; }
      
      /* Consistent Font Weights */
      .font-normal { font-weight: 400 !important; }
      .font-medium { font-weight: 500 !important; }
      .font-semibold { font-weight: 600 !important; }
      .font-bold { font-weight: 700 !important; }
      .font-black { font-weight: 800 !important; }
      
      /* Scrollbar Styling */
      ::-webkit-scrollbar { width: 5px; height: 5px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: #2a3441; border-radius: 10px; }
      ::-webkit-scrollbar-thumb:hover { background: #3b4757; }
      .scrollbar-thin::-webkit-scrollbar { width: 2px; }
      
      /* Prose (ReactMarkdown) Consistency */
      .prose p { font-size: 0.875rem !important; line-height: 1.5 !important; }
      .prose strong { font-weight: 600 !important; }
      .prose li { font-size: 0.875rem !important; line-height: 1.5 !important; }
      .prose h3 { font-size: 0.875rem !important; font-weight: 700 !important; }
      .prose h4 { font-size: 0.875rem !important; font-weight: 600 !important; }
    `,
        }}
      />
    </div>
  );
}
