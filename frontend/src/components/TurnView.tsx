"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Turn } from "@/lib/chat-store";
import { Pipeline } from "@/components/Pipeline";
import { ReportCard } from "@/components/ReportCard";

const WAITING_LABEL: Record<string, string> = {
  revise: "Updating the report…",
  answer: "Thinking…",
};

/** One rendered chat turn: the user's message plus the assistant's output. */
export function TurnView({ turn }: { turn: Turn }) {
  // Between sending and the router's verdict there is nothing to show yet.
  const waiting =
    turn.status === "running" && turn.steps.length === 0 && !turn.answer && !turn.report;

  return (
    <div className="mb-10 animate-fade-in">
      <div className="flex justify-end mb-6">
        <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-br-md bg-accent text-white text-sm whitespace-pre-wrap break-words">
          {turn.query}
        </div>
      </div>

      {waiting && (
        <div className="flex items-center gap-2 text-sm text-muted mb-6">
          <span className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          {(turn.kind && WAITING_LABEL[turn.kind]) ?? "Working…"}
        </div>
      )}

      {turn.steps.length > 0 && <Pipeline steps={turn.steps} />}

      {turn.answer && (
        <div className="mb-2 max-w-[90%] rounded-2xl rounded-bl-md border border-card-border bg-card px-4 py-3 report-content text-sm">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{turn.answer}</ReactMarkdown>
        </div>
      )}

      {turn.error && (
        <div className="mb-6 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {turn.error}
        </div>
      )}

      {turn.report && (
        <ReportCard report={turn.report} createdAt={turn.createdAt} revised={turn.kind === "revise"} />
      )}
    </div>
  );
}
