// Assembles the site's demo games from the agent's test projects (dev and marketing only; users'
// games will be uploaded by the server's export worker):
//   engine/<version>/   the Godot web engine, copied once from any export of that version
//   builds/<id>/        index.pck + game.json per game
// The robot runner's history is exported from its git commits, so the home-page demo plays real
// versions. Usage: node scripts/build-demo.mjs [--no-history] [--force]   (GODOT_EXE overrides Godot)
//
// Showcase candidates (2026-10-19): `node scripts/build-demo.mjs --showcase` assembles only the
// six Opus-built games listed in `showcase` below, plus their `-polished` copies (2026-10-20; not the
// demo games, not the history), see "Showcase candidates" further down. Nothing there is on the live
// home page until Luka picks.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
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

// Showcase candidates for the home page: six games built on Opus (high effort) from one player-style
// prompt each (packages/agent/RESULTS.md, "10-19: showcase candidates (Opus)"; the gallery lists them
// under "Showcase (Opus)"). A separate list from the demo games above: id -> genre label for games.ts.
// The folder in agent/output has the same name as the id.
const showcase = {
  "show-td": "Tower defence",
  "show-racer": "Racing",
  "show-runner": "Endless runner",
  "show-match3": "Puzzle",
  "show-3d": "3D platformer",
  "show-arcade": "Arcade",
  // The same six after 1-3 chat edits each on Fast (Haiku), 2026-10-20 (RESULTS.md "showcase polish"): separate
  // entries, so Luka can put the original and the polished version side by side. Same folder rule: agent/output/<id>.
  "show-td-polished": "Tower defence",
  "show-racer-polished": "Racing",
  "show-runner-polished": "Endless runner",
  "show-match3-polished": "Puzzle",
  "show-3d-polished": "3D platformer",
  "show-arcade-polished": "Arcade",
};
const onlyShowcase = process.argv.includes("--showcase");

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

