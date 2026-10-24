// `admin code …` (src/admin.ts): the closed beta's codes (codes.ts). Every command writes a BillingAudit row (actor
// "admin:<name>"); no email goes into it.
//   code add [123456] [--uses 20] [--credits 50] [note]   a new code (six digits, random when none is given)
//   code list                                             every code: uses so far, credits, the accounts it let in
//   code remove <code>                                    it stops working; the accounts it let in stay
import { randomInt } from "node:crypto";
import type { LedgerService } from "../credits/ledger.service.js";
import type { PrismaClient } from "../generated/prisma/client.js";

export const CODE_USAGE = "admin code add [123456] [--uses 20] [--credits 50] [note] | code list | code remove <code>";
export const CODE_DEFAULTS = { uses: 20, credits: 50 } as const;
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "-");
/** Words safe to print in a terminal: one line, no control characters, cut short. */
const safe = (s: string, max = 120) => s.replace(/[\p{Cc}\p{Cf}]+/gu, " ").slice(0, max);

function wholeNumber(flag: string, raw: string | undefined, min: number, max: number): number {
  const n = Number(raw);
  if (!raw || !Number.isInteger(n) || n < min || n > max) throw new Error(`${flag}: a whole number from ${min} to ${max} (usage: ${CODE_USAGE})`);
  return n;
}

export async function codeAdmin(prisma: PrismaClient, ledger: LedgerService, args: string[], actor: string): Promise<void> {
  const [what, ...rest] = args;
  if (what === "add") {
    let code: string | null = null;
    let uses: number = CODE_DEFAULTS.uses;
    let credits: number = CODE_DEFAULTS.credits;
    const words: string[] = [];
    for (let i = 0; i < rest.length; i++) {
      const a = rest[i];
      if (a === "--uses") uses = wholeNumber("--uses", rest[++i], 1, 10_000);
      else if (a === "--credits") credits = wholeNumber("--credits", rest[++i], 0, 10_000);
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
    await prisma.betaCode.create({ data: { code, uses, credits, note } });
    await ledger.audit(prisma, { actor, userId: null, action: "code_add", details: { code, uses, credits } });
    console.log(`${code}: lets in ${uses} account${uses === 1 ? "" : "s"}, ${credits} credits each${note ? ` ("${note}")` : ""}.`);
    console.log("Testers sign in with Google at https://typeplay.app/create and type it on the closed-beta page.");
    return;
  }
  if (what === "list") {
    const codes = await prisma.betaCode.findMany({ orderBy: { createdAt: "asc" }, include: { accounts: { orderBy: { usedAt: "asc" } } } });
    if (!codes.length) console.log(`no codes yet (${CODE_USAGE.split(" | ")[0]})`);
    for (const c of codes) {
      const state = c.removedAt ? `removed ${day(c.removedAt)}` : c.used >= c.uses ? "used up" : "works";
      console.log(`${c.code}  ${c.used} of ${c.uses} used, ${c.credits} credits each, made ${day(c.createdAt)}, ${state}${c.note ? `  "${safe(c.note)}"` : ""}`);
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
