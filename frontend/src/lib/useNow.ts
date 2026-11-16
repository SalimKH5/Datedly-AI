"use client";

import { useSyncExternalStore } from "react";

const TICK = 15_000;

function subscribe(onChange: () => void) {
  const t = setInterval(onChange, TICK);
  return () => clearInterval(t);
}
// Rounded so the snapshot is stable between renders inside one tick.
const getSnapshot = () => Math.floor(Date.now() / TICK) * TICK;
const getServerSnapshot = () => 0;

/** Current time, refreshed every 15 s. `null` during the server/static render. */
export function useNow(): Date | null {
  const t = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return t ? new Date(t) : null;
}
