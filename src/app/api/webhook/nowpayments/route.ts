import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import {
  verifyIpnSignature,
  mapPaymentStatusToOrderStatus,
} from "@/lib/payments/nowpayments/webhook";
import type { OrderStatus } from "@/lib/orders/status";
import type { OrderRow } from "@/lib/supabase/types";
import {
  sendPaymentConfirmed,
  sendAgerecodeFulfillment,
  sendOrderRefunded,
} from "@/lib/email/notifications/send-order-emails";
import {
  awardCommissionForOrder,
  clawbackCommissionForOrder,
} from "@/app/actions/affiliate";
import { awardPointsForFundedOrder, reversePointsForOrder } from "@/lib/rewards/order-hooks";

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
  /**
   * NOWPayments invoice id this payment was made against. Present on
   * IPNs that originated from a hosted invoice (the only kind we
   * create). We bind to it on the FIRST funded transition so a forged
   * IPN with a coincidentally-matching `order_id` can't fund the order
   * just because the amount happens to match.
   */
  invoice_id?: number | string;
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
    .select("status, payment_method, subtotal_cents, total_cents, nowpayments_payment_id, nowpayments_invoice_id")
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

  // Payment-identity binding. Two layers, in priority order:
  //
  //   1. invoice_id. We created a hosted invoice at order submit and
  //      stored its id on the row. Every IPN that targets a hosted-
  //      invoice payment carries `invoice_id` — if it's present and
  //      doesn't match the stored value, it CANNOT be a payment for
  //      this order, no matter what `order_id` says. Refuse hard.
  //
  //   2. payment_id. The first IPN we accept for an order stamps the
  //      payment_id on the row. Every subsequent IPN MUST carry the
  //      same payment_id. This guards against a second forged IPN
  //      replayed against the same order with a different payment.
  //
  // Together these mean: even with a valid signature and a matching
  // amount, a wrong invoice_id OR a wrong payment_id is rejected.
  const incomingInvoiceId =
    typeof parsed.invoice_id !== "undefined" ? String(parsed.invoice_id) : null;
  const storedInvoiceId =
    typeof existing.nowpayments_invoice_id === "string"
      ? existing.nowpayments_invoice_id
      : null;
  if (incomingInvoiceId && storedInvoiceId && incomingInvoiceId !== storedInvoiceId) {
    console.error(
      `[nowpayments webhook] invoice_id mismatch order=${orderId} stored=${storedInvoiceId} got=${incomingInvoiceId}`,
    );
    return NextResponse.json(
      { ok: false, error: "IPN invoice_id does not match the bound invoice for this order." },
      { status: 409 },
    );
  }
  // For the funded transition we additionally REQUIRE that an
  // invoice_id was supplied AND matches our stored one. Without this,
  // a payment that NP routed without an invoice (e.g. a replay of a
  // legacy direct-payment IPN) could fund through.
  if (target === "funded" && storedInvoiceId && incomingInvoiceId !== storedInvoiceId) {
    return NextResponse.json(
      { ok: false, error: "Funded IPN missing or mismatched invoice_id binding." },
      { status: 409 },
    );
  }
  const incomingPaymentId =
    typeof parsed.payment_id !== "undefined" ? String(parsed.payment_id) : null;
  const storedPaymentId =
    typeof existing.nowpayments_payment_id === "string"
      ? existing.nowpayments_payment_id
      : null;
  if (incomingPaymentId && storedPaymentId && incomingPaymentId !== storedPaymentId) {
    console.error(
      `[nowpayments webhook] payment_id mismatch order=${orderId} stored=${storedPaymentId} got=${incomingPaymentId}`,
    );
    return NextResponse.json(
      { ok: false, error: "IPN payment_id does not match the bound payment for this order." },
      { status: 409 },
    );
  }

  // Codex P1 #1 — partial-payment guard. NOWPayments can mark `finished`
  // on under-payment (e.g. customer sent 0.9 BTC instead of 1.0). Refuse
  // to fund unless `actually_paid` covers the full `price_amount`.
  // Codex P1 #2 (partial mitigation) — we don't yet store the NOWPayments
  // `payment_id` at order creation, so we can't bind by invoice. As a
  // best-effort cross-check, require `price_amount` to match the order's
  // expected total. A forged-but-signed IPN replayed onto a different
  // order with a different amount will fail this assertion.
  if (target === "funded") {
    const expectedDollars =
      ((typeof existing.total_cents === "number" ? existing.total_cents : existing.subtotal_cents) ?? 0) / 100;
    const priceAmount = typeof parsed.price_amount === "number" ? parsed.price_amount : null;
    const actuallyPaid = typeof parsed.actually_paid === "number" ? parsed.actually_paid : null;
    if (priceAmount === null || actuallyPaid === null) {
      return NextResponse.json(
        { ok: false, error: "IPN missing price_amount or actually_paid for funded transition." },
        { status: 400 }
      );
    }
    // 1¢ tolerance for FX/precision. Crypto rates are quoted in fiat by NP.
    if (Math.abs(priceAmount - expectedDollars) > 0.01) {
      console.error(
        `[nowpayments webhook] price_amount mismatch order=${orderId} expected=${expectedDollars} got=${priceAmount}`
      );
      return NextResponse.json(
        { ok: false, error: "IPN price_amount does not match order total." },
        { status: 409 }
      );
    }
    if (actuallyPaid + 0.01 < priceAmount) {
      console.error(
        `[nowpayments webhook] under-payment order=${orderId} expected=${priceAmount} got=${actuallyPaid}`
      );
      return NextResponse.json(
        { ok: false, error: "Under-payment; order remains awaiting_payment." },
        { status: 409 }
      );
    }
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
  // Stamp funded_at on the funded transition so the customer-portal
  // timeline gets a discrete timestamp instead of inferring from
  // updated_at (which drifts on every later mutation).
  const updatePayload: Record<string, unknown> = { status: target };
  if (target === "funded") {
    updatePayload.funded_at = new Date().toISOString();
  }
  // Bind the NOWPayments payment_id to the order on the first IPN that
  // carries one. Subsequent IPNs for the same order MUST carry the
  // same payment_id; mismatch is rejected up-stream in the verification
  // section.
  if (typeof parsed.payment_id !== "undefined") {
    updatePayload.nowpayments_payment_id = String(parsed.payment_id);
  }
  const { data: updated, error: updateError } = await supa
    .from("orders")
    .update(updatePayload)
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
    // Fulfillment handoff to AgeRecode. Best-effort — a downstream
    // failure here MUST NOT roll back the funded transition.
    try {
      await sendAgerecodeFulfillment(updated[0] as OrderRow);
    } catch (err) {
      console.error("[nowpayments webhook] sendAgerecodeFulfillment failed:", err);
    }
    // Best-effort affiliate commission ledger hook. Like the email above,
    // a downstream failure here MUST NOT roll back the funded transition.
    try {
      await awardCommissionForOrder(orderId);
    } catch (err) {
      console.error("[nowpayments webhook] awardCommissionForOrder failed:", err);
    }
    // Best-effort: rewards earnings (own-spend + optional referrer
    // earnings). Idempotent — the helper checks for prior ledger rows.
    try {
      const row = updated[0] as OrderRow & { referrer_user_id?: string | null };
      await awardPointsForFundedOrder({
        order_id: row.order_id,
        customer_user_id: row.customer_user_id ?? null,
        referrer_user_id: row.referrer_user_id ?? null,
        total_cents: row.total_cents ?? null,
        subtotal_cents: row.subtotal_cents,
      });
    } catch (err) {
      console.error("[nowpayments webhook] awardPointsForFundedOrder failed:", err);
    }
  }
  // Codex review #3 H6: refund clawback. If the IPN flipped the order to
  // `refunded`, reverse any commission already earned and cancel
  // unredeemed referral entitlements pinned to this order. Best-effort.
  if (applied && target === "refunded") {
    if (updated && updated[0]) {
      try {
        await sendOrderRefunded(updated[0] as OrderRow);
      } catch (err) {
        console.error(
          "[nowpayments webhook] sendOrderRefunded failed:",
          err,
        );
      }
    }
    try {
      await clawbackCommissionForOrder(orderId);
    } catch (err) {
      console.error(
        "[nowpayments webhook] clawbackCommissionForOrder failed:",
        err
      );
    }
    // Best-effort: reverse rewards points credited at funded time.
    try {
      await reversePointsForOrder(orderId);
    } catch (err) {
      console.error(
        "[nowpayments webhook] reversePointsForOrder failed:",
        err,
      );
    }
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
