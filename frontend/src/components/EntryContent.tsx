"use client";

import { useState } from "react";
import { BookOpen, ExternalLink, ImageIcon, Lightbulb, ListChecks, Target } from "lucide-react";
import type { Block } from "@/lib/api";
import type { Lang } from "@/lib/i18n";

// Labels inside a calendar follow the calendar's language, not the studio's.
const L = {
  en: { quiz: "Quiz", fact: "Did you know?", challenge: "Today's challenge", steps: "Steps", correct: "Correct! ", answer: "Answer: ", more: "To go further", image: "Illustration idea:" },
  fr: { quiz: "Quiz", fact: "Le saviez-vous ?", challenge: "Défi du jour", steps: "Étapes", correct: "Bravo ! ", answer: "Réponse : ", more: "Pour aller plus loin", image: "Idée d'illustration :" },
};

function Quiz({ block, l }: { block: Extract<Block, { type: "quiz" }>; l: (typeof L)["en"] }) {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <div className="rounded-3xl border border-line bg-black/20 p-5">
      <p className="text-xs uppercase tracking-wider text-accent-2">{l.quiz}</p>
      <p className="mt-2 text-lg">{block.question}</p>
      <div className="mt-4 grid gap-2">
        {block.choices.map((c, i) => {
          const correct = i === block.answer_index;
          const state = picked === null ? "idle" : correct ? "right" : picked === i ? "wrong" : "idle";
          return (
            <button
              key={i}
              type="button"
              disabled={picked !== null}
              onClick={() => setPicked(i)}
              className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                state === "right"
                  ? "border-ok bg-ok/15"
                  : state === "wrong"
                    ? "border-danger bg-danger/15"
                    : "border-line hover:border-accent/60 disabled:hover:border-line"
              }`}
            >
              {c}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <p className="mt-4 text-sm text-muted" role="status">
          <span className={picked === block.answer_index ? "text-ok" : "text-danger"}>
            {picked === block.answer_index ? l.correct : `${l.answer}${block.choices[block.answer_index]}. `}
          </span>
          {block.explanation}
        </p>
      )}
    </div>
  );
}

function Callout({ icon: Icon, label, children }: { icon: typeof Target; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-3xl border border-line bg-accent/10 p-5">
      <Icon size={20} className="mt-0.5 shrink-0 text-accent-2" />
      <div>
        <p className="text-xs uppercase tracking-wider text-accent-2">{label}</p>
        <div className="mt-1.5 leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

/** Renders any entry, whatever formats the AI chose for it. */
export function EntryContent({ blocks, lang = "en" }: { blocks: Block[]; lang?: Lang }) {
  const l = L[lang];
  const resources = blocks.filter((b): b is Extract<Block, { type: "resource" }> => b.type === "resource");
  return (
    <div className="space-y-4">
      {blocks.map((b, i) => {
        switch (b.type) {
          case "text":
            return (
              <p key={i} className="whitespace-pre-line text-lg leading-relaxed">
                {b.body}
              </p>
            );
          case "story":
            return (
              <p key={i} className="whitespace-pre-line font-light text-lg italic leading-relaxed">
                <BookOpen size={18} className="mr-2 inline text-accent-2" />
                {b.body}
              </p>
            );
          case "fact":
            return (
              <Callout key={i} icon={Lightbulb} label={l.fact}>
                {b.body}
              </Callout>
            );
          case "challenge":
            return (
              <Callout key={i} icon={Target} label={l.challenge}>
                {b.body}
              </Callout>
            );
          case "activity":
            return (
              <Callout key={i} icon={ListChecks} label={l.steps}>
                {b.body && <p className="mb-2">{b.body}</p>}
                <ol className="list-decimal space-y-1 pl-5">
                  {b.steps.map((s, j) => (
                    <li key={j}>{s.replace(/^\d+[.)]\s*/, "")}</li>
                  ))}
                </ol>
              </Callout>
            );
          case "quiz":
            return <Quiz key={i} block={b} l={l} />;
          case "image_prompt":
            return (
              <p key={i} className="flex gap-2 text-sm text-faint">
                <ImageIcon size={16} className="mt-0.5 shrink-0" />
                <span>{l.image} {b.description}</span>
              </p>
            );
          case "custom":
            return (
              <Callout key={i} icon={Lightbulb} label={b.label}>
                <pre className="whitespace-pre-wrap text-sm">{JSON.stringify(b.data, null, 2)}</pre>
              </Callout>
            );
          default:
            return null;
        }
      })}
      {resources.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wider text-faint">{l.more}</p>
          <ul className="mt-2 space-y-1">
            {resources.map((r, i) => (
              <li key={i}>
                {r.url ? (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="inline-flex items-center gap-1.5 text-accent-2 underline-offset-4 hover:underline"
                  >
                    {r.label} <ExternalLink size={14} />
                  </a>
                ) : (
                  <span className="text-muted">{r.label}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
