// Google's own sign-in button (Google Identity Services), for app.googleButton (content/app.ts;
// docs/launch/google-sign-in-name.md). Loads Google's script on the pages that show the button, makes a fresh nonce for
// every sign-in, and hands Google's ID token, with that nonce, to whoever mounted the button.
//
// Security (2026-11-04):
// - The nonce is 32 random bytes, kept in this page's memory only, used once. Google gets its SHA-256 (hex) and writes
//   that into the ID token; Supabase gets the raw value and checks the hash (its id_token grant), so a Google token
//   this page didn't ask for (one made for another page or another attempt) is refused. A token for an older nonce is
//   never sent. Supabase keeps no list of used nonces: the token and the raw nonce travel together, over HTTPS only.
// - Google gives tokens only to the OAuth client's authorized JavaScript origins (Google Cloud: https://typeplay.app,
//   http://localhost:3000); that list is the real boundary, as the client ID is public. This file also starts the
//   button only on this site's own origin (localhost in development).
// - Supabase checks the token itself (Google's signature, our client ID as its audience, the nonce) and makes the
//   session, as for the redirect; the API checks Supabase's token as before. Nothing here is secret: the client ID is
//   in every sign-in's address.
// - If the site ever gets a Content-Security-Policy, Google's button needs https://accounts.google.com/gsi/ in
//   script-src (gsi/client), frame-src, connect-src and style-src (gsi/style); a Cross-Origin-Opener-Policy has to be
//   same-origin-allow-popups for its popup.
import { googleConfig } from "@/content/app";
import { site } from "@/content/site";

const SCRIPT = "https://accounts.google.com/gsi/client";
/** How long Google's script may take before the page falls back to the redirect. */
const LOAD_MS = 10_000;
/** …and then Google's button, in its own frame: 0x0 when Google refuses the origin or a blocker stops the frame. */
const DRAW_MS = 8_000;

type GoogleId = {
  initialize(config: Record<string, unknown>): void;
  renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
  disableAutoSelect(): void;
};
declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleId } };
  }
}

/** Google's button looks (its branding rules allow only these): `dark` the page's sign-in, `light` beside quiet buttons. */
export type GoogleButtonLook = {
  theme: "filled_black" | "outline";
  /** large is 40px tall; medium (32px) is never personalised with an account ("Continue as …"). */
  size: "large" | "medium";
  text: "signin_with" | "continue_with";
  /** How wide Google draws `text` (measured 11-04): in a narrower place it says only "Sign in", Google's shortest. */
  needs: number;
};
export type OnGoogleToken = (credential: string, nonce: string) => void;

type Mount = { el: HTMLElement; look: GoogleButtonLook; onToken: OnGoogleToken };
const mounts: Mount[] = [];
/** The button pressed last (Google's click_listener): its token goes to it, not to whichever button mounted last. */
let pressed: Mount | null = null;
let loading: Promise<GoogleId> | null = null;
let current: { raw: string; hashed: string } | null = null;

/** The origins this page may start Google's button on: the live site, or localhost in development and tests. */
export function originAllowed(origin: string, production = process.env.NODE_ENV === "production"): boolean {
  if (origin === `https://${site.domain}`) return true;
  return !production && /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(origin);
}

/** Google's script, once per page; rejected when it can't load (a blocker, offline) or isn't Google's button API. */
function loadGoogle(): Promise<GoogleId> {
  loading ??= new Promise<GoogleId>((resolve, reject) => {
    const ready = () => window.google?.accounts?.id;
    const found = ready();
    if (found) return resolve(found);
    const script = document.createElement("script");
    const fail = (why: string) => {
      clearTimeout(timer);
      script.remove();
      loading = null; // a later button tries again
      reject(new Error(why));
    };
    const timer = setTimeout(() => fail("Google's sign-in script took too long"), LOAD_MS);
    script.src = SCRIPT;
    script.async = true;
    script.onload = () => {
      const id = ready();
      if (!id) return fail("Google's sign-in script has no button");
      clearTimeout(timer);
      resolve(id);
    };
    script.onerror = () => fail("Google's sign-in script didn't load");
    document.head.appendChild(script);
  });
  return loading;
}

