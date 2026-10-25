"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import type { BillingInfo, BillingPayment, CreditPart, Me, PlanChangePreview, PlanId, PortalLinks } from "@typeplay/shared";
import { planName } from "@/components/app/AccountSlot";
import { paddleOn } from "@/components/app/Paddle";
import { SignIn } from "@/components/app/SignIn";
import { ActionButton } from "@/components/ui/ActionButton";
import { Ask } from "@/components/ui/Ask";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card, CardTitle } from "@/components/ui/Card";
import { ErrorLine } from "@/components/ui/ErrorLine";
import { PageWidget } from "@/components/ui/PageWidget";
import { Strip } from "@/components/ui/Strip";
import { TextLink } from "@/components/ui/TextLink";
import { checkoutHref, HOLD_LINE, PAID_PLANS, pack, planAbove, planFacts, support, type PaidPlan } from "@/content/billing";
import { credits as siteCredits, site } from "@/content/site";
import { api } from "@/lib/api";
import { credits, creditsWord, dayOf, usd, usdCents } from "@/lib/format";
import { refreshMe, useSession } from "@/lib/session";

type Load = { status: "loading" } | { status: "ok"; info: BillingInfo } | { status: "error"; message: string };

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
/** "a", "a and b", "a, b and c". */
const joinAnd = (parts: string[]) => (parts.length < 2 ? parts.join("") : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`);
const dayAfter = (iso: string) => new Date(Date.parse(iso) + 86_400_000).toISOString();

/** Plan and billing: the strips that need a decision, the plan and its credits, the plan picker, and the payments. */
export function BillingClient() {
  const session = useSession();
  const params = useSearchParams();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  // The picker opens from "Change plan" / "Get a plan", or at once from a link with ?change=1 (the game page's panels).
  const [picking, setPicking] = useState(params.get("change") === "1");
  const me = session.status === "in" ? session.me : null;
  const on = !!me && me.billing?.mode !== "off" && paddleOn;

  useEffect(() => {
    if (!on) return;
    let live = true;
    api.billing().then(
      (info) => live && setLoad({ status: "ok", info }),
      (e: unknown) => live && setLoad({ status: "error", message: message(e) }),
    );
    return () => {
      live = false;
    };
  }, [on]);
  /** Try again, and after anything that changed the plan (then the header's credits too). */
  const reload = useCallback(async () => {
    try {
      setLoad({ status: "ok", info: await api.billing() });
    } catch (e) {
      setLoad({ status: "error", message: message(e) });
    }
  }, []);
  const changed = useCallback(async () => {
    await Promise.all([reload(), refreshMe()]);
  }, [reload]);

  if (session.status === "loading") return <main className="bill" data-app aria-busy="true" />;
  if (session.status === "out") {
    return (
      <PageWidget title="Plan and billing." lead="Sign in to see your plan.">
        <SignIn next="/billing" />
      </PageWidget>
    );
  }
  if (!me) {
    return <PageWidget title="Plan and billing." lead={session.problem ?? "Checking your plan…"} leadRole={session.problem ? "alert" : undefined} />;
  }
  if (!on) return <Off me={me} />;
  if (load.status === "loading") {
    return (
      <main className="bill" data-app aria-busy="true">
        <h1 className="title mine__title bill__title">Plan and billing.</h1>
        <div className="bill__grid">
          <Card className="bill__plan bill__ghost" aria-hidden="true" />
          <Card className="bill__pay bill__ghost" aria-hidden="true" />
        </div>
      </main>
    );
  }
  if (load.status === "error") {
    return (
      <PageWidget title="Plan and billing.">
        <ErrorLine>{load.message}</ErrorLine>
        <div className="acct__buttons">
          <Button look="quiet" onClick={() => void reload()}>
            Try again
          </Button>
        </div>
      </PageWidget>
    );
  }

  const info = load.info;
  return (
    <main className="bill" data-app>
      <h1 className="title mine__title bill__title">Plan and billing.</h1>
      <Strips info={info} onChanged={changed} onGetPlan={() => setPicking(true)} />
      <div className="bill__grid">
        <PlanCard me={me} info={info} picking={picking} onPick={() => setPicking((p) => !p)} onChanged={changed} />
        {picking && <Picker info={info} onClose={() => setPicking(false)} onChanged={changed} />}
        <PaymentCard info={info} />
      </div>
    </main>
  );
}

/** No payment keys on this server (or sandbox billing is not for this user): today's beta text. */
function Off({ me }: { me: Me }) {
  return (
    <PageWidget
      title="Plan and billing."
      lead={
        <>
          You are on <b>{planName[me.plan]}</b>, with {creditsWord(me.credits.available)} to spend. Paying for a plan or a credit pack opens here soon.
          During the beta, credits are added by hand: write to <TextLink href={`mailto:${site.email}`}>{site.email}</TextLink>.
        </>
      }
    >
      <div className="acct__buttons">
        <ButtonLink href="/pricing">See the plans</ButtonLink>
        <ButtonLink href="/account" look="quiet">
          Your account
        </ButtonLink>
      </div>
    </PageWidget>
  );
}

/** Opens one of Paddle's portal links in a new tab: the tab opens on the click (popup blockers), the fresh link arrives a moment later. */
function PortalButton({ which, children, asLink = false }: { which: keyof PortalLinks; children: ReactNode; asLink?: boolean }) {
  const open = async () => {
    const tab = window.open("about:blank", "_blank");
    try {
      const links = await api.portal();
      const url = links[which] ?? links.overview;
      if (tab) {
        tab.opener = null;
        tab.location.href = url;
      } else {
        window.location.href = url;
      }
    } catch (e) {
      tab?.close();
      throw e;
    }
  };
  return <ActionButton look={asLink ? "text" : "quiet"} label={children} busyLabel={asLink ? undefined : "Opening Paddle…"} run={open} />;
}

// ---- Strips: one sentence and one button each, above the cards --------------------------------------

function Strips({ info, onChanged, onGetPlan }: { info: BillingInfo; onChanged: () => Promise<void>; onGetPlan: () => void }) {
  const s = info.subscription;
  const paid = info.plan !== "free";
  const strips: { key: string; text: string; action?: ReactNode }[] = [];
  if (info.hold) strips.push({ key: "hold", text: HOLD_LINE });
  if (s && paid && s.status === "past_due") {
    strips.push({
      key: "past-due",
      text: `Your ${s.endsAt ? `${dayOf(s.endsAt)} ` : ""}payment for ${planName[info.plan]} didn't go through. Update your card and Paddle will try again for up to 30 days. You keep your credits until a day after your period ends; no new ones until a payment goes through.`,
      action: <PortalButton which="updatePaymentMethod">Update card</PortalButton>,
    });
  }
  if (s && !paid && s.status === "past_due") {
    strips.push({
      key: "ended",
      text: `Your ${planName[s.lastPlan ?? "medium"]} plan ended${s.endsAt ? ` on ${dayOf(dayAfter(s.endsAt))}` : ""} because the payment didn't go through. You're on Free.`,
      action: (
        <Button look="quiet" size="small" onClick={onGetPlan}>
          Get a plan
        </Button>
      ),
    });
  }
  if (s && paid && s.cancelsAt) {
    strips.push({
      key: "cancel",
      text: `Your plan ends on ${dayOf(s.cancelsAt)}. Your credits stay until then; pack credits keep working for their ${pack.months} months.`,
      action: <ActionButton label="Keep my plan" busyLabel="Keeping it…" run={api.keepPlan} onDone={onChanged} />,
    });
  }
  if (s && paid && s.pendingPlan) {
    const when = s.renewsAt ?? s.endsAt;
    strips.push({
      key: "downgrade",
      text: `You move to ${planName[s.pendingPlan]}${when ? ` on ${dayOf(when)}` : " at your renewal"}. Until then ${planName[info.plan]} and all its credits stay.`,
      action: <ActionButton label={`Keep ${planName[info.plan]}`} busyLabel="Keeping it…" run={api.undoPlanChange} onDone={onChanged} />,
    });
  }
  for (const p of info.payments) {
    if (p.refundPendingUsd !== null) {
      strips.push({ key: `refund-${p.id}`, text: `A refund of ${usdCents(p.refundPendingUsd)} is with Paddle for approval; the credits from that payment are on hold meanwhile.` });
    }
  }
  if (!strips.length) return null;
  return (
    <div className="bill__strips">
      {strips.map((strip) => (
        <Strip key={strip.key} kind={strip.key} label={strip.text} action={strip.action}>
          {strip.text}
        </Strip>
      ))}
    </div>
  );
}

