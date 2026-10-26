// The gVisor trial (RESULTS.md next to this file): the live runner container under runc (Docker's default)
// and under gVisor (runsc), on the same machine, with the same jobs, alternating which runtime goes first.
// Run in WSL as root with Node 22, after setup-wsl.sh and build-image.sh:
//   node bench.mjs setup                fixture games (git clones of packages/agent/output/*), the 3D library, folders
//   node bench.mjs jobstart [--n 30]    a minimal job (git rev-parse) and an empty agent job: the runner's own cost
//   node bench.mjs coldstart [--n 8]    container start → the runner's socket answers
//   node bench.mjs export [--n 5]       Godot import + web export (the runner's `export` job), three games
//   node bench.mjs check [--n 4]        the agent's check (Godot runs, the hidden browser), as on the server and without the pin
//   node bench.mjs android [--n 4]      Android APK and AAB (the runner's `android` job, unsigned)
//   node bench.mjs builds [--n 3]       real builds, Fast and Smart, the same prompts, both runtimes side by side
//   node bench.mjs report               the tables (results/RESULTS.md), from results/*.jsonl
//   node bench.mjs down                 stop and remove both stacks (and the key file)
// Every job is sent over the runner's Unix socket the way the API sends it (src/runs/runner-client.ts); CPU and
// memory come from the runner container's cgroup (all of the sandbox's processes under gVisor).
import { spawnSync } from "node:child_process";
import {
  appendFileSync, chmodSync, chownSync, closeSync, cpSync, existsSync, mkdirSync, openSync, readFileSync, readSync, readdirSync,
  rmSync, statSync, writeFileSync, writeSync,
} from "node:fs";
import { request } from "node:http";
import { dirname, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "../../../..");
const ROOT = process.env.GVB_ROOT || "/srv/gvbench";
// Fixture games are in the main checkout's git-ignored packages/agent/output; the API key in its root .env.
const MAIN = process.env.GVB_MAIN || "/mnt/c/Users/lazar/Desktop/master-project/startups/type-play";
const LIBRARY = process.env.GVB_LIBRARY || "/mnt/e/3D models";

const args = process.argv.slice(2);
const phase = args[0];
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};

// The stacks: a Docker runtime and the jobs' malloc setting (the live compose file's GLIBC_TUNABLES, or none).
const TUNED = readFileSync(join(REPO, "deploy", "api", "compose.yaml"), "utf8").match(/GLIBC_TUNABLES: "([^"]+)"/)?.[1] ?? "";
const STACKS = {
  runc: { runtime: "runc", tunables: "", net: "10.201.0" }, // the live server today
  runsc: { runtime: "runsc", tunables: TUNED, net: "10.202.0" }, // gVisor as this branch sets it up
  "runc-tuned": { runtime: "runc", tunables: TUNED, net: "10.203.0" }, // the malloc setting alone
  "runsc-plain": { runtime: "runsc", tunables: "", net: "10.204.0" }, // gVisor without it
  // runc with the pin bug fixed: a do-nothing taskset first on the jobs' PATH (compose.nopin.yaml), so
  // tools/cpu.mjs can't pin the check. Its own 4 vCPUs, to run beside the other two.
  "runc-nopin": { runtime: "runc", tunables: "", net: "10.205.0", nopin: true, cpus: "8-11" },
};
// `tune` also takes extra runtimes registered by hand (runsc-<name>, RESULTS.md): no malloc setting, a subnet of their own.
const stackOf = (s) => STACKS[s] ?? { runtime: s, tunables: "", net: `10.${210 + (parseInt(s.replace(/\W/g, ""), 36) % 40)}.0` };
/** The stacks a phase compares (--stacks runc,runsc,runc-tuned,runsc-plain); runc is the baseline. */
const RUNTIMES = (opt("stacks") || "runc,runsc").split(",");
// 4 vCPUs each, as a CPX32 has (and the live compose file's 3-CPU cap on top). runc gets 0-3, the server's own
// numbering: tools/cpu.mjs pins every check with `taskset -pc 2-2` there, which only works where CPU 2 exists.
// runsc applies cpusets past CPU 7 wrongly (8-11 became 0-3) and ignores pinning anyway: 4-7 for it.
const cpusOf = (s) => stackOf(s).cpus ?? (stackOf(s).runtime === "runc" ? "0-3" : "4-7");
const FIXTURES = { runner: "steps2-runner-haiku-medium", match3: "portrait-match3-haiku", car3d: "car3d-assets-haiku", td: "td2-haiku" };
const PROMPTS = {
  runner: "Make an endless runner where a little robot jumps over cactuses and it gets faster over time.",
  match3: "Make a match-3 puzzle game with cute fruit.",
  car3d: "Make a 3D game where I drive a little car around a small town and collect coins before the time runs out.",
};
const MODELS = { haiku: "Fast", sonnet: "Smart" };
const BUDGET_USD = Number(process.env.GVB_BUDGET_USD || 20); // real builds stop past this (metered by the proxy)
const BUILD_TIMEOUT_MS = 40 * 60_000; // the API's RUN_TIMEOUT_MIN
const API_UID = 1000;

