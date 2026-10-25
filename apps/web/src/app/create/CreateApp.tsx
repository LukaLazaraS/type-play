"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type KeyboardEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Effort, ModelChoice } from "@typeplay/shared";
import { EffortSwitch, effortLine, ModelRows } from "@/components/app/ModelPicker";
import { PlatformSwitch } from "@/components/app/PlatformSwitch";
import { SignIn } from "@/components/app/SignIn";
import { useEstimates } from "@/components/app/useEstimates";
import { AppIcon } from "@/components/ui/AppIcon";
import { Ask } from "@/components/ui/Ask";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { ErrorLine } from "@/components/ui/ErrorLine";
import { TextArea } from "@/components/ui/Field";
import { PageWidget } from "@/components/ui/PageWidget";
import { DRAFT_KEY, MAX_TEXT, starters, type PlatformChoice, type Starter } from "@/content/app";
import { CLOSED_BETA_NOTE, closedBeta } from "@/content/beta";
import { checkoutHref, planIdOf } from "@/content/billing";
import { api, ApiFailure } from "@/lib/api";
import { credits, creditsWord } from "@/lib/format";
import { refreshMe, useSession } from "@/lib/session";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}
function readSaved() {
  try {
    return localStorage.getItem(DRAFT_KEY) ?? "";
  } catch {
    return "";
  }
}
function save(text: string) {
  try {
    if (text.trim()) localStorage.setItem(DRAFT_KEY, text);
    else localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* private mode: nothing to keep */
  }
}

const SHORT = "Say a little more: what kind of game, and what you do in it.";

