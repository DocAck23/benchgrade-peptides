"use server";

import { redirect } from "next/navigation";
import { setAdminCookie, clearAdminCookie, isAdmin } from "@/lib/admin/auth";
import { getSupabaseServer } from "@/lib/supabase/server";
import {
  isValidStatus,
  isValidUuid,
  type OrderStatus,
} from "@/lib/orders/status";
import type { OrderRow } from "@/lib/supabase/types";
import {
  sendPaymentConfirmed,
  sendOrderShipped,
  lookupCoaUrls,
} from "@/lib/email/notifications/send-order-emails";
import type { CartItem } from "@/lib/cart/types";
import type { SubscriptionRow } from "@/lib/supabase/types";
import { nextCycleDate } from "@/lib/subscriptions/cycles";
import crypto from "node:crypto";

const SHIPPING_CARRIERS = ["USPS", "UPS", "FedEx", "DHL"] as const;
type ShippingCarrier = (typeof SHIPPING_CARRIERS)[number];

function isValidCarrier(c: unknown): c is ShippingCarrier {
  return typeof c === "string" && (SHIPPING_CARRIERS as readonly string[]).includes(c);
}

// Common carrier tracking numbers are uppercase alphanumeric, sometimes
// with hyphens. Lowercase usually means a paste-typo; reject early so
// the customer-facing email never displays a broken link.
const TRACKING_REGEX = /^[A-Z0-9-]+$/;

export async function adminLogin(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const password = String(formData.get("password") ?? "");
  if (!password) return { ok: false, error: "Password required." };
  const ok = await setAdminCookie(password);
  if (!ok) return { ok: false, error: "Invalid password." };
  redirect("/admin");
}

export async function adminLogout(): Promise<void> {
  await clearAdminCookie();
  redirect("/admin/login");
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus
): Promise<{ ok: boolean; error?: string }> {
  if (!(await isAdmin())) return { ok: false, error: "Unauthorized." };
  // Runtime validation — TS types don't narrow over the network boundary.
  // A forged request can set `status` to anything the client chooses.
  if (!isValidUuid(orderId)) return { ok: false, error: "Invalid order id." };
  if (!isValidStatus(status)) return { ok: false, error: "Invalid status." };
  const supa = getSupabaseServer();
  if (!supa) return { ok: false, error: "Database unavailable." };
  const { error } = await supa.from("orders").update({ status }).eq("order_id", orderId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Admin marks an order as `funded` (payment received via wire/ACH/Zelle
 * or manually-confirmed crypto). Idempotent: the conditional UPDATE
 * filters on `status IN ('awaiting_payment','awaiting_wire')`, so a
 * second click on an already-funded order returns a clean error and
 * does NOT re-send the payment-confirmed email.
 */
export async function markOrderFunded(
  orderId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!(await isAdmin())) return { ok: false, error: "Unauthorized." };
  if (!isValidUuid(orderId)) return { ok: false, error: "Invalid order id." };
  const supa = getSupabaseServer();
  if (!supa) return { ok: false, error: "Database unavailable." };
  const { data, error } = await supa
    .from("orders")
    .update({ status: "funded" })
    .eq("order_id", orderId)
    .in("status", ["awaiting_payment", "awaiting_wire"])
    .select("*");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: "Order not in a fundable state." };
  }
  // Best-effort. A Resend outage must not flip our success result.
  await sendPaymentConfirmed(data[0] as OrderRow);
  return { ok: true };
}

/**
 * Admin marks an order as `shipped`. Atomic transition `funded → shipped`
 * with tracking metadata stamped in the same UPDATE; ensures the email
 * always reflects the row that actually transitioned (no torn writes).
 */
export async function markOrderShipped(
  orderId: string,
  trackingNumber: string,
  carrier: string
): Promise<{ ok: boolean; error?: string }> {
  if (!(await isAdmin())) return { ok: false, error: "Unauthorized." };
  if (!isValidUuid(orderId)) return { ok: false, error: "Invalid order id." };
  const trimmed = typeof trackingNumber === "string" ? trackingNumber.trim() : "";
  if (trimmed.length === 0 || trimmed.length > 120) {
    return { ok: false, error: "Tracking number must be 1–120 characters." };
  }
  if (!TRACKING_REGEX.test(trimmed)) {
    return {
      ok: false,
      error: "Tracking number must be uppercase letters, digits, or hyphens.",
    };
  }
  if (!isValidCarrier(carrier)) {
    return { ok: false, error: "Carrier must be one of USPS, UPS, FedEx, DHL." };
  }
  const supa = getSupabaseServer();
  if (!supa) return { ok: false, error: "Database unavailable." };
  const shippedAt = new Date().toISOString();
  const { data, error } = await supa
    .from("orders")
    .update({
      status: "shipped",
      tracking_number: trimmed,
      tracking_carrier: carrier,
      shipped_at: shippedAt,
    })
    .eq("order_id", orderId)
    .in("status", ["funded"])
    .select("*");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return {
      ok: false,
      error: "Order must be in `funded` state before it can be shipped.",
    };
  }
  const row = data[0] as OrderRow;
  await sendOrderShipped(row, lookupCoaUrls(row.items));
  return { ok: true };
}

function subtotalCentsFromItems(items: CartItem[]): number {
  let total = 0;
  for (const it of items) {
    total += Math.round(it.unit_price * 100) * it.quantity;
  }
  return total;
}

