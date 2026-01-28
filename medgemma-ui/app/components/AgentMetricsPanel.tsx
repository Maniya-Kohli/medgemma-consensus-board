// import React from "react";
// import { Activity, Clock, CheckCircle, XCircle } from "lucide-react";
// import { AnalysisResult } from "../types";

// interface AgentMetricsPanelProps {
//   analysisResult: AnalysisResult;
// }

// export const AgentMetricsPanel: React.FC<AgentMetricsPanelProps> = ({
//   analysisResult,
// }) => {
//   if (
//     !analysisResult?.agent_reports ||
//     analysisResult.agent_reports.length === 0
//   ) {
//     return null;
//   }

//   const totalExecutionTime = analysisResult.agent_reports.reduce(
//     (sum, report: any) => {
//       const timeStr = report.execution_time || "0s";
//       const time = parseFloat(timeStr.replace("s", ""));
//       return sum + (isNaN(time) ? 0 : time);
//     },
//     0,
//   );

//   const successfulAgents = analysisResult.agent_reports.filter(
//     (r: any) => r.success || r.analysis_status === "complete",
//   ).length;

//   return (
//     <div className="bg-[#151b26] border border-[#2a3441] rounded-xl p-5 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-500">
//       <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#2a3441]">
//         <div className="flex items-center gap-2">
//           <Activity className="w-4 h-4 text-blue-400" />
//           <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
//             Agent Performance Metrics
//           </h4>
//         </div>
//         <div className="flex items-center gap-2 px-3 py-1 bg-blue-500/10 rounded-lg border border-blue-500/20">
//           <span className="text-xs font-bold text-blue-400">
//             {successfulAgents}/{analysisResult.agent_reports.length}
//           </span>
//           <span className="text-[9px] text-blue-300/60 uppercase">success</span>
//         </div>
//       </div>

//       <div className="space-y-3">
//         {analysisResult.agent_reports.map((report: any, i: number) => {
//           const isSuccess =
//             report.success || report.analysis_status === "complete";
//           const executionTime = report.execution_time || "0s";
//           const agentIcon = report.icon || "🤖";

//           return (
//             <div
//               key={i}
//               className={`
//                 flex items-center justify-between p-4 rounded-lg border transition-all duration-300
//                 ${
//                   isSuccess
//                     ? "bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40"
//                     : "bg-rose-500/5 border-rose-500/20 hover:border-rose-500/40"
//                 }
//                 animate-in fade-in slide-in-from-left-2
//               `}
//               style={{ animationDelay: `${i * 0.1}s` }}
//             >
//               <div className="flex items-center gap-3">
//                 <div className="w-10 h-10 rounded-xl bg-[#0a0e14] flex items-center justify-center text-xl border border-[#2a3441]">
//                   {agentIcon}
//                 </div>
//                 <div>
//                   <p className="text-xs font-bold text-white capitalize">
//                     {report.agent_name || report.agent || "Unknown Agent"}
//                   </p>
//                   <p className="text-[10px] text-slate-500 mt-0.5">
//                     {report.model || "Unknown Model"}
//                   </p>
//                 </div>
//               </div>

//               <div className="flex items-center gap-4">
//                 <div className="text-right">
//                   <div className="flex items-center gap-1.5 mb-0.5">
//                     <Clock className="w-3 h-3 text-slate-500" />
//                     <span className="text-[9px] text-slate-500 uppercase tracking-wider">
//                       Time
//                     </span>
//                   </div>
//                   <p className="text-xs font-bold text-blue-400">
//                     {executionTime}
//                   </p>
//                 </div>

//                 {report.claims && report.claims.length > 0 && (
//                   <div className="text-right">
//                     <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-0.5">
//                       Claims
//                     </p>
//                     <p className="text-xs font-bold text-purple-400">
//                       {report.claims.length}
//                     </p>
//                   </div>
//                 )}

