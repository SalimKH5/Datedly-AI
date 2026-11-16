"use client";

import { useSyncExternalStore } from "react";
import { api, type PublicCalendar } from "./api";

/** "public" on GitHub Pages (static files written by the publish robot), "studio" locally. */
export const SITE_MODE = process.env.NEXT_PUBLIC_SITE_MODE === "public" ? "public" : "studio";
const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export interface PublicIndexItem {
  slug: string;
  title: string;
  description: string;
  theme: string;
  language: string;
  entry_count: number;
  unlocked_count: number;
  next_unlock_at: string | null;
  demo: boolean;
}

async function getJson<T>(path: string): Promise<T> {
  // no-store: a new entry may have been unlocked since the last visit.
  const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(res.status === 404 ? "not-found" : `HTTP ${res.status}`);
  return res.json();
}

/** The public view of one calendar. Never contains locked entries' content. */
export function loadPublicCalendar(slug: string): Promise<PublicCalendar> {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return Promise.reject(new Error("not-found"));
  return SITE_MODE === "public" ? getJson<PublicCalendar>(`/data/${slug}.json`) : api.publicCalendar(slug);
}

export function loadPublicIndex(): Promise<PublicIndexItem[]> {
  return getJson<{ calendars: PublicIndexItem[] }>("/data/index.json").then((d) => d.calendars);
}

// ---------------------------------------------------------------- 1-second clock

const tickListeners = new Set<() => void>();
let tickTimer: ReturnType<typeof setInterval> | null = null;
function subscribeTick(cb: () => void) {
  tickListeners.add(cb);
  tickTimer ??= setInterval(() => tickListeners.forEach((l) => l()), 1000);
  return () => {
    tickListeners.delete(cb);
    if (!tickListeners.size && tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
  };
}
const second = () => Math.floor(Date.now() / 1000) * 1000;

/** Current time, every second (display only: the server decides what is unlocked). */
export function useClock(): number | null {
  const t = useSyncExternalStore(subscribeTick, second, () => 0);
  return t || null;
}

// ---------------------------------------------------------------- entries seen by this visitor

const seenListeners = new Set<() => void>();
const seenCache = new Map<string, string>();
const seenKey = (slug: string) => `datedly.seen.${slug}`;

function readSeen(slug: string): string {
  if (!seenCache.has(slug)) {
    let v = "[]";
    try {
      v = localStorage.getItem(seenKey(slug)) ?? "[]";
    } catch {
      /* storage blocked: progress lasts for this page only */
    }
    seenCache.set(slug, v);
  }
  return seenCache.get(slug)!;
}

export function markSeen(slug: string, index: number) {
  const set = new Set<number>(JSON.parse(readSeen(slug)));
  if (set.has(index)) return;
  set.add(index);
  const v = JSON.stringify([...set].sort((a, b) => a - b));
  seenCache.set(slug, v);
  try {
    localStorage.setItem(seenKey(slug), v);
  } catch {
    /* ignore */
  }
  seenListeners.forEach((l) => l());
}

export function useSeen(slug: string): Set<number> {
  const raw = useSyncExternalStore(
    (cb) => {
      seenListeners.add(cb);
      return () => seenListeners.delete(cb);
    },
    () => readSeen(slug),
    () => "[]",
  );
  return new Set<number>(JSON.parse(raw));
}
