"use server";

import type { CartItem } from "@/lib/cart/types";
import {
  computeSubscriptionTotals,
  subscriptionDiscountPercent,
  type SubscriptionPlanInput,
} from "@/lib/subscriptions/discounts";
import { nextCycleDate } from "@/lib/subscriptions/cycles";
import { getSupabaseServer } from "@/lib/supabase/server";
import { createServerSupabase } from "@/lib/supabase/client";
import { sendSubscriptionStarted } from "@/lib/email/notifications/send-subscription-emails";
import type { SubscriptionRow } from "@/lib/supabase/types";

export interface CreateSubscriptionInput {
  /** null when guest checkout — backfill on claim. */
  customer_user_id: string | null;
  customer_email: string;
  items: CartItem[];
  plan: SubscriptionPlanInput;
  /** The order created at checkout — links cycle 1. */
  first_order_id: string;
}

export interface CreateSubscriptionResult {
  ok: boolean;
  subscription_id?: string;
  error?: string;
}

function subtotalCents(items: CartItem[]): number {
  let total = 0;
  for (const it of items) {
    total += Math.round(it.unit_price * 100) * it.quantity;
  }
  return total;
}

/**
 * Create a new subscription row. Service-role client because the row
 * may belong to a guest (customer_user_id = null) at checkout time and
 * RLS would otherwise block. Server is the authoritative pricing source —
 * the client never sees `discount_percent` or `cycle_total_cents`.
 */
export async function createSubscription(
  input: CreateSubscriptionInput
): Promise<CreateSubscriptionResult> {
  // Validate plan up front; refuse to even call the DB on an invalid combo.
  const discount_percent = subscriptionDiscountPercent(input.plan);
  if (discount_percent === 0) {
    return { ok: false, error: "Invalid plan combination" };
  }

  const supa = getSupabaseServer();
  if (!supa) return { ok: false, error: "Database unavailable." };

  const subtotal_cents = subtotalCents(input.items);
  const totals = computeSubscriptionTotals(subtotal_cents, input.plan);

  const now = new Date();
  const next = nextCycleDate(now, input.plan.ship_cadence);

  // Cycle 1 is paid at checkout; cycle 2+ for bill-pay charges on the
  // ship date. Prepay never has a future charge — already paid in full.
  const next_charge_date =
    input.plan.payment_cadence === "prepay" ? null : next ? next.toISOString() : null;

  const row = {
    customer_user_id: input.customer_user_id,
    plan_duration_months: input.plan.duration_months,
    payment_cadence: input.plan.payment_cadence,
    ship_cadence: input.plan.ship_cadence,
    items: input.items,
    cycle_subtotal_cents: totals.cycle_subtotal_cents,
    cycle_total_cents: totals.cycle_total_cents,
    discount_percent: totals.discount_percent,
    status: "active" as const,
    // Cycle 1 ships from the order created at checkout; cycle 2 ships next.
    next_ship_date: next ? next.toISOString() : null,
    next_charge_date,
    cycles_completed: 1,
    cycles_total: input.plan.duration_months,
    first_order_id: input.first_order_id,
  };

  const { data, error } = await supa
    .from("subscriptions")
    .insert(row)
    .select()
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Insert failed." };
  }

  const inserted = data as SubscriptionRow & { id: string };

  // Best-effort email — a Resend outage must NOT roll back a row that
  // already landed in Postgres.
  try {
    const upcoming: string[] = [];
    if (next) {
      let cursor = next;
      for (let i = 0; i < 3; i++) {
        upcoming.push(cursor.toISOString());
        const advance = nextCycleDate(cursor, input.plan.ship_cadence);
        if (!advance) break;
        cursor = advance;
      }
    }
    await sendSubscriptionStarted(input.customer_email, {
      subscription_id: inserted.id,
      customer: {
        name: "",
        email: input.customer_email,
        institution: "",
        phone: "",
        ship_address_1: "",
        ship_city: "",
        ship_state: "",
        ship_zip: "",
      },
      items: input.items,
      plan_duration_months: input.plan.duration_months,
      payment_cadence: input.plan.payment_cadence,
      ship_cadence: input.plan.ship_cadence,
      cycle_total_cents: totals.cycle_total_cents,
      plan_total_cents: totals.plan_total_cents,
      next_ship_date: next ? next.toISOString() : "",
      upcoming_ship_dates: upcoming,
      savings_vs_retail_cents: totals.savings_vs_retail_cents,
    });
  } catch (err) {
    console.error("[createSubscription] subscription-started email failed:", err);
  }

  return { ok: true, subscription_id: inserted.id };
}

// ---------------------------------------------------------------------------
// Customer-facing lifecycle actions. Cookie-scoped client so RLS is the
// authoritative ownership boundary — a hostile caller passing someone
// else's subscription_id gets rowcount = 0, the same as an invalid state.
// ---------------------------------------------------------------------------

export async function pauseSubscription(
  subscriptionId: string
): Promise<{ ok: boolean; error?: string }> {
  const supa = await createServerSupabase();
  const pausedAt = new Date().toISOString();
  const { data, error } = await supa
    .from("subscriptions")
    .update({ status: "paused", paused_at: pausedAt })
    .eq("id", subscriptionId)
    .in("status", ["active"])
    .select();
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: "Subscription not in expected state." };
  }
  return { ok: true };
}

export async function resumeSubscription(
  subscriptionId: string
): Promise<{ ok: boolean; error?: string }> {
  const supa = await createServerSupabase();

  // Need ship_cadence to recompute next_ship_date from now. RLS gates the
  // SELECT — non-owner sees null/error, same as the UPDATE path.
  const { data: row, error: readError } = await supa
    .from("subscriptions")
    .select("id, ship_cadence")
    .eq("id", subscriptionId)
    .single();

  if (readError || !row) {
    return { ok: false, error: "Subscription not in expected state." };
  }

  const next = nextCycleDate(new Date(), row.ship_cadence);
  const { data, error } = await supa
    .from("subscriptions")
    .update({
      status: "active",
      paused_at: null,
      // Recompute from now — pre-pause date is too far in the past to honor.
      next_ship_date: next ? next.toISOString() : null,
    })
    .eq("id", subscriptionId)
    .in("status", ["paused"])
    .select();
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: "Subscription not in expected state." };
  }
  return { ok: true };
}

export async function cancelSubscription(
  subscriptionId: string
): Promise<{ ok: boolean; error?: string }> {
  const supa = await createServerSupabase();
  const cancelledAt = new Date().toISOString();
  const { data, error } = await supa
    .from("subscriptions")
    .update({ status: "cancelled", cancelled_at: cancelledAt })
    .eq("id", subscriptionId)
    .in("status", ["active", "paused"])
    .select();
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: "Subscription not in expected state." };
  }
  return { ok: true };
}