// Which way a game is played, from its project.godot: the handheld orientation if the project
// sets one, else the shape of its viewport. The site locks phones to it in full screen.
const orientationOf = (projectGodot) => {
  const display = projectGodot.split(/^\[display\]\s*$/m)[1]?.split(/^\[/m)[0] ?? "";
  const value = (key) => display.match(new RegExp(`^window/${key}\\s*=\\s*"?([^"\\r\\n]*)"?`, "m"))?.[1];
  const handheld = value("handheld/orientation");
  if (handheld !== undefined) {
    // Godot 4 stores the enum: 0 landscape, 1 portrait, 2/3 their reverses, 4/5 sensor, 6 any.
    const n = Number(handheld);
    if (n === 0 || n === 2 || n === 4 || /landscape/.test(handheld)) return "landscape";
    if (n === 1 || n === 3 || n === 5 || /portrait/.test(handheld)) return "portrait";
  }
  const w = Number(value("size/viewport_width") ?? 1152); // Godot's defaults
  const h = Number(value("size/viewport_height") ?? 648);
  return w >= h ? "landscape" : "portrait";
};

const writeBuild = (id, pck, name, source, orientation) => {
  const dir = join(here, "builds", id);
  mkdirSync(dir, { recursive: true });
  // Re-assembling an unchanged pack keeps its build date.
  const old = existsSync(join(dir, "game.json")) ? JSON.parse(readFileSync(join(dir, "game.json"), "utf8")) : null;
  const same = old && existsSync(join(dir, "index.pck")) && readFileSync(join(dir, "index.pck")).equals(readFileSync(pck));
  cpSync(pck, join(dir, "index.pck"));
  const built = same && old.built ? old.built : today;
  writeFileSync(
    join(dir, "game.json"),
    JSON.stringify({ name, engine: ENGINE_VERSION, pack: "index.pck", orientation, source, built }, null, 2) + "\n",
  );
  console.log(id.padEnd(20), Math.round(statSync(pck).size / 1024) + " KB", orientation);
};

// 1. The engine for this version, once.
const engineDir = join(here, "engine", ENGINE_VERSION);
if (!existsSync(join(engineDir, "index.wasm")) || process.argv.includes("--force")) {
  const from = join(agentOut, onlyShowcase ? Object.keys(showcase)[0] : games["robot-runner"][0], "export/web");
  mkdirSync(engineDir, { recursive: true });
  for (const f of ["index.js", "index.wasm", "index.audio.worklet.js", "index.audio.position.worklet.js"]) {
    cpSync(join(from, f), join(engineDir, f));
  }
}
console.log("engine", ENGINE_VERSION + ":", Math.round(statSync(join(engineDir, "index.wasm")).size / 1e6) + " MB");

// 2. Each game's pack.
for (const [id, [folder, name]] of onlyShowcase ? [] : Object.entries(games)) {
  const pck = join(agentOut, folder, "export/web/index.pck");
  if (!existsSync(pck)) {
    console.warn("missing export for", id, "(" + folder + ")");
    continue;
  }
  const orientation = orientationOf(readFileSync(join(agentOut, folder, "project.godot"), "utf8"));
  writeBuild(id, pck, name, `agent/output/${folder}`, orientation);
}

// 2b. Showcase candidates (--showcase). Per game, in builds/<id>/:
//   index.pck, game.json   like every build
//   poster.png             the check's start screen (what the API publishes with a user's game)
//   poster-play.png        the same game 3 s after a tap, with more going on
//   poster-hero.png        only when a better picture was taken by hand: the game played for a while
//                          (agent/output/<id>/export/screenshot-hero.png: a tower defence with towers built,
//                          a stack tower 66 floors high), which the check's three pictures never reach
//   card.jpg, icon.jpg     1128x556 and 240x240 for the home page (games.ts `image` and `icon`), made from
//                          the hero picture, else poster-play.png; a portrait game sits on a blurred copy of itself
// Then it prints each game's games.ts entry and the commands that put the two pictures into apps/web
// (not run here: this script never writes to apps/web).
if (onlyShowcase) {
  const sharp = (await import("sharp")).default;
  const runs = readFileSync(join(root, "packages/agent/runs.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  for (const [id, genre] of Object.entries(showcase)) {
    const folder = join(agentOut, id);
    const pck = join(folder, "export/web/index.pck");
    if (!existsSync(pck)) {
      console.warn("missing export for", id);
      continue;
    }
    const projectGodot = readFileSync(join(folder, "project.godot"), "utf8");
    const name = projectGodot.match(/^config\/name="(.*)"/m)?.[1] || id;
    const orientation = orientationOf(projectGodot);
    writeBuild(id, pck, name, `agent/output/${id}`, orientation);
    const out = join(here, "builds", id);
    cpSync(join(folder, "export/screenshot-start.png"), join(out, "poster.png"));
    cpSync(join(folder, "export/screenshot-play.png"), join(out, "poster-play.png"));
    const hero = join(folder, "export/screenshot-hero.png");
    if (existsSync(hero)) cpSync(hero, join(out, "poster-hero.png"));
    else rmSync(join(out, "poster-hero.png"), { force: true });
    const shot = existsSync(hero) ? join(out, "poster-hero.png") : join(out, "poster-play.png");
    const { width: w, height: h } = await sharp(shot).metadata();
    const W = 1128, H = 556;
    let card = sharp(shot).resize(W, H, { fit: "cover" });
    if (h > w) {
      const ph = H - 40, pw = Math.round((ph * w) / h);
      const round = Buffer.from(`<svg width="${pw}" height="${ph}"><rect width="${pw}" height="${ph}" rx="22" ry="22"/></svg>`);
      const phone = await sharp(shot).resize(pw, ph).composite([{ input: round, blend: "dest-in" }]).png().toBuffer();
      const backdrop = await sharp(shot).resize(W, H, { fit: "cover" }).blur(28).modulate({ brightness: 0.55 }).toBuffer();
      card = sharp(backdrop).composite([{ input: phone, gravity: "centre" }]);
    }
    await card.jpeg({ quality: 82 }).toFile(join(out, "card.jpg"));
    const side = Math.min(w, h);
    await sharp(shot)
      .extract({ left: Math.round((w - side) / 2), top: Math.round((h - side) / 2), width: side, height: side })
      .resize(240, 240)
      .jpeg({ quality: 82 })
      .toFile(join(out, "icon.jpg"));
    const run = runs.filter((r) => r.game === id && r.kind === "new").at(-1);
    console.log(
      [
        `--- ${id}: add to apps/web/src/content/games.ts, and copy the pictures:`,
        "  {",
        `    slug: ${JSON.stringify(id)},`,
        `    name: ${JSON.stringify(name)},`,
        `    prompt: ${JSON.stringify(run?.prompt ?? "")},`,
        `    tier: "Best",`,
        `    minutes: ${Math.round((run?.minutes ?? 0) * 10) / 10},`,
        `    genre: ${JSON.stringify(genre)},`,
        `    orientation: ${JSON.stringify(orientation)},`,
        `    image: "/games/${id}.jpg",`,
        `    icon: "/games/${id}_sq.jpg",`,
        "  },",
        `  cp apps/games/builds/${id}/card.jpg apps/web/public/games/${id}.jpg`,
        `  cp apps/games/builds/${id}/icon.jpg apps/web/public/games/${id}_sq.jpg`,
      ].join("\n"),
    );
  }
}

// 3. The runner's history: export each commit with Godot headless in a temporary worktree.
if (!process.argv.includes("--no-history") && !onlyShowcase) {
  const project = join(agentOut, history.project);
  const tmp = join(here, ".tmp");
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  for (const [sha, [id, name]] of Object.entries(history.versions)) {
    const orientation = orientationOf(execFileSync("git", ["show", `${sha}:project.godot`], { cwd: project, encoding: "utf8" }));
    const json = join(here, "builds", id, "game.json");
    if (existsSync(join(here, "builds", id, "index.pck")) && !process.argv.includes("--force")) {
      // Kept as exported; only game.json learns fields added since.
      const meta = JSON.parse(readFileSync(json, "utf8"));
      if (meta.orientation !== orientation) {
        const { source, built, ...rest } = meta;
        writeFileSync(json, JSON.stringify({ ...rest, orientation, source, built }, null, 2) + "\n");
      }
      console.log(id.padEnd(20), "kept", orientation);
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
      writeBuild(id, join(wt, "export/web/index.pck"), name, `agent/output/${history.project}@${sha}`, orientation);
    } finally {
      execFileSync("git", ["worktree", "remove", "--force", wt], { cwd: project, stdio: "pipe" });
    }
  }
  rmSync(tmp, { recursive: true, force: true });
}
