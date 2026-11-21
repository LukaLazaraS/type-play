import Link from "next/link";
import { Wordmark } from "@/components/ui/Wordmark";
import { site } from "@/content/site";
import { Address } from "@/components/ui/Address";

export function Footer() {
  return (
    <footer className="footer">
      <div>
        <Wordmark />
        <wbr />
        {/* Each of the home page's games began as one message; five of the fourteen are two sentences (content/games.ts). */}
        <span className="footer__line">Real games, each started from one message.</span>
      </div>
      <nav aria-label="Legal">
        <Link href="/pricing">Pricing</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/refunds">Refunds</Link>
        {/* At large text on a narrow phone the address breaks after the @ first. */}
        <a href={`mailto:${site.email}`}>
          <Address value={site.email} />
        </a>
        {site.phone && <a href={`tel:${site.phone.replace(/[^\d+]/g, "")}`}>{site.phone}</a>}
      </nav>
    </footer>
  );
}
