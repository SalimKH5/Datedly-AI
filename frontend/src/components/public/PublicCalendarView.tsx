"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Lock, Play, Star, X } from "lucide-react";
import type { PublicCalendar, PublicEntry } from "@/lib/api";
import { contentLang, type Lang } from "@/lib/i18n";
import { themeStyle } from "@/lib/themes";
import { markSeen, useClock, useSeen } from "@/lib/publicData";
import { EntryContent } from "@/components/EntryContent";

// Visitor-facing labels follow the calendar's own language.
const L = {
  fr: {
    entries: (n: number) => `${n} cases`,
    level: "Niveau",
    next: "Prochaine case",
    in: "dans",
    allOpen: "Toutes les cases sont ouvertes",
    opening: "Ouverture en cours…",
    today: "Aujourd'hui",
    open: "Ouverte",
    seen: "Vue",
    legendToday: "la case du jour",
    legendOpen: "déjà ouverte, à relire",
    legendLocked: "pas encore ouverte",
    lockedMsg: (when: string) => `Patience : cette case s'ouvre ${when}.`,
    demo: "Mode démo : une case s'ouvre toutes les quelques minutes.",
    secret: "Les cases fermées ne sont pas dans cette page : elles restent chiffrées jusqu'à leur date.",
    madeWith: "Fait avec Datedly AI",
    close: "Fermer",
    on: (d: string, t: string) => `le ${d} à ${t}`,
    preview: "Aperçu local de la page publique",
  },
  en: {
    entries: (n: number) => `${n} entries`,
    level: "Level",
    next: "Next entry",
    in: "in",
    allOpen: "Every entry is open",
    opening: "Opening…",
    today: "Today",
    open: "Open",
    seen: "Seen",
    legendToday: "today's entry",
    legendOpen: "already open, read it again",
    legendLocked: "not open yet",
    lockedMsg: (when: string) => `Patience: this entry opens ${when}.`,
    demo: "Demo mode: a new entry opens every few minutes.",
    secret: "Closed entries are not in this page: they stay encrypted until their date.",
    madeWith: "Made with Datedly AI",
    close: "Close",
    on: (d: string, t: string) => `on ${d} at ${t}`,
    preview: "Local preview of the public page",
  },
};

function countdown(ms: number, dayUnit: string) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const hh = String(Math.floor((s % 86400) / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return d > 0 ? `${d} ${dayUnit} ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`;
}

/** Deterministic star field (same on server and client: no hydration mismatch). */
function Stars() {
  const stars = useMemo(
    () =>
      (() => {
        // mulberry32: small seeded PRNG, evenly spread and identical on every render.
        let seed = 20261201;
        const rand = () => {
          seed = (seed + 0x6d2b79f5) | 0;
          let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
          t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
        return Array.from({ length: 70 }, () => ({ left: rand() * 100, top: rand() * 85, size: rand() > 0.85 ? 3 : 2, delay: rand() * 4 }));
      })(),
    [],
  );
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {stars.map((s, i) => (
        <span
          key={i}
          className="absolute bg-white/80"
          style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, animation: `twinkle 3.5s ${s.delay}s infinite` }}
        />
      ))}
      {/* Pixel moon */}
      <span
        className="absolute right-[6%] top-10 h-14 w-14 rounded-full bg-[#f3eedc] sm:h-20 sm:w-20"
        style={{ boxShadow: "inset -10px -6px 0 0 #d9d2b8, 0 0 40px 6px rgb(255 240 200 / 0.15)" }}
      />
      {/* Pixel ground */}
      <span className="absolute inset-x-0 bottom-0 h-3 bg-[repeating-linear-gradient(90deg,#3b3b4f_0_12px,#2a2a3a_12px_24px)]" />
    </div>
  );
}

