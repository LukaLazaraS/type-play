// The browser's Supabase client (Google sign-in, PKCE). The session lives in cookies, so the
// /auth/callback route and the proxy can read and refresh it too.
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseConfig } from "@/content/app";

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  client ??= createBrowserClient(supabaseConfig.url, supabaseConfig.publishableKey);
  return client;
}

/** Only same-site paths: never send the visitor to another site after sign-in (./safe-next.ts). */
export { safeNext } from "./safe-next";
