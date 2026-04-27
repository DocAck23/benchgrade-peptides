import type { OrderRow, SubscriptionRow } from "@/lib/supabase/types";
import type { CartItem } from "@/lib/cart/types";
import type { OrderStatus } from "@/lib/orders/status";

/**
 * Pure builder for a subscription-cycle order row. Extracted from
 * `adminFireNextCycle` so we can unit-test the invariants without a
 * live database:
 *
 *   - `payment_method` MUST be `null`. The DB CHECK constraint allows
 *     only the four customer-facing methods (wire/ach/zelle/crypto)
 *     or null. Cycle orders don't have a customer-driven payment
 *     method — the funding context is the linked subscription, not a
 *     one-shot payment selection. Setting any other value here will
 *     fail insertion at the CHECK constraint.
 *
 *   - `customer` MUST be copied from the subscription's first order
 *     (the order that originally created the subscription) so the
 *     ship-to and email don't render as blank in admin / fulfillment.
 *
 *   - `status` is `funded` for prepay (the customer paid up-front for
 *     N cycles) and `awaiting_payment` for bill_pay (each cycle bills
 *     separately).
 */
export interface CycleOrderInputs {
  order_id: string;
  subscription: SubscriptionRow;
  /**
   * Customer JSON copied from the parent (first) order in the
   * subscription. Required — never accept blank/synthetic customer
   * data on a row that fulfillment will read.
   */
  parent_customer: OrderRow["customer"];
  cycle_subtotal_cents: number;
  cycle_total_cents: number;
  now: Date;
}

export interface CycleOrderRow {
  order_id: string;
  customer: OrderRow["customer"];
  items: CartItem[];
  subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
  payment_method: null;
  status: OrderStatus;
  subscription_id: string;
  customer_user_id: string;
  created_at: string;
  acknowledgment: {
    certification_text: string;
    certification_version: string;
    certification_hash: string;
    is_adult: boolean;
    is_researcher: boolean;
    accepts_ruo: boolean;
    acknowledged_at: string;
    ip: string;
    user_agent: string;
  };
}

export function buildCycleOrderRow(input: CycleOrderInputs): CycleOrderRow {
  const acknowledged_at = input.now.toISOString();
  const status: OrderStatus =
    input.subscription.payment_cadence === "prepay"
      ? "funded"
      : "awaiting_payment";
  return {
    order_id: input.order_id,
    customer: input.parent_customer,
    items: input.subscription.items as CartItem[],
    subtotal_cents: input.cycle_subtotal_cents,
    discount_cents: input.cycle_subtotal_cents - input.cycle_total_cents,
    total_cents: input.cycle_total_cents,
    // Cycle orders are not customer-method driven; the funding context
    // is the linked subscription. NULL satisfies the DB CHECK constraint
    // that allows only `wire|ach|zelle|crypto` or null.
    payment_method: null,
    status,
    subscription_id: input.subscription.id,
    customer_user_id: input.subscription.customer_user_id,
    created_at: acknowledged_at,
    // Stamped from the original RUO acknowledgment by reference — every
    // cycle is governed by the consent the customer gave at sub-setup.
    acknowledgment: {
      certification_text: "subscription-cycle",
      certification_version: "n/a",
      certification_hash: "n/a",
      is_adult: true,
      is_researcher: true,
      accepts_ruo: true,
      acknowledged_at,
      ip: "subscription",
      user_agent: "subscription-cycle",
    },
  };
}
