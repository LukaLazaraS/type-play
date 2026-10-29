"use client";

import { useState, useSyncExternalStore } from "react";
import { Ask } from "@/components/ui/Ask";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { InkPill } from "@/components/ui/InkPill";
import { TextLink } from "@/components/ui/TextLink";
import { notify } from "@/content/app";
import { markAsked, pushSupport, turnOn, wasAsked } from "@/lib/push";
import { useSession } from "@/lib/session";

type Answer = "asking" | "on" | "blocked" | "dismissed" | "failed" | "no";
const noop = () => () => {};

/** What the browser said, in one sentence (the last three end with the way to the switch). */
function Said({ answer }: { answer: Exclude<Answer, "asking" | "no"> }) {
  if (answer === "on") return <>{notify.on}</>;
  return (
    <>
      {notify[answer]} <TextLink href="/account">Your account</TextLink>.
    </>
  );
}

/**
 * "Tell me when it's ready?" (notifications, 2026-10-29): the site's own question at the first build an account starts on
 * this device, never on page load, and only where the browser can push (an iPhone only from the Home Screen). A yes brings
 * the browser's prompt; either answer is the last time it asks here (the switch on Your account changes it later). On the
 * ink stage under a first build's note (`ink`), or as the ask panel in the chat's composer while a change builds.
 */
export function NotifyAsk({ tone }: { tone: "ink" | "paper" }) {
  const session = useSession();
  const userId = session.status === "in" ? (session.me?.id ?? null) : null;
  const [answer, setAnswer] = useState<Answer | null>(null);
  const askable = useSyncExternalStore(
    noop,
    () => !!userId && pushSupport() === "yes" && Notification.permission === "default" && !wasAsked(userId),
    () => false,
  );
  if (answer === "no" || (answer === null && !askable) || !userId) return null;

  const yes = () => {
    markAsked(userId);
    setAnswer("asking");
    // From the tap itself: some browsers show their prompt only then.
    void turnOn(userId).then(setAnswer);
  };
  const no = () => {
    markAsked(userId);
    setAnswer("no");
  };
  const busy = answer === "asking";

  if (tone === "paper") {
    if (answer && answer !== "asking") {
      return (
        <Callout className="notifyask__done" role="status">
          <Said answer={answer} />
        </Callout>
      );
    }
    return (
      <Ask
        role="status"
        text={notify.ask}
        actions={
          <>
            <Button size="small" busy={busy} busyLabel={notify.yes} onClick={yes}>
              {notify.yes}
            </Button>
            <Button look="quiet" size="small" disabled={busy} onClick={no}>
              {notify.notNow}
            </Button>
          </>
        }
      />
    );
  }
  return (
    <div className="notifyask" role="status">
      {answer && answer !== "asking" ? (
        <p className="notifyask__said">
          <Said answer={answer} />
        </p>
      ) : (
        <>
          <p className="notifyask__q">{notify.ask}</p>
          <div className="notifyask__buttons">
            <Button size="small" busy={busy} busyLabel={notify.yes} onClick={yes}>
              {notify.yes}
            </Button>
            <InkPill size="small" disabled={busy} onClick={no}>
              {notify.no}
            </InkPill>
          </div>
        </>
      )}
    </div>
  );
}
