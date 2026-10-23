// "Send feedback" (beta 1, PLAN.md package 6): a tester's note from the account menu or a game's More menu, kept with
// the account (Feedback rows go with it) for Luka to read with `admin feedback list | show | done`. The privacy policy
// names it (apps/web/src/content/legal.ts, "What we collect").
import { randomInt } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import { ApiException, badRequest } from "../common/api-error.js";
import type { User } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma.js";
import { ProjectViews } from "../projects/views.js";

/** The longest note, each of its two parts (as the site's text boxes allow). */
export const FEEDBACK_TEXT_MAX = 4000;
/** Notes per user in 24 hours. */
export const FEEDBACK_PER_DAY = 10;
const DAY_MS = 24 * 60 * 60_000;
const MAX_BROWSER = 400;

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const newFeedbackId = () => Array.from({ length: 10 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

/** A tester's words as they wrote them: line breaks kept (as \n), other control characters dropped, trimmed. */
function note(raw: unknown, what: string): string {
  if (typeof raw !== "string") throw badRequest(`Write ${what} as text.`);
  const text = raw.replace(/\r\n?/g, "\n").replace(/[^\P{Cc}\n\t]/gu, "").trim();
  if ([...text].length > FEEDBACK_TEXT_MAX) throw badRequest(`Keep ${what} under ${FEEDBACK_TEXT_MAX.toLocaleString("en-US")} letters.`);
  return text;
}

@Injectable()
export class FeedbackService {
  private readonly log = new Logger("feedback");

  constructor(
    private readonly prisma: PrismaService,
    private readonly views: ProjectViews,
  ) {}

  /** POST /feedback (FeedbackBody). The game, when given, must be the user's own (404), and the message one of its own (400). */
  async send(user: User, body: unknown, userAgent: string | undefined): Promise<{ id: string }> {
    const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
    const text = note(b.text, "what happened");
    if (!text) throw badRequest("Say what happened.");
    const expected = b.expected === undefined || b.expected === null ? null : note(b.expected, "what you expected") || null;
    if (typeof b.page !== "string" || !/^\/[\x21-\x7e]{0,199}$/.test(b.page)) throw badRequest("That page address isn't valid.");
    const page = b.page.split(/[?#]/)[0];
    let game: { id: string; currentVersion: number | null } | null = null;
    if (b.gameId !== undefined && b.gameId !== null) {
      if (typeof b.gameId !== "string") throw badRequest("That game id isn't valid.");
      game = await this.views.owned(user.id, b.gameId);
    }
    let messageId: string | null = null;
    if (b.messageId !== undefined && b.messageId !== null) {
      const found =
        game && typeof b.messageId === "string" && b.messageId.length <= 64
          ? await this.prisma.message.findFirst({ where: { id: b.messageId, projectId: game.id }, select: { id: true } })
          : null;
      if (!found) throw badRequest("That message isn't one of this game's.");
      messageId = found.id;
    }
    const since = new Date(Date.now() - DAY_MS);
    if ((await this.prisma.feedback.count({ where: { userId: user.id, createdAt: { gt: since } } })) >= FEEDBACK_PER_DAY) {
      throw new ApiException(429, "too_many", `That's ${FEEDBACK_PER_DAY} notes today, the most we take in a day. Thank you! You can send more tomorrow.`);
    }
    const version = game?.currentVersion != null ? await this.prisma.version.findUnique({ where: { projectId_n: { projectId: game.id, n: game.currentVersion } }, select: { n: true, buildId: true } }) : null;
    const browser = (userAgent ?? "").replace(/\p{Cc}+/gu, " ").trim().slice(0, MAX_BROWSER) || null;
    const id = newFeedbackId();
    await this.prisma.feedback.create({
      data: { id, userId: user.id, page, text, expected, projectId: game?.id ?? null, messageId, versionN: version?.n ?? null, buildId: version?.buildId ?? null, browser },
    });
    // The words stay in the database: the log only says that a note came (admin feedback show <id>).
    this.log.log(`feedback ${id} from ${user.id}${game ? ` about ${game.id}` : ""} (admin feedback show ${id})`);
    return { id };
  }
}
