import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * Insert or revive a marketing subscriber. Default behaviour at
 * checkout: customers are opted in unless they untick the box. This
 * function is idempotent — a customer who places multiple orders gets
 * one row; if they previously unsubscribed, this re-subscribes them
 * (which matches what they signaled on the new checkbox).
 *
 * Best-effort. Errors are logged, never thrown — marketing-list
 * housekeeping must never block an order.
 */
export async function upsertMarketingSubscriber(
  email: string,
  source_order_id: string,
): Promise<void> {
  const supa = getSupabaseServer();
  if (!supa) return;
  const email_lower = email.trim().toLowerCase();
  if (!email_lower) return;
  try {
    await supa.from("marketing_subscribers").upsert(
      {
        email_lower,
        source_order_id,
        // Re-subscribe if they had previously unsubscribed.
        unsubscribed_at: null,
      },
      { onConflict: "email_lower" },
    );
  } catch (err) {
    console.error("[upsertMarketingSubscriber] failed:", err);
  }
}

/**
 * Mark an email as unsubscribed. Called from the customer-portal
 * settings page and from the unsubscribe link in any future
 * marketing email. Idempotent.
 */
export async function unsubscribeMarketingEmail(
  email: string,
): Promise<{ ok: boolean; error?: string }> {
  const supa = getSupabaseServer();
  if (!supa) return { ok: false, error: "Database unavailable." };
  const email_lower = email.trim().toLowerCase();
  if (!email_lower) return { ok: false, error: "Email required." };
  const { error } = await supa
    .from("marketing_subscribers")
    .upsert(
      {
        email_lower,
        unsubscribed_at: new Date().toISOString(),
      },
      { onConflict: "email_lower" },
    );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Check whether an email is currently subscribed. Used by future
 * marketing-email send paths to filter out unsubscribed addresses
 * even when the audience query forgets to.
 */
export async function isMarketingSubscribed(email: string): Promise<boolean> {
  const supa = getSupabaseServer();
  if (!supa) return false;
  const email_lower = email.trim().toLowerCase();
  if (!email_lower) return false;
  const { data } = await supa
    .from("marketing_subscribers")
    .select("unsubscribed_at")
    .eq("email_lower", email_lower)
    .maybeSingle();
  if (!data) return false;
  return data.unsubscribed_at === null;
}
