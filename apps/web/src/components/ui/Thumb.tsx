"use client";

import type { Ref } from "react";
import { X } from "@phosphor-icons/react";
import { cx } from "./cx";
import { IconButton } from "./IconButton";
import { Pulse } from "./Pulse";

type Props = {
  /** The picture's address; null while it comes (the tile shows its backing). */
  src: string | null;
  /** What the picture is, for screen readers (its file's name in a box; "Your picture 2 of 5" in the chat). */
  alt: string;
  /** box: 56px, in a Field box on its paper backing; chat: 80px (68px on phones), on Field. */
  size?: "box" | "chat";
  /** Being uploaded: the picture dimmed under the breathing dot, the tile marked busy. */
  busy?: boolean;
  /** A small ink circle with an X in the tile's corner, named `removeLabel`. */
  onRemove?: () => void;
  removeLabel?: string;
  /** The whole tile is a button that opens the picture larger (named by `alt`). */
  onOpen?: (tile: HTMLButtonElement) => void;
  ref?: Ref<HTMLButtonElement>;
};

/**
 * A picture as a square tile (2026-11-04: the pictures attached to a message), at the notice thumbnail's 12px radius:
 * the picture covers it, cropped to the square (the viewer shows it whole). In a box it can be removed; in the chat it
 * opens the picture larger, pressing in to 0.97 like the app's other pressable pictures.
 */
export function Thumb({ src, alt, size = "box", busy, onRemove, removeLabel, onOpen, ref }: Props) {
  // eslint-disable-next-line @next/next/no-img-element
  const img = src ? <img src={src} alt={onOpen ? "" : alt} draggable={false} /> : null;
  if (onOpen) {
    return (
      <button ref={ref} type="button" className={cx("thumb", `thumb--${size}`, "thumb--open")} aria-label={alt} onClick={(e) => onOpen(e.currentTarget)}>
        {img}
      </button>
    );
  }
  return (
    <span className={cx("thumb", `thumb--${size}`)} aria-busy={busy || undefined} role={src ? undefined : "img"} aria-label={src ? undefined : alt}>
      {img}
      {busy && <Pulse />}
      {onRemove && (
        <IconButton look="scrim" small className="thumb__remove" label={removeLabel ?? `Remove ${alt}`} onClick={onRemove}>
          <X size={12} weight="bold" aria-hidden="true" />
        </IconButton>
      )}
    </span>
  );
}
