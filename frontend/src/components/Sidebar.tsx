import { Home, Sparkles, CalendarRange, Cpu } from "lucide-react";

const items = [
  { href: "#top", label: "Home", icon: Home },
  { href: "#create", label: "Create", icon: Sparkles },
  { href: "#calendars", label: "Calendars", icon: CalendarRange },
  { href: "#ai", label: "AI engine", icon: Cpu },
];

export function Sidebar() {
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
      {items.map(({ href, label, icon: Icon }, i) => (
        <a
          key={href}
          href={href}
          title={label}
          className={`grid h-12 w-12 place-items-center rounded-2xl transition-colors ${
            i === 0
              ? "bg-accent text-white shadow-lg shadow-violet-900/50"
              : "text-muted hover:bg-surface-strong hover:text-ink"
          }`}
        >
          <Icon size={22} strokeWidth={1.75} />
          <span className="sr-only">{label}</span>
        </a>
      ))}
    </nav>
  );
}
