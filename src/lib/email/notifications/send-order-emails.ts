/**
 * Transactional order-lifecycle email dispatchers.
 *
 * Wraps the editorial templates (Wave 1a) so callers in the webhook
 * and admin server actions can fire-and-forget without re-deriving
 * the template context. Every helper is best-effort: a failure to
 * send must NEVER bubble up and roll back a status transition that
 * already landed in Postgres. Callers may inspect the returned
 * `{ ok, reason? }` for telemetry but should not branch on it for
 * the canonical operation result.
 */

import {
  getResend,
  EMAIL_FROM,
} from "@/lib/email/client";
import {
  paymentConfirmedEmail,
  orderShippedEmail,
  accountClaimEmail,
  agerecodeFulfillmentEmail,
  type ShippedContext,
} from "@/lib/email/templates";
import type { OrderRow } from "@/lib/supabase/types";
import type { CartItem } from "@/lib/cart/types";
import type { CustomerInfo } from "@/app/actions/orders";
import type { PaymentMethod } from "@/lib/payments/methods";

export interface SendResult {
  ok: boolean;
  reason?: string;
}

/**
 * Adapt the persisted order row into the shape the editorial
 * templates expect. The OrderRow TS type intentionally omits a few
 * fields that exist at runtime (e.g. `pack_size` on items, optional
 * `payment_method`); we coerce here so templates type-check cleanly.
 */
function rowCustomer(row: OrderRow): CustomerInfo {
  return {
    name: row.customer.name,
    email: row.customer.email,
    institution: row.customer.institution ?? "",
    phone: row.customer.phone ?? "",
    ship_address_1: row.customer.ship_address_1,
    ship_address_2: row.customer.ship_address_2,
    ship_city: row.customer.ship_city,
    ship_state: row.customer.ship_state,
    ship_zip: row.customer.ship_zip,
    notes: row.customer.notes,
  };
}

function rowItems(row: OrderRow): CartItem[] {
  // Persisted rows include pack_size at runtime; the trimmed OrderRow
  // type omits it. Cast through unknown to satisfy TS without losing
  // the actual shape submitOrder writes.
  return row.items as unknown as CartItem[];
}

function rowToOrderContext(row: OrderRow) {
  // Lifecycle templates (paymentConfirmedEmail / orderShippedEmail /
  // accountClaimEmail) don't read payment_method, but OrderContext
  // requires it. Default to "wire" — never appears in the rendered
  // copy for these templates.
  const payment_method: PaymentMethod = "wire";
  return {
    order_id: row.order_id,
    customer: rowCustomer(row),
    items: rowItems(row),
    subtotal_cents: row.subtotal_cents,
    total_cents: row.total_cents,
    payment_method,
  };
}

function trackingUrlFor(carrier: NonNullable<OrderRow["tracking_carrier"]>, num: string): string {
  switch (carrier) {
    case "USPS":
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(num)}`;
    case "UPS":
      return `https://www.ups.com/track?tracknum=${encodeURIComponent(num)}`;
    case "FedEx":
      return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(num)}`;
    case "DHL":
      return `https://www.dhl.com/en/express/tracking.html?AWB=${encodeURIComponent(num)}`;
  }
}

export async function sendPaymentConfirmed(row: OrderRow): Promise<SendResult> {
  const resend = getResend();
  if (!resend) {
    console.error("[sendPaymentConfirmed] Resend not configured; skipping email for", row.order_id);
    return { ok: false, reason: "resend-unconfigured" };
  }
  const e = paymentConfirmedEmail(rowToOrderContext(row));
  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: row.customer.email,
      subject: e.subject,
      text: e.text,
      html: e.html,
    });
    return { ok: true };
  } catch (err) {
    console.error("[sendPaymentConfirmed] failed:", err);
    return { ok: false };
  }
}

