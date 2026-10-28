"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cx } from "./cx";

/**
 * Ask first (DESIGN.md: an estimate over the limit, a cancel, a package-name change): a Field panel with one sentence in
 * 600 15px and its buttons beside it, wrapping under it when narrow. Announced (role alert) unless it is a status.
 * `text` is the sentence; `children` take its place when it is more than one (a preview's states).
 * `reveal`: it opens under the button that was pressed, so when it opens below the fold it scrolls into view (smoothly,
 * at once with reduced motion).
 */
export function Ask({ text, children, actions, role = "alert", className, panel, reveal = false }: { text?: ReactNode; children?: ReactNode; actions: ReactNode; role?: "alert" | "status"; className?: string; panel?: string; reveal?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!reveal || !el || el.getBoundingClientRect().bottom <= window.innerHeight) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "nearest" });
  }, [reveal]);
  return (
    <div ref={box} className={cx("ask", "panel", className)} role={role} data-panel={panel}>
      {text !== undefined && <p>{text}</p>}
      {children}
      <div className="ask__actions">{actions}</div>
    </div>
  );
}
