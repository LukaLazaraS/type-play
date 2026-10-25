"use client";

import { useState, type FormEvent } from "react";
import type { Me, PlanId } from "@typeplay/shared";
import { planName } from "@/components/app/AccountSlot";
import { SignIn } from "@/components/app/SignIn";
import { UsageList } from "@/components/app/UsageList";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Callout } from "@/components/ui/Callout";
import { Card, CardTitle } from "@/components/ui/Card";
import { ErrorLine } from "@/components/ui/ErrorLine";
import { TextField } from "@/components/ui/Field";
import { PageWidget } from "@/components/ui/PageWidget";
import { TextLink } from "@/components/ui/TextLink";
import { plans, site } from "@/content/site";
import { api, saveFile } from "@/lib/api";
import { credits, creditsWord, dayOf, whenParts } from "@/lib/format";
import { signOut, useSession } from "@/lib/session";

/** One line on what the plan gives, from the pricing page's own numbers (content/site.ts). */
function planLine(plan: PlanId) {
  const p = plans.find((x) => x.name === planName[plan]);
  if (!p) return null;
  return plan === "free" ? `${p.credits} credits a month, up to 5 a day, on Fast.` : `${p.credits.toLocaleString("en-US")} credits a month, $${p.price} a month.`;
}

/** "12 credits end on 3 Nov": the credits that end soonest (Free: this month's; plans: the carried month). */
function endingLine(expiring: { amount: number; at: string } | null | undefined) {
  if (!expiring || expiring.amount <= 0) return null;
  const one = Math.round(expiring.amount * 10) === 10;
  return `${creditsWord(expiring.amount)} ${one ? "ends" : "end"} on ${whenParts(expiring.at).day}.`;
}

/** "Renews on 17 Nov." / "Ends on 17 Nov." / what replaces it (the billing page has the buttons). */
function renewLine(me: Me): string | null {
  const b = me.billing;
  if (!b || me.plan === "free") return null;
  if (b.status === "canceling" && b.cancelsAt) return `Ends on ${dayOf(b.cancelsAt)}.`;
  if (b.status === "past_due") return "Your last payment didn't go through: update your card on Plan and billing.";
  if (b.pendingPlan && b.periodEndsAt) return `Moves to ${planName[b.pendingPlan]} on ${dayOf(b.periodEndsAt)}.`;
  if (b.periodEndsAt) return `Renews on ${dayOf(b.periodEndsAt)}.`;
  return null;
}

/** The plan a subscription still pays for (it is cancelled when the account closes). */
const activePlan = (me: Me | null) => (me && me.plan !== "free" && me.billing && me.billing.status !== "free" ? planName[me.plan] : null);

