"use client";

import { useState, type ComponentPropsWithRef } from "react";
import { cx } from "./cx";

/** The first character as people see it (an emoji or an accented letter is one). */
export function firstLetter(text: string) {
  const first = new Intl.Segmenter("en", { granularity: "grapheme" }).segment(text.trim())[Symbol.iterator]().next().value;
  return (first?.segment ?? "?").toLocaleUpperCase();
}

/** Who is signed in: their Google picture (no referrer, or Google sometimes refuses it), or else the first letter of `name`. */
export function Avatar({ src, name }: { src?: string | null; name: string }) {
  const [broken, setBroken] = useState<string | null>(null);
  if (src && broken !== src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" referrerPolicy="no-referrer" width={40} height={40} onError={() => setBroken(src)} />
    );
  }
  return <span aria-hidden="true">{firstLetter(name || "?")}</span>;
}

/** The status bar's round paper button with the avatar in it (40px, 44px for a finger), which opens the account menu. */
export function AvatarButton({ className, type = "button", ...rest }: ComponentPropsWithRef<"button">) {
  return <button {...rest} type={type} className={cx("avatarbutton", className)} />;
}
