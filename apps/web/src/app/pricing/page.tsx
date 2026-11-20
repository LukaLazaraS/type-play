import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Check } from "@phosphor-icons/react/dist/ssr";
import { CreditsTable, mediumPerCredit } from "@/components/CreditsTable";
import { Ownership } from "@/components/Ownership";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { TextLink } from "@/components/ui/TextLink";
import { pricingSale, sale } from "@/content/billing";
import { credits, plans, site, type Plan } from "@/content/site";

export const metadata: Metadata = {
  title: "Pricing",
  // Built from the plans, so a price change in site.ts reaches search results too.
  description: `TypePlay plans: ${plans
    .map((p) => (p.price === 0 ? `${p.name} to start` : `${p.name} at $${p.price} a ${p.period}`))
    .join(", ")}. Credits per message, with an estimate shown before it runs.`,
  alternates: { canonical: "/pricing" },
};

const lead: Plan["id"] = "medium";
/** Billing off (no Paddle token in this build): the closed beta's words, or the open launch's (content/billing.ts). */
const off = sale === "on" ? null : pricingSale[sale];

function PlanCard({ p }: { p: Plan }) {
  const paid = p.price > 0;
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
      <div className="plan__action">
        {/* Billing off: the card says so above its button, and the button names where it really goes (the waitlist in the
            closed beta, Free at the open launch); /create?plan= keeps the plan and says the same after sign-in. */}
        {paid && off && <p className="plan__off">{off.card}</p>}
        {/* On the hot lead plan the button is the ink one (DESIGN.md: text on hot orange is ink, never orange on orange). */}
        <ButtonLink href={paid ? `/create?plan=${p.id}` : "/create"} look={p.id === lead ? "ink" : "quiet"}>
          {paid && off ? off.cta : p.cta}
        </ButtonLink>
      </div>
    </div>
  );
}

const t = credits.typical;
const faq: { q: string; a: ReactNode; wide?: boolean }[] = [
  {
    q: "What is a credit?",
    a: (
      <>
        What a message costs. Each one spends credits for the work it does: usually about {t.fastEdit} for a Fast change, {t.fastGame} for a Fast new
        game, {t.smartGame} for a Smart new game and {t.bestGame} for a Best one; a big game costs more (<TextLink href="#credits">the table above</TextLink>
        ). An estimate shows next to the send button before it runs, and a build that fails gives its credits back.
      </>
    ),
  },
  {
    q: "Does Ultra make better games?",
    a: "No. Every paid plan has the same Fast, Smart and Best, so your games look the same on Medium and on Ultra+. The plan only sets how many credits you get.",
  },
  {
    q: "What if I run out?",
    a: `On any paid plan, buy a credit pack: $${credits.pack.price} for ${credits.pack.credits} credits, usable for ${credits.pack.months} months. Unused monthly credits carry over to the next month once.`,
  },
  {
    q: "Can I change plans?",
    a: "Any time. A bigger plan gives you the extra credits right away, and you pay the difference for the rest of the month. A smaller plan starts at your next renewal.",
  },
  {
    q: "Can I cancel or get a refund?",
    a: (
      <>
        Cancel any time; the plan runs to the end of the month. Within {site.refundDays} days of a payment we refund the credits you haven&apos;t
        used, as the <TextLink href="/refunds">refund policy</TextLink> says.
      </>
    ),
  },
  // page-copy-proposals.md B5: the download is on every plan (no plan check in the API). Never "any time" (D1, terms first).
  {
    q: "Can I download my game?",
    a: "Yes, on every plan. The project comes as one .zip with all its files, and it opens in Godot, a free game engine. It is the game as it is now; the version history stays here. It is yours: change it, publish it, keep what it earns.",
  },
  {
    q: "Who are you buying from?",
    a: "Our order process is conducted by our online reseller Paddle.com. Paddle.com is the Merchant of Record for all our orders. Paddle provides all customer service inquiries and handles returns.",
    wide: true,
  },
];

/** The four promises at the point of choosing a plan, each a fact from the terms and docs/pricing.md. */
const promises: ReactNode[] = [
  "Free needs no card.",
  "Cancel any time; your plan runs to the end of the month.",
  <>
    Within {site.refundDays} days of a payment, we refund the credits you haven&apos;t used (<TextLink href="/refunds">refund policy</TextLink>).
  </>,
  "Paddle takes the payment and adds the tax.",
];

export default function Pricing() {
  return (
    <main>
      <section className="section section--top">
        <h1 className="display display--page">
          Pay for what
          <br />
          you <em>build.</em>
        </h1>
        <p className="lead">
          Every plan buys credits, and every paid plan has the same AI: Fast, Smart and Best on every message. Bigger plans get more credits for each
          dollar. <TextLink href="#credits">What credits buy</TextLink> is below the plans. Prices in US dollars; tax is added at checkout by Paddle.
        </p>
        {off && <p className="pricing__state">{off.lead}</p>}
        {/* Billing off: Free, the plan to start on, stays first when the cards stack (globals.css .plans--off). */}
        <div className={off ? "plans plans--off" : "plans"}>
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
        {/* The pack: bought on /billing once a plan is on, so a fact here, never a button. */}
        <div className="widget pack">
          <div className="title pack__name">Credit pack</div>
          <p>
            {credits.pack.credits} credits for ${credits.pack.price}, on any paid plan, when the month&apos;s run out. Use them within {credits.pack.months}{" "}
            months.{off && <> {off.pack}</>}
          </p>
          <div className="plan__price pack__price">${credits.pack.price}</div>
        </div>
        <ul className="promises">
          {promises.map((p, i) => (
            <li key={i}>
              <Check size={18} weight="bold" aria-hidden="true" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="section" id="credits" aria-labelledby="credits-title">
        <h2 id="credits-title" className="title">
          What credits buy.
        </h2>
        <p className="lead">
          Each message spends credits for the work it does. Here is what one usually costs. An estimate shows next to Send before it runs, and a
          build that fails gives its credits back.
        </p>
        <CreditsTable />
        <p className="lead lead--after">
          You pay for the work a message did, so a very big game can cost more. Dollars at Medium&apos;s price,{" "}
          {Math.round(mediumPerCredit * 100)} cents a credit; bigger plans pay less per credit. Free has Fast only: {credits.freePerMonth} credits a month,
          up to {credits.freePerDay} a day. More effort costs more.
        </p>
      </section>

      <Ownership />

      <section className="section" aria-labelledby="faq-title">
        <h2 id="faq-title" className="title">
          Good to know.
        </h2>
        <div className="faq">
          {faq.map((f) => (
            <div key={f.q} className={`widget${f.wide ? " faq__wide" : ""}`}>
              <b>{f.q}</b>
              <p>{f.a}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
