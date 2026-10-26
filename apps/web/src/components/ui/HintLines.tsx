import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * One muted 13px line out of a few (DESIGN.md: under Made for, Genre and Tags on /create): the picked choice's, or the
 * one touched last. Every line sits in one cell and only the current one shows, so the box keeps the longest line's
 * height and nothing under it moves when the line changes. Each line describes its choice to screen readers by id
 * (`aria-describedby` on the choice); the box itself is hidden from them, so no line is read twice.
 */
export function HintLines({ lines, current, className }: { lines: { id: string; text: ReactNode }[]; current: string | null; className?: string }) {
  return (
    <div className={cx("hintlines", className)} aria-hidden="true">
      {lines.map((l) => (
        <p key={l.id} id={l.id} className="field-hint" data-on={l.id === current || undefined}>
          {l.text}
        </p>
      ))}
    </div>
  );
}
