import Link from "next/link";
import { Wordmark } from "@/components/ui/Wordmark";
import { site } from "@/content/site";

export function Footer() {
  return (
    <footer className="footer">
      <div>
        <Wordmark />
        <span className="footer__line">Real games from one sentence.</span>
      </div>
      <nav aria-label="Legal">
        <Link href="/pricing">Pricing</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/refunds">Refunds</Link>
        <a href={`mailto:${site.email}`}>{site.email}</a>
        {site.phone && <a href={`tel:${site.phone.replace(/[^\d+]/g, "")}`}>{site.phone}</a>}
      </nav>
    </footer>
  );
}
