// `admin gallery pitch [--write]` (src/admin.ts, 2026-11-20): the games in the gallery from before games had a public
// line get one, once. Each from its own folder: NOTES.md, GENRE and project.godot, read as text the safe way
// (games/files.ts: plain files inside the folder, never a link; nothing in the folder is ever run), through the call
// every build makes (packages/agent/tools/pitch.mjs: Haiku at low effort, one turn, no tools, never the prompt). A dry run
// unless --write; it writes the database only (the folder's PITCH comes with the game's next build, which keeps or
// rewrites the line). Prints each game's line, what its call cost, and the total.
// The six showcase games have no player folder: their lines are in showcase.ts, set by `gallery showcase`.
// Where it runs: the players' folders (real users' data) are on the live server only, never copied to this PC
// (docs/environments.md), so on the live database it runs there, in the api container (apps/server/README.md "The game's
// public line"), whose AGENT_AUTH=api makes the call on our API key. Anywhere else (this PC's test databases) the call
// uses the Claude Code login, the root .env's API key kept out of it. `admin:live` from this PC refuses it.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { LedgerService } from "../credits/ledger.service.js";
import { config, ENV_MODE, ROOT } from "../env.js";
import { readGameFile, readProjectGodot } from "../games/files.js";
import { gameNameOf } from "../games/godot.js";
import type { PrismaClient } from "../generated/prisma/client.js";
import { genreOf } from "./gallery.service.js";
import { SHOWCASE_OWNER } from "./showcase.js";

type PitchResult = { pitch: string; action: string; why: string; answer: string; costUsd: number; calls: number; seconds: number };
type PitchTool = {
  pitchFor(a: { name: string; genre: string; notes: string; current: string; options: Record<string, unknown> }): Promise<PitchResult>;
  PITCH_OPTIONS: Record<string, unknown>;
};

/** What the call's Claude Code process gets: the system's own variables, none of our secrets; on api, our key. */
const KEEP = /^(PATH|PATHEXT|HOME|USER|USERNAME|USERPROFILE|HOMEDRIVE|HOMEPATH|APPDATA|LOCALAPPDATA|PROGRAMDATA|PROGRAMFILES|PROGRAMFILES\(X86\)|COMMONPROGRAMFILES|SYSTEMROOT|SYSTEMDRIVE|WINDIR|COMSPEC|OS|PROCESSOR_ARCHITECTURE|NUMBER_OF_PROCESSORS|TEMP|TMP|TMPDIR|LANG|LC_ALL|TZ|TERM|NODE_EXTRA_CA_CERTS|SSL_CERT_FILE|CLAUDE_CONFIG_DIR)$/i;
function callEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined && KEEP.test(k)) env[k] = v;
  if (config.agentAuth === "api") {
    if (!config.anthropicApiKey) throw new Error("AGENT_AUTH=api but no ANTHROPIC_API_KEY in this environment");
    env.ANTHROPIC_API_KEY = config.anthropicApiKey;
    env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = "1";
  }
  return env;
}

/** NOTES.md as the build's call reads it (its first 60 lines), from a plain file inside the folder; "" otherwise. */
function notesIn(dir: string): string {
  try {
    return readGameFile(dir, "NOTES.md", 256 << 10).toString("utf8");
  } catch {
    return "";
  }
}

export async function pitchBackfill(prisma: PrismaClient, ledger: LedgerService, args: string[], actor: string): Promise<void> {
  if (ENV_MODE === "live") {
    throw new Error(
      "the players' game folders are on the live server only: run it there, in the api container (apps/server/README.md \"The game's public line\")",
    );
  }
  const write = args.includes("--write");
  const tool = (await import(pathToFileURL(join(ROOT, "packages/agent/tools/pitch.mjs")).href)) as PitchTool;
  // In the gallery now (gallery.service IN_GALLERY), not ours (the showcase's lines are in showcase.ts), no line yet.
  const games = await prisma.project.findMany({
    where: { listed: true, shared: true, hiddenAt: null, listedAt: { not: null }, currentVersion: { not: null }, pitch: null, ownerId: { not: SHOWCASE_OWNER.id } },
    select: { id: true, name: true },
    orderBy: { listedAt: "asc" },
  });
  console.log(`${games.length} game(s) in the gallery without a line; ${write ? "writing" : "a dry run (--write writes)"}; the call on ${config.agentAuth === "api" ? "our API key" : "this PC's Claude Code login"}`);
  // The call's process starts in an empty folder of its own: never in a game folder, never in the repo.
  const options = { ...tool.PITCH_OPTIONS, env: callEnv(), cwd: mkdtempSync(join(tmpdir(), "typeplay-pitch-")) };
  let total = 0;
  let written = 0;
  const lines: { id: string; action: string; costUsd: number }[] = [];
  for (const g of games) {
    const dir = join(config.dataDir, "projects", g.id);
    let name = "";
    try {
      name = gameNameOf(readProjectGodot(dir)) ?? "";
    } catch {
      // no project.godot: the call goes without a name
    }
    const r = await tool.pitchFor({ name, genre: genreOf(g.id) ?? "", notes: notesIn(dir), current: "", options });
    total += r.costUsd;
    lines.push({ id: g.id, action: r.action, costUsd: +r.costUsd.toFixed(5) });
    let note = "";
    if (r.pitch && write) {
      // Raw SQL, so updatedAt stays (it orders the owner's list by builds and messages); a line set meanwhile wins.
      const n = await prisma.$executeRaw`UPDATE "Project" SET pitch = ${r.pitch} WHERE id = ${g.id} AND pitch IS NULL`;
      written += n;
      note = n ? ", written" : ", not written (it got a line meanwhile)";
    }
    const said = r.pitch ? `"${r.pitch}" (${[...r.pitch].length} letters)` : `no line (${r.why || r.action})`;
    console.log(`${g.id}  "${g.name.slice(0, 60)}": ${r.action}, $${r.costUsd.toFixed(5)} in ${r.calls} call(s), ${r.seconds} s${note}\n    ${said}`);
  }
  console.log(`${games.length} game(s), ${lines.filter((l) => l.action === "new").length} line(s) made, ${written} written; $${total.toFixed(4)} in all${config.agentAuth === "api" ? " (billed to our API key)" : " (API-equivalent; this PC's login)"}`);
  await ledger.audit(prisma, { actor, userId: null, action: "gallery_pitch", details: { write, games: games.length, written, costUsd: +total.toFixed(5), lines } });
}
