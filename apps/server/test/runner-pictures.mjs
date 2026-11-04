// The live server's path for a run's pictures (2026-11-04), tried as root on Linux, as the runner only runs there: the
// runner copies an agent job's pictures from <DATA_DIR>/attachments (the API's, 0700) into the job's home (refs/, 0700,
// files 0600, the job's own user's), passes run.mjs --images, keeps the API's folder shut to the job, refuses --images
// from the API, a bad id and an 11th picture, leaves out a picture whose files are missing, and wipes the home after the
// job. Everything happens in /tmp/rt (deleted first); a fake run.mjs reports what it got. In WSL, with a Linux Node
// (e.g. the official tarball unpacked into /tmp/node-test):
//   MSYS_NO_PATHCONV=1 wsl -u root -- env -i PATH=/tmp/node-test/bin:/usr/bin:/bin /tmp/node-test/bin/node //     /mnt/c/<checkout>/apps/server/test/runner-pictures.mjs
// Passed 2026-11-04 (15 checks). Not part of npm run test:e2e (it needs root on Linux).
import { spawn } from "node:child_process";
import { chmodSync, chownSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { request } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const runnerPath = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), "../runner/runner.mjs");
const T = "/tmp/rt";
rmSync(T, { recursive: true, force: true });
mkdirSync(T, { recursive: true });
chmodSync(T, 0o755);
const DATA = join(T, "data");
const SOCKET = join(T, "sock", "runner.sock");
const HOMES = join(T, "homes");
let failures = 0;
const ok = (c, what) => {
  console.log(`${c ? "  ok  " : "  FAIL"} ${what}`);
  if (!c) failures++;
};

// The API's picture files (uid 1000, 0700 folders, 0600 files), as store.ts writes them.
const id = "ab" + "c".repeat(22);
const shard = join(DATA, "attachments", "ab");
mkdirSync(shard, { recursive: true });
writeFileSync(join(shard, `${id}.png`), Buffer.from("89504e470d0a1a0a" + "00".repeat(64), "hex"), { mode: 0o600 });
writeFileSync(join(shard, `${id}.view.webp`), Buffer.from("RIFF0000WEBPVP8 tiny view"), { mode: 0o600 });
for (const p of [join(DATA, "attachments"), shard]) { chownSync(p, 1000, 1000); chmodSync(p, 0o700); }
for (const f of [`${id}.png`, `${id}.view.webp`]) chownSync(join(shard, f), 1000, 1000);

// The fake run.mjs: says who it is, what --images holds (modes, owners), and whether it can enter the API's folder.
const fake = join(T, "fake-run.mjs");
writeFileSync(
  fake,
  `import { readdirSync, statSync, readFileSync } from "node:fs";
const a = process.argv.slice(2);
const at = a.indexOf("--images");
const dir = at >= 0 ? a[at + 1] : null;
const files = dir ? readdirSync(dir).map((f) => { const s = statSync(dir + "/" + f); return { f, mode: (s.mode & 0o777).toString(8), uid: s.uid, bytes: readFileSync(dir + "/" + f).length }; }) : [];
let api = "readable";
try { readdirSync("${DATA}/attachments"); } catch (e) { api = e.code; }
const dirMode = dir ? (statSync(dir).mode & 0o777).toString(8) : null;
console.log(JSON.stringify({ uid: process.getuid(), args: a, dir, dirMode, files, api }));
`,
  { mode: 0o644 },
);

const env = { PATH: process.env.PATH, DATA_DIR: DATA, RUNNER_SOCKET: SOCKET, RUNNER_HOMES: HOMES, AGENT_SCRIPT: fake, RUNNER_SLOTS: "2", API_UID: "1000", API_GID: "1000", GODOT_TEMPLATES: T };
const runner = spawn(process.execPath, [runnerPath], { env, stdio: ["ignore", "pipe", "pipe"] });
let log = "";
runner.stdout.on("data", (d) => (log += d));
runner.stderr.on("data", (d) => (log += d));
for (let i = 0; i < 50 && !existsSync(SOCKET); i++) await new Promise((r) => setTimeout(r, 100));
ok(existsSync(SOCKET), "the runner is up");

