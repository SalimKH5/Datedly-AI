"use client";

import { useCallback, useEffect, useState } from "react";

import { TerminalSquare } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { Greeting } from "@/components/Greeting";
import { PromptComposer } from "@/components/PromptComposer";
import { AiEngineCard } from "@/components/AiEngineCard";
import { MiniMonth } from "@/components/MiniMonth";
import { CalendarsPanel } from "@/components/CalendarsPanel";
import { api, ApiError, type AiStatus, type CalendarSummary } from "@/lib/api";

type Loaded = { ai: AiStatus; calendars: CalendarSummary[] } | { offline: true } | null;

async function fetchState(): Promise<Loaded> {
  try {
    const [ai, calendars] = await Promise.all([api.aiStatus(), api.listCalendars()]);
    return { ai, calendars };
  } catch (e) {
    return e instanceof ApiError && e.offline ? { offline: true } : null;
  }
}

export default function Home() {
  const [ai, setAi] = useState<AiStatus | null>(null);
  const [calendars, setCalendars] = useState<CalendarSummary[]>([]);
  const [offline, setOffline] = useState(false);

  const apply = useCallback((r: Loaded) => {
    if (!r) return;
    if ("offline" in r) {
      setOffline(true);
    } else {
      setAi(r.ai);
      setCalendars(r.calendars);
      setOffline(false);
    }
  }, []);
  const load = useCallback(() => fetchState().then(apply), [apply]);

  useEffect(() => {
    fetchState().then(apply);
  }, [apply]);

  const stats = [
    { label: "Calendars", value: calendars.length },
    { label: "Drafts", value: calendars.filter((c) => c.status === "draft").length },
    { label: "Published", value: calendars.filter((c) => c.status === "published").length },
    { label: "Entries", value: calendars.reduce((n, c) => n + c.entry_count, 0) },
  ];

  return (
    <div className="mx-auto flex max-w-7xl gap-6 px-4 pb-28 pt-6 sm:px-6 lg:pb-6">
      <Sidebar />
      <main className="min-w-0 flex-1 space-y-6">
        <Greeting />

        {offline && (
          <div role="alert" className="glass flex items-start gap-3 rounded-3xl border-warn/40 p-4 text-sm">
            <TerminalSquare className="mt-0.5 shrink-0 text-warn" size={18} />
            <p>
              <span className="font-medium text-ink">The local studio is not running.</span>{" "}
              <span className="text-muted">
                Calendars are created on your computer with Ollama. Start it with{" "}
                <code className="rounded bg-black/40 px-1.5 py-0.5">cargo run</code> in the{" "}
                <code className="rounded bg-black/40 px-1.5 py-0.5">backend</code> folder, then refresh.
              </span>
            </p>
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            <PromptComposer aiReady={!!ai?.status.available} model={ai?.selected_model ?? null} />
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {stats.map((s) => (
                <div key={s.label} className="glass rounded-3xl p-5">
                  <dt className="text-sm text-muted">{s.label}</dt>
                  <dd className="mt-1 text-3xl font-light tabular-nums">{s.value}</dd>
                </div>
              ))}
            </dl>
            <CalendarsPanel calendars={calendars} offline={offline} />
          </div>
          <div className="space-y-6">
            <MiniMonth />
            <AiEngineCard key={ai?.status.endpoint ?? "none"} ai={ai} offline={offline} onRefresh={load} />
          </div>
        </div>
      </main>
    </div>
  );
}
