// Every route needs `Authorization: Bearer <token>`; the user is put on the request.
// The exception is a route marked @Public() (the share pages' GET /public/*).
import { createParamDecorator, Injectable, SetMetadata, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { unauthorized } from "../common/api-error.js";
import type { User } from "../generated/prisma/client.js";
import { AuthService } from "./auth.service.js";

export type AuthedRequest = Request & { user: User };

const PUBLIC = "typeplay:public";
/** No sign-in needed (and none is read): only for what anyone may see. */
export const Public = () => SetMetadata(PUBLIC, true);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC, [ctx.getHandler(), ctx.getClass()])) return true;
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization ?? "";
    const match = /^Bearer\s+(.+)$/i.exec(header);
    if (!match) throw unauthorized();
    req.user = await this.auth.userFromToken(match[1].trim());
    return true;
  }
}

/** The signed-in user (set by AuthGuard). */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<AuthedRequest>().user;
});
