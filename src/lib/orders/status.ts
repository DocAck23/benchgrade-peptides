export const ORDER_STATUSES = [
  "awaiting_wire",
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
