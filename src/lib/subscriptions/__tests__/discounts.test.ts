import { describe, it, expect } from "vitest";
import {
  subscriptionDiscountPercent,
  computeSubscriptionTotals,
} from "../discounts";
import type { SubscriptionPlanInput } from "../discounts";

const prepay = (
  duration_months: 1 | 3 | 6 | 9 | 12,
  ship_cadence: "monthly" | "quarterly" | "once" = "monthly",
): SubscriptionPlanInput => ({
  duration_months,
  payment_cadence: "prepay",
  ship_cadence,
});

const billPay = (
  duration_months: 1 | 3 | 6 | 9 | 12,
  ship_cadence: "monthly" | "quarterly" | "once" = "monthly",
): SubscriptionPlanInput => ({
  duration_months,
  payment_cadence: "bill_pay",
  ship_cadence,
});

describe("subscriptionDiscountPercent", () => {
  // U-SUBPRICE-1: prepay table (monthly/quarterly cadence — no ship-once bonus)
  it("U-SUBPRICE-1: prepay 1 mo → 5%", () => {
    expect(subscriptionDiscountPercent(prepay(1))).toBe(5);
  });
  it("U-SUBPRICE-1: prepay 3 mo → 18%", () => {
    expect(subscriptionDiscountPercent(prepay(3))).toBe(18);
  });
  it("U-SUBPRICE-1: prepay 6 mo → 25%", () => {
    expect(subscriptionDiscountPercent(prepay(6))).toBe(25);
  });
  it("U-SUBPRICE-1: prepay 9 mo → 30%", () => {
    expect(subscriptionDiscountPercent(prepay(9))).toBe(30);
  });
  it("U-SUBPRICE-1: prepay 12 mo → 35%", () => {
    expect(subscriptionDiscountPercent(prepay(12))).toBe(35);
  });
  it("U-SUBPRICE-1: prepay quarterly cadence keeps base discount", () => {
    expect(subscriptionDiscountPercent(prepay(6, "quarterly"))).toBe(25);
  });

  // U-SUBPRICE-2: bill-pay table
  it("U-SUBPRICE-2: bill_pay 3 mo → 10%", () => {
    expect(subscriptionDiscountPercent(billPay(3))).toBe(10);
  });
  it("U-SUBPRICE-2: bill_pay 6 mo → 15%", () => {
    expect(subscriptionDiscountPercent(billPay(6))).toBe(15);
  });
  it("U-SUBPRICE-2: bill_pay 9 mo → 18%", () => {
    expect(subscriptionDiscountPercent(billPay(9))).toBe(18);
  });
  it("U-SUBPRICE-2: bill_pay 12 mo → 20%", () => {
    expect(subscriptionDiscountPercent(billPay(12))).toBe(20);
  });

  // U-SUBPRICE-3: ship-once bonus only on prepay
  it("U-SUBPRICE-3: prepay 6 mo + once → 25 + 3 = 28%", () => {
    expect(subscriptionDiscountPercent(prepay(6, "once"))).toBe(28);
  });
  it("U-SUBPRICE-3: prepay 12 mo + once → 35 + 3 = 38%", () => {
    expect(subscriptionDiscountPercent(prepay(12, "once"))).toBe(38);
  });
  it("U-SUBPRICE-3: prepay 1 mo + once → 5 + 3 = 8%", () => {
    expect(subscriptionDiscountPercent(prepay(1, "once"))).toBe(8);
  });

  // U-SUBPRICE-4: invalid combos return 0
  it("U-SUBPRICE-4: bill_pay 1 mo → 0 (invalid)", () => {
    expect(subscriptionDiscountPercent(billPay(1))).toBe(0);
  });
  it("U-SUBPRICE-4: bill_pay + ship_once → 0 (invalid)", () => {
    expect(subscriptionDiscountPercent(billPay(6, "once"))).toBe(0);
  });
});

describe("computeSubscriptionTotals", () => {
  // U-SUBTOTAL-1: 6mo prepay monthly, $100 cycle subtotal → 25% off
  it("U-SUBTOTAL-1: prepay 6mo monthly @ $100/cycle", () => {
    const r = computeSubscriptionTotals(10000, prepay(6, "monthly"));
    expect(r.discount_percent).toBe(25);
    expect(r.cycle_subtotal_cents).toBe(10000);
    expect(r.cycle_discount_cents).toBe(2500);
    expect(r.cycle_total_cents).toBe(7500);
    expect(r.plan_total_cents).toBe(45000); // 7500 * 6
    expect(r.savings_vs_retail_cents).toBe(15000); // 60000 - 45000
  });

  // U-SUBTOTAL-2: 12mo prepay ship-once → 35 + 3 = 38%
  it("U-SUBTOTAL-2: prepay 12mo once @ $200/cycle", () => {
    const r = computeSubscriptionTotals(20000, prepay(12, "once"));
    expect(r.discount_percent).toBe(38);
    expect(r.cycle_subtotal_cents).toBe(20000);
    expect(r.cycle_discount_cents).toBe(7600);
    expect(r.cycle_total_cents).toBe(12400);
    expect(r.plan_total_cents).toBe(148800); // 12400 * 12
    expect(r.savings_vs_retail_cents).toBe(91200); // 240000 - 148800
  });

  // U-SUBTOTAL-3: invalid → 0% discount, plan_total = subtotal * duration
  it("U-SUBTOTAL-3: invalid combo (bill_pay 1mo) → 0% discount", () => {
    const r = computeSubscriptionTotals(10000, billPay(1));
    expect(r.discount_percent).toBe(0);
    expect(r.cycle_discount_cents).toBe(0);
    expect(r.cycle_total_cents).toBe(10000);
    expect(r.plan_total_cents).toBe(10000);
    expect(r.savings_vs_retail_cents).toBe(0);
  });

  it("rounds discount to integer cents", () => {
    // 18% of 1233 = 221.94 → rounds to 222
    const r = computeSubscriptionTotals(1233, prepay(3, "monthly"));
    expect(r.cycle_discount_cents).toBe(222);
    expect(r.cycle_total_cents).toBe(1011);
    expect(r.plan_total_cents).toBe(3033);
    expect(Number.isInteger(r.cycle_discount_cents)).toBe(true);
    expect(Number.isInteger(r.plan_total_cents)).toBe(true);
  });

  it("bill_pay 3mo @ $150/cycle → 10% off each cycle", () => {
    const r = computeSubscriptionTotals(15000, billPay(3, "monthly"));
    expect(r.discount_percent).toBe(10);
    expect(r.cycle_discount_cents).toBe(1500);
    expect(r.cycle_total_cents).toBe(13500);
    expect(r.plan_total_cents).toBe(40500);
    expect(r.savings_vs_retail_cents).toBe(4500);
  });
});
