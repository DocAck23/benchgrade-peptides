"use server";

import { z } from "zod";
import { getSupabaseServer } from "@/lib/supabase/server";
import { createServerSupabase } from "@/lib/supabase/client";

/**
 * Checks whether the current researcher has lifetime free shipping
 * (member of the FIRST250 launch cohort, ledger row in
 * `lifetime_free_shipping`). Resolution order:
 *   1. If signed in: look up auth user's email → ledger.
 *   2. Else if caller passes an email (e.g. customer typed it into
 *      checkout): look up that email directly.
 *   3. Otherwise return `{ eligible: false }`.
 *
 * Best-effort: any infra error returns false (conservative — we'd
 * rather show the threshold pill than wrongly promise free shipping).
 */

const Schema = z.object({
  email: z.string().trim().email().max(200).optional().nullable(),
});

export async function getLifetimeShippingForMe(
  raw: unknown,
): Promise<{ eligible: boolean }> {
  const parsed = Schema.safeParse(raw);
  const email = parsed.success ? parsed.data.email ?? null : null;

  let resolvedEmail = email?.trim().toLowerCase() ?? null;

  // If signed in, prefer the auth-bound email over the typed one —
  // it's the canonical identity for this session.
  try {
    const cookieClient = await createServerSupabase();
    const {
      data: { user },
    } = await cookieClient.auth.getUser();
    if (user?.email) {
      resolvedEmail = user.email.toLowerCase();
    }
  } catch {
    /* ignore — fall through with whatever email was provided */
  }

  if (!resolvedEmail) return { eligible: false };

  const supa = getSupabaseServer();
  if (!supa) return { eligible: false };

  try {
    const { count } = await supa
      .from("lifetime_free_shipping")
      .select("email_lower", { count: "exact", head: true })
      .eq("email_lower", resolvedEmail);
    return { eligible: (count ?? 0) > 0 };
  } catch (err) {
    console.error("[getLifetimeShippingForMe] failed:", err);
    return { eligible: false };
  }
}
