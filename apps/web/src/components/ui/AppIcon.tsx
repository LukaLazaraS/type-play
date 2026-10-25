"use client";

import type { MouseEvent, ReactNode } from "react";
import { motion } from "motion/react";
import { Anchor } from "./Anchor";
import { cx } from "./cx";
import { Pressable } from "./Pressable";

const ease = [0.23, 1, 0.32, 1] as const;

/**
 * A game as an app on a home screen (DESIGN.md "App icon"): a `--icon`-sized rounded square (25% radius, Ink Recess under
 * the picture) over its name in 600 14px and a figures line. The whole icon is the link or the button; the square presses
 * to 0.95. `building`: the square assembles (BuildLayers in it). `layoutId`: the square zooms into the launcher's frame.
 */
export function AppIcon({
  picture,
  name,
  stat,
  building,
  layoutId,
  href,
  onClick,
  disabled,
  label,
  className,
  nameClassName,
  statClassName,
}: {
  picture: ReactNode;
  name: ReactNode;
  stat?: ReactNode;
  building?: boolean;
  layoutId?: string;
  /** Where it goes: a page of this site, or a place on this page ("#prompt"). */
  href?: string;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
  nameClassName?: string;
  statClassName?: string;
}) {
  const square = layoutId ? (
    <motion.span className="app__icon" layoutId={layoutId} transition={{ duration: 0.32, ease }}>
      {picture}
    </motion.span>
  ) : (
    <span className={cx("app__icon", building && "build")} aria-hidden={building || undefined}>
      {picture}
    </span>
  );
  const inside = (
    <>
      {square}
      <span className={cx("app__name", nameClassName)}>{name}</span>
      {stat !== undefined && <span className={cx("app__stat", statClassName)}>{stat}</span>}
    </>
  );
  const cls = cx("app", className);
  if (href !== undefined)
    return (
      <Anchor href={href} className={cls} prefetch={false} aria-label={label}>
        {inside}
      </Anchor>
    );
  return (
    <Pressable className={cls} onClick={onClick} disabled={disabled} aria-label={label}>
      {inside}
    </Pressable>
  );
}

/** The rounded square alone, for a picture that isn't a whole app (a row's icon, the build assembling on the stage). */
export function AppTile({ building, className, children }: { building?: boolean; className?: string; children?: ReactNode }) {
  return (
    <span className={cx("app__icon", building && "build", className)} aria-hidden="true">
      {children}
    </span>
  );
}

/** An app's place while the list is on its way: the square, empty. */
export function AppIconSlot({ className }: { className?: string }) {
  return (
    <li className={cx("app", className)}>
      <span className="app__icon" />
    </li>
  );
}