export async function sendOrderShipped(
  row: OrderRow,
  coaLotUrls: ShippedContext["coa_lot_urls"]
): Promise<SendResult> {
  const resend = getResend();
  if (!resend) {
    console.error("[sendOrderShipped] Resend not configured; skipping email for", row.order_id);
    return { ok: false, reason: "resend-unconfigured" };
  }
  if (!row.tracking_number || !row.tracking_carrier) {
    console.error("[sendOrderShipped] missing tracking metadata on row", row.order_id);
    return { ok: false, reason: "missing-tracking" };
  }
  const ctx: ShippedContext = {
    ...rowToOrderContext(row),
    tracking_number: row.tracking_number,
    tracking_carrier: row.tracking_carrier,
    tracking_url: trackingUrlFor(row.tracking_carrier, row.tracking_number),
    coa_lot_urls: coaLotUrls,
  };
  const e = orderShippedEmail(ctx);
  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: row.customer.email,
      subject: e.subject,
      text: e.text,
      html: e.html,
    });
    return { ok: true };
  } catch (err) {
    console.error("[sendOrderShipped] failed:", err);
    return { ok: false };
  }
}

export async function sendAccountClaim(
  row: OrderRow,
  magicLinkUrl: string
): Promise<SendResult> {
  const resend = getResend();
  if (!resend) {
    console.error("[sendAccountClaim] Resend not configured; skipping email for", row.order_id);
    return { ok: false, reason: "resend-unconfigured" };
  }
  const e = accountClaimEmail({
    ...rowToOrderContext(row),
    magic_link_url: magicLinkUrl,
  });
  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: row.customer.email,
      subject: e.subject,
      text: e.text,
      html: e.html,
    });
    return { ok: true };
  } catch (err) {
    console.error("[sendAccountClaim] failed:", err);
    return { ok: false };
  }
}

/**
 * Fulfillment handoff to AgeRecode. Fired on the `awaiting_payment` →
 * `funded` transition (admin click for wire/ACH/Zelle, NOWPayments IPN
 * for crypto). Routed to AGERECODE_ORDER_EMAIL with the customer email
 * BCC'd never — the partner should see ship-to + SKUs only, not who
 * the buyer is, and the buyer should not see the partner email at all.
 *
 * Like every order-email helper, this is best-effort: a failure here
 * MUST NOT roll back the funded transition that already landed in
 * Postgres. Caller should `try/catch` and continue.
 */
export async function sendAgerecodeFulfillment(row: OrderRow): Promise<SendResult> {
  const to = process.env.AGERECODE_ORDER_EMAIL;
  if (!to) {
    console.error(
      "[sendAgerecodeFulfillment] AGERECODE_ORDER_EMAIL not set; skipping for",
      row.order_id
    );
    return { ok: false, reason: "agerecode-email-unconfigured" };
  }
  const resend = getResend();
  if (!resend) {
    console.error(
      "[sendAgerecodeFulfillment] Resend not configured; skipping for",
      row.order_id
    );
    return { ok: false, reason: "resend-unconfigured" };
  }
  const e = agerecodeFulfillmentEmail(rowToOrderContext(row));
  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to,
      cc: process.env.AGERECODE_CC_EMAIL ? [process.env.AGERECODE_CC_EMAIL] : undefined,
      subject: e.subject,
      text: e.text,
      html: e.html,
      replyTo: process.env.ADMIN_NOTIFICATION_EMAIL,
    });
    return { ok: true };
  } catch (err) {
    console.error("[sendAgerecodeFulfillment] failed:", err);
    return { ok: false };
  }
}

/**
 * Stub: COA URL lookup. Wave 1a doesn't ship a COA storage backend,
 * so we return an empty array — the shipped-email template falls back
 * to "COA available in your portal". When the COA backend lands,
 * replace this with the real lookup.
 */
export function lookupCoaUrls(_items: OrderRow["items"]): ShippedContext["coa_lot_urls"] {
  return [];
}
