"use client";

import type { ComponentPropsWithRef, ReactNode } from "react";
import { buttonClass, type ButtonLook, type ButtonSize } from "./ButtonLink";

export type ButtonProps = Omit<ComponentPropsWithRef<"button">, "className"> & {
  look?: ButtonLook;
  size?: ButtonSize;
  className?: string;
  /**
   * Working on it (a save, a send): it looks disabled and ignores presses, but keeps the keyboard focus (aria-disabled,
   * not disabled, which would drop it) and says so to screen readers (aria-busy). `busyLabel` replaces its words meanwhile.
   * `aria-disabled` alone (the main button while its question is open): the same grey and the same ignored presses and
   * keeps the focus, but nothing is said to be going on.
   */
  busy?: boolean;
  busyLabel?: ReactNode;
};

/**
 * The site's button (DESIGN.md "Buttons"): hot, quiet or ink, normal or small. Hover only for a pointer, a press scale,
 * the amber focus ring, disabled grey, busy. A <button type="button"> unless it says submit.
 */
export function Button({ look, size, className, busy = false, busyLabel, type = "button", onClick, children, ...rest }: ButtonProps) {
  const unavailable = busy || rest["aria-disabled"] === true || rest["aria-disabled"] === "true";
  return (
    <button
      {...rest}
      type={type}
      className={buttonClass(look, size, className)}
      aria-disabled={busy || rest["aria-disabled"] || undefined}
      aria-busy={busy || undefined}
      onClick={(e) => {
        // Busy or aria-disabled: no second press, and no form sent by Enter in a field (the browser clicks the submit button for it).
        if (unavailable) return e.preventDefault();
        onClick?.(e);
      }}
    >
      {busy && busyLabel !== undefined ? busyLabel : children}
    </button>
  );
}
