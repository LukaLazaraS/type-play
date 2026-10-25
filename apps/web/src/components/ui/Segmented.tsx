"use client";

import type { ReactNode } from "react";
import { cx } from "./cx";

export type SegmentedOption<T extends string> = {
  value: T;
  label: ReactNode;
  /** Before the words (a bold Phosphor icon, or the lock of a locked choice). */
  icon?: ReactNode;
  /** Can't be picked on this plan: muted, the not-allowed cursor; `title` says why to a pointer, `note` to screen readers. */
  locked?: boolean;
  title?: string;
  note?: ReactNode;
  /** The id of a line that describes this choice to screen readers. */
  describedBy?: string;
};

/**
 * One of a few, side by side (DESIGN.md: the Fast / Smart / Best segmented control): radios in a Field track, the picked
 * one a paper thumb; arrow keys move the pick, as radios do; 44px for a finger (a transparent hit area, the look kept).
 * `small` is the Effort size. The legend is hidden, a field label, or a muted hint line; `before` sits before the track
 * (Effort's word), `children` after it (the picked one's line).
 */
export function Segmented<T extends string>({
  name,
  legend,
  legendLook = "hidden",
  value,
  onChange,
  options,
  size = "normal",
  disabled,
  className,
  trackClassName,
  before,
  children,
}: {
  /** The radio group's name: unique on the page. */
  name: string;
  legend: ReactNode;
  legendLook?: "hidden" | "label" | "hint";
  value: T | null;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  size?: "normal" | "small";
  disabled?: boolean;
  className?: string;
  trackClassName?: string;
  before?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <fieldset className={cx("segmented", className)} disabled={disabled}>
      <legend className={legendLook === "label" ? "field-label" : legendLook === "hint" ? "field-hint" : "sr-only"}>{legend}</legend>
      {before}
      <div className={cx("switch", size === "small" && "switch--small", trackClassName)}>
        {options.map((o) => (
          <label key={o.value} className="switch__opt" data-on={value === o.value || undefined} data-locked={o.locked || undefined} title={o.title}>
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              disabled={o.locked}
              onChange={() => onChange(o.value)}
              aria-describedby={o.describedBy}
              className="sr-only"
            />
            {o.icon}
            {o.label}
            {o.note && <span className="sr-only">{o.note}</span>}
          </label>
        ))}
      </div>
      {children}
    </fieldset>
  );
}
