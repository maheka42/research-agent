/**
 * Reconstructs the agent pipeline from the backend's event stream.
 *
 * The graph loops back through the orchestrator, so the chain is built forward
 * from the events as they arrive rather than mapped onto a fixed list of stages.
 * A repeated orchestrator becomes another link instead of rewinding to the
 * start. This module is pure state logic; the rendering lives in Pipeline.tsx.
 */

export interface AgentStep {
  agent: string;
  status: "running" | "done" | "failed";
  plan?: string;
  next_agent?: string;
  reasoning?: string;
  findings_count?: number;
  findings?: string[];
  report?: string;
}

const SPECIALISTS = ["web_researcher", "document_analyst", "synthesizer"];

export const STAGE_META: Record<string, { label: string; description: string }> = {
  orchestrator: { label: "Orchestrator", description: "Planning research strategy" },
  web_researcher: { label: "Web Researcher", description: "Searching the web for findings" },
  document_analyst: { label: "Document Analyst", description: "Analyzing uploaded documents" },
  synthesizer: { label: "Synthesizer", description: "Generating final report" },
};

/** The graph always enters at the orchestrator (see graph.py set_entry_point). */
export const initialSteps = (): AgentStep[] => [{ agent: "orchestrator", status: "running" }];

/** Which node the graph runs after `step`, mirroring the edges in graph.py. */
function successorOf(step: AgentStep): string | null {
  if (step.agent === "synthesizer") return null;
  if (step.agent !== "orchestrator") return "orchestrator";
  return step.next_agent && SPECIALISTS.includes(step.next_agent)
    ? step.next_agent
    : "synthesizer";
}

export function describeStep(step: AgentStep): string {
  const meta = STAGE_META[step.agent];
  if (step.status !== "done") return meta?.description ?? "Working";

  switch (step.agent) {
    case "orchestrator":
      return step.plan || meta.description;
    case "web_researcher":
      return `Gathered ${step.findings_count ?? 0} finding(s) from web search`;
    case "document_analyst":
      return `Analyzed documents, ${step.findings_count ?? 0} finding(s)`;
    case "synthesizer":
      return "Final report generated";
    default:
      return meta?.description ?? "";
  }
}

/**
 * Fold an `agent_update` into the chain. The graph streams a node's update once
 * that node has finished, so the event completes a step rather than starting
 * one. The agent it hands off to is appended as the newly running step.
 */
export function applyAgentUpdate(prev: AgentStep[], data: Record<string, unknown>): AgentStep[] {
  const completed: AgentStep = {
    agent: data.agent as string,
    status: "done",
    plan: data.plan as string | undefined,
    next_agent: data.next_agent as string | undefined,
    reasoning: data.reasoning as string | undefined,
    findings_count: data.findings_count as number | undefined,
    findings: data.findings as string[] | undefined,
    report: data.report as string | undefined,
  };

  // Only the tail is ever a prediction. Everything before it is confirmed by an
  // event. If the prediction was wrong, drop it rather than reporting work that
  // never ran, and append the real agent instead of rewinding to it.
  const last = prev[prev.length - 1];
  const confirmed = last?.status === "running" ? prev.slice(0, -1) : prev;
  const next = [...confirmed, completed];

  const upcoming = successorOf(completed);
  if (upcoming) next.push({ agent: upcoming, status: "running" });
  return next;
}

/** Resolve any still-running step once the turn has ended. */
export function settleSteps(prev: AgentStep[], status: "done" | "failed"): AgentStep[] {
  return prev.map((s) => (s.status === "running" ? { ...s, status } : s));
}
