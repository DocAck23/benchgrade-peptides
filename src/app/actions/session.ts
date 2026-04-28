"use server";

import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/client";

/**
 * Sign-out server action invoked from the global header dropdown.
 *
 * Calls Supabase's signOut() which revokes the current session token
 * and lets the cookie adapter clear the auth cookies on the response.
 * Then redirects home — `redirect()` throws a sentinel that Next
 * unwinds before any further work, so failures in cookie-clearing
 * still land the user on `/` with the cookies pruned by the adapter
 * during the action's lifecycle.
 */
export async function signOutAction(): Promise<void> {
  const supa = await createServerSupabase();
  try {
    await supa.auth.signOut();
  } catch (err) {
    // Best-effort: even if the remote revoke fails, the local cookie
    // is gone after the cookie adapter writes back. Log and proceed.
    console.error("[signOutAction] supabase.signOut failed:", err);
  }
  // redirect() must live OUTSIDE the try/catch — its sentinel is what
  // tells Next to issue the 307; swallowing it leaves the action with
  // no response.
  redirect("/");
}
