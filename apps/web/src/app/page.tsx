import type { Metadata } from "next";
import Link from "next/link";
import { Crown, Lightning, Sparkle } from "@phosphor-icons/react/dist/ssr";
import { JsonLd } from "@/components/JsonLd";
import { structuredData } from "@/content/seo";
import { Demo } from "@/components/Demo";
import { games } from "@/content/games";
import { plans } from "@/content/site";
import { AppIcon, Listing } from "@/components/AppIcon";
import { BuildingIcon } from "@/components/BuildingIcon";
import { Dock, PlatformSlots } from "@/components/Dock";
import { Ground } from "@/components/Ground";
import { Notice } from "@/components/Notice";
import { Ownership } from "@/components/Ownership";
import { PromptForm } from "@/components/PromptForm";

const game = (slug: string) => {
  const g = games.find((x) => x.slug === slug);
  if (!g) throw new Error(`No game "${slug}" in content/games.ts`);
  return g;
};
const robot = game("robot-runner");
const night = game("night-runner");
const free = plans.find((p) => p.id === "free")!;
const medium = plans.find((p) => p.id === "medium")!;
// The home screen's icon order: two left of the widget, two right, then the second row.
const row1 = [game("robot-runner"), game("fruit-match")];
const row1Right = [game("town-driver"), game("box-push")];
const row2 = [night, game("fruit-match-night"), game("little-car"), game("desert-dash")];

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default function Home() {
  return (
    <main id="top">
      <JsonLd data={structuredData} />
      {/* The home screen */}
      <section className="home" aria-label="Type it, play it">
        <Ground className="home__ground" />
        <Notice game={robot} />
        <div className="home__grid">
          {row1.map((g) => (
            <AppIcon game={g} key={g.slug} />
          ))}
          <div className="widget home__widget">
            <h1 className="display">
              Type it.
              <br />
              <em>Play it.</em>
            </h1>
            <PromptForm />
          </div>
          {row1Right.map((g) => (
            <AppIcon game={g} key={g.slug} />
          ))}
          {row2.map((g) => (
            <AppIcon game={g} key={g.slug} stat={g.edits ? `+${g.edits.length} edits by chat` : undefined} />
          ))}
          <div className="home__build">
            <BuildingIcon />
          </div>
        </div>
        <Dock />
      </section>

      {/* Edits by chat: the real Night Runner thread */}
      <section className="section" id="how" aria-labelledby="how-title">
        <h2 id="how-title" className="title">
          Then say what to change.
        </h2>
        <p className="lead">
          Watch it happen: one sentence becomes a game, then each message changes it. Every
          version below is real and playable; the minutes are the real build times, shown
          faster. Click the game to play it.
        </p>
        <Demo />
        <p className="lead lead--after">
          The same robot runner got {night.edits!.length} edits by chat in all, each a new version
          that keeps the old one, so any change can be undone:{" "}
          {night.edits!.map((e, i) => (
            <span key={e}>
              {i > 0 ? " " : ""}
              <q>{e}</q>
            </span>
          ))}
        </p>
      </section>

      {/* The games, as store listings */}
      <section className="section" id="games" aria-labelledby="games-title">
        <h2 id="games-title" className="title">
          Made from one sentence each.
        </h2>
        <p className="lead">
          Test games from our builds, exactly as the AI made them, with the sentence that made
          each one. Tap one to see it.
        </p>
        <div className="strip">
          {games.map((g) => (
            <Listing game={g} key={g.slug} />
          ))}
        </div>
      </section>

      {/* The model picker, as a settings list */}
      <section className="section" id="models" aria-labelledby="models-title">
        <h2 id="models-title" className="title">
          You pick the AI, per message.
        </h2>
        <p className="lead">
          Results are partly luck, so the choice is yours every time, with the cost shown before
          a build runs. Numbers are from our test builds.
        </p>
        <div className="widget settings">
          <div className="setting">
            <span className="setting__icon setting__icon--fast">
              <Lightning size={28} weight="fill" aria-hidden="true" />
            </span>
            <div>
              <b>Fast</b>
              <p>
                The cheapest. Good for small edits; describe exactly what you want. New games
                come out in two short steps.
              </p>
            </div>
            <span className="figures">
              new game 8 to 12 min
              <br />
              edit 1 to 3 min
            </span>
          </div>
          <div className="setting">
            <span className="setting__icon setting__icon--smart">
              <Sparkle size={28} weight="fill" aria-hidden="true" />
            </span>
            <div>
              <b>Smart</b>
              <p>The default for new games. Most of the games on this page are Smart builds.</p>
            </div>
            <span className="figures">
              new game 1.6 to 9 min
              <br />
              more credits than Fast
            </span>
          </div>
          <div className="setting">
            <span className="setting__icon setting__icon--best">
              <Crown size={28} weight="fill" aria-hidden="true" />
            </span>
            <div>
              <b>Best</b>
              <p>The strongest model, with better character art. Costs the most credits.</p>
            </div>
            <span className="figures">
              new game about 8 min
              <br />
              most credits
            </span>
          </div>
        </div>
      </section>

      {/* Where it ships */}
      <section className="section" id="ship" aria-labelledby="ship-title">
        <h2 id="ship-title" className="title">
          One game. Every screen.
        </h2>
        <div className="widget widget--ink ship">
          <p>
            Every game is a real Godot project, so the same game exports to the web, Android,
            iOS and Steam. We make the build; you publish it on your own Google or Apple
            developer account, under your own name. Next on the list: connect your Google Play
            account once and publish from TypePlay in one click.
          </p>
          <PlatformSlots />
        </div>
      </section>

      {/* Whose game it is: the terms' ownership promise */}
      <Ownership />

      {/* Pricing teaser */}
      <section className="section" aria-labelledby="free-title">
        <div className="widget cta">
          <div>
            <h2 id="free-title" className="title cta__title">
              Free to start.
            </h2>
            <p>
              {free.credits} free credits a month on Fast, played in the browser. The{" "}
              {medium.name} plan is ${medium.price} a month for Smart builds and exports.
            </p>
          </div>
          <div className="cta__actions">
            <Link href="/pricing" className="button button--quiet">
              See pricing
            </Link>
            <a href="#prompt" className="button">
              Make my game
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
