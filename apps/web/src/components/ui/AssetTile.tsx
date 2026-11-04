"use client";

import type { CSSProperties, KeyboardEvent, ReactNode, Ref } from "react";
import { Pause, Play } from "@phosphor-icons/react";
import { cx } from "./cx";
import { IconButton } from "./IconButton";
import { Waveform } from "./Waveform";

type Props = {
  /** The asset's plain name (two lines at most) and one measured line under it ("4 frames", "0.13 s", "3D model"). */
  name: string;
  meta: string;
  /** What the tile is, for screen readers ("Gold coin, picture"). */
  label: string;
  /** Its thumbnail's address; null while it comes or when it has none (`mark` stands in). */
  picture: string | null;
  /** Drawn in light colours on a see-through ground (stars, glows): its square is Ink Recess, so it can be seen. */
  light?: boolean;
  /** Its size in pixels: a small look is drawn at most three times its own size, so it stays crisp. */
  width?: number;
  height?: number;
  /** Shown on the square when there is no picture: a sound's or a model's mark, a font's "Aa". */
  mark?: ReactNode;
  /** A sound's shape (40 bars, 0 to 1): drawn on its square in place of `mark`, so sounds look like themselves. */
  wave?: number[];
  /** The id of a line that tells screen readers how the grid moves (on the tile in the Tab order). */
  describedBy?: string;
  /** Opens the asset (the viewer); the tile is a button. */
  onOpen: (tile: HTMLButtonElement) => void;
  /** Its place in the grid's keyboard order (one tile at a time is in the Tab order: the grid moves with the arrow keys). */
  tabIndex?: number;
  onKeyDown?: (e: KeyboardEvent<HTMLButtonElement>) => void;
  ref?: Ref<HTMLButtonElement>;
  /** A sound: a round play button on the square (for a pointer or a screen reader; the keyboard plays it in the viewer). */
  sound?: { playing: boolean; onToggle: () => void; playLabel: string; stopLabel: string };
  /** The list item's own ref (a grid tile watches when it nears the screen). */
  itemRef?: Ref<HTMLLIElement>;
};

/**
 * One asset in the game's list (2026-11-04, the Assets tab): a square on Field at the field radius holding its picture
 * whole (a drawing with see-through parts stays readable, as in the picture viewer), its name and one figures line under
 * it, on ink. The whole tile is a button that presses to 0.97 and takes the two-tone ring; it opens the asset. A sound
 * also has a small round play button on its square.
 */
export function AssetTile({ name, meta, label, picture, light, width, height, mark, wave, describedBy, onOpen, tabIndex, onKeyDown, ref, sound, itemRef }: Props) {
  const size = width && height ? ({ "--w": width, "--h": height } as CSSProperties) : undefined;
  return (
    <li ref={itemRef} className="assettile">
      <button ref={ref} type="button" className="assettile__open" aria-label={label} aria-describedby={describedBy} tabIndex={tabIndex} onKeyDown={onKeyDown} onClick={(e) => onOpen(e.currentTarget)}>
        <span className={cx("assettile__square", !picture && "assettile__square--mark", picture && light && "assettile__square--light")} aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {picture ? <img src={picture} alt="" draggable={false} style={size} /> : wave?.length ? <Waveform peaks={wave} className="assettile__wave" /> : mark}
        </span>
        <span className="assettile__name">{name}</span>
        <span className="figures assettile__meta">{meta}</span>
      </button>
      {sound && (
        <IconButton look="scrim" className="assettile__play" label={sound.playing ? sound.stopLabel : sound.playLabel} aria-pressed={sound.playing} tabIndex={-1} onClick={sound.onToggle}>
          {sound.playing ? <Pause size={16} weight="fill" aria-hidden="true" /> : <Play size={16} weight="fill" aria-hidden="true" />}
        </IconButton>
      )}
    </li>
  );
}
