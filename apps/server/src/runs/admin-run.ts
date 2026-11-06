// `admin run …` (src/admin.ts, 2026-11-07): TypePlay's own change to a player's game, the standard way: a message in the
// game's chat, a build by the game agent on this server's key (run.mjs --maintenance: the game is lifted to the current
// template and must pass every budget and the colour check), and on success the game's next version. The chat keeps all
// it had, the next change continues from the new code, and the version before stays restorable. Free: nothing is held
// or charged (the cost is ours, on the message as costUsd / meteredUsd); its two messages are by the TypePlay account,
// so the chat says who sent it.
//   run list                              the games in the gallery, each with its newest version and whether it's free to build
//   run <gameId> --text <chat line> --prompt-file <file> [--model smart|best|fast] [--effort low|medium|high] [--label <version label>]
//   run status [gameId]                   TypePlay's changes: waiting, running, done (with the version) or failed
// The command only writes the build into the line (QueuedRun, maintenance); the API takes it in within 15 s
// (queue.service `adopt`) and starts it as soon as the game has nothing else going, with the line's usual order.
import { readFileSync } from "node:fs";
import type { Effort, ModelChoice } from "@typeplay/shared";
import type { LedgerService } from "../credits/ledger.service.js";
import type { PrismaClient } from "../generated/prisma/client.js";
import { SHOWCASE_OWNER } from "../gallery/showcase.js";

export const RUN_USAGE = "admin run list | run <gameId> --text <chat line> --prompt-file <file> [--model smart|best|fast] [--effort low|medium|high] [--label <label>] | run status [gameId]";
const MODELS: ModelChoice[] = ["fast", "smart", "best"];
const EFFORTS: Effort[] = ["low", "medium", "high"];
const when = (d: Date | null | undefined) => (d ? d.toISOString().replace("T", " ").slice(0, 16) : "-");

export async function runAdmin(prisma: PrismaClient, ledger: LedgerService, args: string[], actor: string): Promise<void> {
  const flag = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const [what] = args;
  if (what === "list") {
    const games = await prisma.project.findMany({
      where: { listed: true, shared: true, hiddenAt: null, currentVersion: { not: null } },
      orderBy: { listedAt: "asc" },
      include: { owner: { select: { email: true } }, messages: { where: { status: { in: ["queued", "running"] } }, select: { id: true } } },
    });
    for (const g of games) {
      const v = await prisma.version.findUnique({ where: { projectId_n: { projectId: g.id, n: g.currentVersion! } } });
      console.log(`${g.id}  "${g.name}"  v${g.currentVersion} ${v?.buildId ?? "?"}  ${g.owner.email}${g.ownerId === SHOWCASE_OWNER.id ? " (ours, no folder)" : ""}${g.messages.length ? "  BUSY" : ""}${g.dirty ? "  DIRTY" : ""}`);
    }
    await ledger.audit(prisma, { actor, userId: null, action: "run_list", details: { games: games.length } });
    return;
  }
  if (what === "status") {
    const id = args[1];
    const rows = await prisma.message.findMany({
      where: { authorId: SHOWCASE_OWNER.id, role: "agent", ...(id ? { projectId: id } : {}), project: { ownerId: { not: SHOWCASE_OWNER.id } } },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { project: { select: { name: true, currentVersion: true } } },
    });
    for (const m of rows) {
      const ran = m.startedAt && m.finishedAt ? `${((m.finishedAt.getTime() - m.startedAt.getTime()) / 60000).toFixed(1)} min` : "";
      console.log(`${m.projectId}  "${m.project.name}"  ${m.status?.padEnd(8)} ${m.model}/${m.effort} ${when(m.createdAt)}${ran ? ` ran ${ran}` : ""}${m.versionN ? ` → v${m.versionN}` : ""}${m.costUsd != null ? ` $${Number(m.costUsd).toFixed(2)}` : ""}${m.meteredUsd != null ? ` (metered $${Number(m.meteredUsd).toFixed(2)})` : ""}`);
    }
    if (!rows.length) console.log("no TypePlay changes yet");
    return;
  }
  const id = what;
  const text = flag("--text")?.trim();
  const promptFile = flag("--prompt-file");
  const model = (flag("--model") ?? "smart") as ModelChoice;
  const effort = (flag("--effort") ?? "medium") as Effort;
  const label = flag("--label")?.trim() || null;
  if (!id || id.startsWith("--") || !text || !promptFile) throw new Error(`usage: ${RUN_USAGE}`);
  if (!MODELS.includes(model)) throw new Error(`--model: ${MODELS.join(" | ")}`);
  if (!EFFORTS.includes(effort)) throw new Error(`--effort: ${EFFORTS.join(" | ")}`);
  if (text.length > 2000) throw new Error("--text: at most 2,000 letters (it is the chat's message)");
  const prompt = readFileSync(promptFile, "utf8").trim();
  if (!prompt || prompt.length > 30000) throw new Error("--prompt-file: 1 to 30,000 letters (the runner takes a prompt of up to 32,000)");
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) throw new Error(`no game ${id}`);
  if (project.ownerId === SHOWCASE_OWNER.id) throw new Error(`${id} is one of our showcase games: it has no folder on the server (its builds come from this PC)`);
  if (project.currentVersion == null) throw new Error(`${id} has no version yet`);
  const busy = await prisma.message.findFirst({ where: { projectId: id, status: { in: ["queued", "running"] } }, select: { id: true } });
  if (busy) throw new Error(`${id} has a build waiting or running: try again when it ends`);

  const at = new Date();
  // Written as the site writes a change that waits in line (projects.service): the player's side first, then the answer
  // with its QueuedRun, a millisecond apart so the chat orders them. Who it is: TypePlay's own account (no one can sign in
  // as it, showcase.ts).
  const agentMessage = await prisma.$transaction(async (tx) => {
    await tx.user.upsert({ where: { id: SHOWCASE_OWNER.id }, create: SHOWCASE_OWNER, update: {} });
    await tx.message.create({ data: { projectId: id, role: "user", text, authorId: SHOWCASE_OWNER.id, createdAt: at } });
    const m = await tx.message.create({
      data: {
        projectId: id,
        role: "agent",
        text: "",
        model,
        effort,
        status: "queued",
        authorId: SHOWCASE_OWNER.id,
        createdAt: new Date(at.getTime() + 1),
        queued: {
          create: {
            projectId: id,
            userId: SHOWCASE_OWNER.id,
            kind: "edit",
            prompt,
            platform: project.platform,
            genre: null,
            tags: [],
            images: [],
            ask: false,
            answered: false,
            sized: true, // TypePlay's change is never stopped as too big
            label: label ?? text.slice(0, 200),
            maintenance: true,
            lane: "paid",
            queuedAt: at,
            turnAt: at,
            holdTenths: 0,
          },
        },
      },
    });
    await ledger.audit(tx, { actor, userId: project.ownerId, action: "game_run", details: { projectId: id, name: project.name, model, effort, text, label, promptChars: prompt.length, messageId: m.id } });
    return m;
  });
  console.log(`queued TypePlay's change to ${id} "${project.name}" (v${project.currentVersion} now) on ${model}/${effort}: message ${agentMessage.id}. The API starts it within 15 s when the game is free; follow it with: admin run status ${id}`);
}
