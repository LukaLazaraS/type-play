"use client";

// Pictures with a message (2026-11-04): the box's pictures before they are sent (the composer and /create's idea box).
// Each uploads as it is attached (POST /attachments), so a file the API won't take is said at once and Send only waits
// for what is still on its way; the message then names their ids. A picture taken out of the box before sending is
// deleted at once; one sent before with this game (the size check's one tap, Try again) comes back into the box as it is
// and is copied for the new message by the API.
import { useCallback, useEffect, useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import { ImageSquare } from "@phosphor-icons/react";
import type { MessageImage } from "@typeplay/shared";
import { FileButton } from "@/components/ui/FileButton";
import { Thumb } from "@/components/ui/Thumb";
import { pictures as t } from "@/content/app";
import { api, ApiFailure } from "@/lib/api";
import { knownPicture, pictureUrl } from "@/lib/pictures";

/** A picture in the box: on its way (busy), uploaded (`id`), or sent before with this game (`again`: sent again). */
export type TrayPicture = { key: string; name: string; url: string | null; id: string | null; again: boolean; busy: boolean };

export type Tray = {
  items: TrayPicture[];
  /** Some are still on their way. */
  busy: boolean;
  /** The last change, for screen readers ("2 pictures added."). */
  said: string;
  add: (files: File[]) => void;
  remove: (key: string) => void;
  /** Pictures sent before with this game, in the box again in their place (the box's own go): sent with the next message. */
  restore: (images: MessageImage[]) => void;
  /** Sent: the box is empty again. */
  clear: () => void;
  /** The ids to send, once every upload has landed; rejects (with the sentence to show) when one didn't. */
  ids: () => Promise<string[]>;
};

let made = 0;
/** A long file name, shortened in its middle so its end (".png") stays. */
const short = (name: string) => (name.length > 40 ? `${name.slice(0, 26)}…${name.slice(-12)}` : name);
/** The API's sentence, about this file by name: "That file isn't…" becomes "“cat.png” isn't…". */
const about = (name: string, message: string) => (name ? message.replace(/^That (file|picture)/, `“${short(name)}”`) : message);
const isPicture = (f: File) => (t.types as readonly string[]).includes(f.type) || (!f.type && /\.(png|jpe?g|webp)$/i.test(f.name));

/** The box's pictures. `onError`: a sentence about one that wasn't taken (shown in the error line). */
export function usePictureTray(onError: (message: string) => void): Tray {
  const [items, setItems] = useState<TrayPicture[]>([]);
  const [said, setSaid] = useState("");
  // What async work needs to see as it is now.
  const now = useRef<TrayPicture[]>([]);
  const report = useRef(onError);
  useEffect(() => {
    now.current = items;
    report.current = onError;
  });
  /** Each upload by its picture's key: its id when it lands, null when it didn't. */
  const landing = useRef(new Map<string, Promise<string | null>>());
  /** Taken out of the box while on its way: deleted once it lands. */
  const dropped = useRef(new Set<string>());
  /** Why an upload didn't land, by its picture's key: a Send waiting for it says the same. */
  const why = useRef(new Map<string, string>());
  /** The object URLs this box made (its own files), let go when their picture leaves the box. */
  const own = useRef(new Set<string>());
  const letGo = (p: TrayPicture) => {
    if (p.url && own.current.delete(p.url)) URL.revokeObjectURL(p.url);
  };
  const update = (list: TrayPicture[]) => {
    now.current = list;
    setItems(list);
  };

  const add = useCallback((files: File[]) => {
    const fresh: TrayPicture[] = [];
    const room = t.max - now.current.length;
    let problem: string | null = null;
    let left = 0;
    for (const file of files) {
      if (!isPicture(file)) {
        problem ??= t.wrongType(short(file.name));
        continue;
      }
      if (file.size > t.maxBytes) {
        problem ??= t.tooBig(short(file.name));
        continue;
      }
      if (fresh.length >= room) {
        left++;
        continue;
      }
      const key = `pic-${++made}`;
      const url = URL.createObjectURL(file);
      own.current.add(url);
      fresh.push({ key, name: file.name || "Pasted picture", url, id: null, again: false, busy: true });
      landing.current.set(
        key,
        api.pictures.upload(file).then(
          (a) => {
            knownPicture(a.id, file);
            if (dropped.current.delete(key)) {
              void api.pictures.remove(a.id).catch(() => {});
              return null;
            }
            update(now.current.map((p) => (p.key === key ? { ...p, id: a.id, busy: false } : p)));
            return a.id;
          },
          (e: unknown) => {
            const gone = now.current.find((p) => p.key === key);
            if (gone) letGo(gone);
            update(now.current.filter((p) => p.key !== key));
            const said = e instanceof ApiFailure && e.code !== "offline" ? about(file.name, e.message) : e instanceof Error ? e.message : t.failed;
            why.current.set(key, said);
            if (!dropped.current.delete(key)) report.current(said);
            return null;
          },
        ),
      );
    }
    if (left) problem = t.tooMany(left);
    if (problem) report.current(problem);
    if (fresh.length) {
      update([...now.current, ...fresh]);
      setSaid(t.added(fresh.length));
    }
  }, []);

  const remove = useCallback((key: string) => {
    const p = now.current.find((x) => x.key === key);
    if (!p) return;
    letGo(p);
    update(now.current.filter((x) => x.key !== key));
    if (!p.again) {
      if (p.id) void api.pictures.remove(p.id).catch(() => {});
      else dropped.current.add(key);
    }
    setSaid(t.removed);
  }, []);

  const restore = useCallback((images: MessageImage[]) => {
    for (const p of now.current) {
      letGo(p);
      if (!p.again) {
        if (p.id) void api.pictures.remove(p.id).catch(() => {});
        else dropped.current.add(p.key);
      }
    }
    const back = images.slice(0, t.max).map((img, i) => ({ key: `pic-${++made}`, name: `${t.yours} ${i + 1}`, url: null, id: img.id, again: true, busy: false }));
    update(back);
    for (const p of back) {
      void pictureUrl(p.id!, "thumb").then(
        (url) => update(now.current.map((x) => (x.key === p.key ? { ...x, url } : x))),
        () => {},
      );
    }
  }, []);

  const clear = useCallback(() => {
    now.current.forEach(letGo);
    update([]);
  }, []);

  const ids = useCallback(async () => {
    const out: string[] = [];
    for (const p of now.current) {
      const id = p.id ?? (await landing.current.get(p.key)) ?? null;
      if (!id) throw new Error(why.current.get(p.key) ?? t.failed);
      out.push(id);
    }
    return out;
  }, []);

  return { items, busy: items.some((p) => p.busy), said, add, remove, restore, clear, ids };
}

/**
 * Pictures dragged over the box (or the form around it) or pasted into the words join the box. While files are over it,
 * `over` is true (the box wears the keyboard's ring); a file dropped anywhere else on the page is ignored rather than
 * opened by the browser in place of the page.
 */
export function usePictureDrop(tray: Tray, on: boolean) {
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  const files = (e: DragEvent) => [...e.dataTransfer.types].includes("Files");
  useEffect(() => {
    if (!on) return;
    const ignore = (e: globalThis.DragEvent) => {
      if (e.dataTransfer && [...e.dataTransfer.types].includes("Files")) e.preventDefault();
    };
    window.addEventListener("dragover", ignore);
    window.addEventListener("drop", ignore);
    return () => {
      window.removeEventListener("dragover", ignore);
      window.removeEventListener("drop", ignore);
    };
  }, [on]);
  const zone = on
    ? {
        onDragEnter: (e: DragEvent) => {
          if (!files(e)) return;
          e.preventDefault();
          depth.current++;
          setOver(true);
        },
        onDragOver: (e: DragEvent) => {
          if (!files(e)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        },
        onDragLeave: (e: DragEvent) => {
          if (!files(e)) return;
          depth.current = Math.max(0, depth.current - 1);
          if (!depth.current) setOver(false);
        },
        onDrop: (e: DragEvent) => {
          if (!files(e)) return;
          e.preventDefault();
          depth.current = 0;
          setOver(false);
          tray.add([...e.dataTransfer.files]);
        },
      }
    : {};
  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    if (!on || !e.clipboardData) return;
    const pasted = [...e.clipboardData.files].filter((f) => f.type.startsWith("image/"));
    if (!pasted.length) return;
    // A copied picture alone: only the picture. With words beside it (copied from a document), the words paste too.
    if (!e.clipboardData.getData("text/plain")) e.preventDefault();
    tray.add(pasted);
  };
  return { over, zone, onPaste };
}

/** The box's pictures, before its words: square tiles in rows, each with Remove. Nothing when there are none. */
export function PictureTray({ tray, disabled }: { tray: Tray; disabled?: boolean }) {
  if (!tray.items.length) return null;
  return (
    <ul className="tray" aria-label={t.list}>
      {tray.items.map((p) => (
        <li key={p.key}>
          <Thumb src={p.url} alt={p.name} busy={p.busy} onRemove={disabled ? undefined : () => tray.remove(p.key)} removeLabel={t.remove(p.name)} />
        </li>
      ))}
    </ul>
  );
}

/** Add pictures: the round picture button at the end of the words (the picker takes several at once), and the line that
 * tells screen readers what the box's pictures did. */
export function AddPictures({ tray, disabled }: { tray: Tray; disabled?: boolean }) {
  return (
    <>
      <FileButton accept={t.accept} multiple disabled={disabled} icon={<ImageSquare size={22} aria-hidden="true" />} label={t.add} onFiles={tray.add} />
      <span className="sr-only" role="status">
        {tray.said}
      </span>
    </>
  );
}
