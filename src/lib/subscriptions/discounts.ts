export type PaymentCadence = "prepay" | "bill_pay";
/**
 * `ship_cadence` is now a derived semantic, not a customer choice:
 *   prepay   → "once"     (one bulk shipment of N× cart contents)
 *   bill_pay → "monthly"  (one box per paid cycle)
 * The type stays "monthly | quarterly | once" for backward-compat with
 * any in-flight cart state stored in localStorage; only "once" and
 * "monthly" are produced by current code paths.
 */
export type ShipCadence = "monthly" | "quarterly" | "once";
export type PlanDuration = 3 | 6 | 12;

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
  3: 18,
  6: 25,
  12: 35,
};

const BILL_PAY_TABLE: Record<PlanDuration, number> = {
  3: 10,
  6: 15,
  12: 20,
};

/**
 * Returns the discount % off retail for a subscription plan.
 * Returns 0 for invalid combinations (e.g. unknown duration or
 * legacy combo from stored localStorage state).
 */
export function subscriptionDiscountPercent(plan: SubscriptionPlanInput): number {
  const { duration_months, payment_cadence } = plan;
  if (payment_cadence === "bill_pay") {
    return BILL_PAY_TABLE[duration_months] ?? 0;
  }
  return PREPAY_TABLE[duration_months] ?? 0;
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
