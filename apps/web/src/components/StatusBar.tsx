import Link from "next/link";
// The Sign in pill in the public build; sign-in, credits and the account menu in app builds
// (next.config.ts aliases this to components/SignInPill or components/app/AccountSlot).
import { AccountSlot } from "@app-gate/account";
import { Wordmark } from "@/components/ui/Wordmark";

export function StatusBar() {
  return (
    <header className="statusbar">
      <Wordmark home />
      <nav aria-label="Main">
        <Link href="/#how">How it works</Link>
        <Link href="/#games">Games</Link>
        <Link href="/pricing" className="statusbar__keep">
          Pricing
        </Link>
        <AccountSlot />
      </nav>
    </header>
  );
}
