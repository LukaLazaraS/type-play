"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { openCheckout, paddleOn, usePaddle, usePaddleEvents, type PaddleEvent } from "@/components/app/Paddle";
import { SignIn } from "@/components/app/SignIn";
import { checkoutHref, consent, HOLD_LINE, pack, planFacts, planIdOf, support, type PaidPlan } from "@/content/billing";
import { site } from "@/content/site";
import { api } from "@/lib/api";
import { usd } from "@/lib/format";
import { refreshMe, useSession } from "@/lib/session";
import { safeNext } from "@/lib/supabase";

type Item = { kind: "plan"; plan: PaidPlan } | { kind: "pack" };
type Stage = { step: "form"; note?: string } | { step: "opening" } | { step: "paid"; transactionId: string; since: number } | { step: "done" };

/** ?item=plan:<id> or pack. */
function parseItem(raw: string | null): Item | null {
  if (raw === "pack") return { kind: "pack" };
  const plan = raw?.startsWith("plan:") ? planIdOf(raw.slice(5)) : null;
  return plan ? { kind: "plan", plan } : null;
}

/** After "checkout.completed": our rows every 2 s, Paddle itself at 20 s (and every 20 s after), honesty at 90 s. */
const POLL_MS = 2_000;
const VERIFY_EVERY_MS = 20_000;
const SLOW_AFTER_MS = 90_000;

