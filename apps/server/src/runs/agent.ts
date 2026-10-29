// One game agent run = one process: node packages/agent/run.mjs --dir <game> --events ...
// On Luka's PC it is our child process; on the live server (RUNNER_SOCKET) the runner container
// starts it as a throwaway user (runner-client.ts). run.mjs prints `@@event <json>` lines (progress
// in plain words, then the final record); every line of its output also goes to
// data/logs/<project>-<message>.log.
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createWriteStream, mkdirSync } from "node:fs";
import { basename, dirname } from "node:path";
import type { Effort, GameTag, Genre, ModelChoice, Platform } from "@typeplay/shared";
import { config, ENV_FILE_KEYS } from "../env.js";
import type { ModelFamily } from "./key-proxy.js";
import { readLines } from "./lines.js";
import { startRunnerJob, type JobExit } from "./runner-client.js";

/** AGENT_AUTH=api: the key proxy's address and this run's token (never our API key). */
export interface AgentAuth {
  baseUrl: string;
  token: string;
}

export interface AgentJob {
  dir: string;
  prompt: string;
  kind: "new" | "edit";
  model: ModelChoice;
  effort: Effort;
  /** A first build's screens (run.mjs --platform); null: the agent picks one shape. Edits use the game's own. */
  platform?: Platform | null;
  /** A first build's genre (run.mjs --genre; null: the agent picks one from the idea) and tags (--tags). Edits use the
   * game's own. */
  genre?: Genre | null;
  tags?: GameTag[];
  /** A change on Fast or Smart: the bigger AI the player's plan has, offered if the size check stops it (run.mjs
   * --bigger); null: none (Free, or Best, which is never checked). */
  bigger?: ModelChoice | null;
  logFile: string;
  onProgress: (text: string) => void;
  auth?: AgentAuth;
}

export interface AgentResult {
  ok: boolean;
  refused?: boolean;
  playerMessage?: string;
  /** The agent's work, every attempt (rolled-back steps included), API-equivalent dollars: our accounting. */
  costUsd: number;
  /** The player-message rewrite, kept apart. */
  messageCostUsd: number;
  /** Only the attempts in the game the player gets (0 on failure): what they pay for. Missing from
   * older records, in which case costUsd stands in. */
  chargeUsd?: number;
  /** Up to 9 next-step ideas, best first, for the chat's chips (packages/agent/tools/next-steps.mjs); none on a failed run. */
  suggestions?: string[];
  /** What the ideas call cost: part of the answer's charge, like the player-message rewrite. */
  suggestionsCostUsd?: number;
  /** A new game's genre and size call, and a change's size check: part of the answer's charge too (added 2026-10-29). */
  classifyCostUsd?: number;
  sizeCheckCostUsd?: number;
  /** The size check stopped a change too big for the AI it was sent on: nothing was built, `playerMessage` says why, and
   * the answer is charged for the check (runs.service `stop`). */
  tooBig?: boolean;
  /** The last check exported a step that was then rolled back: export again before publishing. */
  staleExport?: boolean;
  error?: string;
}

export interface AgentHandle {
  done: Promise<AgentResult>;
  kill(): void;
}

/** The user's pick, exactly: Fast = Haiku, Smart = Sonnet, Best = Opus (no auto-switching). */
export const MODEL_FLAG: Record<ModelChoice, ModelFamily> = { fast: "haiku", smart: "sonnet", best: "opus" };

// The agent runs shell commands, so it gets none of our secrets: every key from the root .env is
// left out except the tool paths. On Luka's PC with AGENT_AUTH=max the Claude login (his Max) comes
// from the user profile; with AGENT_AUTH=api the agent gets the key proxy's address and a run token.
const KEEP = new Set(["GODOT_EXE", "BROWSER_EXE", "GODOT_VERSION", "AGENT_AUTH", "ASSET_LIBRARY"]);
const OURS = ["DEV_AUTH", "AGENT_FAKE", "DATA_DIR", "GAMES_BUILDS_DIR", "GAMES_PUBLISH", "MAX_RUNS", "RUN_TIMEOUT_MIN", "QUEUE_WAIT_MIN", "QUEUE_FREE_DELAY_MIN", "PORT", "HOST",
  "RUNNER_SOCKET", "KEY_PROXY_HOST", "KEY_PROXY_PORT", "KEY_PROXY_URL", "ANTHROPIC_UPSTREAM"];
