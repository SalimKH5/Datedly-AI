"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Check, Copy, Lightbulb } from "lucide-react";
import { useT } from "@/lib/i18n";
import { GUIDE } from "@/lib/content";

function CodeLines({ code }: { code: string }) {
  const { t } = useT();
  const [done, setDone] = useState(false);
  return (
    <div className="mt-4 flex items-start justify-between gap-3 rounded-2xl border border-line bg-black/40 px-4 py-3 font-mono text-sm">
      <pre className="whitespace-pre-wrap text-ink">{code}</pre>
      <button
        type="button"
        aria-label={t("guide.copy")}
        title={t("guide.copy")}
        onClick={() => {
          navigator.clipboard?.writeText(code).then(
            () => {
              setDone(true);
              setTimeout(() => setDone(false), 1500);
            },
            () => {},
          );
        }}
        className="shrink-0 rounded-md p-1 text-faint hover:text-ink"
      >
        {done ? <Check size={15} className="text-ok" /> : <Copy size={15} />}
      </button>
    </div>
  );
}

/** "How to use the app": a numbered walkthrough, each step linking to the right place. */
export function HowToGuide() {
  const { t, lang } = useT();
  const steps = GUIDE[lang];

  return (
    <section id="guide" aria-labelledby="guide-title" className="scroll-mt-6">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-highlight">{t("guide.tag")}</p>
      <h2 id="guide-title" className="mt-3 max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
        {t("guide.h")}
      </h2>
      <p className="mt-2 text-muted">{t("guide.p")}</p>

      <ol className="mt-8 grid gap-4 md:grid-cols-2">
        {steps.map((s, i) => (
          <li key={s.title} className="glass relative flex flex-col rounded-[1.75rem] p-6">
            <div className="flex items-center gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent text-lg font-semibold tabular-nums text-white">
                {i + 1}
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-faint">{t("guide.step", { n: i + 1 })}</p>
                <h3 className="text-lg font-semibold">{s.title}</h3>
              </div>
            </div>
            <p className="mt-4 leading-relaxed text-muted">{s.body}</p>
            {s.code && <CodeLines code={s.code} />}
            {s.tip && (
              <p className="mt-4 flex gap-2 rounded-2xl bg-highlight/10 px-4 py-3 text-sm text-ink">
                <Lightbulb size={16} className="mt-0.5 shrink-0 text-highlight" />
                <span>
                  <span className="font-medium text-highlight">{t("guide.tip")} · </span>
                  {s.tip}
                </span>
              </p>
            )}
            {s.href && s.cta && (
              <Link
                href={s.href}
                className="mt-5 inline-flex w-fit items-center gap-1.5 text-sm font-semibold uppercase tracking-[0.12em] text-accent-2 hover:text-ink"
              >
                {s.cta} <ArrowUpRight size={15} />
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
