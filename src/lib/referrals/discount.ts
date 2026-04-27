/**
 * Compose a 10%-off referral discount on top of an order's already-
 * persisted discount + total. Earlier code REPLACED the values, which
 * silently wiped out Stack & Save, same-SKU multiplier, and affiliate
 * discounts that landed in the row at submitOrder time. The fix is to
 * compose: read the current discount/total, subtract the referral
 * discount from the current total, add it to the current discount.
 *
 * 10% is computed off the gross subtotal (the catalog price) — same
 * basis Stack & Save uses — not off the post-discount total. This
 * matches the customer's mental model: "10% off" reads as 10% of the
 * sticker price, not 10% of the already-discounted price.
 *
 * Floor of zero on the final total (defense-in-depth: a bug elsewhere
 * could otherwise let referral push the order negative).
 */
export interface ComposeReferralInput {
  /** Pre-discount line-item subtotal in cents (gross retail). */
  subtotal_cents: number;
  /** Already-persisted discount on the order before referral. */
  current_discount_cents: number;
  /** Already-persisted total (= subtotal − current discount). */
  current_total_cents: number;
}

export interface ComposeReferralResult {
  /** Cents the referral itself contributed; persisted for telemetry. */
  referral_discount_cents: number;
  /** New discount_cents to write to the order row. */
  next_discount_cents: number;
  /** New total_cents to write to the order row. */
  next_total_cents: number;
}

const REFERRAL_PERCENT = 0.1;

export function composeReferralDiscount(
  input: ComposeReferralInput,
): ComposeReferralResult {
  const referral_discount_cents = Math.round(
    input.subtotal_cents * REFERRAL_PERCENT,
  );
  const next_discount_cents = input.current_discount_cents + referral_discount_cents;
  const next_total_cents = Math.max(
    0,
    input.current_total_cents - referral_discount_cents,
  );
  return {
    referral_discount_cents,
    next_discount_cents,
    next_total_cents,
  };
}