const MODEL_AUTH = ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_BASE_URL"];
// A parent Claude Code session's variables (when the server is started from one, e.g. by the
// Builder) must not reach the game agent's own Claude Code; its login and config dir may.
const PARENT_SESSION = /^CLAUDE_(CODE_(?!OAUTH_TOKEN$)|PID$|EFFORT$|AGENT_SDK)/;
function agentEnv(auth?: AgentAuth): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const k of [...ENV_FILE_KEYS, ...OURS, ...MODEL_AUTH]) if (!KEEP.has(k)) delete env[k];
  for (const k of Object.keys(env)) if (PARENT_SESSION.test(k)) delete env[k];
  if (auth) {
    delete env.CLAUDE_CODE_OAUTH_TOKEN; // a login must not compete with the run token
    Object.assign(env, {
      AGENT_AUTH: "api",
      ANTHROPIC_BASE_URL: auth.baseUrl,
      ANTHROPIC_API_KEY: auth.token,
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
    });
  }
  return env;
}

/** Stops a process and everything it started (the Claude Code binary, Godot, the hidden browser). */
export function killTree(child: ChildProcess, dir: string) {
  if (child.exitCode !== null || !child.pid) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    sweep(dir);
  } else {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      child.kill("SIGKILL");
    }
  }
}

// The agent's shell commands run through Git Bash, whose processes don't keep their Windows parent
// links, so taskkill /T can miss a check that was just starting (seen 2026-10-17: it went on for
// ~30 s, hidden browser included). Kill what still runs on the game folder (Godot is started with
// --path <dir>) and the check.mjs / cpu.mjs processes above it.
export function sweep(dir: string) {
  const needle = dir.replaceAll("\\", "/").toLowerCase().replaceAll("'", "''");
  const script = [
    `$n = '${needle}'`,
    "$all = Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId, CommandLine",
    "$byId = @{}; foreach ($p in $all) { $byId[[int]$p.ProcessId] = $p }",
    "$kill = @(); foreach ($p in $all) { if ($p.CommandLine -and $p.CommandLine.Replace('\\', '/').ToLower().Contains($n)) {",
    "  $kill += $p.ProcessId; $q = $byId[[int]$p.ParentProcessId]",
    "  while ($q -and $q.CommandLine -match 'check\\.mjs|cpu\\.mjs') { $kill += $q.ProcessId; $q = $byId[[int]$q.ParentProcessId] } } }",
    `$kill | Where-Object { $_ -ne ${process.pid} } | Select-Object -Unique | ForEach-Object { taskkill /PID $_ /T /F 2>$null | Out-Null }`,
  ].join("\n");
  spawnSync("powershell", ["-NoProfile", "-Command", script], { stdio: "ignore", windowsHide: true, timeout: 30_000 });
}

interface FinalRecord {
  ok?: boolean;
  refused?: boolean;
  playerMessage?: string;
  costUsd?: number;
  messageCostUsd?: number;
  chargeUsd?: number;
  suggestions?: unknown;
  suggestionsCostUsd?: number;
  classifyCostUsd?: number;
  sizeCheckCostUsd?: number;
  tooBig?: boolean;
  attempts?: { ok?: boolean }[];
}

/** The record's ideas as the chat may show them: up to 9 short single lines in their order, anything else dropped. */
export function cleanSuggestions(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  const out: string[] = [];
  for (const item of list) {
    if (typeof item !== "string") continue;
    const s = item.replace(/\s+/g, " ").trim();
    if (s && s.length <= 60 && !out.includes(s)) out.push(s);
    if (out.length === 9) break;
  }
  return out;
}

interface Started {
  exit: Promise<JobExit>;
  kill(): void;
}

