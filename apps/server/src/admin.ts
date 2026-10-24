// Admin CLI for the beta (credits are given by hand; docs/payments-design.md §11):
//   npm run admin -w @typeplay/server -- grant <email> <amount> [note]     (negative takes away)
//   npm run admin -w @typeplay/server -- plan <email> <free|medium|high|ultra|ultraplus>
//   npm run admin -w @typeplay/server -- list
//   npm run admin -w @typeplay/server -- user <email>                       (buckets, debt, subscription, flags)
//   npm run admin -w @typeplay/server -- audit [email]                      (the ledger's invariants; exit 1 if any fails)
//   npm run admin -w @typeplay/server -- flag <email> clear
// Paddle (payments part 2; need PADDLE_ENV + PADDLE_API_KEY in the root .env, or the api container's env):
//   npm run admin -w @typeplay/server -- events [--status failed|parked|received|processed|ignored] [--limit 50]
//   npm run admin -w @typeplay/server -- event <evt_id>                     (the row and its payload)
//   npm run admin -w @typeplay/server -- retry <evt_id>                     (the handler again, now)
//   npm run admin -w @typeplay/server -- refund <email> <txn_id|last> [reason]   (the unused share, within 14 days)
//   npm run admin -w @typeplay/server -- sync <email>                       (Paddle's subscription, payments and adjustments applied as if webhooks)
//   npm run admin -w @typeplay/server -- downgrade <email> cancel           (undo a downgrade waiting for the renewal)
// Android export (package 7):
//   npm run admin -w @typeplay/server -- android builds <projectId>         (rows, failure codes, where the logs are)
//   npm run admin -w @typeplay/server -- android toolchain                  (this server's fingerprint and settings)
// The closed beta (beta 1; src/beta/admin-invites.ts, src/feedback/admin-feedback.ts):
//   npm run admin -w @typeplay/server -- invite add <email> [note]          (on the invite list; BETA_INVITE_ONLY lets only these in)
//   npm run admin -w @typeplay/server -- invite list                        (every invite, its first sign-in, the account's credits)
//   npm run admin -w @typeplay/server -- invite remove <email>              (off the list: the account stays, the app answers 403 invite_only)
//   npm run admin -w @typeplay/server -- feedback list [--open]             (the testers' notes, newest first)
//   npm run admin -w @typeplay/server -- feedback show <id>                 (the whole note, the game's build, the message)
//   npm run admin -w @typeplay/server -- feedback done <id>                 (dealt with: it leaves list --open)
// The public gallery's moderation (src/gallery/admin-gallery.ts):
//   npm run admin -w @typeplay/server -- gallery reports [--all]             (the open reports by game; --all: handled ones too)
//   npm run admin -w @typeplay/server -- gallery hide <gameId> [reason]      (out of the gallery; the share link keeps working)
//   npm run admin -w @typeplay/server -- gallery unhide <gameId>             (back in, while its maker lists it)
//   npm run admin -w @typeplay/server -- gallery dismiss <gameId>            (its open reports handled; the game stays as it is)
//   npm run admin -w @typeplay/server -- gallery unshare <gameId> [reason]   (stops sharing it: the share page 404s too)
// Every command writes a BillingAudit row (actor "admin:<ADMIN_NAME or the OS user>").
import { userInfo } from "node:os";
import type { PlanId } from "@typeplay/shared";
import { INVITE_USAGE, inviteAdmin } from "./beta/admin-invites.js";
import { BillingService } from "./billing/billing.service.js";
import { BillingHandlers } from "./billing/handlers.js";
import { InboxService } from "./billing/inbox.service.js";
import { PaddleService } from "./billing/paddle.service.js";
import { fromTenths, PLANS, toTenths } from "./credits/credits.js";
import { config, ENV_MODE } from "./env.js";
import { LedgerService } from "./credits/ledger.service.js";
import { FEEDBACK_USAGE, feedbackAdmin } from "./feedback/admin-feedback.js";
import { GALLERY_USAGE, galleryAdmin } from "./gallery/admin-gallery.js";
import type { EventStatus } from "./generated/prisma/client.js";
import { createPrisma } from "./prisma.js";

