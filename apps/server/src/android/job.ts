// One Android export job: the runner's `android` kind on the live server (runner.mjs), the same
// steps as child processes on Luka's PC (needs a JDK, an SDK and the Linux-style tools; optional,
// docs/android-export-design.md §14.9), or a stub with ANDROID_FAKE=1. Output: the unsigned file
// in the game folder's export/android/, which the service reads (files.ts) and removes.
import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { config, ROOT } from "../env.js";
import { readLines } from "../runs/lines.js";
import { startRunnerJob, type JobExit } from "../runs/runner-client.js";

export interface AndroidJob {
  dir: string;
  buildId: string;
  commit: string;
  format: "apk" | "aab";
  packageName: string;
  versionCode: number;
  versionName: string;
  appName: string;
  orientation: "portrait" | "landscape";
  /** The launcher icon's source picture, when there is one. */
  icon: { png: Buffer; kind: "poster" | "own" } | null;
  logFile: string;
  onLine?: (line: string) => void;
}

export interface AndroidJobHandle {
  /** Resolves with the exit, and the icon kind the prepare step reported (poster | own | placeholder). */
  done: Promise<JobExit & { icon: "poster" | "own" | "placeholder" }>;
  kill(): void;
}

const PREPARE = join(ROOT, "apps/server/runner/android-prepare.mjs");

/** The flags the runner (or the local steps) take; each is checked again by the runner. */
function argsOf(j: AndroidJob): string[] {
  return [
    "--commit", j.commit, "--format", j.format, "--package", j.packageName, "--version-code", String(j.versionCode), "--version-name", j.versionName,
    "--app-name", j.appName, "--orientation", j.orientation, "--build-id", j.buildId, "--icon-kind", j.icon?.kind ?? "poster",
  ];
}

