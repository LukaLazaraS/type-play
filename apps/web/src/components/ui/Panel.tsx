import type { ComponentPropsWithRef } from "react";
import { cx } from "./cx";

/**
 * A recessed area on paper (DESIGN.md "Field panel"): Field at the field radius. A quiet button on it is paper (Field on
 * Field has no edge). Its padding is its content's (the class it is given).
 */
export function Panel({ className, ...rest }: ComponentPropsWithRef<"div">) {
  return <div {...rest} className={cx("panel", className)} />;
}