// ---- The plan card -----------------------------------------------------------------------------------

/** "163 from High (carry over to 17 Dec, up to 275)", "40 from a pack (until 18 Oct 2027)", "20 free (until 1 Nov)". */
function partText(p: CreditPart, plan: PlanId): string {
  const left = credits(p.left);
  if (p.source === "free") return `${left} free${p.expiresAt ? ` (until ${dayOf(p.expiresAt)})` : ""}`;
  if (p.source === "pack") return `${left} from a pack${p.expiresAt ? ` (until ${dayOf(p.expiresAt)})` : ""}`;
  if (p.source === "admin") return `${left} given by hand`;
  const name = plan === "free" ? "your plan" : planName[plan];
  return `${left} from ${name}${p.expiresAt ? ` (carry over to ${dayOf(p.expiresAt)}, up to ${planFacts(plan).credits.toLocaleString("en-US")})` : ""}`;
}

function creditsLine(me: Me, info: BillingInfo): string {
  const total = me.credits.available;
  if (total < 0) return `You owe ${creditsWord(-total)}: a build cost more than expected. The next credits added settle it first.`;
  const parts = info.credits.parts.map((p) => partText(p, info.plan));
  return `${creditsWord(total)} to spend${parts.length > 1 ? `: ${joinAnd(parts)}` : ""}.`;
}

