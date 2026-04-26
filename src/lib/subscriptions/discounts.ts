export type PaymentCadence = "prepay" | "bill_pay";
export type ShipCadence = "monthly" | "quarterly" | "once";
export type PlanDuration = 1 | 3 | 6 | 9 | 12;

export interface SubscriptionPlanInput {
  duration_months: PlanDuration;
  payment_cadence: PaymentCadence;
  ship_cadence: ShipCadence;
}

export interface SubscriptionTotals {
  discount_percent: number;
  cycle_subtotal_cents: number;
  cycle_discount_cents: number;
  cycle_total_cents: number;
  plan_total_cents: number;
  savings_vs_retail_cents: number;
}

const PREPAY_TABLE: Record<PlanDuration, number> = {
  1: 5,
  3: 18,
  6: 25,
  9: 30,
  12: 35,
};

const BILL_PAY_TABLE: Record<PlanDuration, number> = {
  1: 0, // invalid — no 1-month bill-pay
  3: 10,
  6: 15,
  9: 18,
  12: 20,
};

const SHIP_ONCE_BONUS = 3;

/**
 * Returns the discount % off retail for a subscription plan.
 * Returns 0 for invalid combinations (e.g., bill_pay + 1mo, or bill_pay + ship_once).
 */
export function subscriptionDiscountPercent(plan: SubscriptionPlanInput): number {
  const { duration_months, payment_cadence, ship_cadence } = plan;

  if (payment_cadence === "bill_pay") {
    // Invalid combos for bill-pay: 1-month, or ship-once.
    if (duration_months === 1) return 0;
    if (ship_cadence === "once") return 0;
    return BILL_PAY_TABLE[duration_months] ?? 0;
  }

  // prepay
  const base = PREPAY_TABLE[duration_months] ?? 0;
  if (base === 0) return 0;
  return ship_cadence === "once" ? base + SHIP_ONCE_BONUS : base;
}

/**
 * Computes per-cycle and total subscription pricing. Integer-cents math throughout.
 */
export function computeSubscriptionTotals(
  subtotal_cents: number,
  plan: SubscriptionPlanInput,
): SubscriptionTotals {
  const discount_percent = subscriptionDiscountPercent(plan);
  const cycle_subtotal_cents = subtotal_cents;
  const cycle_discount_cents = Math.round((subtotal_cents * discount_percent) / 100);
  const cycle_total_cents = cycle_subtotal_cents - cycle_discount_cents;
  const plan_total_cents = cycle_total_cents * plan.duration_months;
  const savings_vs_retail_cents =
    cycle_subtotal_cents * plan.duration_months - plan_total_cents;

  return {
    discount_percent,
    cycle_subtotal_cents,
    cycle_discount_cents,
    cycle_total_cents,
    plan_total_cents,
    savings_vs_retail_cents,
  };
}
