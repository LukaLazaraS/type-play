// POST /beta/code (beta 1, 2026-10-25): a beta code typed on the closed-beta page. Signed in with Google, before the
// invite check (@IdentityOnly): it is the way in for someone who isn't invited yet.
import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import type { BetaCodeResult } from "@typeplay/shared";
import { CurrentIdentity, IdentityOnly } from "../auth/auth.guard.js";
import type { Identity } from "../auth/auth.service.js";
import { BetaCodeService } from "./codes.js";

@Controller("beta")
export class BetaCodeController {
  constructor(private readonly codes: BetaCodeService) {}

  /** 200 { credits } (what the code added; 0 when the account was already in); 400, 403 code_wrong, 429 too_many. */
  @Post("code")
  @HttpCode(200)
  @IdentityOnly()
  redeem(@CurrentIdentity() who: Identity, @Body() body: unknown): Promise<BetaCodeResult> {
    return this.codes.redeem(who, body);
  }
}
