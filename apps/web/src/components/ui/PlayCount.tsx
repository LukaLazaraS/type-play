import { Play } from "@phosphor-icons/react";
import { cx } from "./cx";

/**
 * How many played a game, as short-video apps show views (Luka, 10-27): an outline play mark and the number ("12",
 * "12.3K"), in figures on one line. `words` says it in full ("12 plays this week") to screen readers and as the tooltip.
 * Unlike the Play chip on the picture, no pill and no filled mark.
 */
export function PlayCount({ count, words, className }: { count: string; words: string; className?: string }) {
  return (
    <span className={cx("plays", className)} title={words}>
      <Play size={12} weight="bold" aria-hidden="true" className="plays__mark" />
      <span aria-hidden="true">{count}</span>
      <span className="sr-only">{words}</span>
    </span>
  );
}