/** /billing/checkout: what it costs, the tick box, Paddle's overlay, then the credits landing. */
export function CheckoutClient() {
  const params = useSearchParams();
  const item = parseItem(params.get("item"));
  const back = params.get("back") ? safeNext(params.get("back"), "/billing") : null;
  const session = useSession();
  const me = session.status === "in" ? session.me : null;
  const on = !!me && me.billing?.mode !== "off" && paddleOn;
  const paddle = usePaddle(on && !!item);
  const [ticked, setTicked] = useState(false);
  const [stage, setStage] = useState<Stage>({ step: "form" });
  const [error, setError] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  const opened = useRef<string | null>(null);

  const onEvent = useCallback((e: PaddleEvent) => {
    if (e.name === "checkout.completed") {
      const id = e.data?.transaction_id ?? opened.current;
      if (id) setStage({ step: "paid", transactionId: id, since: Date.now() });
    } else if (e.name === "checkout.closed") {
      setStage((s) => (s.step === "opening" ? { step: "form", note: "Nothing was charged." } : s));
    } else if (e.name === "checkout.error") {
      setError(e.error?.detail || "Paddle couldn't take the payment. Try again, or with another card.");
      setStage((s) => (s.step === "opening" ? { step: "form" } : s));
    }
  }, []);
  usePaddleEvents(onEvent);

  // Paid: the webhook usually lands within seconds; if not, the API asks Paddle itself at 20 s.
  useEffect(() => {
    if (stage.step !== "paid") return;
    const { transactionId, since } = stage;
    let live = true;
    let verifies = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const elapsed = Date.now() - since;
      try {
        let r;
        if (Math.floor(elapsed / VERIFY_EVERY_MS) > verifies) {
          verifies += 1;
          r = await api.verifyCheckout(transactionId);
        } else {
          r = await api.checkoutStatus(transactionId);
        }
        if (!live) return;
        if (r.status === "completed") {
          setStage({ step: "done" });
          void refreshMe();
          return;
        }
      } catch {
        /* a dropped request: the next tick asks again */
      }
      if (!live) return;
      if (elapsed >= SLOW_AFTER_MS) setSlow(true);
      timer = setTimeout(() => void tick(), POLL_MS);
    };
    timer = setTimeout(() => void tick(), POLL_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [stage]);

  const go = async () => {
    if (!item || !ticked || stage.step !== "form") return;
    setError(null);
    setStage({ step: "opening" });
    try {
      const { transactionId } = await api.checkout({ item: item.kind === "pack" ? "pack" : `plan:${item.plan}`, consentVersion: consent.version, acceptedTerms: true });
      opened.current = transactionId;
      await openCheckout(transactionId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStage({ step: "form" });
    }
  };

  if (session.status === "loading") return <main className="widget make" data-app aria-busy="true" />;
  if (!item) {
    return (
      <Shell title="Pick a plan.">
        <p className="make__lead">This link doesn&apos;t name a plan or the credit pack.</p>
        <div className="acct__buttons">
          <Link href="/pricing" className="button">
            See the plans
          </Link>
          <Link href="/billing" className="button button--quiet">
            Plan and billing
          </Link>
        </div>
      </Shell>
    );
  }
  const facts = item.kind === "plan" ? planFacts(item.plan) : null;
  const title = item.kind === "plan" ? `Get ${facts!.name}.` : "Credit pack.";
  if (session.status === "out") {
    return (
      <Shell title={title}>
        <p className="make__lead">Sign in first; then the checkout opens here.</p>
        <SignIn next={`/billing/checkout?${params.toString()}`} />
      </Shell>
    );
  }
  if (!me) {
    return (
      <Shell title={title}>
        <p className="make__lead" role={session.problem ? "alert" : undefined}>
          {session.problem ?? "Checking your plan…"}
        </p>
      </Shell>
    );
  }
  if (!on) {
    return (
      <Shell title={title}>
        <p className="make__lead">
          Paying for a plan or a credit pack opens here soon. During the beta, credits are added by hand: write to{" "}
          <a className="link" href={`mailto:${site.email}`}>
            {site.email}
          </a>
          .
        </p>
        <div className="acct__buttons">
          <Link href="/pricing" className="button">
            See the plans
          </Link>
          <Link href={back ?? "/billing"} className="button button--quiet">
            Back
          </Link>
        </div>
      </Shell>
    );
  }
  // A purchase under way or just made shows its own state: once the credits land, the account is on a
  // plan, and the turn-aways below would otherwise take over the page.
  if (stage.step === "done") {
    const added = item.kind === "plan" ? facts!.credits : pack.credits;
    return (
      <Shell title={item.kind === "plan" ? `You're on ${facts!.name}.` : "Credits added."} data-done>
        <p className="make__lead">
          {added.toLocaleString("en-US")} credits added. They&apos;re on your account now; Paddle is emailing the receipt.
        </p>
        <div className="acct__buttons">
          {back?.startsWith("/games/") ? (
            <Link href={back} className="button">
              Back to your game
            </Link>
          ) : (
            <Link href="/create" className="button">
              Make a game
            </Link>
          )}
          <Link href="/billing" className="button button--quiet">
            Plan and billing
          </Link>
        </div>
      </Shell>
    );
  }
  if (stage.step === "paid") {
    return (
      <Shell title={title}>
        <p className="checkout__paid" role="status">
          <span className="pulse" aria-hidden="true" />
          Paid. Adding your credits…
        </p>
        {slow && (
          <p className="acct__note" role="status">
            Paddle confirmed your payment and is emailing the receipt; your credits should appear within a few minutes, else write to{" "}
            <a className="link" href={`mailto:${support.email}`}>
              {support.email}
            </a>
            .
          </p>
        )}
      </Shell>
    );
  }
  if (me.billing?.hold) {
    return (
      <Shell title={title}>
        <p className="make__lead" role="alert">
          {HOLD_LINE}
        </p>
        <BackButtons back={back} />
      </Shell>
    );
  }
  if (item.kind === "pack" && me.plan === "free") {
    const medium = planFacts("medium");
    return (
      <Shell title={title}>
        <p className="make__lead">
          Credit packs are for paid plans. Get Medium first: {medium.credits} credits a month, Smart and Best.
        </p>
        <div className="acct__buttons">
          <Link href={checkoutHref("plan:medium", back)} className="button">
            Get Medium, {usd(medium.price)} a month
          </Link>
          <Link href={back ?? "/billing"} className="button button--quiet">
            Not now
          </Link>
        </div>
      </Shell>
    );
  }
  if (item.kind === "plan" && me.billing && me.billing.status !== "free") {
    return (
      <Shell title={title}>
        <p className="make__lead">You already have a plan. Change it on the billing page instead of buying a second one.</p>
        <div className="acct__buttons">
          <Link href="/billing?change=1" className="button">
            Change plan
          </Link>
          <Link href={back ?? "/billing"} className="button button--quiet">
            Not now
          </Link>
        </div>
      </Shell>
    );
  }

  const busy = stage.step === "opening";
  return (
    <Shell title={title}>
      <p className="checkout__sum">
        {item.kind === "plan"
          ? `${usd(facts!.price)} a month, plus tax where it applies. Renews every month until you cancel. ${facts!.credits.toLocaleString("en-US")} credits a month; unused ones carry over once, up to ${facts!.credits.toLocaleString("en-US")}.`
          : `Add ${pack.credits} credits. ${usd(pack.price)} plus tax. Good for ${pack.months} months; used after your plan credits.`}
      </p>
      <label className="consent">
        <input type="checkbox" checked={ticked} disabled={busy} required onChange={(e) => setTicked(e.target.checked)} />
        <span>{consent.text}</span>
      </label>
      <p className="checkout__accept">
        By continuing you accept the{" "}
        <Link href="/terms" className="link">
          Terms of service
        </Link>{" "}
        and the{" "}
        <Link href="/refunds" className="link">
          Refund policy
        </Link>
        .
      </p>
      <div className="checkout__go">
        <button type="button" className="button" disabled={!ticked || busy || !!paddle.problem} onClick={() => void go()}>
          {busy ? "Opening Paddle…" : "Continue to payment"}
        </button>
        {!ticked ? (
          <span className="field-hint">Tick the box to continue.</span>
        ) : (
          <span className="field-hint">Paddle takes the card; TypePlay never sees it.</span>
        )}
      </div>
      {stage.step === "form" && stage.note && (
        <p className="checkout__note" role="status">
          {stage.note}
        </p>
      )}
      {(error || paddle.problem) && (
        <p className="composer__error" role="alert">
          {error ?? paddle.problem}
        </p>
      )}
      <p className="field-hint">
        {back ? (
          <Link href={back} className="link">
            Not now
          </Link>
        ) : (
          <Link href="/billing" className="link">
            Plan and billing
          </Link>
        )}
      </p>
    </Shell>
  );
}

function Shell({ title, children, ...rest }: { title: string; children: ReactNode; "data-done"?: boolean }) {
  return (
    <main className="widget make checkout" data-app {...rest}>
      <h1 className="title make__title">{title}</h1>
      {children}
    </main>
  );
}

function BackButtons({ back }: { back: string | null }) {
  return (
    <div className="acct__buttons">
      <Link href={back ?? "/billing"} className="button button--quiet">
        Back
      </Link>
    </div>
  );
}
