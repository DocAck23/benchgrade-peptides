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
