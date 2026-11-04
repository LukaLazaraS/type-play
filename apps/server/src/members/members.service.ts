// Pair developing (2026-11-04; docs/design/pair-developing.md): who is in a game besides its owner, the invitations, and
// leaving. The owner invites one email at a time (a link only that address's account can use, 7 days); the invited
// person accepts or declines signed in with it; the owner removes anyone, a member leaves. Each change is told on the
// game's stream ({ type: "people" }; { type: "people", invites: true } when only an invitation changed); someone taken
// out hears { type: "removed" } and loses their stream, and a build they asked for that is still going or waiting stops
// (nothing charged): their access is gone, and the owner pays.
import { createHash, randomBytes } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import type { GamePeople, Invitation, InviteLink, PendingInvite } from "@typeplay/shared";
import { AccessService, PERSON, personOf } from "../access/access.service.js";
import { inviteMatch } from "../beta/invites.js";
import { ApiException, badRequest, notFound } from "../common/api-error.js";
import { fromTenths, toTenths } from "../credits/credits.js";
import { EventBus } from "../events/event-bus.js";
import type { Project, ProjectInvite, User, Version } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma.js";
import { BuildQueue } from "../runs/queue.service.js";
import { RunRegistry } from "../runs/registry.js";
import { RunsService } from "../runs/runs.service.js";

/** People a game can have besides its owner, invitations waiting included. */
export const MAX_PEOPLE = 10;
/** How long an invitation's link works. */
export const INVITE_DAYS = 7;
/** New invitation links an owner may make in a day, all games together: a guard (we send no email: the owner sends them). */
export const LINKS_PER_DAY = 30;
/** Invitation links one account may open in an hour (GET /invites/link/:token): a guard against guessing them. */
const LOOKUPS_PER_HOUR = 60;
/** Invitations past their end are kept this long (the owner's list says "ended"), then deleted. */
const ENDED_KEPT_DAYS = 30;

const DAY_MS = 24 * 60 * 60_000;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** One address: no spaces, one @, a dot in the domain; 254 letters at most (RFC 5321). */
const EMAIL = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;

const ENDED = "This invitation has ended: it was answered, taken back or replaced, or its 7 days are over. Ask for a new link.";

const hashOf = (token: string) => createHash("sha256").update(token).digest("hex");

/** "a•••@gmail.com": enough to know which account to sign in with, not the whole address. */
export function halfHidden(email: string): string {
  const at = email.lastIndexOf("@");
  return at < 1 ? "•••" : `${email[0]}•••${email.slice(at)}`;
}

const pendingOf = (i: ProjectInvite): PendingInvite => ({
  id: i.id,
  email: i.email,
  role: i.role,
  sentAt: i.sentAt.toISOString(),
  expiresAt: i.expiresAt.toISOString(),
});

type InviteRow = ProjectInvite & { project: Project & { versions: Version[]; owner: Pick<User, "id" | "name" | "email" | "avatarUrl"> } };
const WITH_GAME = { project: { include: { versions: { orderBy: { n: "desc" as const }, take: 1 }, owner: { select: PERSON } } } };

function invitationOf(r: InviteRow): Invitation {
  const v = r.project.versions[0];
  return {
    id: r.id,
    game: { id: r.project.id, name: r.project.name, buildId: v?.buildId ?? null, poster: !!v?.poster, orientation: r.project.orientation },
    owner: personOf(r.project.owner),
    role: r.role,
    expiresAt: r.expiresAt.toISOString(),
  };
}

@Injectable()
export class MembersService {
  private readonly log = new Logger("members");
  /** Per account: when it opened invitation links in the last hour. */
  private readonly lookups = new Map<string, number[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly events: EventBus,
    private readonly registry: RunRegistry,
    private readonly runs: RunsService,
    private readonly queue: BuildQueue,
  ) {}

