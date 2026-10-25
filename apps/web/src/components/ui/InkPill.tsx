import type { ComponentPropsWithRef, ReactNode } from "react";
import { Anchor, type AnchorProps } from "./Anchor";
import { cx } from "./cx";

type InkPillLook = {
  /** small: 36px tall (44px for a finger), 14px type: inside a line or a card. */
  size?: "normal" | "small";
  /** Hot with ink text while something it stands for is live (an Android build running, a shared game). */
  on?: boolean;
  /** A bold Phosphor icon, 18px (16px when small), before the words (after them with iconAfter). */
  icon?: ReactNode;
  iconAfter?: boolean;
  /**
   * The words, in their own span: a bar with no room for them (the game page's stage, the launcher, the share page under
   * 600px) shows the icon alone and keeps them for screen readers. Plain children always show.
   */
  label?: ReactNode;
  className?: string;
};

const inkPillClass = (size: InkPillLook["size"], className?: string) => cx("inkpill", size === "small" && "inkpill--small", className);

function Content({ icon, iconAfter, label, children }: Pick<InkPillLook, "icon" | "iconAfter" | "label"> & { children?: ReactNode }) {
  return (
    <>
      {!iconAfter && icon}
      {label !== undefined && <span className="inkpill__label">{label}</span>}
      {children}
      {iconAfter && icon}
    </>
  );
}

/**
 * The pill on ink (DESIGN.md: the launcher's and the stage's Ink Recess pills): 44px tall, Ink Recess with white 600
 * 15px words, #33245f under a pointer, a press scale, disabled muted. A <button type="button">.
 */
export function InkPill({ size, on, icon, iconAfter, label, className, type = "button", children, ...rest }: InkPillLook & Omit<ComponentPropsWithRef<"button">, "className">) {
  return (
    <button {...rest} type={type} className={inkPillClass(size, className)} data-on={on || undefined}>
      <Content icon={icon} iconAfter={iconAfter} label={label}>
        {children}
      </Content>
    </button>
  );
}

/** The pill on ink as a link (Android, New tab, Back to it). */
export function InkPillLink({ size, on, icon, iconAfter, label, className, children, ...rest }: InkPillLook & AnchorProps) {
  return (
    <Anchor {...rest} className={inkPillClass(size, className)} data-on={on || undefined}>
      <Content icon={icon} iconAfter={iconAfter} label={label}>
        {children}
      </Content>
    </Anchor>
  );
}
