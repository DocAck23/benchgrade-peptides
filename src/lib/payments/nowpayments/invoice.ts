import { SITE_URL } from "@/lib/site";

/**
 * NOWPayments invoice creation.
 *
 * Calls `POST https://api.nowpayments.io/v1/invoice` to mint a hosted
 * payment URL the customer follows to send crypto. The hosted page lets
 * them pick the pay currency (BTC / ETH / USDT / USDC / LTC / 40+
 * tokens) and shows a deposit address + QR. Settlement currency is USDC
 * configured in the NOWPayments dashboard.
 *
 * Response shape (NOWPayments docs):
 *   {
 *     id: "5077125051",
 *     order_id: "<our order_id>",
 *     order_description: "...",
 *     price_amount: 119.99,
 *     price_currency: "usd",
 *     pay_currency: null,
 *     ipn_callback_url: "...",
 *     invoice_url: "https://nowpayments.io/payment/?iid=5077125051",
 *     success_url: "...",
 *     cancel_url: "...",
 *     created_at: "...",
 *     updated_at: "..."
 *   }
 *
 * Failures are returned as `{ ok: false, reason }` rather than thrown so
 * the caller can degrade gracefully — a customer who didn't get an
 * invoice link can still pay via the email follow-up or by emailing
 * support; we never want a transient NP outage to block order
 * submission.
 */

export interface NowpaymentsInvoiceResult {
  ok: true;
  invoice_id: string;
  invoice_url: string;
}

export interface NowpaymentsInvoiceError {
  ok: false;
  reason: string;
}

export interface CreateInvoiceArgs {
  order_id: string;
  order_description: string;
  /** Customer-owed amount in dollars (NOT cents). Server-computed total. */
  amount_usd: number;
}

const NOWPAYMENTS_BASE = "https://api.nowpayments.io/v1";

export async function createNowpaymentsInvoice(
  args: CreateInvoiceArgs,
): Promise<NowpaymentsInvoiceResult | NowpaymentsInvoiceError> {
  const apiKey = process.env.NOWPAYMENTS_API_KEY;
  if (!apiKey) {
    return { ok: false, reason: "NOWPAYMENTS_API_KEY not configured" };
  }
  if (!Number.isFinite(args.amount_usd) || args.amount_usd <= 0) {
    return { ok: false, reason: "Invalid amount" };
  }

  const body = {
    price_amount: Math.round(args.amount_usd * 100) / 100,
    price_currency: "usd",
    order_id: args.order_id,
    order_description: args.order_description,
    ipn_callback_url: `${SITE_URL}/api/webhook/nowpayments`,
    success_url: `${SITE_URL}/checkout/success?id=${encodeURIComponent(args.order_id)}`,
    cancel_url: `${SITE_URL}/account/orders/${encodeURIComponent(args.order_id)}`,
  };

  let res: Response;
  try {
    res = await fetch(`${NOWPAYMENTS_BASE}/invoice`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      // 10-second timeout via AbortSignal so we don't stall the order
      // submission on a slow NP API. Caller is best-effort anyway.
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "Network error calling NOWPayments",
    };
  }

  if (!res.ok) {
    let detail = "";
    try {
      detail = await res.text();
    } catch {
      /* ignore */
    }
    return {
      ok: false,
      reason: `NOWPayments invoice creation failed (${res.status}): ${detail.slice(0, 200)}`,
    };
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return { ok: false, reason: "Invalid JSON from NOWPayments invoice endpoint" };
  }
  if (!data || typeof data !== "object") {
    return { ok: false, reason: "Unexpected response shape from NOWPayments" };
  }
  const obj = data as Record<string, unknown>;
  const id = typeof obj.id === "string"
    ? obj.id
    : typeof obj.id === "number"
      ? String(obj.id)
      : null;
  const url = typeof obj.invoice_url === "string" ? obj.invoice_url : null;
  if (!id || !url || !url.startsWith("https://")) {
    return { ok: false, reason: "Missing invoice id or url in NOWPayments response" };
  }
  return { ok: true, invoice_id: id, invoice_url: url };
}