  /** Everyone in the game; the owner also gets each member's email and credits this month, and the invitations. */
  async people(user: User, projectId: string): Promise<GamePeople> {
    const { project, role } = await this.access.game(user.id, projectId, "view");
    const owner = await this.prisma.user.findUniqueOrThrow({ where: { id: project.ownerId }, select: PERSON });
    const members = await this.prisma.projectMember.findMany({ where: { projectId: project.id }, orderBy: { createdAt: "asc" }, include: { user: { select: PERSON } } });
    const view: GamePeople = {
      owner: personOf(owner),
      members: members.map((m) => ({ ...personOf(m.user), role: m.role, since: m.createdAt.toISOString() })),
      max: MAX_PEOPLE,
    };
    if (role !== "owner") return view;
    // What each member's messages here cost the owner since the 1st of this month (UTC): Lovable's People column.
    const month = new Date();
    month.setUTCDate(1);
    month.setUTCHours(0, 0, 0, 0);
    const spent = await this.prisma.message.groupBy({
      by: ["authorId"],
      where: { projectId: project.id, role: "agent", createdAt: { gte: month }, authorId: { in: members.map((m) => m.userId) } },
      _sum: { credits: true },
    });
    const byAuthor = new Map(spent.map((s) => [s.authorId, Number(s._sum.credits ?? 0)]));
    view.members = members.map((m, i) => ({ ...view.members[i], email: m.user.email, spentMonth: fromTenths(toTenths(byAuthor.get(m.userId) ?? 0)) }));
    const invites = await this.prisma.projectInvite.findMany({ where: { projectId: project.id, acceptedAt: null }, orderBy: { sentAt: "desc" } });
    view.invites = invites.map(pendingOf);
    return view;
  }

