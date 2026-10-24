// Who is calling: a Supabase access token (Google sign-in), verified against the project's JWKS,
// or, when the project has no signing keys (legacy HS256), checked with Supabase's /auth/v1/user.
// The user row is created on first use with the Free plan's 20 credits (unless the same email closed
// an account in the last 90 days: tombstone.ts). In the closed beta (BETA_INVITE_ONLY) an email that
// isn't invited is refused first, 403 invite_only, and no row is made (beta/invites.ts).
// Dev only (DEV_AUTH=1, never in production): `Bearer dev:<email>` signs in a test user "dev-<slug>".
import { createHash } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify, type JWTPayload } from "jose";
import { InviteService } from "../beta/invites.js";
import { unauthorized } from "../common/api-error.js";
import { FREE_SIGNUP_CREDITS, toTenths } from "../credits/credits.js";
import { monthLater } from "../credits/ledger-math.js";
import { LedgerService } from "../credits/ledger.service.js";
import { config } from "../env.js";
import type { User } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma.js";
import { emailHash, TOKEN_GRACE_MS, TOMBSTONE_DAYS } from "./tombstone.js";

export interface Identity {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

const issuer = `${config.supabaseUrl}/auth/v1`;
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Dev sign-in's test user (`dev:<email>`): id "dev-<slug>". */
function devIdentity(rawEmail: string): Identity {
  const email = rawEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+$/.test(email) || email.length > 200) throw unauthorized("Dev sign-in needs dev:<email>.");
  const slug = email.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return { id: `dev-${slug}`, email, name: email.split("@")[0], avatarUrl: null };
}

function identityFrom(sub: unknown, email: unknown, meta: unknown): Identity {
  const m = (meta && typeof meta === "object" ? meta : {}) as Record<string, unknown>;
  const id = str(sub);
  const mail = str(email);
  if (!id || !mail) throw unauthorized();
  return {
    id,
    email: mail.toLowerCase(),
    name: str(m.full_name) ?? str(m.name),
    avatarUrl: str(m.avatar_url) ?? str(m.picture),
  };
}