const job = (body) =>
  new Promise((resolve) => {
    const data = JSON.stringify(body);
    const req = request({ socketPath: SOCKET, path: "/jobs", method: "POST", headers: { "content-type": "application/json", "content-length": Buffer.byteLength(data) } }, (res) => {
      let out = "";
      res.on("data", (c) => (out += c));
      res.on("end", () => resolve({ status: res.statusCode, out }));
    });
    req.on("error", (e) => resolve({ status: 0, out: e.message }));
    req.end(data);
  });

const r = await job({ kind: "agent", project: "proj1", args: ["--prompt", "a robot like my picture", "--model", "haiku"], images: [{ id, format: "png" }] });
const line = r.out.split("\n").map((l) => { try { return JSON.parse(l); } catch { return null; } }).find((m) => typeof m?.o === "string" && m.o.startsWith("{"));
const seen = line ? JSON.parse(line.o) : null;
ok(r.status === 200 && seen, `the job ran (${r.status})`);
ok(seen?.uid >= 10001, `as the slot's own user (uid ${seen?.uid})`);
ok(seen?.dir === join(HOMES, "slot1", "refs") || seen?.dir === join(HOMES, "slot2", "refs"), `run.mjs got --images <home>/refs (${seen?.dir})`);
ok(seen?.dirMode === "700", `the folder is the job's alone (${seen?.dirMode})`);
ok(seen?.files.map((f) => f.f).sort().join() === "1.png,1.view.webp", `it holds 1.png and 1.view.webp (${seen?.files.map((f) => f.f).join(", ")})`);
ok(seen?.files.every((f) => f.mode === "600" && f.uid === seen.uid), "each file the job user's, 0600");
ok(seen?.files.find((f) => f.f === "1.png")?.bytes === 72, "the picture byte for byte");
ok(seen?.api === "EACCES", `the API's picture folder stays shut to the job (${seen?.api})`);
ok(seen && !seen.args.includes("a robot like my picture") && seen.args.includes("--prompt-file"), "the prompt came in its file, not in argv");
ok(!existsSync(join(HOMES, "slot1")) && !existsSync(join(HOMES, "slot2")), "after the job the home (and its pictures) is gone");

const sneaky = await job({ kind: "agent", project: "proj2", args: ["--images", "/tmp/rt/data/attachments", "--prompt", "x"] });
ok(sneaky.status === 400 && /the runner sets the pictures/.test(sneaky.out), `--images from the API: refused (${sneaky.status} ${sneaky.out.trim()})`);
const bad = await job({ kind: "agent", project: "proj3", args: ["--prompt", "x"], images: [{ id: "../../etc/passwd", format: "png" }] });
ok(bad.status === 400 && /bad image/.test(bad.out), `a bad picture id: refused (${bad.status} ${bad.out.trim()})`);
const many = await job({ kind: "agent", project: "proj4", args: ["--prompt", "x"], images: Array.from({ length: 11 }, () => ({ id, format: "png" })) });
ok(many.status === 400 && /bad images/.test(many.out), `11 pictures: refused (${many.status})`);
const missing = await job({ kind: "agent", project: "proj5", args: ["--prompt", "x"], images: [{ id: "zz" + "z".repeat(22), format: "png" }] });
const missingSeen = missing.out.split("\n").map((l) => { try { return JSON.parse(l); } catch { return null; } }).find((m) => typeof m?.o === "string" && m.o.startsWith("{"));
ok(missing.status === 200 && missingSeen && JSON.parse(missingSeen.o).dir === null && /left out/.test(log), "a picture whose files are missing: left out (logged), the build goes on without --images");

runner.kill("SIGTERM");
await new Promise((r) => setTimeout(r, 300));
console.log(failures ? `\n${failures} FAILED\n${log.slice(-1500)}` : "\nall passed");
process.exit(failures ? 1 : 0);
