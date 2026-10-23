"use client";

import { useEffect, type RefObject } from "react";

/**
 * Pins a `popover="auto"` panel under its trigger, right edges lined up, and keeps it on the screen
 * (a narrow phone pushes it right, 12px from the edge). CSS reads --pop-top, --pop-right and
 * --pop-width (`.pop` in app.css); the panel's own width is its `data-width` (px). A popover lives
 * in the top layer, so the game page's clipped panels can't cut it off; the browser closes it on
 * Escape or a tap outside. `onClose` runs when it closes, however that happens.
 */
export function usePopover(trigger: RefObject<HTMLElement | null>, panel: RefObject<HTMLElement | null>, onClose?: () => void) {
  useEffect(() => {
    const el = panel.current;
    if (!el) return;
    const place = () => {
      const t = trigger.current;
      if (!t) return;
      const r = t.getBoundingClientRect();
      const vw = document.documentElement.clientWidth;
      const width = Math.min(Number(el.dataset.width) || 340, vw - 24);
      const right = Math.min(Math.max(12, vw - r.right), vw - 12 - width);
      el.style.setProperty("--pop-top", `${Math.round(r.bottom + 8)}px`);
      el.style.setProperty("--pop-right", `${Math.round(right)}px`);
      el.style.setProperty("--pop-width", `${Math.round(width)}px`);
      // It grows out of its button, wherever the button sits along its top edge.
      const left = vw - right - width;
      el.style.setProperty("--pop-origin", `${Math.round(Math.min(width, Math.max(0, r.left + r.width / 2 - left)))}px 0`);
    };
    const onToggle = (e: Event) => {
      if ((e as ToggleEvent).newState === "open") {
        place();
        window.addEventListener("resize", place);
      } else {
        window.removeEventListener("resize", place);
        onClose?.();
      }
    };
    el.addEventListener("beforetoggle", onToggle);
    return () => {
      el.removeEventListener("beforetoggle", onToggle);
      window.removeEventListener("resize", place);
    };
  }, [trigger, panel, onClose]);
}
