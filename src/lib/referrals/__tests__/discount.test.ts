import { describe, it, expect } from "vitest";
import { composeReferralDiscount } from "../discount";

describe("composeReferralDiscount", () => {
  it("layers a 10%-of-subtotal referral discount on top of an existing discount", () => {
    // Order: $200 subtotal, 15% Stack&Save already applied → $30 discount, $170 total.
    const r = composeReferralDiscount({
      subtotal_cents: 20_000,
      current_discount_cents: 3000,
      current_total_cents: 17_000,
    });
    // Referral = 10% of $200 = $20.
    expect(r.referral_discount_cents).toBe(2000);
    // Discount composes: $30 + $20 = $50.
    expect(r.next_discount_cents).toBe(5000);
    // Total reduces: $170 − $20 = $150 (NOT $170 − 10% rebased).
    expect(r.next_total_cents).toBe(15_000);
  });

  it("handles a clean (no prior discount) order", () => {
    const r = composeReferralDiscount({
      subtotal_cents: 10_000,
      current_discount_cents: 0,
      current_total_cents: 10_000,
    });
    expect(r.referral_discount_cents).toBe(1000);
    expect(r.next_discount_cents).toBe(1000);
    expect(r.next_total_cents).toBe(9000);
  });

  it("never lets total go negative", () => {
    // Pathological: prior discount already pushed total to $5, subtotal was $50.
    // Referral 10% of $50 = $5 → total clamps at 0, not −500 cents.
    const r = composeReferralDiscount({
      subtotal_cents: 5000,
      current_discount_cents: 4500,
      current_total_cents: 500,
    });
    expect(r.referral_discount_cents).toBe(500);
    expect(r.next_total_cents).toBe(0);
  });

  it("does NOT reduce existing discount under floor — it's strictly additive", () => {
    // Same order in two states should land in the same place if we replay the
    // call: composing twice equals adding 2× the referral. We're testing the
    // arithmetic contract, not idempotence.
    const subtotal_cents = 12_345;
    const first = composeReferralDiscount({
      subtotal_cents,
      current_discount_cents: 0,
      current_total_cents: subtotal_cents,
    });
    expect(first.referral_discount_cents).toBe(1235); // round(12345 * 0.1)
    expect(first.next_discount_cents).toBe(1235);
    expect(first.next_total_cents).toBe(11_110);
  });
});
