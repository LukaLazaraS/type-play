"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { openCheckout, paddleOn, usePaddle, usePaddleEvents, type PaddleEvent } from "@/components/app/Paddle";
import { SignIn } from "@/components/app/SignIn";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Checkbox } from "@/components/ui/Checkbox";
import { ErrorLine } from "@/components/ui/ErrorLine";
import { PageWidget } from "@/components/ui/PageWidget";
import { Pulse } from "@/components/ui/Pulse";
import { TextLink } from "@/components/ui/TextLink";
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

  if (session.status === "loading") return <PageWidget busy />;
  if (!item) {
    return (
      <Shell title="Pick a plan." lead="This link doesn't name a plan or the credit pack.">
        <div className="acct__buttons">
          <ButtonLink href="/pricing">See the plans</ButtonLink>
          <ButtonLink href="/billing" look="quiet">
            Plan and billing
          </ButtonLink>
        </div>
      </Shell>
    );
  }
  const facts = item.kind === "plan" ? planFacts(item.plan) : null;
  const title = item.kind === "plan" ? `Get ${facts!.name}.` : "Credit pack.";
  if (session.status === "out") {
    return (
      <Shell title={title} lead="Sign in first; then the checkout opens here.">
        <SignIn next={`/billing/checkout?${params.toString()}`} />
      </Shell>
    );
  }
  if (!me) return <Shell title={title} lead={session.problem ?? "Checking your plan…"} leadRole={session.problem ? "alert" : undefined} />;
  if (!on) {
    return (
      <Shell
        title={title}
        lead={
          <>
            Paying for a plan or a credit pack opens here soon. During the beta, credits are added by hand: write to{" "}
            <TextLink href={`mailto:${site.email}`}>{site.email}</TextLink>.
          </>
        }
      >
        <div className="acct__buttons">
          <ButtonLink href="/pricing">See the plans</ButtonLink>
          <ButtonLink href={back ?? "/billing"} look="quiet">
            Back
          </ButtonLink>
        </div>
      </Shell>
    );
  }
  // A purchase under way or just made shows its own state: once the credits land, the account is on a
  // plan, and the turn-aways below would otherwise take over the page.
  if (stage.step === "done") {
    const added = item.kind === "plan" ? facts!.credits : pack.credits;
    return (
      <Shell
        title={item.kind === "plan" ? `You're on ${facts!.name}.` : "Credits added."}
        lead={`${added.toLocaleString("en-US")} credits added. They're on your account now; Paddle is emailing the receipt.`}
        data-done
      >
        <div className="acct__buttons">
          {back?.startsWith("/games/") ? <ButtonLink href={back}>Back to your game</ButtonLink> : <ButtonLink href="/create">Make a game</ButtonLink>}
          <ButtonLink href="/billing" look="quiet">
            Plan and billing
          </ButtonLink>
        </div>
      </Shell>
    );
  }
  if (stage.step === "paid") {
    return (
      <Shell title={title}>
        <p className="checkout__paid" role="status">
          <Pulse />
          Paid. Adding your credits…
        </p>
        {slow && (
          <p className="acct__note" role="status">
            Paddle confirmed your payment and is emailing the receipt; your credits should appear within a few minutes, else write to{" "}
            <TextLink href={`mailto:${support.email}`}>{support.email}</TextLink>.
          </p>
        )}
      </Shell>
    );
  }
  if (me.billing?.hold) {
    return (
      <Shell title={title} lead={HOLD_LINE} leadRole="alert">
        <BackButtons back={back} />
      </Shell>
    );
  }
  if (item.kind === "pack" && me.plan === "free") {
    const medium = planFacts("medium");
    return (
      <Shell title={title} lead={`Credit packs are for paid plans. Get Medium first: ${medium.credits} credits a month, Smart and Best.`}>
        <div className="acct__buttons">
          <ButtonLink href={checkoutHref("plan:medium", back)}>Get Medium, {usd(medium.price)} a month</ButtonLink>
          <ButtonLink href={back ?? "/billing"} look="quiet">
            Not now
          </ButtonLink>
        </div>
      </Shell>
    );
  }
  if (item.kind === "plan" && me.billing && me.billing.status !== "free") {
    return (
      <Shell title={title} lead="You already have a plan. Change it on the billing page instead of buying a second one.">
        <div className="acct__buttons">
          <ButtonLink href="/billing?change=1">Change plan</ButtonLink>
          <ButtonLink href={back ?? "/billing"} look="quiet">
            Not now
          </ButtonLink>
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
      <Checkbox checked={ticked} disabled={busy} required onChange={setTicked}>
        {consent.text}
      </Checkbox>
      <p className="checkout__accept">
        By continuing you accept the <TextLink href="/terms">Terms of service</TextLink> and the <TextLink href="/refunds">Refund policy</TextLink>.
      </p>
      <div className="checkout__go">
        <Button disabled={!ticked || !!paddle.problem} busy={busy} busyLabel="Opening Paddle…" onClick={() => void go()}>
          Continue to payment
        </Button>
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
      {(error || paddle.problem) && <ErrorLine>{error ?? paddle.problem}</ErrorLine>}
      <p className="field-hint">{back ? <TextLink href={back}>Not now</TextLink> : <TextLink href="/billing">Plan and billing</TextLink>}</p>
    </Shell>
  );
}

function Shell({ title, lead, leadRole, children, ...rest }: { title: string; lead?: ReactNode; leadRole?: "alert"; children?: ReactNode; "data-done"?: boolean }) {
  return (
    <PageWidget className="checkout" title={title} lead={lead} leadRole={leadRole} {...rest}>
      {children}
    </PageWidget>
  );
}

function BackButtons({ back }: { back: string | null }) {
  return (
    <div className="acct__buttons">
      <ButtonLink href={back ?? "/billing"} look="quiet">
        Back
      </ButtonLink>
    </div>
  );
}
