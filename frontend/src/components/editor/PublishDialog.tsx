"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, CalendarClock, Check, KeyRound, Loader2, Timer, X } from "lucide-react";
import { api, type Calendar, type PublishResult } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { field } from "./ui";

export function PublishDialog({
  cal,
  dirty,
  onClose,
  onPublished,
}: {
  cal: Calendar;
  dirty: boolean;
  onClose: () => void;
  onPublished: (c: Calendar) => void;
}) {
  const { t, locale } = useT();
  const [mode, setMode] = useState<"dates" | "demo">(cal.publication?.demo ? "demo" : "dates");
  const [every, setEvery] = useState(cal.publication?.demo?.every_minutes ?? 5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PublishResult | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const first = cal.entries[0];
  const firstDate = first
    ? new Date(`${first.date}T12:00:00Z`).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    : "—";

  async function publish() {
    setBusy(true);
    setError(null);
    try {
      const r = await api.publish(cal.id, mode === "demo" ? Math.min(1440, Math.max(1, every)) : undefined);
      setResult(r);
      onPublished(r.calendar);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const option = (value: "dates" | "demo", Icon: typeof Timer, title: string, hint: string) => (
    <label
      className={`flex cursor-pointer gap-3 rounded-2xl border p-4 transition-colors ${
        mode === value ? "border-accent bg-accent/15" : "border-line hover:bg-surface-strong"
      }`}
    >
      <input type="radio" name="publish-mode" checked={mode === value} onChange={() => setMode(value)} className="sr-only" />
      <Icon size={20} className="mt-0.5 shrink-0 text-accent-2" />
      <span>
        <span className="block font-medium">{title}</span>
        <span className="mt-0.5 block text-sm text-muted">{hint}</span>
      </span>
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-title"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[2rem] border border-line bg-[#120f2e] p-6 sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="publish-title" className="text-xl font-medium">
            {result ? t("pub.doneTitle") : t("pub.title")}
          </h2>
          <button type="button" onClick={onClose} aria-label={t("common.close")} className="grid h-9 w-9 place-items-center rounded-xl text-muted hover:bg-surface-strong hover:text-ink">
            <X size={18} />
          </button>
        </div>

        {!result ? (
          <>
            <p className="mt-3 text-sm leading-relaxed text-muted">{t("pub.body", { tz: cal.schedule.timezone })}</p>
            <fieldset className="mt-5 space-y-3">
              <legend className="sr-only">{t("pub.title")}</legend>
              {option("dates", CalendarClock, t("pub.modeDates"), t("pub.modeDatesHint", { date: firstDate, time: cal.schedule.unlock_time }))}
              {option("demo", Timer, t("pub.modeDemo"), t("pub.modeDemoHint"))}
            </fieldset>
            {mode === "demo" && (
              <label className="mt-4 block text-sm text-muted">
                {t("pub.every")}
                <input type="number" min={1} max={1440} value={every} onChange={(e) => setEvery(Number(e.target.value))} className={`${field} mt-1.5 w-32`} />
              </label>
            )}
            {dirty && <p className="mt-4 rounded-2xl border border-warn/40 bg-warn/10 px-4 py-2 text-sm text-warn">{t("pub.unsaved")}</p>}
            {error && <p className="mt-4 rounded-2xl border border-danger/40 bg-danger/10 px-4 py-2 text-sm text-danger">{error}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded-2xl border border-line px-4 py-2.5 text-sm hover:bg-surface-strong">
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={publish}
                disabled={busy || dirty}
                className="inline-flex items-center gap-2 rounded-2xl bg-accent px-5 py-2.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-40"
              >
                {busy && <Loader2 size={16} className="animate-spin" />} {t("pub.go")}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-3 flex gap-2 text-sm text-ok">
              <Check size={18} className="shrink-0" /> {t("pub.doneLocal")}
            </p>
            <Link
              href={`/c?slug=${result.calendar.slug}`}
              className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-accent px-4 py-2.5 text-sm font-medium text-white hover:brightness-110"
            >
              {t("pub.view")} <ArrowUpRight size={16} />
            </Link>

            <h3 className="mt-6 text-sm font-medium uppercase tracking-wider text-faint">{t("pub.next")}</h3>
            <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-muted marker:text-accent-2">
              <li>{t("pub.step1")}</li>
              <li>
                {result.key?.source === "file" ? (
                  <>
                    {t("pub.step2")}
                    <code className="mt-1.5 block break-all rounded-xl bg-black/40 px-3 py-2 font-mono text-xs text-ink">{result.key.path}</code>
                  </>
                ) : (
                  t("pub.step2env")
                )}
              </li>
              <li>{t("pub.step3")}</li>
            </ol>
            <p className="mt-4 flex gap-2 rounded-2xl border border-warn/40 bg-warn/10 px-4 py-3 text-xs text-warn">
              <KeyRound size={15} className="mt-0.5 shrink-0" /> {t("pub.keyWarn")}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