const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** A one-time nonce: 32 random bytes (base64url) and its SHA-256 in hex, the form Supabase compares (its id_token grant). */
export async function newNonce(): Promise<{ raw: string; hashed: string }> {
  const raw = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const hashed = hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw))));
  return { raw, hashed };
}

/** Google's client for this page with a new nonce, and every mounted button drawn again with it. */
async function renew(id: GoogleId) {
  const nonce = await newNonce();
  current = nonce;
  id.initialize({
    client_id: googleConfig.clientId,
    nonce: nonce.hashed,
    callback: ({ credential }: { credential?: string }) => {
      // One token per nonce, and only for the newest one; then a fresh nonce for the next try.
      if (current !== nonce || !credential) return;
      current = null;
      const to = pressed && mounts.includes(pressed) ? pressed : mounts.at(-1);
      to?.onToken(credential, nonce.raw);
      void renew(id);
    },
    ux_mode: "popup",
    // Chrome (desktop 125+, Android 128+) shows its own sign-in dialog naming this site; others get Google's popup.
    use_fedcm_for_button: true,
    // Never sign anyone in without their tap.
    auto_select: false,
    button_auto_select: false,
  });
  for (const m of mounts) draw(id, m);
}

/**
 * Google's button, as wide as its words, or as its place when that is wider (a phone's full-width row; Google's most is
 * 400px). A place too narrow for the words (a 280px screen) gets Google's shortest, "Sign in".
 */
function draw(id: GoogleId, m: Mount) {
  const room = Math.floor(m.el.parentElement?.getBoundingClientRect().width ?? 0);
  const { needs, ...look } = m.look;
  m.el.replaceChildren();
  id.renderButton(m.el, {
    type: "standard",
    shape: "pill",
    logo_alignment: "left",
    locale: "en",
    ...look,
    ...(room > 0 && room < needs ? { text: "signin" } : {}),
    ...(room > 0 ? { width: Math.min(400, room) } : {}),
    click_listener: () => {
      pressed = m;
    },
  });
}

/** Whether Google's button takes room in `el` within `ms` (its frame stays 0x0 when Google refuses the origin). */
function drawn(el: HTMLElement, ms: number): Promise<boolean> {
  const there = () => el.getBoundingClientRect().height >= 20;
  if (there()) return Promise.resolve(true);
  return new Promise((resolve) => {
    const done = (yes: boolean) => {
      watch.disconnect();
      clearTimeout(timer);
      resolve(yes);
    };
    const watch = new ResizeObserver(() => {
      if (there()) done(true);
    });
    const timer = setTimeout(() => done(there()), ms);
    watch.observe(el);
  });
}

/**
 * Draws Google's button into `el` and calls `onToken` with Google's ID token and the raw nonce after a sign-in there.
 * `onState` says "ready" once Google's button is on the page, or "unavailable" when it can't be (this origin, a blocker,
 * offline, Google refusing the origin): the page then offers the redirect instead. Returns the clean-up.
 */
export function mountGoogleButton(el: HTMLElement, look: GoogleButtonLook, onToken: OnGoogleToken, onState: (state: "ready" | "unavailable") => void) {
  let gone = false;
  const mount: Mount = { el, look, onToken };
  if (!originAllowed(location.origin)) {
    queueMicrotask(() => {
      if (!gone) onState("unavailable");
    });
    return () => {
      gone = true;
    };
  }
  mounts.push(mount);
  loadGoogle()
    .then(async (id) => {
      if (gone) return;
      if (current) draw(id, mount);
      else await renew(id);
      const there = !gone && (await drawn(el, DRAW_MS));
      if (!gone) onState(there ? "ready" : "unavailable");
    })
    .catch(() => {
      if (!gone) onState("unavailable");
    });
  return () => {
    gone = true;
    const at = mounts.indexOf(mount);
    if (at >= 0) mounts.splice(at, 1);
    if (pressed === mount) pressed = null;
    el.replaceChildren();
  };
}

/** Signing out: Google's script, if this page loaded it, forgets the choice, so nothing signs in again by itself. */
export function forgetGoogleChoice() {
  window.google?.accounts?.id?.disableAutoSelect();
}
