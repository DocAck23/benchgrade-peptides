"use client";

import { useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { clarityInit, clarityIdentify } from "@/lib/analytics/clarity";

/**
 * Microsoft Clarity bootstrap. Loads the Clarity SDK on the client when
 * NEXT_PUBLIC_CLARITY_PROJECT_ID is set. Then, if a Supabase auth
 * session exists, tags every subsequent replay with the customer's
 * email so the dashboard is searchable by who, not just by when.
 *
 * Gated to "the env var is present" so dev builds with no ID stay
 * out of the production Clarity dashboard.
 */
export function ClarityScript() {
  useEffect(() => {
    const id = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;
    if (!id) return;
    clarityInit(id);

    // Identify the current user if they're logged in. Don't await —
    // identify is a fire-and-forget tag; if Clarity races init, the
    // call inside the helper no-ops and we'll catch them on the
    // next page navigation.
    void (async () => {
      try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!url || !key) return;
        const supa = createBrowserClient(url, key);
        const { data } = await supa.auth.getUser();
        const email = data.user?.email ?? null;
        if (email) clarityIdentify(email);
      } catch {
        /* best-effort */
      }
    })();
  }, []);

  return null;
}
