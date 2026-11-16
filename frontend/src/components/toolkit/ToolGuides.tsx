"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { CHECKLIST, EDITING_TIPS, MODEL_GUIDE, RECIPES, SHORTCUTS, TROUBLE } from "@/lib/content";

export type ToolId = "recipes" | "checklist" | "models" | "editing" | "shortcuts" | "trouble";

function CopyCode({ code }: { code: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-black/40 px-3 py-2 font-mono text-sm">
      <code>{code}</code>
      <button
        type="button"
        aria-label="Copy"
        onClick={() => {
          navigator.clipboard?.writeText(code).then(() => setDone(true), () => {});
          setTimeout(() => setDone(false), 1500);
        }}
        className="rounded-md p-1 text-faint hover:text-ink"
      >
        {done ? <Check size={14} className="text-ok" /> : <Copy size={14} />}
      </button>
    </div>
  );
}

function Recipes({ onUse }: { onUse: (prompt: string) => void }) {
  const { t, lang } = useT();
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {RECIPES[lang].map((r) => (
        <li key={r.title} className="flex flex-col rounded-3xl border border-line bg-white/[0.02] p-4">
          <span className="w-fit rounded-full border border-line px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent-2">{r.category}</span>
          <p className="mt-3 font-medium">{r.title}</p>
          <p className="mt-1 flex-1 text-sm leading-relaxed text-muted">{r.prompt}</p>
          <button type="button" onClick={() => onUse(r.prompt)} className="mt-4 w-fit rounded-xl bg-accent px-3.5 py-1.5 text-sm font-medium text-white hover:brightness-110">
            {t("kit.use")} ↗
          </button>
        </li>
      ))}
    </ul>
  );
}

function Models() {
  const { lang } = useT();
  const [installed, setInstalled] = useState<string[] | null>(null);
  useEffect(() => {
    api.aiStatus().then((s) => setInstalled(s.status.models.map((m) => m.name)), () => setInstalled([]));
  }, []);
  const has = (names: string) => names.split(" · ").some((n) => installed?.some((i) => i.startsWith(n.replace(/ \(.*\)/, ""))));
  return (
    <ul className="space-y-3">
      {MODEL_GUIDE[lang].map((m) => (
        <li key={m.name} className="rounded-3xl border border-line bg-white/[0.02] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <code className="text-sm text-ink">{m.name}</code>
            <span className="rounded-full bg-accent/20 px-2.5 py-0.5 text-xs text-accent-2">{m.verdict}</span>
            {installed && has(m.name) && <span className="rounded-full border border-ok/40 px-2.5 py-0.5 text-xs text-ok">✓ {lang === "fr" ? "installé" : "installed"}</span>}
          </div>
          <p className="mt-2 text-sm text-muted">{m.body}</p>
        </li>
      ))}
      <li>
        <CopyCode code="ollama pull qwen2.5:7b" />
      </li>
    </ul>
  );
}

export function ToolGuide({ id, onUse }: { id: ToolId; onUse: (prompt: string) => void }) {
  const { lang } = useT();
  switch (id) {
    case "recipes":
      return <Recipes onUse={onUse} />;
    case "checklist":
      return (
        <ol className="space-y-3">
          {CHECKLIST[lang].map((c, i) => (
            <li key={c.title} className="flex gap-4 rounded-3xl border border-line bg-white/[0.02] p-4">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-highlight text-sm font-semibold text-[#14161a]">{i + 1}</span>
              <div>
                <p className="font-medium">{c.title}</p>
                <p className="mt-1 text-sm text-muted">{c.body}</p>
              </div>
            </li>
          ))}
        </ol>
      );
    case "models":
      return <Models />;
    case "editing":
      return (
        <ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed text-muted marker:text-accent-2">
          {EDITING_TIPS[lang].map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ol>
      );
    case "shortcuts":
      return (
        <dl className="divide-y divide-line">
          {SHORTCUTS[lang].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-4 py-3">
              <dt>
                <kbd className="rounded-lg border border-line bg-black/40 px-2 py-1 font-mono text-xs">{k}</kbd>
              </dt>
              <dd className="text-right text-sm text-muted">{v}</dd>
            </div>
          ))}
        </dl>
      );
    case "trouble":
      return (
        <ul className="space-y-3">
          {TROUBLE[lang].map((x) => (
            <li key={x.q} className="rounded-3xl border border-line bg-white/[0.02] p-4">
              <p className="font-medium">{x.q}</p>
              <p className="mt-1 text-sm text-muted">{x.a}</p>
              {x.code && <CopyCode code={x.code} />}
            </li>
          ))}
        </ul>
      );
  }
}
