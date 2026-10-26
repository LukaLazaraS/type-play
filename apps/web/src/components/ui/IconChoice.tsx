"use client";

import type { ReactNode } from "react";
import { Check } from "@phosphor-icons/react";
import { AppTile } from "./AppIcon";
import { cx } from "./cx";

export type IconOption<T extends string> = {
  value: T;
  name: string;
  /** The square's picture (an <img> at cover, or a drawing). */
  picture: ReactNode;
  /** The id of a line that describes this choice to screen readers. */
  describedBy?: string;
};

/**
 * One of a few pictures, or none (DESIGN.md: /create's Genre): app icons' squares over their names, as radios in a
 * fieldset, so the arrow keys move the pick. The picked one is ringed in ink with an ink check over its corner; tapping
 * it again (Space on the keyboard) picks none. `children` sit under the row (the picked one's line).
 */
export function IconChoice<T extends string>({
  name,
  legend,
  value,
  onChange,
  options,
  disabled,
  className,
  children,
}: {
  /** The radio group's name: unique on the page. */
  name: string;
  legend: ReactNode;
  value: T | null;
  onChange: (value: T | null) => void;
  options: IconOption<T>[];
  disabled?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <fieldset className={cx("iconchoice", className)} disabled={disabled}>
      <legend className="field-label">{legend}</legend>
      <div className="iconchoice__row">
        {options.map((o) => (
          <label key={o.value} className="iconchoice__opt" data-on={value === o.value || undefined}>
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              // The picked one, pressed again: none. A new pick changes first, so this sees the old value.
              onClick={() => value === o.value && onChange(null)}
              // Space on the picked one: none too (a browser sends no click for Space on a checked radio). Its default is
              // kept from running, or the key's release would pick it again.
              onKeyDown={(e) => {
                if (e.key === " " && value === o.value) {
                  e.preventDefault();
                  onChange(null);
                }
              }}
              aria-describedby={o.describedBy}
              className="sr-only"
            />
            <span className="iconchoice__pic">
              <AppTile>{o.picture}</AppTile>
              <span className="iconchoice__check" aria-hidden="true">
                <Check size={14} weight="bold" />
              </span>
            </span>
            <span className="iconchoice__name">{o.name}</span>
          </label>
        ))}
      </div>
      {children}
    </fieldset>
  );
}
