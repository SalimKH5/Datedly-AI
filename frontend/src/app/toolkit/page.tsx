"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, BookOpen, Cpu, Keyboard, LifeBuoy, ListChecks, Pencil, X } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { PromptBuilder } from "@/components/toolkit/PromptBuilder";
import { ToolGuide, type ToolId } from "@/components/toolkit/ToolGuides";
import { api } from "@/lib/api";
import { useT, type Key } from "@/lib/i18n";

const TOOLS: { id: ToolId; icon: typeof BookOpen; cat: Key; title: Key; desc: Key }[] = [
  { id: "recipes", icon: BookOpen, cat: "kit.cat.prompt", title: "kit.tool.recipes", desc: "kit.tool.recipes.d" },
  { id: "checklist", icon: ListChecks, cat: "kit.cat.prompt", title: "kit.tool.checklist", desc: "kit.tool.checklist.d" },
  { id: "models", icon: Cpu, cat: "kit.cat.ai", title: "kit.tool.models", desc: "kit.tool.models.d" },
  { id: "editing", icon: Pencil, cat: "kit.cat.edit", title: "kit.tool.editing", desc: "kit.tool.editing.d" },
  { id: "shortcuts", icon: Keyboard, cat: "kit.cat.guide", title: "kit.tool.shortcuts", desc: "kit.tool.shortcuts.d" },
  { id: "trouble", icon: LifeBuoy, cat: "kit.cat.help", title: "kit.tool.trouble", desc: "kit.tool.trouble.d" },
];

