import type { ComponentPropsWithRef } from "react";
import { cx } from "./cx";

/**
 * A button that reads as words (it does something, where a TextLink goes somewhere). Every look reaches 44px for a
 * finger without moving anything (padding taken back by a negative margin). Disabled while its action runs: the progress
 * cursor.
 *   inline: inside a sentence, its words and colour, underlined ("Live updates stopped. Retry")
 *   standalone: a line of its own under a form part, 14px 600 underlined ("Use my own", "If you lose it")
 *   sky: on the ink stage with its icon, muted white 600 15px, white when pressed or hovered ("Report this game")
 */
export function TextButton({ look = "inline", className, type = "button", ...rest }: Omit<ComponentPropsWithRef<"button">, "className"> & { look?: "inline" | "standalone" | "sky"; className?: string }) {
  return <button {...rest} type={type} className={cx("textbutton", look !== "inline" && `textbutton--${look}`, className)} />;
}
