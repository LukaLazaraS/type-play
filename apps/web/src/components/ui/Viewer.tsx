"use client";

import { useImperativeHandle, useRef, useState, type ReactNode, type Ref } from "react";
import { CaretLeft, CaretRight, X } from "@phosphor-icons/react";
import { cx } from "./cx";
import { Dialog, type DialogHandle } from "./Dialog";
import { IconButton } from "./IconButton";

type Props = {
  ref?: Ref<DialogHandle>;
  /** The id of the title the content renders (visible or not): the dialog's name. */
  labelledBy: string;
  /** Which of `count` shows, from 0; Previous, Next and the arrow keys ask for another with `onMove`. */
  index: number;
  count: number;
  onMove: (index: number) => void;
  /** What a move says to screen readers ("Gold coin, 3 of 49"). */
  said: string;
  /** The Previous / Next / Close buttons' names. */
  labels: { previous: string; next: string; close: string };
  /** Close takes the keyboard when the viewer opens (true), or something in the content does (false). */
  closeFirst?: boolean;
  /** Told once it has closed, however it was closed. */
  onClose?: () => void;
  /** asset: a column wide enough for an asset and its words (the Assets tab). */
  size?: "asset";
  children: ReactNode;
};

/**
 * The frame of a viewer of one thing at a time (2026-11-04: the Assets tab's asset viewer; the picture viewer's look): a
 * dialog with no paper of its own over ink at 92%, the content in a column, "3 of 49" between Previous and Next under it
 * (and the arrow keys) when there are more, Close in the screen's top corner (and Escape, and a tap beside it). The
 * keyboard goes back to what opened it (`open(from)`). Content that takes the arrow keys itself (a 3D model turns with
 * them) marks itself with `data-own-keys`.
 */
export function Viewer({ ref, labelledBy, index, count, onMove, said, labels, closeFirst = true, onClose, size, children }: Props) {
  const dialog = useRef<DialogHandle>(null);
  useImperativeHandle(ref, () => ({ open: (from) => dialog.current?.open(from), close: () => dialog.current?.close() }), []);
  const many = count > 1;
  const [moved, setMoved] = useState(false);
  const go = (step: number) => {
    setMoved(true);
    onMove((index + step + count) % count);
  };
  return (
    <Dialog
      ref={dialog}
      look="picture"
      labelledBy={labelledBy}
      className={size === "asset" ? "dialog--asset" : undefined}
      onClose={() => {
        setMoved(false);
        onClose?.();
      }}
    >
      <div
        className={cx("viewer", size === "asset" && "viewer--asset")}
        onKeyDown={(e) => {
          if (!many || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
          if ((e.target as HTMLElement).closest("[data-own-keys]")) return;
          e.preventDefault();
          go(e.key === "ArrowLeft" ? -1 : 1);
        }}
      >
        {/* Previous, Next and the arrow keys say where they went (the title is read once, as the viewer opens). */}
        <p className="sr-only" aria-live="polite">
          {moved ? said : ""}
        </p>
        {children}
        {many && (
          <div className="viewer__bar">
            <IconButton look="scrim" label={labels.previous} onClick={() => go(-1)}>
              <CaretLeft size={20} weight="bold" aria-hidden="true" />
            </IconButton>
            <span className="figures viewer__count" aria-hidden="true">
              {index + 1} of {count}
            </span>
            <IconButton look="scrim" label={labels.next} onClick={() => go(1)}>
              <CaretRight size={20} weight="bold" aria-hidden="true" />
            </IconButton>
          </div>
        )}
        <IconButton look="scrim" className="viewer__close" label={labels.close} autoFocus={closeFirst} onClick={() => dialog.current?.close()}>
          <X size={20} weight="bold" aria-hidden="true" />
        </IconButton>
      </div>
    </Dialog>
  );
}
