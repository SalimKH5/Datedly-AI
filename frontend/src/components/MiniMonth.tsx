"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useNow } from "@/lib/useNow";
import { useT } from "@/lib/i18n";

/** Month grid, Monday first. `marked` holds ISO dates (YYYY-MM-DD) to highlight. */
export function MiniMonth({ marked = [] }: { marked?: string[] }) {
  const today = useNow();
  const { t, locale } = useT();
  const [offset, setOffset] = useState(0);
  if (!today) return <div className="glass h-[340px] rounded-[2rem]" />;

  // Monday-first weekday initials in the interface language (Jan 5 2026 is a Monday).
  const days = Array.from({ length: 7 }, (_, i) =>
    new Date(Date.UTC(2026, 0, 5 + i)).toLocaleDateString(locale, { weekday: "narrow", timeZone: "UTC" }),
  );
  const view = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const lead = (view.getDay() + 6) % 7;
  const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const iso = (d: number) =>
    `${view.getFullYear()}-${String(view.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const isToday = (d: number) => offset === 0 && d === today.getDate();
  const set = new Set(marked);

  return (
    <section aria-label={t("month.title")} className="glass rounded-[2rem] p-6">
      <h2 className="text-lg font-medium">{t("month.title")}</h2>
      <div className="mt-4 flex items-center justify-between">
        <button type="button" aria-label={t("month.prev")} onClick={() => setOffset(offset - 1)} className="rounded-lg p-1 text-muted hover:text-ink">
          <ChevronLeft size={18} />
        </button>
        <p className="first-letter:uppercase">{view.toLocaleDateString(locale, { month: "long", year: "numeric" })}</p>
        <button type="button" aria-label={t("month.next")} onClick={() => setOffset(offset + 1)} className="rounded-lg p-1 text-muted hover:text-ink">
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="mt-4 grid grid-cols-7 gap-y-2 text-center text-sm">
        {days.map((d, i) => (
          <span key={i} className="text-faint uppercase">
            {d}
          </span>
        ))}
        {cells.map((d, i) =>
          d === null ? (
            <span key={i} />
          ) : (
            <span key={i} className="relative grid place-items-center">
              <span
                className={`grid h-9 w-9 place-items-center rounded-full tabular-nums ${
                  isToday(d) ? "bg-accent font-medium text-white" : "text-muted"
                }`}
              >
                {d}
              </span>
              {set.has(iso(d)) && <span className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-accent-2" />}
            </span>
          ),
        )}
      </div>
    </section>
  );
}
