import crypto from "node:crypto";
import type { OrderStatus } from "@/lib/orders/status";

/**
 * NOWPayments IPN webhook helpers.
 *
 * Signature scheme per NOWPayments docs: HMAC-SHA512 over the JSON body
 * after sorting keys alphabetically at every level. Headers arrive in
 * `x-nowpayments-sig` and must be verified with the IPN secret
 * (separate from the API key) before any state change is applied.
 *
 * The matching secret is read from `NOWPAYMENTS_IPN_SECRET` at call
 * sites; the helpers below are pure so they're trivially testable.
 */

/** Canonical JSON stringify: sort keys at every level before serialising. */
function canonicalize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([a], [b]) => a.localeCompare(b)
    );
    return `{${entries
      .map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function computeIpnSignature(body: unknown, secret: string): string {
  return crypto
    .createHmac("sha512", secret)
    .update(canonicalize(body))
    .digest("hex");
}

/**
 * Constant-time signature check. Rejects any mismatch — bad signature,
 * wrong secret, tampered body, or forged length. Programmer-bug errors
 * (invalid hex etc.) are swallowed into `false` rather than thrown, so
 * the webhook handler can fail closed and return 401.
 */
export function verifyIpnSignature(
  body: unknown,
  provided: string,
  secret: string
): boolean {
  if (!provided) return false;
  try {
    const expected = computeIpnSignature(body, secret);
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(provided, "utf8");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * NOWPayments payment_status enum (docs):
 *   waiting, confirming, confirmed, sending, partially_paid,
 *   finished, failed, refunded, expired
 *
 * We map to our own order status:
 *   confirmed | finished | partially_paid -> funded
 *   waiting   | confirming | sending       -> null (no change)
 *   failed    | expired                    -> cancelled
 *   refunded                               -> refunded
 *   anything else                          -> null (defensive no-op)
 */
export function mapPaymentStatusToOrderStatus(
  nowpaymentsStatus: string
): OrderStatus | null {
  switch (nowpaymentsStatus) {
    case "confirmed":
    case "finished":
    case "partially_paid":
      return "funded";
    case "waiting":
    case "confirming":
    case "sending":
      return null;
    case "failed":
    case "expired":
      return "cancelled";
    case "refunded":
      return "refunded";
    default:
      return null;
  }
}