export function PublicCalendarView({
  data,
  uiLang,
  isPreview,
  onRefresh,
}: {
  data: PublicCalendar;
  uiLang: Lang;
  isPreview?: boolean;
  onRefresh?: () => void;
}) {
  const lang = contentLang(data.language, uiLang);
  const t = L[lang];
  const locale = lang === "fr" ? "fr-FR" : "en-US";
  const arcade = data.theme === "arcade";
  const now = useClock();
  const seen = useSeen(data.slug);
  const [open, setOpen] = useState<PublicEntry | null>(null);
  const [nudged, setNudged] = useState<number | null>(null);
  const [lockedMsg, setLockedMsg] = useState<string | null>(null);

  const fmtDay = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short", timeZone: data.timezone });
  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", timeZone: data.timezone });

  // The most recent unlocked entry is "today's".
  const todayIndex = [...data.entries].reverse().find((e) => e.unlocked)?.index ?? null;
  const nextMs = data.next_unlock_at && now ? new Date(data.next_unlock_at).getTime() - now : null;
  const pct = data.entry_count ? Math.round((data.unlocked_count / data.entry_count) * 100) : 0;

  // When the countdown reaches zero, ask the source again (server decides).
  const due = nextMs !== null && nextMs <= 0;
  useEffect(() => {
    if (!due || !onRefresh) return;
    onRefresh();
    const t = setInterval(onRefresh, 30_000);
    return () => clearInterval(t);
  }, [due, onRefresh]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const clickEntry = (e: PublicEntry) => {
    if (e.unlocked && e.content) {
      setOpen(e);
      markSeen(data.slug, e.index);
      return;
    }
    setNudged(e.index);
    setLockedMsg(t.lockedMsg(t.on(fmtDay(e.unlock_at), fmtTime(e.unlock_at))));
    setTimeout(() => setNudged(null), 600);
  };

  const box = arcade ? "pixel-box bg-[#141414]" : "glass rounded-3xl";
  const boxMuted = arcade ? "pixel-box-muted bg-[#1b1b1f]" : "glass rounded-3xl";
  const display = arcade ? "pixel" : "font-semibold tracking-tight";

  return (
    <div style={themeStyle(data.theme)} className={`relative isolate min-h-screen ${arcade ? "arcade bg-[#0b0b0d]" : ""}`}>
      {arcade && <Stars />}
      <div className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6">
        {isPreview && (
          <p className="mb-6 w-fit rounded-full border border-warn/40 bg-warn/10 px-3 py-1 text-sm text-warn">{t.preview}</p>
        )}

        <header className="text-center">
          <p className={`text-xs uppercase tracking-[0.35em] text-muted ${arcade ? "pixel !text-[10px]" : ""}`}>{t.entries(data.entry_count)}</p>
          <h1 className={`mt-4 text-accent ${display} ${arcade ? "text-2xl leading-snug drop-shadow-[4px_4px_0_rgba(0,0,0,0.6)] sm:text-4xl" : "text-4xl sm:text-6xl"}`}>
            {data.title}
          </h1>
          {data.description && <p className={`mx-auto mt-5 max-w-2xl text-muted ${arcade ? "text-2xl leading-snug" : "text-lg"}`}>{data.description}</p>}
          {data.demo && <p className="mt-3 text-sm text-warn">{t.demo}</p>}
        </header>

        {/* Level + countdown */}
        <section aria-label={t.level} className={`${box} mt-10 flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between`}>
          <div className="flex items-center gap-4">
            <span className={`text-accent ${arcade ? "pixel text-xs" : "text-sm font-semibold uppercase tracking-widest"}`}>{t.level}</span>
            <span className={`tabular-nums ${arcade ? "pixel text-xs" : "font-semibold"}`}>
              {String(data.unlocked_count).padStart(2, "0")}/{String(data.entry_count).padStart(2, "0")}
            </span>
            <span
              className={`h-3 w-32 overflow-hidden sm:w-48 ${arcade ? "border-2 border-white/70" : "rounded-full bg-white/10"}`}
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <span className={`block h-full bg-accent ${arcade ? "" : "rounded-full"}`} style={{ width: `${pct}%` }} />
            </span>
          </div>
          <p className={`text-muted ${arcade ? "text-xl" : "text-sm"}`} aria-live="off">
            {data.next_unlock_at ? (
              <>
                {t.next} :{" "}
                <span className="text-ink">{t.on(fmtDay(data.next_unlock_at), fmtTime(data.next_unlock_at))}</span>
                {nextMs !== null && (
                  <span className="ml-2 tabular-nums text-accent-2">
                    {due ? t.opening : `${t.in} ${countdown(nextMs, lang === "fr" ? "j" : "d")}`}
                  </span>
                )}
              </>
            ) : (
              <span className="text-accent-2">{t.allOpen} ✨</span>
            )}
          </p>
        </section>

        {/* Doors */}
        <ol className="mt-8 grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-6 xl:grid-cols-8">
          {data.entries.map((e) => {
            const isToday = e.index === todayIndex;
            const wasSeen = seen.has(e.index);
            const state = !e.unlocked ? "locked" : isToday ? "today" : "open";
            const cls =
              state === "today"
                ? arcade
                  ? "pixel-box bg-accent text-[#1a0d00]"
                  : "rounded-3xl bg-accent text-white shadow-lg shadow-black/40"
                : state === "open"
                  ? arcade
                    ? "pixel-box bg-[#1d1d22]"
                    : "glass rounded-3xl border-accent/50"
                  : `${boxMuted} text-white/35`;
            return (
              <li key={e.index}>
                <button
                  type="button"
                  onClick={() => clickEntry(e)}
                  aria-label={
                    state === "locked"
                      ? `${e.index} — ${t.legendLocked}, ${t.on(fmtDay(e.unlock_at), fmtTime(e.unlock_at))}`
                      : `${e.index} — ${e.content?.title ?? ""}`
                  }
                  className={`relative flex aspect-square w-full flex-col items-center justify-center gap-1 transition hover:-translate-y-0.5 ${cls} ${
                    nudged === e.index ? "animate-nudge" : ""
                  } ${state === "locked" ? "cursor-not-allowed" : ""}`}
                >
                  <span className="absolute left-2 top-2 opacity-80">
                    {state === "locked" ? <Lock size={12} /> : state === "today" ? <Play size={12} fill="currentColor" /> : <Star size={12} fill="currentColor" />}
                  </span>
                  {wasSeen && state !== "locked" && (
                    <span className="absolute right-2 top-2 text-ok" title={t.seen}>
                      <Check size={13} strokeWidth={3} />
                    </span>
                  )}
                  <span className={`tabular-nums ${arcade ? "pixel text-xl sm:text-2xl" : "text-3xl font-light sm:text-4xl"}`}>{e.index}</span>
                  <span className={`uppercase ${arcade ? "pixel text-[8px]" : "text-[10px] font-semibold tracking-wider"}`}>
                    {state === "locked" ? (data.demo ? fmtTime(e.unlock_at) : fmtDay(e.unlock_at)) : state === "today" ? t.today : t.open}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <p className="mt-4 min-h-6 text-center text-sm text-warn" role="status">
          {lockedMsg}
        </p>

        {/* Legend */}
        <ul className={`mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-muted ${arcade ? "text-lg" : "text-sm"}`}>
          <li className="flex items-center gap-2">
            <Play size={13} className="text-accent" fill="currentColor" /> <span className="text-accent">{t.today}</span> : {t.legendToday}
          </li>
          <li className="flex items-center gap-2">
            <Star size={13} fill="currentColor" /> <span className="text-ink">{t.open}</span> : {t.legendOpen}
          </li>
          <li className="flex items-center gap-2">
            <Lock size={13} className="text-accent-2" /> {t.legendLocked}
          </li>
        </ul>

        <footer className={`mt-12 space-y-2 text-center text-faint ${arcade ? "text-lg" : "text-sm"}`}>
          <p>{t.secret} 🔐</p>
          <p>{t.madeWith}</p>
        </footer>
      </div>

      {open?.content && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-6" onClick={() => setOpen(null)}>
          <article
            role="dialog"
            aria-modal="true"
            aria-labelledby="public-entry-title"
            onClick={(ev) => ev.stopPropagation()}
            className={`max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6 sm:p-8 ${
              arcade ? "pixel-box bg-[#141414]" : "rounded-t-[2rem] border border-line bg-[#120f2e] sm:rounded-[2rem]"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={`text-accent ${arcade ? "pixel text-[10px]" : "text-sm"}`}>
                  #{open.index} · {fmtDay(open.unlock_at)} · {open.content.content_type}
                </p>
                <h2 id="public-entry-title" className={`mt-2 ${arcade ? "pixel text-base leading-relaxed" : "text-2xl font-medium"}`}>
                  {open.content.title}
                </h2>
              </div>
              <button
                type="button"
                autoFocus
                onClick={() => setOpen(null)}
                aria-label={t.close}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted hover:bg-surface-strong hover:text-ink"
              >
                <X size={20} />
              </button>
            </div>
            <div className="mt-6">
              <EntryContent blocks={open.content.blocks} lang={lang} />
            </div>
          </article>
        </div>
      )}
    </div>
  );
}