/** Free: "14 left, 3 more today. 20 more on 1 Nov." */
function freeLine(me: Me): string {
  const today = me.credits.todayLeft;
  const refill = me.billing?.freeRefillAt;
  const left = `${credits(Math.max(0, me.credits.available))} left${today !== null && today !== undefined ? `, ${credits(today)} more today` : ""}.`;
  return `${left} 20 more ${refill ? `on ${dayOf(refill)}` : "next month"}.`;
}

/** Paid: "Next payment 17 Nov: $50 plus tax, Visa ending 4242." (or what replaces it). */
function nextPaymentLine(info: BillingInfo): string | null {
  const s = info.subscription;
  if (!s) return null;
  if (s.cancelsAt) return `Ends on ${dayOf(s.cancelsAt)}.`;
  if (s.status === "past_due") return "Your last payment didn't go through.";
  // Paddle's subscription webhook sets the renewal date; until it lands, the paid period's end is the same day.
  const next = s.renewsAt ?? s.endsAt;
  if (!next) return null;
  const card = s.paymentMethod ? `, ${s.paymentMethod}` : "";
  if (s.pendingPlan) return `Next payment ${dayOf(next)}: ${usd(planFacts(s.pendingPlan).price)} plus tax for ${planName[s.pendingPlan]}${card}.`;
  return `Next payment ${dayOf(next)}: ${usd(planFacts(info.plan).price)} plus tax${card}.`;
}

