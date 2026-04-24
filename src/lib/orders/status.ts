/**
 * Order lifecycle statuses.
 *
 * `awaiting_payment` is the generic inbox state for any payment method
 * (wire, ACH, Zelle, or pending crypto confirmation). The legacy
 * `awaiting_wire` value is still accepted by isValidStatus() so any
 * orders inserted before the 2026-04-24 rename don't fall out of the
 * admin dashboard — they're read-compatible but new orders always get
 * the new label.
 */
export const ORDER_STATUSES = [
  "awaiting_payment",
  "awaiting_wire", // legacy — kept for backward compat; do not assign to new orders
  "funded",
  "shipped",
  "cancelled",
  "refunded",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export function isValidStatus(s: unknown): s is OrderStatus {
  return typeof s === "string" && (ORDER_STATUSES as readonly string[]).includes(s);
}

export function isValidUuid(s: unknown): s is string {
  return (
    typeof s === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
  );
}
