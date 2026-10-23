"use client";

import { useLayoutEffect, type RefObject } from "react";

/** A textarea that grows with its text up to `max` pixels, then scrolls. */
export function useAutoGrow(ref: RefObject<HTMLTextAreaElement | null>, value: string, max: number) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
  }, [ref, value, max]);
}

/** The API refuses longer messages (apps/server, MAX_PROMPT). */
export const MAX_TEXT = 4000;
