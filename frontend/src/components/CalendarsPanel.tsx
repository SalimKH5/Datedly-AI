"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import type { CalendarSummary } from "@/lib/api";
import { useT, type Key } from "@/lib/i18n";

const TABS: { key: "all" | "draft" | "published"; label: Key }[] = [
  { key: "all", label: "list.all" },
  { key: "draft", label: "stats.drafts" },
  { key: "published", label: "stats.published" },
];

export function CalendarsPanel({ calendars, offline }: { calendars: CalendarSummary[]; offline: boolean }) {
  const { t, locale } = useT();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("all");
  const shown = tab === "all" ? calendars : calendars.filter((c) => c.status === tab);
  const fmt = (iso: string) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

  return (
    <section id="calendars" aria-labelledby="cal-title" className="glass rounded-[2rem] p-6">
      <h2 id="cal-title" className="text-lg font-medium">
        {t("list.title")}
      </h2>
      <div role="tablist" className="mt-4 flex gap-1">
        {TABS.map((tb) => (
          <button
            key={tb.key}
            role="tab"
            aria-selected={tab === tb.key}
            onClick={() => setTab(tb.key)}
            className={`rounded-xl px-3.5 py-1.5 text-sm transition-colors ${
              tab === tb.key ? "bg-accent/25 text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {t(tb.label)}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="mt-6 flex flex-col items-center rounded-3xl border border-dashed border-line px-6 py-10 text-center">
          <CalendarPlus className="text-faint" size={28} />
          <p className="mt-3 font-medium">{offline ? t("list.offlineEmpty") : t("list.empty")}</p>
          <p className="mt-1 max-w-xs text-sm text-muted">{offline ? t("list.offlineHint") : t("list.emptyHint")}</p>
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
                    {t("gen.entries", { n: c.entry_count })} · {fmt(c.start_date)}
                    {c.end_date && c.end_date !== c.start_date ? ` → ${fmt(c.end_date)}` : ""}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-lg border px-2.5 py-0.5 text-xs ${
                    c.status === "published" ? "border-ok/50 text-ok" : "border-warn/50 text-warn"
                  }`}
                >
                  {c.status === "published" ? t("status.published") : t("status.draft")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
