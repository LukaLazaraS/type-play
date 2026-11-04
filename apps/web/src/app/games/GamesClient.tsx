"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Invitation, ProjectSummary, SharedGame } from "@typeplay/shared";
import { posterUrl } from "@/lib/urls";
import { GameTile } from "@/components/app/GameTile";
import { ManageList } from "@/components/app/ManageList";
import { planName } from "@/components/app/AccountSlot";
import { SignIn } from "@/components/app/SignIn";
import { AppIcon, AppIconSlot, AppTile } from "@/components/ui/AppIcon";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { ErrorLine } from "@/components/ui/ErrorLine";
import { PageWidget } from "@/components/ui/PageWidget";
import { TextButton } from "@/components/ui/TextButton";
import { TextLink } from "@/components/ui/TextLink";
import { inLine, people as together } from "@/content/app";
import { CLOSED_BETA_NOTE, closedBeta } from "@/content/beta";
import { api, ApiFailure } from "@/lib/api";
import { ago, credits, creditsWord, dayOf, playsWord } from "@/lib/format";
import { refreshMe, useSession } from "@/lib/session";

type Load = { status: "loading" } | { status: "ok"; games: ProjectSummary[] } | { status: "error"; message: string };

/** A game's line under its icon: building, waiting, not built, its plays, or when it last changed (`whose`: a shared game's). */
function statOf(g: ProjectSummary, whose?: string) {
  if (g.status === "running") return "building…";
  if (g.status === "queued") return inLine.tile;
  if (!g.buildId) return "not built yet";
  if (whose) return whose;
  return g.plays > 0 ? playsWord(g.plays) : ago(g.updatedAt);
}

/** One game as an app on the home screen. */
function GameApp({ g, stat }: { g: ProjectSummary; stat: string }) {
  const building = g.status === "running";
  const queued = g.status === "queued"; // waits for its turn: a first build shows the empty sky, standing still
  return (
    <li>
      <AppIcon
        href={`/games/${g.id}`}
        building={building && !g.buildId}
        waiting={queued && !g.buildId}
        picture={<GameTile id={g.id} name={g.name} building={(building || queued) && !g.buildId} poster={g.buildId && g.poster ? posterUrl(g.buildId) : null} />}
        name={g.name}
        nameClassName="mine__name"
        stat={stat}
      />
    </li>
  );
}

/** The signed-in home screen: the user's games as apps, newest first, and the credits left.
 * "Manage" turns it into a list to rename, download or delete them. */
