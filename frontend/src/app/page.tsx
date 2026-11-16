"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TerminalSquare } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { Greeting } from "@/components/Greeting";
import { PromptComposer } from "@/components/PromptComposer";
import { GenerationProgress } from "@/components/GenerationProgress";
import { AiEngineCard } from "@/components/AiEngineCard";
import { MiniMonth } from "@/components/MiniMonth";
import { CalendarsPanel } from "@/components/CalendarsPanel";
import { GettingStarted } from "@/components/GettingStarted";
import { api, ApiError, type AiStatus, type CalendarSummary } from "@/lib/api";
import { useT, type Key } from "@/lib/i18n";
import { SITE_MODE } from "@/lib/publicData";
import { PublicHome } from "@/components/public/PublicHome";

type Loaded =
  | { ai: AiStatus; calendars: CalendarSummary[]; runningJob: string | null }
  | { offline: true }
  | null;

async function fetchState(): Promise<Loaded> {
  try {
    const [ai, calendars, current] = await Promise.all([api.aiStatus(), api.listCalendars(), api.currentJob()]);
    return { ai, calendars, runningJob: current.job?.id ?? null };
  } catch (e) {
    return e instanceof ApiError && e.offline ? { offline: true } : null;
  }
}

function Studio() {
  const { t } = useT();
  // A prompt can arrive from the toolkit: /?prompt=...
  const prefill = useSearchParams().get("prompt")?.slice(0, 2000) ?? "";
  const [ai, setAi] = useState<AiStatus | null>(null);
  const [calendars, setCalendars] = useState<CalendarSummary[]>([]);
  const [offline, setOffline] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobRunning, setJobRunning] = useState(false);

  const apply = useCallback((r: Loaded) => {
    if (!r) return;
    if ("offline" in r) {
      setOffline(true);
      return;
    }
    setAi(r.ai);
    setCalendars(r.calendars);
    setOffline(false);
    // Resume showing a generation started before a page reload.
    if (r.runningJob) {
      setJobId(r.runningJob);
      setJobRunning(true);
    }
  }, []);
  const load = useCallback(() => fetchState().then(apply), [apply]);

  useEffect(() => {
    fetchState().then(apply);
  }, [apply]);

  useEffect(() => {
    if (prefill) document.getElementById("create")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [prefill]);

  const onStarted = useCallback((id: string) => {
    setJobId(id);
    setJobRunning(true);
    document.getElementById("top")?.scrollIntoView({ behavior: "smooth" });
  }, []);
  const onFinished = useCallback(() => {
    setJobRunning(false);
    api.listCalendars().then(setCalendars, () => {});
  }, []);
  const onDismiss = useCallback(() => setJobId(null), []);

  const stats: { label: Key; value: number }[] = [
    { label: "stats.calendars", value: calendars.length },
    { label: "stats.drafts", value: calendars.filter((c) => c.status === "draft").length },
    { label: "stats.published", value: calendars.filter((c) => c.status === "published").length },
    { label: "stats.entries", value: calendars.reduce((n, c) => n + c.entry_count, 0) },
  ];

  return (
    <div className="mx-auto flex max-w-7xl gap-6 px-4 pb-28 pt-6 sm:px-6 lg:pb-6">
      <Sidebar />
      <main className="min-w-0 flex-1 space-y-6">
        <TopBar active="studio" />
        <Greeting />

        {offline && (
          <div role="alert" className="glass flex items-start gap-3 rounded-3xl border-warn/40 p-4 text-sm">
            <TerminalSquare className="mt-0.5 shrink-0 text-warn" size={18} />
            <p>
              <span className="font-medium text-ink">{t("offline.title")}</span>{" "}
              <span className="text-muted">
                {t("offline.a")} <code className="rounded bg-black/40 px-1.5 py-0.5">cargo run</code> {t("offline.b")}{" "}
                <code className="rounded bg-black/40 px-1.5 py-0.5">backend</code>
                {t("offline.c").startsWith(",") ? "" : " "}
                {t("offline.c")}
              </span>
            </p>
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
          <div className="min-w-0 space-y-6">
            {jobId && <GenerationProgress jobId={jobId} onFinished={onFinished} onDismiss={onDismiss} />}
            <PromptComposer
              key={prefill}
              initialPrompt={prefill}
              aiReady={!!ai?.status.available}
              model={ai?.selected_model ?? null}
              busy={jobRunning}
              onStarted={onStarted}
            />
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {stats.map((s) => (
                <div key={s.label} className="glass rounded-3xl p-5">
                  <dt className="text-sm text-muted">{t(s.label)}</dt>
                  <dd className="mt-1 text-3xl font-light tabular-nums">{s.value}</dd>
                </div>
              ))}
            </dl>
            <CalendarsPanel calendars={calendars} offline={offline} />
          </div>
          <div className="space-y-6">
            <GettingStarted
              offline={!ai}
              aiConnected={!!ai?.status.available}
              hasModel={!!ai?.selected_model}
              calendarCount={calendars.length}
              firstCalendarId={calendars[0]?.id ?? null}
            />
            <MiniMonth marked={calendars.map((c) => c.start_date)} />
            <AiEngineCard key={ai?.status.endpoint ?? "none"} ai={ai} offline={offline} onRefresh={load} />
          </div>
        </div>
      </main>
    </div>
  );
}

export default function Home() {
  // On GitHub Pages the home page lists published calendars; the studio is local.
  if (SITE_MODE === "public") return <PublicHome />;
  return (
    <Suspense>
      <Studio />
    </Suspense>
  );
}
