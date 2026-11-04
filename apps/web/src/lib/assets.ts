"use client";

// The Assets tab's data (2026-11-04, docs/design/assets.md): a version's list, and each asset's thumbnail, picture and
// file as object URLs, fetched with the sign-in header (an <img> or <audio> can't send it) and kept for as long as the
// page lives (a version's assets never change). Thumbnails are fetched as their tiles come near the screen, four at a
// time; sounds play one at a time.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { GameAsset, GameAssets } from "@typeplay/shared";
import { api, ApiFailure, saveFile } from "./api";

export type AssetForm = "thumb" | "picture" | "file";

export type ListState =
  | { status: "loading" }
  | { status: "ready"; list: GameAssets }
  | { status: "failed"; message: string; busy: boolean };

const lists = new Map<string, Promise<GameAssets>>();

/** A version's list (null while there is no build); `retry` asks again after a failure. */
export function useAssetList(projectId: string, buildId: string | null): { state: ListState | null; retry: () => void } {
  const key = buildId ? `${projectId}/${buildId}` : null;
  const [shown, setShown] = useState<{ key: string; state: ListState } | null>(null);
  const [round, setRound] = useState(0);
  useEffect(() => {
    if (!key || !buildId) return;
    let live = true;
    let asked = lists.get(key);
    if (!asked) {
      asked = api.assets.list(projectId, buildId);
      asked.catch(() => lists.delete(key)); // a failure is asked again next time
      lists.set(key, asked);
    }
    asked.then(
      (list) => live && setShown({ key, state: { status: "ready", list } }),
      (e: unknown) =>
        live &&
        setShown({
          key,
          state: { status: "failed", message: e instanceof Error ? e.message : String(e), busy: e instanceof ApiFailure && e.code === "busy" },
        }),
    );
    return () => {
      live = false;
    };
  }, [key, projectId, buildId, round]);
  const state: ListState | null = !key ? null : shown?.key === key ? shown.state : { status: "loading" };
  return {
    state,
    retry: () => {
      if (key) lists.delete(key);
      setShown(null);
      setRound((r) => r + 1);
    },
  };
}

// ---- The files, as object URLs --------------------------------------------------------------------------------------

const urls = new Map<string, Promise<string>>();
/** At most four fetches at once: a long list's thumbnails don't flood the connection. */
let running = 0;
const queue: (() => void)[] = [];
async function inTurn<T>(work: () => Promise<T>): Promise<T> {
  if (running >= 4) await new Promise<void>((r) => queue.push(r));
  running++;
  try {
    return await work();
  } finally {
    running--;
    queue.shift()?.();
  }
}

/** The asset's thumbnail, picture or file as an address for an <img>, <audio>, a font or the 3D view. */
export function assetUrl(projectId: string, buildId: string, assetId: string, form: AssetForm): Promise<string> {
  const key = `${form}:${projectId}/${buildId}/${assetId}`;
  let url = urls.get(key);
  if (!url) {
    url = inTurn(async () => {
      const blob =
        form === "thumb"
          ? await api.assets.thumb(projectId, buildId, assetId)
          : form === "picture"
            ? await api.assets.picture(projectId, buildId, assetId)
            : (await api.assets.file(projectId, buildId, assetId, "asset")).blob;
      return URL.createObjectURL(blob);
    });
    url.catch(() => urls.delete(key));
    urls.set(key, url);
  }
  return url;
}

