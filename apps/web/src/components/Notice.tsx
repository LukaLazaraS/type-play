"use client";

import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import type { Game } from "@/content/games";
import { Pressable } from "@/components/ui/Pressable";
import { useLauncher } from "./Launcher";

const MotionPressable = motion.create(Pressable);

/** The notification that drops in once: a real game is ready. Tap opens it. */
export function Notice({ game }: { game: Game }) {
  const { open } = useLauncher();
  const reduce = useReducedMotion();
  return (
    <MotionPressable
      className="notice"
      onClick={(e) => open(game, e.currentTarget)}
      initial={reduce ? false : { opacity: 0, y: -28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1], delay: 0.5 }}
    >
      <Image src={game.icon} alt="" width={44} height={44} />
      <span className="notice__text">
        <span className="notice__title">{game.name} is ready to play</span>
        <span className="notice__sub">Built from one sentence in {game.minutes} min</span>
      </span>
      <span className="notice__when">{game.tier}</span>
    </MotionPressable>
  );
}
