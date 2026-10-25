import { PillLink } from "@/components/ui/Pill";

/** Sign in: the paper pill at the end of the status bar, to /create (Google's sign-in is there). */
export function SignInPill() {
  return <PillLink href="/create">Sign in</PillLink>;
}

/**
 * The status bar's account place in the public build: the Sign in pill. App builds swap in
 * `app/AccountSlot` instead (next.config.ts, `@app-gate/account`), so the live site ships none of
 * the sign-in code until the app goes live.
 */
export function AccountSlot() {
  return <SignInPill />;
}