const log =(...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function sh(cmd, argv, { allowFail = false, ...opts } = {}) {
  const r = spawnSync(cmd, argv, { encoding: "utf8", maxBuffer: 64 << 20, ...opts });
  if (r.status !== 0 && !allowFail) throw new Error(`${cmd} ${argv.join(" ")} failed (${r.status}): ${(r.stderr || r.stdout || "").slice(-2000)}`);
  return r;
}

// --- the two stacks ---------------------------------------------------------------------------------

const dirOf = (rt) => join(ROOT, rt);
const projectDir = (rt, id) => join(dirOf(rt), "data", "projects", id);
const container = (rt) => `gvb-${rt}-runner-1`;
const secretsFile = join(ROOT, "secrets", "proxy.env");
const current = {}; // what each stack was last brought up with

function composeEnv(rt, cfg) {
  const e = {
    ...process.env, RUNTIME: stackOf(rt).runtime, JOB_TUNABLES: stackOf(rt).tunables, CPUSET: cpusOf(rt), GVB_DIR: dirOf(rt),
    GVB_ASSETS: join(ROOT, "assets"), GVB_BENCH: join(ROOT, "bench"), AGENTS_NET: stackOf(rt).net,
  };
  delete e.AGENT_SCRIPT;
  delete e.GVB_SECRETS;
  if (cfg.probe) e.AGENT_SCRIPT = "/bench/probe.mjs";
  if (cfg.secrets) e.GVB_SECRETS = secretsFile;
  return e;
}
const compose = (rt, cfg, ...argv) => sh("docker", ["compose", "-p", `gvb-${rt}`, "-f", join(HERE, "compose.yaml"),
  ...(stackOf(rt).nopin ? ["-f", join(HERE, "compose.nopin.yaml")] : []), ...argv], { env: composeEnv(rt, cfg) });

function capCpus() {
  // Luka's PC stays usable: every container on vCPUs 0-11 at a low weight (until WSL restarts), 4 never touched;
  // each runner is capped at 3 CPUs by the live compose file anyway.
  sh("systemctl", ["set-property", "--runtime", "system.slice", "AllowedCPUs=0-11", "CPUWeight=20"]);
}

async function up(rt, cfg) {
  const key = JSON.stringify(cfg);
  if (current[rt] === key && (await health(rt))) return;
  for (const d of ["data", "run", "control"]) mkdirSync(join(dirOf(rt), d), { recursive: true });
  chownSync(join(dirOf(rt), "control"), API_UID, API_UID);
  chmodSync(join(dirOf(rt), "control"), 0o700);
  compose(rt, cfg, "up", "-d", "--remove-orphans");
  const t0 = Date.now();
  while (!(await health(rt)) || !(await control(rt, "GET", "/health").catch(() => null))) {
    if (Date.now() - t0 > 60_000) throw new Error(`${rt}: the runner or the proxy did not come up: ${sh("docker", ["logs", "--tail", "30", container(rt)], { allowFail: true }).stderr}`);
    await sleep(100);
  }
  current[rt] = key;
  log(`${rt}: up (vCPUs ${cpusOf(rt)}${cfg.probe ? ", probe" : ""}${cfg.secrets ? ", key" : ""}), cgroup ${cgroupOf(rt)}`);
}
const upBoth = async (cfg) => { for (const rt of RUNTIMES) await up(rt, cfg); };

function unix(socketPath, method, path, body) {
  return new Promise((resolveP, reject) => {
    const data = body === undefined ? "" : JSON.stringify(body);
    const req = request({ socketPath, method, path, headers: { "content-type": "application/json", "content-length": Buffer.byteLength(data) } }, (res) => {
      let text = "";
      res.on("data", (c) => (text += c));
      res.on("end", () => {
        try {
          resolveP({ status: res.statusCode, body: JSON.parse(text) });
        } catch {
          resolveP({ status: res.statusCode, body: text });
        }
      });
    });
    req.setTimeout(10_000, () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end(data);
  });
}
async function health(rt) {
  try {
    return (await unix(join(dirOf(rt), "run", "runner.sock"), "GET", "/health")).status === 200;
  } catch {
    return false;
  }
}
async function control(rt, method, path, body) {
  const r = await unix(join(dirOf(rt), "control", "proxy.sock"), method, path, body);
  if (r.status !== 200) throw new Error(`proxy ${path}: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
}

// --- a job, as the API sends it -------------------------------------------------------------------------

function runJob(rt, body, { onLine, timeoutMs = 20 * 60_000 } = {}) {
  return new Promise((resolveP) => {
    const t0 = performance.now();
    let headersMs = null, firstMs = null, settled = false, stderr = "";
    let req;
    const done = (r) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolveP({ ...r, wallMs: performance.now() - t0, headersMs, firstMs, stderr: stderr.slice(-6000) });
    };
    const timer = setTimeout(() => { req?.destroy(); done({ code: null, err: "timeout (stopped by the bench)" }); }, timeoutMs);
    const data = JSON.stringify(body);
    req = request(
      { socketPath: join(dirOf(rt), "run", "runner.sock"), path: "/jobs", method: "POST", headers: { "content-type": "application/json", "content-length": Buffer.byteLength(data) } },
      (res) => {
        headersMs = performance.now() - t0;
        if (res.statusCode !== 200) {
          let text = "";
          res.on("data", (c) => (text += c));
          res.on("end", () => done({ code: null, err: `runner ${res.statusCode}: ${text.slice(0, 300)}` }));
          return;
        }
        res.setEncoding("utf8");
        let buf = "";
        res.on("data", (chunk) => {
          if (firstMs === null) firstMs = performance.now() - t0;
          buf += chunk;
          for (let i; (i = buf.indexOf("\n")) >= 0; ) {
            const line = buf.slice(0, i);
            buf = buf.slice(i + 1);
            let m;
            try {
              m = JSON.parse(line);
            } catch {
              continue;
            }
            if (typeof m.o === "string") onLine?.(m.o, performance.now() - t0);
            else if (typeof m.e === "string") stderr += m.e;
            else if ("x" in m) done({ code: m.x, signal: m.s });
            else if (typeof m.err === "string") done({ code: null, err: m.err });
          }
        });
        res.on("error", () => done({ code: null, err: "stream error" }));
        res.on("close", () => done({ code: null, err: "the runner closed the connection" }));
      },
    );
    req.on("error", (e) => done({ code: null, err: e.message }));
    req.end(data);
  });
}

// --- CPU and memory: the runner container's cgroup -----------------------------------------------------

function cgroupOf(rt) {
  const pid = sh("docker", ["inspect", "-f", "{{.State.Pid}}", container(rt)]).stdout.trim();
  const rel = readFileSync(`/proc/${pid}/cgroup`, "utf8").match(/^0::(.*)$/m)?.[1];
  if (!rel) throw new Error(`${rt}: no cgroup v2 path for pid ${pid}`);
  return join("/sys/fs/cgroup", rel);
}
function cpuStat(cg) {
  const t = readFileSync(join(cg, "cpu.stat"), "utf8");
  const g = (k) => Number(t.match(new RegExp(`^${k} (\\d+)$`, "m"))?.[1] ?? 0);
  return { usage: g("usage_usec"), user: g("user_usec"), system: g("system_usec") };
}
const memCurrent = (cg) => Number(readFileSync(join(cg, "memory.current"), "utf8"));

/** CPU seconds and peak memory of one container while a job runs (memory.peak reset for this fd, kernel 6.12+;
 * a 200 ms sample of memory.current as a cross-check). */
class Meter {
  constructor(rt) {
    this.cg = cgroupOf(rt);
    this.cpu0 = cpuStat(this.cg);
    this.max = 0;
    try {
      this.fd = openSync(join(this.cg, "memory.peak"), "r+");
      writeSync(this.fd, "reset\n");
    } catch {
      this.fd = null;
    }
    this.sample();
    this.timer = setInterval(() => this.sample(), 200);
  }
  sample() {
    try {
      this.max = Math.max(this.max, memCurrent(this.cg));
    } catch {
      // the container is restarting
    }
  }
  stop() {
    clearInterval(this.timer);
    this.sample();
    const c = cpuStat(this.cg);
    let peak = null;
    if (this.fd !== null) {
      const b = Buffer.alloc(64);
      const n = readSync(this.fd, b, 0, 64, 0);
      peak = Number(b.subarray(0, n).toString().trim());
      closeSync(this.fd);
    }
    const mb = (v) => Math.round(v / 2 ** 20);
    return {
      cpuSec: +((c.usage - this.cpu0.usage) / 1e6).toFixed(2),
      userSec: +((c.user - this.cpu0.user) / 1e6).toFixed(2),
      sysSec: +((c.system - this.cpu0.system) / 1e6).toFixed(2),
      peakMb: mb(Number.isFinite(peak) && peak > 0 ? peak : this.max),
      sampledPeakMb: mb(this.max),
    };
  }
}

// --- fixtures and results -------------------------------------------------------------------------------

function resetProject(rt, id, fixture) {
  const dir = projectDir(rt, id);
  rmSync(dir, { recursive: true, force: true });
  cpSync(join(ROOT, "fixtures", fixture), dir, { recursive: true });
  sh("chown", ["-R", `${API_UID}:${API_UID}`, dir]);
  chmodSync(dir, 0o700);
  return dir;
}
/** The stacks in a different order each round (two: ab, ba, ab…), so slow drift on the PC hits them all alike. */
const order = (rep) => {
  const k = (rep - 1) % RUNTIMES.length;
  return [...RUNTIMES.slice(k), ...RUNTIMES.slice(0, k)];
};
function record(name, row) {
  mkdirSync(join(ROOT, "results"), { recursive: true });
  appendFileSync(join(ROOT, "results", `${name}.jsonl`), JSON.stringify({ at: new Date().toISOString(), ...row }) + "\n");
}
const fmtMs = (ms) => (ms >= 60_000 ? `${(ms / 60_000).toFixed(1)} min` : `${(ms / 1000).toFixed(1)} s`);

async function setup() {
  for (const d of ["bench", "fixtures", "results", "secrets"]) mkdirSync(join(ROOT, d), { recursive: true });
  chmodSync(join(ROOT, "secrets"), 0o700);
  for (const f of ["proxy.mjs", "probe.mjs", "taskset-noop.sh"]) cpSync(join(HERE, f), join(ROOT, "bench", f));
  sh("chmod", ["-R", "a+rX", join(ROOT, "bench")]);
  chmodSync(join(ROOT, "bench", "taskset-noop.sh"), 0o755);
  for (const [name, src] of Object.entries(FIXTURES)) {
    const dest = join(ROOT, "fixtures", name);
    if (existsSync(join(dest, ".git"))) continue;
    // Committed files only (no .godot/ import cache, no export/): every job starts from the same clean game.
    sh("git", ["-c", "safe.directory=*", "clone", "-q", "--no-hardlinks", join(MAIN, "packages", "agent", "output", src), dest]);
    sh("git", ["-C", dest, "remote", "remove", "origin"]);
    log(`fixture ${name} ← ${src} (${sh("git", ["-C", dest, "rev-parse", "--short", "HEAD"]).stdout.trim()})`);
  }
  // The 3D library: the catalogue's files only, as `deploy.mjs api-assets` puts them on the server.
  const catalogue = JSON.parse(readFileSync(join(REPO, "packages", "agent", "assets", "catalogue.json"), "utf8"));
  const files = new Set();
  for (const m of catalogue.models) {
    files.add(m.path);
    for (const f of m.deps ?? []) files.add(m.moved?.[f] ?? join(dirname(m.path), f).replaceAll("\\", "/"));
    if (m.preview) files.add(m.preview);
  }
  for (const p of Object.values(catalogue.packs)) for (const f of [p.preview, p.licenseFile]) if (f) files.add(f);
  const assets = join(ROOT, "assets");
  if (!existsSync(join(assets, ".complete"))) {
    const list = [...files].filter((f) => existsSync(join(LIBRARY, f)));
    log(`copying ${list.length} library files (of ${files.size}) from ${LIBRARY}`);
    mkdirSync(assets, { recursive: true });
    writeFileSync(join(ROOT, "assets.txt"), list.join("\n") + "\n");
    sh("sh", ["-c", `tar -cf - -T "${join(ROOT, "assets.txt")}" | tar -xf - -C "${assets}" && chmod -R a+rX "${assets}"`], { cwd: LIBRARY });
    writeFileSync(join(assets, ".complete"), `${list.length}\n`);
  }
  log(`setup done: ${readdirSync(join(ROOT, "fixtures")).join(", ")}; library ${readFileSync(join(assets, ".complete"), "utf8").trim()} files`);
}

// --- phases ---------------------------------------------------------------------------------------------

async function jobstart(n) {
  await upBoth({ probe: true });
  for (const rt of RUNTIMES) resetProject(rt, "j-runner", "runner");
  for (let rep = 1; rep <= n; rep++) {
    for (const rt of order(rep)) {
      const m = new Meter(rt);
      const r = await runJob(rt, { kind: "git", project: "j-runner", args: ["rev-parse", "HEAD"] });
      record("jobstart", { rt, rep, kind: "git", ok: r.code === 0, wallMs: r.wallMs, headersMs: r.headersMs, ...m.stop(), err: r.err });
      let bench = null;
      const m2 = new Meter(rt);
      const r2 = await runJob(rt, { kind: "agent", project: "j-runner", args: ["--edit", "--bench-noop"] }, { onLine: (l) => { if (l.startsWith("@@bench ")) bench = JSON.parse(l.slice(8)); } });
      record("jobstart", { rt, rep, kind: "agent-noop", ok: r2.code === 0 && !!bench, wallMs: r2.wallMs, headersMs: r2.headersMs, firstMs: r2.firstMs, bench, ...m2.stop(), err: r2.err });
    }
    if (rep % 10 === 0) log(`jobstart ${rep}/${n}`);
  }
}

async function coldstart(n) {
  await upBoth({ probe: true });
  for (let rep = 1; rep <= n; rep++) {
    for (const rt of order(rep)) {
      sh("docker", ["stop", "-t", "10", container(rt)]);
      const t0 = performance.now();
      sh("docker", ["start", container(rt)]);
      const started = performance.now() - t0;
      while (!(await health(rt))) {
        if (performance.now() - t0 > 60_000) throw new Error(`${rt} did not answer after a start`);
        await sleep(20);
      }
      const readyMs = performance.now() - t0;
      await sleep(5000);
      record("coldstart", { rt, rep, ok: true, wallMs: readyMs, dockerStartMs: started, idleMb: Math.round(memCurrent(cgroupOf(rt)) / 2 ** 20) });
    }
    log(`coldstart ${rep}/${n}`);
  }
}

async function exportPhase(n) {
  await upBoth({ probe: true });
  for (let rep = 1; rep <= n; rep++) {
    for (const game of ["runner", "match3", "car3d"]) {
      for (const rt of order(rep)) {
        const id = `x-${game}`;
        const dir = resetProject(rt, id, game);
        const m = new Meter(rt);
        const r = await runJob(rt, { kind: "export", project: id });
        const s = m.stop();
        const built = existsSync(join(dir, "export", "web", "index.pck"));
        record("export", { rt, rep, game, ok: r.code === 0 && built, wallMs: r.wallMs, ...s, err: r.err, stderrTail: r.code === 0 ? undefined : r.stderr.slice(-800) });
        log(`export ${game} ${rt} #${rep}: ${fmtMs(r.wallMs)}, ${s.cpuSec} CPU-s, ${s.peakMb} MB${r.code === 0 && built ? "" : ` FAILED ${r.err ?? r.code}`}`);
      }
    }
  }
}

