import type { ComponentPropsWithRef } from "react";
import { cx } from "./cx";

/**
 * A sentence to notice, marked with the hot dot: 600 15px, ink on paper ("Your Medium plan is still active"), white on
 * the sky (`sky`: "Android is set up", "You're in the beta"). Not an error (ErrorLine is).
 */
export function Callout({ tone = "paper", className, ...rest }: ComponentPropsWithRef<"p"> & { tone?: "paper" | "sky" }) {
  return <p {...rest} className={cx("callout", tone === "sky" && "callout--sky", className)} />;
}
