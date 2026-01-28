// import React from "react";
// import ReactMarkdown from "react-markdown";
// import {
//   Activity,
//   ArrowRightCircle,
//   CheckCircle,
//   Maximize2,
// } from "lucide-react";
// import { AnalysisResult } from "../types";
// import { getSeverityTheme } from "../constants";
// import { getSeverity } from "../utils";

// interface VerdictCardProps {
//   analysisResult: AnalysisResult;
//   setShowFullVerdict: (show: boolean) => void;
// }

// export const VerdictCard: React.FC<VerdictCardProps> = ({
//   analysisResult,
//   setShowFullVerdict,
// }) => {
//   return (
//     <div className="lg:col-span-5 flex flex-col gap-4 min-h-full">
//       <div
//         onClick={() => setShowFullVerdict(true)}
//         className="bg-gradient-to-br from-[#1a212d] to-[#151b26] border border-[#2a3441] p-5 rounded-2xl shadow-xl relative overflow-hidden group cursor-pointer hover:border-blue-500/30 transition-all active:scale-[0.995] flex-1"
//       >
//         <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
//           <Activity className="w-24 h-24 text-white" />
//         </div>
//         <div className="relative z-10 h-full flex flex-col">
//           <div className="flex items-center justify-between mb-3">
//             <div className="flex items-center gap-2">
//               <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
//               <p className="text-[9px] font-black text-blue-400 uppercase tracking-[0.2em]">
//                 Adjudicated Verdict
//               </p>
//             </div>
//             <Maximize2 className="w-3 h-3 text-slate-600 group-hover:text-blue-500 transition-colors" />
//           </div>

//           <div className="text-sm font-bold text-white leading-relaxed mb-3 flex-1 line-clamp-6 prose prose-invert prose-sm max-w-none">
//             <ReactMarkdown>
//               {analysisResult?.discrepancy_alert?.summary ||
//                 "Analysis in progress..."}
//             </ReactMarkdown>
//           </div>

//           <div className="flex flex-wrap gap-2 pt-3 border-t border-white/5">
//             {analysisResult?.agent_reports?.map((agent: any, i: number) => (
//               <span
//                 key={i}
//                 className="px-2 py-0.5 bg-white/5 rounded-md border border-white/10 text-[8px] font-bold text-slate-400 uppercase"
//               >
//                 {agent.agent_name || agent.agent || "Specialist"}
//               </span>
//             ))}
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// interface DirectivesCardProps {
//   analysisResult: AnalysisResult;
//   setShowFullDirectives: (show: boolean) => void;
// }

// export const DirectivesCard: React.FC<DirectivesCardProps> = ({
//   analysisResult,
//   setShowFullDirectives,
// }) => {
//   const actions = analysisResult?.recommended_data_actions ?? [];

//   return (
//     <div className="lg:col-span-4 flex flex-col min-h-full">
//       <div
//         onClick={() => setShowFullDirectives(true)}
//         className="bg-gradient-to-br from-[#1a212d] to-[#151b26] border border-[#2a3441] p-5 rounded-2xl shadow-xl relative overflow-hidden group cursor-pointer hover:border-blue-500/30 transition-all active:scale-[0.995] flex-1"
//       >
//         <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
//           <ArrowRightCircle className="w-24 h-24 text-white" />
//         </div>
//         <div className="relative z-10 h-full flex flex-col">
//           <div className="flex items-center justify-between mb-3">
//             <div className="flex items-center gap-2">
//               <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
//               <p className="text-[9px] font-black text-blue-400 uppercase tracking-[0.2em]">
//                 Clinical Directives
//               </p>
//             </div>
//             <Maximize2 className="w-3 h-3 text-slate-600 group-hover:text-blue-500 transition-colors" />
//           </div>