/** The account: who you are, your plan and credits, every credit in and out, your data, and leaving. */
export function AccountClient() {
  const session = useSession();
  const [closed, setClosed] = useState(false);

  if (closed) {
    return (
      <PageWidget
        title="Your account is deleted."
        lead="Your games, their share pages, your messages and your credit history are gone from TypePlay. Thanks for playing."
      >
        <ButtonLink href="/" className="acct__home">
          Back home
        </ButtonLink>
      </PageWidget>
    );
  }
  if (session.status === "loading") return <main className="acct" data-app aria-busy="true" />;
  if (session.status === "out") {
    return (
      <PageWidget title="Your account." lead="Sign in to see your plan, your credits and where they went.">
        <SignIn next="/account" />
      </PageWidget>
    );
  }

  const me = session.me;
  return (
    <main className="acct" data-app>
      <h1 className="title mine__title acct__title">Your account.</h1>
      <div className="acct__grid">
        <Card className="acct__me" aria-label="Signed in as">
          <span className="acct__avatar">
            <Avatar src={me?.avatarUrl} name={me?.name || me?.email || "?"} />
          </span>
          <div className="acct__who">
            <b>{me?.name || "Signed in"}</b>
            {me && <span>{me.email}</span>}
            <span className="figures acct__via">{session.via === "dev" ? "Dev sign-in (this PC only)" : "Signed in with Google"}</span>
          </div>
          <Button look="quiet" size="small" className="acct__out" onClick={() => void signOut()}>
            Sign out
          </Button>
        </Card>

        <Card title="Plan and credits" titleId="acct-plan" className="acct__plan">
          {me ? (
            <>
              <p className="acct__balance">
                <span className="acct__big">{credits(me.credits.available)}</span>
                <span>{me.credits.available === 1 ? "credit" : "credits"} to spend</span>
              </p>
              <dl className="account__facts acct__facts">
                <div>
                  <dt>Plan</dt>
                  <dd>{planName[me.plan]}</dd>
                </div>
                {me.credits.todayLeft !== null && (
                  <div>
                    <dt>Left today</dt>
                    <dd className="figures">{credits(me.credits.todayLeft)} of 5</dd>
                  </div>
                )}
              </dl>
              {planLine(me.plan) && <p className="acct__note">{planLine(me.plan)}</p>}
              {renewLine(me) && <p className="acct__note">{renewLine(me)}</p>}
              {endingLine(me.credits.expiring) && <p className="acct__note">{endingLine(me.credits.expiring)}</p>}
              {me.notice && <p className="acct__note">{me.notice}</p>}
              <div className="acct__buttons">
                <ButtonLink href="/billing" size="small">
                  Plan and billing
                </ButtonLink>
                <ButtonLink href="/pricing" look="quiet" size="small">
                  See the plans
                </ButtonLink>
              </div>
            </>
          ) : (
            <p className="acct__note">{session.problem ?? "Checking your credits…"}</p>
          )}
        </Card>

        <Card className="acct__usage" aria-labelledby="acct-usage">
          <div className="acct__usage-head">
            <CardTitle id="acct-usage">Credit history</CardTitle>
            <p className="acct__note">Every credit added and spent. Builds that didn&apos;t work cost nothing, so they aren&apos;t here.</p>
          </div>
          <UsageList />
        </Card>

        <DataCard />
        <CloseCard credits={me?.credits.available ?? 0} paid={!!me && me.plan !== "free"} activePlan={activePlan(me)} onClosed={() => setClosed(true)} />
      </div>
    </main>
  );
}

function DataCard() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      saveFile(await api.exportData());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card title="Your data" titleId="acct-data" className="acct__data">
      <p className="acct__note">
        A file with your account, your games&apos; details and every message you sent. Each game&apos;s files (its code and art) download from the
        game&apos;s page, or from Manage on <TextLink href="/games">Your games</TextLink>.
      </p>
      <Button look="quiet" size="small" busy={busy} busyLabel="Preparing…" onClick={() => void download()}>
        Download my data
      </Button>
      {error && <ErrorLine>{error}</ErrorLine>}
    </Card>
  );
}

function CloseCard({ credits: left, paid, activePlan, onClosed }: { credits: number; paid: boolean; activePlan: string | null; onClosed: () => void }) {
  const [asking, setAsking] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = typed.trim() === "DELETE";

  const close = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.closeAccount();
      onClosed();
      await signOut();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <Card title="Delete your account" titleId="acct-close" className="acct__close">
      <p className="acct__note">
        This deletes every game you made, their share pages, your messages and your credit history, and signs you out. It can&apos;t be undone.
      </p>
      {!asking ? (
        <Button look="quiet" size="small" onClick={() => setAsking(true)}>
          Delete my account
        </Button>
      ) : (
        <form className="acct__confirm" onSubmit={(e) => void close(e)} noValidate>
          {activePlan && <Callout>Your {activePlan} plan is still active: it is cancelled when the account closes.</Callout>}
          {left > 0 && (
            <Callout>
              Your {creditsWord(left)} go too.
              {paid && (
                <>
                  {" "}
                  Paid in the last {site.refundDays} days? <TextLink href="/refunds">Ask for a refund</TextLink> of the unused ones first.
                </>
              )}
            </Callout>
          )}
          <TextField
            id="confirm-delete"
            label="Type DELETE to confirm"
            boxClassName="acct__field"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
            disabled={busy}
            autoFocus
          />
          <div className="acct__buttons">
            <Button type="submit" look="ink" size="small" disabled={!ready} busy={busy} busyLabel="Deleting…">
              Delete everything
            </Button>
            <Button
              look="quiet"
              size="small"
              disabled={busy}
              onClick={() => {
                setAsking(false);
                setTyped("");
                setError(null);
              }}
            >
              Keep my account
            </Button>
          </div>
          {error && <ErrorLine>{error}</ErrorLine>}
        </form>
      )}
    </Card>
  );
}
