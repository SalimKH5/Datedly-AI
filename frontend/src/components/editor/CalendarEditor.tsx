"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, GripVertical, Plus, RefreshCcw } from "lucide-react";
import type { Calendar, Entry, Interval } from "@/lib/api";
import { useT, type Key } from "@/lib/i18n";
import { THEMES } from "@/lib/themes";
import { applySchedule, entryDate, moveEntry, renumber } from "@/lib/schedule";
import { EntryEditor } from "./EntryEditor";
import { Field, field } from "./ui";

const TIMEZONES = [
  "Europe/Paris", "Europe/London", "Europe/Brussels", "Europe/Zurich", "Europe/Madrid", "Europe/Berlin",
  "America/Montreal", "America/New_York", "America/Chicago", "America/Los_Angeles",
  "Africa/Casablanca", "Africa/Algiers", "Africa/Tunis", "Africa/Dakar",
  "Asia/Dubai", "Asia/Tokyo", "Australia/Sydney", "UTC",
];

export function CalendarEditor({
  draft,
  update,
  locale,
}: {
  draft: Calendar;
  update: (fn: (c: Calendar) => Calendar) => void;
  locale: string;
}) {
  const { t } = useT();
  const [selectedId, setSelectedId] = useState<string | null>(draft.entries[0]?.id ?? null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const selected = draft.entries.find((e) => e.id === selectedId) ?? null;
  const sched = draft.schedule;

  const setSchedule = (patch: Partial<Calendar["schedule"]>) =>
    update((c) => {
      const schedule = { ...c.schedule, ...patch };
      // Schedule drives the dates: changing it moves every entry.
      const entries = patch.start_date || patch.interval ? applySchedule(c.entries, schedule) : c.entries;
      return { ...c, schedule, entries };
    });

  const setInterval = (kind: Interval["kind"]) =>
    setSchedule({ interval: kind === "every_n_days" ? { kind, days: 2 } : ({ kind } as Interval) });

  const updateEntry = (e: Entry) => update((c) => ({ ...c, entries: c.entries.map((x) => (x.id === e.id ? e : x)) }));
  const move = (from: number, to: number) => update((c) => ({ ...c, entries: moveEntry(c.entries, from, to) }));

  const addEntry = () => {
    const id = crypto.randomUUID();
    update((c) => {
      const n = c.entries.length;
      const entry: Entry = {
        id,
        index: n + 1,
        title: t("ed.newEntry"),
        date: entryDate(c.schedule, n),
        content_type: "text",
        blocks: [{ type: "text", body: "" }],
        metadata: {},
        status: "scheduled",
      };
      return { ...c, entries: [...c.entries, entry] };
    });
    setSelectedId(id);
  };

  const deleteEntry = (id: string) => {
    const pos = draft.entries.findIndex((e) => e.id === id);
    update((c) => ({ ...c, entries: renumber(c.entries.filter((e) => e.id !== id)) }));
    const next = draft.entries[pos + 1] ?? draft.entries[pos - 1];
    setSelectedId(next && next.id !== id ? next.id : null);
  };

  const fmt = (iso: string) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

  return (
    <div className="space-y-6">
      {/* Settings */}
      <section aria-labelledby="settings-title" className="glass rounded-[2rem] p-6">
        <h2 id="settings-title" className="text-lg font-medium">
          {t("ed.settings")}
        </h2>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div className="space-y-4">
            <Field label={t("ed.title")}>
              <input value={draft.title} maxLength={140} onChange={(e) => update((c) => ({ ...c, title: e.target.value }))} className={`${field} text-lg`} />
            </Field>
            <Field label={t("ed.description")}>
              <textarea
                value={draft.description}
                rows={3}
                maxLength={1000}
                onChange={(e) => update((c) => ({ ...c, description: e.target.value }))}
                className={`${field} resize-y`}
              />
            </Field>
            <fieldset>
              <legend className="text-sm text-muted">{t("ed.theme")}</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.entries(THEMES).map(([key, th]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => update((c) => ({ ...c, theme: key }))}
                    aria-pressed={draft.theme === key}
                    className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                      draft.theme === key ? "border-ink/70 text-ink" : "border-line text-muted hover:text-ink"
                    }`}
                  >
                    <span className="h-4 w-4 rounded-full" style={{ background: `linear-gradient(135deg, ${th.accent}, ${th.soft})` }} />
                    {th.label}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          <fieldset className="space-y-4">
            <legend className="sr-only">{t("ed.schedule")}</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("ed.start")}>
                <input type="date" value={sched.start_date} required onChange={(e) => e.target.value && setSchedule({ start_date: e.target.value })} className={field} />
              </Field>
              <Field label={t("ed.interval")}>
                <select value={sched.interval.kind} onChange={(e) => setInterval(e.target.value as Interval["kind"])} className={field}>
                  {(["daily", "weekly", "monthly", "every_n_days"] as const).map((k) => (
                    <option key={k} value={k}>
                      {t(`interval.${k}` as Key)}
                    </option>
                  ))}
                </select>
              </Field>
              {sched.interval.kind === "every_n_days" && (
                <Field label={t("ed.everyDays")}>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={sched.interval.days}
                    onChange={(e) => setSchedule({ interval: { kind: "every_n_days", days: Math.max(1, Number(e.target.value) || 1) } })}
                    className={field}
                  />
                </Field>
              )}
              <Field label={t("ed.unlock")}>
                <input type="time" value={sched.unlock_time} required onChange={(e) => e.target.value && setSchedule({ unlock_time: e.target.value })} className={field} />
              </Field>
              <Field label={t("ed.timezone")}>
                <select value={sched.timezone} onChange={(e) => setSchedule({ timezone: e.target.value })} className={field}>
                  {[...new Set([sched.timezone, ...TIMEZONES])].map((z) => (
                    <option key={z} value={z}>
                      {z.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <p className="text-xs text-faint">{t("ed.recomputeHint")}</p>
            <button
              type="button"
              onClick={() => update((c) => ({ ...c, entries: applySchedule(c.entries, c.schedule) }))}
              className="inline-flex items-center gap-2 rounded-2xl border border-line px-4 py-2 text-sm hover:bg-surface-strong"
            >
              <RefreshCcw size={15} /> {t("ed.recompute")}
            </button>
          </fieldset>
        </div>
      </section>

      {/* Entries + editor */}
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <section aria-labelledby="entries-title" className="glass h-fit rounded-[2rem] p-4 lg:sticky lg:top-6">
          <h2 id="entries-title" className="px-2 pb-3 pt-1 text-lg font-medium">
            {t("ed.entries")} <span className="text-sm text-faint tabular-nums">{draft.entries.length}</span>
          </h2>
          <ol className="max-h-[60vh] space-y-1 overflow-y-auto pr-1 lg:max-h-[calc(100vh-14rem)]">
            {draft.entries.map((e, i) => (
              <li
                key={e.id}
                draggable
                onDragStart={(ev) => {
                  setDragFrom(i);
                  ev.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(ev) => {
                  ev.preventDefault();
                  setDragOver(i);
                }}
                onDragLeave={() => setDragOver((d) => (d === i ? null : d))}
                onDrop={(ev) => {
                  ev.preventDefault();
                  if (dragFrom !== null) move(dragFrom, i);
                  setDragFrom(null);
                  setDragOver(null);
                }}
                onDragEnd={() => {
                  setDragFrom(null);
                  setDragOver(null);
                }}
                className={`group flex items-center gap-1 rounded-2xl transition-colors ${
                  selectedId === e.id ? "bg-accent/20" : "hover:bg-surface-strong"
                } ${dragOver === i && dragFrom !== i ? "ring-2 ring-accent/60" : ""} ${dragFrom === i ? "opacity-40" : ""}`}
              >
                <span className="cursor-grab px-1 text-faint active:cursor-grabbing" title={t("ed.drag")} aria-hidden>
                  <GripVertical size={16} />
                </span>
                <button type="button" onClick={() => setSelectedId(e.id)} aria-current={selectedId === e.id} className="flex min-w-0 flex-1 items-center gap-3 py-2.5 text-left">
                  <span className="w-6 shrink-0 text-right text-sm tabular-nums text-accent-2">{e.index}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm">{e.title || "—"}</span>
                    <span className="block truncate text-xs text-faint">
                      {fmt(e.date)} · {e.content_type}
                      {e.metadata?.needs_review === true && <span className="text-warn"> · !</span>}
                    </span>
                  </span>
                </button>
                <span className="flex shrink-0 flex-col opacity-60 group-hover:opacity-100">
                  <button type="button" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label={`${t("ed.moveUp")}: ${e.title}`} className="rounded p-0.5 hover:text-ink disabled:opacity-20">
                    <ArrowUp size={13} />
                  </button>
                  <button type="button" disabled={i === draft.entries.length - 1} onClick={() => move(i, i + 1)} aria-label={`${t("ed.moveDown")}: ${e.title}`} className="rounded p-0.5 hover:text-ink disabled:opacity-20">
                    <ArrowDown size={13} />
                  </button>
                </span>
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={addEntry}
            disabled={draft.entries.length >= 366}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line py-2.5 text-sm text-muted hover:border-accent/60 hover:text-ink"
          >
            <Plus size={16} /> {t("ed.addEntry")}
          </button>
        </section>

        <section aria-label={selected?.title ?? t("ed.selectEntry")} className="glass min-w-0 rounded-[2rem] p-6">
          {selected ? (
            <EntryEditor
              key={selected.id}
              calendarId={draft.id}
              entry={selected}
              onChange={updateEntry}
              onDelete={() => deleteEntry(selected.id)}
            />
          ) : (
            <p className="py-16 text-center text-muted">{t("ed.selectEntry")}</p>
          )}
        </section>
      </div>
    </div>
  );
}
