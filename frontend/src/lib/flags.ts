"use client";

import { useSyncExternalStore } from "react";

// Small per-browser flags (onboarding progress, hidden panels).
// Stored in localStorage when available; the app works without it.
const listeners = new Set<() => void>();

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function setFlag(key: string, value = true) {
  try {
    if (value) localStorage.setItem(key, "1");
    else localStorage.removeItem(key);
  } catch {
    /* storage blocked: the flag lasts until the page closes */
  }
  memory.set(key, value);
  listeners.forEach((l) => l());
}

const memory = new Map<string, boolean>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

export function useFlag(key: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => memory.get(key) ?? readFlag(key),
    () => false,
  );
}

export const FLAGS = {
  editorOpened: "datedly.onboarding.editor",
  startHidden: "datedly.onboarding.hidden",
};
