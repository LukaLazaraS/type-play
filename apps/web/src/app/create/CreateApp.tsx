"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type KeyboardEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Effort, GameTag, Genre, ModelChoice } from "@typeplay/shared";
import { EffortSwitch, effortLine, ModelRows } from "@/components/app/ModelPicker";
import { PlatformSwitch } from "@/components/app/PlatformSwitch";
import { SignIn } from "@/components/app/SignIn";
import { useEstimates } from "@/components/app/useEstimates";
import { Ask } from "@/components/ui/Ask";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Chip } from "@/components/ui/Chip";
import { ErrorLine } from "@/components/ui/ErrorLine";
import { TextArea } from "@/components/ui/Field";
import { HintLines } from "@/components/ui/HintLines";
import { IconChoice } from "@/components/ui/IconChoice";
import { PageWidget } from "@/components/ui/PageWidget";
import { DRAFT_KEY, gameTags, genreAbout, genreAgain, genreNone, genres, MAX_TEXT, PICKS_KEY, tagsNone, type PlatformChoice } from "@/content/app";
import { CLOSED_BETA_NOTE, closedBeta } from "@/content/beta";
import { checkoutHref, planIdOf } from "@/content/billing";
import { genreName } from "@/content/gallery";
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

/** The genre and tags picked for the next game: kept in this browser with the idea, so they survive the trip to Google. */
type Picks = { genre: Genre | null; tags: GameTag[] };
const NO_PICKS: Picks = { genre: null, tags: [] };
function picksFrom(raw: string | null): Picks {
  try {
    const p = JSON.parse(raw ?? "null") as { genre?: unknown; tags?: unknown } | null;
    const kept = Array.isArray(p?.tags) ? (p.tags as unknown[]) : [];
    // Ours only, in the list's order; of a pair that can't go together (an older page's, or a hand-made value) the second,
    // with the tag it needs (First-person's and Third-person's 3D).
    const ids = gameTags.map((t) => t.id);
    const beaten = (t: GameTag) => ids.some((u) => kept.includes(u) && clash(t, u) && ids.indexOf(t) < ids.indexOf(u));
    const left = ids.filter((t) => kept.includes(t) && !beaten(t));
    const tags = ids.filter((t) => left.includes(t) || left.some((u) => NEEDS[u] === t));
    return { genre: genres.find((g) => g.id === p?.genre)?.id ?? null, tags };
  } catch {
    return NO_PICKS;
  }
}
let keptPicks: { raw: string | null; picks: Picks } = { raw: null, picks: NO_PICKS };
function readPicks(): Picks {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(PICKS_KEY);
  } catch {
    /* private mode */
  }
  if (raw !== keptPicks.raw) keptPicks = { raw, picks: picksFrom(raw) };
  return keptPicks.picks;
}
function savePicks(picks: Picks) {
  try {
    if (picks.genre || picks.tags.length) localStorage.setItem(PICKS_KEY, JSON.stringify(picks));
    else localStorage.removeItem(PICKS_KEY);
  } catch {
    /* private mode: nothing to keep */
  }
}
/** One at most of 2D, 2.5D and 3D, of First-person and Third-person, of Cozy and Hard (their rules contradict), so picking
 * one unpicks the other; First-person and Third-person are always 3D, so they never go with 2D or 2.5D either. */
const CLASHES: [GameTag, GameTag][] = [
  ["2d", "25d"], ["2d", "3d"], ["25d", "3d"], ["cozy", "hard"], ["firstperson", "thirdperson"],
  ["2d", "firstperson"], ["25d", "firstperson"], ["2d", "thirdperson"], ["25d", "thirdperson"],
];
const clash = (a: GameTag, b: GameTag) => CLASHES.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
/** A tag that needs another: picking it picks that one too, and unpicking that one unpicks it (First-person and Third-person need 3D). */
const NEEDS: Partial<Record<GameTag, GameTag>> = { firstperson: "3d", thirdperson: "3d" };

const SHORT = "Say a little more: what kind of game, and what you do in it.";
const SHORT_PICKED = "Say a little more: what you do in your game.";