function PlanCard({ me, info, picking, onPick, onChanged }: { me: Me; info: BillingInfo; picking: boolean; onPick: () => void; onChanged: () => Promise<void> }) {
  const [asking, setAsking] = useState(false);
  const s = info.subscription;
  const paid = info.plan !== "free";
  const facts = planFacts(info.plan);
  const next = nextPaymentLine(info);
  const canCancel = paid && s?.status === "active" && !s.cancelsAt;
  const extra = info.credits.parts.filter((p) => p.source !== "free");
  return (
    <Card title="Your plan" titleId="bill-plan" className="bill__plan">
      <p className="bill__planline">
        <b className="bill__planname">{facts.name}</b>
        {paid && <span>{usd(facts.price)} a month.</span>}
      </p>
      {paid ? (
        <>
          {next && <p className="acct__note">{next}</p>}
          <p className="bill__credits">{creditsLine(me, info)}</p>
        </>
      ) : (
        <>
          <p className="acct__note">
            {facts.credits} credits a month, up to {siteCredits.freePerDay} a day, on Fast.
          </p>
          <p className="bill__credits">{freeLine(me)}</p>
          {extra.length > 0 && <p className="acct__note">Also {joinAnd(extra.map((p) => partText(p, info.plan)))}.</p>}
        </>
      )}
      <div className="acct__buttons">
        {paid ? (
          <>
            {info.canBuyPack && (
              <ButtonLink href={checkoutHref("pack", "/billing")} look={picking ? "quiet" : "hot"} size="small">
                Buy a credit pack
              </ButtonLink>
            )}
            <Button look="quiet" size="small" aria-expanded={picking} onClick={onPick}>
              Change plan
            </Button>
            {canCancel && !asking && (
              <Button look="quiet" size="small" onClick={() => setAsking(true)}>
                Cancel plan
              </Button>
            )}
          </>
        ) : (
          // Hot until the picker is open: then the picker's lead plan is the one thing to press.
          <Button look={picking ? "quiet" : "hot"} size="small" aria-expanded={picking} onClick={onPick}>
            Get a plan
          </Button>
        )}
      </div>
      {asking && (
        <Ask
          className="bill__ask"
          text={
            <>
              Cancel at the end of your period? {facts.name} and its credits stay until {s?.endsAt ? dayOf(s.endsAt) : "then"}; pack credits keep working
              for their {pack.months} months.
            </>
          }
          actions={
            <>
              <ActionButton
                label="Cancel plan"
                busyLabel="Cancelling…"
                look="ink"
                run={api.cancelPlan}
                onDone={async () => {
                  setAsking(false);
                  await onChanged();
                }}
              />
              <Button look="quiet" size="small" onClick={() => setAsking(false)}>
                Keep it
              </Button>
            </>
          }
        />
      )}
    </Card>
  );
}

// ---- The plan picker ---------------------------------------------------------------------------------

function Picker({ info, onClose, onChanged }: { info: BillingInfo; onClose: () => void; onChanged: () => Promise<void> }) {
  const [open, setOpen] = useState<PaidPlan | null>(null);
  const s = info.subscription;
  // A change goes through the subscription; without one (Free, cancelled, lapsed) a plan is bought at checkout.
  const subscribed = info.plan !== "free" && !!s && (s.status === "active" || s.status === "past_due");
  return (
    <Card className="picker" aria-labelledby="bill-pick">
      <div className="acct__usage-head">
        <CardTitle id="bill-pick">{subscribed ? "Change plan" : "Pick a plan"}</CardTitle>
        <p className="acct__note">Every paid plan has the same Fast, Smart and Best; bigger plans get more credits for each dollar. US dollars, tax added at checkout.</p>
      </div>
      <ul className="picker__rows">
        {PAID_PLANS.map((id) => (
          <PlanRow key={id} id={id} info={info} subscribed={subscribed} open={open === id} onOpen={() => setOpen(id)} onClose={() => setOpen(null)} onChanged={onChanged} />
        ))}
      </ul>
      <Button look="quiet" size="small" onClick={onClose}>
        Close
      </Button>
    </Card>
  );
}

type Preview = { status: "loading" } | { status: "ok"; preview: PlanChangePreview } | { status: "done"; text: string; direction: "up" | "down" } | { status: "error"; message: string };

