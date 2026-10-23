import Link from "next/link";

/**
 * The status bar's account place in the public build: the Sign in pill. App builds swap in
 * `app/AccountSlot` instead (next.config.ts, `@app-gate/account`), so the live site ships none of
 * the sign-in code until the app goes live.
 */
export function AccountSlot() {
  return (
    <Link href="/create" className="pill">
      Sign in
    </Link>
  );
}
