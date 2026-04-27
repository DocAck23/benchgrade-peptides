"use server";

import { getSupabaseServer } from "@/lib/supabase/server";
import { createServerSupabase } from "@/lib/supabase/client";
import { revalidatePath } from "next/cache";
import { isPaymentMethod, enabledPaymentMethods, type PaymentMethod } from "@/lib/payments/methods";
import { isValidUuid } from "@/lib/orders/status";
import { createNowpaymentsInvoice } from "@/lib/payments/nowpayments/invoice";
import { sendCryptoPaymentLink } from "@/lib/email/notifications/send-order-emails";
import type { OrderRow } from "@/lib/supabase/types";

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
  // cookie-scoped read.
  const { error: updateErr } = await admin
    .from("orders")
    .update({ payment_method: next_method })
    .eq("order_id", order_id);
  if (updateErr) {
    return { ok: false, error: `Update failed: ${updateErr.message}` };
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
