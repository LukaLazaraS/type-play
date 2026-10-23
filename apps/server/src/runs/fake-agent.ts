// AGENT_FAKE=1: a simulated run for site development and tests, so nobody burns the agent.
// A few progress lines over ~5 s, then success with an existing demo build's pack, reported like a
// two-step build whose second step was rolled back: $0.14 of work in all (costUsd, our accounting),
// $0.10 in the game the player gets (chargeUsd, what they pay: 1.7 credits). A prompt containing
// "FAIL" fails. It makes a real git commit, like the agent would.
import { appendFileSync, copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { config, ROOT } from "../env.js";
import { git } from "../games/git.js";
import type { AgentHandle, AgentJob, AgentResult } from "./agent.js";

const LINES = ["Reading your idea", "Writing the player", "Building the level", "Testing the game", "Making it look nice"];

/** The pack every fake build plays: the robot runner demo if present, else any demo build. */
function demoPack(): string | null {
  const builds = config.gamesBuildsDir;
  const preferred = join(builds, "robot-runner", "index.pck");
  if (existsSync(preferred)) return preferred;
  if (!existsSync(builds)) return null;
  for (const id of readdirSync(builds)) if (existsSync(join(builds, id, "index.pck"))) return join(builds, id, "index.pck");
  return null;
}

/** A stand-in for the check's start-screen picture: the dusk desert, drawn flat (360×640 PNG). */
export function fakePoster(): Buffer {
  const w = 360;
  const h = 640;
  const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const sky = ["#1c1240", "#2a1858", "#3d206b", "#572877", "#6a2c7a"].map(hex);
  const [sun, dune, near, sand] = ["#ffb347", "#a63e68", "#d9645a", "#f3a35c"].map(hex);
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0; // filter: none
    for (let x = 0; x < w; x++) {
      const wave = (a: number, f: number, p: number) => a * Math.sin((x / w) * Math.PI * f + p);
      let c = sky[Math.min(4, Math.floor((y / (h * 0.62)) * 5))];
      if ((x - 250) ** 2 + (y - 330) ** 2 < 46 ** 2) c = sun;
      if (y > 400 + wave(18, 2, 0.5)) c = dune;
      if (y > 470 + wave(14, 3, 2)) c = near;
      if (y > 540 + wave(8, 2, 1)) c = sand;
      raw.set(c, y * (w * 3 + 1) + 1 + x * 3);
    }
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    let c = 0xffffffff;
    for (const b of body) {
      c ^= b;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE((c ^ 0xffffffff) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

async function fakeWork(job: AgentJob) {
  const commitAll = async (msg: string) => {
    await git(job.dir, "add", "-A");
    await git(job.dir, "commit", "-qm", msg.slice(0, 72));
  };
  if (job.kind === "new") {
    cpSync(join(ROOT, "packages/agent/templates/blank"), job.dir, { recursive: true });
    appendFileSync(join(job.dir, ".gitignore"), ".godot/\nexport/\n.agent-log.jsonl\n");
    await git(job.dir, "init", "-q");
    await commitAll("template");
  }
  appendFileSync(join(job.dir, "FAKE.md"), `- ${job.kind}: ${job.prompt}\n`);
  await commitAll(`${job.kind}: ${job.prompt}`);
  const pack = demoPack();
  if (!pack) throw new Error("no demo build to fake with (run apps/games/scripts/build-demo.mjs)");
  mkdirSync(join(job.dir, "export/web"), { recursive: true });
  copyFileSync(pack, join(job.dir, "export/web/index.pck"));
  // NOPOSTER: a picture that isn't a PNG, so the build publishes without a poster.
  writeFileSync(join(job.dir, "export/screenshot-start.png"), job.prompt.includes("NOPOSTER") ? "not a picture" : fakePoster());
  writeFileSync(join(job.dir, "export/.gdignore"), "");
}

/** A failing change leaves the folder as a real failed run would: a commit of a half-done change and
 * an untracked file. The server's reset must take both away. */
async function fakeMess(job: AgentJob) {
  if (!existsSync(join(job.dir, ".git"))) return;
  appendFileSync(join(job.dir, "FAKE.md"), `- ${job.kind} (failed): ${job.prompt}\n`);
  await git(job.dir, "add", "-A");
  await git(job.dir, "commit", "-qm", "half-done change");
  writeFileSync(join(job.dir, "junk.txt"), "left behind by a failed run\n");
}

/**
 * Tests only (FAKE_METER=1, env.ts): a prompt with "METER:<n>" makes one Haiku call through the key proxy at once, whose
 * mock answer reports <n> output tokens, so the e2e can check what the live server meters (a Stop included).
 */
function fakeModelCall(job: AgentJob): Promise<void> {
  const tokens = Number(/METER:(\d+)/.exec(job.prompt)?.[1] ?? 0);
  if (!job.auth || !tokens) return Promise.resolve();
  return fetch(`${job.auth.baseUrl}/v1/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": job.auth.token, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-haiku-5-5", max_tokens: tokens, messages: [{ role: "user", content: "fake" }] }),
  })
    .then((r) => r.text())
    .then(
      () => undefined,
      () => undefined,
    );
}

export function runFakeAgent(job: AgentJob): AgentHandle {
  const timers: NodeJS.Timeout[] = [];
  let started = false;
  let killed = false;
  let resolveDone: (r: AgentResult) => void = () => {};
  const done = new Promise<AgentResult>((resolve) => (resolveDone = resolve));
  // The run ends only once its model call is answered, as a real agent's last call is before it stops.
  const called = fakeModelCall(job);
  const finish = (r: AgentResult) => void called.then(() => resolveDone(r));
  LINES.forEach((text, i) => timers.push(setTimeout(() => job.onProgress(text), 300 + i * 1000)));
  timers.push(
    setTimeout(async () => {
      if (killed) return;
      started = true;
      if (job.prompt.includes("FAIL")) {
        await fakeMess(job).catch(() => {});
        return finish({ ok: false, costUsd: 0.02, messageCostUsd: 0, chargeUsd: 0 });
      }
      try {
        await fakeWork(job);
        finish({
          ok: true,
          playerMessage:
            job.kind === "new"
              ? "Your game is ready! Tap or press Space to play. (This is a test build.)"
              : "Done! Your change is in. (This is a test build.)",
          costUsd: 0.14,
          messageCostUsd: 0,
          chargeUsd: 0.1,
        });
      } catch (e) {
        finish({ ok: false, costUsd: 0, messageCostUsd: 0, chargeUsd: 0, error: (e as Error).message });
      }
    }, 5300),
  );
  return {
    done,
    // Once the files are being written, let that finish; the server then rolls it back.
    kill: () => {
      killed = true;
      timers.forEach(clearTimeout);
      if (!started) finish({ ok: false, costUsd: 0, messageCostUsd: 0, chargeUsd: 0, error: "cancelled" });
    },
  };
}