//           <div className="flex-1 space-y-3 mb-3 overflow-y-auto pr-1 scrollbar-thin max-h-[220px]">
//             {actions.length > 0 ? (
//               actions.map((action: string, i: number) => (
//                 <div
//                   key={i}
//                   className="flex gap-2 items-start animate-in fade-in slide-in-from-left-2 duration-300"
//                 >
//                   <div className="w-3.5 h-3.5 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
//                     <CheckCircle className="w-2.5 h-2.5 text-blue-500" />
//                   </div>
//                   <h2 className="text-sm font-bold text-white leading-relaxed">
//                     {action}
//                   </h2>
//                 </div>
//               ))
//             ) : (
//               <div className="flex flex-col items-center justify-center h-32 opacity-20">
//                 <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-2" />
//                 <p className="text-[10px] font-bold uppercase tracking-tighter">
//                   Awaiting directives...
//                 </p>
//               </div>
//             )}
//           </div>

//           <div className="flex items-center justify-between pt-3 border-t border-white/5">
//             <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
//               {actions.length} Critical Actions
//             </span>
//             <span className="text-[9px] font-bold text-blue-500 uppercase tracking-widest group-hover:underline">
//               Inspect Protocols
//             </span>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// interface SeverityCardProps {
//   analysisResult: AnalysisResult;
// }

// export const SeverityCard: React.FC<SeverityCardProps> = ({
//   analysisResult,
// }) => {
//   const rawScore = analysisResult?.discrepancy_alert?.score;
//   const score =
//     typeof rawScore === "number" && !isNaN(rawScore)
//       ? Math.max(0, Math.min(1, rawScore))
//       : 0;

//   const severity = getSeverity(score);
//   const theme = getSeverityTheme(severity);
//   const CIRCUMFERENCE = 364;

//   return (
//     <div className="lg:col-span-3 min-h-full">
//       <div
//         className={`h-full border rounded-2xl p-5 flex flex-col items-center justify-center space-y-3 shadow-xl transition-all duration-700 ${theme.bg} ${theme.border}`}
//       >
//         <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">
//           Discrepancy Severity
//         </h4>

//         <div className="relative flex items-center justify-center w-28 h-28">
//           <svg
//             className="w-full h-full transform -rotate-90 block"
//             viewBox="0 0 128 128"
//           >
//             <circle
//               cx="64"
//               cy="64"
//               r="58"
//               stroke="currentColor"
//               strokeWidth="8"
//               fill="transparent"
//               className="text-slate-800"
//             />
//             <circle
//               cx="64"
//               cy="64"
//               r="58"
//               stroke="currentColor"
//               strokeWidth="8"
//               strokeLinecap="round"
//               fill="transparent"
//               className="transition-all duration-1000 ease-out"
//               style={{
//                 color: theme.stroke,
//                 strokeDasharray: CIRCUMFERENCE,
//                 strokeDashoffset: CIRCUMFERENCE - CIRCUMFERENCE * score,
//                 filter: `drop-shadow(0 0 6px ${theme.stroke}44)`,
//               }}
//             />
//           </svg>

//           <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
//             <span className={`text-2xl font-black leading-none ${theme.color}`}>
//               {Math.round(score * 100)}%
//             </span>
//             <span className="text-[7px] font-black text-slate-500 uppercase tracking-tighter mt-1">
//               Conflict
//             </span>
//           </div>
//         </div>

