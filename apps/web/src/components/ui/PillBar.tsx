"use client";

import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * Two or three choices in an ink pill bar on the sky (DESIGN.md: the game page's phone tabs, the gallery's order): the
 * current one paper with ink words, the others muted, white under a pointer, Ink Recess and a press scale when pressed;
 * each 44px tall. As tabs: only the current tab is in the Tab order, the arrow keys move between them.
 */
export function Tabs<T extends string>({
  label,
  value,
  onChange,
  tabs,
  before,
  className,
}: {
  label: string;
  value: T;
  onChange: (tab: T) => void;
  tabs: { id: T; label: ReactNode; tabId: string; panelId: string }[];
  /** Before the tabs, in the bar (the way back). */
  before?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx("pillbar", className)}
      role="tablist"
      aria-label={label}
      onKeyDown={(e) => {
        // Tabs move with the arrow keys, as a tab list does.
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        const at = tabs.findIndex((t) => t.id === value);
        const next = tabs[(at + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
        onChange(next.id);
        e.currentTarget.querySelector<HTMLElement>(`#${next.tabId}`)?.focus();
      }}
    >
      {before}
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          id={t.tabId}
          aria-selected={value === t.id}
          aria-controls={t.panelId}
          tabIndex={value === t.id ? 0 : -1}
          className="pillbar__item"
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/**
 * The same bar as a choice of one that changes what the page shows in place (the gallery's order and genre): radios, so
 * only the chosen pill is in the Tab order and the arrow keys move the choice. `apart`: each pill its own ink pill, and
 * they wrap, for a list too long for one bar (the genres).
 */
export function PillChoice<T extends string>({
  label,
  value,
  onChange,
  options,
  apart,
  className,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: ReactNode }[];
  apart?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cx("pillbar", apart && "pillbar--apart", className)}
      role="radiogroup"
      aria-label={label}
      onKeyDown={(e) => {
        const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
        if (!step) return;
        e.preventDefault();
        const at = options.findIndex((o) => o.value === value);
        const next = (at + step + options.length) % options.length;
        onChange(options[next].value);
        e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
      }}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={o.value === value ? 0 : -1}
          className="pillbar__item"
          onClick={() => o.value !== value && onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
