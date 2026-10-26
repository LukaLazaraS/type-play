import type { ComponentPropsWithRef, ReactNode } from "react";
import { Check, Plus } from "@phosphor-icons/react";
import { cx } from "./cx";

/**
 * A Field pill with words, something to say or add (the ideas for the next change): 600 14px, 38px tall (44px for a
 * finger), #e6dff5 under a pointer, a press scale. With an icon it is an action ("More ideas"). With `pressed` it is an
 * on/off toggle (/create's Tags, `aria-pressed`): a plus before the words while off; on, ink with white words and a
 * check where the plus was, so the pill never changes width.
 */
export function Chip({
  icon,
  pressed,
  className,
  type = "button",
  children,
  ...rest
}: Omit<ComponentPropsWithRef<"button">, "className" | "aria-pressed"> & { icon?: ReactNode; pressed?: boolean; className?: string }) {
  const mark = pressed === undefined ? icon : pressed ? <Check size={14} weight="bold" aria-hidden="true" /> : <Plus size={14} weight="bold" aria-hidden="true" />;
  return (
    <button {...rest} type={type} aria-pressed={pressed} className={cx("chip", mark !== undefined && "chip--icon", className)}>
      {mark}
      {children}
    </button>
  );
}
