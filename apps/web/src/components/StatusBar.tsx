import Link from "next/link";

export function StatusBar() {
  return (
    <header className="statusbar">
      <Link href="/" className="wordmark" aria-label="TypePlay home">
        Type<b>Play</b>
      </Link>
      <nav aria-label="Main">
        <Link href="/#how">How it works</Link>
        <Link href="/#games">Games</Link>
        <Link href="/pricing" className="statusbar__keep">
          Pricing
        </Link>
        <Link href="/create" className="pill">
          Sign in
        </Link>
      </nav>
    </header>
  );
}
