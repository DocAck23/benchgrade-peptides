import type { CouponRecord, CouponValidationFailure } from "./types";

/**
 * Compute the post-coupon total in cents. Pure function so it's
 * trivially testable and shareable between the cart preview and
 * the server-side apply path.
 *
 * Two layers:
 *
 *   1. Raw coupon discount = percent × subtotal OR flat amount,
 *      floored at 0 (never push the order negative).
 *
 *   2. Stacking decision (BEST-OF, founder rule):
 *      - other_discount_cents = the discount engine already gave
 *        the customer at submit time (Stack & Save + same-SKU +
 *        affiliate). Referral COMPOSES with those, so the caller
 *        rolls referral into other_discount_cents too.
 *      - The coupon REPLACES the other-discount stack only if the
 *        coupon's discount is strictly larger; otherwise we keep
 *        the other-discount stack. Either way the customer gets
 *        the better deal.
 */
export interface ApplyCouponInput {
  subtotal_cents: number;
  /**
   * Sum of every other discount already applied to the order
   * (Stack & Save + same-SKU + affiliate + referral). The coupon
   * does NOT stack on top of these.
   */
  other_discount_cents: number;
  coupon: CouponRecord;
}

export interface ApplyCouponResult {
  /** Cents the coupon ALONE would discount. */
  coupon_discount_cents: number;
  /** Cents we ultimately apply (max of coupon vs other-stack). */
  applied_discount_cents: number;
  /** Resulting order total. */
  next_total_cents: number;
  /** Whether the coupon won the best-of comparison. */
  coupon_won: boolean;
}

export function applyCoupon(input: ApplyCouponInput): ApplyCouponResult {
  const subtotal = Math.max(0, input.subtotal_cents);
  const other = Math.max(0, input.other_discount_cents);

  const couponRaw = computeCouponDiscount(input.coupon, subtotal);
  // Best-of: pick whichever discount the customer prefers (larger).
  const couponWon = couponRaw > other;
  const applied = couponWon ? couponRaw : other;
  const total = Math.max(0, subtotal - applied);
  return {
    coupon_discount_cents: couponRaw,
    applied_discount_cents: applied,
    next_total_cents: total,
    coupon_won: couponWon,
  };
}

function computeCouponDiscount(coupon: CouponRecord, subtotal_cents: number): number {
  if (coupon.percent_off !== null) {
    const pct = Math.max(1, Math.min(100, coupon.percent_off));
    return Math.round((subtotal_cents * pct) / 100);
  }
  if (coupon.flat_off_cents !== null) {
    return Math.min(subtotal_cents, Math.max(0, coupon.flat_off_cents));
  }
  return 0;
}

/**
 * Window / threshold checks that don't need DB access — pure on the
 * coupon record + the order context. Returns null if the coupon
 * passes all the synchronous gates; the DB-backed cap checks
 * (global, per-email) live in the server action.
 */
export function validateCouponSync(
  coupon: CouponRecord,
  subtotal_cents: number,
  now: Date = new Date(),
): CouponValidationFailure | null {
  if (coupon.valid_from && new Date(coupon.valid_from) > now) {
    return "not_yet_active";
  }
  if (coupon.valid_until && new Date(coupon.valid_until) < now) {
    return "expired";
  }
  if (subtotal_cents < coupon.min_subtotal_cents) {
    return "min_subtotal_not_met";
  }
  return null;
}
