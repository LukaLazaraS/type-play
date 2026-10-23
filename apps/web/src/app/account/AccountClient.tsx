"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import type { Me, PlanId } from "@typeplay/shared";
import { Avatar, planName } from "@/components/app/AccountSlot";
import { SignIn } from "@/components/app/SignIn";
import { UsageList } from "@/components/app/UsageList";
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
      <main className="widget make" data-app>
        <h1 className="title make__title">Your account is deleted.</h1>
        <p className="make__lead">Your games, their share pages, your messages and your credit history are gone from TypePlay. Thanks for playing.</p>
        <Link href="/" className="button acct__home">
          Back home
        </Link>
      </main>
    );
  }
  if (session.status === "loading") return <main className="acct" data-app aria-busy="true" />;
  if (session.status === "out") {
    return (
      <main className="widget make" data-app>
        <h1 className="title make__title">Your account.</h1>
        <p className="make__lead">Sign in to see your plan, your credits and where they went.</p>
        <SignIn next="/account" />
      </main>
    );
  }

  const me = session.me;
  return (
    <main className="acct" data-app>
      <h1 className="title mine__title acct__title">Your account.</h1>
      <div className="acct__grid">
        <section className="widget acct__card acct__me" aria-label="Signed in as">
          <span className="acct__avatar">
            <Avatar me={me} />
          </span>
          <div className="acct__who">
            <b>{me?.name || "Signed in"}</b>
            {me && <span>{me.email}</span>}
            <span className="figures acct__via">{session.via === "dev" ? "Dev sign-in (this PC only)" : "Signed in with Google"}</span>
          </div>
          <button type="button" className="button button--quiet button--small acct__out" onClick={() => void signOut()}>
            Sign out
          </button>
        </section>

        <section className="widget acct__card acct__plan" aria-labelledby="acct-plan">
          <h2 id="acct-plan" className="acct__h">
            Plan and credits
          </h2>
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
                <Link href="/billing" className="button button--small">
                  Plan and billing
                </Link>
                <Link href="/pricing" className="button button--quiet button--small">
                  See the plans
                </Link>
              </div>
            </>
          ) : (
            <p className="acct__note">{session.problem ?? "Checking your credits…"}</p>
          )}
        </section>

        <section className="widget acct__card acct__usage" aria-labelledby="acct-usage">
          <div className="acct__usage-head">
            <h2 id="acct-usage" className="acct__h">
              Credit history
            </h2>
            <p className="acct__note">Every credit added and spent. Builds that didn&apos;t work cost nothing, so they aren&apos;t here.</p>
          </div>
          <UsageList />
        </section>

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
    <section className="widget acct__card acct__data" aria-labelledby="acct-data">
      <h2 id="acct-data" className="acct__h">
        Your data
      </h2>
      <p className="acct__note">
        A file with your account, your games&apos; details and every message you sent. Each game&apos;s files (its code and art) download from the
        game&apos;s page, or from Manage on{" "}
        <Link href="/games" className="link">
          Your games
        </Link>
        .
      </p>
      <button type="button" className="button button--quiet button--small" disabled={busy} onClick={() => void download()}>
        {busy ? "Preparing…" : "Download my data"}
      </button>
      {error && (
        <p className="composer__error" role="alert">
          {error}
        </p>
      )}
    </section>
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
    <section className="widget acct__card acct__close" aria-labelledby="acct-close">
      <h2 id="acct-close" className="acct__h">
        Delete your account
      </h2>
      <p className="acct__note">
        This deletes every game you made, their share pages, your messages and your credit history, and signs you out. It can&apos;t be undone.
      </p>
      {!asking ? (
        <button type="button" className="button button--quiet button--small" onClick={() => setAsking(true)}>
          Delete my account
        </button>
      ) : (
        <form className="acct__confirm" onSubmit={(e) => void close(e)} noValidate>
          {activePlan && <p className="acct__warn">Your {activePlan} plan is still active: it is cancelled when the account closes.</p>}
          {left > 0 && (
            <p className="acct__warn">
              Your {creditsWord(left)} go too.
              {paid && (
                <>
                  {" "}
                  Paid in the last {site.refundDays} days?{" "}
                  <Link href="/refunds" className="link">
                    Ask for a refund
                  </Link>{" "}
                  of the unused ones first.
                </>
              )}
            </p>
          )}
          <label htmlFor="confirm-delete" className="field-label">
            Type DELETE to confirm
          </label>
          <div className="field acct__field">
            <input
              id="confirm-delete"
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
          </div>
          <div className="acct__buttons">
            <button type="submit" className="button button--ink button--small" disabled={!ready || busy}>
              {busy ? "Deleting…" : "Delete everything"}
            </button>
            <button
              type="button"
              className="button button--quiet button--small"
              disabled={busy}
              onClick={() => {
                setAsking(false);
                setTyped("");
                setError(null);
              }}
            >
              Keep my account
            </button>
          </div>
          {error && (
            <p className="composer__error" role="alert">
              {error}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
