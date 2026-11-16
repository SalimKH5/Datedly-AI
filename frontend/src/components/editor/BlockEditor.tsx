"use client";

import { useId } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import type { Block } from "@/lib/api";
import { useT, type Key } from "@/lib/i18n";
import { field } from "./ui";

export const NEW_BLOCKS: Record<string, () => Block> = {
  text: () => ({ type: "text", body: "" }),
  fact: () => ({ type: "fact", body: "" }),
  story: () => ({ type: "story", body: "" }),
  challenge: () => ({ type: "challenge", body: "" }),
  activity: () => ({ type: "activity", body: "", steps: [] }),
  quiz: () => ({ type: "quiz", question: "", choices: ["", "", ""], answer_index: 0, explanation: "" }),
  resource: () => ({ type: "resource", label: "", url: "" }),
  image_prompt: () => ({ type: "image_prompt", description: "" }),
};

function Area({ value, onChange, rows = 3, label }: { value: string; onChange: (v: string) => void; rows?: number; label: string }) {
  return (
    <textarea aria-label={label} value={value} rows={rows} onChange={(e) => onChange(e.target.value)} className={`${field} resize-y leading-relaxed`} />
  );
}

export function BlockEditor({
  block,
  onChange,
  onRemove,
  onMove,
  isFirst,
  isLast,
}: {
  block: Block;
  onChange: (b: Block) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const { t } = useT();
  const uid = useId();
  const label = t(`block.${block.type}` as Key);

  let body: React.ReactNode;
  switch (block.type) {
    case "text":
    case "fact":
    case "story":
    case "challenge":
      body = <Area label={label} value={block.body} rows={block.type === "text" || block.type === "story" ? 5 : 3} onChange={(v) => onChange({ ...block, body: v })} />;
      break;
    case "activity":
      body = (
        <div className="space-y-2">
          <Area label={t("ed.intro")} rows={2} value={block.body} onChange={(v) => onChange({ ...block, body: v })} />
          <p className="text-xs text-faint">{t("ed.steps")}</p>
          <Area
            label={t("ed.steps")}
            rows={4}
            value={block.steps.join("\n")}
            onChange={(v) => onChange({ ...block, steps: v.split("\n") })}
          />
        </div>
      );
      break;
    case "quiz": {
      const setChoice = (i: number, v: string) => onChange({ ...block, choices: block.choices.map((c, j) => (j === i ? v : c)) });
      const removeChoice = (i: number) => {
        const choices = block.choices.filter((_, j) => j !== i);
        const answer = block.answer_index === i ? 0 : block.answer_index > i ? block.answer_index - 1 : block.answer_index;
        onChange({ ...block, choices, answer_index: Math.min(answer, Math.max(0, choices.length - 1)) });
      };
      body = (
        <div className="space-y-3">
          <input aria-label={t("ed.question")} placeholder={t("ed.question")} value={block.question} onChange={(e) => onChange({ ...block, question: e.target.value })} className={field} />
          <fieldset>
            <legend className="text-xs text-faint">{t("ed.choices")}</legend>
            <div className="mt-2 space-y-2">
              {block.choices.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`answer-${uid}`}
                    checked={block.answer_index === i}
                    onChange={() => onChange({ ...block, answer_index: i })}
                    aria-label={t("ed.choice", { n: i + 1 })}
                    className="h-4 w-4 shrink-0 accent-[var(--ok)]"
                  />
                  <input
                    value={c}
                    placeholder={t("ed.choice", { n: i + 1 })}
                    onChange={(e) => setChoice(i, e.target.value)}
                    className={`${field} py-2 ${block.answer_index === i ? "border-ok/60" : ""}`}
                  />
                  {block.choices.length > 2 && (
                    <button type="button" onClick={() => removeChoice(i)} aria-label={t("common.delete")} className="rounded-lg p-1.5 text-faint hover:text-danger">
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {block.choices.length < 6 && (
              <button type="button" onClick={() => onChange({ ...block, choices: [...block.choices, ""] })} className="mt-2 inline-flex items-center gap-1 text-sm text-accent-2 hover:underline">
                <Plus size={14} /> {t("ed.addChoice")}
              </button>
            )}
          </fieldset>
          <p className="text-xs text-faint">{t("ed.explanation")}</p>
          <Area label={t("ed.explanation")} rows={2} value={block.explanation ?? ""} onChange={(v) => onChange({ ...block, explanation: v })} />
        </div>
      );
      break;
    }
    case "resource": {
      const bad = !!block.url && !block.url.startsWith("https://");
      body = (
        <div className="grid gap-2 sm:grid-cols-2">
          <input aria-label={t("ed.label")} placeholder={t("ed.label")} value={block.label} onChange={(e) => onChange({ ...block, label: e.target.value })} className={field} />
          <div>
            <input
              aria-label={t("ed.url")}
              placeholder={t("ed.url")}
              value={block.url ?? ""}
              onChange={(e) => onChange({ ...block, url: e.target.value })}
              className={`${field} ${bad ? "border-warn/70" : ""}`}
              inputMode="url"
            />
            {bad && <p className="mt-1 text-xs text-warn">{t("ed.urlInvalid")}</p>}
          </div>
        </div>
      );
      break;
    }
    case "image_prompt":
      body = <Area label={label} rows={2} value={block.description} onChange={(v) => onChange({ ...block, description: v })} />;
      break;
    default:
      body = <pre className="overflow-x-auto rounded-xl bg-black/30 p-3 text-xs text-muted">{JSON.stringify(block, null, 2)}</pre>;
  }

  return (
    <div className="rounded-3xl border border-line bg-white/[0.02] p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="rounded-full border border-line px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider text-accent-2">{label}</span>
        <div className="flex items-center gap-0.5 text-faint">
          <button type="button" disabled={isFirst} onClick={() => onMove(-1)} aria-label={t("ed.moveUp")} className="rounded-lg p-1.5 hover:text-ink disabled:opacity-30">
            <ArrowUp size={15} />
          </button>
          <button type="button" disabled={isLast} onClick={() => onMove(1)} aria-label={t("ed.moveDown")} className="rounded-lg p-1.5 hover:text-ink disabled:opacity-30">
            <ArrowDown size={15} />
          </button>
          <button type="button" onClick={onRemove} aria-label={t("ed.removeBlock")} title={t("ed.removeBlock")} className="rounded-lg p-1.5 hover:text-danger">
            <Trash2 size={15} />
          </button>
        </div>
      </div>
      {body}
    </div>
  );
}
