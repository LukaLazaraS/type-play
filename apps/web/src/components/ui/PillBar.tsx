"use client";

import type { ReactNode } from "react";
import Link from "next/link";
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

/** The same bar as links to pages (the gallery's Popular / New); a link's label may say its page is on its way (data-pending). */
export function PillNav({ label, links, className }: { label: string; links: { href: string; label: ReactNode; current: boolean }[]; className?: string }) {
  return (
    <nav className={cx("pillbar", className)} aria-label={label}>
      {links.map((l) => (
        <Link key={l.href} href={l.href} aria-current={l.current ? "page" : undefined} prefetch={false} className="pillbar__item">
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
