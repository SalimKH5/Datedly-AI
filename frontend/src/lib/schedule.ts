import type { Entry, Schedule } from "./api";

// Calendar-date arithmetic on plain YYYY-MM-DD strings (no time zone involved).
// The server stays the authority for unlocking; this only fills dates in the editor.

function parts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}
const toIso = (dt: Date) => dt.toISOString().slice(0, 10);

export function addDays(iso: string, n: number): string {
  const { y, m, d } = parts(iso);
  return toIso(new Date(Date.UTC(y, m - 1, d + n)));
}

export function addMonths(iso: string, n: number): string {
  const { y, m, d } = parts(iso);
  // Clamp to the last day of the target month (Jan 31 + 1 month = Feb 28/29).
  const last = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
  return toIso(new Date(Date.UTC(y, m - 1 + n, Math.min(d, last))));
}

/** Date of the n-th entry (0-based), same rules as the Rust engine. */
export function entryDate(s: Schedule, n: number): string {
  switch (s.interval.kind) {
    case "weekly":
      return addDays(s.start_date, 7 * n);
    case "monthly":
      return addMonths(s.start_date, n);
    case "every_n_days":
      return addDays(s.start_date, Math.max(1, s.interval.days) * n);
    default:
      return addDays(s.start_date, n);
  }
}

/** Renumbers entries 1..n in their current order. */
export function renumber(entries: Entry[]): Entry[] {
  return entries.map((e, i) => ({ ...e, index: i + 1 }));
}

/** Gives every entry the date of its position in the schedule. */
export function applySchedule(entries: Entry[], s: Schedule): Entry[] {
  return entries.map((e, i) => ({ ...e, index: i + 1, date: entryDate(s, i) }));
}

/** Moves an entry; dates stay attached to positions, so the moved entry takes its new slot's date. */
export function moveEntry(entries: Entry[], from: number, to: number): Entry[] {
  if (from === to || to < 0 || to >= entries.length) return entries;
  const slots = entries.map((e) => e.date);
  const next = [...entries];
  const [m] = next.splice(from, 1);
  next.splice(to, 0, m);
  return next.map((e, i) => ({ ...e, index: i + 1, date: slots[i] }));
}

/** "YYYY-MM-DD HH:MM" right now in a time zone (to compare with an entry's date + unlock time). */
export function nowInZone(timeZone: string, now: Date = new Date()): string {
  try {
    // sv-SE formats as "2026-12-01 08:30".
    return new Intl.DateTimeFormat("sv-SE", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
      .format(now)
      .replace(",", "");
  } catch {
    return now.toISOString().slice(0, 16).replace("T", " ");
  }
}

/** Is this entry still closed for visitors? Mirrors the server rule (the server stays the authority). */
export function isLockedForVisitors(
  index: number,
  date: string,
  schedule: Schedule,
  demo: { start: string; every_minutes: number } | null | undefined,
  now: Date,
): boolean {
  if (demo) {
    const at = new Date(demo.start).getTime() + (index - 1) * Math.max(1, demo.every_minutes) * 60_000;
    return now.getTime() < at;
  }
  return nowInZone(schedule.timezone, now) < `${date} ${schedule.unlock_time}`;
}
