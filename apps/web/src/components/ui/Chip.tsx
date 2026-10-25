import type { ComponentPropsWithRef, ReactNode } from "react";
import { cx } from "./cx";

/**
 * A Field pill with words, something to say or add (the ideas for the next change): 600 14px, 38px tall (44px for a
 * finger), #e6dff5 under a pointer, a press scale. With an icon it is an action ("More ideas").
 */
export function Chip({ icon, className, type = "button", children, ...rest }: Omit<ComponentPropsWithRef<"button">, "className"> & { icon?: ReactNode; className?: string }) {
  return (
    <button {...rest} type={type} className={cx("chip", icon !== undefined && "chip--icon", className)}>
      {icon}
      {children}
    </button>
  );
}
