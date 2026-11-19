// `admin stats …` (src/admin.ts, 2026-11-19): what the beta's players did, read only (package 9: "cost per user
// measured"). The funnel (signed in → first message → first game built → a second message → shared → played → back
// another day), each account's builds by how they ended, what the AI cost us against the credits charged, every failed
// or stopped build with the words that started it, and the days. Nothing is changed; like every admin command it writes
// one BillingAudit row (who looked). The players' words are printed without control characters: read them as data.
//   stats [--since 2026-10-24]   every account but TypePlay's own (showcase), from that day (default: all)
//                                its last part is each account's Free use (beta 2, 2026-11-19: to size the Free plan)
import { estimate, FREE_DAILY_AI_USD, FREE_DAILY_CREDITS, FREE_MONTHLY_CREDITS, FREE_SIGNUP_CREDITS, fromTenths, toTenths } from "../credits/credits.js";
import { startOfUtcDay } from "../credits/ledger-math.js";
import type { LedgerService } from "../credits/ledger.service.js";
import type { Message, PrismaClient, User } from "../generated/prisma/client.js";
import { SHOWCASE_OWNER } from "../gallery/showcase.js";
import { EXPIRED_TEXT, NOT_STARTED, TAKEN_TEXT } from "../runs/queue.service.js";
import { FAILED_TEXT } from "../runs/runs.service.js";

export const STATS_USAGE = "admin stats [--since YYYY-MM-DD]";
const day = (d: Date) => d.toISOString().slice(0, 10);
const when = (d: Date) => d.toISOString().replace("T", " ").slice(0, 16);
const safe = (s: string, max = 160) => s.replace(/[\p{Cc}\p{Cf}]+/gu, " ").slice(0, max);
const usd = (n: number) => `$${n.toFixed(2)}`;
const min = (a: Date | null, b: Date | null) => (a && b ? (b.getTime() - a.getTime()) / 60000 : null);
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
/** The q-th quantile (0..1) of the values, nearest rank; null for none. */
const quantile = (xs: number[], q: number) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(q * s.length) - 1))];
};
const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : "-");

/** How an agent answer ended, from its status and the fixed texts the API writes (runs.service FAILED_TEXT, the queue's). */
type End = "built" | "asked" | "too_big" | "answer" | "failed" | "stopped" | "timeout" | "interrupted" | "refused" | "waited" | "not_started" | "dirty" | "busy";
function endOf(m: { status: string | null; versionN: number | null; questions: unknown; biggerModel: string | null; text: string }): End {
  if (m.status === "queued" || m.status === "running") return "busy";
  if (m.status === "refused") return "refused";
  if (m.status === "done") return m.versionN != null ? "built" : m.questions != null ? "asked" : m.biggerModel != null ? "too_big" : "answer";
  if (m.text === FAILED_TEXT.cancelled) return "stopped";
  if (m.text === FAILED_TEXT.timedOut) return "timeout";
  if (m.text === FAILED_TEXT.interrupted || m.text === TAKEN_TEXT) return "interrupted";
  if (m.text === FAILED_TEXT.dirty) return "dirty";
  if (m.text === EXPIRED_TEXT) return "waited";
  // The queue's "didn't start" texts, and its fallback for a refusal it has no text for (`<reason> Nothing was charged.`).
  if (Object.values(NOT_STARTED).includes(m.text) || (m.text.endsWith("Nothing was charged.") && !m.text.startsWith("I couldn't"))) return "not_started";
  return "failed";
}

