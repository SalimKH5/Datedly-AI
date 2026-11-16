"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import type { CalendarSummary } from "@/lib/api";

const TABS = [
  { key: "all", label: "All" },
  { key: "draft", label: "Drafts" },
  { key: "published", label: "Published" },
] as const;

export function CalendarsPanel({ calendars, offline }: { calendars: CalendarSummary[]; offline: boolean }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("all");
  const shown = tab === "all" ? calendars : calendars.filter((c) => c.status === tab);

  return (
    <section id="calendars" aria-labelledby="cal-title" className="glass rounded-[2rem] p-6">
      <h2 id="cal-title" className="text-lg font-medium">
        Your calendars
      </h2>
      <div role="tablist" className="mt-4 flex gap-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-xl px-3.5 py-1.5 text-sm transition-colors ${
              tab === t.key ? "bg-accent/25 text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="mt-6 flex flex-col items-center rounded-3xl border border-dashed border-line px-6 py-10 text-center">
          <CalendarPlus className="text-faint" size={28} />
          <p className="mt-3 font-medium">{offline ? "Start the local studio to see your calendars" : "No calendars yet"}</p>
          <p className="mt-1 max-w-xs text-sm text-muted">
            {offline
              ? "Your calendars are stored privately on your computer."
              : "Describe an idea above and your first calendar will appear here."}
          </p>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {shown.map((c) => (
            <li key={c.id}>
              <Link
                href={`/calendar?id=${c.id}`}
                className="-mx-3 flex items-center justify-between gap-4 rounded-2xl px-3 py-3.5 transition-colors hover:bg-surface-strong"
              >
              <div className="min-w-0">
                <p className="truncate">{c.title}</p>
                <p className="text-sm text-muted">
                  {c.entry_count} entries · {c.start_date}
                  {c.end_date && c.end_date !== c.start_date ? ` → ${c.end_date}` : ""}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-lg border px-2.5 py-0.5 text-xs ${
                  c.status === "published" ? "border-ok/50 text-ok" : "border-warn/50 text-warn"
                }`}
              >
                {c.status === "published" ? "Published" : "Draft"}
              </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
