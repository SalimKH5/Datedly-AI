"use client";

import { useNow } from "@/lib/useNow";

const TZ = "Europe/Paris";

function greetingFor(hour: number) {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function Greeting() {
  const now = useNow();

  const hour = now ? Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: TZ }).format(now)) : 9;
  const time = now
    ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(now)
    : "--:--";
  const date = now
    ? new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: TZ }).format(now)
    : "";

  return (
    <header id="top" className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-4xl font-medium leading-tight tracking-tight sm:text-5xl">
          {greetingFor(hour)},
          <br />
          <span className="text-accent-2">creator</span>
        </h1>
        <p className="mt-3 text-muted">
          Describe <span className="text-faint">·</span> Generate <span className="text-faint">·</span> Customize{" "}
          <span className="text-faint">·</span> Publish
        </p>
      </div>
      <div className="sm:text-right">
        <p className="text-6xl font-extralight tabular-nums tracking-tight sm:text-7xl" suppressHydrationWarning>
          {time}
        </p>
        <p className="mt-1 text-muted" suppressHydrationWarning>
          {date} <span className="text-faint">· Paris</span>
        </p>
      </div>
    </header>
  );
}
