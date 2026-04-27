import crypto from "node:crypto";

/**
 * Short-lived HMAC token gating /checkout/success against UUID
 * enumeration. Without this the success page would serve order
 * details (customer name, email, items, total) to anyone who knew
 * the order UUID — RLS protects the customer-portal pages but the
 * post-checkout success page is reached pre-auth.
 *
 * Lifetime: 1 hour. Plenty of time to land + read; short enough that
 * a leaked URL goes stale before it can be useful.
 *
 * Secret: a server-only env var. We deliberately don't reuse
 * NOWPAYMENTS_IPN_SECRET or any payment-related key — separate keys
 * for separate purposes. Falls back to SUPABASE_SERVICE_ROLE_KEY in
 * dev so localhost Just Works without yet another env var; in
 * production both are present, and the explicit token secret takes
 * precedence so it can be rotated independently.
 */
const ONE_HOUR_MS = 60 * 60 * 1000;

function tokenSecret(): string {
  return (
    process.env.ORDER_SUCCESS_TOKEN_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ""
  );
}

function sign(orderId: string, expiresAt: number, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(`${orderId}.${expiresAt}`)
    .digest("base64url");
}

/** Returns `<expiresAt>.<base64url-hmac>` to append as `?t=…`. */
export function makeSuccessToken(orderId: string, now: Date = new Date()): string {
  const secret = tokenSecret();
  if (!secret) {
    // No secret = empty token. The verifier returns false on empty
    // tokens, and the success page falls back to its minimal view.
    return "";
  }
  const expiresAt = now.getTime() + ONE_HOUR_MS;
  const sig = sign(orderId, expiresAt, secret);
  return `${expiresAt}.${sig}`;
}

/**
 * Constant-time verify. Returns true iff:
 *   - the token has the `<expiresAt>.<sig>` shape,
 *   - expiresAt is in the future,
 *   - the HMAC matches.
 */
export function verifySuccessToken(
  orderId: string,
  token: string,
  now: Date = new Date(),
): boolean {
  const secret = tokenSecret();
  if (!secret || !token) return false;
  const dot = token.indexOf(".");
  if (dot < 1) return false;
  const expRaw = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expiresAt = Number(expRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < now.getTime()) return false;
  const expected = sign(orderId, expiresAt, secret);
  // timingSafeEqual requires equal-length buffers — bail if not.
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