/** The address once it is here (null until then, while `enabled` is false, and when it can't be had). */
export function useAssetUrl(projectId: string, buildId: string | null, assetId: string | null, form: AssetForm, enabled = true): string | null {
  const key = buildId && assetId && enabled ? `${form}:${projectId}/${buildId}/${assetId}` : null;
  const [shown, setShown] = useState<{ key: string; url: string } | null>(null);
  useEffect(() => {
    if (!key || !buildId || !assetId) return;
    let live = true;
    assetUrl(projectId, buildId, assetId, form).then(
      (url) => live && setShown({ key, url }),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [key, projectId, buildId, assetId, form]);
  return shown && shown.key === key ? shown.url : null;
}

/** Saves the asset's file (a look as PNG, a model as one .glb, a sound or font as its file). */
export async function downloadAsset(projectId: string, buildId: string, asset: GameAsset): Promise<void> {
  saveFile(await api.assets.file(projectId, buildId, asset.id, `${fileName(asset.name)}.${asset.format}`));
}

/** The asset's picture as a file for the chat box's tray (Change it): it uploads and is checked like a dropped picture. */
export async function assetPictureFile(projectId: string, buildId: string, asset: GameAsset): Promise<File> {
  const blob = await api.assets.picture(projectId, buildId, asset.id);
  const ext = blob.type === "image/jpeg" ? "jpg" : blob.type === "image/webp" ? "webp" : "png";
  return new File([blob], `${fileName(asset.name)}.${ext}`, { type: blob.type || "image/png" });
}

/** "Saw tower, level 2" -> "saw-tower-level-2". */
export function fileName(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "") // accents off: "é" -> "e"
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "asset";
}

// ---- Seen: a tile near the screen fetches its thumbnail -------------------------------------------------------------

/** True once the element has come within `margin` of the screen (and from then on). */
export function useSeen<T extends Element>(margin = "240px") {
  const ref = useRef<T>(null);
  // Without IntersectionObserver (old browsers) every tile counts as seen at once.
  const [seen, setSeen] = useState(() => typeof window !== "undefined" && typeof IntersectionObserver === "undefined");
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: margin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [margin, seen]);
  return [ref, seen] as const;
}

// ---- Sounds: one at a time, across the list and the viewer ----------------------------------------------------------

let audio: HTMLAudioElement | null = null;
let playing: string | null = null;
const listeners = new Set<() => void>();
const tell = () => listeners.forEach((l) => l());

export function stopSound() {
  if (audio) {
    audio.onended = null;
    audio.pause();
  }
  audio = null;
  if (playing !== null) {
    playing = null;
    tell();
  }
}

/** Plays a sound (stopping any other); `key` names it for useSoundPlaying. */
export function playSound(key: string, url: string) {
  stopSound();
  const a = new Audio(url);
  audio = a;
  playing = key;
  a.onended = () => {
    if (audio === a) stopSound();
  };
  a.play().catch(() => {
    if (audio === a) stopSound();
  });
  tell();
}

/** The key of the sound playing now, or null. */
export function useSoundPlaying(): string | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => playing,
    () => null,
  );
}

/** How far the sound playing now has got, 0..1 (0 when none). */
export function soundProgress(): number {
  return audio && audio.duration > 0 ? Math.min(1, audio.currentTime / audio.duration) : 0;
}

// ---- Fonts: a game's font shown in itself ---------------------------------------------------------------------------

const faces = new Map<string, Promise<string>>();

/** The CSS font family of a font asset once its file is loaded (null until then, and when it can't be loaded). */
export function useAssetFont(projectId: string, buildId: string | null, asset: GameAsset | null, enabled = true): string | null {
  const key = buildId && asset?.kind === "font" && enabled ? `${projectId}/${buildId}/${asset.id}` : null;
  const [shown, setShown] = useState<{ key: string; family: string } | null>(null);
  useEffect(() => {
    if (!key || !buildId || !asset || typeof FontFace === "undefined") return;
    let face = faces.get(key);
    if (!face) {
      const family = `tp-asset-${asset.id}`;
      face = assetUrl(projectId, buildId, asset.id, "file").then(async (url) => {
        const loaded = await new FontFace(family, `url(${url})`).load();
        document.fonts.add(loaded);
        return family;
      });
      face.catch(() => faces.delete(key));
      faces.set(key, face);
    }
    let live = true;
    face.then(
      (family) => live && setShown({ key, family }),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [key, projectId, buildId, asset]);
  return shown && shown.key === key ? shown.family : null;
}
