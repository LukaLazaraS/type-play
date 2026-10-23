// Who is signed in, for every client component, without a provider: a small store that starts on
// first use. Google sign-in goes through Supabase; "Dev sign-in" (NEXT_PUBLIC_DEV_AUTH=1, never in
// production) uses a `dev:<email>` token the API accepts only with DEV_AUTH=1.
import { useSyncExternalStore } from "react";
import type { CreditBalance, Me } from "@typeplay/shared";
import { app } from "@/content/app";
import { safeNext, supabase } from "./supabase";

export type Session =
  | { status: "loading" }
  | { status: "out" }
  /**
   * `me` is null until GET /me answers; `problem` says why it didn't. `uninvited`: the API answered 403 invite_only (the
   * closed beta, and this email isn't on the invite list): the app's pages show the closed-beta screen (ClosedBeta.tsx).
   */
  | { status: "in"; via: "google" | "dev"; me: Me | null; problem: string | null; uninvited?: { email: string | null } };

const DEV_KEY = "typeplay.devEmail";
/** The API's invite_only answer for an address, kept for this tab: a reload shows the closed-beta page at once instead
 * of the page it stands for (GET /me still asks, and an invite since then lets the page back in). */
const UNINVITED_KEY = "typeplay.uninvited";
function rememberedUninvited(email: string | null): { email: string | null } | undefined {
  try {
    return email && sessionStorage.getItem(UNINVITED_KEY) === email ? { email } : undefined;
  } catch {
    return undefined;
  }
}
function rememberUninvited(email: string | null) {
  try {
    if (email) sessionStorage.setItem(UNINVITED_KEY, email);
    else sessionStorage.removeItem(UNINVITED_KEY);
  } catch {
    /* nothing kept */
  }
}
const LOADING: Session = { status: "loading" };

let state: Session = LOADING;
let started = false;
const listeners = new Set<() => void>();

function set(next: Session) {
  state = next;
  listeners.forEach((l) => l());
}

function devEmail(): string | null {
  if (!app.devAuth) return null;
  try {
    return localStorage.getItem(DEV_KEY);
  } catch {
    return null;
  }
}

/** The token for the API: `dev:<email>`, or the Supabase access token (refreshed when due). */
export async function accessToken(): Promise<string | null> {
  const dev = devEmail();
  if (dev) return `dev:${dev}`;
  const { data } = await supabase().auth.getSession();
  return data.session?.access_token ?? null;
}

let meLoading: Promise<void> | null = null;

/** Fetch GET /me again (credits change after every message). */
export function refreshMe(): Promise<void> {
  if (state.status !== "in") return Promise.resolve();
  meLoading ??= (async () => {
    // Imported here so this file and api.ts don't import each other at load.
    const { api, ApiFailure } = await import("./api");
    try {
      const me = await api.me();
      if (state.status === "in") set({ ...state, me, problem: null, uninvited: undefined });
      rememberUninvited(null);
    } catch (e) {
      // Only an answer from the API signs out (401). No token here (status 0: the session's refresh
      // failed for the moment, e.g. offline) is a passing problem, not a reason to drop the cookies.
      if (e instanceof ApiFailure && e.code === "unauthorized" && e.status === 401) {
        await signOut();
        return;
      }
      if (e instanceof ApiFailure && e.code === "invite_only") {
        await markUninvited();
        return;
      }
      if (state.status === "in") set({ ...state, problem: e instanceof Error ? e.message : String(e) });
    } finally {
      meLoading = null;
    }
  })();
  return meLoading;
}

/** The address this device is signed in with: Google's, or the dev sign-in's. */
async function signedInEmail(): Promise<string | null> {
  const dev = devEmail();
  if (dev) return dev;
  try {
    const { data } = await supabase().auth.getSession();
    return data.session?.user.email ?? null;
  } catch {
    return null;
  }
}

/** The API said 403 invite_only (any call, GET /me included): signed in, but not invited to the closed beta. */
export async function markUninvited() {
  if (state.status !== "in" || state.uninvited) return;
  const email = await signedInEmail();
  rememberUninvited(email);
  if (state.status === "in") set({ ...state, me: null, problem: null, uninvited: { email } });
}

/** Live credits from a run's done/failed event, so the header updates without a request. */
export function setCredits(credits: CreditBalance) {
  if (state.status === "in" && state.me) set({ ...state, me: { ...state.me, credits } });
}

function signedIn(via: "google" | "dev", email: string | null) {
  const keep = state.status === "in" && state.via === via ? state : null;
  set(keep ?? { status: "in", via, me: null, problem: null, uninvited: rememberedUninvited(email) });
  if (!keep?.me) void refreshMe();
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  if (devEmail()) {
    signedIn("dev", devEmail());
    return;
  }
  const auth = supabase().auth;
  auth
    .getSession()
    .then(({ data }) => (data.session ? signedIn("google", data.session.user.email ?? null) : set({ status: "out" })))
    .catch(() => set({ status: "out" }));
  auth.onAuthStateChange((event, session) => {
    if (devEmail()) return;
    if (session) {
      // TOKEN_REFRESHED too: a session that came back after a failed refresh shows as signed in again.
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") signedIn("google", session.user.email ?? null);
    } else if (event === "SIGNED_OUT") {
      set({ status: "out" });
    }
  });
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  start();
  return () => {
    listeners.delete(onChange);
  };
}

export function useSession(): Session {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => LOADING,
  );
}

/**
 * Google, through Supabase: back to `next` on this site after /auth/callback. `chooseAccount` shows Google's account
 * chooser even when one account is signed in there (the closed-beta screen's "Use another Google account"); the new
 * sign-in replaces this one when it comes back.
 */
export async function signInWithGoogle(next: string, { chooseAccount = false } = {}): Promise<string | null> {
  const redirectTo = `${location.origin}/auth/callback?next=${encodeURIComponent(safeNext(next))}`;
  const { error } = await supabase().auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, ...(chooseAccount ? { queryParams: { prompt: "select_account" } } : {}) },
  });
  return error ? "We couldn't open Google sign-in. Please try again." : null;
}

export function devSignIn(email: string) {
  if (!app.devAuth) return;
  try {
    localStorage.setItem(DEV_KEY, email.trim().toLowerCase());
  } catch {
    return;
  }
  signedIn("dev", email.trim().toLowerCase());
}

/** Sign out on this device (other devices stay signed in). */
export async function signOut() {
  const via = state.status === "in" ? state.via : null;
  try {
    localStorage.removeItem(DEV_KEY);
  } catch {
    /* nothing kept */
  }
  if (via !== "dev") await supabase().auth.signOut({ scope: "local" }).catch(() => {});
  rememberUninvited(null);
  set({ status: "out" });
}
