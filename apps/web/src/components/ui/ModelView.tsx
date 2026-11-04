"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { cx } from "./cx";

/** Google's <model-viewer> (the web's standard glTF viewer, on three.js): loaded at the first model shown, never before. */
let loading: Promise<unknown> | null = null;
const load = () =>
  (loading ??= import("@google/model-viewer").catch((e: unknown) => {
    loading = null; // tried again at the next model
    throw e;
  }));

const REDUCED = "(prefers-reduced-motion: reduce)";
function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (tell) => {
      const m = window.matchMedia(REDUCED);
      m.addEventListener("change", tell);
      return () => m.removeEventListener("change", tell);
    },
    () => window.matchMedia(REDUCED).matches,
    () => false,
  );
}

/**
 * A 3D model the player can turn (2026-11-04, the asset viewer): drag (or the arrow keys once it has the keyboard) turns
 * it, a pinch or the wheel zooms; it turns slowly by itself unless the player asked for less motion. `src` is one
 * self-contained .glb (the API packs its textures in), so nothing else is fetched: no decoders, no environment pictures.
 * Its still (`poster`) shows while the viewer loads, and alone if it can't.
 */
export function ModelView({ src, poster, alt, className }: { src: string | null; poster: string | null; alt: string; className?: string }) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const reduced = useReducedMotion();
  useEffect(() => {
    let live = true;
    load().then(
      () => live && setReady(true),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, []);
  if (!ready || !src || failed) {
    return (
      <div className={cx("modelview", className)} aria-busy={!failed || undefined}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {poster && <img src={poster} alt={alt} className="modelview__poster" draggable={false} />}
      </div>
    );
  }
  return (
    <model-viewer
      class={cx("modelview", className)}
      // The arrow keys turn it while it has the keyboard (a viewer around it leaves them alone).
      data-own-keys=""
      src={src}
      poster={poster ?? undefined}
      alt={alt}
      camera-controls=""
      disable-pan=""
      touch-action="pan-y"
      auto-rotate={reduced ? undefined : ""}
      auto-rotate-delay="0"
      rotation-per-second="18deg"
      interaction-prompt="none"
      shadow-intensity="0"
      exposure="1"
      environment-image="neutral"
    />
  );
}
