"use client";

/**
 * Client-side chat store.
 *
 * Chat history lives in a module-level object rather than component state so it
 * survives reloads (persisted to localStorage) and can be mutated from anywhere
 * (the composer, the sidebar menu) without prop drilling. Components read it
 * through `useChatStore`, which wraps `useSyncExternalStore`: the server
 * snapshot is empty and the real value is read on the client, so this
 * client-only data never triggers a hydration mismatch.
 */

import { useSyncExternalStore } from "react";

import { AgentStep, settleSteps } from "@/lib/agent-steps";

/**
 * One chat turn: the user's message plus whatever the assistant produced for it.
 * A turn's `kind` is decided by the backend router. A `research` turn runs the
 * agent pipeline into a `report`, an `answer` turn is a conversational `answer`,
 * and a `revise` turn replaces the `report` with an edited version.
 */
export interface Turn {
  id: string;
  query: string;
  kind?: "research" | "answer" | "revise";
  steps: AgentStep[];
  answer: string;
  report: string;
  error: string;
  status: "running" | "done" | "failed";
  createdAt: number;
}

/** A saved chat session: a titled thread of turns, shown as one sidebar entry. */
export interface Chat {
  id: string;
  title: string;
  turns: Turn[];
  pinned?: boolean;
  archived?: boolean;
  createdAt: number;
  updatedAt: number;
}

interface StoreState {
  chats: Chat[];
  activeChatId: string | null;
}

const STORAGE_KEY = "research-chats";
const TITLE_MAX = 60;

/** A live run fires many updates a second; batch the writes behind them. */
const PERSIST_DELAY_MS = 300;

const EMPTY_STATE: StoreState = { chats: [], activeChatId: null };
const listeners = new Set<() => void>();

function uid(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readStorage(): StoreState {
  if (typeof window === "undefined") return EMPTY_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;

    const parsed = JSON.parse(raw) as StoreState;
    const chats = (parsed.chats ?? []).map((chat) => ({
      ...chat,
      // A run that was mid-stream when the page unloaded can't resume. Its live
      // connection is gone, so surface it as interrupted rather than "running".
      turns: (chat.turns ?? []).map((t) =>
        t.status === "running"
          ? {
              ...t,
              status: "failed" as const,
              steps: settleSteps(t.steps, "failed"),
              error: t.error || "Interrupted. The page was reloaded mid-research.",
            }
          : t
      ),
    }));

    const activeChatId =
      parsed.activeChatId && chats.some((c) => c.id === parsed.activeChatId)
        ? parsed.activeChatId
        : chats[0]?.id ?? null;

    return { chats, activeChatId };
  } catch {
    return EMPTY_STATE;
  }
}

let store: StoreState = readStorage();
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function writeStorage() {
  persistTimer = null;
  if (typeof window === "undefined") return;
  try {
    if (store.chats.length === 0) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Quota and availability failures are non-fatal for the live session.
  }
}

function schedulePersist() {
  if (typeof window === "undefined" || persistTimer !== null) return;
  persistTimer = setTimeout(writeStorage, PERSIST_DELAY_MS);
}

// Don't lose the last few hundred milliseconds of a run when the tab goes away.
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    if (persistTimer !== null) {
      clearTimeout(persistTimer);
      writeStorage();
    }
  });
}

function setStore(next: StoreState) {
  store = next;
  schedulePersist();
  listeners.forEach((notify) => notify());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Subscribe a component to the chat store. */
export function useChatStore(): StoreState {
  return useSyncExternalStore(subscribe, () => store, () => EMPTY_STATE);
}

/** The most recent non-archived chat, or null. The fallback when focus is lost. */
function firstOpenChatId(chats: Chat[]): string | null {
  const open = chats.filter((c) => !c.archived).sort((a, b) => b.updatedAt - a.updatedAt);
  return open[0]?.id ?? null;
}

/** Create an empty chat and make it active. Returns the new chat's id. */
export function createChat(): string {
  const now = Date.now();
  const chat: Chat = { id: uid(), title: "New chat", turns: [], createdAt: now, updatedAt: now };
  setStore({ chats: [chat, ...store.chats], activeChatId: chat.id });
  return chat.id;
}

export function selectChat(id: string) {
  if (id === store.activeChatId) return;
  setStore({ ...store, activeChatId: id });
}

export function deleteChat(id: string) {
  const chats = store.chats.filter((c) => c.id !== id);
  const activeChatId = store.activeChatId === id ? firstOpenChatId(chats) : store.activeChatId;
  setStore({ chats, activeChatId });
}

export function renameChat(id: string, title: string) {
  const next = title.trim();
  if (!next) return;
  setStore({
    ...store,
    chats: store.chats.map((c) => (c.id === id ? { ...c, title: next.slice(0, TITLE_MAX) } : c)),
  });
}

export function togglePinned(id: string) {
  setStore({
    ...store,
    chats: store.chats.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c)),
  });
}

/** Archive or unarchive; if the active chat is being archived, move focus off it. */
export function toggleArchived(id: string) {
  const chats = store.chats.map((c) => (c.id === id ? { ...c, archived: !c.archived } : c));
  const target = chats.find((c) => c.id === id);
  const activeChatId =
    target?.archived && store.activeChatId === id ? firstOpenChatId(chats) : store.activeChatId;
  setStore({ chats, activeChatId });
}

export function newTurn(query: string): Turn {
  // Steps stay empty until the router says this is a research turn. Otherwise
  // an answer or a report edit would render a bogus pipeline.
  return {
    id: uid(),
    query,
    steps: [],
    answer: "",
    report: "",
    error: "",
    status: "running",
    createdAt: Date.now(),
  };
}

/** Append a turn to a chat, titling the chat from its first question. */
export function addTurn(chatId: string, turn: Turn) {
  setStore({
    ...store,
    chats: store.chats.map((c) =>
      c.id === chatId
        ? {
            ...c,
            title: c.turns.length === 0 ? turn.query.slice(0, TITLE_MAX) : c.title,
            turns: [...c.turns, turn],
            updatedAt: Date.now(),
          }
        : c
    ),
  });
}

export function updateTurn(chatId: string, turnId: string, updater: (t: Turn) => Turn) {
  setStore({
    ...store,
    chats: store.chats.map((c) =>
      c.id === chatId
        ? {
            ...c,
            turns: c.turns.map((t) => (t.id === turnId ? updater(t) : t)),
            updatedAt: Date.now(),
          }
        : c
    ),
  });
}
