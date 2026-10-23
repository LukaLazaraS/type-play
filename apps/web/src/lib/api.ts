// The API (apps/server), per the contract in packages/shared. Every call sends the sign-in token;
// errors arrive as ApiError and are shown by their plain `message`.
import type {
  AndroidBuild,
  AndroidLink,
  AndroidState,
  ApiError,
  ApiErrorCode,
  BillingInfo,
  CheckoutBody,
  CheckoutStatus,
  CreateProjectBody,
  Effort,
  Estimate,
  FeedbackBody,
  Me,
  ModelChoice,
  PlanChangeBody,
  PlanChangePreview,
  PortalLinks,
  Project,
  ProjectSummary,
  RunEvent,
  SendMessageBody,
  SetupAndroidBody,
  StartAndroidBuildBody,
  UpdateAndroidBody,
  UpdateProjectBody,
  UsagePage,
} from "@typeplay/shared";
import { app } from "@/content/app";
import { accessToken, markUninvited } from "./session";

export class ApiFailure extends Error {
  constructor(
    readonly code: ApiErrorCode | "offline",
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const OFFLINE = "We can't reach TypePlay right now. Check your connection and try again.";
const SIGNED_OUT = "Please sign in again.";
/** No sign-in token on this device right now (the session's refresh failed, or signed out): status 0,
 * a local condition, unlike a 401 the API answered. Only the latter signs the user out (session.ts). */
const noToken = () => new ApiFailure("unauthorized", SIGNED_OUT, 0);

type Method = "GET" | "POST" | "PATCH" | "DELETE";

/** Sends the request with the sign-in token; a non-2xx answer becomes an ApiFailure. */
async function send(path: string, init: { method?: Method; body?: unknown } = {}): Promise<Response> {
  const token = await accessToken();
  if (!token) throw noToken();
  let res: Response;
  try {
    res = await fetch(app.apiOrigin + path, {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new ApiFailure("offline", OFFLINE, 0);
  }
  if (!res.ok) {
    let body: Partial<ApiError> = {};
    try {
      body = (await res.json()) as ApiError;
    } catch {
      /* not JSON: a proxy or a crash */
    }
    // The closed beta: this account isn't invited. Whatever asked, the app's pages show the closed-beta screen now.
    if (body.error === "invite_only") void markUninvited();
    throw new ApiFailure(
      body.error ?? (res.status === 401 ? "unauthorized" : "server_error"),
      body.message ?? "Something went wrong on our side. Please try again.",
      res.status,
    );
  }
  return res;
}

async function call<T>(path: string, init: { method?: Method; body?: unknown } = {}): Promise<T> {
  return (await (await send(path, init)).json()) as T;
}

/** A file the API sends as a download (Content-Disposition names it). */
async function file(path: string, fallbackName: string): Promise<{ blob: Blob; name: string }> {
  const res = await send(path);
  const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? fallbackName;
  try {
    return { blob: await res.blob(), name };
  } catch {
    throw new ApiFailure("offline", OFFLINE, 0); // the connection dropped mid-download
  }
}

/** A picture the API sends (the sign-in header is why it isn't an <img src>). */
async function picture(path: string): Promise<Blob> {
  const res = await send(path);
  try {
    return await res.blob();
  } catch {
    throw new ApiFailure("offline", OFFLINE, 0); // the connection dropped mid-download
  }
}

const id = (projectId: string) => encodeURIComponent(projectId);

export const api = {
  me: () => call<Me>("/me"),
  projects: () => call<ProjectSummary[]>("/projects"),
  project: (projectId: string) => call<Project>(`/projects/${id(projectId)}`),
  create: (body: CreateProjectBody) => call<Project>("/projects", { method: "POST", body }),
  send: (projectId: string, body: SendMessageBody) =>
    call<Project>(`/projects/${id(projectId)}/messages`, { method: "POST", body }),
  restore: (projectId: string, n: number) => call<Project>(`/projects/${id(projectId)}/restore`, { method: "POST", body: { n } }),
  cancel: (projectId: string) => call<Project>(`/projects/${id(projectId)}/cancel`, { method: "POST" }),
  estimate: (kind: "new" | "edit", model: ModelChoice, effort: Effort = "medium") =>
    call<Estimate>(`/estimate?kind=${kind}&model=${model}${effort === "medium" ? "" : `&effort=${effort}`}`),
  /** Rename, share or unshare. */
  update: (projectId: string, body: UpdateProjectBody) => call<Project>(`/projects/${id(projectId)}`, { method: "PATCH", body }),
  remove: (projectId: string) => call<{ ok: true }>(`/projects/${id(projectId)}`, { method: "DELETE" }),
  /** The Godot project as a .zip. */
  download: (projectId: string) => file(`/projects/${id(projectId)}/download`, "my-game.zip"),
  usage: (cursor?: string | null, limit = 25) =>
    call<UsagePage>(`/me/usage?limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`),
  /** "Download my data": the account, its games and messages, the credit history (a .json file). */
  exportData: () => file("/me/export", "typeplay-data.json"),
  closeAccount: () => call<{ ok: true }>("/me", { method: "DELETE", body: { confirm: "DELETE" } }),
  /** "Send feedback" (beta 1): 429 too_many after 10 a day. */
  feedback: (body: FeedbackBody) => call<{ id: string }>("/feedback", { method: "POST", body }),

  // Plan and billing (payments part 3). 503 billing_off when payments are off for this user.
  billing: () => call<BillingInfo>("/billing"),
  /** A Paddle transaction for the overlay (components/app/Paddle.tsx opens it). */
  checkout: (body: CheckoutBody) => call<{ transactionId: string }>("/billing/checkout", { method: "POST", body }),
  checkoutStatus: (transactionId: string) => call<CheckoutStatus>(`/billing/checkout/${encodeURIComponent(transactionId)}`),
  /** No webhook yet: the API asks Paddle itself and adds the credits. */
  verifyCheckout: (transactionId: string) => call<CheckoutStatus>(`/billing/checkout/${encodeURIComponent(transactionId)}/verify`, { method: "POST" }),
  planChangePreview: (plan: PlanChangeBody["plan"]) => call<PlanChangePreview>(`/billing/plan-change?plan=${plan}`),
  planChange: (body: PlanChangeBody) => call<PlanChangePreview>("/billing/plan-change", { method: "POST", body }),
  undoPlanChange: () => call<{ ok: true }>("/billing/plan-change", { method: "DELETE" }),
  cancelPlan: () => call<{ cancelsAt: string | null }>("/billing/cancel", { method: "POST" }),
  keepPlan: () => call<{ ok: true }>("/billing/cancel", { method: "DELETE" }),
  /** Fresh links into Paddle's customer portal (they expire, so one call per click). */
  portal: () => call<PortalLinks>("/billing/portal", { method: "POST" }),

  // Android export (package 7; the contract's "Android export" block). Paid plans only: 403 plan_no_export.
  android: {
    state: (projectId: string) => call<AndroidState>(`/projects/${id(projectId)}/android`),
    /** Makes the game's identity and its upload key. */
    setup: (projectId: string, body: SetupAndroidBody) => call<AndroidState>(`/projects/${id(projectId)}/android`, { method: "POST", body }),
    update: (projectId: string, body: UpdateAndroidBody) => call<AndroidState>(`/projects/${id(projectId)}/android`, { method: "PATCH", body }),
    /** Queues a build (202); its progress arrives on the project's event stream as { type: "android" }. */
    build: (projectId: string, body: StartAndroidBuildBody) => call<AndroidBuild>(`/projects/${id(projectId)}/android/builds`, { method: "POST", body }),
    cancel: (projectId: string, buildId: string) =>
      call<AndroidBuild>(`/projects/${id(projectId)}/android/builds/${encodeURIComponent(buildId)}/cancel`, { method: "POST" }),
    /** The signed file (Content-Disposition names it <slug>-v<build>.apk|aab). */
    download: (projectId: string, buildId: string, fallbackName: string) =>
      file(`/projects/${id(projectId)}/android/builds/${encodeURIComponent(buildId)}/download`, fallbackName),
    /** The app's icon picture: the PNG the user uploaded, else the game's start screen (404 without Android setup). */
    icon: (projectId: string) => picture(`/projects/${id(projectId)}/android/icon`),
    /** A no-sign-in link for the phone, good for 10 minutes (always the short /android/dl/<token>, so it fits a QR code). */
    link: (projectId: string, buildId: string) => call<AndroidLink>(`/projects/${id(projectId)}/android/builds/${encodeURIComponent(buildId)}/link`, { method: "POST" }),
    /** The upload key as a .zip (the key file and a README with its password); 5 a day. */
    keyZip: (projectId: string) => file(`/projects/${id(projectId)}/android/key`, "upload-key.zip"),
  },
};

/** Hands a downloaded file to the browser to save. */
export function saveFile({ blob, name }: { blob: Blob; name: string }) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  document.body.append(a);
  a.click();
  a.remove();
  // Some browsers read the file after the click returns: let go of it a little later.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** "stopped": the stream ended for good (onFatal says why: signed out, the game is gone, …). */
export type StreamState = "connecting" | "live" | "retrying" | "stopped";

/**
 * GET /projects/:id/events as a stream of RunEvents. fetch() rather than EventSource, so it can
 * send the Authorization header. Reconnects on a drop (1, 2, 4, 8, 15 s) and when nothing,
 * not even the 20 s heartbeat, has arrived for 45 s; every connect starts with a snapshot.
 * A 401, 403 (the closed beta) or 404, or no sign-in token, ends it for good: onState("stopped"), then onFatal.
 * Returns a function that stops it.
 */
export function watchProject(
  projectId: string,
  onEvent: (e: RunEvent) => void,
  onState: (s: StreamState) => void,
  onFatal: (e: ApiFailure) => void,
): () => void {
  let stopped = false;
  let ctrl: AbortController | null = null;
  let attempt = 0;
  let watchdog: ReturnType<typeof setInterval> | null = null;

  const run = async () => {
    while (!stopped) {
      ctrl = new AbortController();
      const current = ctrl;
      let lastSeen = Date.now();
      watchdog = setInterval(() => {
        if (Date.now() - lastSeen > 45_000) current.abort();
      }, 5_000);
      try {
        const token = await accessToken();
        if (!token) {
          onState("stopped");
          return onFatal(noToken());
        }
        const res = await fetch(`${app.apiOrigin}/projects/${id(projectId)}/events`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
          signal: current.signal,
          cache: "no-store",
        });
        if (res.status === 401 || res.status === 403 || res.status === 404) {
          let body: Partial<ApiError> = {};
          try {
            body = (await res.json()) as ApiError;
          } catch {
            /* empty */
          }
          if (body.error === "invite_only") void markUninvited();
          onState("stopped");
          return onFatal(
            new ApiFailure(body.error ?? (res.status === 401 ? "unauthorized" : "not_found"), body.message ?? "We couldn't find that game.", res.status),
          );
        }
        if (!res.ok || !res.body) throw new Error(`events ${res.status}`);
        attempt = 0;
        onState("live");
        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          lastSeen = Date.now();
          buffer += value.replace(/\r\n?/g, "\n");
          let cut: number;
          while ((cut = buffer.indexOf("\n\n")) >= 0) {
            const block = buffer.slice(0, cut);
            buffer = buffer.slice(cut + 2);
            const data = block
              .split("\n")
              .filter((l) => l.startsWith("data:"))
              .map((l) => l.slice(5).replace(/^ /, ""))
              .join("\n");
            if (!data) continue; // a heartbeat comment
            try {
              onEvent(JSON.parse(data) as RunEvent);
            } catch {
              /* a broken line: the next snapshot puts things right */
            }
          }
        }
      } catch {
        /* dropped, aborted by the watchdog, or offline: try again below */
      } finally {
        if (watchdog) clearInterval(watchdog);
      }
      if (stopped) return;
      onState("retrying");
      attempt += 1;
      await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** (attempt - 1), 15_000)));
    }
  };
  onState("connecting");
  void run();
  return () => {
    stopped = true;
    ctrl?.abort();
    if (watchdog) clearInterval(watchdog);
  };
}