// Which database this is, before anything is read or written (docs/environments.md).
if (ENV_MODE === "development" || ENV_MODE === "test") console.error(`admin: this PC's ${ENV_MODE} database (npm run admin:live for the live one)`);
const prisma = createPrisma();
const ledger = new LedgerService(prisma);
const paddle = new PaddleService();
const handlers = new BillingHandlers(prisma, ledger, paddle);
const inbox = new InboxService(prisma, handlers, paddle);
const billing = new BillingService(prisma, ledger, paddle, handlers);
const [cmd, ...args] = process.argv.slice(2);
const actor = `admin:${process.env.ADMIN_NAME || userInfo().username}`;

/** The commands that talk to Paddle: the catalog check first (a mismatch or a missing key stops here, with its reason). */
async function needPaddle() {
  if (paddle.mode === "off") throw new Error("billing is off: PADDLE_ENV and PADDLE_API_KEY are not in the root .env");
  await paddle.check(true);
  if (!paddle.ready) throw new Error(paddle.problem ?? "Paddle did not answer the catalog check (see the warning above)");
}

const flagValue = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

async function userByEmail(email: string | undefined) {
  if (!email) throw new Error("need an email");
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) throw new Error(`no user with email ${email} (they appear after their first sign-in)`);
  return user;
}

const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "-");

