"use client";

import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { useT } from "@/lib/i18n";
import { buildPrompt, FORMATS, TONES } from "@/lib/content";

const input =
  "w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-2.5 text-ink placeholder:text-faint focus:border-highlight/60 focus:outline-none";

export function PromptBuilder({ onUse }: { onUse: (prompt: string) => void }) {
  const { t, lang } = useT();
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [count, setCount] = useState(24);
  const [unit, setUnit] = useState<"day" | "week" | "month">("day");
  const [formats, setFormats] = useState<number[]>([0, 1, 2]);
  const [tone, setTone] = useState(0);
  const [extra, setExtra] = useState("");

  const prompt = buildPrompt(lang, {
    topic,
    audience,
    count,
    unit,
    formats: formats.map((i) => FORMATS[lang][i]),
    tone: TONES[lang][tone],
    extra,
  });

  return (
    <section aria-labelledby="builder-title" className="rounded-[2rem] border border-line bg-gradient-to-br from-[#1a1538] to-[#120f2e] p-6 sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-highlight">{t("kit.builder.tag")}</p>
      <h2 id="builder-title" className="mt-3 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
        {t("kit.builder.h")}
      </h2>
      <p className="mt-2 text-muted">{t("kit.builder.p")}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="text-sm text-muted">
          {t("kit.builder.topic")}
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={t("kit.builder.topicPh")} maxLength={120} className={`${input} mt-1.5`} />
        </label>
        <label className="text-sm text-muted">
          {t("kit.builder.audience")}
          <input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder={t("kit.builder.audiencePh")} maxLength={120} className={`${input} mt-1.5`} />
        </label>
        <div className="text-sm text-muted">
          {t("kit.builder.length")}
          <div className="mt-1.5 flex gap-2">
            <input
              type="number"
              min={1}
              max={60}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              aria-label={t("kit.builder.length")}
              className={`${input} w-24`}
            />
            <select value={unit} onChange={(e) => setUnit(e.target.value as typeof unit)} aria-label={t("kit.builder.length")} className={input}>
              <option value="day">{t("kit.builder.unit.day")}</option>
              <option value="week">{t("kit.builder.unit.week")}</option>
              <option value="month">{t("kit.builder.unit.month")}</option>
            </select>
          </div>
        </div>
        <fieldset className="text-sm text-muted">
          <legend>{t("kit.builder.tone")}</legend>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {TONES[lang].map((x, i) => (
              <button
                key={x}
                type="button"
                aria-pressed={tone === i}
                onClick={() => setTone(i)}
                className={`rounded-full border px-3 py-1.5 text-sm ${tone === i ? "border-highlight bg-highlight text-[#14161a]" : "border-line hover:text-ink"}`}
              >
                {x}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="text-sm text-muted sm:col-span-2">
          <legend>{t("kit.builder.formats")}</legend>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {FORMATS[lang].map((f, i) => {
              const on = formats.includes(i);
              return (
                <button
                  key={f}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setFormats(on ? formats.filter((x) => x !== i) : [...formats, i])}
                  className={`rounded-full border px-3 py-1.5 text-sm ${on ? "border-accent bg-accent/25 text-ink" : "border-line hover:text-ink"}`}
                >
                  {f}
                </button>
              );
            })}
          </div>
        </fieldset>
        <label className="text-sm text-muted sm:col-span-2">
          {t("kit.builder.extra")}
          <input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder={t("kit.builder.extraPh")} maxLength={300} className={`${input} mt-1.5`} />
        </label>
      </div>

      <div className="mt-6 rounded-3xl border border-dashed border-white/15 bg-black/20 p-4">
        <p className="text-xs uppercase tracking-wider text-faint">{t("kit.builder.preview")}</p>
        <p className={`mt-2 leading-relaxed ${prompt ? "text-ink" : "text-faint"}`} aria-live="polite">
          {prompt || t("kit.builder.empty")}
        </p>
      </div>

      <button
        type="button"
        disabled={!prompt}
        onClick={() => onUse(prompt)}
        className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-highlight px-6 py-3 font-semibold text-[#14161a] transition hover:brightness-95 disabled:opacity-40"
      >
        {t("kit.builder.use")} <ArrowUpRight size={18} />
      </button>
    </section>
  );
}
