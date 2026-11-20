import type { Metadata } from "next";
import type { ModelChoice } from "@typeplay/shared";
import { JsonLd } from "@/components/JsonLd";
import { structuredData } from "@/content/seo";
import { Demo } from "@/components/Demo";
import { DemoVideo } from "@/components/DemoVideo";
import { app } from "@/content/app";
import { closedBeta } from "@/content/beta";
import { sale } from "@/content/billing";
import { demoEdits } from "@/content/demo";
import { games } from "@/content/games";
import { credits, plans } from "@/content/site";
import { GameIcon, Listing } from "@/components/GameIcon";
import { BuildingIcon } from "@/components/BuildingIcon";
import { Dock, PlatformSlots } from "@/components/Dock";
import { Ground } from "@/components/Ground";
import { Notice } from "@/components/Notice";
import { Ownership } from "@/components/Ownership";
import { PromptForm } from "@/components/PromptForm";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { ModelTile } from "@/components/ui/ModelTile";
import { TextLink } from "@/components/ui/TextLink";

const game = (slug: string) => {
  const g = games.find((x) => x.slug === slug);
  if (!g) throw new Error(`No game "${slug}" in content/games.ts`);
  return g;
};
const islandRush = game("show-racer-polished-v3");
const free = plans.find((p) => p.id === "free")!;
const medium = plans.find((p) => p.id === "medium")!;
const bestBuilds = games.filter((g) => g.tier === "Best").length;
const t = credits.typical;
// The AIs as a settings list: what each is for, the build times measured (2026-11-19: beta 1's built answers, p10 to p90,
// from `admin stats`, with our own runs since the 11-04 rules for new games on Fast and Smart) and what a new game usually
// costs (the app's own estimate, site.ts `estimates`; the pricing page's table has the rest).
const ais: { id: ModelChoice; name: string; text: string; figures: string[] }[] = [
  {
    id: "fast",
    name: "Fast",
    text: "The cheapest, and the one on Free. Good for small changes; say exactly what you want. New games come out in two steps: a playable core first, then the rest.",
    figures: ["new game 10 to 25 min", "change 2 to 7 min", `about ${t.fastGame} credits a new game`],
  },
  { id: "smart", name: "Smart", text: "The default for new games. The robot runner above is a Smart build.", figures: ["new game 8 to 30 min", `about ${t.smartGame} credits a new game`] },
  {
    id: "best",
    name: "Best",
    text: `The strongest, with better character art. ${bestBuilds} of the ${games.length} games on this page are Best builds.`,
    figures: ["new game 12 to 25 min", `about ${t.bestGame} credits a new game`],
  },
];
// The closing box's line, by the two build flags (content/beta.ts closedBeta, content/billing.ts sale).
const startLine = closedBeta
  ? `${free.credits} free credits a month on Fast, once sign-up opens. During the closed beta, building is by invitation.`
  : sale === "on"
    ? `${free.credits} free credits a month on Fast, played in the browser. ${medium.name} is $${medium.price} a month for Smart and Best, and exports as each one arrives.`
    : `${free.credits} free credits a month on Fast, played in the browser. Paid plans, from $${medium.price} a month, aren't on sale yet.`;

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default function Home() {
  return (
    <main id="top">
      <JsonLd data={structuredData} />
      {/* The home screen */}
      <section className="home" aria-label="Type it, play it">
        <Notice game={islandRush} />
        {/* The widget has its place in the grid (globals.css); the games fill the places around and under it in order,
            and "Your game" is always the last. */}
        <div className="home__grid">
          <div className="widget home__widget">
            <h1 className="display">
              Type it.
              <br />
              <em>Play it.</em>
            </h1>
            <PromptForm />
          </div>
          {games.map((g) => (
            <GameIcon game={g} key={g.slug} />
          ))}
          <BuildingIcon />
        </div>
        {/* The ground rises under the games, never behind them, with the dock on it. */}
        <div className="home__foot">
          <Ground className="home__ground" />
          <Dock />
        </div>
      </section>

      {/* The launch video: nothing at all until content/demo.ts demoVideo is set (parked.md #16). */}
      <DemoVideo />

      {/* Edits by chat: the real Night Runner thread */}
      <section className="section" id="how" aria-labelledby="how-title">
        <h2 id="how-title" className="title">
          Then say what to change.
        </h2>
        <p className="lead">
          One sentence makes the game, then each message changes it. Every version below is real
          and playable, and the minutes are the real build times, shown faster. Tap the game to
          play it.
        </p>
        <Demo />
        <p className="lead lead--after">
          The same robot runner got {demoEdits.length} edits by chat in all, each a new version
          that keeps the old one, so any change can be undone:{" "}
          {demoEdits.map((e, i) => (
            <span key={e}>
              {i > 0 ? " " : ""}
              <q>{e}</q>
            </span>
          ))}
        </p>
      </section>

      {/* The games, as store listings */}
      <section className="section" id="games" aria-labelledby="games-title">
        {/* True to content/games.ts: each began as one message (most showcase prompts are two sentences); the showcase
            six were polished by chat; every game got TypePlay's 11-07 maintenance change for speed and colour, and
            some an earlier hand fix for speed. The minutes are each game's first build: the October test games are
            from before builds did more, so they don't read as today's time. */}
        <h2 id="games-title" className="title">
          Each started from one message.
        </h2>
        <p className="lead">
          Games made with TypePlay. Each began as the words under it, exactly as typed. Some were
          then changed by chat, and every one got our own fixes for speed and colour. The minutes
          are each game&apos;s first build; the older ones are from before builds got bigger. Tap
          one to play it.
        </p>
        <div className="strip">
          {games.map((g) => (
            <Listing game={g} key={g.slug} />
          ))}
        </div>
        {/* page-copy-proposals.md E1 (the eight genres on /create since 10-27, each with its own skill in
            packages/agent/genres) and B2 (the gallery, in builds that have the app, as the status bar's Games). */}
        <p className="lead lead--after">
          TypePlay is tuned for eight kinds of game: runners, platformers, puzzles, racers,
          shooters, tower defence, arcade games and adventures. Other ideas can work too, but the
          results vary more.
          {app.enabled && (
            <>
              {" "}
              More games, made by people: <TextLink href="/explore">explore the gallery</TextLink>.
            </>
          )}
        </p>
      </section>

      {/* The model picker, as a settings list */}
      <section className="section" id="models" aria-labelledby="models-title">
        <h2 id="models-title" className="title">
          You pick the AI, per message.
        </h2>
        <p className="lead">
          Results are partly luck, so you choose every time, and you see an estimate of the cost before anything
          runs. The minutes are measured on real builds: our beta testers&apos; and our own.
        </p>
        <div className="widget settings">
          {ais.map((ai) => (
            <div key={ai.id} className="setting">
              <ModelTile model={ai.id} big />
              <div>
                <b>{ai.name}</b>
                <p>{ai.text}</p>
              </div>
              <span className="figures">
                {ai.figures.map((f, i) => (
                  <span key={f}>
                    {i > 0 && <br />}
                    {f}
                  </span>
                ))}
              </span>
            </div>
          ))}
        </div>
        <p className="lead lead--after">
          <TextLink href="/pricing#credits">What credits buy</TextLink>, from a small change to a
          big game with levels, is on the pricing page.
        </p>
      </section>

      {/* Where it ships */}
      <section className="section" id="ship" aria-labelledby="ship-title">
        <h2 id="ship-title" className="title">
          One game. Every screen.
        </h2>
        <div className="widget widget--ink ship">
          <p>
            Every game is a real Godot project, so the same game can go to the web now, and to
            Android, iOS and Steam as each export arrives. Then we make the build, and you
            publish it on your own Google or Apple developer account, under your own name. Next
            on the list: connect your Google Play account once and publish from TypePlay in one
            click.
          </p>
          <PlatformSlots />
        </div>
      </section>

      {/* Whose game it is: the terms' ownership promise */}
      <Ownership />

      {/* The end: the plans in one line, and the prompt box again, so the reader starts where they finish. */}
      <section className="section" aria-labelledby="free-title">
        <div className="widget cta cta--start">
          <div>
            <h2 id="free-title" className="title cta__title">
              Free to start.
            </h2>
            <p>{startLine}</p>
            <div className="cta__actions">
              <ButtonLink href="/pricing#credits" look="quiet">
                See what credits buy
              </ButtonLink>
            </div>
          </div>
          <PromptForm id="prompt-end" listens={false} hint={null} />
        </div>
      </section>
    </main>
  );
}