//                 <div className="text-right min-w-[80px]">
//                   <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">
//                     Status
//                   </p>
//                   <div
//                     className={`
//                     flex items-center gap-1.5 text-xs font-bold
//                     ${isSuccess ? "text-emerald-400" : "text-rose-400"}
//                   `}
//                   >
//                     {isSuccess ? (
//                       <>
//                         <CheckCircle className="w-3.5 h-3.5" />
//                         <span>Complete</span>
//                       </>
//                     ) : (
//                       <>
//                         <XCircle className="w-3.5 h-3.5" />
//                         <span>Failed</span>
//                       </>
//                     )}
//                   </div>
//                 </div>
//               </div>
//             </div>
//           );
//         })}
//       </div>

//       <div className="mt-4 pt-4 border-t border-[#2a3441] grid grid-cols-3 gap-4">
//         <div className="text-center p-3 bg-blue-500/5 rounded-lg border border-blue-500/10">
//           <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">
//             Total Time
//           </p>
//           <p className="text-sm font-bold text-blue-400">
//             {totalExecutionTime.toFixed(2)}s
//           </p>
//         </div>

//         <div className="text-center p-3 bg-emerald-500/5 rounded-lg border border-emerald-500/10">
//           <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">
//             Success Rate
//           </p>
//           <p className="text-sm font-bold text-emerald-400">
//             {Math.round(
//               (successfulAgents / analysisResult.agent_reports.length) * 100,
//             )}
//             %
//           </p>
//         </div>

//         <div className="text-center p-3 bg-purple-500/5 rounded-lg border border-purple-500/10">
//           <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">
//             Agents Run
//           </p>
//           <p className="text-sm font-bold text-purple-400">
//             {analysisResult.agent_reports.length}
//           </p>
//         </div>
//       </div>

//       {analysisResult.moderator_metadata && (
//         <div className="mt-4 p-3 bg-[#0a0e14] rounded-lg border border-[#2a3441]">
//           <div className="flex items-center gap-2 mb-2">
//             <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
//             <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">
//               Moderator Analytics
//             </span>
//           </div>

//           <div className="grid grid-cols-2 gap-2 text-[10px]">
//             {analysisResult.moderator_metadata.total_iterations && (
//               <div className="flex justify-between">
//                 <span className="text-slate-500">Iterations:</span>
//                 <span className="text-slate-300 font-bold">
//                   {analysisResult.moderator_metadata.total_iterations}
//                 </span>
//               </div>
//             )}

//             {analysisResult.moderator_metadata.focus_areas &&
//               analysisResult.moderator_metadata.focus_areas.length > 0 && (
//                 <div className="col-span-2 flex justify-between">
//                   <span className="text-slate-500">Focus Areas:</span>
//                   <span className="text-blue-400 font-bold text-[9px]">
//                     {analysisResult.moderator_metadata.focus_areas.join(", ")}
//                   </span>
//                 </div>
//               )}
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

import React from "react";
import { Activity, Clock, CheckCircle, XCircle } from "lucide-react";
import { AnalysisResult } from "../types";

interface AgentMetricsPanelProps {
  analysisResult: AnalysisResult;
}

