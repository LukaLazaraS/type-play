"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { ArrowUp, Stop } from "@phosphor-icons/react";
import Link from "next/link";
import type { CreditBalance, Effort, Estimate, Me, ModelChoice } from "@typeplay/shared";
import { android } from "@/content/android";
import { checkoutHref, HOLD_LINE, pack, planAbove, planFacts } from "@/content/billing";
import { credits as siteCredits } from "@/content/site";
import { ApiFailure } from "@/lib/api";
import { creditsWord, dayOf, untilUtcMidnight, usd } from "@/lib/format";
import { planName } from "./AccountSlot";
import { EffortSwitch, effortLine, ModelSwitch, modelLine } from "./ModelPicker";
import { MAX_TEXT, useAutoGrow } from "./useAutoGrow";

type Props = {
  /** "new" until the first build has worked: then a message builds the game again. */
  kind: "new" | "edit";
  allowed: ModelChoice[];
  estimates: Partial<Record<ModelChoice, Estimate>>;
  effort: Effort;
  onEffort: (e: Effort) => void;
  running: boolean;
  /** An Android build of this game is running: nothing can be sent until it is done (the API answers 409). */
  exporting?: boolean;
  /** What the player can spend: a note when it isn't enough for the picked model. */
  balance: CreditBalance | null;
  /** The plan and the subscription, for the credit panels and the past-due strip (null until GET /me answers). */
  me: Me | null;
  /** Where a purchase comes back to: this game's page. */
  backTo: string;
  onSend: (text: string, model: ModelChoice, effort: Effort, confirm: boolean) => Promise<void>;
  onStop: () => Promise<void>;
  /** A tapped next-step idea (`n` counts the taps, so each tap lands once): added to the box (withIdea), focused. */
  prefill?: { text: string; n: number } | null;
};

/**
 * A tapped next-step idea added to what the box holds (Luka, 10-24): alone in an empty box, else joined on the way
 * one would type it ("Add coins to collect, add a double jump"), and never twice.
 */
export function withIdea(current: string, idea: string): string {
  const now = current.trimEnd();
  if (!now) return idea;
  if (now.toLocaleLowerCase().includes(idea.toLocaleLowerCase())) return current;
  if (/[.!?。！？]$/.test(now)) return `${now} ${idea}`;
  if (/[\u3040-\u30ff\u3400-\u9fff]/.test(idea)) return `${now}、${idea}`; // Japanese and Chinese join with their own comma
  // "Add" becomes "add" after a comma; "UFO enemies" stays as it is.
  const joined = /^\p{Lu}\p{Ll}/u.test(idea) ? idea.charAt(0).toLocaleLowerCase() + idea.slice(1) : idea;
  return `${now}, ${joined}`;
}

/** The API's answers that mean "no credits for this": each gets its own panel with the way out. */
type PanelKind = "no_credits" | "daily_limit" | "free_paused" | "billing_hold";
const PANELS: PanelKind[] = ["no_credits", "daily_limit", "free_paused", "billing_hold"];

