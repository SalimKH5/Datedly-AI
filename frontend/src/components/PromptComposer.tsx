"use client";

import { useState } from "react";
import { ChevronDown, Loader2, Sparkles, Wand2 } from "lucide-react";
import { api, type GenerateInput } from "@/lib/api";

const EXAMPLES = [
  "A 24-day MMA Advent calendar with daily challenges, quizzes, historical facts and discoveries",
  "A 30-day beginner fitness calendar with daily activities and short lessons",
  "A 14-day Python course, from fundamentals to advanced concepts",
  "A 7-day travel discovery calendar for Paris",
  "A 12-month marketing calendar for a small bakery",
];

const LANGUAGES = [
  ["", "Same as my prompt"],
  ["en", "English"],
  ["fr", "Français"],
  ["es", "Español"],
  ["de", "Deutsch"],
  ["it", "Italiano"],
  ["pt", "Português"],
];

export function PromptComposer({
  aiReady,
  model,
  busy,
  onStarted,
}: {
  aiReady: boolean;
  model: string | null;
  busy: boolean;
  onStarted: (jobId: string) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [count, setCount] = useState("");
  const [start, setStart] = useState("");
  const [language, setLanguage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tooShort = prompt.trim().length < 8;
  const disabled = !aiReady || busy || sending || tooShort;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (disabled) return;
    setError(null);
    setSending(true);
    const input: GenerateInput = { prompt: prompt.trim() };
    if (count) input.entry_count = Number(count);
    if (start) input.start_date = start;
    if (language) input.language = language;
    try {
      const { job_id } = await api.generate(input);
      onStarted(job_id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} id="create" aria-labelledby="create-title" className="glass rounded-[2rem] p-6 sm:p-8">
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
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(e);
        }}
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

      <button
        type="button"
        onClick={() => setAdvanced(!advanced)}
        aria-expanded={advanced}
        className="mt-5 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
      >
        Advanced settings
        <ChevronDown size={16} className={`transition-transform ${advanced ? "rotate-180" : ""}`} />
      </button>
      {advanced && (
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <label className="text-sm text-muted">
            Number of entries
            <input
              type="number"
              min={1}
              max={60}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              placeholder="Auto"
              className="mt-1.5 w-full rounded-2xl border border-line bg-black/30 px-4 py-2.5 text-ink"
            />
          </label>
          <label className="text-sm text-muted">
            Start date
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="mt-1.5 w-full rounded-2xl border border-line bg-black/30 px-4 py-2.5 text-ink"
            />
          </label>
          <label className="text-sm text-muted">
            Language
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="mt-1.5 w-full rounded-2xl border border-line bg-black/30 px-4 py-2.5 text-ink"
            >
              {LANGUAGES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">
          {!aiReady
            ? "Connect Ollama to enable generation."
            : busy
              ? "A calendar is being generated…"
              : (
                <>
                  Model <span className="text-ink">{model}</span> · up to 60 entries · Ctrl+Enter
                </>
              )}
        </p>
        <button
          type="submit"
          disabled={disabled}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-accent px-6 py-3 font-medium text-white
                     shadow-lg shadow-violet-900/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {sending ? <Loader2 size={18} className="animate-spin" /> : <Wand2 size={18} />} Generate calendar
        </button>
      </div>
    </form>
  );
}
