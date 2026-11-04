import type { ComponentPropsWithRef } from "react";
import { cx } from "./cx";

/**
 * A round button with an icon and no words; `label` says what it does to screen readers (and as its name). 36px, 44px
 * for a finger.
 *   ghost: on ink, no fill, the icon muted; Ink Recess under a pointer or when pressed ("Hide this" on the build pill)
 *   scrim: over a picture, a translucent ink circle (the full-screen close tab's ink at 60%), ink when pressed or hovered
 *   field: in a Field box (Add pictures, 2026-11-04), no fill, the icon in muted ink; paper under a pointer or when pressed
 * `small`: a 24px circle (on a picture's tile: Remove) that still takes a finger's 44px around it.
 */
export function IconButton({
  look = "ghost",
  small,
  label,
  className,
  type = "button",
  ...rest
}: Omit<ComponentPropsWithRef<"button">, "className" | "aria-label"> & { look?: "ghost" | "scrim" | "field"; small?: boolean; label: string; className?: string }) {
  return <button {...rest} type={type} aria-label={label} className={cx("iconbutton", `iconbutton--${look}`, small && "iconbutton--small", className)} />;
}
