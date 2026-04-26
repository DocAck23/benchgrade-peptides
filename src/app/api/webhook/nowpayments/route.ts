import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import {
  verifyIpnSignature,
  mapPaymentStatusToOrderStatus,
} from "@/lib/payments/nowpayments/webhook";
import type { OrderStatus } from "@/lib/orders/status";
import type { OrderRow } from "@/lib/supabase/types";
import { sendPaymentConfirmed } from "@/lib/email/notifications/send-order-emails";

/**
 * NOWPayments IPN (webhook) endpoint.
 *
 * URL: POST /api/webhook/nowpayments
 * Headers: x-nowpayments-sig (HMAC-SHA512 hex over canonicalized body)
 *
 * Flow:
 *   1. 503 if NOWPAYMENTS_IPN_SECRET env is missing (still dormant).
 *   2. Parse + signature-verify; reject 401 on any mismatch.
 *   3. Require body's order_id AND that the order in our DB is a
 *      `crypto`-method order (refuse to touch Zelle/Wire/ACH orders).
 *   4. Map NOWPayments payment_status -> our OrderStatus.
 *   5. Apply the transition atomically: UPDATE ... WHERE status IN
 *      (allowed source states) so a delayed/retried IPN can't
 *      downgrade a shipped or refunded order, and concurrent IPNs
 *      can't race past a terminal state.
 *   6. 200 on success with { ok, applied, to } for observability.
 */

export const dynamic = "force-dynamic";

interface NowpaymentsIpnBody {
  payment_id?: number | string;
  payment_status?: string;
  order_id?: string;
  actually_paid?: number;
  pay_currency?: string;
  price_amount?: number;
  price_currency?: string;
}

/**
 * Legal source states for each IPN-driven target. Anything not listed
 * is refused (the UPDATE no-ops). Crucially `funded` is NOT a valid
 * source for `cancelled`: once we've confirmed a payment, only an
 * explicit refund workflow (admin action) can change it.
 */
const ALLOWED_SOURCES: Record<OrderStatus, OrderStatus[]> = {
  funded: ["awaiting_payment", "awaiting_wire"],
  cancelled: ["awaiting_payment", "awaiting_wire"],
  refunded: ["funded"],
  // These targets are never webhook-driven:
  awaiting_payment: [],
  awaiting_wire: [],
  shipped: [],
};

export async function POST(req: Request) {
  const secret = process.env.NOWPAYMENTS_IPN_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "Webhook not configured." },
      { status: 503 }
    );
  }

  const raw = await req.text();
  let parsed: NowpaymentsIpnBody;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const sig = req.headers.get("x-nowpayments-sig") ?? "";
  if (!verifyIpnSignature(parsed, sig, secret)) {
    return NextResponse.json({ ok: false, error: "Invalid signature." }, { status: 401 });
  }

  const paymentStatus = typeof parsed.payment_status === "string" ? parsed.payment_status : null;
  const orderId = typeof parsed.order_id === "string" ? parsed.order_id : null;
  if (!paymentStatus || !orderId) {
    return NextResponse.json(
      { ok: false, error: "Missing payment_status or order_id." },
      { status: 400 }
    );
  }

  const target = mapPaymentStatusToOrderStatus(paymentStatus);
  if (!target) {
    // Interim state (waiting / confirming / sending). No-op.
    return NextResponse.json({ ok: true, applied: false, payment_status: paymentStatus });
  }

  const supa = getSupabaseServer();
  if (!supa) {
    return NextResponse.json(
      { ok: false, error: "Database unavailable." },
      { status: 503 }
    );
  }

  // Bind: only apply an IPN transition to an order that was actually
  // submitted via the crypto method. Prevents a forged-or-replayed IPN
  // (even one with a valid sig) from mutating a Zelle/Wire/ACH order
  // whose UUID happened to match.
  const { data: existing, error: selectError } = await supa
    .from("orders")
    .select("status, payment_method")
    .eq("order_id", orderId)
    .maybeSingle();
  if (selectError) {
    return NextResponse.json(
      { ok: false, error: `Lookup failed: ${selectError.message}` },
      { status: 500 }
    );
  }
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Unknown order_id." }, { status: 404 });
  }
  if (existing.payment_method !== "crypto") {
    return NextResponse.json(
      {
        ok: false,
        error: "Order was not a crypto order; IPN refused.",
      },
      { status: 409 }
    );
  }

  // Atomic conditional update: only succeeds if current.status is in
  // the legal source-states for the target. Stops delayed/retried IPNs
  // from pushing us backwards or re-triggering a terminal transition.
  const allowedSources = ALLOWED_SOURCES[target];
  if (allowedSources.length === 0) {
    return NextResponse.json(
      { ok: true, applied: false, reason: "IPN target is not a legal webhook transition." }
    );
  }
  const { data: updated, error: updateError } = await supa
    .from("orders")
    .update({ status: target })
    .eq("order_id", orderId)
    .in("status", allowedSources)
    .select("*");
  if (updateError) {
    return NextResponse.json(
      { ok: false, error: `Update failed: ${updateError.message}` },
      { status: 500 }
    );
  }
  const applied = Array.isArray(updated) && updated.length > 0;
  // Best-effort lifecycle email. Only fires on actual transition
  // (rowcount > 0) so duplicate IPN retries don't spam the customer.
  // We await but ignore the result — a Resend outage MUST NOT roll
  // back the funded transition that already landed in Postgres.
  if (applied && target === "funded" && updated && updated[0]) {
    await sendPaymentConfirmed(updated[0] as OrderRow);
  }
  return NextResponse.json({
    ok: true,
    applied,
    to: applied ? target : undefined,
    from: applied ? undefined : existing.status,
    reason: applied
      ? undefined
      : `No-op: status ${existing.status} is not a legal source for ${target}.`,
  });
}
