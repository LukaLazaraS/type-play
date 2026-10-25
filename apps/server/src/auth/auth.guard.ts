// Every route needs `Authorization: Bearer <token>`; the user is put on the request.
// The exception is a route marked @Public() (the share pages' GET /public/*). A route marked @IdentityOnly() needs the
// token too, but gets who it is without the closed beta's invite check and without a user row (POST /beta/code).
import { createParamDecorator, Injectable, SetMetadata, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { unauthorized } from "../common/api-error.js";
import type { User } from "../generated/prisma/client.js";
import { AuthService, type Identity } from "./auth.service.js";

export type AuthedRequest = Request & { user: User; identity?: Identity };

const PUBLIC = "typeplay:public";
/** No sign-in needed (and none is read): only for what anyone may see. */
export const Public = () => SetMetadata(PUBLIC, true);
const IDENTITY_ONLY = "typeplay:identity-only";
/** Signed in, before the closed beta's invite check: the verified identity, no user row (the way in, POST /beta/code). */
export const IdentityOnly = () => SetMetadata(IDENTITY_ONLY, true);

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
    if (this.reflector.getAllAndOverride<boolean>(IDENTITY_ONLY, [ctx.getHandler(), ctx.getClass()])) {
      req.identity = await this.auth.identityFromToken(match[1].trim());
      return true;
    }
    req.user = await this.auth.userFromToken(match[1].trim());
    return true;
  }
}

/** The signed-in user (set by AuthGuard). */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<AuthedRequest>().user;
});

/** Who a verified token says, on an @IdentityOnly() route (set by AuthGuard). */
export const CurrentIdentity = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<AuthedRequest>().identity;
});
