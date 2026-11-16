"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, Check, Clock, Cpu, Eye, Loader2, Pencil, RotateCcw, Save, Trash2, X } from "lucide-react";
import { api, type Calendar, type Entry } from "@/lib/api";
import { themeStyle } from "@/lib/themes";
import { contentLang, useT, type Lang } from "@/lib/i18n";
import { EntryContent } from "@/components/EntryContent";
import { TopBar } from "@/components/TopBar";
import { GenerationProgress } from "@/components/GenerationProgress";
import { CalendarEditor } from "@/components/editor/CalendarEditor";
import { ConfirmDialog } from "@/components/editor/ui";

function formatDate(iso: string, opts: Intl.DateTimeFormatOptions, locale: string) {
  try {
    return new Date(`${iso}T12:00:00Z`).toLocaleDateString(locale, { timeZone: "UTC", ...opts });
  } catch {
    return iso;
  }
}

function EntryDialog({ entry, lang, onClose }: { entry: Entry; lang: Lang; onClose: () => void }) {
  const { t } = useT();
  const locale = lang === "fr" ? "fr-FR" : "en-US";
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
            <p className="text-sm text-accent-2 first-letter:uppercase">
              #{entry.index} · {formatDate(entry.date, { weekday: "long", day: "numeric", month: "long" }, locale)} · {entry.content_type}
            </p>
            <h2 id="entry-title" className="mt-1 text-2xl font-medium">
              {entry.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            autoFocus
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted hover:bg-surface-strong hover:text-ink"
          >
            <X size={20} />
          </button>
        </div>
        {entry.metadata?.needs_review === true && (
          <p className="mt-4 rounded-2xl border border-warn/40 bg-warn/10 px-4 py-2 text-sm text-warn">{t("cal.needsReview")}</p>
        )}
        <div className="mt-6">
          {entry.blocks.length ? <EntryContent blocks={entry.blocks} lang={lang} /> : <p className="text-muted">{t("cal.noContent")}</p>}
        </div>
      </article>
    </div>
  );
}

