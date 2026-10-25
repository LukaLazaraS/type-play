"use client";

import { useReducedMotion } from "motion/react";
import Image, { getImageProps } from "next/image";
import type { Game } from "@/content/games";
import { AppIcon } from "@/components/ui/AppIcon";
import { Pressable } from "@/components/ui/Pressable";
import { useLauncher } from "./Launcher";

/**
 * The home icon's picture at the width each screen needs: `sizes` follows `--icon` in globals.css
 * (.home), so a phone at 2x gets 160px and a 1x desktop 128px, not the 240px file. Low priority:
 * the first paint is the headline, and the icons shouldn't race the fonts for it.
 * The srcset keeps only 64-256px. The files are 240px, so wider entries return the same file,
 * and next/image would list every configured width up to 3840 for all eight icons: ~0.8 KB more
 * gzipped HTML, enough to push the home page past the first network round trip (Lighthouse FCP
 * +0.1-0.15 s, measured 2026-10-17).
 */
function iconImage(src: string) {
  const { props } = getImageProps({
    src,
    alt: "",
    width: 240,
    height: 240,
    sizes: "(max-width: 640px) 76px, (max-width: 1100px) 96px, 112px",
    fetchPriority: "low",
  });
  const candidates = (props.srcSet ?? "").split(", ").filter((c) => {
    const w = parseInt(c.slice(c.lastIndexOf(" ") + 1), 10);
    return w >= 64 && w <= 256;
  });
  const largest = candidates.at(-1)?.split(" ")[0] ?? props.src;
  return { ...props, src: largest, srcSet: candidates.join(", ") };
}

/** A home game as an app icon: name, then model and minutes in figures. Tap to open it; its icon zooms into the launcher. */
export function GameIcon({ game, stat }: { game: Game; stat?: string }) {
  const { open } = useLauncher();
  const reduce = useReducedMotion();
  return (
    <AppIcon
      // eslint-disable-next-line @next/next/no-img-element -- next/image's props, srcset trimmed
      picture={<img {...iconImage(game.icon)} alt="" />}
      name={game.name}
      stat={stat ?? `${game.tier} · ${game.minutes} min`}
      layoutId={reduce ? undefined : `game-${game.slug}`}
      onClick={(e) => open(game, e.currentTarget)}
      label={`Open ${game.name}`}
    />
  );
}

/** A game as a store listing: wide screenshot, name, the sentence that made it. */
export function Listing({ game }: { game: Game }) {
  const { open } = useLauncher();
  return (
    <Pressable className="listing" onClick={(e) => open(game, e.currentTarget)} aria-label={`Open ${game.name}`}>
      <Image src={game.image} alt="" width={1128} height={556} sizes="(max-width: 640px) 82vw, 420px" />
      <div className="listing__body">
        <div className="listing__meta">
          <b>{game.name}</b>
          <span className="figures">
            {game.tier} · {game.minutes} min
          </span>
        </div>
        <q>{game.prompt}</q>
      </div>
    </Pressable>
  );
}
