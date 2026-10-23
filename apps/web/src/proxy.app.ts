// Keeps the Supabase session fresh on the app's pages: an expired access token is refreshed here
// and the new cookies go to both the page and the browser. App builds only (.app.ts), app routes only.
// Also gives share pages (/play/<id>) a real 404 for a private, unshared or missing game: the page
// itself streams after its shell is sent (Cache Components), too late to change the status.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { app, supabaseConfig } from "@/content/app";

const PLAY = /^\/play\/([a-z0-9]{4,40})\/?$/;

export async function proxy(request: NextRequest) {
  const play = PLAY.exec(request.nextUrl.pathname);
  if (request.nextUrl.pathname.startsWith("/play/") && request.nextUrl.pathname !== "/play/not-shared") {
    let shared: boolean | null = null; // null: the API didn't answer; the page shows its own error
    if (play) {
      try {
        const res = await fetch(`${app.apiOrigin}/public/games/${play[1]}`, { cache: "no-store" });
        shared = res.ok ? true : res.status === 404 ? false : null;
      } catch {
        shared = null;
      }
    } else {
      shared = false; // not a game id at all
    }
    // Not shared: "This game isn't here", prerendered with a 404 (a rewrite can't set the status).
    return shared === false ? NextResponse.rewrite(new URL("/play/not-shared", request.url)) : NextResponse.next();
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
  matcher: ["/create", "/games", "/games/:path*", "/account", "/billing", "/billing/:path*", "/play/:id"],
};
