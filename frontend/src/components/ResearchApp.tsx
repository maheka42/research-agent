"use client";

import { useEffect, useRef, useState } from "react";

import { initialSteps, applyAgentUpdate, settleSteps } from "@/lib/agent-steps";
import { StreamEvent, streamTurn } from "@/lib/research-client";
import {
  Turn,
  addTurn,
  createChat,
  newTurn,
  updateTurn,
  useChatStore,
} from "@/lib/chat-store";
import { Composer } from "@/components/Composer";
import { EmptyState } from "@/components/EmptyState";
import { Sidebar } from "@/components/Sidebar";
import { TurnView } from "@/components/TurnView";
import { IconBeaker, IconMenu } from "@/components/icons";

/** Fold one backend event into the turn it belongs to. */
function applyEvent(chatId: string, turnId: string, { type, data }: StreamEvent) {
  const patch = (updater: (t: Turn) => Turn) => updateTurn(chatId, turnId, updater);

  switch (type) {
    case "intent": {
      const kind = data.action as Turn["kind"];
      return patch((t) => ({
        ...t,
        kind,
        // Seed the pipeline so the orchestrator node shows immediately, before
        // the first agent_update arrives. Non-research turns stay pipeline-free.
        steps: kind === "research" ? initialSteps() : t.steps,
      }));
    }
    case "agent_update":
      return patch((t) => ({
        ...t,
        steps: applyAgentUpdate(t.steps, data),
        report: data.agent === "synthesizer" && data.report ? (data.report as string) : t.report,
      }));
    case "message":
      return patch((t) => ({ ...t, answer: data.content as string }));
    case "report":
      return patch((t) => ({ ...t, report: data.report as string }));
    case "error":
      return patch((t) => ({
        ...t,
        error: data.message as string,
        status: "failed",
        steps: settleSteps(t.steps, "failed"),
      }));
    case "complete":
      return patch((t) => ({ ...t, status: "done", steps: settleSteps(t.steps, "done") }));
  }
}

export default function ResearchApp() {
  const { chats, activeChatId } = useChatStore();
  const [query, setQuery] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeChat = chats.find((c) => c.id === activeChatId) ?? null;
  const turns = activeChat?.turns ?? [];
  const isBusy = turns.some((t) => t.status === "running");

  // Keep the newest turn in view as the active chat's history grows.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [activeChatId, turns.length]);

  const sendMessage = async () => {
    const message = query.trim();
    if (!message || isBusy) return;

    // Snapshot the prior turns as chat context *before* adding the new one, so
    // the backend router can tell a follow-up from a fresh research request.
    const priorTurns = activeChat?.turns ?? [];
    const history = priorTurns.flatMap((t) => {
      const reply = t.report || t.answer;
      return reply
        ? [
            { role: "user", content: t.query },
            { role: "assistant", content: reply },
          ]
        : [{ role: "user", content: t.query }];
    });
    const currentReport = [...priorTurns].reverse().find((t) => t.report)?.report ?? "";

    // Route the turn into the current chat, opening a fresh one if none is active.
    const chatId = activeChatId ?? createChat();
    const turn = newTurn(message);
    const attachments = files;

    addTurn(chatId, turn);
    setQuery("");
    setFiles([]);

    try {
      await streamTurn({ message, history, currentReport, files: attachments }, (event) =>
        applyEvent(chatId, turn.id, event)
      );
    } catch (e) {
      updateTurn(chatId, turn.id, (t) => ({
        ...t,
        error: e instanceof Error ? e.message : "The request failed",
        status: "failed",
        steps: settleSteps(t.steps, "failed"),
      }));
    }
  };

  return (
    <div className="flex h-screen">
      <Sidebar
        chats={chats}
        activeChatId={activeChatId}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex flex-col flex-1 min-w-0">
        <header className="border-b border-card-border bg-card/50 backdrop-blur-sm px-6 py-4">
          <div className="max-w-4xl mx-auto flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden -ml-1 p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-card transition-colors cursor-pointer"
              aria-label="Open chat history"
            >
              <IconMenu />
            </button>
            <div className="w-9 h-9 rounded-lg bg-accent/20 flex items-center justify-center text-accent">
              <IconBeaker />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Research Assistant</h1>
              <p className="text-xs text-muted">Multi-agent AI research powered by LangGraph</p>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-6 py-8">
            {turns.length === 0 ? (
              <EmptyState onPick={setQuery} />
            ) : (
              turns.map((turn) => <TurnView key={turn.id} turn={turn} />)
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        <Composer
          query={query}
          files={files}
          busy={isBusy}
          onQueryChange={setQuery}
          onFilesChange={setFiles}
          onSend={sendMessage}
        />
      </div>
    </div>
  );
}