/**
 * Fire the next subscription cycle: create a fresh order linked to the
 * subscription, advance cycles_completed, recompute next_ship_date.
 *
 * Idempotency: the UPDATE filters on the *current* cycles_completed
 * value (read-then-write), so a duplicate click after a successful
 * advance returns rowcount=0. This is a 2-step "compare-and-set" that
 * has a small race window; pre-launch acceptable, v2 moves into a
 * Postgres RPC. We do NOT send the cycle-shipped email from here —
 * that fires from a separate ship action once tracking is added.
 */
export async function adminFireNextCycle(
  subscriptionId: string
): Promise<{ ok: boolean; order_id?: string; error?: string }> {
  if (!(await isAdmin())) return { ok: false, error: "Unauthorized." };
  if (!isValidUuid(subscriptionId)) return { ok: false, error: "Invalid subscription id." };
  const supa = getSupabaseServer();
  if (!supa) return { ok: false, error: "Database unavailable." };

  const { data: sub, error: readError } = await supa
    .from("subscriptions")
    .select("*")
    .eq("id", subscriptionId)
    .single();
  if (readError || !sub) {
    return { ok: false, error: readError?.message ?? "Subscription not found." };
  }
  const row = sub as SubscriptionRow;
  if (row.status !== "active") {
    return { ok: false, error: `Subscription is ${row.status}, cannot fire cycle.` };
  }
  if (row.cycles_completed >= row.cycles_total) {
    return { ok: false, error: "All cycles already completed." };
  }

  const order_id = crypto.randomUUID();
  const now = new Date();
  const cycleSubtotal = subtotalCentsFromItems(row.items as CartItem[]);
  const cycleTotal = row.cycle_total_cents;

  const { error: insertError } = await supa.from("orders").insert({
    order_id,
    customer: { name: "", email: "", ship_address_1: "", ship_city: "", ship_state: "", ship_zip: "" },
    items: row.items,
    subtotal_cents: cycleSubtotal,
    discount_cents: cycleSubtotal - cycleTotal,
    total_cents: cycleTotal,
    payment_method: row.payment_cadence === "prepay" ? "subscription_prepaid" : "bill_pay",
    status: row.payment_cadence === "prepay" ? "funded" : "awaiting_payment",
    subscription_id: subscriptionId,
    customer_user_id: row.customer_user_id,
    created_at: now.toISOString(),
    acknowledgment: {
      certification_text: "subscription-cycle",
      certification_version: "n/a",
      certification_hash: "n/a",
      is_adult: true,
      is_researcher: true,
      accepts_ruo: true,
      acknowledged_at: now.toISOString(),
      ip: "subscription",
      user_agent: "subscription-cycle",
    },
  });
  if (insertError) return { ok: false, error: insertError.message };

  const newCyclesCompleted = row.cycles_completed + 1;
  const isFinalCycle = newCyclesCompleted >= row.cycles_total;
  const next = isFinalCycle ? null : nextCycleDate(now, row.ship_cadence);
  const next_charge_date =
    row.payment_cadence === "prepay" ? null : next ? next.toISOString() : null;

  const { data: updated, error: updateError } = await supa
    .from("subscriptions")
    .update({
      cycles_completed: newCyclesCompleted,
      next_ship_date: next ? next.toISOString() : null,
      next_charge_date,
      status: isFinalCycle ? "completed" : "active",
    })
    .eq("id", subscriptionId)
    // Compare-and-set: rowcount=0 if a concurrent fire already advanced.
    .eq("cycles_completed", row.cycles_completed)
    .select();
  if (updateError) return { ok: false, error: updateError.message };
  if (!updated || updated.length === 0) {
    // Compensate: roll back the order we just inserted, otherwise we'd
    // leak a phantom order without a corresponding cycle advance.
    await supa.from("orders").delete().eq("order_id", order_id);
    return { ok: false, error: "Cycle was already advanced concurrently." };
  }

  return { ok: true, order_id };
}

/**
 * Swap items in an active subscription. Customer-requested via support.
 * Recomputes per-cycle totals from the new items + the existing
 * discount_percent (we honor whatever tier they signed up at).
 */
export async function adminSwapSubscriptionItems(
  subscriptionId: string,
  items: CartItem[]
): Promise<{ ok: boolean; error?: string }> {
  if (!(await isAdmin())) return { ok: false, error: "Unauthorized." };
  if (!isValidUuid(subscriptionId)) return { ok: false, error: "Invalid subscription id." };
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, error: "Items required." };
  }
  const supa = getSupabaseServer();
  if (!supa) return { ok: false, error: "Database unavailable." };

  const { data: sub, error: readError } = await supa
    .from("subscriptions")
    .select("id, discount_percent, status")
    .eq("id", subscriptionId)
    .single();
  if (readError || !sub) {
    return { ok: false, error: readError?.message ?? "Subscription not found." };
  }

  const subtotal = subtotalCentsFromItems(items);
  const discountPercent = (sub as { discount_percent: number }).discount_percent;
  const discountCents = Math.round((subtotal * discountPercent) / 100);
  const total = subtotal - discountCents;

  const { error: updateError } = await supa
    .from("subscriptions")
    .update({
      items,
      cycle_subtotal_cents: subtotal,
      cycle_total_cents: total,
    })
    .eq("id", subscriptionId);
  if (updateError) return { ok: false, error: updateError.message };

  // Audit log for v1 — proper audit table is v2.
  console.log("[adminSwapSubscriptionItems] swap", {
    subscriptionId,
    item_count: items.length,
    new_subtotal_cents: subtotal,
    new_total_cents: total,
  });

  return { ok: true };
}
