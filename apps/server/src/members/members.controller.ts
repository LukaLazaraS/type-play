// Pair developing's routes of the contract (packages/shared/src/index.ts, "Pair developing"): a game's people and
// invitations, leaving it, the games shared with you, and your invitations.
import { Body, Controller, Delete, Get, HttpCode, Param, Post } from "@nestjs/common";
import type { GamePeople, Invitation, InviteLink, SharedGame } from "@typeplay/shared";
import { CurrentUser } from "../auth/auth.guard.js";
import type { User } from "../generated/prisma/client.js";
import { ProjectViews } from "../projects/views.js";
import { MembersService } from "./members.service.js";

@Controller()
export class MembersController {
  constructor(
    private readonly members: MembersService,
    private readonly views: ProjectViews,
  ) {}

  @Get("projects/:id/people")
  people(@CurrentUser() user: User, @Param("id") id: string): Promise<GamePeople> {
    return this.members.people(user, id);
  }

  @Post("projects/:id/invites")
  @HttpCode(201)
  invite(@CurrentUser() user: User, @Param("id") id: string, @Body() body: unknown): Promise<InviteLink> {
    return this.members.invite(user, id, body);
  }

  @Post("projects/:id/invites/:inviteId/link")
  @HttpCode(200)
  renew(@CurrentUser() user: User, @Param("id") id: string, @Param("inviteId") inviteId: string): Promise<InviteLink> {
    return this.members.renew(user, id, inviteId);
  }

  @Delete("projects/:id/invites/:inviteId")
  @HttpCode(200)
  revoke(@CurrentUser() user: User, @Param("id") id: string, @Param("inviteId") inviteId: string): Promise<{ ok: true }> {
    return this.members.revoke(user, id, inviteId);
  }

  @Delete("projects/:id/members/:userId")
  @HttpCode(200)
  remove(@CurrentUser() user: User, @Param("id") id: string, @Param("userId") memberId: string): Promise<{ ok: true }> {
    return this.members.remove(user, id, memberId);
  }

  @Post("projects/:id/leave")
  @HttpCode(200)
  leave(@CurrentUser() user: User, @Param("id") id: string): Promise<{ ok: true }> {
    return this.members.leave(user, id);
  }

  @Get("shared")
  shared(@CurrentUser() user: User): Promise<SharedGame[]> {
    return this.views.shared(user.id);
  }

  @Get("invites")
  mine(@CurrentUser() user: User): Promise<Invitation[]> {
    return this.members.mine(user);
  }

  @Get("invites/link/:token")
  byLink(@CurrentUser() user: User, @Param("token") token: string): Promise<Invitation> {
    return this.members.byLink(user, token);
  }

  @Post("invites/:id/accept")
  @HttpCode(200)
  accept(@CurrentUser() user: User, @Param("id") id: string): Promise<{ projectId: string }> {
    return this.members.accept(user, id);
  }

  @Post("invites/:id/decline")
  @HttpCode(200)
  decline(@CurrentUser() user: User, @Param("id") id: string): Promise<{ ok: true }> {
    return this.members.decline(user, id);
  }
}
