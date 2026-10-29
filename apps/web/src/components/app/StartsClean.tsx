"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * A page that starts clean each time it is shown. next.config.ts has cacheComponents, so Next keeps the last pages visited
 * hidden inside an <Activity>, with all their React state: a button left on "Starting…", an open question, an old error or
 * a finished "done" would be there when the page comes back. React cleans a hidden tree's effects up, so the cleanup counts
 * the visit and the next one mounts everything below from its initial state again (a page's own props, the address and
 * localStorage are read fresh). For a page whose state belongs to one visit (a form that sends and moves on); not for one
 * that should be as it was left (a game's chat).
 */
export function StartsClean({ children }: { children: ReactNode }) {
  const [visit, setVisit] = useState(0);
  const shown = useRef(false);
  useEffect(() => {
    shown.current = true;
    return () => {
      shown.current = false;
      // Strict mode (development) cleans up and sets the effect up again at once: that is not a hidden page, so it
      // doesn't count, or the page would mount twice and drop what was typed in its first moments.
      queueMicrotask(() => {
        if (!shown.current) setVisit((v) => v + 1);
      });
    };
  }, []);
  return <Fragment key={visit}>{children}</Fragment>;
}