async function main() {
  if (cmd === "grant") {
    const [email, amountText, ...noteWords] = args;
    const amount = fromTenths(toTenths(Number(amountText)));
    if (!Number.isFinite(amount) || amount === 0) throw new Error("amount: a number like 10 or 2.5 (negative takes credits away)");
    const user = await userByEmail(email);
    const note = noteWords.join(" ") || (amount > 0 ? "Given by hand" : "Taken back by hand");
    // A positive amount opens an `admin` bucket (spent last, never expires); a negative one is a
    // grant row below zero, taken from the buckets in spend order: only real charges count toward
    // Free's daily limit.
    if (amount > 0) await ledger.grant(user.id, { source: "admin", tenths: toTenths(amount), expiresAt: null, note });
    else await ledger.takeBack(user.id, toTenths(-amount), note);
    await ledger.audit(prisma, { actor, userId: user.id, action: "grant", details: { credits: amount, note } });
    const b = await ledger.balance(await prisma.user.findUniqueOrThrow({ where: { id: user.id } }));
    console.log(`${user.email}: ${amount > 0 ? "+" : ""}${amount} credits, now ${b.available}`);
  } else if (cmd === "plan") {
    const [email, plan] = args;
    if (!PLANS.includes(plan as PlanId)) throw new Error(`plan: one of ${PLANS.join(", ")}`);
    const user = await userByEmail(email);
    // Entitlement only (models, builds at once, the daily limit): no credits move. Paid plans'
    // credits come with the payment (part 2); a Free cycle starts when the user next settles.
    await prisma.user.update({ where: { id: user.id }, data: { plan: plan as PlanId } });
    await ledger.audit(prisma, { actor, userId: user.id, action: "plan", details: { from: user.plan, to: plan } });
    console.log(`${user.email}: plan ${user.plan} -> ${plan}`);
  } else if (cmd === "list") {
    const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" }, include: { _count: { select: { projects: true } } } });
    if (!users.length) console.log("no users yet");
    for (const u of users) {
      const b = await ledger.balance(u);
      const today = b.todayLeft === null ? "" : `, ${b.todayLeft} left today`;
      const status = u.subscriptionStatus ? ` [${u.subscriptionStatus}${u.pendingPlan ? ` -> ${u.pendingPlan}` : ""}${u.cancelsAt ? `, ends ${day(u.cancelsAt)}` : ""}]` : "";
      const flag = u.billingFlag ? ` FLAG ${u.billingFlag}` : "";
      const debt = u.debtTenths ? ` (owes ${fromTenths(u.debtTenths)})` : "";
      console.log(`${u.email.padEnd(36)} ${u.plan.padEnd(9)} ${String(b.available).padStart(7)} credits${today}${debt}, ${u._count.projects} games${status}${flag}`);
    }
    await ledger.audit(prisma, { actor, userId: null, action: "list", details: { users: users.length } });
  } else if (cmd === "user") {
    const user = await userByEmail(args[0]);
    const b = await ledger.balance(user);
    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    console.log(`${fresh.email} (${fresh.id}): ${fresh.plan}, ${b.available} credits to spend${b.todayLeft === null ? "" : `, ${b.todayLeft} left today`}${fresh.debtTenths ? `, owes ${fromTenths(fresh.debtTenths)}` : ""}`);
    console.log(`  signed up ${day(fresh.createdAt)}; free cycle ends ${day(fresh.freeCycleEndsAt)}; next settle ${fresh.nextSettleAt?.toISOString() ?? "-"}`);
    if (fresh.paddleCustomerId || fresh.paddleSubscriptionId || fresh.subscriptionStatus) {
      console.log(
        `  paddle: customer ${fresh.paddleCustomerId ?? "-"}, subscription ${fresh.paddleSubscriptionId ?? "-"} ${fresh.subscriptionStatus ?? ""}; period ends ${day(fresh.periodEndsAt)}, next bill ${day(fresh.nextBilledAt)}, cancels ${day(fresh.cancelsAt)}, pending plan ${fresh.pendingPlan ?? "-"}, card ${fresh.paymentMethod ?? "-"}`,
      );
    } else console.log("  paddle: nothing yet");
    if (fresh.billingFlag) console.log(`  FLAG ${fresh.billingFlag} (clear with: admin flag ${fresh.email} clear)`);
    if (fresh.lastPaymentFailedAt) console.log(`  last payment failed ${fresh.lastPaymentFailedAt.toISOString()}`);
    const buckets = await prisma.creditBucket.findMany({ where: { userId: user.id }, orderBy: { startsAt: "asc" } });
    console.log(`  buckets (${buckets.length}):`);
    for (const k of buckets) {
      const state = k.closedAt ? `closed ${day(k.closedAt)} (${k.closedWhy})` : k.frozenAt ? "frozen (refund pending)" : "open";
      console.log(`    ${k.source.padEnd(8)} ${String(fromTenths(k.remainingTenths)).padStart(7)} of ${String(fromTenths(k.grantedTenths)).padEnd(7)} from ${day(k.startsAt)} to ${day(k.expiresAt)}  ${state}${k.paymentId ? `  ${k.paymentId}` : ""}${k.note ? `  "${k.note}"` : ""}`);
    }
    const payments = await prisma.payment.findMany({ where: { userId: user.id }, orderBy: { paidAt: "desc" }, take: 20 });
    console.log(`  payments (${payments.length}):`);
    for (const p of payments) {
      console.log(`    ${day(p.paidAt)} ${p.id} ${p.kind.padEnd(8)} $${(p.paidCents / 100).toFixed(2)} + tax $${(p.taxCents / 100).toFixed(2)} ${p.currency} ${p.status}${p.refundedCents ? ` (refunded $${(p.refundedCents / 100).toFixed(2)})` : ""}${p.invoiceNumber ? ` ${p.invoiceNumber}` : ""}`);
    }
    const refunds = await prisma.refund.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 10 });
    for (const r of refunds) console.log(`  refund ${r.id}: ${r.status}, $${(r.quoteCents / 100).toFixed(2)} for ${fromTenths(r.quoteTenths)} credits on ${r.paymentId}${r.adjustmentId ? ` (${r.adjustmentId})` : ""}`);
    await ledger.audit(prisma, { actor, userId: user.id, action: "user", details: {} });
  } else if (cmd === "audit") {
    const user = args[0] ? await userByEmail(args[0]) : null;
    const problems = await ledger.checkInvariants(user?.id ?? null);
    for (const p of problems) console.log(`  FAIL ${p}`);
    console.log(problems.length ? `${problems.length} problem(s)` : `ok: the ledger's invariants hold${user ? ` for ${user.email}` : " for everyone"}`);
    await ledger.audit(prisma, { actor, userId: user?.id ?? null, action: "audit", details: { problems: problems.length } });
    if (problems.length) process.exitCode = 1;
  } else if (cmd === "flag") {
    const [email, what] = args;
    if (what !== "clear") throw new Error("usage: flag <email> clear");
    const user = await userByEmail(email);
    await prisma.user.update({ where: { id: user.id }, data: { billingFlag: null } });
    await ledger.audit(prisma, { actor, userId: user.id, action: "flag_clear", details: { was: user.billingFlag } });
    console.log(`${user.email}: flag ${user.billingFlag ?? "(none)"} cleared`);
  } else if (cmd === "events") {
    const status = flagValue("--status") as EventStatus | undefined;
    const limit = Number(flagValue("--limit") ?? 50);
    if (status && !["received", "processed", "ignored", "parked", "failed"].includes(status)) throw new Error("--status is received, processed, ignored, parked or failed");
    const rows = await prisma.paddleEvent.findMany({ where: status ? { status } : {}, orderBy: { receivedAt: "desc" }, take: Number.isFinite(limit) && limit > 0 ? limit : 50 });
    if (!rows.length) console.log(status ? `no ${status} events` : "no events yet");
    for (const e of rows) {
      const when = e.occurredAt.toISOString().replace("T", " ").slice(0, 19);
      console.log(`${when}  ${e.status.padEnd(9)} ${e.type.padEnd(28)} ${e.id}  ${e.userId ?? "-"}${e.attempts ? `  tries ${e.attempts}` : ""}${e.deliveries > 1 ? `  delivered ${e.deliveries}x` : ""}${e.error ? `  ${e.error.slice(0, 100)}` : ""}`);
    }
    await ledger.audit(prisma, { actor, userId: null, action: "events", details: { status: status ?? null, shown: rows.length } });
  } else if (cmd === "event") {
    const id = args[0];
    if (!id) throw new Error("usage: event <evt_id>");
    const e = await prisma.paddleEvent.findUnique({ where: { id } });
    if (!e) throw new Error(`no event ${id}`);
    console.log(`${e.id}: ${e.type}, ${e.status}; occurred ${e.occurredAt.toISOString()}, received ${e.receivedAt.toISOString()}, processed ${e.processedAt?.toISOString() ?? "-"}`);
    console.log(`  notification ${e.notificationId}, delivered ${e.deliveries}x, attempts ${e.attempts}, next try ${e.nextTryAt?.toISOString() ?? "-"}, user ${e.userId ?? "-"}`);
    if (e.error) console.log(`  note: ${e.error}`);
    console.log(JSON.stringify(e.payload, null, 2));
    await ledger.audit(prisma, { actor, userId: e.userId, action: "event", details: { event: id } });
  } else if (cmd === "retry") {
    const id = args[0];
    if (!id) throw new Error("usage: retry <evt_id>");
    const r = await inbox.retry(id, actor);
    await ledger.audit(prisma, { actor, userId: r.userId ?? null, action: "retry", details: { event: id, result: r.status, note: r.note } });
    console.log(`${id}: ${r.status}: ${r.note}`);
    if (r.status !== "processed") process.exitCode = 1;
  } else if (cmd === "refund") {
    const [email, which, ...reasonWords] = args;
    if (!email || !which) throw new Error("usage: refund <email> <txn_id|last> [reason]");
    const user = await userByEmail(email);
    await needPaddle();
    const r = await billing.requestRefund(user.id, which, reasonWords.join(" "), actor);
    console.log(`${user.email}: refund ${r.refund.id} of ${r.payment.id}: $${(r.refund.quoteCents / 100).toFixed(2)} before tax for ${fromTenths(r.refund.quoteTenths)} unused credits, now ${r.refund.status}`);
    console.log(`  ${r.outcome}`);
  } else if (cmd === "sync") {
    const user = await userByEmail(args[0]);
    await needPaddle();
    const r = await billing.sync(user.id, actor);
    console.log(`${user.email}: subscription ${r.subscription ?? "(none)"}`);
    for (const t of r.transactions) console.log(`  transaction ${t}`);
    for (const a of r.adjustments) console.log(`  adjustment ${a}`);
    if (!r.transactions.length && !r.adjustments.length) console.log(`  no completed transactions${user.paddleCustomerId ? "" : " (no Paddle customer yet)"}`);
  } else if (cmd === "downgrade") {
    const [email, what] = args;
    if (what !== "cancel") throw new Error("usage: downgrade <email> cancel");
    const user = await userByEmail(email);
    if (!user.pendingPlan) throw new Error(`${user.email} has no downgrade waiting`);
    await needPaddle();
    await billing.undoPlanChange(user, actor);
    console.log(`${user.email}: the change to ${user.pendingPlan} is undone; the plan stays ${user.plan}`);
  } else if (cmd === "android") {
    const [what, projectId] = args;
    if (what === "toolchain") {
      const a = config.android;
      console.log(`android export: ${a.on ? "on" : "off (ANDROID_EXPORT unset)"}; toolchain ${a.toolchain || "(unset: local)"}; store ${a.store}${a.store === "r2" ? ` (${a.r2Bucket})` : ""}; signer ${a.signerSocket ? "sidecar " + a.signerSocket : a.fake ? "fake" : "in-process"}`);
      console.log(`  max builds ${a.maxBuilds}, timeout ${a.buildTimeoutMin} min, master key ${a.masterKey ? "set" : "MISSING"}${a.masterKeyPrev ? " (+ previous)" : ""}`);
    } else if (what === "builds") {
      if (!projectId) throw new Error("usage: android builds <projectId>");
      const app = await prisma.androidApp.findUnique({ where: { projectId }, include: { key: true } });
      if (!app) throw new Error(`project ${projectId} has no Android setup`);
      console.log(`${projectId}: ${app.packageName} "${app.appName}", build number ${app.versionCode}${app.packageLockedAt ? ", package locked" : ""}${app.iconPng ? ", own icon" : ""}; key ${app.key?.certSha256.slice(0, 16) ?? "-"}… downloaded ${app.key?.downloads ?? 0}x`);
      const rows = await prisma.androidBuild.findMany({ where: { projectId }, orderBy: { queuedAt: "desc" }, take: 50 });
      for (const b of rows) {
        const mb = b.bytes != null ? `${(b.bytes / 1e6).toFixed(1)} MB` : "-";
        console.log(`  ${b.id.padEnd(22)} ${b.format} v${b.versionN} #${b.versionCode} ${b.status.padEnd(9)} ${mb.padStart(8)} ${day(b.queuedAt)}${b.failCode ? `  ${b.failCode}: ${b.failMessage ?? ""}` : ""}  log: data/logs/android-${b.id}.log`);
      }
      if (!rows.length) console.log("  no builds yet");
    } else throw new Error("usage: android builds <projectId> | android toolchain");
  } else if (cmd === "gallery") {
    await galleryAdmin(prisma, ledger, args, actor);
  } else if (cmd === "invite") {
    await inviteAdmin(prisma, ledger, args, actor);
  } else if (cmd === "feedback") {
    await feedbackAdmin(prisma, ledger, args, actor);
  } else {
    console.log(
      "usage: admin grant <email> <amount> [note] | plan <email> <plan> | list | user <email> | audit [email] | flag <email> clear\n" +
        "       admin events [--status s] [--limit n] | event <id> | retry <id> | refund <email> <txn|last> [reason] | sync <email> | downgrade <email> cancel\n" +
        "       admin android builds <projectId> | android toolchain\n" +
        `       ${GALLERY_USAGE}\n` +
        `       ${INVITE_USAGE}\n` +
        `       ${FEEDBACK_USAGE}`,
    );
    process.exitCode = 2;
  }
}

main()
  .catch((e) => {
    console.error((e as Error).message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
