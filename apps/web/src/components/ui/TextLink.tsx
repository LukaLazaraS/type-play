import { Anchor, type AnchorProps } from "./Anchor";
import { cx } from "./cx";

/** A link inside a sentence: the words as they are, underlined 3px below. */
export function TextLink({ className, ...rest }: AnchorProps) {
  return <Anchor {...rest} className={cx("link", className)} />;
}
