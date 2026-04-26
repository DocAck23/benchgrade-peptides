"use server";

import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * Backfill `customer_user_id` on every guest order whose
 * `customer.email` matches `email`. Called from the auth callback
 * after a successful magic-link exchange so a customer who first
 * placed an order as a guest can see those orders the moment they
 * claim their account.
 *
 * Semantics:
 *   - Case-insensitive email match (`ilike` against the lower-cased
 *     input). Pairs with the `orders_customer_email_lower_idx` index
 *     on `lower(customer->>'email')` from migration 0004 for an
 *     index-only scan.
 *   - First-claim-wins: the filter `customer_user_id IS NULL`
 *     guarantees we never overwrite an existing claim. If a second
 *     user later authenticates with the same email (e.g. a typo'd
 *     order address that lands in someone else's inbox), they get
 *     `linked: 0` — the orders stay with the first claimant.
 *   - Idempotent: a second call from the same user matches zero rows
 *     (the first call already set them) and returns `{ ok: true,
 *     linked: 0 }` — no error, no duplicate writes.
 *
 * Failures are logged and surfaced as `{ ok: false, linked: 0 }`.
 * Callers in the auth callback continue the redirect on failure —
 * the user is already authenticated, link-up is a best-effort UX
 * nicety and can be retried on next sign-in.
 */
export async function linkOrdersToUser(
  userId: string,
  email: string
): Promise<{ ok: boolean; linked: number }> {
  const supa = getSupabaseServer();
  if (!supa) return { ok: false, linked: 0 };

  const lower = email.trim().toLowerCase();

  const { data, error } = await supa
    .from("orders")
    .update({ customer_user_id: userId })
    // First-claim-wins: only touch rows that haven't been claimed yet.
    .filter("customer_user_id", "is", null)
    // Case-insensitive email match against customer->>email JSON path.
    .filter("customer->>email", "ilike", lower)
    .select("order_id");

  if (error) {
    console.error("[linkOrdersToUser]", error);
    return { ok: false, linked: 0 };
  }

  return { ok: true, linked: data?.length ?? 0 };
}
