import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import {
  verifyIpnSignature,
  mapPaymentStatusToOrderStatus,
} from "@/lib/payments/nowpayments/webhook";

/**
 * NOWPayments IPN (webhook) endpoint.
 *
 * URL: POST /api/webhook/nowpayments
 * Headers: x-nowpayments-sig (HMAC-SHA512 hex over canonicalized body)
 *
 * Flow:
 *   1. Read raw body + signature header.
 *   2. If NOWPAYMENTS_IPN_SECRET missing → 503 (dormant until env lands).
 *   3. Parse body, verify HMAC against the IPN secret. Reject 401 on any
 *      mismatch.
 *   4. Map NOWPayments `payment_status` → our order status.
 *   5. If the map returns a transition and the payment has an order_id
 *      (via NOWPayments `order_id` field we set at invoice creation),
 *      update orders.status in Supabase.
 *   6. Return 200 with `{ ok, applied, to }` for observability.
 *
 * Idempotency: the handler is idempotent in practice because status
 * transitions are set-to-constant ("funded", "cancelled", "refunded"),
 * and NOWPayments retries are bounded. We additionally refuse to
 * downgrade a shipped/funded order back to pending.
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

export async function POST(req: Request) {
  const secret = process.env.NOWPAYMENTS_IPN_SECRET;
  if (!secret) {
    // Dormant path — crypto still disabled. Return a 503 so NOWPayments
    // retries later (in case the env lands before the dashboard notices),
    // but don't 200 to avoid marking the IPN as "delivered" prematurely.
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
    // Interim state (waiting/confirming). Nothing to do.
    return NextResponse.json({ ok: true, applied: false, payment_status: paymentStatus });
  }

  const supa = getSupabaseServer();
  if (!supa) {
    return NextResponse.json(
      { ok: false, error: "Database unavailable." },
      { status: 503 }
    );
  }

  // Defensive: don't downgrade a shipped or cancelled/refunded order
  // back to funded just because a delayed IPN arrived.
  const { data: existing, error: selectError } = await supa
    .from("orders")
    .select("status")
    .eq("order_id", orderId)
    .maybeSingle();
  if (selectError) {
    return NextResponse.json(
      { ok: false, error: `Lookup failed: ${selectError.message}` },
      { status: 500 }
    );
  }
  if (!existing) {
    return NextResponse.json(
      { ok: false, error: "Unknown order_id." },
      { status: 404 }
    );
  }

  const TERMINAL: string[] = ["shipped", "cancelled", "refunded"];
  if (TERMINAL.includes(existing.status)) {
    return NextResponse.json({
      ok: true,
      applied: false,
      reason: `Order already ${existing.status}; no transition.`,
    });
  }

  const { error: updateError } = await supa
    .from("orders")
    .update({ status: target })
    .eq("order_id", orderId);
  if (updateError) {
    return NextResponse.json(
      { ok: false, error: `Update failed: ${updateError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, applied: true, to: target });
}