function PlanRow({ id, info, subscribed, open, onOpen, onClose, onChanged }: { id: PaidPlan; info: BillingInfo; subscribed: boolean; open: boolean; onOpen: () => void; onClose: () => void; onChanged: () => Promise<void> }) {
  const facts = planFacts(id);
  const current = info.plan === id;
  const up = !current && facts.price > planFacts(info.plan).price;
  // One hot button in the picker: the lead plan (Medium, as on the pricing page) for someone without a
  // plan, the next plan up for someone on one; the other rows are quiet.
  const lead = subscribed ? planAbove(info.plan) === id : id === "medium";

  const action = current ? (
    <span className="picker__now" aria-current="true">
      Your plan
    </span>
  ) : !subscribed ? (
    <ButtonLink href={checkoutHref(`plan:${id}`, "/billing")} look={lead ? "hot" : "quiet"} size="small">
      Get {facts.name}
    </ButtonLink>
  ) : (
    // Quiet while its preview is open: the preview's confirm button is then the one to press.
    <Button look={lead && !open ? "hot" : "quiet"} size="small" aria-expanded={open} onClick={open ? onClose : onOpen}>
      {up ? "Upgrade" : "Switch at renewal"}
    </Button>
  );

  return (
    <li className="picker__row" data-on={current || undefined}>
      <div className="picker__text">
        <b className="picker__name">{facts.name}</b>
        <span className="picker__facts">
          {usd(facts.price)} a month, {facts.credits.toLocaleString("en-US")} credits
        </span>
      </div>
      <div className="picker__action">{action}</div>
      {open && <PreviewBox id={id} info={info} onClose={onClose} onChanged={onChanged} />}
    </li>
  );
}

