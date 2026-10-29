// `admin gallery …` (src/admin.ts): the public gallery's moderation, by hand. Every command writes a BillingAudit
// row (actor "admin:<name>"), as the rest of the admin CLI does.
//   gallery reports [--all]             the open reports by game, newest first (--all: the handled ones too)
//   gallery hide <gameId> [reason]      out of the gallery; the share link keeps working; its open reports are handled
//   gallery unhide <gameId>             not hidden any more (back in the gallery while its maker lists it); reports handled
//   gallery dismiss <gameId>            its open reports handled, the game stays as it is
//   gallery unshare <gameId> [reason]   stops sharing it: the share page 404s and it leaves the gallery (its maker can share again)
//   gallery showcase                    our six showcase games in the gallery, under a TypePlay account (showcase.ts); again: no change
import type { LedgerService } from "../credits/ledger.service.js";
import type { PrismaClient } from "../generated/prisma/client.js";
import { showcaseAdmin } from "./showcase.js";

const when = (d: Date) => d.toISOString().replace("T", " ").slice(0, 16);
/** Words a stranger wrote, safe to print in a terminal: one line, no control characters, cut short. */
const safe = (s: string, max = 200) => s.replace(/[\p{Cc}\p{Cf}]+/gu, " ").slice(0, max);
const ACTIONS = ["hide", "unhide", "dismiss", "unshare"] as const;
export const GALLERY_USAGE = "admin gallery reports [--all] | gallery hide <gameId> [reason] | gallery unhide <gameId> | gallery dismiss <gameId> | gallery unshare <gameId> [reason] | gallery showcase";

export async function galleryAdmin(prisma: PrismaClient, ledger: LedgerService, args: string[], actor: string): Promise<void> {
  const [what, id, ...rest] = args;
  if (what === "showcase") return showcaseAdmin(prisma, ledger, actor);
  if (what === "reports") {
    const all = args.includes("--all");
    const reports = await prisma.gameReport.findMany({
      where: all ? {} : { handledAt: null },
      orderBy: { createdAt: "desc" },
      take: 500,
      include: { project: { include: { owner: { select: { email: true } } } } },
    });
    const games = new Map<string, typeof reports>();
    for (const r of reports) games.set(r.projectId, [...(games.get(r.projectId) ?? []), r]);
    if (!games.size) console.log(all ? "no reports yet" : "no open reports");
    for (const [gameId, rows] of games) {
      const p = rows[0].project;
      const state = [p.shared ? "shared" : "not shared", p.listed ? "in the gallery" : "not listed", p.hiddenAt ? `HIDDEN since ${when(p.hiddenAt)} (${safe(p.hiddenReason ?? "no reason", 80)})` : null];
      console.log(`${gameId}  "${safe(p.name, 60)}" by ${p.owner.email}: ${state.filter(Boolean).join(", ")}`);
      for (const r of rows) console.log(`    ${when(r.createdAt)}  ${r.reason.padEnd(6)}${r.handledAt ? "  (handled)" : ""}${r.text ? `  "${safe(r.text)}"` : ""}`);
    }
    await ledger.audit(prisma, { actor, userId: null, action: "gallery_reports", details: { all, games: games.size, reports: reports.length } });
    return;
  }
  if (!ACTIONS.includes(what as (typeof ACTIONS)[number]) || !id) throw new Error(`usage: ${GALLERY_USAGE}`);
  const action = what as (typeof ACTIONS)[number];
  const p = await prisma.project.findUnique({ where: { id }, include: { owner: { select: { email: true } } } });
  if (!p) throw new Error(`no game ${id}`);
  const reason = rest.join(" ").trim() || null;
  const now = new Date();
  const data =
    action === "hide"
      ? { hiddenAt: now, hiddenReason: reason ?? "hidden by hand" }
      : action === "unhide"
        ? { hiddenAt: null, hiddenReason: null }
        : action === "unshare"
          ? { shared: false, sharedAt: null, listed: false }
          : null;
  const handled = await prisma.$transaction(async (tx) => {
    // updatedAt stays: it orders the maker's own list by builds and messages.
    if (data) await tx.project.update({ where: { id }, data: { ...data, updatedAt: p.updatedAt } });
    const h = await tx.gameReport.updateMany({ where: { projectId: id, handledAt: null }, data: { handledAt: now } });
    await ledger.audit(tx, { actor, userId: p.ownerId, action: `gallery_${action}`, details: { projectId: id, name: p.name, reason, reportsHandled: h.count } });
    return h.count;
  });
  const done = {
    hide: "out of the gallery (its share link still works; `gallery unshare` stops that too)",
    unhide: p.listed && p.shared ? "back in the gallery" : "not hidden any more (its maker doesn't list it now, so it stays out)",
    dismiss: "stays as it is",
    unshare: "not shared any more: its share page is gone and it left the gallery",
  }[action];
  console.log(`${id} "${safe(p.name, 60)}" by ${p.owner.email}: ${done}; ${handled} open report${handled === 1 ? "" : "s"} handled`);
}