export function GamesClient() {
  const router = useRouter();
  const session = useSession();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [manage, setManage] = useState(false);
  const [reload, setReload] = useState(0); // bumped by Try again after a failed load
  const signedIn = session.status === "in";
  // Pair developing (2026-11-04): the invitations waiting for this account, and the games others share with it. Either
  // failing to load leaves its section out; the own games come first.
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [shared, setShared] = useState<SharedGame[]>([]);
  const [answering, setAnswering] = useState<{ id: string; how: "accept" | "decline" } | null>(null);
  const [inviteError, setInviteError] = useState<{ id: string; message: string } | null>(null);

  const running = (load.status === "ok" && load.games.some((g) => g.status === "running" || g.status === "queued")) || shared.some((g) => g.status === "running" || g.status === "queued");

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    const get = () => {
      api
        .projects()
        .then((games) => live && setLoad({ status: "ok", games }))
        .catch((e: ApiFailure) => live && setLoad({ status: "error", message: e.message }));
      api.people
        .shared()
        .then((g) => live && setShared(g))
        .catch(() => {});
    };
    get();
    void refreshMe();
    // Builds start and finish while the list is open: look again every 15 s while one is running or waiting.
    const timer = running ? setInterval(get, 15_000) : null;
    return () => {
      live = false;
      if (timer) clearInterval(timer);
    };
  }, [signedIn, running, reload]);

  // The invitations once per visit (builds don't change them).
  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    api.people
      .invitations()
      .then((i) => live && setInvitations(i))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [signedIn, reload]);

  if (session.status === "loading") return <main className="mine" data-app aria-busy="true" />;

  if (session.status === "out") {
    return (
      <PageWidget title="Your games." lead="Sign in to see the games you made and keep changing them.">
        <SignIn next="/games" note={closedBeta ? CLOSED_BETA_NOTE : "Free: 20 credits a month."} />
      </PageWidget>
    );
  }

  const me = session.me;
  const games = load.status === "ok" ? load.games : [];
  const setGames = (next: (gs: ProjectSummary[]) => ProjectSummary[]) =>
    setLoad((l) => (l.status === "ok" ? { status: "ok", games: next(l.games) } : l));
  const editing = manage && games.length > 0;

  // An invitation answered here: Accept opens the game; No thanks takes it off the list, and the keyboard goes to the
  // next invitation (or the page's title when it was the last).
  const answer = async (inv: Invitation, how: "accept" | "decline") => {
    if (answering) return;
    setAnswering({ id: inv.id, how });
    setInviteError(null);
    try {
      if (how === "accept") {
        const { projectId } = await api.people.accept(inv.id);
        router.push(`/games/${projectId}`);
        return;
      }
      await api.people.decline(inv.id);
      const rest = invitations.filter((i) => i.id !== inv.id);
      setInvitations(rest);
      requestAnimationFrame(() => (rest.length ? document.querySelector<HTMLElement>(".invite .button") : document.getElementById("mine-title"))?.focus());
    } catch (e) {
      setInviteError({ id: inv.id, message: e instanceof Error ? e.message : String(e) });
    }
    setAnswering(null);
  };

  return (
    <main className="mine" data-app>
      <div className="mine__head">
        <div>
          <h1 id="mine-title" tabIndex={-1} className="title mine__title">
            Your games.
          </h1>
          <p className="mine__lead">
            {me ? (
              <>
                <b>{creditsWord(me.credits.available)}</b> left on {planName[me.plan]}
                {me.credits.todayLeft !== null && <>, {credits(me.credits.todayLeft)} more today</>}. <TextLink href="/pricing">Plans</TextLink>
              </>
            ) : (
              (session.problem ?? "Checking your credits…")
            )}
          </p>
        </div>
        <div className="mine__actions">
          <ButtonLink href="/explore" look="quiet" prefetch={false}>
            Explore games
          </ButtonLink>
          {games.length > 0 && (
            <Button look="quiet" aria-pressed={editing} onClick={() => setManage(!editing)}>
              {editing ? "Done" : "Manage"}
            </Button>
          )}
          {/* With no games yet, the empty widget's "Make a game" is the one thing to press. */}
          {!(load.status === "ok" && games.length === 0) && <ButtonLink href="/create">New game</ButtonLink>}
        </div>
      </div>

      {invitations.length > 0 && (
        <section aria-labelledby="mine-invites">
          <h2 id="mine-invites" className="mine__section">
            {together.invitations}
          </h2>
          <ul className="invites">
            {invitations.map((inv) => (
              <li key={inv.id} className="invite">
                <AppTile className="invite__tile">
                  <GameTile id={inv.game.id} name={inv.game.name} building={false} poster={inv.game.buildId && inv.game.poster ? posterUrl(inv.game.buildId) : null} />
                </AppTile>
                <div className="invite__text">
                  <p>
                    {together.invitedBy(inv.owner.name)} <b>{inv.game.name}</b>
                  </p>
                  <p>{together.invitedNote(inv.owner.name, dayOf(inv.expiresAt))}</p>
                  {inviteError?.id === inv.id && <ErrorLine>{inviteError.message}</ErrorLine>}
                </div>
                {/* The page's hot button stays New game (or Make a game): Accept is quiet here, No thanks words (the
                    invitation's own page has the hot Accept). While one answer is on its way, the others wait. */}
                <div className="invite__actions">
                  <Button
                    look="quiet"
                    size="small"
                    busy={answering?.id === inv.id && answering.how === "accept"}
                    busyLabel={together.accepting}
                    aria-disabled={(!!answering && !(answering.id === inv.id && answering.how === "accept")) || undefined}
                    aria-label={together.acceptLabel(inv.game.name)}
                    onClick={() => void answer(inv, "accept")}
                  >
                    {together.accept}
                  </Button>
                  <TextButton look="standalone" aria-disabled={!!answering || undefined} aria-label={together.declineLabel(inv.game.name)} onClick={() => void answer(inv, "decline")}>
                    {answering?.id === inv.id && answering.how === "decline" ? together.declining : together.decline}
                  </TextButton>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {load.status === "error" && (
        <div className="widget mine__empty">
          <p role="alert">{load.message}</p>
          <Button onClick={() => setReload((n) => n + 1)}>Try again</Button>
        </div>
      )}

      {load.status === "loading" && (
        <ul className="mine__grid" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <AppIconSlot key={i} className="mine__ghost" />
          ))}
        </ul>
      )}

      {load.status === "ok" && games.length === 0 && (
        <div className="widget mine__empty">
          <p>{shared.length ? "No games of your own yet." : "No games yet."} Type an idea and play it in a few minutes.</p>
          <ButtonLink href="/create">Make a game</ButtonLink>
        </div>
      )}

      {editing && (
        <ManageList
          games={games}
          onChange={(g) => setGames((gs) => gs.map((x) => (x.id === g.id ? g : x)))}
          onRemoved={(id) => setGames((gs) => gs.filter((x) => x.id !== id))}
        />
      )}

      {!editing && games.length > 0 && (
        <ul className="mine__grid">
          {games.map((g) => (
            <GameApp key={g.id} g={g} stat={statOf(g)} />
          ))}
        </ul>
      )}

      {!editing && shared.length > 0 && (
        <section aria-labelledby="mine-shared">
          <h2 id="mine-shared" className="mine__section">
            {together.shared}
          </h2>
          <ul className="mine__grid">
            {shared.map((g) => (
              <GameApp key={g.id} g={g} stat={statOf(g, together.sharedStat(g.owner.name))} />
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
