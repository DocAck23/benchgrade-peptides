"use server";

import { z } from "zod";
import { getSupabaseServer } from "@/lib/supabase/server";
import { createServerSupabase } from "@/lib/supabase/client";
import { revalidatePath } from "next/cache";
import { isPaymentMethod, enabledPaymentMethods, type PaymentMethod } from "@/lib/payments/methods";
import { isValidUuid } from "@/lib/orders/status";
import { createNowpaymentsInvoice } from "@/lib/payments/nowpayments/invoice";
import { sendCryptoPaymentLink } from "@/lib/email/notifications/send-order-emails";
import type { OrderRow } from "@/lib/supabase/types";
import { US_STATES_AND_TERRITORIES } from "@/lib/geography/us-states";
import {
  unsubscribeMarketingEmail,
  isMarketingSubscribed,
} from "@/lib/marketing/subscribers";

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
  // ILIKE treats `%` and `_` as wildcards. RFC-allowed `_` is the
  // common case (e.g. `firstname_lastname@x.com`) — without escaping,
  // `john_doe@x.com` would match `johnXdoe@x.com` and the wrong
  // user could claim someone else's orders. Escape both so the
  // pattern matches only the literal address.
  const safe = lower
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");

  const { data, error } = await supa
    .from("orders")
    .update({ customer_user_id: userId })
    // First-claim-wins: only touch rows that haven't been claimed yet.
    .filter("customer_user_id", "is", null)
    // Case-insensitive but literal: ILIKE against the JSON path with
    // % and _ escaped so the match is byte-for-byte (mod case).
    .filter("customer->>email", "ilike", safe)
    .select("order_id");

  if (error) {
    console.error("[linkOrdersToUser]", error);
    return { ok: false, linked: 0 };
  }

  return { ok: true, linked: data?.length ?? 0 };
}

interface ChangeMethodResult {
  ok: boolean;
  error?: string;
  invoice_url?: string;
}

/**
 * Customer-driven payment-method swap on an awaiting-payment order.
 *
 * Gates:
 *   - Order must belong to the calling user (RLS via cookie-scoped client).
 *   - Order must be in `awaiting_payment` or legacy `awaiting_wire`.
 *   - Target method must be enabled in the current env.
 *
 * Side effects:
 *   - Updates `payment_method` on the order row.
 *   - For `crypto`, creates a NOWPayments invoice (if not already
 *     present) and emails the hosted link. Best-effort: a NP outage
 *     does not roll back the method change — the customer can retry
 *     by clicking the same Switch button again.
 */
