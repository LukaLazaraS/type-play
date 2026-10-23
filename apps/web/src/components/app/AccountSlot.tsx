"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { Me, PlanId } from "@typeplay/shared";
import { credits } from "@/lib/format";
import { signOut, useSession } from "@/lib/session";
import { FeedbackDialog, useFeedbackGame, type FeedbackHandle } from "./Feedback";
// All of the app's styles ride on this component: it is in app builds only.
import "./app.css";

export const planName: Record<PlanId, string> = {
  free: "Free",
  medium: "Medium",
  high: "High",
  ultra: "Ultra",
  ultraplus: "Ultra+",
};

/** The status bar's account place in app builds: Sign in, or credits and the account menu. */
export function AccountSlot() {
  const session = useSession();
  if (session.status === "loading") return <span className="account__wait" aria-hidden="true" />;
  if (session.status === "out") {
    return (
      <Link href="/create" className="pill">
        Sign in
      </Link>
    );
  }
  if (session.uninvited) return <Uninvited email={session.uninvited.email} />;
  return <Account me={session.me} problem={session.problem} />;
}

/** Signed in, but not invited to the closed beta: no games or credits to show, only who this is and Sign out. */
function Uninvited({ email }: { email: string | null }) {
  const menu = useRef<HTMLDivElement>(null);
  return (
    <>
      <button type="button" className="account__me" popoverTarget="account-menu" aria-label={`Account: ${email ?? "signed in"}`}>
        <span aria-hidden="true">{firstLetter(email || "?")}</span>
      </button>
      <div ref={menu} id="account-menu" popover="auto" className="account__menu">
        <div className="account__who">
          <b>Signed in</b>
          {email && <span>{email}</span>}
        </div>
        <p className="account__problem">TypePlay is in a closed beta for now. It opens to everyone soon.</p>
        <button
          type="button"
          className="button button--quiet button--small"
          onClick={() => {
            menu.current?.hidePopover();
            void signOut();
          }}
        >
          Sign out
        </button>
      </div>
    </>
  );
}

function Account({ me, problem }: { me: Me | null; problem: string | null }) {
  const menu = useRef<HTMLDivElement>(null);
  const avatar = useRef<HTMLButtonElement>(null);
  const feedback = useRef<FeedbackHandle>(null);
  const game = useFeedbackGame();
  const close = () => menu.current?.hidePopover();
  const label = me?.name || me?.email || "Your account";

  return (
    <>
      <Link href="/games" className="account__games">
        My games
      </Link>
      <span className="account__credits" title={me ? "Credits you can spend" : undefined}>
        <b className="figures">{me ? credits(me.credits.available) : "…"}</b> {me && Math.round(me.credits.available * 10) === 10 ? "credit" : "credits"}
      </span>
      <button ref={avatar} type="button" className="account__me" popoverTarget="account-menu" aria-label={`Account: ${label}`}>
        <Avatar me={me} />
      </button>
      <div ref={menu} id="account-menu" popover="auto" className="account__menu">
        <div className="account__who">
          <b>{me?.name || "Signed in"}</b>
          {me && <span>{me.email}</span>}
        </div>
        {me ? (
          <dl className="account__facts">
            <div>
              <dt>Plan</dt>
              <dd>{planName[me.plan]}</dd>
            </div>
            <div>
              <dt>Credits</dt>
              <dd className="figures">{credits(me.credits.available)}</dd>
            </div>
            {me.credits.todayLeft !== null && (
              <div>
                <dt>Left today</dt>
                <dd className="figures">{credits(me.credits.todayLeft)}</dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="account__problem">{problem ?? "Loading your credits…"}</p>
        )}
        <div className="account__links">
          <Link href="/games" onClick={close}>
            Your games
          </Link>
          <Link href="/account" onClick={close}>
            Your account
          </Link>
          <Link href="/pricing" onClick={close}>
            Plans and credits
          </Link>
          <button
            type="button"
            onClick={() => {
              close();
              feedback.current?.open(game, avatar.current);
            }}
          >
            Send feedback
          </button>
        </div>
        <button
          type="button"
          className="button button--quiet button--small"
          onClick={() => {
            close();
            void signOut();
          }}
        >
          Sign out
        </button>
      </div>
      <FeedbackDialog ref={feedback} email={me?.email ?? null} />
    </>
  );
}

export function Avatar({ me }: { me: Me | null }) {
  const [broken, setBroken] = useState<string | null>(null);
  if (me?.avatarUrl && broken !== me.avatarUrl) {
    // Google's picture: no referrer, or Google sometimes refuses it. If it fails, the letter.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={me.avatarUrl}
        alt=""
        referrerPolicy="no-referrer"
        width={40}
        height={40}
        onError={() => setBroken(me.avatarUrl)}
      />
    );
  }
  return <span aria-hidden="true">{firstLetter(me?.name || me?.email || "?")}</span>;
}

/** The first character as people see it (an emoji or an accented letter is one). */
function firstLetter(text: string) {
  const first = new Intl.Segmenter("en", { granularity: "grapheme" }).segment(text.trim())[Symbol.iterator]().next().value;
  return (first?.segment ?? "?").toLocaleUpperCase();
}