/** Under a row: what Paddle says the change costs, and the button that does it. Mounted fresh for each row opened. */
function PreviewBox({ id, info, onClose, onChanged }: { id: PaidPlan; info: BillingInfo; onClose: () => void; onChanged: () => Promise<void> }) {
  const [preview, setPreview] = useState<Preview>({ status: "loading" });
  const [busy, setBusy] = useState(false);
  const facts = planFacts(id);
  const s = info.subscription;

  useEffect(() => {
    let live = true;
    api.planChangePreview(id).then(
      (p) => live && setPreview({ status: "ok", preview: p }),
      (e: unknown) => live && setPreview({ status: "error", message: message(e) }),
    );
    return () => {
      live = false;
    };
  }, [id]);

  // "Done. You move to Medium on 17 Nov" must not outlive the change: when the strip's Keep (or
  // anything else) undoes the scheduled move, this box closes instead of contradicting the page.
  const pending = s?.pendingPlan ?? null;
  useEffect(() => {
    if (preview.status === "done" && preview.direction === "down" && pending !== id) onClose();
  }, [preview, pending, id, onClose]);

  const confirm = async () => {
    setBusy(true);
    try {
      const r = await api.planChange({ plan: id });
      setPreview({
        status: "done",
        direction: r.direction,
        text:
          r.direction === "up"
            ? `Done. Paddle is charging ${s?.paymentMethod ?? "your card"} ${usdCents(r.chargeNowUsd)} now; ${creditsWord(r.creditsNow)} arrive within a minute, with a receipt by email.`
            : `Done. You move to ${facts.name} on ${dayOf(r.effectiveAt)}; ${planName[info.plan]} and all its credits stay until then.`,
      });
      await onChanged();
    } catch (e) {
      setPreview({ status: "error", message: message(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Ask
      className="picker__preview"
      role="status"
      actions={
        <>
          {preview.status === "ok" && (
            <Button size="small" busy={busy} busyLabel="One moment…" onClick={() => void confirm()}>
              {preview.preview.direction === "up" ? `Upgrade to ${facts.name}` : `Switch to ${facts.name}`}
            </Button>
          )}
          <Button look="quiet" size="small" disabled={busy} onClick={onClose}>
            {preview.status === "done" ? "Close" : "Not now"}
          </Button>
        </>
      }
    >
      {preview.status === "loading" && <p>Asking Paddle what this costs…</p>}
      {preview.status === "error" && <ErrorLine alert={false}>{preview.message}</ErrorLine>}
      {preview.status === "done" && <p>{preview.text}</p>}
      {preview.status === "ok" && (
        <p>
          {preview.preview.direction === "up"
            ? `You pay ${usdCents(preview.preview.chargeNowUsd)} now (tax included), charged to ${s?.paymentMethod ?? "your card"}, and get about ${creditsWord(preview.preview.creditsNow)} now; then ${usd(preview.preview.nextRenewalUsd)} a month from ${s?.renewsAt ?? s?.endsAt ? dayOf((s?.renewsAt ?? s?.endsAt)!) : "your next renewal"}.`
            : `Nothing now. From ${dayOf(preview.preview.effectiveAt)} you pay ${usd(preview.preview.nextRenewalUsd)} a month and get ${facts.credits.toLocaleString("en-US")} credits a month; ${planName[info.plan]} and all its credits stay until then.`}
        </p>
      )}
    </Ask>
  );
}

// ---- The payment card --------------------------------------------------------------------------------

function statusText(p: BillingPayment, now = Date.now()): string {
  if (p.refundPendingUsd !== null) return "refund pending";
  if (p.status === "disputed") return "disputed";
  if (p.status === "refunded") return "refunded";
  if (p.status === "partly_refunded") return `${usdCents(p.refundedUsd)} refunded`;
  return Date.parse(p.refundableUntil) > now ? `paid, refundable until ${dayOf(p.refundableUntil)}` : "paid";
}

function PaymentCard({ info }: { info: BillingInfo }) {
  const s = info.subscription;
  // Nothing was ever paid: no card to update, no invoices, nothing to withdraw from.
  const customer = !!s || info.payments.length > 0;
  return (
    <Card title="Payment" titleId="bill-pay" className="bill__pay">
      <p className="acct__note">
        {s?.paymentMethod ? `Paying with ${s.paymentMethod}. ` : ""}
        Paddle.com is the merchant of record: it {customer ? "holds" : "will hold"} your card, invoices and receipts
        {customer ? "" : "; they show here once you pay"}.
      </p>
      {customer && (
        <>
          <div className="acct__buttons">
            <PortalButton which="updatePaymentMethod">Update card</PortalButton>
            <PortalButton which="overview">Invoices and receipts</PortalButton>
          </div>
          <p className="acct__note">
            <PortalButton which="overview" asLink>
              Withdraw from contract here
            </PortalButton>{" "}
            (Paddle&apos;s portal, EU and UK), or write to us; the <TextLink href="/refunds">refund policy</TextLink> says what comes back.
          </p>
        </>
      )}
      {info.consent && (
        <p className="acct__note" data-consent>
          On {dayOf(info.consent.at)} you asked us to start right away (wording {info.consent.version}).
        </p>
      )}
      <p className="acct__note">
        Help with a payment: <TextLink href={`mailto:${support.email}`}>{support.email}</TextLink>
        {support.phone && (
          <>
            {" "}
            or <TextLink href={`tel:${support.phone.replace(/\s+/g, "")}`}>{support.phone}</TextLink>
          </>
        )}
        .
      </p>
      <h3 className="bill__h3">Payments</h3>
      {info.payments.length === 0 ? (
        <p className="usage__empty">No payments yet.</p>
      ) : (
        <ol className="pays">
          {info.payments.map((p) => (
            <li key={p.id} className="pays__row">
              <time className="figures pays__when" dateTime={p.at}>
                {dayOf(p.at)}
              </time>
              <div className="pays__what">
                <b>{p.what}</b>
                {p.invoiceNumber && <span className="figures">invoice {p.invoiceNumber}</span>}
              </div>
              <div className="pays__side">
                <span className="figures pays__amount">{usdCents(p.amountUsd + p.taxUsd)}</span>
                <span className="figures pays__tax">
                  {usd(p.amountUsd)} + {usd(p.taxUsd)} tax
                </span>
                <span className="pays__status" data-status={p.refundPendingUsd !== null ? "pending" : p.status}>
                  {statusText(p)}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
