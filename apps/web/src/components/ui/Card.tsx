import type { ComponentPropsWithRef, ReactNode } from "react";
import { cx } from "./cx";

/**
 * A paper card on the sky (the account, billing and Android pages): the widget at 26px 28px (22px 20px and a 32px radius
 * on a phone), its parts stacked 14px apart, then its heading in Onest 700 19px when it has one.
 */
export function Card({ title, titleId, className, children, ...rest }: Omit<ComponentPropsWithRef<"section">, "title"> & { title?: ReactNode; titleId?: string }) {
  return (
    <section {...rest} className={cx("widget", "card", className)} aria-labelledby={title !== undefined ? titleId : rest["aria-labelledby"]}>
      {title !== undefined && <CardTitle id={titleId}>{title}</CardTitle>}
      {children}
    </section>
  );
}

/** The card's heading, for a card that lays it out itself (beside a button, over a line). */
export function CardTitle({ id, tabIndex, children }: { id?: string; tabIndex?: number; children: ReactNode }) {
  return (
    <h2 id={id} className="card__h" tabIndex={tabIndex}>
      {children}
    </h2>
  );
}
