"use client";

import { useRef } from "react";
import Link from "next/link";
import type { Me, PlanId } from "@typeplay/shared";
import { SignInPill } from "@/components/SignInPill";
import { Avatar, AvatarButton } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Popover, type PopoverHandle } from "@/components/ui/Popover";
import { Pressable } from "@/components/ui/Pressable";
import { Toasts } from "@/components/ui/Toast";
import { credits } from "@/lib/format";
import { signOut, useSession } from "@/lib/session";
import { BuildPill } from "./BuildPill";
import { FeedbackDialog, useFeedbackGame, type FeedbackHandle } from "./Feedback";
import { Notices } from "./Notices";
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
  if (session.status === "out") return <SignInPill />;
  if (session.uninvited) return <Uninvited email={session.uninvited.email} />;
  return <Account me={session.me} problem={session.problem} />;
}

/** Signed in, but not invited to the closed beta: no games or credits to show, only who this is and Sign out. */
function Uninvited({ email }: { email: string | null }) {
  const menu = useRef<PopoverHandle>(null);
  return (
    <Popover
      id="account-menu"
      ref={menu}
      bar
      className="account__menu"
      trigger={(t) => (
        <AvatarButton {...t} aria-label={`Account: ${email ?? "signed in"}`}>
          <Avatar name={email || "?"} />
        </AvatarButton>
      )}
    >
      <div className="account__who">
        <b>Signed in</b>
        {email && <span>{email}</span>}
      </div>
      <p className="account__problem">TypePlay is in a closed beta for now. It opens to everyone soon.</p>
      <Button
        look="quiet"
        size="small"
        onClick={() => {
          menu.current?.close();
          void signOut();
        }}
      >
        Sign out
      </Button>
    </Popover>
  );
}

function Account({ me, problem }: { me: Me | null; problem: string | null }) {
  const menu = useRef<PopoverHandle>(null);
  const feedback = useRef<FeedbackHandle>(null);
  const game = useFeedbackGame();
  const close = () => menu.current?.close();
  const label = me?.name || me?.email || "Your account";

  return (
    <>
      <Link href="/games" className="account__games">
        My games
      </Link>
      <span className="account__credits" title={me ? "Credits you can spend" : undefined}>
        <b className="figures">{me ? credits(me.credits.available) : "…"}</b>{" "}
        {/* On a narrow bar the word steps aside for screen readers only (app.css); the number stays. */}
        <span className="account__unit">{me && Math.round(me.credits.available * 10) === 10 ? "credit" : "credits"}</span>
      </span>
      <Popover
        id="account-menu"
        ref={menu}
        bar
        className="account__menu"
        trigger={(t) => (
          <AvatarButton {...t} aria-label={`Account: ${label}`}>
            <Avatar src={me?.avatarUrl} name={me?.name || me?.email || "?"} />
          </AvatarButton>
        )}
      >
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
          <Link href="/games" className="account__link" onClick={close}>
            Your games
          </Link>
          <Link href="/account" className="account__link" onClick={close}>
            Your account
          </Link>
          <Link href="/pricing" className="account__link" onClick={close}>
            Plans and credits
          </Link>
          <Pressable
            className="account__link"
            onClick={() => {
              close();
              feedback.current?.open(game, menu.current?.trigger);
            }}
          >
            Send feedback
          </Pressable>
        </div>
        <Button
          look="quiet"
          size="small"
          onClick={() => {
            close();
            void signOut();
          }}
        >
          Sign out
        </Button>
      </Popover>
      <FeedbackDialog ref={feedback} email={me?.email ?? null} />
      {/* The page's toasts: build ends from any game (once the account is known), and the build pill nearest the edge. */}
      <Toasts>
        {me && <Notices userId={me.id} />}
        <BuildPill />
      </Toasts>
    </>
  );
}