/** Other gVisor settings on the export job: --variants runc,runsc,runsc-<name>… (extra runtimes registered by hand,
 * RESULTS.md) and --thp advise|never, the host's shmem huge-page mode gVisor asks for (put back afterwards). */
async function tune(n) {
  const variants = (opt("variants") || "runc,runsc").split(",");
  const thpFile = "/sys/kernel/mm/transparent_hugepage/shmem_enabled";
  const thpBefore = readFileSync(thpFile, "utf8").match(/\[(\S+)\]/)?.[1] ?? "never";
  const thp = opt("thp", thpBefore);
  writeFileSync(thpFile, thp);
  try {
    for (const rt of variants) {
      await up(rt, { probe: true });
      for (let rep = 1; rep <= n; rep++) {
        for (const game of ["runner", "match3", "car3d"]) {
          const id = `t-${game}`;
          const dir = resetProject(rt, id, game);
          const m = new Meter(rt);
          const r = await runJob(rt, { kind: "export", project: id });
          const s = m.stop();
          const ok = r.code === 0 && existsSync(join(dir, "export", "web", "index.pck"));
          record("tune", { variant: `${rt}, thp ${thp}`, rt, thp, rep, game, ok, wallMs: r.wallMs, ...s, err: r.err });
          log(`tune ${rt} (thp ${thp}) ${game} #${rep}: ${fmtMs(r.wallMs)}, ${s.cpuSec} CPU-s, ${s.peakMb} MB${ok ? "" : " FAILED"}`);
        }
      }
      if (!RUNTIMES.includes(rt)) {
        compose(rt, {}, "down", "--remove-orphans", "-t", "5");
        delete current[rt];
      }
    }
  } finally {
    writeFileSync(thpFile, thpBefore);
  }
}

