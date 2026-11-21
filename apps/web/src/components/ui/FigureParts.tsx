import { Fragment, type ReactNode } from "react";

/**
 * A figures line's parts ("Runner · Made with TypePlay · 1.2K plays"), each a box of its own with its dot (app.css
 * ".parts__part"): the line breaks between parts, after a dot, so no line starts with one. A part wider than the line
 * (a long genre at large text on a phone) wraps at its own spaces, its dot kept on its last word. Empty parts are left
 * out. The share page's line under the name, the gallery's top game.
 */
export function FigureParts({ parts }: { parts: ReactNode[] }) {
  const shown = parts.filter((p) => p !== null && p !== undefined && p !== false && p !== "");
  return shown.map((part, i) => (
    <Fragment key={i}>
      <span className="parts__part">
        {part}
        {i < shown.length - 1 && "\u00a0·"}
      </span>
      {i < shown.length - 1 && " "}
    </Fragment>
  ));
}
