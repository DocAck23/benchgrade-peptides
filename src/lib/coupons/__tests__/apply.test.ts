import { describe, it, expect } from "vitest";
import { applyCoupon, validateCouponSync } from "../apply";
import type { CouponRecord } from "../types";

const PCT20: CouponRecord = {
  code: "promo20",
  percent_off: 20,
  flat_off_cents: null,
  min_subtotal_cents: 0,
  valid_from: null,
  valid_until: null,
  max_redemptions: null,
  max_per_email: 1,
};

const FLAT_25: CouponRecord = {
  ...PCT20,
  code: "flat25",
  percent_off: null,
  flat_off_cents: 2500,
};

describe("applyCoupon — best-of stacking", () => {
  it("wins when coupon's discount is larger than the existing stack", () => {
    // $100 subtotal, $10 other discount, 20% coupon = $20 → coupon wins.
    const r = applyCoupon({
      subtotal_cents: 10_000,
      other_discount_cents: 1000,
      coupon: PCT20,
    });
    expect(r.coupon_discount_cents).toBe(2000);
    expect(r.applied_discount_cents).toBe(2000);
    expect(r.next_total_cents).toBe(8000);
    expect(r.coupon_won).toBe(true);
  });

  it("loses when the existing stack is larger", () => {
    // $100 subtotal, $30 other discount (Stack & Save 25% + free
    // shipping etc.), 20% coupon = $20 → other-stack wins.
    const r = applyCoupon({
      subtotal_cents: 10_000,
      other_discount_cents: 3000,
      coupon: PCT20,
    });
    expect(r.coupon_discount_cents).toBe(2000);
    expect(r.applied_discount_cents).toBe(3000);
    expect(r.next_total_cents).toBe(7000);
    expect(r.coupon_won).toBe(false);
  });

  it("flat coupon wins on small carts where percent would lose", () => {
    // $50 subtotal, no other discount, $25 flat → $25 off, $25 total.
    const r = applyCoupon({
      subtotal_cents: 5000,
      other_discount_cents: 0,
      coupon: FLAT_25,
    });
    expect(r.coupon_discount_cents).toBe(2500);
    expect(r.next_total_cents).toBe(2500);
  });

  it("flat coupon caps at subtotal — never pushes total negative", () => {
    // $10 subtotal, $25 flat → caps at $10, total = $0.
    const r = applyCoupon({
      subtotal_cents: 1000,
      other_discount_cents: 0,
      coupon: FLAT_25,
    });
    expect(r.coupon_discount_cents).toBe(1000);
    expect(r.next_total_cents).toBe(0);
  });

  it("ties go to the existing stack (coupon_won === false unless STRICTLY larger)", () => {
    // $100 subtotal, $20 other discount, 20% coupon = $20 → tie → keep other.
    const r = applyCoupon({
      subtotal_cents: 10_000,
      other_discount_cents: 2000,
      coupon: PCT20,
    });
    expect(r.coupon_won).toBe(false);
    expect(r.applied_discount_cents).toBe(2000);
  });
});

describe("validateCouponSync", () => {
  it("flags expired coupons", () => {
    const past = "2026-01-01T00:00:00Z";
    expect(
      validateCouponSync({ ...PCT20, valid_until: past }, 10_000, new Date("2026-04-27")),
    ).toBe("expired");
  });

  it("flags not-yet-active coupons", () => {
    const future = "2027-01-01T00:00:00Z";
    expect(
      validateCouponSync({ ...PCT20, valid_from: future }, 10_000, new Date("2026-04-27")),
    ).toBe("not_yet_active");
  });

  it("flags min-subtotal violations", () => {
    expect(
      validateCouponSync({ ...PCT20, min_subtotal_cents: 5000 }, 4999),
    ).toBe("min_subtotal_not_met");
  });

  it("returns null when all sync gates pass", () => {
    expect(validateCouponSync(PCT20, 10_000)).toBeNull();
  });
});
