"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { GoogleLogo } from "@phosphor-icons/react";
import { DRAFT_KEY } from "@/content/app";
import { signInWithGoogle, signOut, useSession } from "@/lib/session";

/**
 * The app's pages (create/, games/, account/, billing/: their layout.app.tsx): for someone signed in whose email isn't on
 * the closed beta's invite list (the API's 403 invite_only), the closed-beta screen instead of the page. Everyone else,
 * signed out included, gets the page as before. The public pages don't use it.
 */
export function InviteGate({ children }: { children: ReactNode }) {
  const session = useSession();
  if (session.status === "in" && session.uninvited) return <ClosedBeta email={session.uninvited.email} />;
  return children;
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}
function readDraft() {
  try {
    return localStorage.getItem(DRAFT_KEY) ?? "";
  } catch {
    return "";
  }
}

/**
 * "TypePlay is in a closed beta.": who it is for and that it opens to everyone soon, then the one thing anyone can do now,
 * play the games (most people here were never invited), then the address this browser is signed in with, for the
 * invited tester on another Google account (Google's account chooser, or Sign out). No form: nothing new is asked or
 * kept. The idea saved in this browser, if any, stays there for later.
 */
function ClosedBeta({ email }: { email: string | null }) {
  const idea = useSyncExternalStore(subscribe, readDraft, () => "").trim();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Back from Google (the page restored from the back-forward cache): the button works again.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) setBusy(false);
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  const another = async () => {
    setBusy(true);
    setError(null);
    // Google's account chooser; the account picked there replaces this sign-in when it comes back.
    const problem = await signInWithGoogle(location.pathname, { chooseAccount: true });
    if (problem) {
      setError(problem);
      setBusy(false);
    }
  };

  return (
    <main className="widget make closed" data-app>
      <h1 className="title make__title">TypePlay is in a closed beta.</h1>
      <p className="make__lead">
        Right now only the testers we invited can make games. They help us fix problems before everyone joins. It opens to
        everyone soon.
      </p>
      <div className="closed__play">
        <Link href="/#games" className="button">
          Play the games
        </Link>
      </div>
      <div className="closed__who">
        {email ? (
          <p>
            You&apos;re signed in as <b>{email}</b>
          </p>
        ) : (
          <p>You&apos;re signed in with Google.</p>
        )}
        <p>Invited with another address? Use that Google account.</p>
        <div className="closed__actions">
          <button type="button" className="button button--quiet button--small" onClick={() => void another()} disabled={busy}>
            <GoogleLogo size={18} weight="bold" aria-hidden="true" />
            {busy ? "Opening Google…" : "Use another account"}
          </button>
          <button type="button" className="button button--quiet button--small" onClick={() => void signOut()} disabled={busy}>
            Sign out
          </button>
        </div>
        {error && (
          <p className="composer__error" role="alert">
            {error}
          </p>
        )}
      </div>
      {idea && (
        <div className="closed__idea">
          <p>Your idea stays saved in this browser:</p>
          <q title={idea.length > 200 ? idea : undefined}>{idea}</q>
        </div>
      )}
    </main>
  );
}
