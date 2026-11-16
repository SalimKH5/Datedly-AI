"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Lock } from "lucide-react";
import { loadPublicIndex, type PublicIndexItem } from "@/lib/publicData";
import { THEMES } from "@/lib/themes";
import { LangSwitch } from "@/components/TopBar";
import { useT } from "@/lib/i18n";

/** Home page of the published site (GitHub Pages): the list of public calendars. */
export function PublicHome() {
  const { lang } = useT();
  const [items, setItems] = useState<PublicIndexItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    loadPublicIndex().then(setItems, () => setFailed(true));
  }, []);

  const fr = lang === "fr";
  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 pt-6 sm:px-6">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-lg font-bold text-[#0b0820]">D</span>
          <span className="text-lg font-semibold tracking-tight">
            Datedly<span className="text-accent-2">.AI</span>
          </span>
        </span>
        <LangSwitch />
      </div>

      <header className="mt-16">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">{fr ? "Calendriers à ouvrir" : "Calendars to open"}</h1>
        <p className="mt-3 text-lg text-muted">
          {fr ? "Une case s'ouvre à chaque date. Revenez chaque jour." : "One entry opens on each date. Come back every day."}
        </p>
      </header>

      {failed && <p className="mt-10 text-muted">{fr ? "Aucun calendrier publié pour l'instant." : "No calendar published yet."}</p>}
      {items && items.length === 0 && <p className="mt-10 text-muted">{fr ? "Aucun calendrier publié pour l'instant." : "No calendar published yet."}</p>}

      <ul className="mt-10 grid gap-5 sm:grid-cols-2">
        {items?.map((c) => {
          const th = THEMES[c.theme] ?? THEMES.aurora;
          const pct = c.entry_count ? (c.unlocked_count / c.entry_count) * 100 : 0;
          return (
            <li key={c.slug}>
              <Link href={`/c?slug=${c.slug}`} className="glass group flex h-full flex-col rounded-[1.75rem] p-6 transition hover:border-white/25">
                <span className="flex items-center justify-between">
                  <span className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-black" style={{ background: th.soft }}>
                    {c.unlocked_count}/{c.entry_count}
                  </span>
                  <ArrowUpRight size={18} className="text-muted transition group-hover:text-ink" />
                </span>
                <span className="mt-5 text-xl font-semibold">{c.title}</span>
                {c.description && <span className="mt-1.5 line-clamp-2 text-muted">{c.description}</span>}
                <span className="mt-6 block h-1.5 overflow-hidden rounded-full bg-white/10">
                  <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: th.accent }} />
                </span>
                {c.next_unlock_at && (
                  <span className="mt-3 inline-flex items-center gap-1.5 text-sm text-faint">
                    <Lock size={13} />
                    {fr ? "Prochaine case le " : "Next entry on "}
                    {new Date(c.next_unlock_at).toLocaleString(fr ? "fr-FR" : "en-US", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
