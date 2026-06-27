import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Builds the browser Supabase client from the public env keys. The repository
 * factory (`repository.ts`) decides whether to use it; this just constructs it.
 * Anon key is intentionally a public client-side value (see the spec — the app
 * has no login, so it's effectively a shared household secret).
 */
export function createSupabaseClient(
  url: string,
  anonKey: string,
): SupabaseClient {
  return createClient(url, anonKey);
}
