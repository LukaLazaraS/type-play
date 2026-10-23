// Git in a game folder (each project is its own repo; run.mjs commits every successful run).
// The agent writes the folder, .git included, so its config and hooks are the agent's: on the live
// server git runs in the runner as the run's throwaway user, never in this process (which holds the
// secrets). On Luka's PC it runs here, as before.
import { execFile } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { promisify } from "node:util";
import { Logger } from "@nestjs/common";
import { config } from "../env.js";
import { runnerExec } from "../runs/runner-client.js";

const exec = promisify(execFile);
const log = new Logger("git");

/** The project id of a game folder (<DATA_DIR>/projects/<id>). */
function projectOf(dir: string): string {
  const id = basename(dir);
  if (resolve(dir) !== resolve(config.dataDir, "projects", id)) throw new Error(`not a project folder: ${dir}`);
  return id;
}

export async function git(dir: string, ...args: string[]): Promise<string> {
  if (config.runnerSocket) {
    const r = await runnerExec({ kind: "git", project: projectOf(dir), args });
    if (r.code !== 0) throw new Error(`git ${args[0]} failed: ${r.error ?? ""} ${r.stderr.trim().slice(0, 300)}`);
    return r.stdout.trim();
  }
  const { stdout } = await exec("git", ["-c", "user.name=game-agent", "-c", "user.email=agent@local", ...args], {
    cwd: dir,
    windowsHide: true,
  });
  return stdout.trim();
}

export const headOf = (dir: string) => git(dir, "rev-parse", "HEAD");

/** Deletes a game folder (the runner does it on the live server: the agent may have locked files). */
export async function removeFolder(dir: string): Promise<void> {
  if (config.runnerSocket) {
    const r = await runnerExec({ kind: "remove", project: projectOf(dir) });
    if (r.code !== 0) throw new Error(`removing ${dir} failed: ${r.error ?? ""}`);
    return;
  }
  rmSync(dir, { recursive: true, force: true });
}

/**
 * Godot's import cache (`.godot/`) is git-ignored, so a reset or a restore leaves it as the last run left it: imports and
 * class lists of files that are now gone or different, which the next check or export trips over (an import error after a
 * reset, 10-19). It goes, and the next import starts afresh. `git clean -x` takes ignored files too, here only under
 * .godot/; through git() it runs where the reset ran (in the runner on the live server). Never throws: a cache that
 * couldn't go is logged and left, as before.
 */
async function dropImportCache(dir: string): Promise<void> {
  try {
    await git(dir, "clean", "-qfdx", "--", ".godot");
  } catch (e) {
    log.warn(`${basename(dir)}: Godot's import cache not cleared: ${e}`);
  }
}

/** Puts the folder back exactly at `commit` (or deletes it when there is no version yet), Godot's import cache cleared. */
export async function settleFolder(dir: string, commit: string | null): Promise<void> {
  if (!commit) return removeFolder(dir);
  if (!existsSync(join(dir, ".git"))) return;
  await git(dir, "reset", "-q", "--hard", commit);
  await git(dir, "clean", "-qfd");
  await dropImportCache(dir);
}

/** A new commit whose files are exactly those of `commit` (files added since are removed), Godot's import cache cleared. */
export async function restoreCommit(dir: string, commit: string, message: string): Promise<string> {
  await git(dir, "read-tree", "-u", "--reset", commit);
  await git(dir, "commit", "-q", "--allow-empty", "-m", message);
  await dropImportCache(dir);
  return headOf(dir);
}
