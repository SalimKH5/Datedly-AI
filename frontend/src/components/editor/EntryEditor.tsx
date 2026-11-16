"use client";

import { useState } from "react";
import { Check, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { api, type Block, type Entry } from "@/lib/api";
import { useT, type Key } from "@/lib/i18n";
import { BlockEditor, NEW_BLOCKS } from "./BlockEditor";
import { Field, field } from "./ui";

const TYPES = ["text", "lesson", "quiz", "challenge", "fact", "story", "activity", "recipe", "discovery", "recommendation"];
const QUICK: Key[] = ["ed.quick.shorter", "ed.quick.easier", "ed.quick.quiz", "ed.quick.challenge", "ed.quick.fun"];

export function EntryEditor({
  calendarId,
  entry,
  onChange,
  onDelete,
}: {
  calendarId: string;
  entry: Entry;
  onChange: (e: Entry) => void;
  onDelete: () => void;
}) {
  const { t } = useT();
  const [instruction, setInstruction] = useState("");
  const [aiState, setAiState] = useState<"idle" | "working" | "done">("idle");
  const [aiError, setAiError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const setBlocks = (blocks: Block[]) => onChange({ ...entry, blocks });
  const moveBlock = (i: number, dir: -1 | 1) => {
    const b = [...entry.blocks];
    const [m] = b.splice(i, 1);
    b.splice(i + dir, 0, m);
    setBlocks(b);
  };

  async function rewrite(text: string) {
    setAiState("working");
    setAiError(null);
    try {
      const fresh = await api.regenerateEntry(calendarId, entry, text);
      onChange(fresh);
      setAiState("done");
    } catch (e) {
      setAiError((e as Error).message);
      setAiState("idle");
    }
  }

  const needsReview = entry.metadata?.needs_review === true;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-accent-2 tabular-nums">#{entry.index}</p>
        {confirmDelete ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted">{t("ed.confirmDeleteEntry")}</span>
            <button type="button" onClick={onDelete} className="rounded-xl bg-red-600 px-3 py-1.5 text-white hover:bg-red-500">
              {t("common.delete")}
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-xl border border-line px-3 py-1.5 hover:bg-surface-strong">
              {t("common.cancel")}
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-1.5 rounded-xl px-2 py-1 text-sm text-faint hover:text-danger">
            <Trash2 size={15} /> {t("ed.deleteEntry")}
          </button>
        )}
      </div>

      {needsReview && <p className="rounded-2xl border border-warn/40 bg-warn/10 px-4 py-2 text-sm text-warn">{t("cal.needsReview")}</p>}

      <Field label={t("ed.entryTitle")}>
        <input value={entry.title} maxLength={140} onChange={(e) => onChange({ ...entry, title: e.target.value })} className={`${field} text-lg`} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("ed.type")}>
          <input
            list="entry-types"
            value={entry.content_type}
            maxLength={40}
            onChange={(e) => onChange({ ...entry, content_type: e.target.value })}
            className={field}
          />
          <datalist id="entry-types">
            {TYPES.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
        </Field>
        <Field label={t("ed.date")}>
          <input type="date" value={entry.date} required onChange={(e) => e.target.value && onChange({ ...entry, date: e.target.value })} className={field} />
        </Field>
      </div>

      {/* AI rewrite */}
      <section aria-labelledby="ai-rewrite" className="rounded-3xl border border-accent/30 bg-accent/10 p-4">
        <h3 id="ai-rewrite" className="flex items-center gap-2 text-sm font-medium">
          <Sparkles size={16} className="text-accent-2" /> {t("ed.ai")}
        </h3>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={instruction}
            maxLength={500}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && aiState !== "working") {
                e.preventDefault();
                rewrite(instruction);
              }
            }}
            placeholder={t("ed.aiHint")}
            className={field}
            aria-label={t("ed.aiHint")}
          />
          <button
            type="button"
            disabled={aiState === "working"}
            onClick={() => rewrite(instruction)}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-2.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
          >
            {aiState === "working" ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {t("ed.ai")}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {QUICK.map((k) => (
            <button
              key={k}
              type="button"
              disabled={aiState === "working"}
              onClick={() => {
                setInstruction(t(k));
                rewrite(t(k));
              }}
              className="rounded-full border border-line px-3 py-1 text-xs text-muted hover:border-accent/60 hover:text-ink disabled:opacity-50"
            >
              {t(k)}
            </button>
          ))}
        </div>
        <p className="mt-2 min-h-5 text-xs" role="status">
          {aiState === "working" && <span className="text-muted">{t("ed.aiWorking")}</span>}
          {aiState === "done" && (
            <span className="inline-flex items-center gap-1 text-ok">
              <Check size={14} /> {t("ed.aiDone")}
            </span>
          )}
          {aiError && <span className="text-danger">{aiError}</span>}
        </p>
      </section>

      <section aria-labelledby="blocks-title" className="space-y-3">
        <h3 id="blocks-title" className="text-sm text-muted">
          {t("ed.blocks")}
        </h3>
        {entry.blocks.map((b, i) => (
          <BlockEditor
            key={`${entry.id}-${i}-${b.type}`}
            block={b}
            isFirst={i === 0}
            isLast={i === entry.blocks.length - 1}
            onMove={(d) => moveBlock(i, d)}
            onRemove={() => setBlocks(entry.blocks.filter((_, j) => j !== i))}
            onChange={(nb) => setBlocks(entry.blocks.map((x, j) => (j === i ? nb : x)))}
          />
        ))}
        <div className="flex flex-wrap items-center gap-2 rounded-3xl border border-dashed border-line p-3">
          <span className="inline-flex items-center gap-1 px-1 text-sm text-faint">
            <Plus size={14} /> {t("ed.addBlock")}
          </span>
          {Object.keys(NEW_BLOCKS).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setBlocks([...entry.blocks, NEW_BLOCKS[type]()])}
              className="rounded-full border border-line px-3 py-1 text-xs text-muted hover:border-accent/60 hover:text-ink"
            >
              {t(`block.${type}` as Key)}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
