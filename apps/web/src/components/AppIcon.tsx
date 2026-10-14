"use client";

import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import type { Game } from "@/content/games";
import { useLauncher } from "./Launcher";

const ease = [0.23, 1, 0.32, 1] as const;

/** A game as an app icon: name, then model and minutes in figures. Tap to open it. */
export function AppIcon({ game, stat }: { game: Game; stat?: string }) {
  const { open } = useLauncher();
  const reduce = useReducedMotion();
  return (
    <button
      type="button"
      className="app"
      onClick={(e) => open(game, e.currentTarget)}
      aria-label={`Open ${game.name}`}
    >
      <motion.span
        className="app__icon"
        layoutId={reduce ? undefined : `game-${game.slug}`}
        transition={{ duration: 0.32, ease }}
      >
        <Image src={game.icon} alt="" width={240} height={240} />
      </motion.span>
      <span className="app__name">{game.name}</span>
      <span className="app__stat">{stat ?? `${game.tier} · ${game.minutes} min`}</span>
    </button>
  );
}

/** A game as a store listing: wide screenshot, name, the sentence that made it. */
export function Listing({ game }: { game: Game }) {
  const { open } = useLauncher();
  return (
    <button
      type="button"
      className="listing"
      onClick={(e) => open(game, e.currentTarget)}
      aria-label={`Open ${game.name}`}
    >
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
    </button>
  );
}
