"use client";

import { IconBeaker } from "@/components/icons";

const SUGGESTIONS = [
  "Latest advances in quantum computing",
  "Impact of AI on healthcare",
  "Sustainable energy solutions",
];

/** Shown when the active chat has no turns yet. */
export function EmptyState({ onPick }: { onPick: (query: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-6 text-accent">
        <IconBeaker className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-semibold text-foreground mb-2">
        What would you like to research?
      </h2>
      <p className="text-muted text-center max-w-md">
        Ask any research question. Multiple AI agents will collaborate to search the web, analyze
        documents, and synthesize a report. Then it answers follow-ups and refines it.
      </p>
      <div className="flex gap-2 mt-8 flex-wrap justify-center">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => onPick(suggestion)}
            className="px-4 py-2 rounded-full border border-card-border bg-card text-sm text-muted hover:text-foreground hover:border-accent/50 transition-all cursor-pointer"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}
