// The home page's games, in the home screen's order. First the six showcase games (since 2026-10-27), each built on Best
// (Opus high) from one sentence, then polished by 1-3 chat edits (packages/agent/RESULTS.md "2026-10-19: showcase
// candidates (Opus)" and "2026-10-20: showcase polish"; agent/runs.jsonl). Then the eight earlier test games, back the
// same day to fill the home screen: built from one sentence each, mostly on Smart, Night Runner then changed by chat
// (agent/output, agent/runs.jsonl). Prompts, minutes and edits are the measured facts, as typed; names are display
// names given here; the slug is the build on the games origin (apps/games/builds/<slug>, from `build-demo.mjs`).

import { demoEdits } from "./demo";

export type Tier = "Fast" | "Smart" | "Best";

/** Which way the game is played. Phones lock to it in full screen, and ask to turn when they can't. */
export type Orientation = "landscape" | "portrait";

export type Game = {
  slug: string;
  name: string;
  prompt: string;
  tier: Tier;
  minutes: number;
  genre: string;
  /** From the project's display settings (game.json on the games origin says the same). */
  orientation: Orientation;
  /** Wide screenshot, 1128x556 */
  image: string;
  /** Square crop for icons, 240x240 */
  icon: string;
  edits?: string[];
};

/** Under a game's frame, wherever one is played on the site (the launcher, the share page, the gallery). */
export const howToPlay = "Play with keys or touch. On a phone it opens full screen.";

