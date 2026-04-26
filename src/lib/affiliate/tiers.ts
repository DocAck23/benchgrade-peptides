export type AffiliateTier = "bronze" | "silver" | "gold" | "eminent";

export interface AffiliateState {
  successful_referrals_count: number;
  total_earned_cents: number;
}

interface TierThreshold {
  tier: AffiliateTier;
  refs: number;
  earnings_cents: number;
}

// OR-semantic thresholds. Ordered from highest to lowest so the first match wins.
const TIER_THRESHOLDS: readonly TierThreshold[] = [
  { tier: "eminent", refs: 50, earnings_cents: 2_500_000 },
  { tier: "gold", refs: 15, earnings_cents: 500_000 },
  { tier: "silver", refs: 5, earnings_cents: 100_000 },
];

export function affiliateTier(state: AffiliateState): AffiliateTier {
  for (const t of TIER_THRESHOLDS) {
    if (
      state.successful_referrals_count >= t.refs ||
      state.total_earned_cents >= t.earnings_cents
    ) {
      return t.tier;
    }
  }
  return "bronze";
}

export function commissionPercent(tier: AffiliateTier): 10 | 12 | 15 | 18 {
  switch (tier) {
    case "bronze":
      return 10;
    case "silver":
      return 12;
    case "gold":
      return 15;
    case "eminent":
      return 18;
  }
}

export function personalVialDiscount(tier: AffiliateTier): 10 | 15 | 20 | 25 {
  switch (tier) {
    case "bronze":
      return 10;
    case "silver":
      return 15;
    case "gold":
      return 20;
    case "eminent":
      return 25;
  }
}

export function redemptionRatio(tier: AffiliateTier): 1.1 | 1.2 | 1.3 | 1.4 {
  switch (tier) {
    case "bronze":
      return 1.1;
    case "silver":
      return 1.2;
    case "gold":
      return 1.3;
    case "eminent":
      return 1.4;
  }
}

export function nextTier(current: AffiliateTier): {
  tier: AffiliateTier;
  refs_needed: number;
  earnings_needed_cents: number;
} | null {
  switch (current) {
    case "bronze":
      return { tier: "silver", refs_needed: 5, earnings_needed_cents: 100_000 };
    case "silver":
      return { tier: "gold", refs_needed: 15, earnings_needed_cents: 500_000 };
    case "gold":
      return {
        tier: "eminent",
        refs_needed: 50,
        earnings_needed_cents: 2_500_000,
      };
    case "eminent":
      return null;
  }
}