/** Say what to change: the box, Fast / Smart / Best and the effort with their cost, Send, or Stop while building. */
export function Composer({ kind, allowed, estimates, effort, onEffort, running, exporting = false, balance, me, backTo, onSend, onStop, prefill }: Props) {
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<ModelChoice | null>(null);
  // The tip under the box explains whichever control was touched last.
  const [explain, setExplain] = useState<"model" | "effort">("model");
  const fallback: ModelChoice = kind === "new" && allowed.includes("smart") ? "smart" : "fast";
  const model: ModelChoice = picked && allowed.includes(picked) ? picked : fallback;
  const est = estimates[model];
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState<string | null>(null);
  const [panel, setPanel] = useState<PanelKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  useAutoGrow(box, text, 160);

  // An idea from the chat goes into the box (after what is there: one message, one charge); the caret waits at its
  // end, ready to send or to change first.
  const [took, setTook] = useState(0);
  if (prefill && prefill.n !== took) {
    setTook(prefill.n);
    setText(withIdea(text, prefill.text));
    setError(null);
    setAsk(null);
  }
  useEffect(() => {
    const el = box.current;
    if (!el || !took) return;
    el.focus({ preventScroll: true });
    el.setSelectionRange(el.value.length, el.value.length);
  }, [took]);

  const send = async (confirm = false) => {
    const t = text.trim();
    if (!t) {
      box.current?.focus();
      return;
    }
    if (!confirm && est?.needsConfirm) {
      setAsk(`This could cost up to ${creditsWord(est.high)}. Send it?`);
      return;
    }
    setBusy(true);
    setError(null);
    setAsk(null);
    setPanel(null);
    try {
      await onSend(t, model, effort, confirm);
      setText("");
    } catch (e) {
      if (e instanceof ApiFailure && e.code === "needs_confirm") {
        setAsk(e.message); // the API's own numbers win over the estimate shown here
      } else if (e instanceof ApiFailure && PANELS.includes(e.code as PanelKind) && !/going now/.test(e.message)) {
        // Out of credits (not "your build going now may need them": that one is just a wait).
        setPanel(e.code as PanelKind);
      } else {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    setBusy(true);
    setError(null);
    try {
      await onStop();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!running && !busy && !exporting) void send();
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (!running && !busy && !exporting) void send();
    }
  };

  const pastDue = me?.billing?.status === "past_due" && me.plan !== "free";

  return (
    <form className="composer" onSubmit={submit} noValidate>
      {pastDue && (
        <div className="strip strip--composer" role="status" data-strip="past-due">
          <p>
            Your {me.billing?.periodEndsAt ? `${dayOf(me.billing.periodEndsAt)} ` : ""}payment for {planName[me.plan]} didn&apos;t go through. Update your card and
            Paddle will try again for up to 30 days. You keep your credits until a day after your period ends; no new ones until a payment goes
            through.
          </p>
          <Link href="/billing" className="button button--quiet button--small">
            Update card
          </Link>
        </div>
      )}
      {ask && (
        <div className="ask" role="alert">
          <p>{ask}</p>
          <div className="ask__actions">
            <button type="button" className="button button--small" onClick={() => void send(true)}>
              Send it
            </button>
            <button type="button" className="button button--quiet button--small" onClick={() => setAsk(null)}>
              Not now
            </button>
          </div>
        </div>
      )}
      {panel && <CreditPanel kind={panel} me={me} backTo={backTo} onClose={() => setPanel(null)} />}
      {error && (
        <p className="composer__error" role="alert">
          {error}
        </p>
      )}
      <div className="field composer__field">
        <label htmlFor="say" className="sr-only">
          {kind === "new" ? "What should the game be?" : "What should change?"}
        </label>
        <textarea
          id="say"
          ref={box}
          rows={1}
          value={text}
          maxLength={MAX_TEXT}
          enterKeyHint="send"
          placeholder={running || exporting ? "Say your next change" : kind === "new" ? "Say what game to make" : "Say what to change"}
          onChange={(e) => {
            setText(e.target.value);
            if (error) setError(null);
            if (ask) setAsk(null);
          }}
          onKeyDown={onKey}
          aria-describedby="say-tip"
        />
      </div>
      <div className="composer__row">
        <ModelSwitch
          kind={kind}
          value={model}
          onChange={(m) => {
            setPicked(m);
            setExplain("model");
            if (ask) setAsk(null);
          }}
          allowed={allowed}
          disabled={busy || exporting}
        />
        {running ? (
          <button type="button" className="button button--quiet button--small" onClick={() => void stop()} disabled={busy}>
            <Stop size={16} weight="fill" aria-hidden="true" />
            <span className="composer__label">Stop</span>
          </button>
        ) : (
          <button type="submit" className="button button--small" disabled={busy || exporting}>
            <ArrowUp size={16} weight="bold" aria-hidden="true" />
            <span className="composer__label">Send</span>
          </button>
        )}
      </div>
      <div className="composer__foot">
        <EffortSwitch
          name={`effort-${kind}`}
          value={effort}
          onChange={(e) => {
            onEffort(e);
            setExplain("effort");
            if (ask) setAsk(null);
          }}
          disabled={busy || exporting}
        />
        {!running && est && <span className="composer__cost figures">about {creditsWord(est.typical)}</span>}
      </div>
      <p id="say-tip" className="composer__tip" aria-live="polite">
        {exporting ? (
          android.exporting.composer
        ) : running ? (
          "Building now. You can type your next change and send it when this one is done."
        ) : est && balance && balance.available < est.low ? (
          <>
            Not enough credits for {model === "fast" ? "this" : "this on " + model.charAt(0).toUpperCase() + model.slice(1)}.{" "}
            <Link href="/billing" className="link">
              Get more
            </Link>
          </>
        ) : est && balance?.todayLeft != null && balance.todayLeft < est.low ? (
          "Today's free credits are used up. More tomorrow."
        ) : explain === "effort" ? (
          effortLine(effort)
        ) : (
          modelLine(kind, model, allowed)
        )}
      </p>
    </form>
  );
}

/**
 * Out of credits, in the ask panel's style (docs/payments-design.md §8): what happened, when more
 * come, and the one or two ways to go on now. Its buttons deep-link to the checkout and back here.
 */
function CreditPanel({ kind, me, backTo, onClose }: { kind: PanelKind; me: Me | null; backTo: string; onClose: () => void }) {
  const plan = me?.plan ?? "free";
  const billing = me?.billing;
  const medium = planFacts("medium");
  const getMedium = (
    <Link href={checkoutHref("plan:medium", backTo)} className="button button--small">
      Get Medium, {usd(medium.price)} a month
    </Link>
  );
  let text: string;
  let actions: ReactNode = null;
  if (kind === "billing_hold") {
    text = HOLD_LINE;
  } else if (kind === "free_paused") {
    text = `Free builds are paused; they start again ${untilUtcMidnight()}: today's free allowance is used up across TypePlay. Get a plan to keep going.`;
    actions = (
      <Link href="/billing?change=1" className="button button--small">
        Get a plan
      </Link>
    );
  } else if (kind === "daily_limit") {
    text = `Today's ${siteCredits.freePerDay} free credits are used. More ${untilUtcMidnight()}, or get Medium: no daily cap.`;
    actions = getMedium;
  } else if (plan === "free") {
    text = `You've used this month's free credits. ${siteCredits.freePerMonth} more arrive ${billing?.freeRefillAt ? `on ${dayOf(billing.freeRefillAt)}` : "next month"}. Or get Medium: ${medium.credits} credits a month, Smart and Best, no daily cap.`;
    actions = getMedium;
  } else {
    const above = planAbove(plan);
    const until = billing?.periodEndsAt && billing.status === "active" ? ` until ${dayOf(billing.periodEndsAt)}` : "";
    text = `You're out of credits${until}. Add ${pack.credits} for ${usd(pack.price)} now${above ? `, or move up to ${planName[above]} (${planFacts(above).credits.toLocaleString("en-US")} a month)` : ""}.`;
    actions = (
      <>
        <Link href={checkoutHref("pack", backTo)} className="button button--small">
          Add {pack.credits} credits, {usd(pack.price)}
        </Link>
        {above && (
          <Link href="/billing?change=1" className="button button--quiet button--small">
            Upgrade
          </Link>
        )}
      </>
    );
  }
  return (
    <div className="ask ask--credits" role="alert" data-panel={kind}>
      <p>{text}</p>
      <div className="ask__actions">
        {actions}
        <button type="button" className="button button--quiet button--small" onClick={onClose}>
          Not now
        </button>
      </div>
    </div>
  );
}
