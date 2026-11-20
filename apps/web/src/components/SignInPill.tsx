"use client";

import { usePathname } from "next/navigation";
import { PillLink } from "@/components/ui/Pill";

/**
 * Sign in: the paper pill at the end of the status bar. It opens /create with the sign-in at the top, on a phone's first
 * screen (`?signin=1`), and after the sign-in comes back to the page it was pressed on (`next`, a path on this site:
 * lib/safe-next.ts checks it where it is used).
 */
export function SignInPill() {
  const here = usePathname();
  const href = here && here !== "/create" ? `/create?signin=1&next=${encodeURIComponent(here)}` : "/create?signin=1";
  return <PillLink href={href}>Sign in</PillLink>;
}

/**
 * The status bar's account place in the public build: the Sign in pill. App builds swap in
 * `app/AccountSlot` instead (next.config.ts, `@app-gate/account`), so the live site ships none of
 * the sign-in code until the app goes live.
 */
export function AccountSlot() {
  return <SignInPill />;
}
