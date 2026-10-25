import Link from "next/link";

/** "Type" in white, "Play" in Sun Amber (DESIGN.md "Wordmark"): a link home in the status bar, words in the footer. */
export function Wordmark({ home }: { home?: boolean }) {
  const words = (
    <>
      Type<b>Play</b>
    </>
  );
  return home ? (
    <Link href="/" className="wordmark" aria-label="TypePlay home">
      {words}
    </Link>
  ) : (
    <span className="wordmark">{words}</span>
  );
}