/** On this PC: run.mjs as our child process. */
function startLocal(job: AgentJob, args: string[], onLine: (l: string) => void, onStderr: (t: string) => void): Started {
  const child = spawn(process.execPath, [config.agentRunner, "--dir", job.dir, ...args], {
    cwd: dirname(config.agentRunner),
    env: agentEnv(job.auth),
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    detached: process.platform !== "win32", // own process group, so killTree reaches the whole tree
  });
  readLines(child.stdout!, onLine);
  let stderrBytes = 0;
  child.stderr!.on("data", (d: Buffer) => {
    if ((stderrBytes += d.length) <= 1 << 20) onStderr(String(d));
  });
  const exit = new Promise<JobExit>((resolve) => {
    child.on("error", (e) => resolve({ code: null, error: e.message }));
    child.on("close", (code) => resolve({ code, error: code === 0 ? undefined : `exit code ${code}` }));
  });
  return { exit, kill: () => killTree(child, job.dir) };
}

/** On the live server: run.mjs in the runner container, as that run's throwaway user. */
function startInRunner(job: AgentJob, args: string[], onLine: (l: string) => void, onStderr: (t: string) => void): Started {
  const env: Record<string, string> = job.auth ? { AGENT_AUTH: "api", ANTHROPIC_BASE_URL: job.auth.baseUrl, ANTHROPIC_API_KEY: job.auth.token } : {};
  return startRunnerJob({ kind: "agent", project: basename(job.dir), args, env }, onLine, onStderr);
}

export function runAgent(job: AgentJob): AgentHandle {
  const args = ["--prompt", job.prompt, "--model", MODEL_FLAG[job.model], "--effort", job.effort, "--events"];
  if (job.kind === "edit") args.push("--edit", "--bigger", job.bigger ? MODEL_FLAG[job.bigger] : "none");
  else {
    if (job.platform) args.push("--platform", job.platform);
    if (job.genre) args.push("--genre", job.genre);
    if (job.tags?.length) args.push("--tags", job.tags.join(","));
  }
  // 0700: run logs carry the prompt and the agent's narration; on the live server the runner's
  // throwaway users can traverse /data and must not read them (runner.mjs sets the same).
  mkdirSync(dirname(job.logFile), { recursive: true, mode: 0o700 });
  const log = createWriteStream(job.logFile, { flags: "a", mode: 0o600 });
  let record: FinalRecord | null = null;
  const onLine = (line: string) => {
    log.write(line + "\n");
    if (!line.startsWith("@@event ")) return;
    try {
      const e = JSON.parse(line.slice(8)) as { type?: string; text?: string } & FinalRecord;
      if (e.type === "progress" && e.text) job.onProgress(e.text);
      else if (e.type === "result") record = e;
    } catch {
      // not ours
    }
  };
  const started = (config.runnerSocket ? startInRunner : startLocal)(job, args, onLine, (t) => log.write(t));

  const done = started.exit.then(({ error }): AgentResult => {
    log.end();
    const r = record as FinalRecord | null;
    // run.mjs exits 0 after printing its record, built or not: a bad exit (killed, a crash, the runner
    // refusing the job, e.g. a game folder over its size limit) is a failure whatever the record says.
    // Its costs still count for our accounting; the player pays nothing.
    const sideCosts = {
      classifyCostUsd: Number(r?.classifyCostUsd ?? 0),
      sizeCheckCostUsd: Number(r?.sizeCheckCostUsd ?? 0),
    };
    if (!r || error) {
      return {
        ok: false,
        refused: !!r?.refused,
        costUsd: Number(r?.costUsd ?? 0),
        messageCostUsd: Number(r?.messageCostUsd ?? 0),
        suggestionsCostUsd: Number(r?.suggestionsCostUsd ?? 0),
        ...sideCosts,
        chargeUsd: 0,
        error: error ?? "the agent stopped without a result",
      };
    }
    return {
      ok: !!r.ok,
      refused: !!r.refused,
      // A size-check stop needs its message: without one it is a plain failure (free), never an empty charged answer.
      tooBig: !r.ok && !!r.tooBig && !!r.playerMessage?.trim(),
      playerMessage: r.playerMessage ?? "",
      costUsd: Number(r.costUsd ?? 0),
      messageCostUsd: Number(r.messageCostUsd ?? 0),
      ...(typeof r.chargeUsd === "number" ? { chargeUsd: r.chargeUsd } : {}),
      suggestions: r.ok ? cleanSuggestions(r.suggestions) : [],
      suggestionsCostUsd: Number(r.suggestionsCostUsd ?? 0),
      ...sideCosts,
      staleExport: !!r.ok && r.attempts?.at(-1)?.ok === false,
    };
  });
  return { done, kill: () => started.kill() };
}
