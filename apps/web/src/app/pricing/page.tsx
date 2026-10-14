import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "@phosphor-icons/react/dist/ssr";
import { plans, site } from "@/content/site";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "TypePlay plans: Free to start, Maker at $20 a month, Studio at $50 a month. Credits per build, shown before it runs.",
};

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
          Every plan buys credits. A build spends credits by the AI you pick, and we show the
          cost before it runs. Prices in US dollars; tax is added at checkout by Paddle.
        </p>
        <div className="plans">
          {plans.map((p) => (
            <div key={p.id} className={`widget plan${p.id === "maker" ? " plan--lead" : ""}`}>
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
                className={`button${p.id === "maker" ? "" : " button--quiet"}`}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="section" aria-labelledby="faq-title">
        <h2 id="faq-title" className="title">
          Good to know.
        </h2>
        <div className="faq">
          <div className="widget">
            <b>What is a credit?</b>
            <p>
              The unit a build costs. A Fast edit costs a few credits; a Smart new game costs
              more; Best costs the most. The price shows next to the send button every time.
              The game counts above are estimates from our test builds; the exact credit
              amounts are set before the paid beta.
            </p>
          </div>
          <div className="widget">
            <b>What if I run out?</b>
            <p>
              Buy extra credits any time on a paid plan. Unused monthly credits do not roll
              over.
            </p>
          </div>
          <div className="widget">
            <b>Can I cancel or get a refund?</b>
            <p>
              Cancel any time; the plan runs to the end of the month. Refunds within{" "}
              {site.refundDays} days, through Paddle, as the{" "}
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