export const AgentMetricsPanel: React.FC<AgentMetricsPanelProps> = ({
  analysisResult,
}) => {
  if (
    !analysisResult?.agent_reports ||
    analysisResult.agent_reports.length === 0
  ) {
    return null;
  }

  const totalExecutionTime = analysisResult.agent_reports.reduce(
    (sum, report: any) => {
      const timeStr = report.execution_time || "0s";
      const time = parseFloat(timeStr.replace("s", ""));
      return sum + (isNaN(time) ? 0 : time);
    },
    0,
  );

  const successfulAgents = analysisResult.agent_reports.filter(
    (r: any) => r.success || r.analysis_status === "complete",
  ).length;

  return (
    <div className="bg-[#151b26] border border-[#2a3441] rounded-lg p-4">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#2a3441]">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-400" />
          <h4 className="text-[10px] text-slate-400 uppercase tracking-wider">
            Agent Performance Metrics
          </h4>
        </div>
        <div className="flex items-center gap-2 px-2.5 py-1 bg-blue-500/10 rounded border border-blue-500/20">
          <span className="text-xs text-blue-400">
            {successfulAgents}/{analysisResult.agent_reports.length}
          </span>
          <span className="text-[9px] text-blue-400 uppercase tracking-wider">
            success
          </span>
        </div>
      </div>

      <div className="space-y-2.5">
        {analysisResult.agent_reports.map((report: any, i: number) => {
          const isSuccess =
            report.success || report.analysis_status === "complete";
          const executionTime = report.execution_time || "0s";
          const agentIcon = report.icon || "🤖";

          return (
            <div
              key={i}
              className={`
                flex items-center justify-between p-3 rounded-md border transition-all
                ${
                  isSuccess
                    ? "bg-blue-500/5 border-blue-500/20 hover:border-blue-500/30"
                    : "bg-slate-500/5 border-slate-500/20 hover:border-slate-500/30"
                }
              `}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-[#0a0e14] flex items-center justify-center text-base border border-[#2a3441]">
                  {agentIcon}
                </div>
                <div>
                  <p className="text-xs text-white">
                    {report.agent_name || report.agent || "Unknown Agent"}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {report.model || "Unknown Model"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="flex items-center gap-1 mb-0.5">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span className="text-[9px] text-slate-500 uppercase tracking-wider">
                      Time
                    </span>
                  </div>
                  <p className="text-xs text-blue-400">{executionTime}</p>
                </div>

                {report.claims && report.claims.length > 0 && (
                  <div className="text-right">
                    <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-0.5">
                      Claims
                    </p>
                    <p className="text-xs text-blue-400">
                      {report.claims.length}
                    </p>
                  </div>
                )}

                <div className="text-right min-w-[80px]">
                  <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">
                    Status
                  </p>
                  <div
                    className={`
                    flex items-center gap-1.5 text-xs
                    ${isSuccess ? "text-blue-400" : "text-slate-500"}
                  `}
                  >
                    {isSuccess ? (
                      <>
                        <CheckCircle className="w-3 h-3" />
                        <span>Complete</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3 h-3" />
                        <span>Failed</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-[#2a3441] grid grid-cols-3 gap-3">
        <div className="text-center p-2.5 bg-blue-500/5 rounded-md border border-blue-500/10">
          <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">
            Total Time
          </p>
          <p className="text-sm text-blue-400">
            {totalExecutionTime.toFixed(2)}s
          </p>
        </div>

        <div className="text-center p-2.5 bg-blue-500/5 rounded-md border border-blue-500/10">
          <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">
            Success Rate
          </p>
          <p className="text-sm text-blue-400">
            {Math.round(
              (successfulAgents / analysisResult.agent_reports.length) * 100,
            )}
            %
          </p>
        </div>

        <div className="text-center p-2.5 bg-blue-500/5 rounded-md border border-blue-500/10">
          <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">
            Agents Run
          </p>
          <p className="text-sm text-blue-400">
            {analysisResult.agent_reports.length}
          </p>
        </div>
      </div>

      {analysisResult.moderator_metadata && (
        <div className="mt-4 p-3 bg-[#0a0e14] rounded-md border border-[#2a3441]">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span className="text-[9px] text-blue-400 uppercase tracking-wider">
              Moderator Analytics
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px]">
            {analysisResult.moderator_metadata.total_iterations && (
              <div className="flex justify-between">
                <span className="text-slate-500">Iterations:</span>
                <span className="text-slate-300">
                  {analysisResult.moderator_metadata.total_iterations}
                </span>
              </div>
            )}

            {analysisResult.moderator_metadata.focus_areas &&
              analysisResult.moderator_metadata.focus_areas.length > 0 && (
                <div className="col-span-2 flex justify-between">
                  <span className="text-slate-500">Focus Areas:</span>
                  <span className="text-blue-400 text-[9px]">
                    {analysisResult.moderator_metadata.focus_areas.join(", ")}
                  </span>
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  );
};
