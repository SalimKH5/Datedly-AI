"use client";

import Link from "next/link";
import { BookOpen, Check, X } from "lucide-react";
import { useT, type Key } from "@/lib/i18n";
import { FLAGS, setFlag, useFlag } from "@/lib/flags";

/** Onboarding checklist on the home page, driven by the real state of the app. */
export function GettingStarted({
  offline,
  aiConnected,
  hasModel,
  calendarCount,
  firstCalendarId,
}: {
  offline: boolean;
  aiConnected: boolean;
  hasModel: boolean;
  calendarCount: number;
  firstCalendarId: string | null;
}) {
  const { t } = useT();
  const editorOpened = useFlag(FLAGS.editorOpened);
  const hidden = useFlag(FLAGS.startHidden);

  const items: { label: Key; done: boolean; href?: string }[] = [
    { label: "start.studio", done: !offline, href: "/toolkit#guide" },
    { label: "start.ollama", done: !offline && aiConnected, href: "/toolkit#guide" },
    { label: "start.model", done: !offline && hasModel, href: "#ai" },
    { label: "start.first", done: calendarCount > 0, href: "#create" },
    { label: "start.edit", done: editorOpened, href: firstCalendarId ? `/calendar?id=${firstCalendarId}&mode=edit` : "#create" },
  ];
  const done = items.filter((i) => i.done).length;
  if (hidden) return null;

  return (
    <section aria-labelledby="start-title" className="glass rounded-[2rem] p-6">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 id="start-title" className="text-lg font-medium">
            {t("start.title")}
          </h2>
          <p className="text-sm text-muted">{t("start.progress", { done, total: items.length })}</p>
        </div>
        <button
          type="button"
          onClick={() => setFlag(FLAGS.startHidden)}
          aria-label={t("start.hide")}
          title={t("start.hide")}
          className="grid h-8 w-8 place-items-center rounded-xl text-faint hover:bg-surface-strong hover:text-ink"
        >
          <X size={16} />
        </button>
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/5" aria-hidden>
        <div className="h-full rounded-full bg-highlight transition-[width] duration-500" style={{ width: `${(done / items.length) * 100}%` }} />
      </div>

      <ul className="mt-4 space-y-1">
        {items.map((it) => {
          const content = (
            <>
              <span
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${
                  it.done ? "border-highlight bg-highlight text-[#14161a]" : "border-line text-transparent"
                }`}
              >
                <Check size={14} strokeWidth={3} />
              </span>
              <span className={it.done ? "text-muted line-through decoration-faint" : "text-ink"}>{t(it.label)}</span>
            </>
          );
          return (
            <li key={it.label}>
              {it.href && !it.done ? (
                <Link href={it.href} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-1.5 text-sm hover:bg-surface-strong">
                  {content}
                </Link>
              ) : (
                <span className="-mx-2 flex items-center gap-3 px-2 py-1.5 text-sm">{content}</span>
              )}
            </li>
          );
        })}
      </ul>

      {done === items.length && <p className="mt-3 text-sm text-highlight">{t("start.done")}</p>}

      <Link href="/toolkit#guide" className="mt-4 inline-flex items-center gap-2 text-sm text-accent-2 hover:underline">
        <BookOpen size={15} /> {t("start.guide")}
      </Link>
    </section>
  );
}
