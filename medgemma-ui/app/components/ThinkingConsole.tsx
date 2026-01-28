import React, { useRef, useEffect } from "react";
import { getStepStyle, getStepIcon, parseStepMetadata } from "../utils";

interface ThinkingConsoleProps {
  steps: string[];
  streamingThought: string;
}

export const ThinkingConsole: React.FC<ThinkingConsoleProps> = ({
  steps,
  streamingThought,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [steps, streamingThought]);

  return (
    <div
      className="w-full max-w-2xl bg-[#05070a] border border-blue-500/30 rounded-xl p-4 font-mono text-[11px] space-y-3 max-h-96 overflow-y-auto shadow-2xl scrollbar-thin"
      ref={scrollRef}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-blue-500/20 pb-2 mb-2 sticky top-0 bg-[#05070a] z-10">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse delay-75" />
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse delay-150" />
          </div>
          <span className="text-blue-400 font-black tracking-tighter">
            BLACKBOARD ACTIVE SESSION
          </span>
        </div>
        <div className="flex items-center gap-2 px-2 py-0.5 bg-blue-500/10 rounded-md border border-blue-500/20">
          <span className="text-[9px] text-blue-400 font-bold">
            {steps.length}
          </span>
          <span className="text-[8px] text-blue-300/60 uppercase">events</span>
        </div>
      </div>

      {/* System Milestones */}
      <div className="space-y-1">
        {steps.map((step, i) => {
          const metadata = parseStepMetadata(step);
          const icon = getStepIcon(step);

          return (
            <div
              key={i}
              className="flex gap-2 py-0.5 animate-in fade-in slide-in-from-left-1 duration-300"
              style={{ animationDelay: `${Math.min(i * 0.02, 0.5)}s` }}
            >
              <span className="text-blue-900 shrink-0 font-bold min-w-[20px]">
                {(i + 1).toString().padStart(2, "0")}
              </span>
              {icon && <span className="shrink-0 text-xs">{icon}</span>}
              <div className="flex-1 min-w-0">
                <span className={`${getStepStyle(step)} break-words`}>
                  {step}
                </span>
                {metadata.hasMetadata && (
                  <div className="flex gap-1.5 mt-1">
                    {metadata.findingsCount !== undefined && (
                      <span className="px-1.5 py-0.5 bg-purple-500/10 border border-purple-500/20 rounded text-[8px] text-purple-400 font-bold uppercase">
                        {metadata.findingsCount} findings
                      </span>
                    )}
                    {metadata.focusArea && (
                      <span className="px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-[8px] text-blue-400 font-bold uppercase truncate max-w-[150px]">
                        {metadata.focusArea}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Typewriter Reasoning Block */}
      {streamingThought && (
        <div className="mt-4 pt-4 border-t border-blue-500/10 animate-in fade-in duration-500">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
            <span className="text-blue-500 text-[9px] font-black uppercase tracking-widest">
              Live Adjudication Stream
            </span>
          </div>
          <div className="text-slate-300 leading-relaxed whitespace-pre-wrap max-h-[200px] overflow-y-auto pr-2 scrollbar-thin">
            <span className="text-blue-500 mr-2 font-bold">[SYNTHESIS]</span>
            {streamingThought}
            <span className="inline-block w-1.5 h-3 bg-blue-500 ml-1 animate-pulse" />
          </div>
        </div>
      )}

      {/* Loading Indicator */}
      {steps.length === 0 && !streamingThought && (
        <div className="flex flex-col items-center justify-center py-8 opacity-40">
          <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-3" />
          <p className="text-[9px] font-bold text-blue-400 uppercase tracking-widest">
            Establishing Neural Link...
          </p>
        </div>
      )}
    </div>
  );
};
