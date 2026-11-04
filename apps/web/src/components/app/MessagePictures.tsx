"use client";

import { useRef, useState } from "react";
import type { MessageImage } from "@typeplay/shared";
import type { DialogHandle } from "@/components/ui/Dialog";
import { PictureViewer } from "@/components/ui/PictureViewer";
import { Thumb } from "@/components/ui/Thumb";
import { pictures as t } from "@/content/app";
import { usePicture } from "@/lib/pictures";

/**
 * The pictures the player sent with a message (2026-11-04), over their bubble in the chat: tiles in a row from the right;
 * a tap opens them larger, one at a time (the whole picture is fetched only then).
 */
export function MessagePictures({ images }: { images: MessageImage[] }) {
  const viewer = useRef<DialogHandle>(null);
  const [at, setAt] = useState(0);
  const [opened, setOpened] = useState(false);
  const shown = images[Math.min(at, images.length - 1)];
  const full = usePicture(opened ? shown.id : null, "full");
  const thumb = usePicture(opened ? shown.id : null, "thumb");
  return (
    <>
      <ul className="msg__pictures" aria-label={images.length === 1 ? t.yours : `${t.yours}s`}>
        {images.map((img, i) => (
          <li key={img.id}>
            <Tile id={img.id} label={t.open(i + 1, images.length)}
              onOpen={(tile) => {
                setAt(i);
                setOpened(true);
                viewer.current?.open(tile);
              }}
            />
          </li>
        ))}
      </ul>
      <PictureViewer ref={viewer} index={at} count={images.length} src={full} placeholder={thumb} width={shown.width} height={shown.height} label={t.yours} onMove={setAt} />
    </>
  );
}

function Tile({ id, label, onOpen }: { id: string; label: string; onOpen: (tile: HTMLButtonElement) => void }) {
  const url = usePicture(id, "thumb");
  return <Thumb src={url} alt={label} size="chat" onOpen={onOpen} />;
}
