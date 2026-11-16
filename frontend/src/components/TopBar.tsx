"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Wrench } from "lucide-react";
import { setLang, useT, type Lang } from "@/lib/i18n";

export function LangSwitch() {
  const { t, lang } = useT();
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return (
    <div role="group" aria-label={t("lang.switch")} className="flex rounded-full border border-line bg-black/20 p-1 text-xs font-medium">
      {(["en", "fr"] as Lang[]).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`rounded-full px-3 py-1.5 transition-colors ${
            lang === l ? "bg-accent text-white" : "text-muted hover:text-ink"
          }`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

/** Slim header shared by every page: brand, toolkit, language. */
export function TopBar({ active }: { active?: "studio" | "toolkit" }) {
  const { t } = useT();
  return (
    <div className="flex items-center justify-between gap-4">
      <Link href="/" className="flex items-center gap-2.5" aria-label="Datedly AI">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-lg font-bold text-[#0b0820]">D</span>
        <span className="text-lg font-semibold tracking-tight">
          Datedly<span className="text-accent-2">.AI</span>
        </span>
      </Link>
      <nav className="flex items-center gap-2 sm:gap-3">
        <Link
          href="/"
          className={`hidden rounded-full px-3.5 py-2 text-sm transition-colors sm:inline-block ${
            active === "studio" ? "text-ink" : "text-muted hover:text-ink"
          }`}
        >
          {t("nav.studio")}
        </Link>
        <Link
          href="/toolkit"
          className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm transition-colors ${
            active === "toolkit" ? "border-accent/60 bg-accent/15 text-ink" : "border-line text-muted hover:text-ink"
          }`}
        >
          <Wrench size={15} /> {t("nav.toolkit")}
        </Link>
        <LangSwitch />
      </nav>
    </div>
  );
}
