import { createClient as _createClient } from "@supabase/supabase-js";

// Uses localStorage (not cookies) so the extension auth-bridge can read the session.
// Server-side routes use lib/supabase/server.ts with cookie-based SSR client.
export function createClient() {
  return _createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { flowType: "pkce" } }
  );
}