export async function changeOrderPaymentMethod(
  order_id: string,
  next_method: PaymentMethod,
): Promise<ChangeMethodResult> {
  if (!isValidUuid(order_id)) return { ok: false, error: "Invalid order id." };
  if (!isPaymentMethod(next_method)) return { ok: false, error: "Invalid payment method." };
  if (!enabledPaymentMethods().includes(next_method)) {
    return { ok: false, error: `Payment method "${next_method}" is not currently available.` };
  }

  const cookieScoped = await createServerSupabase();
  // Read via cookie-scoped client so RLS confirms ownership.
  const { data: existing, error: readErr } = await cookieScoped
    .from("orders")
    .select(
      "order_id, status, payment_method, customer, items, subtotal_cents, total_cents, nowpayments_invoice_url, nowpayments_invoice_id",
    )
    .eq("order_id", order_id)
    .maybeSingle();
  if (readErr || !existing) {
    return { ok: false, error: "Order not found." };
  }
  if (
    existing.status !== "awaiting_payment" &&
    existing.status !== "awaiting_wire"
  ) {
    return {
      ok: false,
      error: "Payment method can only be changed before payment is received.",
    };
  }

  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: "Database unavailable." };

  // Persist the method change. We use the admin client for the write so
  // RLS doesn't block — ownership was already verified above via the
  // cookie-scoped read. The `.in("status", ...)` guard closes the TOCTOU
  // window between the cookie-scoped read and this write: if the order
  // funded concurrently (admin marked it, IPN landed) the rowcount is
  // zero and we abort instead of silently mutating a paid order.
  const { data: updated, error: updateErr } = await admin
    .from("orders")
    .update({ payment_method: next_method })
    .eq("order_id", order_id)
    .in("status", ["awaiting_payment", "awaiting_wire"])
    .select("order_id");
  if (updateErr) {
    return { ok: false, error: `Update failed: ${updateErr.message}` };
  }
  if (!updated || updated.length === 0) {
    return {
      ok: false,
      error: "Order is no longer awaiting payment — method cannot be changed.",
    };
  }

  let invoice_url: string | undefined =
    typeof existing.nowpayments_invoice_url === "string"
      ? existing.nowpayments_invoice_url
      : undefined;

  // Crypto path — create the invoice if the order didn't already have one.
  if (next_method === "crypto" && !invoice_url) {
    try {
      const total = typeof existing.total_cents === "number"
        ? existing.total_cents
        : (existing as { subtotal_cents: number }).subtotal_cents;
      const items = Array.isArray(existing.items) ? existing.items : [];
      const description =
        items
          .slice(0, 3)
          .map((i: { name?: string; quantity?: number }) =>
            `${i.name ?? "item"} ×${i.quantity ?? 1}`,
          )
          .join(", ") || `Order ${order_id.slice(0, 8)}`;
      const inv = await createNowpaymentsInvoice({
        order_id,
        order_description: description,
        amount_usd: total / 100,
      });
      if (inv.ok) {
        invoice_url = inv.invoice_url;
        await admin
          .from("orders")
          .update({
            nowpayments_invoice_id: inv.invoice_id,
            nowpayments_invoice_url: inv.invoice_url,
          })
          .eq("order_id", order_id);
        // Refetch the row so the email helper has the fresh values.
        const { data: refreshed } = await admin
          .from("orders")
          .select("*")
          .eq("order_id", order_id)
          .maybeSingle();
        if (refreshed) {
          await sendCryptoPaymentLink(
            refreshed as unknown as OrderRow,
            inv.invoice_url,
          );
        }
      } else {
        console.error("[changeOrderPaymentMethod] NOWPayments failed:", inv.reason);
      }
    } catch (err) {
      console.error("[changeOrderPaymentMethod] crypto path threw:", err);
    }
  }

  revalidatePath(`/account/orders/${order_id}`);
  return { ok: true, invoice_url };
}

// ---------- Customer self-serve: edit address + cancel before pay ----------
//
// Both actions only operate on orders in `awaiting_payment` /
// `awaiting_wire`. Once payment is in (funded), only admin can change
// anything — bank reversals are out of scope for self-service.
//
// Authorization: cookie-scoped read confirms ownership (RLS); admin-
// client write applies the change with `.in("status", ...)` to close
// the TOCTOU window between read and write.

const ShipAddressSchema = z.object({
  ship_address_1: z.string().trim().min(1, "Address is required.").max(200),
  ship_address_2: z.string().trim().max(200).optional().default(""),
  ship_city: z.string().trim().min(1, "City is required.").max(100),
  ship_state: z
    .string()
    .trim()
    .transform((s) => s.toUpperCase())
    .refine((s) => US_STATES_AND_TERRITORIES.has(s), {
      message: "Valid US state, territory, or APO code is required.",
    }),
  ship_zip: z
    .string()
    .trim()
    .regex(/^\d{5}(-\d{4})?$/u, "ZIP code is invalid."),
});

export type ShipAddressInput = z.input<typeof ShipAddressSchema>;