@Injectable()
export class AuthService {
  private readonly log = new Logger("auth");
  private readonly jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`), { cacheMaxAge: 10 * 60_000 });
  private jwksHasKeys: { value: boolean; until: number } | null = null;
  /** Legacy path: token hash -> identity, for a minute, so each request doesn't call Supabase. */
  private readonly checked = new Map<string, { identity: Identity; until: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly invites: InviteService,
  ) {}

  async userFromToken(token: string): Promise<User> {
    const who = await this.identityFromToken(token);
    // The closed beta: an email that isn't invited stops here, before its user row (and the Free credits) exists.
    await this.invites.check(who.email);
    return this.ensureUser(who);
  }

  /** Who a token says, verified, before the closed beta's check and without a user row (POST /beta/code). */
  async identityFromToken(token: string): Promise<Identity> {
    return config.devAuth && !config.production && token.startsWith("dev:") ? devIdentity(token.slice(4)) : this.verify(token);
  }

  /**
   * The account is being closed: its tombstone is written (tombstone.ts), so from here on its old
   * sign-in tokens are refused and the email gets no second signup grant. Old tombstones go.
   */
  async forget(user: Pick<User, "id" | "email">) {
    await this.prisma.closedAccount.deleteMany({ where: { closedAt: { lt: new Date(Date.now() - TOMBSTONE_DAYS * 86_400_000) } } });
    await this.prisma.closedAccount.upsert({
      where: { id: user.id },
      create: { id: user.id, emailHash: emailHash(user.email) },
      update: { emailHash: emailHash(user.email), closedAt: new Date() },
    });
    for (const [k, v] of this.checked) if (v.identity.id === user.id) this.checked.delete(k);
  }

  /** Closing the account failed: it is still there, so its tokens work again. */
  async remember(userId: string) {
    await this.prisma.closedAccount.deleteMany({ where: { id: userId } });
  }

  /** Whether an account with this email was closed in the last 90 days (then no signup credits). */
  async closedRecently(email: string): Promise<boolean> {
    const row = await this.prisma.closedAccount.findFirst({
      where: { emailHash: emailHash(email), closedAt: { gt: new Date(Date.now() - TOMBSTONE_DAYS * 86_400_000) } },
      select: { id: true },
    });
    return !!row;
  }

  private async verify(token: string): Promise<Identity> {
    let alg: string | undefined;
    try {
      alg = decodeProtectedHeader(token).alg;
    } catch {
      throw unauthorized();
    }
    if (alg !== "HS256" && (await this.hasSigningKeys())) {
      let payload: JWTPayload;
      try {
        ({ payload } = await jwtVerify(token, this.jwks, { issuer, audience: "authenticated" }));
      } catch {
        throw unauthorized();
      }
      return identityFrom(payload.sub, payload.email, payload.user_metadata);
    }
    return this.viaUserEndpoint(token);
  }

  /** Whether the project publishes signing keys (asymmetric JWTs); checked every 10 minutes. */
  private async hasSigningKeys(): Promise<boolean> {
    if (this.jwksHasKeys && this.jwksHasKeys.until > Date.now()) return this.jwksHasKeys.value;
    let value = true; // on a network error let jose try (and fail) rather than guess
    try {
      const res = await fetch(`${issuer}/.well-known/jwks.json`);
      if (res.ok) value = (((await res.json()) as { keys?: unknown[] }).keys?.length ?? 0) > 0;
    } catch (e) {
      this.log.warn(`JWKS fetch failed: ${(e as Error).message}`);
    }
    this.jwksHasKeys = { value, until: Date.now() + 10 * 60_000 };
    return value;
  }

  private async viaUserEndpoint(token: string): Promise<Identity> {
    const key = createHash("sha256").update(token).digest("hex");
    const hit = this.checked.get(key);
    if (hit && hit.until > Date.now()) return hit.identity;
    let res: Response;
    try {
      res = await fetch(`${issuer}/user`, {
        headers: { apikey: config.supabasePublishableKey, Authorization: `Bearer ${token}` },
      });
    } catch {
      throw unauthorized();
    }
    if (!res.ok) throw unauthorized();
    const u = (await res.json()) as { id?: string; email?: string; user_metadata?: unknown };
    const identity = identityFrom(u.id, u.email, u.user_metadata);
    if (this.checked.size > 1000) for (const [k, v] of this.checked) if (v.until <= Date.now()) this.checked.delete(k);
    this.checked.set(key, { identity, until: Date.now() + 60_000 });
    return identity;
  }


  /** The user row, created on first use with the Free plan's signup credits (a `free` bucket that
   * ends a month on, when the next month's 20 arrive: ledger.service `settle`). */
  async ensureUser(who: Identity): Promise<User> {
    const found = await this.prisma.user.findUnique({ where: { id: who.id } });
    if (found) {
      if (found.email !== who.email || (who.name && found.name !== who.name) || (who.avatarUrl && found.avatarUrl !== who.avatarUrl)) {
        return this.prisma.user.update({
          where: { id: who.id },
          data: { email: who.email, name: who.name ?? found.name, avatarUrl: who.avatarUrl ?? found.avatarUrl },
        });
      }
      return found;
    }
    // No row: a closed account's token (valid up to an hour after the close) must not bring it back,
    // and an email that closed an account in the last 90 days signs up without the free credits.
    const tomb = await this.prisma.closedAccount.findUnique({ where: { id: who.id } });
    if (tomb && tomb.closedAt.getTime() > Date.now() - TOKEN_GRACE_MS) throw unauthorized("This account was deleted.");
    const signupCredits = !(await this.closedRecently(who.email));
    try {
      return await this.prisma.$transaction(async (tx) => {
        const now = new Date();
        const cycleEnds = monthLater(now);
        // The row just made is ours for the rest of the transaction (no lock needed). Without the
        // signup credits the Free month still starts: the next 20 come a month on, as for anyone.
        const user = await tx.user.create({ data: { ...who, createdAt: now, freeCycleEndsAt: cycleEnds, nextSettleAt: cycleEnds } });
        if (signupCredits) {
          await this.ledger.grantIn(tx, user.id, { source: "free", tenths: toTenths(FREE_SIGNUP_CREDITS), expiresAt: cycleEnds, note: "Free plan" }, now, { settled: true });
        } else this.log.log(`user ${user.id}: no signup credits (an account with this email was closed recently)`);
        return user;
      });
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002") throw e;
      // Two first requests at once, or the email belongs to another account.
      const again = await this.prisma.user.findUnique({ where: { id: who.id } });
      if (again) return again;
      throw unauthorized("This email already belongs to another account.");
    }
  }
}
