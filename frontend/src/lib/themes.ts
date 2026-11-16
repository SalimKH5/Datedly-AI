// Visual palettes the AI can pick for a calendar (must match backend THEMES).
export const THEMES: Record<string, { accent: string; soft: string; label: string }> = {
  aurora: { accent: "#8b5cf6", soft: "#a78bfa", label: "Aurora" },
  ember: { accent: "#f97316", soft: "#fdba74", label: "Ember" },
  forest: { accent: "#10b981", soft: "#6ee7b7", label: "Forest" },
  ocean: { accent: "#3b82f6", soft: "#93c5fd", label: "Ocean" },
  candy: { accent: "#ec4899", soft: "#f9a8d4", label: "Candy" },
  mono: { accent: "#94a3b8", soft: "#e2e8f0", label: "Mono" },
  arcade: { accent: "#ff7a1a", soft: "#ffb066", label: "Arcade" },
};

export function themeStyle(theme: string): React.CSSProperties {
  const t = THEMES[theme] ?? THEMES.aurora;
  return { "--accent": t.accent, "--accent-2": t.soft } as React.CSSProperties;
}