async function check(n) {
  await upBoth({ probe: true });
  const runs = [];
  for (let rep = 1; rep <= n; rep++) for (const game of ["runner", "match3", "car3d"]) runs.push({ rep, game, pin: true });
  // Like for like: tools/cpu.mjs can't pin (gVisor ignores pinning anyway). --pin-only skips these (the control stacks).
  if (!args.includes("--pin-only")) for (let rep = 1; rep <= Math.max(2, n - 1); rep++) for (const game of ["runner", "car3d"]) runs.push({ rep, game, pin: false });
  for (const t of runs) {
    for (const rt of order(t.rep + (t.pin ? 0 : 1))) {
      const id = `c-${t.game}`;
      resetProject(rt, id, t.game);
      let bench = null;
      const m = new Meter(rt);
      const r = await runJob(rt, { kind: "agent", project: id, args: ["--edit", "--bench-check", ...(t.pin ? [] : ["--no-pin"])] }, {
        onLine: (l) => { if (l.startsWith("@@bench ")) bench = JSON.parse(l.slice(8)); },
      });
      const s = m.stop();
      record("check", { rt, rep: t.rep, game: t.game, pin: t.pin, ok: r.code === 0 && !!bench?.ok, wallMs: r.wallMs, bench, ...s, err: r.err, stderrTail: bench ? undefined : r.stderr.slice(-800) });
      log(`check ${t.game}${t.pin ? "" : " (no pin)"} ${rt} #${t.rep}: ${fmtMs(r.wallMs)} (Godot ${fmtMs(bench?.godotMs ?? 0)}, browser ${fmtMs(bench?.browserMs ?? 0)}, fps ${bench?.fps?.join("/")}), ${s.cpuSec} CPU-s, ${s.peakMb} MB${bench?.ok ? "" : " NOT OK"}`);
    }
  }
}

