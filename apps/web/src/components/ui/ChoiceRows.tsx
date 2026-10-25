"use client";

import type { ReactNode } from "react";
import { cx } from "./cx";

export type Choice<T extends string> = {
  value: T;
  /** The choice's name: 700 17px over its line with a tile, 600 15px alone. */
  title: ReactNode;
  /** One muted line under the name. */
  text?: ReactNode;
  /** A 44px tile before the name (the AI's coloured icon). */
  tile?: ReactNode;
  /** At the right, before the dot: what it costs, or why it is locked. */
  side?: ReactNode;
  /** Can't be picked on this plan: the tile greyed, no dot, the not-allowed cursor. */
  locked?: boolean;
};

/**
 * One of a list, as rows (DESIGN.md: the model rows, and the report's reasons): radios, the picked row on Field with an
 * ink ring for its dot, an unpicked dot a 2px ring on paper, #f8f5fd under a pointer, the amber focus ring around the
 * row. Rows with a tile are the larger size (the model picker), rows without it the compact one.
 */
export function ChoiceRows<T extends string>({
  name,
  legend,
  legendLook = "hidden",
  value,
  onChange,
  choices,
  disabled,
  className,
}: {
  name: string;
  legend: ReactNode;
  legendLook?: "hidden" | "label";
  value: T | null;
  onChange: (value: T) => void;
  choices: Choice<T>[];
  disabled?: boolean;
  className?: string;
}) {
  return (
    <fieldset className={cx("choices", className)} disabled={disabled}>
      <legend className={legendLook === "label" ? "field-label" : "sr-only"}>{legend}</legend>
      {choices.map((c) => (
        <label key={c.value} className={cx("choice", c.tile !== undefined && "choice--tile")} data-on={value === c.value || undefined} data-locked={c.locked || undefined}>
          <input type="radio" name={name} value={c.value} checked={value === c.value} disabled={c.locked} onChange={() => onChange(c.value)} className="sr-only" />
          {c.tile}
          {c.tile !== undefined || c.text !== undefined ? (
            <span className="choice__text">
              <b>{c.title}</b>
              {c.text !== undefined && <span>{c.text}</span>}
            </span>
          ) : (
            <span>{c.title}</span>
          )}
          {c.side !== undefined && <span className={c.locked ? "choice__side choice__side--locked" : "choice__side figures"}>{c.side}</span>}
        </label>
      ))}
    </fieldset>
  );
}
