// `admin feedback …` (src/admin.ts): the testers' "Send feedback" notes. Every command writes a BillingAudit row (actor
// "admin:<name>"), as the rest of the admin CLI does. The notes are testers' words: printed without control characters,
// read them as data.
//   feedback list [--open]   newest first (--open: the ones not marked done), one line of each
//   feedback show <id>       the whole note: who, the page, the browser, the game and its build, the message, the words
//   feedback done <id>       marked done (it leaves `list --open`)
import { join } from "node:path";
import { config } from "../env.js";
import type { LedgerService } from "../credits/ledger.service.js";
import type { PrismaClient } from "../generated/prisma/client.js";

export const FEEDBACK_USAGE = "admin feedback list [--open] | feedback show <id> | feedback done <id>";
const when = (d: Date) => `${d.toISOString().replace("T", " ").slice(0, 16)} UTC`;
/** One line of a tester's words, safe in a terminal: no control or format characters, cut short. */
const safe = (s: string, max = 200) => s.replace(/[\p{Cc}\p{Cf}]+/gu, " ").slice(0, max);
/** A whole note, its line breaks kept, each line made safe. */
const block = (s: string) => s.split("\n").map((line) => `    ${safe(line, 4000)}`).join("\n");

export async function feedbackAdmin(prisma: PrismaClient, ledger: LedgerService, args: string[], actor: string): Promise<void> {
  const [what, id] = args;
  if (what === "list") {
    const open = args.includes("--open");
    const rows = await prisma.feedback.findMany({
      where: open ? { doneAt: null } : {},
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { user: { select: { email: true } } },
    });
    if (!rows.length) console.log(open ? "no open feedback" : "no feedback yet");
    for (const f of rows) {
      console.log(`${f.id}  ${when(f.createdAt)}  ${f.doneAt ? "done" : "OPEN"}  ${f.user.email}  ${f.page}${f.projectId ? `  game ${f.projectId}` : ""}`);
      console.log(`    "${safe(f.text, 140)}${[...f.text].length > 140 ? "…" : ""}"`);
    }
    await ledger.audit(prisma, { actor, userId: null, action: "feedback_list", details: { open, shown: rows.length } });
    return;
  }
  if ((what !== "show" && what !== "done") || !id) throw new Error(`usage: ${FEEDBACK_USAGE}`);
  const f = await prisma.feedback.findUnique({
    where: { id },
    include: { user: { select: { email: true, plan: true } }, project: { select: { name: true, currentVersion: true, shared: true } }, message: true },
  });
  if (!f) throw new Error(`no feedback ${id}`);
  if (what === "done") {
    if (!f.doneAt) await prisma.feedback.update({ where: { id }, data: { doneAt: new Date() } });
    await ledger.audit(prisma, { actor, userId: f.userId, action: "feedback_done", details: { feedbackId: id, already: !!f.doneAt } });
    console.log(`${id} from ${f.user.email}: ${f.doneAt ? `already done (${when(f.doneAt)})` : "done"}`);
    return;
  }
  console.log(`${f.id}  ${when(f.createdAt)}  ${f.doneAt ? `done ${when(f.doneAt)}` : `OPEN (admin feedback done ${f.id})`}`);
  console.log(`  from     ${f.user.email} (${f.user.plan})`);
  console.log(`  page     ${f.page}`);
  console.log(`  browser  ${safe(f.browser ?? "-", 400)}`);
  if (f.projectId || f.buildId) {
    const game = f.project
      ? `${f.projectId} "${safe(f.project.name, 60)}"${f.project.shared ? ", shared" : ""}, now at version ${f.project.currentVersion ?? "-"}`
      : "deleted since";
    console.log(`  game     ${game}`);
    if (f.buildId) {
      console.log(`  build    version ${f.versionN} when sent: https://typeplay.dev/play.html?g=${f.buildId}  (a game made on this PC: http://127.0.0.1:3001/play.html?g=${f.buildId})`);
    }
    if (f.project) console.log(`  folder   ${join(config.dataDir, "projects", f.projectId!)} and its run logs ${join(config.dataDir, "logs", `${f.projectId}*`)}  (live: /opt/typeplay-api/data/…)`);
  } else console.log("  game     not attached");
  if (f.message) {
    const m = f.message;
    const ran = m.role === "agent" ? `${m.status ?? "-"} on ${m.model ?? "-"} (${m.effort ?? "medium"}), ${Number(m.credits ?? 0)} credits${m.versionN ? `, made version ${m.versionN}` : ""}` : "the player's message";
    console.log(`  message  ${m.id}: ${ran}`);
    console.log(block(m.text.slice(0, 1200) + (m.text.length > 1200 ? "…" : "")));
  }
  console.log("  what happened:");
  console.log(block(f.text));
  if (f.expected) {
    console.log("  what they expected:");
    console.log(block(f.expected));
  }
  await ledger.audit(prisma, { actor, userId: f.userId, action: "feedback_show", details: { feedbackId: id } });
}