async function android(n) {
  await upBoth({ probe: true });
  const commit = sh("git", ["-C", join(ROOT, "fixtures", "td"), "rev-parse", "HEAD"]).stdout.trim();
  for (let rep = 1; rep <= n; rep++) {
    for (const format of ["apk", "aab"]) {
      for (const rt of order(rep)) {
        const id = `a-td`;
        const dir = resetProject(rt, id, "td");
        const buildId = `${id}-a${rep}-${format}`;
        const m = new Meter(rt);
        const r = await runJob(rt, {
          kind: "android", project: id,
          args: ["--commit", commit, "--format", format, "--package", "app.typeplay.bench_td", "--version-code", String(rep), "--version-name", `1.${rep}`,
            "--app-name", "Tower Guard", "--orientation", "portrait", "--build-id", buildId, "--icon-kind", "placeholder"],
        });
        const s = m.stop();
        const file = join(dir, "export", "android", `unsigned-${buildId}.${format}`);
        const bytes = existsSync(file) ? statSync(file).size : 0;
        record("android", { rt, rep, format, ok: r.code === 0 && bytes > 1e6, wallMs: r.wallMs, bytes, ...s, err: r.err, stderrTail: r.code === 0 ? undefined : r.stderr.slice(-800) });
        log(`android ${format} ${rt} #${rep}: ${fmtMs(r.wallMs)}, ${(bytes / 1e6).toFixed(1)} MB, ${s.cpuSec} CPU-s, ${s.peakMb} MB${r.code === 0 ? "" : ` FAILED ${r.err ?? r.code}`}`);
      }
    }
  }
}

/** The SDK's own record of a build's sessions: model time vs. everything else, turns, tool calls. */
function agentLog(file) {
  if (!existsSync(file)) return null;
  const out = { sessions: [], tools: {}, checks: 0 };
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line) continue;
    let m;
    try {
      m = JSON.parse(line);
    } catch {
      continue;
    }
    if (m.type === "result") out.sessions.push({ ms: m.duration_ms, apiMs: m.duration_api_ms, turns: m.num_turns, subtype: m.subtype, usd: m.total_cost_usd });
    if (m.type === "assistant") {
      for (const b of m.message?.content ?? []) {
        if (b.type !== "tool_use") continue;
        out.tools[b.name] = (out.tools[b.name] ?? 0) + 1;
        if (b.name === "Bash" && /check\.mjs/.test(b.input?.command ?? "")) out.checks++;
      }
    }
  }
  return out;
}

function writeSecrets() {
  const text = readFileSync(join(MAIN, ".env"), "utf8");
  const key = text.match(/^\s*ANTHROPIC_API_KEY\s*=\s*['"]?([^'"\r\n]+)['"]?\s*$/m)?.[1];
  if (!key || /^sk-ant-oat/i.test(key)) throw new Error("no API key (ANTHROPIC_API_KEY) in the root .env, or it is a Claude login token");
  mkdirSync(dirname(secretsFile), { recursive: true });
  chmodSync(dirname(secretsFile), 0o700);
  writeFileSync(secretsFile, `ANTHROPIC_API_KEY=${key}\n`, { mode: 0o600 });
  log(`API key → ${secretsFile} (${key.length} chars, mode 600; removed when the builds end)`);
}

async function oneBuild(rt, t, pair) {
  const id = `b${pair}-${t.prompt}-${t.model}-${rt}`;
  const { token } = await control(rt, "POST", "/issue", { label: id, family: t.model, minutes: 45 });
  let firstEventMs = null, result = null;
  const progress = [];
  const m = new Meter(rt);
  const r = await runJob(rt, {
    kind: "agent", project: id,
    args: ["--prompt", PROMPTS[t.prompt], "--model", t.model, "--effort", "medium", "--events"],
    env: { AGENT_AUTH: "api", ANTHROPIC_BASE_URL: "http://api:8787", ANTHROPIC_API_KEY: token },
  }, {
    timeoutMs: BUILD_TIMEOUT_MS,
    onLine: (line, at) => {
      if (!line.startsWith("@@event ")) return;
      if (firstEventMs === null) firstEventMs = at;
      try {
        const e = JSON.parse(line.slice(8));
        if (e.type === "result") result = e;
        else if (e.type === "progress") progress.push([Math.round(at / 1000), e.text]);
      } catch {
        // not ours
      }
    },
  });
  const s = m.stop();
  const usage = await control(rt, "POST", "/revoke", { token }).catch(() => null);
  const sdk = agentLog(join(projectDir(rt, id), ".agent-log.jsonl"));
  const apiMs = (sdk?.sessions ?? []).reduce((sum, x) => sum + (x.apiMs ?? 0), 0);
  return {
    rt, rep: t.rep, prompt: t.prompt, model: t.model, pair, cpus: cpusOf(rt), ok: r.code === 0 && !!result?.ok,
    wallMs: r.wallMs, firstEventMs, modelMs: apiMs, localMs: r.wallMs - apiMs,
    minutes: result?.minutes, costUsd: result?.costUsd, chargeUsd: result?.chargeUsd, meteredUsd: usage?.costUsd, requests: usage?.requests,
    steps: result?.steps, genre: result?.genre, attempts: result?.attempts, sdk, ...s, progress: progress.slice(-40),
    err: r.err, stderrTail: r.code === 0 ? undefined : r.stderr.slice(-1500),
  };
}

/** One tiny model call from inside each runner, through its proxy (8 output tokens on Haiku): the whole path
 * (the hosts entry, the proxy, the key, the way out) works before any build is paid for. */
async function preflight() {
  for (const rt of RUNTIMES) {
    await up(rt, { secrets: true });
    const { token } = await control(rt, "POST", "/issue", { label: `preflight-${rt}`, family: "haiku", minutes: 5 });
    const body = JSON.stringify({ model: "claude-haiku-5-5", max_tokens: 8, messages: [{ role: "user", content: "Reply with the word OK." }] });
    const script = `fetch("http://api:8787/v1/messages", { method: "POST", headers: { "content-type": "application/json", "anthropic-version": "2023-06-01", "x-api-key": process.env.T }, body: process.env.B })
      .then(async (r) => console.log(r.status, (await r.text()).slice(0, 160)), (e) => console.log("ERR", e.cause?.code || e.message))`;
    const r = sh("docker", ["exec", "-u", "10006", "-e", `T=${token}`, "-e", `B=${body}`, container(rt), "node", "-e", script], { allowFail: true });
    const usage = await control(rt, "POST", "/revoke", { token }).catch(() => null);
    const out = (r.stdout || r.stderr).trim();
    log(`preflight ${rt}: ${out.slice(0, 120)} (metered $${(usage?.costUsd ?? 0).toFixed(5)})`);
    if (!out.startsWith("200")) throw new Error(`preflight ${rt} failed: the builds would not reach the model`);
  }
}

