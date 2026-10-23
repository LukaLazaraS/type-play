"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

/**
 * The icon the user uploaded for the game's app, as an object URL. The API sends it only to the signed-in owner,
 * so it is fetched with the sign-in header and shown from memory (an <img src> can't ask for it). It is null when
 * `wanted` is false, while it loads, and when it can't be had (no connection, removed in another tab): the
 * caller then shows the game's picture or the neutral icon, as it did before this existed.
 */
export function useAppIcon(projectId: string, wanted: boolean): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!wanted) return;
    let live = true;
    let made: string | null = null;
    api.android.icon(projectId).then(
      (blob) => {
        if (!live) return;
        made = URL.createObjectURL(blob);
        setUrl(made);
      },
      () => {},
    );
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
      setUrl(null);
    };
  }, [projectId, wanted]);
  return wanted ? url : null;
}
