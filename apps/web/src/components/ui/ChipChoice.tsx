"use client";

import { Fragment, useRef, type ReactNode } from "react";
import { Check } from "@phosphor-icons/react";
import { cx } from "./cx";

export type ChipOption<T extends string> = { value: T; label: ReactNode };

/**
 * One of a few short answers, as pills (DESIGN.md: the questions before a build, 2026-11-04): radios in a fieldset named
 * by its legend (600 15px), each a Field pill with its words (the chip's 600 14px, 38px tall, 44px for a finger) and a
 * 16px dot before them, a 2px ring while not picked; the picked pill turns ink with white words and its dot paper with an
 * ink check, so no pill changes width. The arrow keys move the pick, as radios do; the keyboard's two-tone ring goes
 * round the pill it is on. `onChange`'s `byPointer` says a finger or a mouse picked it (the caller may then move the
 * keyboard on, e.g. into a box that opens with the pick); the arrows never do. `breakBefore`: the pills from that place on
 * start a row of their own (the questions' You decide and Type my own, always in the same place).
 */
export function ChipChoice<T extends string>({
  name,
  legend,
  value,
  onChange,
  options,
  disabled,
  className,
  breakBefore,
}: {
  name: string;
  legend: ReactNode;
  value: T | null;
  onChange: (value: T, byPointer: boolean) => void;
  options: ChipOption<T>[];
  disabled?: boolean;
  className?: string;
  breakBefore?: number;
}) {
  const pointer = useRef(false);
  return (
    <fieldset className={cx("chipchoice", className)} disabled={disabled}>
      <legend className="chipchoice__legend">{legend}</legend>
      <div className="chipchoice__list">
        {options.map((o, i) => {
          const on = value === o.value;
          return (
            <Fragment key={o.value}>
              {i > 0 && i === breakBefore && <span className="chipchoice__break" aria-hidden="true" />}
              <label className="chipchoice__chip" data-on={on || undefined} onPointerDown={() => (pointer.current = true)}>
                <input
                  type="radio"
                  name={name}
                  value={o.value}
                  checked={on}
                  className="sr-only"
                  onKeyDown={() => (pointer.current = false)}
                  onChange={() => {
                    onChange(o.value, pointer.current);
                    pointer.current = false;
                  }}
                />
                <span className="chipchoice__dot" aria-hidden="true">
                  {on ? <Check size={11} weight="bold" /> : null}
                </span>
                <span className="chipchoice__words">{o.label}</span>
              </label>
            </Fragment>
          );
        })}
      </div>
    </fieldset>
  );
}
