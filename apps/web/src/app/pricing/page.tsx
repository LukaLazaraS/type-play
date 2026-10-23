import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "@phosphor-icons/react/dist/ssr";
import { Ownership } from "@/components/Ownership";
import { credits, plans, site, type Plan } from "@/content/site";

export const metadata: Metadata = {
  title: "Pricing",
  // Built from the plans, so a price change in site.ts reaches search results too.
  description: `TypePlay plans: ${plans
    .map((p) => (p.price === 0 ? `${p.name} to start` : `${p.name} at $${p.price} a ${p.period}`))
    .join(", ")}. Credits per build, shown before it runs.`,
  alternates: { canonical: "/pricing" },
};

const lead: Plan["id"] = "medium";

function PlanCard({ p }: { p: Plan }) {
  return (
    <div className={`widget plan${p.id === lead ? " plan--lead" : ""}`}>
      <div>
        <div className="title plan__name">{p.name}</div>
        <div className="plan__price">
          ${p.price}
          <small>/ {p.period}</small>
        </div>
      </div>
      <p>{p.summary}</p>
      <ul>
        {p.features.map((f) => (
          <li key={f}>
            <Check size={18} weight="bold" aria-hidden="true" />
            {f}
          </li>
        ))}
      </ul>
      <Link
        href={p.id === "free" ? "/create" : `/create?plan=${p.id}`}
        className={`button${p.id === lead ? "" : " button--quiet"}`}
      >
        {p.cta}
      </Link>
    </div>
  );
}

export default function Pricing() {
  const t = credits.typical;
  return (
    <main>
      <section className="section section--top">
        <h1 className="display display--page">
          Pay for what
          <br />
          you <em>build.</em>
        </h1>
        <p className="lead">
          Every plan buys credits, and every paid plan has the same AI: Fast, Smart and Best on
          every message. Bigger plans get more credits for each dollar. Prices in US dollars;
          tax is added at checkout by Paddle.
        </p>
        <div className="plans">
          {plans
            .filter((p) => p.row === 1)
            .map((p) => (
              <PlanCard key={p.id} p={p} />
            ))}
        </div>
        <div className="plans plans--big">
          {plans
            .filter((p) => p.row === 2)
            .map((p) => (
              <PlanCard key={p.id} p={p} />
            ))}
        </div>
      </section>

      <Ownership />

      <section className="section" aria-labelledby="faq-title">
        <h2 id="faq-title" className="title">
          Good to know.
        </h2>
        <div className="faq">
          <div className="widget">
            <b>What is a credit?</b>
            <p>
              What a message costs. Each one spends credits for the work it does: usually about{" "}
              {t.fastEdit} for a Fast edit, {t.fastGame} for a Fast new game, {t.smartGame} for a
              Smart new game and {t.bestGame} for a Best one. The cost shows next to the send
              button before it runs, and a build that fails gives its credits back.
            </p>
          </div>
          <div className="widget">
            <b>Does Ultra make better games?</b>
            <p>
              No. Every paid plan has the same Fast, Smart and Best, so your games look the same
              on Medium and on Ultra+. The plan only sets how many credits you get.
            </p>
          </div>
          <div className="widget">
            <b>What if I run out?</b>
            <p>
              On any paid plan, buy a credit pack: ${credits.pack.price} for {credits.pack.credits}{" "}
              credits, usable for {credits.pack.months} months. Unused monthly credits carry over
              to the next month once.
            </p>
          </div>
          <div className="widget">
            <b>Can I change plans?</b>
            <p>
              Any time. A bigger plan gives you the extra credits right away, and you pay the
              difference for the rest of the month. A smaller plan starts at your next renewal.
            </p>
          </div>
          <div className="widget">
            <b>Can I cancel or get a refund?</b>
            <p>
              Cancel any time; the plan runs to the end of the month. Within {site.refundDays}{" "}
              days of a payment we refund the credits you haven&apos;t used, as the{" "}
              <Link href="/refunds" className="link">
                refund policy
              </Link>{" "}
              says.
            </p>
          </div>
          <div className="widget">
            <b>Who are you buying from?</b>
            <p>
              Our order process is conducted by our online reseller Paddle.com. Paddle.com is
              the Merchant of Record for all our orders. Paddle provides all customer service
              inquiries and handles returns.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
