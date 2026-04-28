import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Attention counts for the customer portal nav (sidebar + global header
 * dropdown). Each value drives a `(N)` pill on the corresponding nav
 * item to pull the customer back to surfaces that need their action.
 *
 * Best-effort: any individual count failure resolves to 0 so the nav
 * renders even when one query is in trouble. Caller passes a
 * cookie-scoped Supabase client (RLS-bound to the current user).
 */
export interface AccountAttentionCounts {
  orders: number;
  messages: number;
}

export async function getAccountAttention(
  supa: SupabaseClient,
  userId: string,
): Promise<AccountAttentionCounts> {
  let orders = 0;
  let messages = 0;
  try {
    const { count } = await supa
      .from("orders")
      .select("order_id", { count: "exact", head: true })
      .eq("customer_user_id", userId)
      .eq("status", "awaiting_payment");
    orders = typeof count === "number" ? count : 0;
  } catch {
    orders = 0;
  }
  try {
    const { count } = await supa
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("customer_user_id", userId)
      .eq("sender", "admin")
      .is("read_at", null);
    messages = typeof count === "number" ? count : 0;
  } catch {
    messages = 0;
  }
  return { orders, messages };
}