/** The app's front door: the sentence, genre starters, the AI and its cost, then Build. */
export function CreateApp() {
  const params = useSearchParams();
  const router = useRouter();
  const session = useSession();
  const fromUrl = params.get("prompt") ?? "";
  const saved = useSyncExternalStore(subscribe, readSaved, () => "");
  const [edited, setEdited] = useState<string | null>(null);
  const text = edited ?? (fromUrl || saved);

  const me = session.status === "in" ? session.me : null;
  const allowed: ModelChoice[] = me?.models ?? ["fast"];
  const [picked, setPicked] = useState<ModelChoice | null>(null);
  const model: ModelChoice = picked && allowed.includes(picked) ? picked : allowed.includes("smart") ? "smart" : "fast";
  const [effort, setEffort] = useState<Effort>("medium");
  // The screens it is made for: Best fit (the agent picks the shape) until the player taps another (Luka, 10-26).
  const [platform, setPlatform] = useState<PlatformChoice>("auto");
  const estimates = useEstimates("new", me?.plan ?? null, effort);
  const est = estimates[model];

  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    params.get("signin") === "failed" ? "Sign-in didn't finish. Please try again." : null,
  );
  const box = useRef<HTMLTextAreaElement>(null);

  // The home page hands the sentence over in the address; keep it in this browser (it survives the
  // trip to Google), then drop it from the address so a reload shows the latest edit.
  useEffect(() => {
    if (!fromUrl) return;
    save(fromUrl);
    router.replace("/create", { scroll: false });
  }, [fromUrl, router]);

  // The pricing page's "Get Medium" lands here with ?plan=: signed in, straight on to the checkout;
  // signed out, the sign-in below comes back to the checkout.
  const plan = planIdOf(params.get("plan"));
  const toCheckout = plan ? checkoutHref(`plan:${plan}`) : null;
  useEffect(() => {
    if (toCheckout && session.status === "in") router.replace(toCheckout);
  }, [toCheckout, session.status, router]);

  const change = (value: string) => {
    setEdited(value);
    save(value);
    if (error) setError(null);
    if (ask) setAsk(null);
  };

  const fill = (s: Starter) => {
    const at = s.examples.indexOf(text.trim());
    change(s.examples[(at + 1) % s.examples.length]);
    box.current?.focus({ preventScroll: true });
  };

  const build = async (confirm = false) => {
    const prompt = text.trim();
    if (prompt.length < 8) {
      setError(SHORT);
      box.current?.focus();
      return;
    }
    if (!confirm && est?.needsConfirm) {
      setAsk(`This could cost up to ${creditsWord(est.high)}. Build it?`);
      return;
    }
    setBusy(true);
    setError(null);
    setAsk(null);
    try {
      const project = await api.create({ prompt, model, effort, confirm: confirm || undefined, platform: platform === "auto" ? undefined : platform });
      save("");
      void refreshMe();
      router.push(`/games/${project.id}`);
    } catch (e) {
      setBusy(false);
      if (e instanceof ApiFailure && e.code === "needs_confirm") {
        setAsk(e.message); // the API's own numbers win over the estimate shown here
      } else {
        setError(e instanceof Error ? e.message : String(e));
      }
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (session.status === "in" && !busy && !short) void build();
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (session.status === "in" && !busy && !short) void build();
    }
  };

  const signedIn = session.status === "in";
  const long = text.length > MAX_TEXT - 400;
  // Not enough credits for the picked AI (this month's, or today's on Free): Build is off and
  // Get credits is the one thing to press, instead of a send the API would refuse.
  const short = !!est && !!me && (me.credits.available < est.low || (me.credits.todayLeft !== null && me.credits.todayLeft < est.low));

  if (toCheckout && signedIn) return <PageWidget busy />;
  return (
    <PageWidget title={signedIn ? "Make your game." : "Your game is next."}>
      <form className="make__form" onSubmit={submit} noValidate>
        <div className="make__idea">
          <TextArea
            id="idea"
            ref={box}
            label="Your idea"
            hint={
              long
                ? `${text.length.toLocaleString("en-US")} of ${MAX_TEXT.toLocaleString("en-US")} letters.`
                : "A sentence or two is enough: what kind of game, and what you do in it."
            }
            grow={220}
            rows={2}
            value={text}
            maxLength={MAX_TEXT}
            enterKeyHint="go"
            placeholder="Make an endless runner where a little robot jumps over cactuses and it gets faster over time."
            onChange={(e) => change(e.target.value)}
            onKeyDown={onKey}
          />
        </div>

        <div className="starters">
          <span className="field-label" id="starters-label">
            Or start from a kind of game
          </span>
          <ul className="starters__row" aria-labelledby="starters-label">
            {starters.map((s) => (
              <li key={s.genre}>
                <AppIcon
                  className="starter"
                  disabled={!s.ready}
                  onClick={() => fill(s)}
                  label={s.ready ? `${s.genre}: put an example idea in the box` : `${s.genre}: coming`}
                  picture={
                    s.icon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.icon} alt="" width={240} height={240} loading="lazy" />
                    ) : (
                      <TowerArt />
                    )
                  }
                  name={s.genre}
                  stat={s.ready ? "an idea" : "coming"}
                />
              </li>
            ))}
          </ul>
        </div>

        {session.status === "loading" && <div className="make__wait" aria-hidden="true" />}

        {session.status === "out" && (
          <div className="make__signin">
            {error && <ErrorLine>{error}</ErrorLine>}
            <SignIn next={toCheckout ?? "/create"} note={
                toCheckout
                  ? "Sign in first; the checkout opens right after."
                  : closedBeta
                    ? `${CLOSED_BETA_NOTE} Your idea stays here.`
                    : "Free: 20 credits a month. Your idea stays here while you sign in."
              }
            />
          </div>
        )}

        {signedIn && (
          <>
            <PlatformSwitch value={platform} onChange={setPlatform} disabled={busy} />
            <ModelRows kind="new" value={model} onChange={setPicked} allowed={allowed} estimates={estimates} disabled={busy} />
            <div className="make__effort">
              <EffortSwitch name="effort-create" value={effort} onChange={setEffort} disabled={busy} />
              <p className="field-hint">{effortLine(effort)}</p>
            </div>
            {ask && (
              <Ask
                text={ask}
                actions={
                  <>
                    <Button size="small" onClick={() => void build(true)}>
                      Build it
                    </Button>
                    <Button look="quiet" size="small" onClick={() => setAsk(null)}>
                      Not now
                    </Button>
                  </>
                }
              />
            )}
            <div className="make__go">
              <p className="make__balance">
                {me ? (
                  <>
                    <b>{creditsWord(me.credits.available)}</b> left
                    {est && me.credits.available < est.low ? (
                      <>: not enough for this one.</>
                    ) : est && me.credits.todayLeft !== null && me.credits.todayLeft < est.low ? (
                      <>, but today&apos;s free credits are used up. More tomorrow, or on a paid plan now.</>
                    ) : (
                      <>
                        {me.credits.todayLeft !== null && <>, {credits(me.credits.todayLeft)} more today on Free</>}.
                      </>
                    )}
                    {me.notice && <> {me.notice}</>}
                  </>
                ) : (
                  (session.problem ?? "Checking your credits…")
                )}
              </p>
              <div className="make__send">
                {est && <span className="figures">about {creditsWord(est.typical)}</span>}
                <Button type="submit" disabled={short} busy={busy} busyLabel="Starting…">
                  Build my game
                </Button>
                {short && <ButtonLink href="/billing?change=1">Get credits</ButtonLink>}
              </div>
            </div>
            {error && <ErrorLine>{error}</ErrorLine>}
          </>
        )}
      </form>
    </PageWidget>
  );
}

/** Tower defence has no test game yet: a flat tower on the dusk sky, drawn like the rest. */
function TowerArt() {
  return (
    <svg viewBox="0 0 112 112" aria-hidden="true">
      <rect width="112" height="112" fill="#2a1858" />
      <path d="M0 84 C30 76 70 92 112 80 V112 H0Z" fill="#a63e68" />
      <rect x="40" y="40" width="32" height="50" fill="#8fd3ff" />
      <rect x="36" y="32" width="8" height="10" fill="#8fd3ff" />
      <rect x="52" y="32" width="8" height="10" fill="#8fd3ff" />
      <rect x="68" y="32" width="8" height="10" fill="#8fd3ff" />
      <rect x="51" y="66" width="10" height="24" rx="5" fill="#170d33" />
      <rect x="55" y="14" width="2" height="18" fill="#170d33" />
      <path d="M57 14 L72 19 L57 24Z" fill="#ff5a36" />
    </svg>
  );
}
