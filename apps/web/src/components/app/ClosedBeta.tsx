"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { GoogleLogo } from "@phosphor-icons/react";
import type { WaitlistState } from "@typeplay/shared";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Callout } from "@/components/ui/Callout";
import { ErrorLine } from "@/components/ui/ErrorLine";
import { FieldLabel, TextField } from "@/components/ui/Field";
import { GoogleButton } from "@/components/ui/GoogleButton";
import { PageWidget } from "@/components/ui/PageWidget";
import { Panel } from "@/components/ui/Panel";
import { TextButton } from "@/components/ui/TextButton";
import { app, DRAFT_KEY, GOOGLE_BLOCKED } from "@/content/app";
import { BETA_CODE_LENGTH } from "@/content/beta";
import { api, ApiFailure } from "@/lib/api";
import { useRestored } from "@/lib/restored";
import { refreshMe, sessionNow, signInWithGoogle, signInWithGoogleToken, signOut, useSession } from "@/lib/session";

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

/**
 * "Tell me when it opens" (2026-11-19, beta 1's findings: most people who signed in stopped here with no way to ask in):
 * under "No code yet?", a quiet button beside Play the games puts this address on the waitlist (`/beta/waitlist`); then a
 * sentence marked done says where the email goes, with a quiet way off the list, on its own line under Play the games.
 * Nothing shows until the API says which of the two it is. The sentence takes the focus when it comes, as "You're in the
 * beta." does, so a screen reader reads it; taken off, the keyboard goes back to the button and a polite status says so.
 * A refusal (too many changes, or let in meanwhile) is the API's sentence under it.
 */
function Waitlist({ email }: { email: string | null }) {
  const [state, setState] = useState<WaitlistState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [said, setSaid] = useState("");
  /** Where the keyboard goes once the change shows: the sentence after joining, the line after leaving. */
  const next = useRef<"on" | "off" | null>(null);
  const sentence = useRef<HTMLParagraphElement>(null);
  const ask = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let live = true;
    // Not known (offline, a hiccup): the line to join shows, and joining says what went wrong if it still does.
    api.waitlist.state().then(
      (s) => live && setState(s),
      () => live && setState({ on: false, email: email ?? "", askedAt: null }),
    );
    return () => {
      live = false;
    };
  }, [email]);

  useEffect(() => {
    if (next.current === "on") sentence.current?.focus();
    if (next.current === "off") ask.current?.focus();
    next.current = null;
  }, [state]);

  const change = async (on: boolean) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const now = on ? await api.waitlist.join() : await api.waitlist.leave();
      next.current = now.on ? "on" : "off";
      setSaid(now.on ? "" : "You're off the list.");
      setState(now);
    } catch (failure) {
      setError(failure instanceof ApiFailure ? failure.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!state) return null;
  // Inside .closed__play: the button wraps beside Play the games (one above the other on a phone); the sentence, the
  // error and the status take lines of their own.
  return (
    <>
      {state.on ? (
        <div className="closed__wait">
          <Callout ref={sentence} mark="check" role="status" tabIndex={-1}>
            You&apos;re on the list. We&apos;ll email <b>{state.email}</b> when TypePlay opens to everyone.
          </Callout>
          <TextButton look="standalone" aria-disabled={busy || undefined} onClick={() => void change(false)}>
            Take me off the list
          </TextButton>
        </div>
      ) : (
        <Button ref={ask} look="quiet" busy={busy} onClick={() => void change(true)}>
          Tell me when it opens
        </Button>
      )}
      {error && <ErrorLine>{error}</ErrorLine>}
      <p className="sr-only" role="status">
        {said}
      </p>
    </>
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
 * invitation (Luka, 10-24: six digits; a right one lets this account in and the page gives way to the app), then what
 * anyone can do without a code: play the games, or be told when it opens (the waitlist, 2026-11-19); then the address
 * this browser is signed in with, for a tester
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
  // Back from Google's account chooser (the page restored from the back-forward cache): the button works again.
  useRestored(() => setBusy(false));

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

  // Google's own button (app.googleButton): the account picked in Google's window replaces this sign-in, and the page
  // loads again with it. Where Google's script can't load, the redirect's button above instead (or, with
  // NEXT_PUBLIC_GOOGLE_BUTTON=only, a line saying what to do; Sign out stays).
  const [googleUnavailable, setGoogleUnavailable] = useState(false);
  const anotherByToken = async (credential: string, nonce: string) => {
    setBusy(true);
    setError(null);
    const problem = await signInWithGoogleToken(credential, nonce, location.pathname);
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
        <Waitlist email={email} />
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
          {app.googleButton && !googleUnavailable ? (
            <GoogleButton look="light" busy={busy} onUnavailable={() => setGoogleUnavailable(true)} onToken={(credential, nonce) => void anotherByToken(credential, nonce)} />
          ) : app.googleButton && !app.googleRedirectFallback ? null : (
            <Button look="quiet" size="small" onClick={() => void another()} busy={busy}>
              <GoogleLogo size={18} weight="bold" aria-hidden="true" />
              {busy ? "Opening Google…" : "Use another account"}
            </Button>
          )}
          <Button look="quiet" size="small" onClick={() => void signOut()} disabled={busy}>
            Sign out
          </Button>
        </div>
        {error && <ErrorLine>{error}</ErrorLine>}
        {app.googleButton && googleUnavailable && !app.googleRedirectFallback && <ErrorLine>{GOOGLE_BLOCKED}</ErrorLine>}
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
