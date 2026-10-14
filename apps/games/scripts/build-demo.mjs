// Assembles the site's demo games from the agent's test projects (dev and marketing only; users'
// games will be uploaded by the server's export worker):
//   engine/<version>/   the Godot web engine, copied once from any export of that version
//   builds/<id>/        index.pck + game.json per game
// The robot runner's history is exported from its git commits, so the home-page demo plays real
// versions. Usage: node scripts/build-demo.mjs [--no-history] [--force]   (GODOT_EXE overrides Godot)
import { cpSync, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const here = resolve(import.meta.dirname, ".."); // apps/games
const root = resolve(here, "../.."); // the repo
const agentOut = resolve(root, "packages/agent/output");
const GODOT = process.env.GODOT_EXE || "C:/Users/lazar/Godot/4.7.2/Godot_v4.7.2-stable_win64.exe";
const ENGINE_VERSION = process.env.GODOT_VERSION || "4.7.2"; // the version the test projects were exported with
const today = new Date().toISOString().slice(0, 10);

// id -> { folder in agent/output, display name }  (the eight games in web/src/content/games.ts)
const games = {
  "robot-runner": ["runner-iso-sonnet-playtest", "Robot Runner"],
  "fruit-match": ["match3-sonnet-medium", "Fruit Match"],
  "town-driver": ["car3d-iso-opus-medium", "Town Driver 3D"],
  "box-push": ["skill-boxpush-sonnet", "Box Push"],
  "night-runner": ["runner-iso-sonnet", "Night Runner"],
  "fruit-match-night": ["steps-match3-haiku-2", "Fruit Match Night"],
  "little-car": ["car3d-iso-sonnet-medium", "Little Car"],
  "desert-dash": ["runner-v2", "Desert Dash"],
};

// The runner's versions for the "say what to change" demo: commit -> id.
const history = {
  project: "runner-iso-sonnet",
  versions: {
    "2ba9983": ["demo-v0", "Robot Runner, first build"],
    "3d5b2fd": ["demo-v1-coins", "Robot Runner, after: Add coins floating in the air to collect."],
    "e8f4a7b": ["demo-v2-shield", "Robot Runner, after: Add a shield power-up that saves you from one hit."],
    "c91d1d8": ["demo-v3-night", "Robot Runner, after: Change the sky to night with stars."],
  },
};

const writeBuild = (id, pck, name, source) => {
  const dir = join(here, "builds", id);
  mkdirSync(dir, { recursive: true });
  cpSync(pck, join(dir, "index.pck"));
  writeFileSync(
    join(dir, "game.json"),
    JSON.stringify({ name, engine: ENGINE_VERSION, pack: "index.pck", source, built: today }, null, 2) + "\n",
  );
  console.log(id.padEnd(20), Math.round(statSync(pck).size / 1024) + " KB");
};

// 1. The engine for this version, once.
const engineDir = join(here, "engine", ENGINE_VERSION);
if (!existsSync(join(engineDir, "index.wasm")) || process.argv.includes("--force")) {
  const from = join(agentOut, games["robot-runner"][0], "export/web");
  mkdirSync(engineDir, { recursive: true });
  for (const f of ["index.js", "index.wasm", "index.audio.worklet.js", "index.audio.position.worklet.js"]) {
    cpSync(join(from, f), join(engineDir, f));
  }
}
console.log("engine", ENGINE_VERSION + ":", Math.round(statSync(join(engineDir, "index.wasm")).size / 1e6) + " MB");

// 2. Each game's pack.
for (const [id, [folder, name]] of Object.entries(games)) {
  const pck = join(agentOut, folder, "export/web/index.pck");
  if (!existsSync(pck)) {
    console.warn("missing export for", id, "(" + folder + ")");
    continue;
  }
  writeBuild(id, pck, name, `agent/output/${folder}`);
}

// 3. The runner's history: export each commit with Godot headless in a temporary worktree.
if (!process.argv.includes("--no-history")) {
  const project = join(agentOut, history.project);
  const tmp = join(here, ".tmp");
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  for (const [sha, [id, name]] of Object.entries(history.versions)) {
    if (existsSync(join(here, "builds", id, "index.pck")) && !process.argv.includes("--force")) {
      console.log(id.padEnd(20), "kept");
      continue;
    }
    const wt = join(tmp, sha);
    execFileSync("git", ["worktree", "add", "--detach", wt, sha], { cwd: project, stdio: "pipe" });
    try {
      if (!existsSync(join(wt, "export_presets.cfg"))) cpSync(join(project, "export_presets.cfg"), join(wt, "export_presets.cfg"));
      mkdirSync(join(wt, "export/web"), { recursive: true });
      writeFileSync(join(wt, "export/.gdignore"), "");
      const run = (args, ms) => {
        const r = spawnSync(GODOT, ["--headless", "--path", wt, ...args], { encoding: "utf8", timeout: ms });
        if (r.status !== 0 && !existsSync(join(wt, "export/web/index.pck"))) throw new Error(`${id}: Godot ${args[0]} failed\n${r.stderr}`);
      };
      run(["--import"], 180_000);
      run(["--export-release", "Web", "export/web/index.html"], 240_000);
      writeBuild(id, join(wt, "export/web/index.pck"), name, `agent/output/${history.project}@${sha}`);
    } finally {
      execFileSync("git", ["worktree", "remove", "--force", wt], { cwd: project, stdio: "pipe" });
    }
  }
  rmSync(tmp, { recursive: true, force: true });
}
