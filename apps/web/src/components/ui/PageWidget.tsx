import type { ComponentPropsWithRef, ReactNode } from "react";
import { cx } from "./cx";

/**
 * A page that is one paper widget on the sky: the app's (DESIGN.md: the 760px `.make` widget: /create, sign in to …, the
 * closed beta, the checkout, can't open this) or the public site's (`site`: the 680px widget of the 404 pages). A
 * headline-size title, then the lead in 17px muted, then the rest. `busy`: still loading, the room kept.
 */
export function PageWidget({
  site,
  title,
  lead,
  leadRole,
  busy,
  className,
  children,
  ...rest
}: Omit<ComponentPropsWithRef<"main">, "title"> & { site?: boolean; title?: ReactNode; lead?: ReactNode; leadRole?: "alert"; busy?: boolean; "data-done"?: boolean }) {
  return (
    <main {...rest} className={cx("widget", site ? "create" : "make", className)} data-app={site ? undefined : true} aria-busy={busy || undefined}>
      {title !== undefined && <h1 className={site ? "title" : "title make__title"}>{title}</h1>}
      {lead !== undefined && (
        <p className={site ? "create__text" : "make__lead"} role={leadRole}>
          {lead}
        </p>
      )}
      {children}
    </main>
  );
}
