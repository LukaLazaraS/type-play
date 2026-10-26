// The trial's probe AGENT_SCRIPT (bench.mjs `noop` and `check`). The runner starts it exactly as it starts
// run.mjs: as the job's throwaway user, with the job's environment, under prlimit, with `--dir <game>` and
// the job's flags (`--edit` keeps the fixture game in place), plus one of:
//   --bench-noop              exit at once: what a job costs by itself (home, chown, spawn, node, clean-up)
//   --bench-check [--no-pin]  the agent's check (packages/agent/tools/check.mjs: import, a headless run, the
//                             game's tests, the web export, the hidden browser), with every Godot run timed by a
//                             shim in front of Godot. --no-pin puts a do-nothing `taskset` first on PATH, so
//                             tools/cpu.mjs can't pin the check to one core (see RESULTS.md, "the pin")
// Prints one line: @@bench {json}.
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);
const dir = args[args.indexOf("--dir") + 1];
const out = (o) => console.log("@@bench " + JSON.stringify(o));
const cpus = () => readFileSync("/proc/self/status", "utf8").match(/^Cpus_allowed_list:\s*(.*)$/m)?.[1] ?? "?";

if (args.includes("--bench-noop")) {
  out({ kind: "noop", parallelism: availableParallelism(), cpus: cpus(), tunables: process.env.GLIBC_TUNABLES ?? null });
  process.exit(0);
}
if (!args.includes("--bench-check")) {
  console.error("probe: say --bench-noop or --bench-check");
  process.exit(2);
}

const noPin = args.includes("--no-pin");
const tmp = mkdtempSync(join(process.env.TMPDIR || "/tmp", "bench-"));
const godotLog = join(tmp, "godot.log");
const shim = join(tmp, "godot");
writeFileSync(shim, `#!/bin/sh\nt0=$(date +%s%N)\n"${process.env.GODOT_EXE}" "$@"\nrc=$?\nt1=$(date +%s%N)\necho "$t0 $t1 $rc $*" >> "${godotLog}"\nexit $rc\n`);
chmodSync(shim, 0o755);
if (noPin) {
  writeFileSync(join(tmp, "taskset"), "#!/bin/sh\nexit 0\n");
  chmodSync(join(tmp, "taskset"), 0o755);
}
const env = { ...process.env, GODOT_EXE: shim, PATH: noPin ? `${tmp}:${process.env.PATH}` : process.env.PATH };
const t0 = process.hrtime.bigint();
const r = spawnSync(process.execPath, ["/app/packages/agent/tools/check.mjs"], { cwd: dir, env, encoding: "utf8", maxBuffer: 64 << 20 });
const totalMs = Number(process.hrtime.bigint() - t0) / 1e6;

const stages = { import: 0, run: 0, tests: 0, export: 0, other: 0 };
const runs = [];
for (const line of existsSync(godotLog) ? readFileSync(godotLog, "utf8").trim().split("\n") : []) {
  const [a, b, rc, ...rest] = line.split(" ");
  const what = rest.join(" ");
  const ms = (Number(b) - Number(a)) / 1e6;
  const stage = /--import/.test(what) ? "import" : /--quit-after 300\b/.test(what) ? "run" : /res:\/\/test\//.test(what) ? "tests" : /--export-release/.test(what) ? "export" : "other";
  stages[stage] += ms;
  runs.push({ stage, ms: Math.round(ms), rc: Number(rc) });
}
const godotMs = Object.values(stages).reduce((s, v) => s + v, 0);
const stdout = r.stdout || "";
const fps = stdout.match(/frames a second while playing[^:]*: (.*)$/m)?.[1]?.split(", then ").map((f) => (f === "froze" ? null : Number(f))) ?? [];
out({
  kind: "check",
  noPin,
  ok: /^CHECK: OK/m.test(stdout),
  exit: r.status,
  totalMs: Math.round(totalMs),
  godotMs: Math.round(godotMs),
  // The rest of the check: node, the hidden browser (start, the game's load, the 6 + 3 + 10 s of play the
  // check waits for, three screenshots) and the file server.
  browserMs: Math.round(totalMs - godotMs),
  stages: Object.fromEntries(Object.entries(stages).map(([k, v]) => [k, Math.round(v)])),
  runs,
  fps,
  parallelism: availableParallelism(),
  cpus: cpus(),
  errors: (stdout.match(/^CHECK: FAIL[\s\S]*?(?=^orientation:)/m)?.[0] ?? "").slice(0, 1500),
});
