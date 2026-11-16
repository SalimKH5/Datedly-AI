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
