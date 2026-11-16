"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, Check, Loader2, X } from "lucide-react";
import { api, type Job, type Stage } from "@/lib/api";
import { useT, type Key } from "@/lib/i18n";

const STEPS: Stage[] = ["understanding", "planning", "writing", "validating", "saving"];
const ORDER: Stage[] = ["understanding", "planning", "writing", "validating", "saving", "done"];

export function GenerationProgress({
  jobId,
  onFinished,
  onDismiss,
}: {
  jobId: string;
  onFinished: () => void;
  onDismiss: () => void;
}) {
  const { t } = useT();
  const [job, setJob] = useState<Job | null>(null);
  const [lost, setLost] = useState(false);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const j = await api.job(jobId);
        if (!alive) return;
        setJob(j);
        setLost(false);
        if (j.status !== "running") {
          onFinished();
          return;
        }
      } catch {
        if (alive) setLost(true);
      }
      timer = setTimeout(poll, 1500);
    };
    poll();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [jobId, onFinished]);

  const current = job ? ORDER.indexOf(job.stage) : 0;
  const pct = !job
    ? 2
    : job.status === "done"
      ? 100
      : Math.round(
          ({ understanding: 3, planning: 12, writing: 22, validating: 88, saving: 95, done: 100 }[job.stage] ?? 0) +
            (job.stage === "writing" && job.total ? (job.done / job.total) * 64 : 0),
        );
  const failed = job?.status === "failed";

  return (
    <section aria-live="polite" aria-labelledby="gen-title" className="glass rounded-[2rem] p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{job?.model ? t("gen.with", { model: job.model }) : t("gen.starting")}</p>
          <h2 id="gen-title" className="mt-1 text-xl font-medium">
            {job?.brief?.title || t("gen.reading")}
          </h2>
          {job?.brief?.description && <p className="mt-1 max-w-2xl text-sm text-muted">{job.brief.description}</p>}
        </div>
        {job?.status !== "running" && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label={t("common.close")}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-muted hover:bg-surface-strong hover:text-ink"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {job?.brief && (
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {[
            t("gen.entries", { n: job.brief.entry_count }),
            (["daily", "weekly", "monthly"].includes(job.brief.interval) ? t(`interval.${job.brief.interval}` as Key) : job.brief.interval),
            t("gen.from", { date: job.brief.start_date }),
            job.brief.audience,
            job.brief.tone,
            job.brief.language.toUpperCase(),
          ]
            .filter(Boolean)
            .map((t) => (
              <span key={t} className="rounded-full border border-line px-3 py-1 text-muted">
                {t}
              </span>
            ))}
        </div>
      )}

      <ol className="mt-6 grid grid-cols-5 gap-2">
        {STEPS.map((stage, i) => {
          const state = failed && i === current ? "failed" : i < current || job?.status === "done" ? "done" : i === current ? "active" : "todo";
          return (
            <li key={stage} className="flex flex-col items-center gap-2 text-center text-xs sm:text-sm">
              <span
                className={`grid h-9 w-9 place-items-center rounded-full border ${
                  state === "done"
                    ? "border-accent bg-accent text-white"
                    : state === "active"
                      ? "border-accent text-accent-2"
                      : state === "failed"
                        ? "border-danger text-danger"
                        : "border-line text-faint"
                }`}
              >
                {state === "done" ? (
                  <Check size={16} />
                ) : state === "active" ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : state === "failed" ? (
                  <X size={16} />
                ) : (
                  i + 1
                )}
              </span>
              <span className={state === "todo" ? "text-faint" : "text-ink"}>
                {t(`step.${stage}` as Key)}
                {stage === "writing" && job?.total ? (
                  <span className="block tabular-nums text-muted">
                    {job.done}/{job.total}
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/5" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div
          className={`h-full rounded-full transition-[width] duration-700 ${failed ? "bg-danger" : "bg-accent"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-3 text-sm text-muted">
        {lost ? t("gen.lost") : job ? (failed ? job.message : t(`stage.${job.stage}` as Key)) : ""}
        {job?.status === "running" && ` · ${t("gen.slow")}`}
      </p>

      {failed && (
        <div role="alert" className="mt-5 flex gap-3 rounded-2xl border border-danger/40 bg-danger/10 p-4 text-sm">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-danger" />
          <div>
            <p className="font-medium text-ink">{t("gen.failed")}</p>
            <p className="mt-1 text-muted">{job?.error}</p>
            <p className="mt-1 text-muted">{t("gen.failedHint")}</p>
          </div>
        </div>
      )}

      {job?.status === "done" && job.calendar_id && (
        <Link
          href={`/calendar?id=${job.calendar_id}`}
          className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-accent px-6 py-3 font-medium text-white hover:brightness-110"
        >
          {t("gen.open")} <ArrowRight size={18} />
        </Link>
      )}

      {job?.plan && (
        <details className="mt-6 border-t border-line pt-5" open={job.status === "running"}>
          <summary className="cursor-pointer text-sm text-muted hover:text-ink">{t("gen.plan")}</summary>
          {job.plan.sections.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {job.plan.sections.map((s) => (
                <span key={`${s.from}-${s.title}`} className="rounded-xl bg-accent/15 px-3 py-1.5 text-sm">
                  <span className="text-muted tabular-nums">
                    {s.from}–{s.to}
                  </span>{" "}
                  {s.title}
                </span>
              ))}
            </div>
          )}
          <ol className="mt-4 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            {job.plan.entries.map((e) => (
              <li key={e.index} className={`flex gap-2 ${e.index <= job.done ? "text-ink" : "text-muted"}`}>
                <span className="w-6 shrink-0 text-right tabular-nums text-faint">{e.index}</span>
                <span className="truncate">{e.title}</span>
                <span className="ml-auto shrink-0 text-xs text-faint">{e.content_type}</span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
