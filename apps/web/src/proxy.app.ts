// Keeps the Supabase session fresh on the app's pages: an expired access token is refreshed here
// and the new cookies go to both the page and the browser. App builds only (.app.ts), app routes only.
// Also gives share pages (/play/<id>) a real 404 for a private, unshared or missing game, and share pages and the
// gallery (/explore) a 503 while the API doesn't answer: the pages themselves stream after their shell is sent (Cache
// Components), too late to change the status. Both checks are for documents only (a browser's or a crawler's page
// request): the router's prefetches and in-app navigations go straight on, where the page itself answers.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { app, supabaseConfig } from "@/content/app";

const PLAY = /^\/play\/([a-z0-9]{4,40})\/?$/;
/** How long a search engine is asked to wait before it comes back, in seconds: a deploy or a restart takes about one. */
const RETRY_AFTER = "120";
/** Marks this server's own request for a page it answers 503 for (below), so it renders instead of asking again. New
 * at every start and never sent out: no one else can make a page skip these checks. */
const INNER = crypto.randomUUID();
/** When even that fails: the same words, plainly. */
const PLAIN = "<!doctype html><html lang=\"en\"><title>TypePlay</title><p>We can't load this right now. Try again in a minute.</p></html>";

/**
 * A page asked for as a document: a browser's navigation or a crawler's request. Not the app router's own requests: its
 * prefetches (Next-Router-Prefetch; the status bar's Games link prefetches /explore on every page, twice) and in-app
 * navigations (RSC: 1, or the _rsc query), which get the page's data and show its own words, with no status anyone
 * keeps. A browser's fetch() says its destination (Sec-Fetch-Dest) too; a crawler sends none of these.
 */
function isDocument(request: NextRequest): boolean {
  const h = request.headers;
  if (h.has("rsc") || h.has("next-router-prefetch") || h.has("next-router-segment-prefetch") || request.nextUrl.searchParams.has("_rsc")) return false;
  const dest = h.get("sec-fetch-dest");
  return !dest || dest === "document";
}

/** Whether the API answers this, within 5 s: true (2xx), false (404), null (no answer, or an error). */
async function ask(path: string): Promise<boolean | null> {
  try {
    const res = await fetch(`${app.apiOrigin}${path}`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    return res.ok ? true : res.status === 404 ? false : null;
  } catch {
    return null;
  }
}

/**
 * The page as it renders now (its own "We can't load this right now", in the site's look), sent as 503 Service
 * Unavailable with Retry-After. A search engine keeps a page through a 5xx and comes back, where a 200 with an error
 * on it (or noindex) would drop it from search. The page is fetched from this server itself, marked as its own.
 */
async function unavailable(request: NextRequest): Promise<Response> {
  const headers = { "Content-Type": "text/html; charset=utf-8", "Retry-After": RETRY_AFTER, "Cache-Control": "no-store" };
  // A request marked by an earlier start of this server (a reload in between) never asks again: no loop.
  if (request.headers.has("x-typeplay-inner")) return new NextResponse(PLAIN, { status: 503, headers });
  try {
    const page = await fetch(`http://127.0.0.1:${process.env.PORT ?? "3000"}${request.nextUrl.pathname}${request.nextUrl.search}`, {
      headers: { "x-typeplay-inner": INNER, "user-agent": request.headers.get("user-agent") ?? "" },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    return new NextResponse(page.body, { status: 503, headers });
  } catch {
    return new NextResponse(PLAIN, { status: 503, headers });
  }
}

export async function proxy(request: NextRequest) {
  if (request.headers.get("x-typeplay-inner") === INNER) return NextResponse.next();
  const play = PLAY.exec(request.nextUrl.pathname);
  if (request.nextUrl.pathname.startsWith("/play/") && request.nextUrl.pathname !== "/play/not-shared") {
    // A prefetch of a share page (each card in More games, the gallery's) or an in-app move to one: the page itself
    // says not found or can't load; only a document needs the status.
    if (!isDocument(request)) return NextResponse.next();
    const shared = play ? await ask(`/public/games/${play[1]}`) : false; // false too: not a game id at all
    // Not shared: "This game isn't here", prerendered with a 404 (a rewrite can't set the status).
    if (shared === false) return NextResponse.rewrite(new URL("/play/not-shared", request.url));
    return shared === null ? unavailable(request) : NextResponse.next();
  }
  // The gallery: the same request its page makes first (Popular's first page), one game long.
  if (request.nextUrl.pathname === "/explore") {
    if (!isDocument(request)) return NextResponse.next();
    return (await ask("/public/gallery?sort=popular&limit=1")) ? NextResponse.next() : unavailable(request);
  }

  let response = NextResponse.next({ request });
  const client = createServerClient(supabaseConfig.url, supabaseConfig.publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookies, headers) {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });
  // Reads the session cookie and refreshes it when due. Signed out: nothing happens. Supabase out
  // of reach: the page still loads, and the browser client refreshes the session itself later.
  try {
    await client.auth.getClaims();
  } catch {
    /* see above */
  }
  return response;
}

export const config = {
  // /play/<id> only (not its preview.png, which answers 404 itself).
  matcher: ["/create", "/games", "/games/:path*", "/account", "/billing", "/billing/:path*", "/play/:id", "/explore"],
};
