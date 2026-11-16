"use client";

import { useState } from "react";
import { Sparkles, Wand2 } from "lucide-react";

const EXAMPLES = [
  "A 24-day MMA Advent calendar with daily challenges, quizzes, historical facts and discoveries",
  "A 30-day beginner fitness calendar with daily activities and short lessons",
  "A 14-day Python course, from fundamentals to advanced concepts",
  "A 7-day travel discovery calendar for Paris",
  "A 12-month marketing calendar for a small bakery",
];

export function PromptComposer({ aiReady, model }: { aiReady: boolean; model: string | null }) {
  const [prompt, setPrompt] = useState("");

  return (
    <section id="create" aria-labelledby="create-title" className="glass rounded-[2rem] p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-accent/20 text-accent-2">
          <Sparkles size={20} />
        </span>
        <div>
          <h2 id="create-title" className="text-xl font-medium">
            Create a calendar
          </h2>
          <p className="text-sm text-muted">Describe your idea. The AI plans and writes every entry.</p>
        </div>
      </div>

      <label htmlFor="prompt" className="sr-only">
        Your calendar idea
      </label>
      <textarea
        id="prompt"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        maxLength={2000}
        rows={5}
        placeholder="e.g. A Christmas calendar for 8-year-olds with stories, puzzles and a small activity every day…"
        className="mt-6 w-full resize-y rounded-3xl border border-line bg-black/20 p-5 text-lg leading-relaxed
                   placeholder:text-faint focus:border-accent/60 focus:outline-none"
      />

      <div className="mt-4 flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => setPrompt(ex)}
            className="rounded-full border border-line px-3.5 py-1.5 text-left text-sm text-muted transition-colors
                       hover:border-accent/50 hover:text-ink"
          >
            {ex.length > 46 ? ex.slice(0, 44) + "…" : ex}
          </button>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">
          {aiReady ? (
            <>
              Model <span className="text-ink">{model}</span> · AI generation arrives in the next phase.
            </>
          ) : (
            "Connect Ollama to enable generation."
          )}
        </p>
        <button
          type="button"
          disabled
          title="Available in phase 2"
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-accent px-6 py-3 font-medium text-white
                     shadow-lg shadow-violet-900/40 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Wand2 size={18} /> Generate calendar
        </button>
      </div>
    </section>
  );
}
