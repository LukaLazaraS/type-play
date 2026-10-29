"use client";

import { useState, type KeyboardEvent } from "react";
import { GoogleLogo } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { ErrorLine } from "@/components/ui/ErrorLine";
import { TextField } from "@/components/ui/Field";
import { Panel } from "@/components/ui/Panel";
import { app } from "@/content/app";
import { useRestored } from "@/lib/restored";
import { devSignIn, signInWithGoogle } from "@/lib/session";

/** Sign in with Google (and, in dev with NEXT_PUBLIC_DEV_AUTH=1 only, a test sign-in). */
export function SignIn({ next, note }: { next: string; note?: string }) {
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
    <div className="signin">
      <Button onClick={google} busy={busy}>
        <GoogleLogo size={20} weight="bold" aria-hidden="true" />
        {busy ? "Opening Google…" : "Sign in with Google"}
      </Button>
      {error ? <ErrorLine>{error}</ErrorLine> : <p className="field-hint">{note}</p>}
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
