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
import { sendSubscriptionLifecycle } from "@/lib/email/notifications/send-subscription-lifecycle";
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
// Customer-facing lifecycle actions.
//
// Codex review #3 H3+M7: dropped the broad RLS UPDATE policy on
// public.subscriptions (migration 0011) because it allowed ANY column on
// owned rows to be mutated. We now use the cookie-scoped client only to
// resolve auth.uid() (the security boundary), then route the actual UPDATE
// through the service-role client with explicit ownership + transition
// filters. The atomic .in('status', ...) pattern is preserved so duplicate
// clicks no-op via rowcount=0.
// ---------------------------------------------------------------------------

export async function pauseSubscription(
  subscriptionId: string
): Promise<{ ok: boolean; error?: string }> {
  const cookie = await createServerSupabase();
  const {
    data: { user },
  } = await cookie.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const service = getSupabaseServer();
  if (!service) return { ok: false, error: "Database unavailable." };

  const pausedAt = new Date().toISOString();
  const { data, error } = await service
    .from("subscriptions")
    .update({ status: "paused", paused_at: pausedAt })
    .eq("id", subscriptionId)
    .eq("customer_user_id", user.id)
    .in("status", ["active"])
    .select();
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: "Subscription not in expected state." };
  }
  // Best-effort confirmation email. Failure does NOT roll back the pause.
  if (user.email) {
    await sendSubscriptionLifecycle({
      to: user.email,
      kind: "paused",
      display_id: `BGP-SUB-${subscriptionId.slice(0, 8)}`,
    });
  }
  return { ok: true };
}

export async function resumeSubscription(
  subscriptionId: string
): Promise<{ ok: boolean; error?: string }> {
  const cookie = await createServerSupabase();
  const {
    data: { user },
  } = await cookie.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const service = getSupabaseServer();
  if (!service) return { ok: false, error: "Database unavailable." };

  // Need ship_cadence to recompute next_ship_date from now. We use the
  // service-role client + explicit customer_user_id filter — equivalent
  // ownership gate to the prior RLS-bound SELECT.
  const { data: row, error: readError } = await service
    .from("subscriptions")
    .select("id, ship_cadence")
    .eq("id", subscriptionId)
    .eq("customer_user_id", user.id)
    .single();

  if (readError || !row) {
    return { ok: false, error: "Subscription not in expected state." };
  }

  const next = nextCycleDate(new Date(), row.ship_cadence);
  const { data, error } = await service
    .from("subscriptions")
    .update({
      status: "active",
      paused_at: null,
      // Recompute from now — pre-pause date is too far in the past to honor.
      next_ship_date: next ? next.toISOString() : null,
    })
    .eq("id", subscriptionId)
    .eq("customer_user_id", user.id)
    .in("status", ["paused"])
    .select();
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: "Subscription not in expected state." };
  }
  if (user.email) {
    await sendSubscriptionLifecycle({
      to: user.email,
      kind: "resumed",
      display_id: `BGP-SUB-${subscriptionId.slice(0, 8)}`,
      next_ship_date: next ? next.toISOString() : null,
    });
  }
  return { ok: true };
}

export async function cancelSubscription(
  subscriptionId: string,
  reason?: string,
): Promise<{ ok: boolean; error?: string }> {
  const cookie = await createServerSupabase();
  const {
    data: { user },
  } = await cookie.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const service = getSupabaseServer();
  if (!service) return { ok: false, error: "Database unavailable." };

  const cancelledAt = new Date().toISOString();
  // Optional capture for retention analytics. Trimmed + length-capped
  // so a hostile client can't bloat the row.
  const trimmedReason = reason?.trim().slice(0, 1000) ?? null;
  const { data, error } = await service
    .from("subscriptions")
    .update({
      status: "cancelled",
      cancelled_at: cancelledAt,
      ...(trimmedReason ? { cancellation_reason: trimmedReason } : {}),
    })
    .eq("id", subscriptionId)
    .eq("customer_user_id", user.id)
    .in("status", ["active", "paused"])
    .select();
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: "Subscription not in expected state." };
  }
  if (user.email) {
    await sendSubscriptionLifecycle({
      to: user.email,
      kind: "cancelled",
      display_id: `BGP-SUB-${subscriptionId.slice(0, 8)}`,
    });
  }
  return { ok: true };
}

/**
 * Skip the next scheduled cycle WITHOUT pausing the subscription.
 * Bumps `next_ship_date` forward by one cadence period and increments
 * `skipped_cycle_count` for analytics. Only works on active
 * subscriptions — paused ones can't skip (the cycle clock isn't
 * running, so "skip" wouldn't have a defined meaning).
 */
export async function skipNextCycle(
  subscriptionId: string,
): Promise<{ ok: boolean; error?: string; nextShipDate?: string }> {
  const cookie = await createServerSupabase();
  const {
    data: { user },
  } = await cookie.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const service = getSupabaseServer();
  if (!service) return { ok: false, error: "Database unavailable." };

  const { data: row, error: readError } = await service
    .from("subscriptions")
    .select("id, ship_cadence, next_ship_date, skipped_cycle_count")
    .eq("id", subscriptionId)
    .eq("customer_user_id", user.id)
    .single();
  if (readError || !row) {
    return { ok: false, error: "Subscription not in expected state." };
  }
  const cadence = row.ship_cadence as
    | "monthly"
    | "quarterly"
    | "once"
    | undefined;
  if (!cadence || cadence === "once") {
    return { ok: false, error: "This plan doesn't have recurring cycles to skip." };
  }
  const baseDate = row.next_ship_date ? new Date(row.next_ship_date) : new Date();
  const nextDate = nextCycleDate(baseDate, cadence);
  if (!nextDate) {
    return { ok: false, error: "Could not compute the next cycle date." };
  }

  const skippedCount =
    typeof row.skipped_cycle_count === "number" ? row.skipped_cycle_count : 0;
  const { data, error } = await service
    .from("subscriptions")
    .update({
      next_ship_date: nextDate.toISOString(),
      skipped_cycle_count: skippedCount + 1,
    })
    .eq("id", subscriptionId)
    .eq("customer_user_id", user.id)
    .in("status", ["active"])
    .select();
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: "Subscription not in expected state." };
  }
  if (user.email) {
    await sendSubscriptionLifecycle({
      to: user.email,
      kind: "skipped",
      display_id: `BGP-SUB-${subscriptionId.slice(0, 8)}`,
      next_ship_date: nextDate.toISOString(),
    });
  }
  return { ok: true, nextShipDate: nextDate.toISOString() };
}