export const games: Game[] = [
  {
    slug: "show-racer-polished",
    name: "Island Rush",
    prompt:
      "Make a top-down racing game on a tropical island where I race against 5 rivals around a winding beach track for 3 laps, with boost pads on the road, a nitro boost button, a 3-2-1 countdown and a podium with a trophy at the end.",
    tier: "Best",
    minutes: 23.2,
    genre: "Racing",
    orientation: "portrait",
    image: "/games/show-racer-polished.jpg",
    icon: "/games/show-racer-polished_sq.jpg",
    edits: ["I can not read the hint text at the bottom when I drive over the sand, it just blends in. Please make it easier to read."],
  },
  {
    slug: "show-arcade-polished",
    name: "Sky Stack",
    prompt:
      "Make a one-tap stacking game: blocks slide back and forth and I tap to drop each one on my tower, anything that overhangs gets sliced off, and perfect drops give combos. The sky should change from sunset to night to outer space as the tower grows, and I want a best score.",
    tier: "Best",
    minutes: 11.5,
    genre: "Arcade",
    orientation: "portrait",
    image: "/games/show-arcade-polished.jpg",
    icon: "/games/show-arcade-polished_sq.jpg",
    edits: ["The +1 popups that float up when I drop a block are really hard to see against the sky. Please make them easier to read."],
  },
  {
    slug: "show-td-polished",
    name: "Gingerbread Guard",
    prompt:
      "Make a tower defence game where I protect a gingerbread castle from waves of hungry ants and beetles. I want 3 different maps, 5 candy towers that I can upgrade, money for every kill, and a giant boss wave at the end of each map.",
    tier: "Best",
    minutes: 22.9,
    genre: "Tower defence",
    orientation: "portrait",
    image: "/games/show-td-polished.jpg",
    icon: "/games/show-td-polished_sq.jpg",
    edits: [
      "The game gets really slow and choppy when there are lots of bugs on the screen. Can you make it run smoother?",
      "The map does not look like candy at all, it just looks like a green field. Please make it look like a candy land, with a candy road and sweets everywhere.",
      "It is still really choppy when my towers start shooting at the bugs. Can you make it smoother?",
    ],
  },
  {
    slug: "show-match3-polished",
    name: "Petal Pop",
    prompt:
      "Make a match-3 game in a magical flower garden with a level map that winds through the garden. Each level has a different goal, like collecting flowers, breaking ice or reaching a score, with special pieces from big matches and up to 3 stars per level.",
    tier: "Best",
    minutes: 19.7,
    genre: "Puzzle",
    orientation: "portrait",
    image: "/games/show-match3-polished.jpg",
    icon: "/games/show-match3-polished_sq.jpg",
    // The edit before these two moved the board the wrong way and was rolled back (RESULTS.md, 10-20).
    edits: [
      "The board still sits too high and the grass under it is empty. Please move the board lower, closer to the bottom buttons, so it fills the screen better.",
      "The board looks plain. Can you make it prettier, like a wooden garden frame around it and shinier, rounder flowers?",
    ],
  },
  {
    slug: "show-runner-polished",
    name: "Rooftop Ninja",
    prompt:
      "Make an endless runner where a ninja cat runs across city rooftops at night, collecting fish and power-ups like a magnet and a shield. The obstacles should change as I go, from chimneys and gaps to crows and drones, it should speed up, and I want to beat my best score.",
    tier: "Best",
    minutes: 17.1,
    genre: "Endless runner",
    orientation: "landscape",
    image: "/games/show-runner-polished.jpg",
    icon: "/games/show-runner-polished_sq.jpg",
    edits: ["The ninja cat is hard to see against the dark rooftops. Please make it stand out more."],
  },
  {
    slug: "show-3d-polished",
    name: "Sky Hopper",
    prompt:
      "Make a 3D platform game where a cute little character runs and jumps across floating islands and moving platforms, collects coins and stars, and dodges spikes and spinning saws. There are 3 levels, a green meadow, a snowy mountain and a night level, each ending at a flag, and falling off puts me back at the last checkpoint.",
    tier: "Best",
    minutes: 20,
    genre: "3D platformer",
    orientation: "landscape",
    image: "/games/show-3d-polished.jpg",
    icon: "/games/show-3d-polished_sq.jpg",
    edits: [
      "From behind my character looks like a plain white ball. Please give it ears, a tail and a little backpack so it looks like a real character.",
      "The grass on the islands looks pale and washed out. Please make it a richer, greener green.",
    ],
  },
  {
    slug: "robot-runner",
    name: "Robot Runner",
    prompt:
      "Make an endless runner where a little robot jumps over cactuses and it gets faster over time.",
    tier: "Smart",
    minutes: 1.6,
    genre: "Endless runner",
    orientation: "landscape",
    image: "/games/runner_sunset.jpg",
    icon: "/games/runner_sunset_sq.jpg",
  },
  {
    slug: "fruit-match",
    name: "Fruit Match",
    prompt: "Make a match-3 puzzle game with cute fruit.",
    tier: "Smart",
    minutes: 2.2,
    genre: "Puzzle",
    orientation: "landscape",
    image: "/games/match3.jpg",
    icon: "/games/match3_sq.jpg",
  },
  {
    slug: "town-driver",
    name: "Town Driver 3D",
    prompt:
      "Make a 3D game where I drive a little car around a small town and collect coins before the time runs out.",
    tier: "Best",
    minutes: 7.6,
    genre: "3D driving",
    orientation: "landscape",
    image: "/games/car_city.jpg",
    icon: "/games/car_city_sq.jpg",
  },
  {
    slug: "night-runner",
    name: "Night Runner",
    prompt:
      "Make an endless runner where a little robot jumps over cactuses and it gets faster over time.",
    tier: "Smart",
    minutes: 1.6,
    genre: "Endless runner",
    orientation: "landscape",
    image: "/games/runner_night.jpg",
    icon: "/games/runner_night_sq.jpg",
    edits: demoEdits,
  },
  {
    slug: "fruit-match-night",
    name: "Fruit Match Night",
    prompt: "Make a match-3 puzzle game with cute fruit.",
    tier: "Fast",
    minutes: 10.5,
    genre: "Puzzle",
    orientation: "landscape",
    image: "/games/match3_dark.jpg",
    icon: "/games/match3_dark_sq.jpg",
  },
  {
    slug: "desert-dash",
    name: "Desert Dash",
    prompt:
      "Make an endless runner where a little robot jumps over cactuses and it gets faster over time.",
    tier: "Smart",
    minutes: 4.1,
    genre: "Endless runner",
    orientation: "landscape",
    image: "/games/runner_day.jpg",
    icon: "/games/runner_day_sq.jpg",
  },
  {
    slug: "box-push",
    name: "Box Push",
    prompt:
      "Make a puzzle game where you push boxes onto targets, with 5 levels that get harder.",
    tier: "Smart",
    minutes: 8.8,
    genre: "Puzzle",
    orientation: "landscape",
    image: "/games/boxpush.jpg",
    icon: "/games/boxpush_sq.jpg",
  },
  {
    slug: "little-car",
    name: "Little Car",
    prompt:
      "Make a 3D game where I drive a little car around a small town and collect coins before the time runs out.",
    tier: "Smart",
    minutes: 4.4,
    genre: "3D driving",
    orientation: "landscape",
    image: "/games/car_sonnet.jpg",
    icon: "/games/car_sonnet_sq.jpg",
  },
];

/** Measured per-edit times on Fast (Haiku 5.5), from the Night Runner edit chain: 1.1 to 2.6 minutes each. */
export const editMinutes = { min: 1.1, max: 2.6 };
