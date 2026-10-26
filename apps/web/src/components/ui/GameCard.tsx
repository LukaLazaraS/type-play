import type { ReactNode } from "react";
import Link from "next/link";
import { PlayChip } from "./PlayChip";
import { Pressable } from "./Pressable";

/**
 * A game as a card (DESIGN.md: the gallery's listings, and the games to play while a first build runs): paper, its start
 * screen at 3:4 on Ink Recess with a Play chip, its name in Onest 700 under it, cut at two lines. The whole card is the
 * link (`href`) or the button (`onClick`) and presses to 0.98; the focus ring goes around the card. `children` sit on the
 * card after the name (figures, a report flag). A wide start screen is shown whole. A narrow card (under 150px: three
 * side by side on a phone) takes smaller words and a smaller chip by itself (a container query).
 */
export function GameCard({
  name,
  label,
  picture,
  orientation,
  href,
  onClick,
  children,
}: {
  name: string;
  /** What the link or button says to screen readers ("Play Robot Runner"). */
  label: string;
  /** The start screen (GameTile). */
  picture: ReactNode;
  orientation?: "portrait" | "landscape";
  href?: string;
  onClick?: () => void;
  children?: ReactNode;
}) {
  const inside = (
    <>
      <span className="gamecard__pic">
        {picture}
        <PlayChip />
      </span>
      <span className="gamecard__name" aria-hidden="true">
        {name}
      </span>
    </>
  );
  return (
    <li className="gamecard" data-orientation={orientation}>
      {href ? (
        <Link href={href} className="gamecard__link" prefetch={false} aria-label={label}>
          {inside}
        </Link>
      ) : (
        <Pressable className="gamecard__link" onClick={onClick} aria-label={label}>
          {inside}
        </Pressable>
      )}
      {children}
    </li>
  );
}

/** A card's place while its game is on its way: the same box, breathing (a fade). */
export function GameCardSlot() {
  return (
    <li className="gamecard gamecard--slot" aria-hidden="true">
      <span className="gamecard__pic" />
      <span className="gamecard__name">&nbsp;</span>
    </li>
  );
}
