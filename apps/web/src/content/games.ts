// Real test games built by the game agent from one sentence each (agent/output, agent/runs.jsonl).
// Names are display names given here; prompts, models, minutes and the edit list are the measured facts.

export type Tier = "Fast" | "Smart" | "Best";

export type Game = {
  slug: string;
  name: string;
  prompt: string;
  tier: Tier;
  minutes: number;
  genre: string;
  /** Wide screenshot, 1128x556 */
  image: string;
  /** Square crop for icons, 240x240 */
  icon: string;
  edits?: string[];
};

export const games: Game[] = [
  {
    slug: "robot-runner",
    name: "Robot Runner",
    prompt:
      "Make an endless runner where a little robot jumps over cactuses and it gets faster over time.",
    tier: "Smart",
    minutes: 1.6,
    genre: "Endless runner",
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
    image: "/games/car_city.jpg",
    icon: "/games/car_city_sq.jpg",
  },
  {
    slug: "box-push",
    name: "Box Push",
    prompt:
      "Make a puzzle game where you push boxes onto targets, with 5 levels that get harder.",
    tier: "Smart",
    minutes: 8.8,
    genre: "Puzzle",
    image: "/games/boxpush.jpg",
    icon: "/games/boxpush_sq.jpg",
  },
  {
    slug: "night-runner",
    name: "Night Runner",
    prompt:
      "Make an endless runner where a little robot jumps over cactuses and it gets faster over time.",
    tier: "Smart",
    minutes: 1.6,
    genre: "Endless runner",
    image: "/games/runner_night.jpg",
    icon: "/games/runner_night_sq.jpg",
    edits: [
      "Make the robot jump a little higher.",
      "Add coins floating in the air to collect.",
      "Let the robot double jump.",
      "The cactuses come too fast at the start, make the beginning easier.",
      "Add a shield power-up that saves you from one hit.",
      "Make the score text bigger.",
      "Change the sky to night with stars.",
      "Add sounds when you jump and when you collect a coin.",
    ],
  },
  {
    slug: "fruit-match-night",
    name: "Fruit Match Night",
    prompt: "Make a match-3 puzzle game with cute fruit.",
    tier: "Fast",
    minutes: 10.5,
    genre: "Puzzle",
    image: "/games/match3_dark.jpg",
    icon: "/games/match3_dark_sq.jpg",
  },
  {
    slug: "little-car",
    name: "Little Car",
    prompt:
      "Make a 3D game where I drive a little car around a small town and collect coins before the time runs out.",
    tier: "Smart",
    minutes: 4.4,
    genre: "3D driving",
    image: "/games/car_sonnet.jpg",
    icon: "/games/car_sonnet_sq.jpg",
  },
  {
    slug: "desert-dash",
    name: "Desert Dash",
    prompt:
      "Make an endless runner where a little robot jumps over cactuses and it gets faster over time.",
    tier: "Smart",
    minutes: 4.1,
    genre: "Endless runner",
    image: "/games/runner_day.jpg",
    icon: "/games/runner_day_sq.jpg",
  },
];

/** Measured per-edit times on Fast (Haiku 5.5), from the Night Runner edit chain: 1.1 to 2.6 minutes each. */
export const editMinutes = { min: 1.1, max: 2.6 };
