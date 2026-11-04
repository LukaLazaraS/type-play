"use client";

import { useState, type KeyboardEvent } from "react";
import { GoogleLogo } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { ErrorLine } from "@/components/ui/ErrorLine";
import { TextField } from "@/components/ui/Field";
import { GoogleButton } from "@/components/ui/GoogleButton";
import { Panel } from "@/components/ui/Panel";
import { app, GOOGLE_BLOCKED } from "@/content/app";
import { useRestored } from "@/lib/restored";
import { devSignIn, signInWithGoogle, signInWithGoogleToken } from "@/lib/session";

/**
 * Sign in with Google (and, in dev with NEXT_PUBLIC_DEV_AUTH=1 only, a test sign-in). With app.googleButton: Google's
 * own button on this site (Google's screens name typeplay.app); where Google's script can't load, the redirect through
 * Supabase, or (NEXT_PUBLIC_GOOGLE_BUTTON=only) a line saying what to do. Without it: the redirect, as before.
 */
export function SignIn({ next, note }: { next: string; note?: string }) {
  return (
    <div className="signin">
      {app.googleButton ? <GoogleSignIn next={next} note={note} /> : <RedirectSignIn next={next} note={note} />}
      {app.devAuth && <DevSignIn />}
    </div>
  );
}

/** Google's own button: its token goes to Supabase here, then `next` opens signed in. */
function GoogleSignIn({ next, note }: { next: string; note?: string }) {
  const [unavailable, setUnavailable] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (unavailable) return app.googleRedirectFallback ? <RedirectSignIn next={next} note={note} /> : <ErrorLine>{GOOGLE_BLOCKED}</ErrorLine>;
  return (
    <>
      <GoogleButton
        busy={working}
        onUnavailable={() => setUnavailable(true)}
        onToken={async (credential, nonce) => {
          setWorking(true);
          setError(null);
          const problem = await signInWithGoogleToken(credential, nonce, next);
          // On success the next page is on its way; stay on "Signing in…" until it comes.
          if (problem) {
            setError(problem);
            setWorking(false);
          }
        }}
      />
      {error ? (
        <ErrorLine>{error}</ErrorLine>
      ) : (
        <p className="field-hint" role="status">
          {working ? "Signing in…" : note}
        </p>
      )}
    </>
  );
}

/** The redirect through Supabase to Google's sign-in page, and back to `next` (app/auth/callback). */
function RedirectSignIn({ next, note }: { next: string; note?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Back from Google (the page restored from the back-forward cache): the button works again.
  useRestored(() => setBusy(false));

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
    <>
      <Button onClick={google} busy={busy}>
        <GoogleLogo size={20} weight="bold" aria-hidden="true" />
        {busy ? "Opening Google…" : "Sign in with Google"}
      </Button>
      {error ? <ErrorLine>{error}</ErrorLine> : <p className="field-hint">{note}</p>}
    </>
  );
}

// Not a <form>: on /create it sits inside the idea's form, and forms can't nest.
function DevSignIn() {
  const [email, setEmail] = useState("luka@dev.test");
  const go = () => {
    if (email.includes("@")) devSignIn(email);
  };
  return (
    <Panel className="devsignin" role="group" aria-labelledby="dev-email-label">
      <p id="dev-email-label">Dev sign-in (this PC only)</p>
      <div className="devsignin__row">
        <TextField
          id="dev-email"
          tone="paper"
          boxClassName="devsignin__box"
          aria-labelledby="dev-email-label"
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
        <Button look="quiet" size="small" onClick={go}>
          Dev sign-in
        </Button>
      </div>
    </Panel>
  );
}