/** The app's front door: the sentence, its genre and tags, the screens, the AI and its cost, then Build. */
export function CreateApp() {
  const params = useSearchParams();
  const router = useRouter();
  const session = useSession();
  const fromUrl = params.get("prompt") ?? "";
  const saved = useSyncExternalStore(subscribe, readSaved, () => "");
  const [edited, setEdited] = useState<string | null>(null);
  // An idea handed over in the address wins over what was typed here before.
  const [seenUrl, setSeenUrl] = useState(fromUrl);
  if (fromUrl !== seenUrl) {
    setSeenUrl(fromUrl);
    if (fromUrl) setEdited(null);
  }
  const text = edited ?? (fromUrl || saved);
  // Genre: one at most (none: the AI goes by the idea). Tags: any, 2D or 3D not both (Luka, 10-27).
  const savedPicks = useSyncExternalStore(subscribe, readPicks, () => NO_PICKS);
  const [chosen, setChosen] = useState<Picks | null>(null);
  const picks = chosen ?? savedPicks;
  // The tag touched last: its line shows under the tags while it stays picked.
  const [lastTag, setLastTag] = useState<GameTag | null>(null);
  const choose = (next: Picks) => {
    setChosen(next);
    savePicks(next);
  };
  const toggleTag = (tag: GameTag) => {
    const on = picks.tags.includes(tag);
    // Off: it goes, with a tag that needs it. On: it joins in the list's order with the tag it needs, and takes the place
    // of what can't go with them (2D, 2.5D or 3D, First-person or Third-person, Cozy or Hard; First-person and Third-person
    // bring 3D, so 2D and 2.5D go).
    const adding = NEEDS[tag] ? [tag, NEEDS[tag]] : [tag];
    const next = on
      ? picks.tags.filter((t) => t !== tag && NEEDS[t] !== tag)
      : gameTags.map((t) => t.id).filter((t) => adding.includes(t) || (picks.tags.includes(t) && !adding.some((a) => clash(a, t))));
    choose({ ...picks, tags: next });
    setLastTag(on ? null : tag);
  };

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
    // A new idea starts with nothing picked: picks left from an idea that was never built don't belong to it (the page
    // reads the kept picks again as the address changes).
    savePicks(NO_PICKS);
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

  const build = async (confirm = false) => {
    const prompt = text.trim();
    if (prompt.length < 8) {
      setError(picks.genre ? SHORT_PICKED : SHORT);
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
      const project = await api.create({
        prompt,
        model,
        effort,
        confirm: confirm || undefined,
        platform: platform === "auto" ? undefined : platform,
        genre: picks.genre ?? undefined,
        tags: picks.tags.length ? picks.tags : undefined,
      });
      save("");
      savePicks(NO_PICKS);
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
    if (session.status === "in" && !busy && !short && ask === null) void build();
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (session.status === "in" && !busy && !short && ask === null) void build();
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

        <IconChoice
          name="genre"
          legend="Genre"
          about={genreAbout}
          value={picks.genre}
          onChange={(genre) => choose({ ...picks, genre })}
          disabled={busy}
          options={genres.map((g) => ({
            value: g.id,
            name: genreName[g.id],
            // eslint-disable-next-line @next/next/no-img-element
            picture: <img src={g.icon} alt="" width={240} height={240} loading="lazy" />,
            about: g.line,
          }))}
        >
          <HintLines
            lines={[{ id: "genre-none", text: genreNone }, ...genres.map((g) => ({ id: `genre-${g.id}`, text: `${g.line} ${genreAgain}` }))]}
            current={picks.genre ? `genre-${picks.genre}` : "genre-none"}
          />
        </IconChoice>

        <div className="tags" role="group" aria-labelledby="tags-label" aria-describedby="tags-none">
          <span className="field-label" id="tags-label">
            Tags
          </span>
          <div className="tags__row">
            {gameTags.map((t) => (
              <Chip key={t.id} pressed={picks.tags.includes(t.id)} onClick={() => toggleTag(t.id)} disabled={busy} aria-describedby={`tag-${t.id}`}>
                {t.name}
              </Chip>
            ))}
          </div>
          <HintLines
            lines={[{ id: "tags-none", text: tagsNone }, ...gameTags.map((t) => ({ id: `tag-${t.id}`, text: t.line }))]}
            current={lastTag && picks.tags.includes(lastTag) ? `tag-${lastTag}` : "tags-none"}
          />
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
                <Button type="submit" disabled={short} aria-disabled={ask !== null || undefined} busy={busy} busyLabel="Starting…">
                  Build my game
                </Button>
                {short && <ButtonLink href="/billing?change=1">Get credits</ButtonLink>}
              </div>
            </div>
            {ask && (
              <Ask
                reveal
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
            {error && <ErrorLine>{error}</ErrorLine>}
          </>
        )}
      </form>
    </PageWidget>
  );
}
