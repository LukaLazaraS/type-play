"use client";

import { useEffect, useRef, useState } from "react";
import { Play } from "@phosphor-icons/react";
import { site } from "@/content/site";

export const playUrl = (slug: string, auto = false) =>
  `${site.gamesOrigin}/play.html?g=${encodeURIComponent(slug)}${auto ? "&auto=1" : ""}`;

/**
 * A playable game on the games origin, inside the site. Shows the poster until the engine runs.
 * `mode="click"` waits for a Play press (the launcher); `mode="auto"` loads at once (the demo).
 */
export function GameFrame({
  slug,
  poster,
  name,
  mode = "click",
  onReady,
}: {
  slug: string;
  poster: string;
  name: string;
  mode?: "click" | "auto";
  onReady?: (slug: string) => void;
}) {
  // Parents pass key={slug}, so a new game mounts a fresh frame.
  const [playing, setPlaying] = useState(mode === "auto");
  const [ready, setReady] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      if (e.data?.typeplay === "ready" && e.data.game === slug) {
        setReady(true);
        onReady?.(slug);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [slug, onReady]);

  return (
    <div className="gameframe" data-ready={ready || undefined}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="gameframe__poster" src={poster} alt={`${name} while playing`} />
      {playing && (
        <iframe
          ref={frame}
          key={slug}
          className="gameframe__frame"
          src={playUrl(slug, mode === "auto")}
          title={`${name}, playable`}
          allow="autoplay; fullscreen"
        />
      )}
      {!playing && (
        <button type="button" className="gameframe__play" onClick={() => setPlaying(true)}>
          <Play size={22} weight="fill" aria-hidden="true" />
          Play {name}
        </button>
      )}
      {playing && !ready && <div className="gameframe__loading">Loading the game…</div>}
    </div>
  );
}