export async function editOrderShippingAddress(
  order_id: string,
  input: ShipAddressInput,
): Promise<{ ok: boolean; error?: string }> {
  if (!isValidUuid(order_id)) return { ok: false, error: "Invalid order id." };
  const parsed = ShipAddressSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid address." };
  }

  const cookieScoped = await createServerSupabase();
  const { data: existing, error: readErr } = await cookieScoped
    .from("orders")
    .select("order_id, status, customer")
    .eq("order_id", order_id)
    .maybeSingle();
  if (readErr || !existing) return { ok: false, error: "Order not found." };
  if (
    existing.status !== "awaiting_payment" &&
    existing.status !== "awaiting_wire"
  ) {
    return {
      ok: false,
      error: "Address can only be changed before payment is received.",
    };
  }

  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: "Database unavailable." };

  // Merge into the existing customer JSON so name / email / phone /
  // institution / notes are preserved. Only the five address fields
  // come from input.
  const currentCustomer =
    typeof existing.customer === "object" && existing.customer
      ? (existing.customer as Record<string, unknown>)
      : {};
  const nextCustomer = {
    ...currentCustomer,
    ship_address_1: parsed.data.ship_address_1,
    ship_address_2: parsed.data.ship_address_2,
    ship_city: parsed.data.ship_city,
    ship_state: parsed.data.ship_state,
    ship_zip: parsed.data.ship_zip,
  };

  const { data: updated, error: updateErr } = await admin
    .from("orders")
    .update({ customer: nextCustomer })
    .eq("order_id", order_id)
    .in("status", ["awaiting_payment", "awaiting_wire"])
    .select("order_id");
  if (updateErr) return { ok: false, error: `Update failed: ${updateErr.message}` };
  if (!updated || updated.length === 0) {
    return {
      ok: false,
      error: "Order is no longer awaiting payment — address cannot be changed.",
    };
  }
  revalidatePath(`/account/orders/${order_id}`);
  return { ok: true };
}

export async function cancelOrderByCustomer(
  order_id: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!isValidUuid(order_id)) return { ok: false, error: "Invalid order id." };

  const cookieScoped = await createServerSupabase();
  const { data: existing, error: readErr } = await cookieScoped
    .from("orders")
    .select("order_id, status, nowpayments_invoice_url, payment_method")
    .eq("order_id", order_id)
    .maybeSingle();
  if (readErr || !existing) return { ok: false, error: "Order not found." };
  if (
    existing.status !== "awaiting_payment" &&
    existing.status !== "awaiting_wire"
  ) {
    return {
      ok: false,
      error: "Order can only be cancelled before payment is received.",
    };
  }

  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: "Database unavailable." };

  // Cancel the order AND clear the NOWPayments invoice URL in the
  // same UPDATE so the customer doesn't accidentally pay through a
  // stale link after cancelling. Conditional on still-awaiting status
  // (TOCTOU guard).
  const { data: updated, error: updateErr } = await admin
    .from("orders")
    .update({ status: "cancelled", nowpayments_invoice_url: null })
    .eq("order_id", order_id)
    .in("status", ["awaiting_payment", "awaiting_wire"])
    .select("order_id");
  if (updateErr) return { ok: false, error: `Cancel failed: ${updateErr.message}` };
  if (!updated || updated.length === 0) {
    return { ok: false, error: "Order is no longer cancellable." };
  }

  // Release any coupon redemption tied to this order. Without this,
  // a customer who cancels would permanently consume their
  // single-use coupon slot.
  try {
    await admin
      .from("coupon_redemptions")
      .delete()
      .eq("order_id", order_id);
  } catch (err) {
    console.error("[cancelOrderByCustomer] coupon redemption cleanup failed:", err);
  }

  // Heads-up for crypto orders — the NOWPayments hosted link is
  // technically still live on their side until it expires. Customer
  // shouldn't pay it (we cleared the URL from our DB and the IPN
  // handler will refuse to fund a cancelled order anyway, leaving
  // their funds in NP escrow). Surface this in the email confirmation
  // when we ship one; for v1, just log.
  if (existing.payment_method === "crypto" && existing.nowpayments_invoice_url) {
    console.warn(
      `[cancelOrderByCustomer] crypto order ${order_id} cancelled — customer should NOT use the prior NOWPayments link.`,
    );
  }

  revalidatePath(`/account/orders/${order_id}`);
  return { ok: true };
}

// ---------- Marketing opt-out ----------

export async function unsubscribeFromMarketing(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const cookieScoped = await createServerSupabase();
  const {
    data: { user },
  } = await cookieScoped.auth.getUser();
  if (!user?.email) {
    return { ok: false, error: "You must be signed in to unsubscribe." };
  }
  const res = await unsubscribeMarketingEmail(user.email);
  if (!res.ok) return res;
  revalidatePath("/account/security");
  return { ok: true };
}

export async function getMyMarketingState(): Promise<{ subscribed: boolean }> {
  const cookieScoped = await createServerSupabase();
  const {
    data: { user },
  } = await cookieScoped.auth.getUser();
  if (!user?.email) return { subscribed: false };
  return { subscribed: await isMarketingSubscribed(user.email) };
}
