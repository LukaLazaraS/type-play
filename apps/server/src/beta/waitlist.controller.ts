// /beta/waitlist (2026-11-19): "No code? Tell me when it opens" on the closed-beta page. Signed in with Google, before
// the invite check (@IdentityOnly), like POST /beta/code: the people who call it aren't invited, and get no user row.
import { Controller, Delete, Get, HttpCode, Post } from "@nestjs/common";
import type { WaitlistState } from "@typeplay/shared";
import { CurrentIdentity, IdentityOnly } from "../auth/auth.guard.js";
import type { Identity } from "../auth/auth.service.js";
import { WaitlistService } from "./waitlist.js";

@Controller("beta/waitlist")
export class WaitlistController {
  constructor(private readonly waitlist: WaitlistService) {}

  /** 200 WaitlistState: whether this email is on the list. */
  @Get()
  @IdentityOnly()
  state(@CurrentIdentity() who: Identity): Promise<WaitlistState> {
    return this.waitlist.state(who);
  }

  /** 200 WaitlistState (on); 400 bad_request when the email gets in already; 429 too_many. */
  @Post()
  @HttpCode(200)
  @IdentityOnly()
  join(@CurrentIdentity() who: Identity): Promise<WaitlistState> {
    return this.waitlist.join(who);
  }

  /** 200 WaitlistState (off); 429 too_many. */
  @Delete()
  @IdentityOnly()
  leave(@CurrentIdentity() who: Identity): Promise<WaitlistState> {
    return this.waitlist.leave(who);
  }
}
