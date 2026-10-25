import type { ReactNode } from "react";
import Link from "next/link";
import { cx } from "./cx";
import { PlayChip } from "./PlayChip";
import { Pressable } from "./Pressable";

/**
 * A game as a card (DESIGN.md: the gallery's listings; `small`, the games to play while a first build runs, "the gallery's
 * listings in small"): paper, its start screen at 3:4 on Ink Recess with a Play chip, its name in Onest 700 under it, cut
 * at two lines. The whole card is the link (`href`) or the button (`onClick`) and presses to 0.98; the focus ring goes
 * around the card. `children` sit on the card after the name (figures, a report flag). A wide start screen is shown whole
 * on a listing and cropped to its middle on a small card (its title card sits there).
 */
export function GameCard({
  name,
  label,
  picture,
  orientation,
  small,
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
  small?: boolean;
  href?: string;
  onClick?: () => void;
  children?: ReactNode;
}) {
  const inside = (
    <>
      <span className="gamecard__pic">
        {picture}
        <PlayChip small={small} />
      </span>
      <span className="gamecard__name" aria-hidden="true">
        {name}
      </span>
    </>
  );
  return (
    <li className={cx("gamecard", small && "gamecard--small")} data-orientation={orientation}>
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
export function GameCardSlot({ small }: { small?: boolean }) {
  return (
    <li className={cx("gamecard", small && "gamecard--small", "gamecard--slot")} aria-hidden="true">
      <span className="gamecard__pic" />
      <span className="gamecard__name">&nbsp;</span>
    </li>
  );
}
