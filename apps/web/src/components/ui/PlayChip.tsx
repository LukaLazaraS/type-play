import { Play } from "@phosphor-icons/react";

/** "Play" on a game's picture (the gallery's cards, the games to play while waiting): a paper chip in its bottom corner. */
export function PlayChip() {
  return (
    <span className="playchip" aria-hidden="true">
      <Play size={13} weight="fill" />
      Play
    </span>
  );
}
