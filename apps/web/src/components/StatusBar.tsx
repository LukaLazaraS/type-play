import Link from "next/link";
// The Sign in pill in the public build; sign-in, credits and the account menu in app builds
// (next.config.ts aliases this to components/SignInPill or components/app/AccountSlot).
import { AccountSlot } from "@app-gate/account";
import { Wordmark } from "@/components/ui/Wordmark";
import { app } from "@/content/app";

/** The same links on every page, public and app (Luka, 10-27). Games opens the gallery, which app builds have; the public
 * build has only the home page's games. */
export function StatusBar() {
  return (
    <header className="statusbar">
      <Wordmark home />
      <nav aria-label="Main">
        <Link href="/#how">How it works</Link>
        <Link href={app.enabled ? "/explore" : "/#games"} className="statusbar__keep">
          Games
        </Link>
        <Link href="/pricing" className="statusbar__keep">
          Pricing
        </Link>
        <AccountSlot />
      </nav>
    </header>
  );
}
