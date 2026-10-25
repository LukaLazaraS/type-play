import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * Ask first (DESIGN.md: an estimate over the limit, a cancel, a package-name change): a Field panel with one sentence in
 * 600 15px and its buttons beside it, wrapping under it when narrow. Announced (role alert) unless it is a status.
 * `text` is the sentence; `children` take its place when it is more than one (a preview's states).
 */
export function Ask({ text, children, actions, role = "alert", className, panel }: { text?: ReactNode; children?: ReactNode; actions: ReactNode; role?: "alert" | "status"; className?: string; panel?: string }) {
  return (
    <div className={cx("ask", "panel", className)} role={role} data-panel={panel}>
      {text !== undefined && <p>{text}</p>}
      {children}
      <div className="ask__actions">{actions}</div>
    </div>
  );
}
