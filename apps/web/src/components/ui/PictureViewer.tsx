"use client";

import { useImperativeHandle, useRef, type CSSProperties, type Ref } from "react";
import { CaretLeft, CaretRight, X } from "@phosphor-icons/react";
import { Dialog, type DialogHandle } from "./Dialog";
import { IconButton } from "./IconButton";

type Props = {
  ref?: Ref<DialogHandle>;
  /** The picture showing, from 0, of `count`. */
  index: number;
  count: number;
  /** The picture whole; null while it comes, when `placeholder` (its thumbnail) stands in at its size. */
  src: string | null;
  placeholder: string | null;
  /** Its size, so its frame keeps its shape before it arrives. */
  width: number;
  height: number;
  /** What the pictures are: the title says "<label> 2 of 5" ("Your picture 2 of 5"). */
  label: string;
  onMove: (index: number) => void;
};

/**
 * The pictures of a message one at a time, whole (2026-11-04): a dialog with no paper of its own over ink at 92%, the
 * picture as large as the screen lets it be (never more than twice its own size) at the field radius, Previous and Next
 * with "2 of 5" between them under it (and the arrow keys) when there are more, Close in the screen's top corner (and
 * Escape, and a tap beside the picture). It arrives and leaves as the dialogs do; the keyboard goes back to the tile that
 * opened it (`open(tile)`).
 */
export function PictureViewer({ ref, index, count, src, placeholder, width, height, label, onMove }: Props) {
  const dialog = useRef<DialogHandle>(null);
  useImperativeHandle(ref, () => ({ open: (from) => dialog.current?.open(from), close: () => dialog.current?.close() }), []);
  const many = count > 1;
  const go = (step: number) => onMove((index + step + count) % count);
  const shown = src ?? placeholder;
  return (
    <Dialog ref={dialog} look="picture" labelledBy="viewer-title">
      <div
        className="viewer"
        onKeyDown={(e) => {
          if (!many || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
          e.preventDefault();
          go(e.key === "ArrowLeft" ? -1 : 1);
        }}
      >
        <h2 id="viewer-title" className="sr-only">
          {many ? `${label} ${index + 1} of ${count}` : label}
        </h2>
        <div className="viewer__frame" style={{ "--ratio": width / height, "--w": width } as CSSProperties} aria-busy={!src || undefined}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {shown && <img src={shown} alt="" draggable={false} />}
        </div>
        {many && (
          <div className="viewer__bar">
            <IconButton look="scrim" label="Previous picture" onClick={() => go(-1)}>
              <CaretLeft size={20} weight="bold" aria-hidden="true" />
            </IconButton>
            <span className="figures viewer__count" aria-hidden="true">
              {index + 1} of {count}
            </span>
            <IconButton look="scrim" label="Next picture" onClick={() => go(1)}>
              <CaretRight size={20} weight="bold" aria-hidden="true" />
            </IconButton>
          </div>
        )}
        <IconButton look="scrim" className="viewer__close" label="Close" autoFocus onClick={() => dialog.current?.close()}>
          <X size={20} weight="bold" aria-hidden="true" />
        </IconButton>
      </div>
    </Dialog>
  );
}