/* Illustrations drawn in CSS, one per step, so the page needs no image files. */
function ArtDescribe() {
  return (
    <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_20%_100%,#7c3aed_0%,transparent_55%),radial-gradient(90%_80%_at_100%_0%,#db2777_0%,transparent_55%),#120a2a]">
      <div className="absolute left-6 right-10 top-1/2 -translate-y-1/2 rounded-2xl border border-white/15 bg-black/40 p-4 backdrop-blur">
        <div className="h-2 w-3/4 rounded-full bg-white/70" />
        <div className="mt-2 h-2 w-1/2 rounded-full bg-white/40" />
        <div className="mt-4 flex items-center gap-2">
          <span className="h-6 w-20 rounded-full bg-violet-500" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-pink-300" />
        </div>
      </div>
    </div>
  );
}
function ArtRefine() {
  return (
    <div className="absolute inset-0 bg-[radial-gradient(110%_90%_at_80%_100%,#0891b2_0%,transparent_55%),radial-gradient(80%_70%_at_0%_0%,#4f46e5_0%,transparent_55%),#08142a]">
      <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 space-y-2">
        {[90, 70, 80].map((w, i) => (
          <div key={i} className={`flex items-center gap-3 rounded-xl border border-white/10 px-3 py-2 ${i === 1 ? "translate-x-4 bg-cyan-400/25" : "bg-black/35"}`}>
            <span className="text-xs text-white/60">{i + 1}</span>
            <span className="h-1.5 rounded-full bg-white/60" style={{ width: `${w}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}
function ArtPublish() {
  return (
    <div className="absolute inset-0 bg-[radial-gradient(110%_90%_at_10%_100%,#ea580c_0%,transparent_55%),radial-gradient(80%_70%_at_100%_10%,#be185d_0%,transparent_55%),#1c0b12]">
      <div className="absolute inset-x-10 top-1/2 grid -translate-y-1/2 grid-cols-6 gap-1.5">
        {Array.from({ length: 18 }, (_, i) => (
          <span
            key={i}
            className={`grid aspect-square place-items-center rounded-md text-[9px] ${i < 7 ? "bg-orange-300/80 text-[#3b0d0d]" : "border border-white/15 bg-black/30 text-white/40"}`}
          >
            {i + 1}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function ToolkitPage() {
  const { t } = useT();
  const router = useRouter();
  const [tool, setTool] = useState<ToolId | null>(null);
  const [latest, setLatest] = useState<string | null>(null);

  useEffect(() => {
    api.listCalendars().then((l) => setLatest(l[0]?.id ?? null), () => {});
  }, []);
  useEffect(() => {
    if (!tool) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setTool(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tool]);

  const applyPrompt = (p: string) => router.push(`/?prompt=${encodeURIComponent(p)}`);
  const open = TOOLS.find((x) => x.id === tool);

  const features = [
    { tag: "kit.tag.describe", h: "kit.describe.h", p: "kit.describe.p", cta: "kit.describe.cta", href: "/#create", Art: ArtDescribe },
    { tag: "kit.tag.refine", h: "kit.refine.h", p: "kit.refine.p", cta: "kit.refine.cta", href: latest ? `/calendar?id=${latest}&mode=edit` : "/#calendars", Art: ArtRefine },
    { tag: "kit.tag.publish", h: "kit.publish.h", p: "kit.publish.p", cta: "kit.publish.cta", href: null, Art: ArtPublish },
  ] as const;

  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 pt-6 sm:px-6">
      <TopBar active="toolkit" />

      <header className="mt-12">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">{t("kit.title")}</h1>
        <p className="mt-3 text-lg text-muted">{t("kit.subtitle")}</p>
      </header>

      {/* Three steps, image cards with a pill tag and a call to action */}
      <div className="mt-10 grid gap-8 md:grid-cols-3">
        {features.map(({ tag, h, p, cta, href, Art }) => {
          const card = (
            <div className="group relative aspect-[16/10] overflow-hidden rounded-[1.75rem] border border-white/10 transition group-hover:border-white/30">
              <Art />
              <span className="absolute left-4 top-4 rounded-full bg-black/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] backdrop-blur">
                {t(tag)}
              </span>
              <span className="absolute bottom-4 left-5 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.15em]">
                {t(cta)} {href && <ArrowUpRight size={14} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />}
              </span>
            </div>
          );
          return (
            <article key={tag}>
              {href ? (
                <Link href={href} className="group block rounded-[1.75rem]">
                  {card}
                </Link>
              ) : (
                <div className="opacity-80">{card}</div>
              )}
              <h2 className="mt-5 text-xl font-semibold">{t(h)}</h2>
              <p className="mt-1.5 text-muted">{t(p)}</p>
            </article>
          );
        })}
      </div>

      {/* Prompt builder + tool grid */}
      <div className="mt-14 grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <PromptBuilder onUse={applyPrompt} />
        <section aria-labelledby="tools-title">
          <h2 id="tools-title" className="sr-only">
            {t("kit.tools")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TOOLS.map(({ id, icon: Icon, cat, title, desc }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTool(id)}
                className="glass group flex min-h-40 flex-col rounded-[1.5rem] p-5 text-left transition hover:border-accent/50 hover:bg-surface-strong"
              >
                <span className="flex w-full items-start justify-between">
                  <Icon size={22} strokeWidth={1.6} className="text-ink" />
                  <span className="text-xs text-faint">{t(cat)}</span>
                </span>
                <span className="mt-auto pt-6 text-lg font-medium">{t(title)}</span>
                <span className="mt-1 text-sm text-muted">{t(desc)}</span>
              </button>
            ))}
          </div>
        </section>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-6" onClick={() => setTool(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="tool-title"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-t-[2rem] border border-line bg-[#120f2e] p-6 sm:rounded-[2rem] sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.15em] text-accent-2">{t(open.cat)}</p>
                <h2 id="tool-title" className="mt-1 text-2xl font-semibold">
                  {t(open.title)}
                </h2>
                <p className="mt-1 text-muted">{t(open.desc)}</p>
              </div>
              <button
                type="button"
                autoFocus
                onClick={() => setTool(null)}
                aria-label={t("common.close")}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted hover:bg-surface-strong hover:text-ink"
              >
                <X size={20} />
              </button>
            </div>
            <div className="mt-6">
              <ToolGuide id={open.id} onUse={applyPrompt} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
