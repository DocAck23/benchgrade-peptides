import type { OrderStatus } from "@/lib/orders/status";
import { cn } from "@/lib/utils";

/**
 * Status pill for customer-facing order surfaces.
 *
 * Visual language is intentionally distinct from the admin dashboard so
 * customers see a calm, RUO-compliant tone. Variants mapped to spec §16.4:
 *   - Awaiting payment → paper-soft bg, ink-soft text, gold-dark border
 *   - Payment received → gold bg, ink text
 *   - Shipped          → wine bg, paper text
 *   - Cancelled/refund → paper bg, ink-muted, gold-dark border
 *
 * Inter font, uppercase tracked 0.08em, 11px, rounded-sm — matches the
 * subdued editorial chrome rather than the flashier admin pill set.
 */

interface PillVariant {
  label: string;
  className: string;
}

function variantFor(status: OrderStatus): PillVariant {
  switch (status) {
    case "awaiting_payment":
    case "awaiting_wire":
      return {
        label: "Awaiting payment",
        className: "bg-paper-soft text-ink-soft border border-gold-dark",
      };
    case "funded":
      return {
        label: "Payment received",
        className: "bg-gold text-ink border border-gold",
      };
    case "shipped":
      return {
        label: "Shipped",
        className: "bg-wine text-paper border border-wine",
      };
    case "cancelled":
      return {
        label: "Cancelled",
        className: "bg-paper text-ink-muted border border-gold-dark",
      };
    case "refunded":
      return {
        label: "Refunded",
        className: "bg-paper text-ink-muted border border-gold-dark",
      };
  }
}

export interface OrderStatusPillProps {
  status: OrderStatus;
}

export function OrderStatusPill({ status }: OrderStatusPillProps) {
  const v = variantFor(status);
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-1 rounded-sm uppercase",
        "text-[11px] tracking-[0.08em] font-medium",
        v.className
      )}
      data-status={status}
    >
      {v.label}
    </span>
  );
}
