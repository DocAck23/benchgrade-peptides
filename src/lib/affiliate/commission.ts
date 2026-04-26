import { commissionPercent, type AffiliateTier } from "./tiers";

/**
 * Compute affiliate commission in integer cents.
 * Uses Math.round on the percent-of-order calculation.
 * Pure function — no IO, no clock.
 */
export function computeCommission(
  orderTotalCents: number,
  tier: AffiliateTier
): number {
  const pct = commissionPercent(tier);
  return Math.round((orderTotalCents * pct) / 100);
}

/**
 * Compute the clawback ledger amount: a NEGATIVE value equal in magnitude to
 * the originally-earned commission. Pure, integer cents.
 */
export function computeClawback(originalAmountCents: number): number {
  // Use 0 - x to avoid producing -0 when input is 0.
  return 0 - originalAmountCents;
}