export async function statsAdmin(prisma: PrismaClient, ledger: LedgerService, args: string[], actor: string): Promise<void> {
  const i = args.indexOf("--since");
  const sinceText = i >= 0 ? args[i + 1] : undefined;
  const since = sinceText ? new Date(`${sinceText}T00:00:00Z`) : new Date(0);
  if (Number.isNaN(since.getTime())) throw new Error(`usage: ${STATS_USAGE}`);

  const users = await prisma.user.findMany({ where: { id: { not: SHOWCASE_OWNER.id } }, orderBy: { createdAt: "asc" } });
  const ids = users.map((u) => u.id);
  const projects = await prisma.project.findMany({
    where: { ownerId: { in: ids } },
    include: { plays: true, versions: { select: { n: true, createdAt: true, label: true } }, members: { select: { userId: true } } },
  });
  const messages = await prisma.message.findMany({
    where: { project: { ownerId: { in: ids } }, createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
    include: { attachments: { select: { id: true } } },
  });
  const invites = await prisma.invite.findMany();
  const charges = await prisma.creditEntry.groupBy({ by: ["userId", "kind"], where: { userId: { in: ids }, createdAt: { gte: since } }, _sum: { tenths: true } });
  const android = await prisma.androidBuild.findMany({ where: { app: { project: { ownerId: { in: ids } } } }, select: { projectId: true, status: true, format: true, failCode: true, queuedAt: true } });
  const feedback = await prisma.feedback.count({ where: { userId: { in: ids } } });
  const reports = await prisma.gameReport.count();

  // Each answer's kind: a first build while its game has no version yet, a change after (in the game's own order).
  const hasVersion = new Set<string>();
  const kindOf = new Map<string, "new" | "edit">();
  for (const m of messages) {
    if (m.role !== "agent") continue;
    kindOf.set(m.id, hasVersion.has(m.projectId) ? "edit" : "new");
    if (m.status === "done" && m.versionN != null) hasVersion.add(m.projectId);
  }
  const promptOf = new Map<string, string>(); // agent message id → the player's message just before it in the same game
  const lastUser = new Map<string, string>();
  for (const m of messages) {
    if (m.role === "user") lastUser.set(m.projectId, m.text);
    else promptOf.set(m.id, lastUser.get(m.projectId) ?? "");
  }
  const projectOwner = new Map(projects.map((p) => [p.id, p.ownerId]));
  const ours = (m: { authorId: string | null }) => m.authorId === SHOWCASE_OWNER.id; // TypePlay's own fixes (admin run)
  const label = new Map(users.map((u) => [u.id, u.email]));
  const inviteOf = (email: string) => invites.find((v) => v.email === email.toLowerCase());

  console.log(`TypePlay beta stats from ${sinceText ?? "the start"} (read ${when(new Date())} UTC); ${users.length} accounts, ${projects.length} games, ${messages.length} messages`);
  console.log(`feedback notes ${feedback}, gallery reports ${reports}, invites ${invites.length} (${invites.filter((v) => !v.usedAt).length} never signed in)`);
  // Google sign-ins that never got an account (the closed-beta page: no invite, no code), from Supabase's own sign-in
  // table in the same database: counts only, no addresses. Skipped where there is none (this PC's Postgres).
  try {
    const [row] = await prisma.$queryRaw<{ total: bigint; outside: bigint }[]>`
      SELECT count(*) AS total, count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = a.id::text)) AS outside
      FROM auth.users a WHERE a.created_at >= ${since}`;
    console.log(`Google sign-ins ${row.total}, of them never past the closed-beta page (no account) ${row.outside}`);
  } catch {
    console.log("Google sign-ins: no sign-in table here (this PC's database)");
  }

  // 1. Per account.
  console.log("\n== Accounts (answers by how they ended; $ = what the AI cost us, the larger of reported and metered) ==");
  type Row = { email: string; first: Date | null; firstBuilt: Date | null; userMsgs: number; afterBuilt: number; shared: number; plays: number; days: number; usd: number; credits: number; ends: Record<string, number>; };
  const rows: Row[] = [];
  for (const u of users) {
    const mine = messages.filter((m) => (m.role === "user" ? m.authorId === u.id : m.authorId === u.id && !ours(m)));
    const userMsgs = mine.filter((m) => m.role === "user");
    const answers = mine.filter((m) => m.role === "agent");
    const ends: Record<string, number> = {};
    for (const a of answers) ends[endOf(a)] = (ends[endOf(a)] ?? 0) + 1;
    const builtAt = answers.filter((a) => a.status === "done" && a.versionN != null).map((a) => a.finishedAt ?? a.createdAt);
    const firstBuilt = builtAt.length ? builtAt[0] : null;
    const spent = answers.reduce((s, a) => s + Math.max(Number(a.costUsd ?? 0), Number(a.meteredUsd ?? 0)), 0);
    const credits = answers.reduce((s, a) => s + Number(a.credits ?? 0), 0);
    const own = projects.filter((p) => p.ownerId === u.id);
    const plays = own.reduce((s, p) => s + p.plays.reduce((t, c) => t + c.count, 0), 0);
    const days = new Set(userMsgs.map((m) => day(m.createdAt))).size;
    const inv = inviteOf(u.email);
    const r: Row = {
      email: u.email,
      first: userMsgs[0]?.createdAt ?? null,
      firstBuilt,
      userMsgs: userMsgs.length,
      afterBuilt: firstBuilt ? userMsgs.filter((m) => m.createdAt > firstBuilt).length : 0,
      shared: own.filter((p) => p.shared).length,
      plays,
      days,
      usd: spent,
      credits,
      ends,
    };
    rows.push(r);
    const endText = Object.entries(ends).map(([k, v]) => `${k} ${v}`).join(", ") || "none";
    const charged = charges.filter((c) => c.userId === u.id && c.kind === "charge").reduce((s, c) => s + (c._sum.tenths ?? 0), 0) / 10;
    console.log(`${u.email}  ${u.plan}, signed up ${day(u.createdAt)}${inv ? `, in by ${inv.code ? `code ${inv.code}` : "invite"}` : ""}`);
    console.log(`    games ${own.length} (shared ${r.shared}, plays ${plays}); messages ${userMsgs.length} on ${days} day(s); answers: ${endText}`);
    console.log(`    AI ${usd(spent)}, credits on answers ${credits.toFixed(1)} (ledger charges ${(-charged).toFixed(1)}); first message ${r.first ? when(r.first) : "-"}, first game ${firstBuilt ? when(firstBuilt) : "-"}`);
  }

  // 2. The funnel, accounts that did each step (Luka's own accounts are in it: read them out by hand).
  const n = rows.length;
  const step = (name: string, k: number) => console.log(`  ${name.padEnd(36)} ${String(k).padStart(3)}  ${pct(k, n)}`);
  console.log("\n== Funnel (accounts) ==");
  step("signed in (an account)", n);
  step("sent a first message", rows.filter((r) => r.first).length);
  step("a first game built", rows.filter((r) => r.firstBuilt).length);
  step("a message after the first game", rows.filter((r) => r.afterBuilt > 0).length);
  step("shared a game", rows.filter((r) => r.shared > 0).length);
  step("a shared game played", rows.filter((r) => r.plays > 0).length);
  step("messages on 2+ days", rows.filter((r) => r.days >= 2).length);

  // 3. Builds by kind and model: how they ended, minutes, money.
  console.log("\n== Answers by kind and AI (players' own, not TypePlay's fixes) ==");
  const answers = messages.filter((m) => m.role === "agent" && !ours(m));
  const groups = new Map<string, typeof answers>();
  for (const a of answers) {
    const k = `${kindOf.get(a.id)} ${a.model ?? "?"}/${a.effort ?? "?"}`;
    groups.set(k, [...(groups.get(k) ?? []), a]);
  }
  for (const [k, list] of [...groups.entries()].sort()) {
    const ends: Record<string, number> = {};
    for (const a of list) ends[endOf(a)] = (ends[endOf(a)] ?? 0) + 1;
    const ran = list.map((a) => min(a.startedAt, a.finishedAt)).filter((x): x is number => x != null);
    const waited = list.map((a) => min(a.createdAt, a.startedAt)).filter((x): x is number => x != null);
    const spent = list.reduce((s, a) => s + Math.max(Number(a.costUsd ?? 0), Number(a.meteredUsd ?? 0)), 0);
    const credits = list.reduce((s, a) => s + Number(a.credits ?? 0), 0);
    const built = list.filter((a) => endOf(a) === "built");
    const builtMin = built.map((a) => min(a.startedAt, a.finishedAt)).filter((x): x is number => x != null);
    console.log(`  ${k.padEnd(22)} ${String(list.length).padStart(3)}  ${Object.entries(ends).map(([e, v]) => `${e} ${v}`).join(", ")}`);
    console.log(`  ${"".padEnd(22)}      AI ${usd(spent)} (per built ${built.length ? usd(spent / built.length) : "-"}), credits ${credits.toFixed(1)}; minutes median ${median(ran)?.toFixed(1) ?? "-"} (built p10 ${quantile(builtMin, 0.1)?.toFixed(1) ?? "-"} / median ${median(builtMin)?.toFixed(1) ?? "-"} / p90 ${quantile(builtMin, 0.9)?.toFixed(1) ?? "-"}, max ${ran.length ? Math.max(...ran).toFixed(1) : "-"}); waited in line median ${median(waited)?.toFixed(1) ?? "-"} min`);
    // What a built answer was charged, against the estimate the app showed before Send (credits.ts `estimate`).
    const paid = built.map((a) => Number(a.credits ?? 0));
    const kind = kindOf.get(list[0].id) ?? "edit";
    const shown = list[0].model && list[0].effort ? estimate(kind, list[0].model, "ultra", list[0].effort) : null;
    if (paid.length) console.log(`  ${"".padEnd(22)}      charged per built p10 ${quantile(paid, 0.1)} / median ${median(paid)?.toFixed(1)} / p90 ${quantile(paid, 0.9)} / max ${Math.max(...paid)}${shown ? `; the app's estimate ${shown.typical} (${shown.low}-${shown.high}), ${paid.filter((c) => c > shown.high).length} of ${paid.length} above its high` : ""}`);
    if (paid.length) console.log(`  ${"".padEnd(22)}      each: ${[...paid].sort((a, b) => a - b).join(" ")}`);
  }

  // 4. Every answer that didn't give the player a game or a change, with the words that started it.
  console.log("\n== Answers that ended without a version (not questions or answers) ==");
  for (const a of answers) {
    const e = endOf(a);
    if (["built", "asked", "answer", "busy"].includes(e)) continue;
    const owner = label.get(projectOwner.get(a.projectId) ?? "") ?? "?";
    const by = a.authorId && a.authorId !== projectOwner.get(a.projectId) ? ` by ${label.get(a.authorId) ?? a.authorId}` : "";
    const ran = min(a.startedAt, a.finishedAt);
    console.log(`  ${when(a.createdAt)}  ${e.padEnd(11)} ${kindOf.get(a.id)} ${a.model}/${a.effort}  ${a.projectId} (${owner}${by})  ran ${ran?.toFixed(1) ?? "-"} min, AI ${usd(Math.max(Number(a.costUsd ?? 0), Number(a.meteredUsd ?? 0)))}`);
    console.log(`      asked: "${safe(promptOf.get(a.id) ?? "")}"`);
  }

  // 5. The players' first-game ideas, each game once (what they wanted to make).
  console.log("\n== Games (first idea, versions, sharing) ==");
  for (const p of projects.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
    const first = messages.find((m) => m.projectId === p.id && m.role === "user");
    const plays = p.plays.reduce((s, c) => s + c.count, 0);
    const pics = messages.filter((m) => m.projectId === p.id && m.attachments.length).length;
    console.log(`  ${p.id}  ${day(p.createdAt)}  ${label.get(p.ownerId)}  "${safe(p.name, 40)}"  ${p.genre ?? p.pickedGenre ?? "-"}${p.tags.length ? ` [${p.tags.join(",")}]` : ""} ${p.platform ?? "-"}  v${p.currentVersion ?? "-"} (${p.versions.length} versions)${p.shared ? `, shared${p.listed ? " + gallery" : ""}, ${plays} plays` : ""}${p.members.length ? `, ${p.members.length} member(s)` : ""}${pics ? `, ${pics} message(s) with pictures` : ""}`);
    if (first) console.log(`      "${safe(first.text, 200)}"`);
  }

  // 6. The days.
  console.log("\n== Days (players' answers) ==");
  const days = new Map<string, typeof answers>();
  for (const a of answers) days.set(day(a.createdAt), [...(days.get(day(a.createdAt)) ?? []), a]);
  for (const [d, list] of [...days.entries()].sort()) {
    const people = new Set(list.map((a) => a.authorId)).size;
    const spent = list.reduce((s, a) => s + Math.max(Number(a.costUsd ?? 0), Number(a.meteredUsd ?? 0)), 0);
    const credits = list.reduce((s, a) => s + Number(a.credits ?? 0), 0);
    console.log(`  ${d}  ${String(people).padStart(2)} people  ${String(list.length).padStart(3)} answers  built ${list.filter((a) => endOf(a) === "built").length}, failed or stopped ${list.filter((a) => !["built", "asked", "answer", "busy"].includes(endOf(a))).length}  AI ${usd(spent)}  credits ${credits.toFixed(1)}`);
  }

  // 7. TypePlay's own fixes to players' games, and Android.
  const fixes = messages.filter((m) => m.role === "agent" && ours(m));
  console.log(`\n== TypePlay's own fixes (admin run): ${fixes.length}, AI ${usd(fixes.reduce((s, a) => s + Math.max(Number(a.costUsd ?? 0), Number(a.meteredUsd ?? 0)), 0))} ==`);
  const byStatus: Record<string, number> = {};
  for (const b of android) byStatus[`${b.format} ${b.status}${b.failCode ? ` (${b.failCode})` : ""}`] = (byStatus[`${b.format} ${b.status}${b.failCode ? ` (${b.failCode})` : ""}`] ?? 0) + 1;
  console.log(`== Android builds: ${android.length}${android.length ? `: ${Object.entries(byStatus).map(([k, v]) => `${k} ${v}`).join(", ")}` : ""} ==`);

  await freeUse(prisma, users, messages, since);

  await ledger.audit(prisma, { actor, userId: null, action: "stats", details: { since: sinceText ?? null, accounts: users.length } });
}

/**
 * 8. The Free plan (beta 2 lets the closed-beta page's sign-ins in on Free, 2026-11-19; its size is set from this): each
 * account's Free use against the plan's credits at sign-up and each month and its daily cap (credits.ts), counted as the
 * daily limit counts it (charges by UTC day, ledger.service `balance`), on runs that started on Free (Message.plan).
 * "Out for the day": less left than the cheapest run's low estimate (a Fast change at low effort); "too short for a new
 * game": less than a Fast new game's lowest. Read only.
 */
async function freeUse(prisma: PrismaClient, users: User[], messages: Message[], since: Date): Promise<void> {
  const runs = messages.filter((m) => m.role === "agent" && m.plan === "free");
  const ids = new Set([...users.filter((u) => u.plan === "free").map((u) => u.id), ...runs.map((m) => m.authorId ?? "")]);
  const people = users.filter((u) => ids.has(u.id));
  const freeIds = new Set(runs.map((m) => m.id));
  const charges = await prisma.creditEntry.findMany({
    where: { userId: { in: people.map((u) => u.id) }, kind: "charge", createdAt: { gte: since } },
    select: { userId: true, tenths: true, amount: true, messageId: true, createdAt: true },
  });
  const buckets = await prisma.creditBucket.findMany({ where: { userId: { in: people.map((u) => u.id) }, source: "free", closedAt: null } });
  const spendDays = await prisma.freeSpend.findMany({ where: { day: { gte: since } }, orderBy: { day: "asc" } });
  const used = (c: { tenths: number | null; amount: unknown }) => -(c.tenths ?? Math.round(Number(c.amount) * 10)); // charges are negative
  const cheapest = toTenths(estimate("edit", "fast", "free", "low").low);
  const newGame = toTenths(estimate("new", "fast", "free", "low").low);
  const daily = toTenths(FREE_DAILY_CREDITS);
  const dayOf = (at: Date, from: Date) => Math.floor((at.getTime() - startOfUtcDay(from).getTime()) / 86_400_000) + 1; // 1 = the sign-up day
  // A built answer's kind as section 3 counts it: a first build while its game has no version yet, a change after.
  const built = new Map<string, Date[]>();
  for (const m of messages) if (m.role === "agent" && m.status === "done" && m.versionN != null) built.set(m.projectId, [...(built.get(m.projectId) ?? []), m.createdAt]);
  const isChange = (a: Message) => (built.get(a.projectId) ?? []).some((t) => t < a.createdAt);

  console.log(`\n== The Free plan: ${FREE_SIGNUP_CREDITS} credits at sign-up and ${FREE_MONTHLY_CREDITS} each month, at most ${FREE_DAILY_CREDITS} a day, Fast only ==`);
  if (!people.length) console.log("  no account on Free, and no run on Free");
  const rows: { tenths: number; usd: number; first30: number; outOn: number | null; capDays: number }[] = [];
  for (const u of people) {
    const mine = runs.filter((m) => m.authorId === u.id);
    // The charges the daily limit counted: the account's own on Free runs (on Free now: any not tied to a message too).
    const own = charges
      .filter((c) => c.userId === u.id && (c.messageId ? freeIds.has(c.messageId) : u.plan === "free"))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const byDay = new Map<string, number>();
    for (const c of own) byDay.set(day(c.createdAt), (byDay.get(day(c.createdAt)) ?? 0) + used(c));
    const perDay = [...byDay.values()];
    const tenths = perDay.reduce((s, t) => s + t, 0);
    const spent = mine.reduce((s, a) => s + Math.max(Number(a.costUsd ?? 0), Number(a.meteredUsd ?? 0)), 0);
    // The first 30 days after sign-up against the sign-up's credits: how much, and the day they ran out.
    const end30 = u.createdAt.getTime() + 30 * 86_400_000;
    let first30 = 0;
    let outOn: number | null = null;
    for (const c of own) {
      if (c.createdAt.getTime() >= end30) break;
      first30 += used(c);
      if (outOn == null && toTenths(FREE_SIGNUP_CREDITS) - first30 < cheapest) outOn = dayOf(c.createdAt, u.createdAt);
    }
    const capDays = perDay.filter((t) => daily - t < cheapest).length;
    const shortDays = perDay.filter((t) => daily - t < newGame).length;
    const ends: Record<string, number> = {};
    for (const a of mine) {
      const e = endOf(a);
      const k = e === "built" ? (isChange(a) ? "change" : "new game") : e;
      ends[k] = (ends[k] ?? 0) + 1;
    }
    const bucket = buckets.filter((b) => b.userId === u.id).sort((a, b) => (b.expiresAt?.getTime() ?? 0) - (a.expiresAt?.getTime() ?? 0))[0];
    const now = Date.now() < end30 ? ` (day ${dayOf(new Date(), u.createdAt)} now)` : "";
    const left = bucket
      ? `; now ${fromTenths(bucket.remainingTenths).toFixed(1)} of this month's ${fromTenths(bucket.grantedTenths)} left${bucket.expiresAt ? `, ${FREE_MONTHLY_CREDITS} more on ${day(bucket.expiresAt)}` : ""}`
      : "";
    console.log(`${u.email}  ${u.plan === "free" ? "Free" : `now ${u.plan}`}, signed up ${day(u.createdAt)}`);
    console.log(`    Free runs ${mine.length}: ${Object.entries(ends).map(([k, v]) => `${k} ${v}`).join(", ") || "none"}; AI ${usd(spent)}`);
    console.log(
      `    credits on Free ${fromTenths(tenths).toFixed(1)} on ${perDay.length} day(s), a day's most ${fromTenths(Math.max(0, ...perDay)).toFixed(1)} of ${FREE_DAILY_CREDITS}; days out of the day's ${FREE_DAILY_CREDITS} ${capDays}, days too short for a new game ${shortDays}`,
    );
    console.log(`    first 30 days: ${fromTenths(first30).toFixed(1)} of the first ${FREE_SIGNUP_CREDITS}${outOn ? `, out on day ${outOn}` : ""}${now}${left}`);
    if (mine.length) rows.push({ tenths, usd: spent, first30, outOn, capDays });
  }
  if (rows.length) {
    const credits = rows.map((r) => fromTenths(r.tenths));
    const first30 = rows.map((r) => fromTenths(r.first30));
    const spent = rows.map((r) => r.usd);
    const out = rows.filter((r) => r.outOn != null);
    console.log(`  Free accounts ${people.length}, with a Free run ${rows.length}`);
    console.log(
      `  per account with a run: credits on Free median ${median(credits)?.toFixed(1)} / p90 ${quantile(credits, 0.9)?.toFixed(1)}; first 30 days median ${median(first30)?.toFixed(1)} of ${FREE_SIGNUP_CREDITS}; AI median ${usd(median(spent) ?? 0)}, all ${usd(spent.reduce((s, x) => s + x, 0))}`,
    );
    console.log(
      `  out of the first ${FREE_SIGNUP_CREDITS} within 30 days: ${out.length} of ${rows.length}${out.length ? ` (on day ${out.map((r) => r.outOn).join(", ")})` : ""}; out of a day's ${FREE_DAILY_CREDITS} at least once: ${rows.filter((r) => r.capDays).length} of ${rows.length}`,
    );
  } else if (people.length) console.log(`  Free accounts ${people.length}, none with a Free run yet`);
  const spend = spendDays.filter((d) => Number(d.usd) > 0);
  console.log(`  Free AI by UTC day (Free builds pause for everyone at ${usd(FREE_DAILY_AI_USD)}): ${spend.map((d) => `${day(d.day)} ${usd(Number(d.usd))}`).join(", ") || "none"}`);
}
