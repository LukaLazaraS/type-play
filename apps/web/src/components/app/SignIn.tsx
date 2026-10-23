"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import { GoogleLogo } from "@phosphor-icons/react";
import { app } from "@/content/app";
import { devSignIn, signInWithGoogle } from "@/lib/session";

/** Sign in with Google (and, in dev with NEXT_PUBLIC_DEV_AUTH=1 only, a test sign-in). */
export function SignIn({ next, note }: { next: string; note?: string }) {
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

  const google = async () => {
    setBusy(true);
    setError(null);
    const problem = await signInWithGoogle(next);
    // On success the browser is on its way to Google; stay busy until it leaves.
    if (problem) {
      setError(problem);
      setBusy(false);
    }
  };

  return (
    <div className="signin">
      <button type="button" className="button" onClick={google} disabled={busy}>
        <GoogleLogo size={20} weight="bold" aria-hidden="true" />
        {busy ? "Opening Google…" : "Sign in with Google"}
      </button>
      <p className="field-hint" role={error ? "alert" : undefined}>
        {error ?? note}
      </p>
      {app.devAuth && <DevSignIn />}
    </div>
  );
}

// Not a <form>: on /create it sits inside the idea's form, and forms can't nest.
function DevSignIn() {
  const [email, setEmail] = useState("luka@dev.test");
  const go = () => {
    if (email.includes("@")) devSignIn(email);
  };
  return (
    <div className="devsignin" role="group" aria-labelledby="dev-email-label">
      <label id="dev-email-label" htmlFor="dev-email">
        Dev sign-in (this PC only)
      </label>
      <div>
        <input
          id="dev-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter") {
              e.preventDefault();
              go();
            }
          }}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          enterKeyHint="go"
        />
        <button type="button" className="button button--quiet button--small" onClick={go}>
          Dev sign-in
        </button>
      </div>
    </div>
  );
}
