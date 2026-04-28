import { describe, it, expect } from "vitest";
import {
  subscriptionDiscountPercent,
  computeSubscriptionTotals,
} from "../discounts";
import type { SubscriptionPlanInput } from "../discounts";

const prepay = (
  duration_months: 3 | 6 | 12,
): SubscriptionPlanInput => ({
  duration_months,
  payment_cadence: "prepay",
  // Prepay = bulk N× shipment.
  ship_cadence: "once",
});

const billPay = (
  duration_months: 3 | 6 | 12,
): SubscriptionPlanInput => ({
  duration_months,
  payment_cadence: "bill_pay",
  // Bill-pay = ship one box per paid cycle.
  ship_cadence: "monthly",
});

describe("subscriptionDiscountPercent", () => {
  // U-SUBPRICE-1: prepay table — only 3/6/12 mo plans exist
  it("U-SUBPRICE-1: prepay 3 mo → 18%", () => {
    expect(subscriptionDiscountPercent(prepay(3))).toBe(18);
  });
  it("U-SUBPRICE-1: prepay 6 mo → 25%", () => {
    expect(subscriptionDiscountPercent(prepay(6))).toBe(25);
  });
  it("U-SUBPRICE-1: prepay 12 mo → 35%", () => {
    expect(subscriptionDiscountPercent(prepay(12))).toBe(35);
  });

  // U-SUBPRICE-2: bill-pay table
  it("U-SUBPRICE-2: bill_pay 3 mo → 10%", () => {
    expect(subscriptionDiscountPercent(billPay(3))).toBe(10);
  });
  it("U-SUBPRICE-2: bill_pay 6 mo → 15%", () => {
    expect(subscriptionDiscountPercent(billPay(6))).toBe(15);
  });
  it("U-SUBPRICE-2: bill_pay 12 mo → 20%", () => {
    expect(subscriptionDiscountPercent(billPay(12))).toBe(20);
  });

  // U-SUBPRICE-3: legacy/invalid duration values return 0 (e.g. an
  // old localStorage entry that still says 1mo or 9mo).
  it("U-SUBPRICE-3: unknown duration → 0", () => {
    expect(
      subscriptionDiscountPercent({
        duration_months: 9 as unknown as 3,
        payment_cadence: "prepay",
        ship_cadence: "once",
      }),
    ).toBe(0);
  });
});

describe("computeSubscriptionTotals", () => {
  // U-SUBTOTAL-1: 6mo prepay (bulk N× shipment), $100 cycle subtotal → 25% off
  it("U-SUBTOTAL-1: prepay 6mo @ $100/cycle", () => {
    const r = computeSubscriptionTotals(10000, prepay(6));
    expect(r.discount_percent).toBe(25);
    expect(r.cycle_subtotal_cents).toBe(10000);
    expect(r.cycle_discount_cents).toBe(2500);
    expect(r.cycle_total_cents).toBe(7500);
    expect(r.plan_total_cents).toBe(45000); // 7500 * 6
    expect(r.savings_vs_retail_cents).toBe(15000); // 60000 - 45000
  });

  // U-SUBTOTAL-2: 12mo prepay → 35%
  it("U-SUBTOTAL-2: prepay 12mo @ $200/cycle", () => {
    const r = computeSubscriptionTotals(20000, prepay(12));
    expect(r.discount_percent).toBe(35);
    expect(r.cycle_subtotal_cents).toBe(20000);
    expect(r.cycle_discount_cents).toBe(7000);
    expect(r.cycle_total_cents).toBe(13000);
    expect(r.plan_total_cents).toBe(156000); // 13000 * 12
    expect(r.savings_vs_retail_cents).toBe(84000); // 240000 - 156000
  });

  it("rounds discount to integer cents", () => {
    // 18% of 1233 = 221.94 → rounds to 222
    const r = computeSubscriptionTotals(1233, prepay(3));
    expect(r.cycle_discount_cents).toBe(222);
    expect(r.cycle_total_cents).toBe(1011);
    expect(r.plan_total_cents).toBe(3033);
    expect(Number.isInteger(r.cycle_discount_cents)).toBe(true);
    expect(Number.isInteger(r.plan_total_cents)).toBe(true);
  });

  it("bill_pay 3mo @ $150/cycle → 10% off each cycle", () => {
    const r = computeSubscriptionTotals(15000, billPay(3));
    expect(r.discount_percent).toBe(10);
    expect(r.cycle_discount_cents).toBe(1500);
    expect(r.cycle_total_cents).toBe(13500);
    expect(r.plan_total_cents).toBe(40500);
    expect(r.savings_vs_retail_cents).toBe(4500);
  });
});