async function builds(n) {
  writeSecrets();
  await preflight().catch((e) => {
    rmSync(secretsFile, { force: true });
    throw e;
  });
  const list = [];
  for (let rep = 1; rep <= n; rep++) for (const prompt of Object.keys(PROMPTS)) for (const model of Object.keys(MODELS)) list.push({ rep, prompt, model });
  let spent = 0;
  const skip = Number(opt("from", 0));
  try {
    for (const [pair, t] of list.entries()) {
      if (pair < skip) continue;
      for (const rt of RUNTIMES) await up(rt, { secrets: true });
      log(`build pair ${pair + 1}/${list.length}: ${t.prompt}, ${MODELS[t.model]} (${t.model}), rep ${t.rep}`);
      const rows = await Promise.all(RUNTIMES.map((rt) => oneBuild(rt, t, pair)));
      for (const row of rows) {
        record("builds", row);
        spent += row.meteredUsd ?? row.costUsd ?? 0;
        log(`  ${row.rt}: ${row.ok ? "OK" : "FAILED"} ${fmtMs(row.wallMs)} (model ${fmtMs(row.modelMs)}, the rest ${fmtMs(row.localMs)}), first event ${fmtMs(row.firstEventMs ?? 0)}, ` +
          `${row.cpuSec} CPU-s, ${row.peakMb} MB, $${(row.meteredUsd ?? 0).toFixed(3)} metered${row.err ? `, ${row.err}` : ""}`);
      }
      log(`  spent so far $${spent.toFixed(2)} of $${BUDGET_USD}`);
      if (spent > BUDGET_USD) {
        log("budget reached: stopping the builds");
        break;
      }
    }
  } finally {
    rmSync(secretsFile, { force: true });
    // The proxies again without the key.
    for (const rt of RUNTIMES) if (current[rt]) await up(rt, { ...JSON.parse(current[rt]), secrets: false }).catch((e) => log(`${rt}: ${e.message}`));
    log("API key file removed; the proxies run without it");
  }
}

function down() {
  for (const rt of RUNTIMES) compose(rt, {}, "down", "--remove-orphans", "-t", "10");
  rmSync(secretsFile, { force: true });
  log("both stacks down, key file removed");
}

// --- the report -----------------------------------------------------------------------------------------

