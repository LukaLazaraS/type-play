import { TextLink } from "@/components/ui/TextLink";
import { closedBeta } from "@/content/beta";
import { notOnSale } from "@/content/billing";
import { site } from "@/content/site";

/**
 * Billing off, said plainly wherever a plan or a pack can't be bought yet (the checkout, /billing, /create?plan=): the one
 * sentence (or the plan's own, `plan`; the pack's, `pack`), then what to do instead. In the closed beta the testers'
 * credits are added by hand; at the open launch Free is how to start (content/billing.ts `notOnSale`), said where someone
 * came to buy (`free`; not on /billing, which already shows the plan they are on). Words only: a lead's or a hint's text.
 */
export function NotOnSale({ plan, pack, free = true }: { plan?: string; pack?: boolean; free?: boolean }) {
  return (
    <>
      {plan ? notOnSale.plan(plan) : pack ? notOnSale.pack : notOnSale.line}{" "}
      {closedBeta ? (
        <>
          {notOnSale.beta} <TextLink href={`mailto:${site.email}`}>{site.email}</TextLink>.
        </>
      ) : (
        free && notOnSale.free
      )}
    </>
  );
}
