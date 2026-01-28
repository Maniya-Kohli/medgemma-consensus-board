import React, { useState } from "react";
import { ChevronDown, AlertCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { AgentReport, EvaluatedHypothesis } from "../types";

interface HypothesisEvaluationPanelProps {
  clinicianReport: AgentReport | null;
}

export const HypothesisEvaluationPanel: React.FC<
  HypothesisEvaluationPanelProps
> = ({ clinicianReport }) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const evaluatedHypotheses =
    clinicianReport?.metadata?.differential_evaluated || [];

  if (!evaluatedHypotheses || evaluatedHypotheses.length === 0) {
    return null;
  }

  // Sort by score (highest first)
  const sortedHypotheses = [...evaluatedHypotheses].sort(
    (a, b) => b.score - a.score,
  );

  return (
    <div className="bg-[#151b26] border border-[#2a3441] rounded-lg">
      {/* Compact Header */}
      <div className="px-5 py-3 border-b border-[#2a3441] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm text-white">
            Differential Diagnosis Evaluation
          </h3>
          <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-[9px] text-blue-400 uppercase tracking-wider">
            AI-Ranked
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span>{sortedHypotheses.length} Hypotheses</span>
          <span className="text-blue-400">
            Top: {sortedHypotheses[0]?.score || 0}
          </span>
        </div>
      </div>

      {/* Hypothesis List */}
      <div className="p-4 space-y-2">
        {sortedHypotheses.map((hypothesis, index) => {
          const isExpanded = expandedIndex === index;
          const isTop = index === 0;

          return (
            <div
              key={index}
              className={`border rounded-md overflow-hidden transition-all ${
                isExpanded
                  ? "border-blue-500/30 bg-blue-500/5"
                  : "border-[#2a3441] hover:border-blue-500/20"
              }`}
            >
              {/* Clickable Header */}
              <button
                onClick={() => setExpandedIndex(isExpanded ? null : index)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  {/* Rank Number */}
                  <div
                    className={`w-7 h-7 rounded flex items-center justify-center text-xs ${
                      isTop
                        ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                        : "bg-slate-800 text-slate-500"
                    }`}
                  >
                    {index + 1}
                  </div>

                  {/* Diagnosis Name */}
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white">
                        {hypothesis.diagnosis}
                      </span>
                      {isTop && (
                        <span className="px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-[9px] text-blue-400 uppercase tracking-wider">
                          Primary
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {hypothesis.score >= 70
                        ? "High"
                        : hypothesis.score >= 40
                          ? "Moderate"
                          : "Low"}{" "}
                      Likelihood
                    </p>
                  </div>

                  {/* Score Display */}
                  <div className="flex items-center gap-3">
                    {/* Progress Bar */}
                    <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all duration-1000"
                        style={{ width: `${hypothesis.score}%` }}
                      />
                    </div>

                    {/* Score Number */}
                    <span className="text-sm text-blue-400 min-w-[45px] text-right">
                      {hypothesis.score}
                      <span className="text-slate-600">/100</span>
                    </span>

                    {/* Chevron */}
                    <ChevronDown
                      className={`w-4 h-4 text-slate-500 transition-transform ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </div>
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="border-t border-[#2a3441] px-4 py-3 bg-[#0d1117]">
                  <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => (
                          <p className="text-xs text-slate-400 leading-relaxed mb-2 last:mb-0">
                            {children}
                          </p>
                        ),
                        strong: ({ children }) => (
                          <span className="text-slate-300">{children}</span>
                        ),
                        em: ({ children }) => (
                          <span className="text-blue-400">{children}</span>
                        ),
                        ul: ({ children }) => (
                          <ul className="space-y-1 my-2">{children}</ul>
                        ),
                        ol: ({ children }) => (
                          <ol className="space-y-1 my-2 list-decimal list-inside">
                            {children}
                          </ol>
                        ),
                        li: ({ children }) => (
                          <li className="text-xs text-slate-400 leading-relaxed">
                            {children}
                          </li>
                        ),
                        h3: ({ children }) => (
                          <h3 className="text-xs text-slate-300 mt-3 mb-1.5 first:mt-0">
                            {children}
                          </h3>
                        ),
                        h4: ({ children }) => (
                          <h4 className="text-xs text-blue-400 mt-2 mb-1">
                            {children}
                          </h4>
                        ),
                      }}
                    >
                      {hypothesis.evaluation}
                    </ReactMarkdown>
                  </div>

                  {/* Evidence Tags */}
                  <div className="mt-3 pt-3 border-t border-[#2a3441]">
                    <div className="flex flex-wrap gap-1.5">
                      <span className="px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded text-[9px] text-blue-400">
                        Imaging
                      </span>
                      <span className="px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded text-[9px] text-blue-400">
                        Acoustic
                      </span>
                      <span className="px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded text-[9px] text-blue-400">
                        Clinical History
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-5 py-2.5 border-t border-[#2a3441] flex items-center justify-between text-[10px] text-slate-500">
        <span>Evidence-based evaluation</span>
        <span className="text-blue-400">Multi-agent consensus</span>
      </div>
    </div>
  );
};