/** On this PC: git archive → prepare → import → export → deliver, as child processes in a scratch folder. */
function startLocal(j: AndroidJob, onLine: (l: string) => void, onStderr: (t: string) => void): { exit: Promise<JobExit>; kill(): void } {
  const scratch = join(config.android.exportsDir, `job-${j.buildId}`);
  rmSync(scratch, { recursive: true, force: true });
  const game = join(scratch, "game");
  const out = join(scratch, "out");
  mkdirSync(game, { recursive: true });
  mkdirSync(out, { recursive: true });
  let icon = "";
  if (j.icon) {
    icon = join(scratch, "icon.png");
    writeFileSync(icon, j.icon.png);
  }
  const a = config.android;
  const env = {
    ...process.env,
    JAVA_HOME: a.javaHome,
    ANDROID_HOME: a.androidHome,
    GRADLE_USER_HOME: join(scratch, "gradle-home"),
    GRADLE_OPTS: "-Dorg.gradle.daemon=false",
  };
  const godotArgs = (...x: string[]) => [`--headless`, `--path`, game, ...x];
  const steps: { cmd: string; args: string[]; cwd: string; pipeTo?: { cmd: string; args: string[] } }[] = [
    { cmd: "git", args: ["-c", "safe.directory=*", "-C", j.dir, "archive", "--format=tar", j.commit], cwd: j.dir, pipeTo: { cmd: "tar", args: ["-x", "-C", game] } },
    {
      cmd: process.execPath,
      args: [PREPARE, "--game", game, "--format", j.format, "--package", j.packageName, "--version-code", String(j.versionCode), "--version-name", j.versionName,
        "--app-name", j.appName, "--orientation", j.orientation, "--out", out, "--icons", a.icons, "--godot", config.godotExe,
        ...(a.gradleSeed ? ["--gradle-seed", a.gradleSeed, "--gradle-home", join(scratch, "gradle-home")] : []), ...(icon ? ["--icon", icon, "--icon-kind", j.icon!.kind] : [])],
      cwd: scratch,
    },
    { cmd: config.godotExe, args: godotArgs("--import"), cwd: game },
    { cmd: config.godotExe, args: godotArgs(...(j.format === "aab" ? ["--install-android-build-template"] : []), "--export-release", "Android", join(out, `game.${j.format}`)), cwd: game },
  ];
  let current: ChildProcess | null = null;
  let killed = false;
  const runStep = (s: (typeof steps)[number]) =>
    new Promise<number | null>((resolve) => {
      if (killed) return resolve(null);
      const child = spawn(s.cmd, s.args, { cwd: s.cwd, env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
      current = child;
      let sink: ChildProcess | null = null;
      if (s.pipeTo) {
        sink = spawn(s.pipeTo.cmd, s.pipeTo.args, { cwd: s.cwd, env, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
        child.stdout!.pipe(sink.stdin!);
        sink.stderr!.on("data", (d: Buffer) => onStderr(String(d)));
      } else readLines(child.stdout!, onLine);
      child.stderr!.on("data", (d: Buffer) => onStderr(String(d)));
      child.on("error", (e) => {
        onStderr(`could not start ${s.cmd}: ${e.message}\n`);
        resolve(127);
      });
      child.on("close", (code) => {
        if (!sink) return resolve(code);
        sink.on("close", (c2) => resolve(code === 0 ? c2 : code));
      });
    });
  const exit = (async (): Promise<JobExit> => {
    try {
      for (const s of steps) {
        const code = await runStep(s);
        if (killed) return { code: null, error: "stopped" };
        if (code !== 0) return { code, error: `exit code ${code}` };
      }
      const file = join(out, `game.${j.format}`);
      if (!existsSync(file)) return { code: 1, error: "no file written" };
      const dest = join(j.dir, "export", "android");
      mkdirSync(dest, { recursive: true });
      const { copyFileSync } = await import("node:fs");
      copyFileSync(file, join(dest, `unsigned-${j.buildId}.${j.format}`));
      return { code: 0 };
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  })();
  return {
    exit,
    kill: () => {
      killed = true;
      current?.kill("SIGKILL");
    },
  };
}

/** ANDROID_FAKE=1: a small zip-shaped file after a moment; a version label containing FAIL fails as a game error. */
function startFake(j: AndroidJob, onLine: (l: string) => void): { exit: Promise<JobExit>; kill(): void } {
  let timer: NodeJS.Timeout;
  let stop: (r: JobExit) => void = () => {};
  const exit = new Promise<JobExit>((resolve) => {
    stop = resolve;
    timer = setTimeout(() => {
      onLine("@@icon " + (j.icon?.kind ?? "placeholder"));
      if (j.appName.includes("FAIL")) {
        onLine("ERROR: res://main.gd:1 - Parse Error: fake failure");
        return resolve({ code: 1, error: "exit code 1" });
      }
      const dest = join(j.dir, "export", "android");
      mkdirSync(dest, { recursive: true });
      writeFileSync(join(dest, `unsigned-${j.buildId}.${j.format}`), Buffer.from(`PK-FAKE ${j.format} ${j.packageName} ${j.versionCode}${j.appName.includes("MISMATCH") ? " MISMATCH" : ""}\n`));
      resolve({ code: 0 });
    }, 1500);
  });
  return { exit, kill: () => { clearTimeout(timer); stop({ code: null, error: "stopped" }); } };
}

export function startAndroidJob(j: AndroidJob): AndroidJobHandle {
  mkdirSync(dirname(j.logFile), { recursive: true, mode: 0o700 });
  const log = createWriteStream(j.logFile, { flags: "a", mode: 0o600 });
  let icon: "poster" | "own" | "placeholder" = "placeholder";
  const onLine = (line: string) => {
    log.write(line + "\n");
    const m = /^@@icon (poster|own|placeholder)$/.exec(line);
    if (m) icon = m[1] as typeof icon;
    j.onLine?.(line);
  };
  const onStderr = (t: string) => {
    log.write(t);
    for (const l of t.split("\n")) if (l.trim()) j.onLine?.(l);
  };
  const started = config.android.fake
    ? startFake(j, onLine)
    : config.runnerSocket
      ? startRunnerJob({ kind: "android", project: basename(j.dir), args: argsOf(j), files: j.icon ? { "icon.png": j.icon.png.toString("base64") } : undefined }, onLine, onStderr)
      : startLocal(j, onLine, onStderr);
  // The tail of this log goes on the row: flushed before the exit is reported.
  const done = started.exit.then((r) => new Promise<JobExit & { icon: typeof icon }>((resolve) => log.end(() => resolve({ ...r, icon }))));
  return { done, kill: () => started.kill() };
}
