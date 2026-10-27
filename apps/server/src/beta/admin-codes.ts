// `admin code …` (src/admin.ts): the closed beta's codes (codes.ts). Every command writes a BillingAudit row (actor
// "admin:<name>"); no email goes into it.
//   code add [123456] [--uses 20] [--credits 50] [--plan P] [note]   a new code (six digits, random when none is given);
//                                                         --plan: the accounts it lets in get that plan (if theirs is lower)
//   code set <code> [--uses N] [--credits N] [--plan P]   change a code; it counts for the next accounts only
//   code list                                             every code: uses so far, credits, plan, the accounts it let in
//   code remove <code>                                    it stops working; the accounts it let in stay
import { randomInt } from "node:crypto";
import { PLANS } from "../credits/credits.js";
import type { LedgerService } from "../credits/ledger.service.js";
import type { PrismaClient } from "../generated/prisma/client.js";
import type { PlanId } from "@typeplay/shared";

export const CODE_USAGE = "admin code add [123456] [--uses 20] [--credits 50] [--plan P] [note] | code set <code> [--uses N] [--credits N] [--plan P] | code list | code remove <code>";
export const CODE_DEFAULTS = { uses: 20, credits: 50 } as const;
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "-");
/** Words safe to print in a terminal: one line, no control characters, cut short. */
const safe = (s: string, max = 120) => s.replace(/[\p{Cc}\p{Cf}]+/gu, " ").slice(0, max);

function wholeNumber(flag: string, raw: string | undefined, min: number, max: number): number {
  const n = Number(raw);
  if (!raw || !Number.isInteger(n) || n < min || n > max) throw new Error(`${flag}: a whole number from ${min} to ${max} (usage: ${CODE_USAGE})`);
  return n;
}

/** A plan for a code; Free is no plan (null), so `--plan free` takes one off. */
function codePlan(raw: string | undefined): PlanId | null {
  if (!PLANS.includes(raw as PlanId)) throw new Error(`--plan: one of ${PLANS.join(", ")} (usage: ${CODE_USAGE})`);
  return raw === "free" ? null : (raw as PlanId);
}

