// Every error leaves the API as `ApiError` JSON ({ error, message }), per the contract.
import { Catch, HttpException, Logger, type ArgumentsHost, type ExceptionFilter } from "@nestjs/common";
import type { Response } from "express";
import type { ApiError, ApiErrorCode } from "@typeplay/shared";

export class ApiException extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export const unauthorized = (message = "Please sign in again.") => new ApiException(401, "unauthorized", message);
export const notFound = (message = "We couldn't find that.") => new ApiException(404, "not_found", message);
export const badRequest = (message: string) => new ApiException(400, "bad_request", message);

/** An error body-parser raised about the request itself (http-errors: a 4xx it may tell the sender, e.g. 413 entity.too.large). */
const isClientBodyError = (e: unknown): e is { status: number; type: string } => {
  const x = e as { status?: unknown; expose?: unknown; type?: unknown } | null;
  return !!x && typeof x.status === "number" && x.status >= 400 && x.status < 500 && x.expose === true && typeof x.type === "string";
};

const byStatus: Record<number, [ApiErrorCode, string]> = {
  400: ["bad_request", "That request wasn't valid."],
  401: ["unauthorized", "Please sign in again."],
  403: ["unauthorized", "You can't do that."],
  404: ["not_found", "We couldn't find that."],
};

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  private readonly log = new Logger("api");

  catch(e: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    let status = 500;
    let body: ApiError = { error: "server_error", message: "Something went wrong on our side. Please try again." };
    if (e instanceof ApiException) {
      status = e.status;
      body = { error: e.code, message: e.message };
    } else if (e instanceof HttpException && byStatus[e.getStatus()]) {
      status = e.getStatus();
      const [error, message] = byStatus[status];
      body = { error, message };
    } else if ((e as { type?: string })?.type === "entity.parse.failed") {
      status = 400;
      body = { error: "bad_request", message: "That request wasn't valid JSON." };
    } else if (isClientBodyError(e)) {
      // The body parser's own refusals (a body over the limit, an encoding it doesn't read): the sender's doing, said
      // plainly with its status. Until 10-20 these were a 500 and an error with its stack in the log, for anyone.
      status = e.status;
      body = { error: "bad_request", message: status === 413 ? "That request is too big." : "That request wasn't valid." };
    } else {
      this.log.error(e instanceof Error ? (e.stack ?? e.message) : String(e));
    }
    if (res.headersSent) {
      res.end();
      return;
    }
    res.status(status).json(body);
  }
}
