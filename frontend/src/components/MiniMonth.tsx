"use client";

import { useState } from "react";
import { useNow } from "@/lib/useNow";
import { ChevronLeft, ChevronRight } from "lucide-react";

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

/** Month grid, Monday first. `marked` holds ISO dates (YYYY-MM-DD) to highlight. */
export function MiniMonth({ marked = [] }: { marked?: string[] }) {
  const today = useNow();
  const [offset, setOffset] = useState(0);
  if (!today) return <div className="glass h-[340px] rounded-[2rem]" />;

  const view = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const lead = (view.getDay() + 6) % 7;
  const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const iso = (d: number) =>
    `${view.getFullYear()}-${String(view.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const isToday = (d: number) => offset === 0 && d === today.getDate();
  const set = new Set(marked);

  return (
    <section aria-label="Month" className="glass rounded-[2rem] p-6">
      <h2 className="text-lg font-medium">Calendar</h2>
      <div className="mt-4 flex items-center justify-between">
        <button type="button" aria-label="Previous month" onClick={() => setOffset(offset - 1)} className="rounded-lg p-1 text-muted hover:text-ink">
          <ChevronLeft size={18} />
        </button>
        <p>{view.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>
        <button type="button" aria-label="Next month" onClick={() => setOffset(offset + 1)} className="rounded-lg p-1 text-muted hover:text-ink">
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="mt-4 grid grid-cols-7 gap-y-2 text-center text-sm">
        {DAYS.map((d, i) => (
          <span key={i} className="text-faint">
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
