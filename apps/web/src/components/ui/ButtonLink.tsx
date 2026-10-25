import { Anchor, type AnchorProps } from "./Anchor";
import { cx } from "./cx";

/** hot: the one thing to press (ink on hot orange); quiet: Field, beside a hot one; ink: a final step on paper (Delete). */
export type ButtonLook = "hot" | "quiet" | "ink";
/** normal: 17px 22px, 17px type; small: 12px 16px, 15px, for the app's dense places (asks, menus, the composer). */
export type ButtonSize = "normal" | "small";

/** The button's classes (globals.css "Buttons"), for Button and ButtonLink only. */
export const buttonClass = (look: ButtonLook = "hot", size: ButtonSize = "normal", className?: string) =>
  cx("button", look === "quiet" && "button--quiet", look === "ink" && "button--ink", size === "small" && "button--small", className);

/** A link that looks like the site's button (DESIGN.md "Buttons"): hot, quiet or ink, normal or small. */
export function ButtonLink({ look, size, className, ...rest }: AnchorProps & { look?: ButtonLook; size?: ButtonSize }) {
  return <Anchor {...rest} className={buttonClass(look, size, className)} />;
}
