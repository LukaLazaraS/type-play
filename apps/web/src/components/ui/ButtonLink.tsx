import { Children, type ReactNode } from "react";
import { Anchor, type AnchorProps } from "./Anchor";
import { cx } from "./cx";

/** hot: the one thing to press (ink on hot orange); quiet: Field, beside a hot one; ink: a final step on paper (Delete). */
export type ButtonLook = "hot" | "quiet" | "ink";
/** normal: 17px 22px, 17px type; small: 12px 16px, 15px, for the app's dense places (asks, menus, the composer). */
export type ButtonSize = "normal" | "small";

/** The button's classes (globals.css "Buttons"), for Button and ButtonLink only. */
export const buttonClass = (look: ButtonLook = "hot", size: ButtonSize = "normal", className?: string) =>
  cx("button", look === "quiet" && "button--quiet", look === "ink" && "button--ink", size === "small" && "button--small", className);

/**
 * The button's words in a box of their own (globals.css ".button__label"), each run of text one box beside the icons, as
 * the anonymous boxes the browser made of them before: so they wrap inside the button at large text on a narrow phone
 * with room between their lines, while a label on one line keeps the button's height and its words' place to the pixel.
 */
export function buttonLabel(children: ReactNode): ReactNode {
  const out: ReactNode[] = [];
  let run: string[] = [];
  const close = () => {
    if (!run.length) return;
    out.push(
      <span key={`label-${out.length}`} className="button__label">
        {run.join("")}
      </span>,
    );
    run = [];
  };
  for (const child of Children.toArray(children)) {
    if (typeof child === "string" || typeof child === "number") run.push(String(child));
    else {
      close();
      out.push(child);
    }
  }
  close();
  return out;
}

/** A link that looks like the site's button (DESIGN.md "Buttons"): hot, quiet or ink, normal or small. */
export function ButtonLink({ look, size, className, children, ...rest }: AnchorProps & { look?: ButtonLook; size?: ButtonSize }) {
  return (
    <Anchor {...rest} className={buttonClass(look, size, className)}>
      {buttonLabel(children)}
    </Anchor>
  );
}