  /**
   * Invites one address to build the game (the owner only). An invitation already waiting for it gets a new link (the
   * old one stops working). Checked and written under the game's row lock, so two invitations at once can't pass the
   * limit together. The link's secret is returned once; only its hash is kept.
   */
  async invite(user: User, projectId: string, body: unknown): Promise<InviteLink> {
    const { project } = await this.access.game(user.id, projectId, "owner", "Only the game's owner can invite people.");
    const raw = (body as { email?: unknown } | null)?.email;
    const email = typeof raw === "string" ? raw.trim().toLowerCase() : "";
    if (email.length > 254 || !EMAIL.test(email)) throw badRequest("Type the email address of the person to invite.");
    const match = inviteMatch(email);
    if (match === inviteMatch(user.email)) throw badRequest("That's your own address: this game is yours already.");
    await this.assertLinksLeft(user.id);
    const token = randomBytes(32).toString("base64url");
    const now = new Date();
    const invite = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Project" WHERE id = ${project.id} FOR UPDATE`;
      // Invitations long past their end go (the list keeps them a while as "ended"); an accepted one stays while its person is in.
      await tx.projectInvite.deleteMany({ where: { projectId: project.id, acceptedAt: null, expiresAt: { lt: new Date(now.getTime() - ENDED_KEPT_DAYS * DAY_MS) } } });
      const members = await tx.projectMember.findMany({ where: { projectId: project.id }, include: { user: { select: { email: true } } } });
      if (members.some((m) => inviteMatch(m.user.email) === match)) throw badRequest("They're in this game already.");
      // The address's row, waiting or once accepted (they left since: a new invitation, waiting again).
      const waiting = await tx.projectInvite.findUnique({ where: { projectId_match: { projectId: project.id, match } } });
      const live = await tx.projectInvite.count({ where: { projectId: project.id, acceptedAt: null, expiresAt: { gt: now }, NOT: { match } } });
      if (members.length + live >= MAX_PEOPLE) {
        throw badRequest(`A game can have ${MAX_PEOPLE} people besides its owner, invitations waiting included. Take one back or remove someone first.`);
      }
      const data = { email, tokenHash: hashOf(token), sentAt: now, expiresAt: new Date(now.getTime() + INVITE_DAYS * DAY_MS), acceptedAt: null };
      const row = waiting
        ? await tx.projectInvite.update({ where: { id: waiting.id }, data })
        : await tx.projectInvite.create({ data: { projectId: project.id, match, ...data } });
      return row;
    });
    this.log.log(`game ${project.id}: an invitation link made`); // never the address or the link
    this.events.emit(project.id, { type: "people", invites: true });
    return { invite: pendingOf(invite), token };
  }

  /** A new link for an invitation (the owner only): 7 more days; the old link stops working. */
  async renew(user: User, projectId: string, inviteId: string): Promise<InviteLink> {
    const { project } = await this.access.game(user.id, projectId, "owner", "Only the game's owner can invite people.");
    const found = UUID.test(inviteId) ? await this.prisma.projectInvite.findFirst({ where: { id: inviteId, projectId: project.id, acceptedAt: null } }) : null;
    if (!found) throw notFound("That invitation isn't there any more.");
    return this.invite(user, project.id, { email: found.email });
  }

  /** Takes an invitation back (the owner only): its link stops working at once. */
  async revoke(user: User, projectId: string, inviteId: string): Promise<{ ok: true }> {
    const { project } = await this.access.game(user.id, projectId, "owner", "Only the game's owner can take an invitation back.");
    const gone = UUID.test(inviteId) ? await this.prisma.projectInvite.deleteMany({ where: { id: inviteId, projectId: project.id, acceptedAt: null } }) : { count: 0 };
    if (!gone.count) throw notFound("That invitation isn't there any more.");
    this.events.emit(project.id, { type: "people", invites: true });
    return { ok: true };
  }

  /** Takes someone out of the game (the owner only): they lose it at once. */
  async remove(user: User, projectId: string, memberId: string): Promise<{ ok: true }> {
    const { project } = await this.access.game(user.id, projectId, "owner", "Only the game's owner can remove people.");
    if (memberId === project.ownerId) throw badRequest("The game's owner can't be removed from it.");
    const member =
      typeof memberId === "string" && memberId.length <= 64
        ? await this.prisma.projectMember.findUnique({ where: { projectId_userId: { projectId: project.id, userId: memberId } }, include: { user: { select: { id: true, email: true } } } })
        : null;
    const gone = member ? await this.prisma.projectMember.deleteMany({ where: { projectId: project.id, userId: memberId } }) : { count: 0 };
    if (!member || !gone.count) throw notFound("They aren't in this game.");
    await this.out(project.id, member.user);
    return { ok: true };
  }

  /** A member leaves the game (the owner can't: they delete it instead). */
  async leave(user: User, projectId: string): Promise<{ ok: true }> {
    const { project, role } = await this.access.game(user.id, projectId, "view");
    if (role === "owner") throw badRequest("This game is yours: to stop working on it, delete it (More, then Delete game).");
    await this.prisma.projectMember.deleteMany({ where: { projectId: project.id, userId: user.id } });
    await this.out(project.id, user);
    return { ok: true };
  }

  /**
   * Someone is out of a game (removed, left, or their account closed): a build they asked for that is still going or
   * waiting stops, as a Stop does (nothing charged); the invitation they accepted goes (their address isn't kept, its
   * link is 404); their streams of the game hear `removed` and end; the others hear `people`.
   */
  async out(projectId: string, who: Pick<User, "id" | "email">): Promise<void> {
    await this.stopBuildsOf(projectId, who.id);
    await this.prisma.projectInvite.deleteMany({ where: { projectId, match: inviteMatch(who.email), acceptedAt: { not: null } } });
    this.events.kick(projectId, who.id);
    this.events.emit(projectId, { type: "people" });
  }

  /** Stops the game's build if this person asked for it (going, or waiting in line). */
  async stopBuildsOf(projectId: string, userId: string): Promise<void> {
    if (this.registry.senderOf(projectId) === userId) await this.queue.cancel(projectId);
    if (this.registry.active.get(projectId)?.senderId === userId) await this.runs.cancel(projectId);
  }

  /** The invitations still waiting for this account's email, newest first. */
  async mine(user: User): Promise<Invitation[]> {
    const rows = await this.prisma.projectInvite.findMany({
      where: { match: inviteMatch(user.email), acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { sentAt: "desc" },
      include: WITH_GAME,
    });
    return rows.filter((r) => r.project.ownerId !== user.id).map(invitationOf);
  }

  /** The invitation a link opens: only for the account signed in with its address (403 wrong_account, the address half
   * hidden); 404 once it has ended. */
  async byLink(user: User, token: string): Promise<Invitation> {
    this.countLookup(user.id);
    const row = typeof token === "string" && TOKEN.test(token) ? await this.prisma.projectInvite.findUnique({ where: { tokenHash: hashOf(token) }, include: WITH_GAME }) : null;
    if (!row) throw notFound(ENDED);
    if (row.match !== inviteMatch(user.email)) {
      throw new ApiException(403, "wrong_account", `This invitation is for ${halfHidden(row.email)}. Sign in with that Google account to accept it.`);
    }
    // Accepted already: the link takes them back to the game while they are still in it (the page opens it).
    if (row.acceptedAt) {
      if (await this.inGame(user.id, row.projectId)) return { ...invitationOf(row), accepted: true };
      throw notFound(ENDED);
    }
    if (row.expiresAt <= new Date()) throw notFound(ENDED);
    return invitationOf(row);
  }

  /** Whether this account is in the game (its owner or a member). */
  private async inGame(userId: string, projectId: string): Promise<boolean> {
    const found = await this.prisma.project.findFirst({ where: { id: projectId, OR: [{ ownerId: userId }, { members: { some: { userId } } }] }, select: { id: true } });
    return !!found;
  }

  /**
   * Accept: the invitation is marked accepted and the member row comes, in one step (a second tab's accept finds it taken
   * and just opens the game). Its row stays, so its link brings them back to the game.
   */
  async accept(user: User, inviteId: string): Promise<{ projectId: string }> {
    const match = inviteMatch(user.email);
    const row = UUID.test(inviteId) ? await this.prisma.projectInvite.findUnique({ where: { id: inviteId } }) : null;
    if (!row || row.match !== match) throw notFound(ENDED);
    if (row.acceptedAt) {
      if (await this.inGame(user.id, row.projectId)) return { projectId: row.projectId };
      throw notFound(ENDED);
    }
    if (row.expiresAt <= new Date()) throw notFound(ENDED);
    const projectId = await this.prisma.$transaction(async (tx) => {
      const taken = await tx.projectInvite.updateMany({ where: { id: row.id, acceptedAt: null, expiresAt: { gt: new Date() } }, data: { acceptedAt: new Date() } });
      if (!taken.count) throw notFound(ENDED);
      const game = await tx.project.findUnique({ where: { id: row.projectId }, select: { ownerId: true } });
      if (!game) throw notFound(ENDED);
      if (game.ownerId !== user.id) {
        await tx.projectMember.upsert({
          where: { projectId_userId: { projectId: row.projectId, userId: user.id } },
          create: { projectId: row.projectId, userId: user.id, role: row.role },
          update: {},
        });
      }
      return row.projectId;
    });
    this.log.log(`game ${projectId}: an invitation accepted`);
    this.events.emit(projectId, { type: "people" });
    return { projectId };
  }

  /** No thanks: the invitation goes (the owner's list no longer shows it). */
  async decline(user: User, inviteId: string): Promise<{ ok: true }> {
    const row = UUID.test(inviteId) ? await this.prisma.projectInvite.findUnique({ where: { id: inviteId } }) : null;
    if (!row || row.match !== inviteMatch(user.email) || row.acceptedAt || row.expiresAt <= new Date()) throw notFound(ENDED);
    await this.prisma.projectInvite.deleteMany({ where: { id: row.id, acceptedAt: null } });
    this.events.emit(row.projectId, { type: "people", invites: true });
    return { ok: true };
  }

  /** 429 past LINKS_PER_DAY new links in a day across the owner's games. */
  private async assertLinksLeft(ownerId: string) {
    const made = await this.prisma.projectInvite.count({ where: { project: { ownerId }, sentAt: { gt: new Date(Date.now() - DAY_MS) } } });
    if (made >= LINKS_PER_DAY) throw new ApiException(429, "too_many", `That's ${LINKS_PER_DAY} invitation links today, the most for a day. You can make more tomorrow.`);
  }

  /** 429 past LOOKUPS_PER_HOUR invitation links opened in an hour by one account. */
  private countLookup(userId: string) {
    const now = Date.now();
    const recent = (this.lookups.get(userId) ?? []).filter((t) => now - t < 60 * 60_000);
    if (recent.length >= LOOKUPS_PER_HOUR) throw new ApiException(429, "too_many", "That's a lot of invitation links in an hour. Try again later.");
    recent.push(now);
    this.lookups.set(userId, recent);
    if (this.lookups.size > 10_000) for (const [id, times] of this.lookups) if (!times.some((t) => now - t < 60 * 60_000)) this.lookups.delete(id);
  }
}