function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  const n = s.length;
  return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN;
};
/** 95% bootstrap interval of median(b)/median(a) − 1, and a permutation test on the medians (two-sided). */
function compare(a, b, iters = 10_000) {
  const rand = rng(42);
  const pick = (x) => Array.from(x, () => x[Math.floor(rand() * x.length)]);
  const ratios = [];
  for (let i = 0; i < iters; i++) ratios.push(median(pick(b)) / median(pick(a)) - 1);
  ratios.sort((x, y) => x - y);
  const obs = Math.abs(median(b) - median(a));
  const all = [...a, ...b];
  let hits = 0;
  for (let i = 0; i < iters; i++) {
    for (let j = all.length - 1; j > 0; j--) {
      const k = Math.floor(rand() * (j + 1));
      [all[j], all[k]] = [all[k], all[j]];
    }
    if (Math.abs(median(all.slice(a.length)) - median(all.slice(0, a.length))) >= obs - 1e-9) hits++;
  }
  return { change: median(b) / median(a) - 1, lo: ratios[Math.floor(iters * 0.025)], hi: ratios[Math.floor(iters * 0.975)], p: (hits + 1) / (iters + 1) };
}
const pct = (x) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(0)}%`;
function readResults(name) {
  const f = join(ROOT, "results", `${name}.jsonl`);
  return existsSync(f) ? readFileSync(f, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
}

/** The one table: runc (the live server today) against runsc (this branch), the medians every other table details. */
function headline() {
  const rows = [];
  const add = (label, data, filter, value, unit, digits = 1) => {
    const pick = (rt) => data.filter((r) => r.rt === rt && filter(r) && r.ok !== false).map(value).filter((v) => Number.isFinite(v));
    const a = pick("runc"), b = pick("runsc");
    if (!a.length || !b.length) return;
    const c = compare(a, b);
    const f = (v) => `${v.toFixed(digits)} ${unit}`;
    rows.push(`| ${label} | ${f(median(a))} | ${f(median(b))} | **${pct(c.change)}** | ${pct(c.lo)} to ${pct(c.hi)} | ${a.length} + ${b.length} |`);
  };
  const bd = readResults("builds"), ck = readResults("check"), ex = readResults("export"), an = readResults("android");
  const js = readResults("jobstart"), cs = readResults("coldstart");
  for (const [model, name] of Object.entries(MODELS)) {
    add(`${name} build (${model}), what the player waits`, bd, (r) => r.model === model, (r) => r.wallMs / 60_000, "min");
    add(`${name} build, outside model calls`, bd, (r) => r.model === model, (r) => r.localMs / 60_000, "min");
  }
  // 2D and 3D apart: a 3D check is twice as long, and the pin hits its browser hardest.
  add("The agent's check, 2D games, as on the server today", ck, (r) => r.pin && r.game !== "car3d", (r) => r.wallMs / 1000, "s");
  add("The agent's check, 3D game, as on the server today", ck, (r) => r.pin && r.game === "car3d", (r) => r.wallMs / 1000, "s");
  add("The agent's check, 2D, like for like (no pin)", ck, (r) => !r.pin && r.game !== "car3d", (r) => r.wallMs / 1000, "s");
  add("The agent's check, 3D, like for like (no pin)", ck, (r) => !r.pin && r.game === "car3d", (r) => r.wallMs / 1000, "s");
  add("Web export job (3 games)", ex, () => true, (r) => r.wallMs / 1000, "s");
  add("Android APK", an, (r) => r.format === "apk", (r) => r.wallMs / 1000, "s");
  add("Android AAB", an, (r) => r.format === "aab", (r) => r.wallMs / 1000, "s");
  add("A minimal job (git rev-parse)", js, (r) => r.kind === "git", (r) => r.wallMs, "ms", 0);
  add("An empty agent job (node starts and exits)", js, (r) => r.kind === "agent-noop", (r) => r.wallMs, "ms", 0);
  add("Runner start until its socket answers", cs, () => true, (r) => r.wallMs, "ms", 0);
  add("Runner memory when idle", cs, () => true, (r) => r.idleMb, "MB", 0);
  for (const [model, name] of Object.entries(MODELS)) {
    add(`${name} build, CPU seconds`, bd, (r) => r.model === model, (r) => r.cpuSec, "CPU-s", 0);
    add(`${name} build, peak memory`, bd, (r) => r.model === model, (r) => r.peakMb, "MB", 0);
  }
  // The same with the pin bug fixed on runc (stack runc-nopin; checks: the check phase's no-pin rounds).
  const fixed = [];
  const addFixed = (label, data, filter, value, unit, a0, b0, digits = 1) => {
    const pick = (rt) => data.filter((r) => r.rt === rt && filter(r) && r.ok !== false).map(value).filter((v) => Number.isFinite(v));
    const a = pick(a0), b = pick(b0);
    if (!a.length || !b.length) return;
    const c = compare(a, b);
    const f = (v) => `${v.toFixed(digits)} ${unit}`;
    fixed.push(`| ${label} | ${f(median(a))} | ${f(median(b))} | **${pct(c.change)}** | ${pct(c.lo)} to ${pct(c.hi)} | ${a.length} + ${b.length} |`);
  };
  for (const [model, name] of Object.entries(MODELS)) {
    addFixed(`${name} build, what the player waits`, bd, (r) => r.model === model, (r) => r.wallMs / 60_000, "min", "runc-nopin", "runsc");
    addFixed(`${name} build, outside model calls`, bd, (r) => r.model === model, (r) => r.localMs / 60_000, "min", "runc-nopin", "runsc");
    for (const p of Object.keys(PROMPTS)) addFixed(`${name}: ${p}`, bd, (r) => r.model === model && r.prompt === p, (r) => r.wallMs / 60_000, "min", "runc-nopin", "runsc");
  }
  return ["| | without gVisor (runc, as live) | with gVisor (this branch) | change | 95% interval | runs |", "|---|---|---|---|---|---|", ...rows].join("\n") +
    (fixed.length ? "\n\n### If the pin bug were fixed: runc without the pin against gVisor\n\n" +
      ["| | runc, no pin | with gVisor | change | 95% interval | runs |", "|---|---|---|---|---|---|", ...fixed].join("\n") : "");
}

function report() {
  const lines = [];
  // runc (the live server today) against each other stack: runsc first (this branch), then the controls.
  const table = (title, rows, groups, value, unit, fmt = (v) => v.toFixed(unit === "s" ? 1 : 0)) => {
    lines.push(`\n### ${title}\n`, `| | n | runc median (min-max) | other median (min-max) | change | 95% interval of the change | p |`, "|---|---|---|---|---|---|---|");
    for (const [label, filter] of groups) {
      const pick = (rt) => rows.filter((r) => r.rt === rt && filter(r) && r.ok !== false).map(value).filter((v) => Number.isFinite(v));
      const a = pick("runc");
      for (const other of ["runsc", "runc-tuned", "runsc-plain", "runc-nopin"]) {
        const b = pick(other);
        if (!a.length || !b.length) continue;
        const c = compare(a, b);
        const span = (x) => `${fmt(median(x))} (${fmt(Math.min(...x))}-${fmt(Math.max(...x))}) ${unit}`;
        lines.push(`| ${label}${other === "runsc" ? "" : `, **${other}**`} | ${a.length} + ${b.length} | ${span(a)} | ${span(b)} | **${pct(c.change)}** | ${pct(c.lo)} to ${pct(c.hi)} | ${c.p.toFixed(3)} |`);
      }
    }
  };
  const fails = (rows) => {
    const bad = rows.filter((r) => r.ok === false);
    return bad.length ? `\nNot OK: ${bad.map((r) => `${r.rt} ${r.game ?? r.format ?? r.prompt ?? r.kind} #${r.rep}${r.err ? ` (${r.err})` : ""}`).join("; ")}\n` : "";
  };
  const js = readResults("jobstart");
  table("A job's own cost (the runner: home, chown, spawn, clean-up)", js, [["git rev-parse (round trip)", (r) => r.kind === "git"], ["empty agent job (node starts and exits)", (r) => r.kind === "agent-noop"]], (r) => r.wallMs, "ms");
  const cs = readResults("coldstart");
  table("Container start until the runner's socket answers", cs, [["start → /health", () => true]], (r) => r.wallMs, "ms");
  table("Idle memory of the runner container after a start", cs, [["memory.current, 5 s after", () => true]], (r) => r.idleMb, "MB");
  const ex = readResults("export");
  const games = [["runner (2D)", (r) => r.game === "runner"], ["match3 (2D)", (r) => r.game === "match3"], ["car3d (3D)", (r) => r.game === "car3d"]];
  table("Web export job (Godot import + export), wall time", ex, games, (r) => r.wallMs / 1000, "s");
  table("Web export job, CPU seconds (whole container)", ex, games, (r) => r.cpuSec, "s");
  table("Web export job, peak memory", ex, games, (r) => r.peakMb, "MB");
  lines.push(fails(ex));
  const tu = readResults("tune");
  if (tu.length) {
    lines.push("\n### gVisor settings tried on the web export job (median wall time per game; CPU seconds, all games)\n", "| variant | n | runner | match3 | car3d | CPU-s |", "|---|---|---|---|---|---|");
    for (const v of [...new Set(tu.map((r) => r.variant))]) {
      const rows = tu.filter((r) => r.variant === v && r.ok);
      const med = (g) => `${median(rows.filter((r) => r.game === g).map((r) => r.wallMs / 1000)).toFixed(1)} s`;
      lines.push(`| ${v} | ${rows.length} | ${med("runner")} | ${med("match3")} | ${med("car3d")} | ${median(rows.map((r) => r.cpuSec)).toFixed(1)} |`);
    }
    lines.push(fails(tu));
  }
  const ck = readResults("check");
  const pinned = (g) => (r) => r.game === g && r.pin;
  const free = (g) => (r) => r.game === g && !r.pin;
  const ckGroups = [["runner, as on the server", pinned("runner")], ["match3, as on the server", pinned("match3")], ["car3d, as on the server", pinned("car3d")], ["runner, no pin", free("runner")], ["car3d, no pin", free("car3d")]];
  table("The agent's check, wall time", ck, ckGroups, (r) => r.wallMs / 1000, "s");
  table("The check's Godot runs (import, run, tests, export)", ck, ckGroups, (r) => r.bench?.godotMs / 1000, "s");
  table("The check's hidden browser (and node), the rest of the check", ck, ckGroups, (r) => r.bench?.browserMs / 1000, "s");
  table("Browser frames a second while playing (software WebGL)", ck, ckGroups, (r) => r.bench?.fps?.[0], "fps");
  table("The check, CPU seconds", ck, ckGroups, (r) => r.cpuSec, "s");
  table("The check, peak memory", ck, ckGroups, (r) => r.peakMb, "MB");
  lines.push(fails(ck));
  const an = readResults("android");
  const formats = [["APK", (r) => r.format === "apk"], ["AAB (Gradle)", (r) => r.format === "aab"]];
  table("Android export job (unsigned), wall time", an, formats, (r) => r.wallMs / 1000, "s");
  table("Android export job, CPU seconds", an, formats, (r) => r.cpuSec, "s");
  table("Android export job, peak memory", an, formats, (r) => r.peakMb, "MB");
  lines.push(fails(an));
  const bd = readResults("builds");
  const bGroups = [];
  for (const model of Object.keys(MODELS)) {
    bGroups.push([`${MODELS[model]} (${model}), all prompts`, (r) => r.model === model]);
    for (const p of Object.keys(PROMPTS)) bGroups.push([`${MODELS[model]}: ${p}`, (r) => r.model === model && r.prompt === p]);
  }
  table("Real builds, wall time (what the player waits)", bd, bGroups, (r) => r.wallMs / 60_000, "min", (v) => v.toFixed(1));
  table("Real builds, time outside model calls (tools, Godot, checks, Claude Code itself)", bd, bGroups, (r) => r.localMs / 60_000, "min", (v) => v.toFixed(1));
  table("Real builds, time in model calls (the SDK's duration_api_ms)", bd, bGroups, (r) => r.modelMs / 60_000, "min", (v) => v.toFixed(1));
  table("Real builds, time to the first progress event", bd, bGroups, (r) => r.firstEventMs / 1000, "s");
  table("Real builds, CPU seconds", bd, bGroups, (r) => r.cpuSec, "s");
  table("Real builds, peak memory", bd, bGroups, (r) => r.peakMb, "MB");
  // Paired: the two runtimes built the same prompt on the same model at the same moment.
  const pairs = {};
  for (const r of bd) (pairs[r.pair] ??= {})[r.rt] = r;
  const paired = Object.values(pairs).filter((p) => p.runc && p.runsc);
  if (paired.length) {
    lines.push("\n### Real builds, pair by pair (same prompt, same model, started together)\n", "| pair | prompt | model | runc | runsc | change | runc rest | runsc rest | both OK |", "|---|---|---|---|---|---|---|---|---|");
    for (const p of paired) {
      lines.push(`| ${p.runc.pair + 1} | ${p.runc.prompt} | ${MODELS[p.runc.model]} | ${(p.runc.wallMs / 60000).toFixed(1)} min | ${(p.runsc.wallMs / 60000).toFixed(1)} min | ${pct(p.runsc.wallMs / p.runc.wallMs - 1)} | ` +
        `${(p.runc.localMs / 60000).toFixed(1)} | ${(p.runsc.localMs / 60000).toFixed(1)} | ${p.runc.ok && p.runsc.ok ? "yes" : `runc ${p.runc.ok ? "OK" : "FAILED"}, runsc ${p.runsc.ok ? "OK" : "FAILED"}`} |`);
    }
    const ratios = (model) => paired.filter((p) => p.runc.model === model && p.runc.ok && p.runsc.ok).map((p) => p.runsc.wallMs / p.runc.wallMs - 1);
    for (const model of Object.keys(MODELS)) {
      const r = ratios(model);
      if (r.length) lines.push(`\n${MODELS[model]}: median pair change ${pct(median(r))} over ${r.length} pairs (runsc slower in ${r.filter((x) => x > 0).length}, faster in ${r.filter((x) => x < 0).length})`);
    }
    const usd = bd.reduce((s, r) => s + (r.meteredUsd ?? 0), 0);
    lines.push(`\nModel spend of the trial builds (metered by the proxy): $${usd.toFixed(2)} for ${bd.length} builds.`);
  }
  lines.push(fails(bd));
  const text = `# gVisor trial: measured ${new Date().toISOString().slice(0, 10)}\n\nchange = runsc median / runc median − 1. The 95% interval (bootstrap of the medians) and p (permutation test on the medians) say how much of the change could be noise: an interval that spans 0 means the runs can't tell the two apart.\n\n## In one table\n\n${headline()}\n\n## Every measurement\n${lines.join("\n")}\n`;
  writeFileSync(join(ROOT, "results", "RESULTS.md"), text);
  console.log(text);
}

// --- main -----------------------------------------------------------------------------------------------

if (process.getuid?.() !== 0) throw new Error("run as root in WSL (it reads cgroups and the runner's socket)");
capCpus();
const n = Number(opt("n", 0)) || undefined;
const phases = {
  setup, report, down,
  up: () => upBoth({ probe: args.includes("--probe") }),
  jobstart: () => jobstart(n ?? 30),
  coldstart: () => coldstart(n ?? 8),
  export: () => exportPhase(n ?? 5),
  tune: () => tune(n ?? 3),
  check: () => check(n ?? 4),
  android: () => android(n ?? 4),
  builds: () => builds(n ?? 3),
};
if (!phases[phase]) {
  console.log("usage: node bench.mjs setup|up|jobstart|coldstart|export|check|android|builds|report|down [--n N]");
  process.exit(2);
}
await phases[phase]();