//         <p
//           className={`text-[8px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${theme.color} ${theme.border}`}
//         >
//           {severity} Alert
//         </p>
//       </div>
//     </div>
//   );
// };
import React from "react";
import ReactMarkdown from "react-markdown";
import {
  Activity,
  ArrowRightCircle,
  CheckCircle,
  Maximize2,
} from "lucide-react";
import { AnalysisResult } from "../types";
import { getSeverityTheme } from "../constants";
import { getSeverity } from "../utils";

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
        className="bg-[#151b26] border border-[#2a3441] p-4 rounded-lg relative overflow-hidden group cursor-pointer hover:border-blue-500/30 transition-all flex-1"
      >
        <div className="relative z-10 h-full flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              <p className="text-[9px] text-blue-400 uppercase tracking-wider">
                Adjudicated Verdict
              </p>
            </div>
            <Maximize2 className="w-3 h-3 text-slate-500 group-hover:text-blue-400 transition-colors" />
          </div>

          <div className="text-sm text-white leading-relaxed mb-3 flex-1 line-clamp-6 prose prose-invert prose-sm max-w-none">
            <ReactMarkdown>
              {analysisResult?.discrepancy_alert?.summary ||
                "Analysis in progress..."}
            </ReactMarkdown>
          </div>

          <div className="flex flex-wrap gap-1.5 pt-3 border-t border-[#2a3441]">
            {analysisResult?.agent_reports?.map((agent: any, i: number) => (
              <span
                key={i}
                className="px-2 py-0.5 bg-blue-500/10 rounded border border-blue-500/20 text-[9px] text-blue-400 uppercase tracking-wider"
              >
                {agent.agent_name || agent.agent || "Specialist"}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

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
        className="bg-[#151b26] border border-[#2a3441] p-4 rounded-lg relative overflow-hidden group cursor-pointer hover:border-blue-500/30 transition-all flex-1"
      >
        <div className="relative z-10 h-full flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              <p className="text-[9px] text-blue-400 uppercase tracking-wider">
                Clinical Directives
              </p>
            </div>
            <Maximize2 className="w-3 h-3 text-slate-500 group-hover:text-blue-400 transition-colors" />
          </div>

          <div className="flex-1 space-y-2.5 mb-3 overflow-y-auto pr-1 scrollbar-thin max-h-[220px]">
            {actions.length > 0 ? (
              actions.map((action: string, i: number) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="w-3 h-3 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5 border border-blue-500/20">
                    <CheckCircle className="w-2 h-2 text-blue-400" />
                  </div>
                  <p className="text-sm text-white leading-relaxed">{action}</p>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-32 opacity-20">
                <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-2" />
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                  Awaiting directives...
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-[#2a3441]">
            <span className="text-[9px] text-slate-500 uppercase tracking-wider">
              {actions.length} Critical Actions
            </span>
            <span className="text-[9px] text-blue-400 uppercase tracking-wider group-hover:underline">
              Inspect Protocols
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

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

  // ✅ FIXED: Use blue theme only
  const getScoreColor = (score: number) => {
    return "text-blue-400"; // All blue
  };

  const getScoreBg = (score: number) => {
    return "bg-blue-500/10"; // All blue
  };

  const getScoreBorder = (score: number) => {
    return "border-blue-500/20"; // All blue
  };

  const CIRCUMFERENCE = 364;

  return (
    <div className="lg:col-span-3 min-h-full">
      <div
        className={`h-full border rounded-lg p-4 flex flex-col items-center justify-center space-y-3 transition-all duration-700 ${getScoreBg(score)} ${getScoreBorder(score)}`}
      >
        <h4 className="text-[10px] text-slate-500 uppercase tracking-wider text-center">
          Discrepancy Severity
        </h4>

        <div className="relative flex items-center justify-center w-24 h-24">
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
              strokeWidth="6"
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-1000 ease-out text-blue-500"
              style={{
                strokeDasharray: CIRCUMFERENCE,
                strokeDashoffset: CIRCUMFERENCE - CIRCUMFERENCE * score,
              }}
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className={`text-xl leading-none ${getScoreColor(score)}`}>
              {Math.round(score * 100)}%
            </span>
            <span className="text-[8px] text-slate-500 uppercase tracking-wider mt-1">
              Conflict
            </span>
          </div>
        </div>

        <p
          className={`text-[9px] uppercase tracking-wider px-2 py-0.5 rounded border ${getScoreColor(score)} ${getScoreBorder(score)}`}
        >
          {severity} Alert
        </p>
      </div>
    </div>
  );
};
