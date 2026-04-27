/**
 * Coupon record as stored in `public.coupons`. Either `percent_off`
 * (1-100) or `flat_off_cents` (>0) is set, never both — enforced by
 * the DB CHECK constraint.
 */
export interface CouponRecord {
  code: string;
  percent_off: number | null;
  flat_off_cents: number | null;
  min_subtotal_cents: number;
  valid_from: string | null;
  valid_until: string | null;
  max_redemptions: number | null;
  max_per_email: number;
}

export type CouponValidationFailure =
  | "not_found"
  | "expired"
  | "not_yet_active"
  | "min_subtotal_not_met"
  | "global_cap_reached"
  | "per_email_cap_reached"
  | "would_not_save_money";