export async function codeAdmin(prisma: PrismaClient, ledger: LedgerService, args: string[], actor: string): Promise<void> {
  const [what, ...rest] = args;
  if (what === "add") {
    let code: string | null = null;
    let uses: number = CODE_DEFAULTS.uses;
    let credits: number = CODE_DEFAULTS.credits;
    let plan: PlanId | null = null;
    const words: string[] = [];
    for (let i = 0; i < rest.length; i++) {
      const a = rest[i];
      if (a === "--uses") uses = wholeNumber("--uses", rest[++i], 1, 10_000);
      else if (a === "--credits") credits = wholeNumber("--credits", rest[++i], 0, 10_000);
      else if (a === "--plan") plan = codePlan(rest[++i]);
      else if (/^\d{6}$/.test(a) && code === null && !words.length) code = a;
      else if (/^\d+$/.test(a) && code === null && !words.length) throw new Error(`a beta code is six digits, not ${a.length}`);
      else if (a.startsWith("--")) throw new Error(`unknown option ${a} (usage: ${CODE_USAGE})`);
      else words.push(a);
    }
    if (code !== null && (await prisma.betaCode.findUnique({ where: { code } }))) throw new Error(`${code} exists already: pick another, or none for a random one`);
    for (let tries = 0; code === null && tries < 20; tries++) {
      const candidate = String(randomInt(0, 1_000_000)).padStart(6, "0");
      if (!(await prisma.betaCode.findUnique({ where: { code: candidate } }))) code = candidate;
    }
    if (code === null) throw new Error("no free six-digit code found in 20 tries");
    const note = safe(words.join(" ").trim(), 200) || null;
    await prisma.betaCode.create({ data: { code, uses, credits, plan, note } });
    await ledger.audit(prisma, { actor, userId: null, action: "code_add", details: { code, uses, credits, plan } });
    console.log(`${code}: lets in ${uses} account${uses === 1 ? "" : "s"}, ${credits} credits each${plan ? `, plan ${plan}` : ""}${note ? ` ("${note}")` : ""}.`);
    console.log("Testers sign in with Google at https://typeplay.app/create and type it on the closed-beta page.");
    return;
  }
  if (what === "set") {
    const [code = "", ...flags] = rest;
    if (!/^\d{6}$/.test(code)) throw new Error(`usage: ${CODE_USAGE}`);
    const row = await prisma.betaCode.findUnique({ where: { code } });
    if (!row || row.removedAt) throw new Error(`${code} is not a working code`);
    const data: { uses?: number; credits?: number; plan?: PlanId | null } = {};
    for (let i = 0; i < flags.length; i++) {
      const a = flags[i];
      if (a === "--uses") data.uses = wholeNumber("--uses", flags[++i], Math.max(1, row.used), 10_000);
      else if (a === "--credits") data.credits = wholeNumber("--credits", flags[++i], 0, 10_000);
      else if (a === "--plan") data.plan = codePlan(flags[++i]);
      else throw new Error(`unknown option ${a} (usage: ${CODE_USAGE})`);
    }
    if (!Object.keys(data).length) throw new Error(`nothing to change (usage: ${CODE_USAGE})`);
    await prisma.betaCode.update({ where: { code }, data });
    await ledger.audit(prisma, {
      actor,
      userId: null,
      action: "code_set",
      details: { code, from: { uses: row.uses, credits: row.credits, plan: row.plan }, to: { uses: data.uses ?? row.uses, credits: data.credits ?? row.credits, plan: data.plan === undefined ? row.plan : data.plan } },
    });
    const now = await prisma.betaCode.findUniqueOrThrow({ where: { code } });
    console.log(`${code}: ${now.uses} uses (${now.used} taken), ${now.credits} credits each${now.plan ? `, plan ${now.plan}` : ""}. Accounts it let in already keep what they got (admin plan | grant changes one).`);
    return;
  }
  if (what === "list") {
    const codes = await prisma.betaCode.findMany({ orderBy: { createdAt: "asc" }, include: { accounts: { orderBy: { usedAt: "asc" } } } });
    if (!codes.length) console.log(`no codes yet (${CODE_USAGE.split(" | ")[0]})`);
    for (const c of codes) {
      const state = c.removedAt ? `removed ${day(c.removedAt)}` : c.used >= c.uses ? "used up" : "works";
      console.log(`${c.code}  ${c.used} of ${c.uses} used, ${c.credits} credits each${c.plan ? `, plan ${c.plan}` : ""}, made ${day(c.createdAt)}, ${state}${c.note ? `  "${safe(c.note)}"` : ""}`);
      for (const a of c.accounts) console.log(`        ${a.match.padEnd(36)} ${day(a.usedAt)}${a.grantedAt ? "" : "  (credits not added yet: they come at the next code check)"}`);
    }
    await ledger.audit(prisma, { actor, userId: null, action: "code_list", details: { codes: codes.length } });
    return;
  }
  if (what === "remove") {
    const code = rest[0] ?? "";
    if (!/^\d{6}$/.test(code)) throw new Error(`usage: ${CODE_USAGE}`);
    const row = await prisma.betaCode.findUnique({ where: { code } });
    if (!row || row.removedAt) throw new Error(`${code} is not a working code`);
    await prisma.betaCode.update({ where: { code }, data: { removedAt: new Date() } });
    await ledger.audit(prisma, { actor, userId: null, action: "code_remove", details: { code, used: row.used } });
    console.log(`${code}: removed. It no longer works; the ${row.used} account${row.used === 1 ? "" : "s"} it let in stay (invite remove <email> takes one out).`);
    return;
  }
  throw new Error(`usage: ${CODE_USAGE}`);
}
