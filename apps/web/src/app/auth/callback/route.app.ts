// Google → Supabase → here with ?code=…: swap the code for a session (PKCE; the verifier is in a
// cookie the browser client set), then back to where the visitor was. App builds only (.app.ts).
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "@/content/app";
import { safeNext } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));
  const failed = new URL("/create?signin=failed", url);
  // Google says no (the visitor cancelled) or Supabase sends an error instead of a code.
  if (!code) return NextResponse.redirect(failed);

  const response = NextResponse.redirect(new URL(next, url));
  const client = createServerClient(supabaseConfig.url, supabaseConfig.publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookies, headers) {
        cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });
  const { error } = await client.auth.exchangeCodeForSession(code);
  return error ? NextResponse.redirect(failed) : response;
}
