// Who may do what to a game (pair developing, 2026-11-04; docs/design/pair-developing.md): its owner (Project.ownerId) and
// the people the owner let in to build it with them (ProjectMember, editors). Every route of a game asks here, and only
// here: someone not in the game gets 404, the same as for a game that isn't there (no telling which games exist); a
// member asking for the owner's part (sharing, the gallery, Android, invitations, deleting) gets 403 owner_only.
import { Injectable } from "@nestjs/common";
import type { GameRole, Person } from "@typeplay/shared";
import { ApiException, notFound } from "../common/api-error.js";
import type { Project, User } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma.js";

/** view: see the game (its chat, versions, pictures, assets, people). edit: change it (send to the AI, restore, rename,
 * download, stop one's own build). owner: what only its owner does. */
export type Need = "view" | "edit" | "owner";

/** A game as this user may use it, and who they are in it. */
export interface GameAccess {
  project: Project;
  role: GameRole;
}

const GAME_ID = /^[a-z0-9]{4,40}$/;

/** What each role may do. A viewer role (later) would have view only. */
const CAN: Record<GameRole, Record<Need, boolean>> = {
  owner: { view: true, edit: true, owner: true },
  editor: { view: true, edit: true, owner: false },
};

export const ownerOnly = (message = "Only the game's owner can do that.") => new ApiException(403, "owner_only", message);

/**
 * Who pays for every AI call made in a game, whoever sends it: its owner, under the owner's plan (Lovable and Replit,
 * docs/research/pair-developing-2026-11-04.md). The one place that says it: "the sender pays" would start here.
 */
export const payerOf = (project: Pick<Project, "ownerId">): string => project.ownerId;

/** The columns a Person is made from (with a message's author, a member, an owner). */
export const PERSON = { id: true, name: true, email: true, avatarUrl: true } as const;

/** Someone in a game as the others see them: their Google name, else the start of their email, and their picture. */
export function personOf(u: Pick<User, "id" | "name" | "email" | "avatarUrl">): Person {
  return { id: u.id, name: u.name?.trim() || u.email.split("@")[0] || "Someone", avatarUrl: u.avatarUrl };
}

@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The game, if this user may do `need` to it: one query, the owner or a member row of theirs. 404 for anyone else;
   * 403 owner_only (with `ownerMessage`) for a member asking for what only the owner does.
   */
  async game(userId: string, id: string, need: Need, ownerMessage?: string): Promise<GameAccess> {
    const row =
      typeof id === "string" && GAME_ID.test(id)
        ? await this.prisma.project.findFirst({
            where: { id, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
            include: { members: { where: { userId }, select: { role: true } } },
          })
        : null;
    if (!row) throw notFound("We couldn't find that game.");
    const { members, ...project } = row;
    const role: GameRole = project.ownerId === userId ? "owner" : (members[0]?.role ?? "editor");
    if (!CAN[role][need]) {
      if (need === "owner") throw ownerOnly(ownerMessage);
      throw notFound("We couldn't find that game.");
    }
    return { project, role };
  }
}
