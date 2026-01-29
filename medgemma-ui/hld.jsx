import React, { useState } from "react";

const SystemArchitectureDiagram = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [hoveredAgent, setHoveredAgent] = useState(null);

  const steps = [
    {
      id: 0,
      title: "1. User Input",
      description: "User uploads X-ray, audio, and clinical history",
    },
    {
      id: 1,
      title: "2. Blackboard Created",
      description: "Central repository stores all inputs",
    },
    {
      id: 2,
      title: "3. AudioAgent Runs",
      description: "Analyzes lung sounds using HeAR model",
    },
    {
      id: 3,
      title: "4. VisionAgent Runs",
      description: "Analyzes X-ray using MedGemma with 6-step reasoning",
    },
    {
      id: 4,
      title: "5. LeadClinician Runs",
      description: "Synthesizes all findings into final diagnosis",
    },
    {
      id: 5,
      title: "6. Output Generated",
      description: "Diagnosis, confidence, and reasoning returned",
    },
  ];

  const agents = [
    {
      id: "audio",
      name: "AudioAgent",
      icon: "🔊",
      color: "emerald",
      model: "HeAR (Google)",
      purpose: "Analyze lung sounds",
      input: "audio.wav",
      output: "Airway status",
      priority: 10,
    },
    {
      id: "vision",
      name: "VisionAgent",
      icon: "👁️",
      color: "blue",
      model: "MedGemma 1.5",
      purpose: "Analyze chest X-rays",
      input: "xray.jpg",
      output: "Radiographic findings",
      priority: 10,
    },
    {
      id: "clinician",
      name: "LeadClinician",
      icon: "🧠",
      color: "purple",
      model: "MedGemma 1.5",
      purpose: "Synthesize all findings",
      input: "Agent findings",
      output: "Final diagnosis",
      priority: 1,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      {/* Title */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">
          🏥 Metacognitive Clinical Analysis System
        </h1>
        <p className="text-slate-400">Multi-Agent AI for Medical Diagnosis</p>
      </div>

      {/* Step Progress */}
      <div className="max-w-4xl mx-auto mb-8">
        <div className="flex justify-between items-center">
          {steps.map((step, i) => (
            <button
              key={step.id}
              onClick={() => setActiveStep(i)}
              className={`flex flex-col items-center transition-all ${
                activeStep === i ? "scale-110" : "opacity-50"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                  activeStep >= i ? "bg-blue-500" : "bg-slate-700"
                }`}
              >
                {i + 1}
              </div>
              <span className="text-xs mt-1 max-w-[80px] text-center">
                {step.title}
              </span>
            </button>
          ))}
        </div>
        <div className="mt-4 text-center p-4 bg-slate-800 rounded-lg">
          <p className="text-lg">{steps[activeStep].description}</p>
        </div>
      </div>

      {/* Main Diagram */}
      <div className="max-w-6xl mx-auto">
        {/* Input Section */}
        <div className="flex justify-center gap-4 mb-8">
          <div
            className={`p-4 rounded-lg border-2 transition-all ${
              activeStep === 0
                ? "border-blue-500 bg-blue-500/10"
                : "border-slate-700"
            }`}
          >
            <div className="text-2xl mb-2">🫁</div>
            <div className="text-sm font-bold">X-Ray</div>
            <div className="text-xs text-slate-400">chest_xray.jpg</div>
          </div>
          <div
            className={`p-4 rounded-lg border-2 transition-all ${
              activeStep === 0
                ? "border-emerald-500 bg-emerald-500/10"
                : "border-slate-700"
            }`}
          >
            <div className="text-2xl mb-2">🔊</div>
            <div className="text-sm font-bold">Audio</div>
            <div className="text-xs text-slate-400">lung_sounds.wav</div>
          </div>
          <div
            className={`p-4 rounded-lg border-2 transition-all ${
              activeStep === 0
                ? "border-purple-500 bg-purple-500/10"
                : "border-slate-700"
            }`}
          >
            <div className="text-2xl mb-2">📝</div>
            <div className="text-sm font-bold">History</div>
            <div className="text-xs text-slate-400">Clinical notes</div>
          </div>
        </div>

        {/* Arrow Down */}
        <div className="flex justify-center mb-4">
          <div
            className={`text-2xl transition-all ${activeStep >= 1 ? "text-blue-500" : "text-slate-600"}`}
          >
            ▼
          </div>
        </div>

        {/* Blackboard */}
        <div
          className={`max-w-2xl mx-auto p-6 rounded-xl border-2 mb-8 transition-all ${
            activeStep >= 1
              ? "border-yellow-500 bg-yellow-500/5"
              : "border-slate-700"
          }`}
        >
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">📋</span>
            <span className="text-lg font-bold">Clinical Blackboard</span>
            <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded">
              Shared State
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="bg-slate-800 p-3 rounded">
              <div className="text-slate-400 text-xs mb-1">inputs</div>
              <div className="font-mono text-xs">
                image_path, audio_path, history
              </div>
            </div>
            <div className="bg-slate-800 p-3 rounded">
              <div className="text-slate-400 text-xs mb-1">knowledge_base</div>
              <div className="font-mono text-xs">[AgentFindings...]</div>
            </div>
            <div className="bg-slate-800 p-3 rounded">
              <div className="text-slate-400 text-xs mb-1">hypothesis</div>
              <div className="font-mono text-xs">{`{diagnosis, confidence}`}</div>
            </div>
          </div>
        </div>

        {/* Arrow Down */}
        <div className="flex justify-center mb-4">
          <div
            className={`text-2xl transition-all ${activeStep >= 2 ? "text-blue-500" : "text-slate-600"}`}
          >
            ▼
          </div>
        </div>

        {/* Orchestrator */}
        <div
          className={`max-w-3xl mx-auto p-4 rounded-lg border-2 mb-8 transition-all ${
            activeStep >= 2
              ? "border-cyan-500 bg-cyan-500/5"
              : "border-slate-700"
          }`}
        >
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-xl">🎭</span>
            <span className="font-bold">Orchestrator</span>
            <span className="text-xs text-slate-400">
              (Runs agents by priority)
            </span>
          </div>

          {/* Agents */}
          <div className="flex justify-center gap-6">
            {agents.map((agent) => {
              const isActive =
                (agent.id === "audio" && activeStep === 2) ||
                (agent.id === "vision" && activeStep === 3) ||
                (agent.id === "clinician" && activeStep === 4);

              const colorMap = {
                emerald: "border-emerald-500 bg-emerald-500/10",
                blue: "border-blue-500 bg-blue-500/10",
                purple: "border-purple-500 bg-purple-500/10",
              };

              return (
                <div
                  key={agent.id}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer w-48 ${
                    isActive ? colorMap[agent.color] : "border-slate-700"
                  } ${hoveredAgent === agent.id ? "scale-105" : ""}`}
                  onMouseEnter={() => setHoveredAgent(agent.id)}
                  onMouseLeave={() => setHoveredAgent(null)}
                >
                  <div className="text-3xl mb-2">{agent.icon}</div>
                  <div className="font-bold mb-1">{agent.name}</div>
                  <div className="text-xs text-slate-400 mb-2">
                    {agent.model}
                  </div>

                  {hoveredAgent === agent.id && (
                    <div className="text-xs space-y-1 mt-3 pt-3 border-t border-slate-700">
                      <div>
                        <span className="text-slate-500">Purpose:</span>{" "}
                        {agent.purpose}
                      </div>
                      <div>
                        <span className="text-slate-500">Input:</span>{" "}
                        {agent.input}
                      </div>
                      <div>
                        <span className="text-slate-500">Output:</span>{" "}
                        {agent.output}
                      </div>
                      <div>
                        <span className="text-slate-500">Priority:</span>{" "}
                        {agent.priority}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Metacognition Box */}
        <div className="max-w-3xl mx-auto p-4 rounded-lg border border-dashed border-slate-600 mb-8">
          <div className="text-center text-sm text-slate-400 mb-3">
            🧠 <span className="font-bold text-white">Metacognition</span> -
            Each agent critiques its own reasoning
          </div>
          <div className="flex justify-center gap-4">
            <div className="text-xs bg-slate-800 px-3 py-1 rounded-full">
              1. Generate Analysis
            </div>
            <div className="text-slate-600">→</div>
            <div className="text-xs bg-slate-800 px-3 py-1 rounded-full">
              2. Self-Critique
            </div>
            <div className="text-slate-600">→</div>
            <div className="text-xs bg-slate-800 px-3 py-1 rounded-full">
              3. Peer Compare
            </div>
            <div className="text-slate-600">→</div>
            <div className="text-xs bg-slate-800 px-3 py-1 rounded-full">
              4. Revise if needed
            </div>
          </div>
        </div>

        {/* Arrow Down */}
        <div className="flex justify-center mb-4">
          <div
            className={`text-2xl transition-all ${activeStep >= 5 ? "text-green-500" : "text-slate-600"}`}
          >
            ▼
          </div>
        </div>

        {/* Output */}
        <div
          className={`max-w-2xl mx-auto p-6 rounded-xl border-2 transition-all ${
            activeStep === 5
              ? "border-green-500 bg-green-500/5"
              : "border-slate-700"
          }`}
        >
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">🎯</span>
            <span className="text-lg font-bold">Final Output</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-800 p-4 rounded-lg">
              <div className="text-green-400 font-bold mb-2">
                Primary Diagnosis
              </div>
              <div className="text-xl">Tuberculosis (Pulmonary)</div>
              <div className="text-sm text-slate-400 mt-1">Confidence: 85%</div>
            </div>
            <div className="bg-slate-800 p-4 rounded-lg">
              <div className="text-yellow-400 font-bold mb-2">Differential</div>
              <ul className="text-sm space-y-1">
                <li>• Lung Cancer</li>
                <li>• Fungal Infection</li>
                <li>• COPD</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="max-w-4xl mx-auto mt-12 p-4 bg-slate-800 rounded-lg">
        <div className="text-sm font-bold mb-3">📖 Architecture Components</div>
        <div className="grid grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-yellow-400">■</span> Blackboard - Shared state
            repository
          </div>
          <div>
            <span className="text-cyan-400">■</span> Orchestrator - Controls
            execution
          </div>
          <div>
            <span className="text-emerald-400">■</span> AudioAgent - HeAR model
          </div>
          <div>
            <span className="text-blue-400">■</span> VisionAgent - MedGemma
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemArchitectureDiagram;
