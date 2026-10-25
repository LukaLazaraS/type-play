import { Play } from "@phosphor-icons/react";

/** "Play" on a game's picture (the gallery's cards, the games to play while waiting): a paper chip in its bottom corner. */
export function PlayChip({ small }: { small?: boolean }) {
  return (
    <span className={small ? "playchip playchip--small" : "playchip"} aria-hidden="true">
      <Play size={small ? 12 : 13} weight="fill" />
      Play
    </span>
  );
}
