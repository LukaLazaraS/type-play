import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * What went wrong, said in one line (DESIGN.md: an error is ink 600 text after an 8px hot dot, no red): 14px, ink on
 * paper, white on ink (`sky`). Announced at once (role alert) unless something around it already is (`alert={false}`).
 */
export function ErrorLine({ as: Tag = "p", tone = "paper", alert = true, id, className, children }: { as?: "p" | "span"; tone?: "paper" | "sky"; alert?: boolean; id?: string; className?: string; children: ReactNode }) {
  return (
    <Tag id={id} className={cx("error-line", tone === "sky" && "error-line--sky", className)} role={alert ? "alert" : undefined}>
      {children}
    </Tag>
  );
}
