// Paddle's REST API with plain fetch (docs/payments-design.md §5; the facts in docs/research/paddle-2026.md).
// No SDK: its webhook verifier is fixed at 5 s and not constant-time, and the calls we make are few.
// Rules: `Authorization: Bearer`, `Paddle-Version: 1`, 10 s per call; a GET is tried three times (the
// network, a 5xx, a 429); a POST or PATCH is sent once, never on its own again (Paddle has no
// idempotency keys: list or get first, then create). The caller decides what a timeout means.
import { setTimeout as sleep } from "node:timers/promises";
import { config, paddleMode } from "../env.js";

export const PADDLE_API_URL = { sandbox: "https://sandbox-api.paddle.com", live: "https://api.paddle.com" } as const;
const TIMEOUT_MS = 10_000;
const GET_TRIES = 3;
const RETRY_WAIT_MS = [250, 1_000];

/** Paddle answered with an error (4xx/5xx): its code and detail, as the API gives them. */
export class PaddleError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    detail: string,
    readonly requestId: string | null = null,
  ) {
    super(`Paddle ${status} ${code}: ${detail}`);
  }
}

/** No usable answer: the network, a timeout, or a 5xx that outlived the retries. */
export class PaddleUnreachable extends Error {
  constructor(
    readonly what: string,
    readonly timedOut: boolean,
    cause?: unknown,
  ) {
    super(`Paddle did not answer (${what})`, cause === undefined ? undefined : { cause });
  }
}

export interface Pagination {
  per_page: number;
  next: string | null;
  has_more: boolean;
  estimated_total: number;
}

export type Query = Record<string, string | number | boolean | undefined>;

const queryString = (q: Query | undefined) => {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(q ?? {})) if (v !== undefined) params.set(k, String(v));
  const s = params.toString();
  return s ? `?${s}` : "";
};

export class PaddleClient {
  constructor(
    readonly baseUrl: string,
    private readonly apiKey: string,
  ) {}

  /** The client for the configured environment (PADDLE_API_URL overrides the address: tests), or null when billing is off. */
  static fromConfig(): PaddleClient | null {
    const mode = paddleMode();
    if (mode === "off") return null;
    return new PaddleClient(config.paddle.apiUrl || PADDLE_API_URL[mode], config.paddle.apiKey);
  }

  get<T>(path: string, query?: Query): Promise<T> {
    return this.send<T>("GET", path + queryString(query), undefined, GET_TRIES);
  }

  post<T>(path: string, body: unknown): Promise<T> {
    return this.send<T>("POST", path, body, 1);
  }

  patch<T>(path: string, body: unknown): Promise<T> {
    return this.send<T>("PATCH", path, body, 1);
  }

  /** Every page of a list (Paddle pages with `meta.pagination.next`, a full URL), at most `max` items. */
  async listAll<T>(path: string, query?: Query, max = 1000): Promise<T[]> {
    const out: T[] = [];
    let url: string | null = path + queryString({ per_page: 50, ...query });
    while (url && out.length < max) {
      const page: { data: T[]; meta: { pagination?: Pagination } } = await this.send("GET", url, undefined, GET_TRIES, true);
      out.push(...page.data);
      const p = page.meta.pagination;
      url = p?.has_more && p.next ? p.next : null;
    }
    return out.slice(0, max);
  }

  private async send<T>(method: string, path: string, body: unknown, tries: number, whole = false): Promise<T> {
    const url = /^https?:/.test(path) ? path : this.baseUrl + path;
    const what = `${method} ${path.split("?")[0]}`;
    for (let attempt = 1; ; attempt++) {
      let res: Response;
      try {
        res = await fetch(url, {
          method,
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Paddle-Version": "1",
            Accept: "application/json",
            ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch (e) {
        const timedOut = (e as Error).name === "TimeoutError" || (e as Error).name === "AbortError";
        if (attempt < tries) {
          await sleep(RETRY_WAIT_MS[Math.min(attempt - 1, RETRY_WAIT_MS.length - 1)]);
          continue;
        }
        throw new PaddleUnreachable(what, timedOut, e);
      }
      const text = await res.text();
      let json: { data?: unknown; meta?: unknown; error?: { type?: string; code?: string; detail?: string } } = {};
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        if (res.ok) throw new PaddleUnreachable(`${what}: not JSON`, false);
      }
      if (res.ok) return (whole ? json : json.data) as T;
      if ((res.status >= 500 || res.status === 429) && attempt < tries) {
        await sleep(RETRY_WAIT_MS[Math.min(attempt - 1, RETRY_WAIT_MS.length - 1)]);
        continue;
      }
      if (res.status >= 500) throw new PaddleUnreachable(`${what}: ${res.status}`, false);
      const requestId = ((json.meta as { request_id?: string } | undefined)?.request_id ?? null) as string | null;
      throw new PaddleError(res.status, json.error?.code ?? "unknown", json.error?.detail ?? text.slice(0, 200) ?? "", requestId);
    }
  }
}

/** Paddle's money strings ("2000" = $20.00, "-1000" on a credit line) as integer cents; a bad string is an error, never a guess. */
export function cents(v: unknown): number {
  if (typeof v === "number" && Number.isInteger(v)) return v;
  if (typeof v !== "string" || !/^-?\d+$/.test(v)) throw new Error(`not an amount in the lowest unit: ${JSON.stringify(v)}`);
  return Number(v);
}

/** A card as the billing page names it: "Visa ending 4242"; PayPal and the rest by their type. */
export function paymentMethodName(details: { type?: string; card?: { type?: string; last4?: string } | null } | null | undefined): string | null {
  if (!details?.type) return null;
  if (details.type === "card" && details.card?.last4) {
    const brand = { visa: "Visa", mastercard: "Mastercard", amex: "American Express", discover: "Discover", jcb: "JCB", diners_club: "Diners Club", unionpay: "UnionPay", maestro: "Maestro" }[details.card.type ?? ""] ?? "Card";
    return `${brand} ending ${details.card.last4}`;
  }
  return { paypal: "PayPal", apple_pay: "Apple Pay", google_pay: "Google Pay", ideal: "iDEAL", bancontact: "Bancontact", alipay: "Alipay", wire_transfer: "Bank transfer" }[details.type] ?? details.type;
}
