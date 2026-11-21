import { Fragment, type ReactNode } from "react";

/**
 * An e-mail address, a web address or a package name (with any punctuation stuck to it), whole on one line wherever it
 * fits, as plain words are: a box of its own as wide as the address (globals.css ".address"), so a line breaks around
 * it, never inside, while it fits. Only an address wider than its whole line (200% text on a narrow phone) breaks inside,
 * where such an address may (the style books' rule): an e-mail after its "@" ("hello@" / "typeplay.app"), its domain a
 * box of its own too, so it breaks before a dot only when it alone is wider than the line; a web address or a package
 * name after a single "/" or a "_", and before a dot that starts a word ("play.google" / ".com/apps/"). An address longer
 * than LONG letters never fits a phone's line whole, so it is no box: it flows with the words around it, breaking at the
 * same places (a box as wide as the line would push the words after it to a line of their own).
 */
const LONG = 40;
export function Address({ value }: { value: string }) {
  const at = value.indexOf("@");
  if (at > 0 && at < value.length - 1)
    return (
      <span className="address">
        {value.slice(0, at + 1)}
        <wbr />
        <Address value={value.slice(at + 1)} />
      </span>
    );
  const pieces = value.split(/(?<=_)|(?<=\/)(?!\/)|(?=\.[A-Za-z])/);
  return (
    <span className={value.length > LONG ? "address address--flow" : "address"}>
      {pieces.map((piece, i) => (
        <Fragment key={i}>
          {i > 0 && <wbr />}
          {piece}
        </Fragment>
      ))}
    </span>
  );
}

/** Words with the addresses in them as Address (see above), for text kept as one string (the legal pages). */
export function withAddresses(text: string): ReactNode {
  if (!/[\w-]\.[A-Za-z]{2,}|\w@\w/.test(text)) return text;
  return text.split(/(\s+)/).map((word, i) => (/[\w-]\.[A-Za-z]{2,}|\w@\w/.test(word) ? <Address key={i} value={word} /> : word));
}
