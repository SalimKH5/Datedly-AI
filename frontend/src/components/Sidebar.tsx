"use client";

import Link from "next/link";
import { Home, Sparkles, CalendarRange, Cpu, Wrench } from "lucide-react";
import { useT, type Key } from "@/lib/i18n";

const items: { href: string; label: Key; icon: typeof Home }[] = [
  { href: "#top", label: "nav.home", icon: Home },
  { href: "#create", label: "nav.create", icon: Sparkles },
  { href: "#calendars", label: "nav.calendars", icon: CalendarRange },
  { href: "#ai", label: "nav.ai", icon: Cpu },
  { href: "/toolkit", label: "nav.toolkit", icon: Wrench },
];

export function Sidebar() {
  const { t } = useT();
  return (
    <nav
      aria-label="Main"
      className="glass fixed bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-2 rounded-3xl p-2
                 lg:sticky lg:top-6 lg:left-auto lg:bottom-auto lg:h-[calc(100vh-3rem)] lg:translate-x-0 lg:flex-col lg:rounded-[2rem] lg:p-3"
    >
      <div className="hidden items-center justify-center gap-1.5 pb-4 pt-1 lg:flex" aria-hidden>
        <span className="h-2.5 w-2.5 rounded-full bg-pink-500" />
        <span className="h-2.5 w-2.5 rounded-full bg-indigo-900" />
        <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
      </div>
      {items.map(({ href, label, icon: Icon }, i) => {
        const cls = `grid h-12 w-12 place-items-center rounded-2xl transition-colors ${
          i === 0 ? "bg-accent text-white shadow-lg shadow-violet-900/50" : "text-muted hover:bg-surface-strong hover:text-ink"
        }`;
        const inner = (
          <>
            <Icon size={22} strokeWidth={1.75} />
            <span className="sr-only">{t(label)}</span>
          </>
        );
        return href.startsWith("/") ? (
          <Link key={href} href={href} title={t(label)} className={cls}>
            {inner}
          </Link>
        ) : (
          <a key={href} href={href} title={t(label)} className={cls}>
            {inner}
          </a>
        );
      })}
    </nav>
  );
}
