"use client";

import { useEffect } from "react";

/**
 * Runs `onBack` when the browser brings this page back from its back-forward cache (the Back button from Google's
 * sign-in): the page is as it was left, so a button that went busy on its way out must be made ready again.
 */
export function useRestored(onBack: () => void) {
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) onBack();
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, [onBack]);
}
