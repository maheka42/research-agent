"use client";

import { IconPaperclip } from "@/components/icons";

const ACCEPTED_FILES = ".pdf,.txt,.md,.csv";

/** The message box: query text, optional file attachments, and send. */
export function Composer({
  query,
  files,
  busy,
  onQueryChange,
  onFilesChange,
  onSend,
}: {
  query: string;
  files: File[];
  busy: boolean;
  onQueryChange: (value: string) => void;
  onFilesChange: (files: File[]) => void;
  onSend: () => void;
}) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Enter sends; Shift+Enter is a newline.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="border-t border-card-border bg-card/80 backdrop-blur-sm px-6 py-4">
      <div className="max-w-4xl mx-auto flex gap-3 items-end">
        <textarea
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question, request a report, or refine it…"
          rows={1}
          disabled={busy}
          className="flex-1 px-4 py-3 rounded-xl border border-card-border bg-background text-foreground placeholder-muted resize-none focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25 transition-all disabled:opacity-50"
        />

        <label className="flex items-center gap-2 px-4 py-3 rounded-xl border border-card-border bg-background text-muted hover:text-foreground hover:border-accent/50 transition-all cursor-pointer text-sm shrink-0">
          <IconPaperclip />
          <span className="hidden sm:inline">
            {files.length > 0 ? `${files.length} file(s)` : "Files"}
          </span>
          <input
            type="file"
            multiple
            accept={ACCEPTED_FILES}
            // Clearing on open means re-picking the same file still fires
            // onChange, which it otherwise would not after a send.
            onClick={(e) => {
              (e.target as HTMLInputElement).value = "";
            }}
            onChange={(e) => onFilesChange(Array.from(e.target.files ?? []))}
            className="hidden"
            disabled={busy}
          />
        </label>

        <button
          onClick={onSend}
          disabled={!query.trim() || busy}
          className="px-6 py-3 rounded-xl bg-accent text-white font-medium hover:bg-accent-light transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0 cursor-pointer"
        >
          {busy ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Working
            </span>
          ) : (
            "Send"
          )}
        </button>
      </div>
    </div>
  );
}
