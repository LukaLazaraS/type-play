"use client";

import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * Two or three choices in an ink pill bar on the sky (DESIGN.md: the game page's phone tabs, the gallery's order): the
 * current one paper with ink words, the others muted, white under a pointer, Ink Recess and a press scale when pressed;
 * each 44px tall. As tabs: only the current tab is in the Tab order, the arrow keys move between them. `tone="recess"`:
 * the bar in Ink Recess, for a bar that sits on ink (the game's bar: Play / Assets, 2026-11-04). `before` and `after`
 * sit in the bar beside the tab list, not in it (a tab list holds only tabs, and their keys stay their own).
 */
export function Tabs<T extends string>({
  label,
  value,
  onChange,
  tabs,
  before,
  after,
  tone,
  className,
}: {
  label: string;
  value: T;
  onChange: (tab: T) => void;
  tabs: { id: T; label: ReactNode; tabId: string; panelId: string }[];
  tone?: "ink" | "recess";
  /** Before the tabs, in the bar (the way back). */
  before?: ReactNode;
  /** After the tabs, in the bar (the game's people on a phone, 2026-11-04). */
  after?: ReactNode;
  className?: string;
}) {
  const bar = cx("pillbar", tone === "recess" && "pillbar--recess", className);
  const beside = before !== undefined || after !== undefined;
  const list = (
    <div
      className={beside ? "pillbar__tabs" : bar}
      role="tablist"
      aria-label={label}
      onKeyDown={(e) => {
        // Tabs move with the arrow keys, as a tab list does (keys pressed on a tab only).
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        if (!(e.target instanceof HTMLElement) || e.target.getAttribute("role") !== "tab") return;
        const at = tabs.findIndex((t) => t.id === value);
        const next = tabs[(at + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
        onChange(next.id);
        e.currentTarget.querySelector<HTMLElement>(`#${next.tabId}`)?.focus();
      }}
    >
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
  if (!beside) return list;
  return (
    <div className={bar}>
      {before}
      {list}
      {after}
    </div>
  );
}

/**
 * The same bar as a choice of one that changes what the page shows in place (the gallery's order and genre): radios, so
 * only the chosen pill is in the Tab order and the arrow keys move the choice. `apart`: each pill its own ink pill, and
 * they wrap, for a list too long for one bar (the genres). `tone="recess"`: in Ink Recess, on ink (the assets' kinds).
 */
export function PillChoice<T extends string>({
  label,
  value,
  onChange,
  options,
  apart,
  tone,
  className,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: ReactNode }[];
  apart?: boolean;
  tone?: "ink" | "recess";
  className?: string;
}) {
  return (
    <div
      className={cx("pillbar", apart && "pillbar--apart", tone === "recess" && "pillbar--recess", className)}
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
