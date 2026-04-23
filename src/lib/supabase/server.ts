import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// We only memoize the *client* (non-null) case. Caching a null result
// would stick forever if env vars were missing at the first read, even
// after a live rotation — no way out without restarting the lambda.
let cached: SupabaseClient | null = null;

export function getSupabaseServer(): SupabaseClient | null {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
