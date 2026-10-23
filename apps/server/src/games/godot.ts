// Reading a game's project.godot, and re-exporting its web build.
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, rmSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import type { Orientation } from "@typeplay/shared";
import { config } from "../env.js";
import { startRunnerJob } from "../runs/runner-client.js";

const section = (projectGodot: string, name: string) =>
  projectGodot.split(new RegExp(`^\\[${name}\\]\\s*$`, "m"))[1]?.split(/^\[/m)[0] ?? "";

/** Which way the game is played (same rule as apps/games/scripts/build-demo.mjs `orientationOf`):
 * the handheld orientation if the project sets one, else the shape of its viewport. */
export function orientationOf(projectGodot: string): Orientation {
  const display = section(projectGodot, "display");
  const value = (key: string) => display.match(new RegExp(`^window/${key}\\s*=\\s*"?([^"\\r\\n]*)"?`, "m"))?.[1];
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
}

/** The game's name if the agent set one (the blank template's "Game" doesn't count). */
export function gameNameOf(projectGodot: string): string | null {
  const m = section(projectGodot, "application").match(/^config\/name\s*=\s*"((?:[^"\\]|\\.)*)"/m);
  const name = m?.[1].replace(/\\(.)/g, "$1").trim();
  return name && name !== "Game" ? name.slice(0, 60) : null;
}

/** A re-export going on: `done` says whether a fresh pack exists; `kill` stops it (cancel, shutdown). */
export interface ExportHandle {
  done: Promise<boolean>;
  kill(): void;
}

/** Godot gets this long to import, then to export (the runner's export job allows 8 minutes in all). */
const IMPORT_MS = 180_000;
const EXPORT_MS = 240_000;

/** Exports export/web/index.pck again (when the last check exported a step that was rolled back).
 * Godot runs the game's @tool scripts while importing, so on the live server this happens in the
 * runner, like the agent's own runs. */
export function exportWeb(dir: string): ExportHandle {
  const pck = join(dir, "export/web/index.pck");
  rmSync(pck, { force: true });
  const fresh = () => existsSync(pck) && statSync(pck).size > 0;
  if (config.runnerSocket) {
    const job = startRunnerJob({ kind: "export", project: basename(dir) }, () => {});
    return { done: job.exit.then(fresh), kill: () => job.kill() };
  }
  let child: ChildProcess | null = null;
  let killed = false;
  const godot = (args: string[], timeoutMs: number) =>
    new Promise<void>((resolve) => {
      if (killed) return resolve();
      child = spawn(config.godotExe, ["--headless", "--path", dir, ...args], { stdio: "ignore", windowsHide: true });
      const timer = setTimeout(() => child?.kill(), timeoutMs);
      child.on("error", () => resolve());
      child.on("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  const done = godot(["--import"], IMPORT_MS)
    .then(() => godot(["--export-release", "Web", "export/web/index.html"], EXPORT_MS))
    .then(() => !killed && fresh());
  return {
    done,
    kill: () => {
      killed = true;
      child?.kill();
    },
  };
}
