"use client";

import { AgentStep, STAGE_META, describeStep } from "@/lib/agent-steps";
import { STAGE_ICONS, IconCheck, IconOrchestrator, IconX } from "@/components/icons";

const TONE = {
  done: { text: "text-success", node: "bg-success/15 text-success ring-success/30", line: "bg-success/40" },
  failed: { text: "text-red-400", node: "bg-red-500/15 text-red-400 ring-red-500/30", line: "bg-red-500/40" },
  running: { text: "text-accent-light", node: "bg-accent/15 text-accent ring-accent/30", line: "bg-accent/30 pipeline-pulse" },
} as const;

/** The forward-only chain of agents for a single research run. */
export function Pipeline({ steps }: { steps: AgentStep[] }) {
  return (
    <ol className="mb-6">
      {steps.map((step, i) => {
        const Icon = STAGE_ICONS[step.agent] ?? IconOrchestrator;
        const tone = TONE[step.status];
        const isLast = i === steps.length - 1;

        return (
          <li key={i} className="relative flex gap-4 pb-5 last:pb-0 animate-fade-in">
            {/* Connector down to the next agent */}
            {!isLast && (
              <div
                className={`absolute left-5 top-11 bottom-1 w-0.5 rounded-full transition-colors duration-500 ${tone.line}`}
              />
            )}

            <div className="relative shrink-0">
              {step.status === "running" && (
                <div className="absolute -inset-1.5 rounded-full border-2 border-transparent border-t-accent animate-spin" />
              )}
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ring-2 transition-all duration-300 ${tone.node}`}
              >
                <Icon />
              </div>

              {/* Outcome badge, once the step has settled */}
              {step.status !== "running" && (
                <div
                  className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-background ${
                    step.status === "done" ? "bg-success text-background" : "bg-red-500 text-white"
                  }`}
                >
                  {step.status === "done" ? (
                    <IconCheck className="w-2.5 h-2.5" />
                  ) : (
                    <IconX className="w-2.5 h-2.5" />
                  )}
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1 pt-1">
              <div className="flex items-center gap-2">
                <span className={`font-medium text-sm ${tone.text}`}>
                  {STAGE_META[step.agent]?.label ?? step.agent}
                </span>
                {step.status === "running" && <span className="text-xs text-muted">running…</span>}
              </div>
              <p className="text-sm text-muted mt-0.5">{describeStep(step)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
