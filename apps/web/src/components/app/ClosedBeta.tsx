"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { GoogleLogo } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Callout } from "@/components/ui/Callout";
import { ErrorLine } from "@/components/ui/ErrorLine";
import { FieldLabel, TextField } from "@/components/ui/Field";
import { PageWidget } from "@/components/ui/PageWidget";
import { Panel } from "@/components/ui/Panel";
import { DRAFT_KEY } from "@/content/app";
import { BETA_CODE_LENGTH } from "@/content/beta";
import { api, ApiFailure } from "@/lib/api";
import { refreshMe, sessionNow, signInWithGoogle, signOut, useSession } from "@/lib/session";

/**
 * The app's pages (create/, games/, account/, billing/: their layout.app.tsx): for someone signed in whose email isn't on
 * the closed beta's invite list (the API's 403 invite_only), the closed-beta screen instead of the page. Everyone else,
 * signed out included, gets the page as before. The public pages don't use it. After a right beta code, one line above
 * the page says so (and what the code added) until the next page.
 */
export function InviteGate({ children }: { children: ReactNode }) {
  const session = useSession();
  const [joined, setJoined] = useState<number | null>(null);
  if (session.status === "in" && session.uninvited) return <ClosedBeta email={session.uninvited.email} onJoined={setJoined} />;
  return (
    <>
      {joined !== null && <Joined credits={joined} />}
      {children}
    </>
  );
}

/** "You're in the beta." with the code's credits: said once, and focused, so a screen reader hears where the page went. */
function Joined({ credits }: { credits: number }) {
  const line = useRef<HTMLParagraphElement>(null);
  useEffect(() => line.current?.focus(), []);
  return (
    <Callout ref={line} tone="sky" className="joined" role="status" tabIndex={-1}>
      You&apos;re in the beta.{credits > 0 ? ` We added ${credits} credits.` : ""}
    </Callout>
  );
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
 * "TypePlay is in a closed beta.": who it is for and that it opens to everyone soon, then the beta code from the
 * invitation (Luka, 10-24: six digits; a right one lets this account in and the page gives way to the app), then the one
 * thing anyone can do without a code, play the games, then the address this browser is signed in with, for a tester
 * invited by address on another Google account (Google's account chooser, or Sign out). The idea saved in this browser,
 * if any, stays there for later.
 */
function ClosedBeta({ email, onJoined }: { email: string | null; onJoined: (credits: number) => void }) {
  const idea = useSyncExternalStore(subscribe, readDraft, () => "").trim();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  // `sticky`: a limit's sentence (when to try again) stays while the next code is typed; the others go at the first key.
  const [codeError, setCodeError] = useState<{ text: string; sticky: boolean } | null>(null);
  const box = useRef<HTMLInputElement>(null);

  /** The box keeps its focus and the code, selected, so a typo is fixed by typing again (the keyboard stays up). */
  const fail = (text: string, sticky = false) => {
    setCodeError({ text, sticky });
    box.current?.focus();
    box.current?.select();
  };

  const join = async (e: FormEvent) => {
    e.preventDefault();
    if (checking) return;
    if (code.length !== BETA_CODE_LENGTH) {
      fail(`Type the ${BETA_CODE_LENGTH} digits from your invitation.`);
      return;
    }
    setChecking(true);
    setCodeError(null);
    try {
      const { credits } = await api.betaCode(code);
      onJoined(credits);
      // In: a fresh GET /me answers, the session drops `uninvited`, and the page this screen stood for takes its place.
      await refreshMe({ fresh: true });
      const now = sessionNow();
      if (now.status === "in" && now.uninvited) fail("Your code worked. Reload the page to start.");
    } catch (failure) {
      fail(failure instanceof ApiFailure ? failure.message : "Something went wrong. Please try again.", failure instanceof ApiFailure && failure.code === "too_many");
    } finally {
      setChecking(false);
    }
  };

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
    <PageWidget
      className="closed"
      title="TypePlay is in a closed beta."
      lead="Right now only invited testers can make games, and they help us fix problems. It opens to everyone soon."
    >
      <form className="closed__code" onSubmit={(e) => void join(e)} noValidate>
        <FieldLabel htmlFor="beta-code">Have a beta code?</FieldLabel>
        <div className="closed__code-row">
          <TextField
            ref={box}
            id="beta-code"
            boxClassName="closed__field"
            error={codeError?.text}
            name="code"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.replace(/\D+/g, "").slice(0, BETA_CODE_LENGTH));
              if (!codeError?.sticky) setCodeError(null);
            }}
            // A whole code pasted over another replaces it (the filter above would keep the old one's six digits).
            onPaste={(e) => {
              const digits = e.clipboardData.getData("text").replace(/\D+/g, "");
              if (digits.length < BETA_CODE_LENGTH) return;
              e.preventDefault();
              setCode(digits.slice(0, BETA_CODE_LENGTH));
              if (!codeError?.sticky) setCodeError(null);
            }}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            placeholder={`${BETA_CODE_LENGTH} digits`}
            readOnly={checking}
          />
          <Button type="submit" busy={checking} busyLabel="Checking…">
            Join the beta
          </Button>
        </div>
      </form>
      <div className="closed__play">
        <span className="field-label">No code yet?</span>
        <ButtonLink href="/#games" look="quiet">
          Play the games
        </ButtonLink>
      </div>
      <Panel className="closed__who">
        {email ? (
          <p>
            You&apos;re signed in as <b>{email}</b>
          </p>
        ) : (
          <p>You&apos;re signed in with Google.</p>
        )}
        <p>Invited with another address? Use that Google account.</p>
        <div className="closed__actions">
          <Button look="quiet" size="small" onClick={() => void another()} busy={busy}>
            <GoogleLogo size={18} weight="bold" aria-hidden="true" />
            {busy ? "Opening Google…" : "Use another account"}
          </Button>
          <Button look="quiet" size="small" onClick={() => void signOut()} disabled={busy}>
            Sign out
          </Button>
        </div>
        {error && <ErrorLine>{error}</ErrorLine>}
      </Panel>
      {idea && (
        <div className="closed__idea">
          <p>Your idea stays saved in this browser:</p>
          <q title={idea.length > 200 ? idea : undefined}>{idea}</q>
        </div>
      )}
    </PageWidget>
  );
}
