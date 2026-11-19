import { Check } from "@phosphor-icons/react/dist/ssr";
import type { ComponentPropsWithRef } from "react";
import { cx } from "./cx";

/**
 * A sentence to notice, marked with the hot dot: 600 15px, ink on paper ("Your Medium plan is still active"), white on
 * the sky (`sky`: "Android is set up", "You're in the beta"). Not an error (ErrorLine is).
 * `mark="check"` (2026-11-19): something done ("You're on the list"): a bold check in the text's own colour where the dot
 * goes, so it doesn't read like the error line's hot dot. No new colour.
 */
export function Callout({
  tone = "paper",
  mark = "dot",
  className,
  children,
  ...rest
}: ComponentPropsWithRef<"p"> & { tone?: "paper" | "sky"; mark?: "dot" | "check" }) {
  return (
    <p {...rest} className={cx("callout", tone === "sky" && "callout--sky", mark === "check" && "callout--check", className)}>
      {mark === "check" && <Check className="callout__check" size={16} weight="bold" aria-hidden="true" />}
      {children}
    </p>
  );
}
