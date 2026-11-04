"use client";

import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * The tick box (DESIGN.md: the checkout's tick box): a Field panel, the 22px box in light colours on paper (the page's
 * colour scheme is the sky's), its sentence in 600 15px, and a muted 13px note under it when there is one.
 * `size="small"` (the composer's "Ask me first", 2026-11-04): no panel, an 18px box and its words in 600 13px on one line,
 * in a row of controls; a finger gets 44px around it. `describedBy`: a line elsewhere that says more (the composer's tip).
 */
export function Checkbox({
  checked,
  onChange,
  disabled,
  required,
  note,
  size,
  describedBy,
  className,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  required?: boolean;
  note?: ReactNode;
  size?: "small";
  describedBy?: string;
  /** Layout from the page around it (its place in a row). */
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cx("checkbox", size === "small" && "checkbox--small", className)}>
      <input type="checkbox" checked={checked} disabled={disabled} required={required} aria-describedby={describedBy} onChange={(e) => onChange(e.target.checked)} />
      <span>
        {children}
        {note !== undefined && <span className="checkbox__note">{note}</span>}
      </span>
    </label>
  );
}
