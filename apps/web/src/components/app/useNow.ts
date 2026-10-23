"use client";

import { useEffect, useState } from "react";

/** Ticks while something is running: every second for a clock or a countdown, or at `every` ms for "2 min ago" lines. */
export function useNow(on: boolean, every = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(t);
  }, [on, every]);
  return now;
}
