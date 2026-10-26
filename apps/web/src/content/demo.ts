// The home-page simulation: four real versions of the robot runner, exported from its git
// history (games/scripts/build-demo.mjs). Minutes are the measured build times (agent/runs.jsonl).

export type DemoStep = {
  kind: "new" | "edit";
  text: string;
  tier: "Smart" | "Fast";
  minutes: number;
  /** Build id on the games origin (games/builds/<id>) */
  id: string;
  /** Poster shown until the engine runs (web/public/games) */
  poster: string;
};

export const demoSteps: DemoStep[] = [
  {
    kind: "new",
    text: "Make an endless runner where a little robot jumps over cactuses and it gets faster over time.",
    tier: "Smart",
    minutes: 1.6,
    id: "demo-v0",
    poster: "/games/demo-v0.jpg",
  },
  {
    kind: "edit",
    text: "Add coins floating in the air to collect.",
    tier: "Fast",
    minutes: 2.6,
    id: "demo-v1-coins",
    poster: "/games/demo-v1-coins.jpg",
  },
  {
    kind: "edit",
    text: "Add a shield power-up that saves you from one hit.",
    tier: "Fast",
    minutes: 2,
    id: "demo-v2-shield",
    poster: "/games/demo-v2-shield.jpg",
  },
  {
    kind: "edit",
    text: "Change the sky to night with stars.",
    tier: "Fast",
    minutes: 1.7,
    id: "demo-v3-night",
    poster: "/games/demo-v3-night.jpg",
  },
];

/** Every edit the same robot runner got by chat, in order (the "Night Runner" thread, on the home page until 2026-10-27). */
export const demoEdits = [
  "Make the robot jump a little higher.",
  "Add coins floating in the air to collect.",
  "Let the robot double jump.",
  "The cactuses come too fast at the start, make the beginning easier.",
  "Add a shield power-up that saves you from one hit.",
  "Make the score text bigger.",
  "Change the sky to night with stars.",
  "Add sounds when you jump and when you collect a coin.",
];

/** What the agent says while it works, in the player's words. */
export const demoWork = {
  new: ["Planning the game", "Writing the code", "Running it and taking screenshots"],
  edit: ["Reading the game", "Making the change", "Checking it still runs"],
};

export const demoClosing =
  "Four real versions of one game, from its history. The other five edits are listed below.";
