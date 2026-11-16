"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, Clock, Cpu, X } from "lucide-react";
import { api, type Calendar, type Entry } from "@/lib/api";
import { themeStyle } from "@/lib/themes";
import { EntryContent } from "@/components/EntryContent";

function formatDate(iso: string, opts: Intl.DateTimeFormatOptions, lang: string) {
  try {
    return new Date(`${iso}T12:00:00Z`).toLocaleDateString(lang, { timeZone: "UTC", ...opts });
  } catch {
    return iso;
  }
}

function EntryDialog({ entry, lang, onClose }: { entry: Entry; lang: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <article
        role="dialog"
        aria-modal="true"
        aria-labelledby="entry-title"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-[2rem] border border-line bg-[#120f2e] p-6 sm:rounded-[2rem] sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-accent-2">
              #{entry.index} · {formatDate(entry.date, { weekday: "long", day: "numeric", month: "long" }, lang)} ·{" "}
              {entry.content_type}
            </p>
            <h2 id="entry-title" className="mt-1 text-2xl font-medium">
              {entry.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            autoFocus
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted hover:bg-surface-strong hover:text-ink"
          >
            <X size={20} />
          </button>
        </div>
        {entry.metadata.needs_review === true && (
          <p className="mt-4 rounded-2xl border border-warn/40 bg-warn/10 px-4 py-2 text-sm text-warn">
            This entry could not be fully written. It will be editable in the next phase.
          </p>
        )}
        <div className="mt-6">
          {entry.blocks.length ? <EntryContent blocks={entry.blocks} /> : <p className="text-muted">No content yet.</p>}
        </div>
      </article>
    </div>
  );
}

function CalendarView() {
  const params = useSearchParams();
  const id = params.get("id");
  const [cal, setCal] = useState<Calendar | null>(null);
  const [error, setError] = useState<string | null>(null);
  // `&entry=N` opens an entry directly (handy for sharing and checks).
  const [openIndex, setOpenIndex] = useState<number | null>(() => Number(params.get("entry")) || null);

  useEffect(() => {
    if (!id) return;
    api.getCalendar(id).then(setCal, (e: Error) => setError(e.message));
  }, [id]);

  if (!id || error)
    return (
      <div className="glass mx-auto mt-20 max-w-md rounded-[2rem] p-8 text-center">
        <p className="font-medium">{error ?? "No calendar selected."}</p>
        <Link href="/" className="mt-4 inline-block text-accent-2 hover:underline">
          Back to the studio
        </Link>
      </div>
    );
  if (!cal)
    return (
      <div className="mx-auto grid max-w-6xl gap-4 px-4 pt-24 sm:grid-cols-4" aria-busy>
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="glass h-36 animate-pulse rounded-3xl" />
        ))}
      </div>
    );

  const lang = cal.language || "en";
  const open = cal.entries.find((e) => e.index === openIndex) ?? null;
  const gen = cal.generation;
  // Group entries by the plan's sections; entries outside any section go last.
  const sections = [...(gen?.sections ?? [])].sort((a, b) => a.from - b.from);
  const used = new Set<number>();
  const groups: { title?: string; focus?: string; entries: Entry[] }[] = sections
    .map((s) => {
      const entries = cal.entries.filter((e) => e.index >= s.from && e.index <= s.to && !used.has(e.index));
      entries.forEach((e) => used.add(e.index));
      return { title: s.title, focus: s.focus, entries };
    })
    .filter((g) => g.entries.length > 0);
  const rest = cal.entries.filter((e) => !used.has(e.index));
  if (rest.length) groups.push({ title: groups.length ? "More" : undefined, entries: rest });

  return (
    <div style={themeStyle(cal.theme)} className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6">
      <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink">
        <ArrowLeft size={16} /> Studio
      </Link>

      <header className="mt-6">
        <p className="text-sm uppercase tracking-widest text-accent-2">
          {cal.status === "draft" ? "Draft preview" : "Published"}
        </p>
        <h1 className="mt-2 text-4xl font-medium tracking-tight sm:text-5xl">{cal.title}</h1>
        {cal.description && <p className="mt-3 max-w-3xl text-lg text-muted">{cal.description}</p>}
        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
          <span>
            {cal.entries.length} entries · {formatDate(cal.entries[0]?.date ?? cal.schedule.start_date, { day: "numeric", month: "short" }, lang)} →{" "}
            {formatDate(cal.entries.at(-1)?.date ?? cal.schedule.start_date, { day: "numeric", month: "short", year: "numeric" }, lang)}
          </span>
          {gen && (
            <>
              <span className="inline-flex items-center gap-1.5">
                <Cpu size={14} /> {gen.model}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock size={14} /> generated in {Math.max(1, Math.round(gen.duration_secs / 60))} min
              </span>
            </>
          )}
        </div>
      </header>

      {gen && gen.warnings.length > 0 && (
        <div className="mt-6 flex gap-3 rounded-3xl border border-warn/40 bg-warn/10 p-4 text-sm">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warn" />
          <ul className="space-y-1">
            {gen.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-10 space-y-10">
        {groups.map((g, gi) => (
          <section key={gi} aria-label={g.title ?? "Entries"}>
            {g.title && (
              <h2 className="mb-4 text-sm text-muted">
                <span className="text-accent-2">{g.title}</span>
                {g.focus && g.focus !== g.title && <span className="text-faint"> · {g.focus}</span>}
              </h2>
            )}
            <ol className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {g.entries.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => setOpenIndex(e.index)}
                    className="glass flex h-40 w-full flex-col justify-between rounded-3xl p-5 text-left transition
                               hover:-translate-y-0.5 hover:border-accent/50"
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-4xl font-extralight tabular-nums text-accent-2">{e.index}</span>
                      <span className="truncate rounded-lg border border-line px-2 py-0.5 text-xs text-muted">{e.content_type}</span>
                    </span>
                    <span>
                      <span className="line-clamp-2 font-medium leading-snug">{e.title}</span>
                      <span className="mt-1 block text-xs text-faint">
                        {formatDate(e.date, { weekday: "short", day: "numeric", month: "short" }, lang)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>

      <details className="mt-10 text-sm text-muted">
        <summary className="cursor-pointer hover:text-ink">Original prompt</summary>
        <p className="mt-2 whitespace-pre-line">{cal.prompt}</p>
      </details>

      {open && <EntryDialog entry={open} lang={lang} onClose={() => setOpenIndex(null)} />}
    </div>
  );
}

export default function CalendarPage() {
  return (
    <Suspense>
      <CalendarView />
    </Suspense>
  );
}
