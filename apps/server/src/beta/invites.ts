// The closed beta (beta 1, PLAN.md package 6): with BETA_INVITE_ONLY on, only invited emails (the Invite table, filled by
// `admin invite add`) and ADMIN_EMAILS get past the sign-in. Anyone else is 403 invite_only on every signed-in route, and
// no user row is made, so no Free credits go to strangers. The check runs on every request (auth.service.ts), before the
// user row: removing an invite locks the account out again at once (its games and credits stay).
import { Injectable } from "@nestjs/common";
import { ApiException } from "../common/api-error.js";
import { config } from "../env.js";
import { PrismaService } from "../prisma.js";

/** The site shows its closed-beta screen on this code (apps/web, components/app/ClosedBeta.tsx). */
export const inviteOnly = () =>
  new ApiException(403, "invite_only", "TypePlay is in a closed beta for now, and this account isn't on the invite list.");

const GMAIL = new Set(["gmail.com", "googlemail.com"]);

/**
 * What an email is matched on: lower-cased, and for Gmail without the dots and a +tag in the name (Gmail ignores both,
 * so "Luka.L+beta@Gmail.com" and the luka.l@gmail.com Google signs in with are one address). Other domains as they are.
 */
export function inviteMatch(email: string): string {
  const address = email.trim().toLowerCase();
  const at = address.lastIndexOf("@");
  if (at < 1) return address;
  const domain = address.slice(at + 1);
  if (!GMAIL.has(domain)) return address;
  return `${address.slice(0, at).split("+")[0].replace(/\./g, "")}@gmail.com`;
}

@Injectable()
export class InviteService {
  constructor(private readonly prisma: PrismaService) {}

  /** Passes when the closed beta is off, for ADMIN_EMAILS, and for an invited email (its first use is noted); else 403. */
  async check(email: string): Promise<void> {
    if (!(await this.allowed(email))) throw inviteOnly();
  }

  /** Whether the email gets past the closed beta: it is off, an admin, or invited (an invite's first use is noted). */
  async allowed(email: string): Promise<boolean> {
    if (!config.betaInviteOnly || config.adminEmails.includes(email)) return true;
    const match = inviteMatch(email);
    const invite = await this.prisma.invite.findUnique({ where: { match }, select: { usedAt: true } });
    if (!invite) return false;
    if (!invite.usedAt) await this.prisma.invite.updateMany({ where: { match, usedAt: null }, data: { usedAt: new Date() } });
    return true;
  }
}
