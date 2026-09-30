import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// One browser client for the whole app. The URL and anon key are public by design; row level
// security in the database decides what each signed-in user can read.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** False in a build without Supabase settings (e.g. a preview); the app then says so. */
export const supabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | undefined;

export function supabase(): SupabaseClient {
  if (!url || !anonKey) throw new Error("Supabase is not configured");
  client ??= createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // PKCE: Google sends the browser back with ?code=, which the client exchanges on load.
      flowType: "pkce",
      detectSessionInUrl: true,
    },
  });
  return client;
}
