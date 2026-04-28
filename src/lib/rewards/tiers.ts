import type { RewardTier } from "@/lib/supabase/types";

/**
 * Tier configuration — single source of truth for the rewards system.
 *
 * PRD §4.1 / 4.2: thresholds drive tier; tier drives discount %, link %,
 * and base raffle entries. All numeric configuration lives here so a
 * future tweak to (say) the Laureate threshold is a one-line change
 * with no scattered magic numbers downstream.
 */

export interface TierSpec {
  tier: RewardTier;
  /** Inclusive lower bound on rolling-12-month tier-points to qualify. */
  threshold: number;
  /** Display label used in UI. */
  label: string;
  /** Own-order discount percent applied as initial-price modifier. */
  ownDiscountPct: number;
  /** Discount percent given to a referee using this tier's referral link. */
  referralLinkPct: number;
  /** Base raffle entries before spend-driven additions. */
  baseRaffleEntries: number;
}

export const TIER_SPECS: readonly TierSpec[] = [
  {
    tier: "initiate",
    threshold: 0,
    label: "Initiate",
    ownDiscountPct: 0,
    referralLinkPct: 5,
    baseRaffleEntries: 1,
  },
  {
    tier: "researcher",
    threshold: 250,
    label: "Researcher",
    ownDiscountPct: 2,
    referralLinkPct: 6,
    baseRaffleEntries: 3,
  },
  {
    tier: "principal",
    threshold: 1_000,
    label: "Principal",
    ownDiscountPct: 5,
    referralLinkPct: 7,
    baseRaffleEntries: 6,
  },
  {
    tier: "fellow",
    threshold: 5_000,
    label: "Fellow",
    ownDiscountPct: 8,
    referralLinkPct: 8,
    baseRaffleEntries: 12,
  },
  {
    tier: "laureate",
    threshold: 15_000,
    label: "Laureate",
    ownDiscountPct: 10,
    referralLinkPct: 10,
    baseRaffleEntries: 25,
  },
] as const;

const SPECS_BY_TIER: Record<RewardTier, TierSpec> = TIER_SPECS.reduce(
  (acc, spec) => {
    acc[spec.tier] = spec;
    return acc;
  },
  {} as Record<RewardTier, TierSpec>,
);

/**
 * Map a rolling-12-month tier-points value to the tier the customer
 * has earned. Walks the spec list from the highest threshold down so
 * the customer always lands on the *highest* tier they qualify for.
 *
 * Negative or non-finite inputs collapse to Initiate — defensive
 * against admin debits that would otherwise underflow the lookup.
 */
export function tierFromPoints(points: number): RewardTier {
  if (!Number.isFinite(points) || points < TIER_SPECS[0].threshold) {
    return "initiate";
  }
  for (let i = TIER_SPECS.length - 1; i >= 0; i--) {
    if (points >= TIER_SPECS[i].threshold) return TIER_SPECS[i].tier;
  }
  return "initiate";
}

export function tierSpec(tier: RewardTier): TierSpec {
  return SPECS_BY_TIER[tier];
}

/**
 * Compute how many points are still needed to reach the next tier, and
 * what that tier is. Returns `null` for a customer already at the top
 * tier so callers can render "max tier" copy.
 */
export function nextTierProgress(points: number): {
  next: TierSpec;
  pointsNeeded: number;
} | null {
  const current = tierFromPoints(points);
  const idx = TIER_SPECS.findIndex((s) => s.tier === current);
  if (idx < 0 || idx >= TIER_SPECS.length - 1) return null;
  const next = TIER_SPECS[idx + 1];
  return {
    next,
    pointsNeeded: Math.max(0, next.threshold - Math.max(0, points)),
  };
}

// ---------- Earning rates (PRD §4.2) ----------

/**
 * Points earned per dollar of own funded spend (post-discount, pre-shipping).
 * Earning rate is identical for tier-points and redeemable balance.
 */
export const POINTS_PER_DOLLAR_OWN = 1;

/**
 * Points the referrer earns per dollar the referee funds. 10× the own
 * rate by design — referrals are the dominant climbing mechanism.
 */
export const POINTS_PER_DOLLAR_REFEREE = 10;

/**
 * One-time bonus to the referrer when their referee places a first
 * funded order. Awarded once per (referrer, referee) pair.
 */
export const POINTS_BONUS_REFEREE_FIRST = 100;

/**
 * Compute earned points (tier and balance are equal at earn time per
 * PRD §4.2) for a given funded-order subtotal in cents. Floors so
 * partial dollars don't grant a fractional point.
 */
export function pointsForOwnSpendCents(subtotalCents: number): number {
  if (!Number.isFinite(subtotalCents) || subtotalCents <= 0) return 0;
  return Math.floor(subtotalCents / 100) * POINTS_PER_DOLLAR_OWN;
}

export function pointsForRefereeSpendCents(subtotalCents: number): number {
  if (!Number.isFinite(subtotalCents) || subtotalCents <= 0) return 0;
  return Math.floor(subtotalCents / 100) * POINTS_PER_DOLLAR_REFEREE;
}

// ---------- Redemption catalog (PRD §4.5) ----------

export type RedemptionKind =
  | "redeem_credit"
  | "redeem_raffle_entry"
  | "redeem_vial_5"
  | "redeem_vial_10"
  | "redeem_shipping";

export interface RedemptionOption {
  kind: RedemptionKind;
  cost: number;
  label: string;
  description: string;
}

export const REDEMPTION_OPTIONS: readonly RedemptionOption[] = [
  {
    kind: "redeem_credit",
    cost: 100,
    label: "$1 store credit",
    description: "Apply at checkout. 100 points = $1 off, capped at 50% of subtotal.",
  },
  {
    kind: "redeem_raffle_entry",
    cost: 500,
    label: "+1 raffle entry",
    description: "Adds an entry to this month's raffle. Entries don't roll over.",
  },
  {
    kind: "redeem_vial_5",
    cost: 2_500,
    label: "Free 5mg vial",
    description: "Choose any 5mg vial at your next checkout.",
  },
  {
    kind: "redeem_vial_10",
    cost: 5_000,
    label: "Free 10mg vial",
    description: "Choose any 10mg vial at your next checkout.",
  },
  {
    kind: "redeem_shipping",
    cost: 10_000,
    label: "Free shipping for 12 months",
    description: "Domestic shipping comped on every order through next year.",
  },
] as const;
