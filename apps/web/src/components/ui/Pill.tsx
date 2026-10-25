import { Anchor, type AnchorProps } from "./Anchor";
import { cx } from "./cx";

/** The paper pill on the sky (DESIGN.md "Status bar": Sign in): paper with ink 600 words, fully round, a press scale. */
export function PillLink({ className, ...rest }: AnchorProps) {
  return <Anchor {...rest} className={cx("pill", className)} />;
}
