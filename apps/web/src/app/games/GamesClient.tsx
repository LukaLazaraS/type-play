"use client";

import { useEffect, useState } from "react";
import type { ProjectSummary } from "@typeplay/shared";
import { posterUrl } from "@/lib/urls";
import { GameTile } from "@/components/app/GameTile";
import { ManageList } from "@/components/app/ManageList";
import { planName } from "@/components/app/AccountSlot";
import { SignIn } from "@/components/app/SignIn";
import { AppIcon, AppIconSlot } from "@/components/ui/AppIcon";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { PageWidget } from "@/components/ui/PageWidget";
import { TextLink } from "@/components/ui/TextLink";
import { inLine } from "@/content/app";
import { CLOSED_BETA_NOTE, closedBeta } from "@/content/beta";
import { api, ApiFailure } from "@/lib/api";
import { ago, credits, creditsWord, playsWord } from "@/lib/format";
import { refreshMe, useSession } from "@/lib/session";

type Load = { status: "loading" } | { status: "ok"; games: ProjectSummary[] } | { status: "error"; message: string };

/** The signed-in home screen: the user's games as apps, newest first, and the credits left.
 * "Manage" turns it into a list to rename, download or delete them. */
export function GamesClient() {
  const session = useSession();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [manage, setManage] = useState(false);
  const [reload, setReload] = useState(0); // bumped by Try again after a failed load
  const signedIn = session.status === "in";

  const running = load.status === "ok" && load.games.some((g) => g.status === "running" || g.status === "queued");

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    const get = () =>
      api
        .projects()
        .then((games) => live && setLoad({ status: "ok", games }))
        .catch((e: ApiFailure) => live && setLoad({ status: "error", message: e.message }));
    void get();
    void refreshMe();
    // Builds start and finish while the list is open: look again every 15 s while one is running or waiting.
    const timer = running ? setInterval(get, 15_000) : null;
    return () => {
      live = false;
      if (timer) clearInterval(timer);
    };
  }, [signedIn, running, reload]);

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

  return (
    <main className="mine" data-app>
      <div className="mine__head">
        <div>
          <h1 className="title mine__title">Your games.</h1>
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
          <p>No games yet. Type an idea and play it in a few minutes.</p>
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
          {games.map((g) => {
            const building = g.status === "running";
            const queued = g.status === "queued"; // waits for its turn: a first build shows the empty sky, standing still
            return (
              <li key={g.id}>
                <AppIcon
                  href={`/games/${g.id}`}
                  building={building && !g.buildId}
                  waiting={queued && !g.buildId}
                  picture={<GameTile id={g.id} name={g.name} building={(building || queued) && !g.buildId} poster={g.buildId && g.poster ? posterUrl(g.buildId) : null} />}
                  name={g.name}
                  nameClassName="mine__name"
                  stat={building ? "building…" : queued ? inLine.tile : !g.buildId ? "not built yet" : g.plays > 0 ? playsWord(g.plays) : ago(g.updatedAt)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