function Preview({ cal, openIndex, setOpenIndex }: { cal: Calendar; openIndex: number | null; setOpenIndex: (n: number | null) => void }) {
  const { t, lang: ui } = useT();
  const lang = contentLang(cal.language, ui);
  const locale = lang === "fr" ? "fr-FR" : "en-US";
  const gen = cal.generation;
  const open = cal.entries.find((e) => e.index === openIndex) ?? null;

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
  if (rest.length) groups.push({ title: groups.length ? t("cal.more") : undefined, entries: rest });

  return (
    <>
      {cal.description && <p className="max-w-3xl text-lg text-muted">{cal.description}</p>}
      <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
        {cal.entries.length > 0 && (
          <span>
            {t("gen.entries", { n: cal.entries.length })} · {formatDate(cal.entries[0].date, { day: "numeric", month: "short" }, locale)} →{" "}
            {formatDate(cal.entries[cal.entries.length - 1].date, { day: "numeric", month: "short", year: "numeric" }, locale)}
          </span>
        )}
        {gen && (
          <>
            <span className="inline-flex items-center gap-1.5">
              <Cpu size={14} /> {gen.model}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock size={14} /> {t("cal.generatedIn", { n: Math.max(1, Math.round(gen.duration_secs / 60)) })}
            </span>
          </>
        )}
      </div>

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
          <section key={gi} aria-label={g.title ?? t("ed.entries")}>
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
                    className="glass flex h-40 w-full flex-col justify-between rounded-3xl p-5 text-left transition hover:-translate-y-0.5 hover:border-accent/50"
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-4xl font-extralight tabular-nums text-accent-2">{e.index}</span>
                      <span className="truncate rounded-full border border-line bg-black/30 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted">
                        {e.content_type}
                      </span>
                    </span>
                    <span>
                      <span className="line-clamp-2 font-medium leading-snug">{e.title}</span>
                      <span className="mt-1 block text-xs text-faint">
                        {formatDate(e.date, { weekday: "short", day: "numeric", month: "short" }, locale)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>

      {cal.prompt && (
        <details className="mt-10 text-sm text-muted">
          <summary className="cursor-pointer hover:text-ink">{t("cal.prompt")}</summary>
          <p className="mt-2 whitespace-pre-line">{cal.prompt}</p>
        </details>
      )}

      {open && <EntryDialog entry={open} lang={lang} onClose={() => setOpenIndex(null)} />}
    </>
  );
}

function CalendarView() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id");
  const { t, locale } = useT();

  const [saved, setSaved] = useState<Calendar | null>(null);
  const [draft, setDraft] = useState<Calendar | null>(null);
  // Bumped when content is reloaded from the server (e.g. after "regenerate all").
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"preview" | "edit">(params.get("mode") === "edit" ? "edit" : "preview");
  // `&entry=N` opens an entry directly (handy for sharing and checks).
  const [openIndex, setOpenIndex] = useState<number | null>(() => Number(params.get("entry")) || null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"regen" | "delete" | "leave" | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  const load = useCallback(
    (cid: string) =>
      api.getCalendar(cid).then(
        (c) => {
          setSaved(c);
          setDraft(c);
          setVersion((v) => v + 1);
        },
        (e: Error) => setError(e.message),
      ),
    [],
  );

  useEffect(() => {
    if (id) load(id);
  }, [id, load]);

  const dirty = useMemo(() => !!draft && !!saved && JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);
  const update = useCallback((fn: (c: Calendar) => Calendar) => setDraft((d) => (d ? fn(d) : d)), []);

  const save = useCallback(async () => {
    if (!draft || saveState === "saving") return;
    setSaveState("saving");
    setSaveError(null);
    try {
      const res = await api.saveCalendar(draft);
      setSaved(res);
      setDraft(res);
      setSaveState("idle");
    } catch (e) {
      setSaveError((e as Error).message);
      setSaveState("error");
    }
  }, [draft, saveState]);

  // Ctrl/Cmd+S saves; closing the tab with unsaved changes asks first.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (dirty) save();
      }
    };
    const onLeave = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onLeave);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onLeave);
    };
  }, [dirty, save]);

  const onJobFinished = useCallback(() => {
    if (id) load(id);
  }, [id, load]);

  if (!id || error)
    return (
      <div className="glass mx-auto mt-20 max-w-md rounded-[2rem] p-8 text-center">
        <p className="font-medium">{error ?? t("cal.none")}</p>
        <Link href="/" className="mt-4 inline-block text-accent-2 hover:underline">
          {t("common.back")}
        </Link>
      </div>
    );
  if (!draft)
    return (
      <div className="mx-auto grid max-w-6xl gap-4 px-4 pt-24 sm:grid-cols-4" aria-busy>
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="glass h-36 animate-pulse rounded-3xl" />
        ))}
      </div>
    );

  return (
    <div style={themeStyle(draft.theme)} className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6">
      <TopBar />

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/"
          onClick={(e) => {
            if (dirty) {
              e.preventDefault();
              setDialog("leave");
            }
          }}
          className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink"
        >
          <ArrowLeft size={16} /> {t("nav.studio")}
        </Link>
        <div role="tablist" className="flex rounded-full border border-line bg-black/20 p-1 text-sm">
          {(["preview", "edit"] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 transition-colors ${mode === m ? "bg-accent text-white" : "text-muted hover:text-ink"}`}
            >
              {m === "preview" ? <Eye size={15} /> : <Pencil size={15} />} {t(m === "preview" ? "cal.preview" : "cal.edit")}
            </button>
          ))}
        </div>
      </div>

      <header className="mt-6">
        <p className="text-sm uppercase tracking-widest text-accent-2">{draft.status === "draft" ? t("cal.draftPreview") : t("status.published")}</p>
        <h1 className="mt-2 text-4xl font-medium tracking-tight sm:text-5xl">{draft.title || "—"}</h1>
      </header>

      {/* Toolbar: save state + actions */}
      <div className="glass sticky top-3 z-30 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl px-4 py-3">
        <p className="flex items-center gap-2 text-sm" role="status" aria-live="polite">
          {saveState === "saving" ? (
            <>
              <Loader2 size={16} className="animate-spin text-muted" /> {t("ed.saving")}
            </>
          ) : saveState === "error" ? (
            <span className="text-danger">{t("ed.saveError", { error: saveError ?? "" })}</span>
          ) : dirty ? (
            <>
              <span className="h-2 w-2 rounded-full bg-warn" /> {t("ed.unsaved")}
            </>
          ) : (
            <>
              <Check size={16} className="text-ok" /> {t("ed.saved")}
            </>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setDialog("regen")}
            disabled={!!jobId}
            className="inline-flex items-center gap-2 rounded-2xl border border-line px-3.5 py-2 text-sm hover:bg-surface-strong disabled:opacity-40"
          >
            <RotateCcw size={15} /> {t("ed.regenAll")}
          </button>
          <button
            type="button"
            onClick={() => setDialog("delete")}
            aria-label={t("ed.deleteCal")}
            className="inline-flex items-center gap-2 rounded-2xl border border-line px-3.5 py-2 text-sm text-muted hover:border-danger/60 hover:text-danger"
          >
            <Trash2 size={15} /> <span className="hidden sm:inline">{t("ed.deleteCal")}</span>
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saveState === "saving"}
            className="inline-flex items-center gap-2 rounded-2xl bg-accent px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-40"
          >
            <Save size={15} /> {t("common.save")}
            <kbd className="hidden rounded bg-white/15 px-1.5 text-[10px] sm:inline">Ctrl S</kbd>
          </button>
        </div>
      </div>

      {jobId && (
        <div className="mt-6">
          <GenerationProgress jobId={jobId} onFinished={onJobFinished} onDismiss={() => setJobId(null)} />
        </div>
      )}

      <div className="mt-6">
        {mode === "preview" ? (
          <Preview cal={draft} openIndex={openIndex} setOpenIndex={setOpenIndex} />
        ) : (
          <CalendarEditor key={version} draft={draft} update={update} locale={locale} />
        )}
      </div>

      {dialog === "regen" && (
        <ConfirmDialog
          title={t("ed.regenTitle")}
          body={t("ed.regenBody")}
          warning={dirty ? t("ed.regenDirty") : undefined}
          confirmLabel={t("ed.regenGo")}
          onCancel={() => setDialog(null)}
          onConfirm={async () => {
            setDialog(null);
            try {
              const { job_id } = await api.regenerateCalendar(draft.id);
              setJobId(job_id);
            } catch (e) {
              setSaveError((e as Error).message);
              setSaveState("error");
            }
          }}
        />
      )}
      {dialog === "delete" && (
        <ConfirmDialog
          danger
          title={t("ed.deleteTitle")}
          body={t("ed.deleteBody", { title: draft.title, n: draft.entries.length })}
          confirmLabel={t("common.delete")}
          onCancel={() => setDialog(null)}
          onConfirm={async () => {
            try {
              await api.deleteCalendar(draft.id);
              setSaved(draft); // nothing left to protect
              router.push("/");
            } catch (e) {
              setDialog(null);
              setSaveError((e as Error).message);
              setSaveState("error");
            }
          }}
        />
      )}
      {dialog === "leave" && (
        <ConfirmDialog
          danger
          title={t("ed.unsaved")}
          body={t("ed.leave")}
          confirmLabel={t("nav.studio")}
          onCancel={() => setDialog(null)}
          onConfirm={() => {
            setSaved(draft);
            router.push("/");
          }}
        />
      )}
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
