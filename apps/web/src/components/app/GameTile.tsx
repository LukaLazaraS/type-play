"use client";

import { useState } from "react";
import { BuildLayers } from "@/components/BuildingIcon";

// A game without a picture of its start screen (older builds) gets a drawn icon: a sky band, a dune
// and the first letter of the name, in one of the wallpaper's own colour pairs picked from the game's id.
const pairs: [sky: string, dune: string][] = [
  ["#3d206b", "#a63e68"],
  ["#2a1858", "#d9645a"],
  ["#572877", "#f3a35c"],
  ["#1c1240", "#ff5a36"],
  ["#6a2c7a", "#ffb347"],
  ["#251948", "#a63e68"],
];

function pick(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return pairs[h % pairs.length];
}

/** The picture inside an `.app__icon`: assembling while the first build runs, the game's own start
 * screen when its build has one, else the drawn tile. `fill`: the drawn tile covers a box that isn't
 * square (the gallery's listings) instead of sitting inside it. */
export function GameTile({ id, name, building, poster, fill = false }: { id: string; name: string; building: boolean; poster?: string | null; fill?: boolean }) {
  const [broken, setBroken] = useState<string | null>(null);
  if (building) return <BuildLayers />;
  if (poster && broken !== poster) {
    // A picture that failed before the page woke up never fires onError for React: caught on mount too.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        ref={(img) => {
          if (img?.complete && img.naturalWidth === 0) setBroken(poster);
        }}
        src={poster}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setBroken(poster)}
      />
    );
  }
  const [sky, dune] = pick(id);
  const letter = (name.trim().match(/[\p{L}\p{N}]/u)?.[0] ?? "?").toUpperCase();
  return (
    <svg viewBox="0 0 112 112" preserveAspectRatio={fill ? "xMidYMid slice" : undefined} aria-hidden="true">
      <rect width="112" height="112" fill={sky} />
      <path d="M0 80 C30 70 70 88 112 74 V112 H0Z" fill={dune} />
      <text
        x="56"
        y="66"
        textAnchor="middle"
        fill="#ffffff"
        fontFamily="var(--font-display)"
        fontWeight="900"
        fontSize="54"
        letterSpacing="-1"
      >
        {letter}
      </text>
    </svg>
  );
}
