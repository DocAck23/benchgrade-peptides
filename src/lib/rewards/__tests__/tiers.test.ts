import { describe, it, expect } from "vitest";
import {
  tierFromPoints,
  tierSpec,
  nextTierProgress,
  pointsForOwnSpendCents,
  pointsForRefereeSpendCents,
  POINTS_BONUS_REFEREE_FIRST,
  POINTS_PER_DOLLAR_OWN,
  POINTS_PER_DOLLAR_REFEREE,
  TIER_SPECS,
  REDEMPTION_OPTIONS,
} from "../tiers";

describe("tierFromPoints", () => {
  it("returns initiate for a brand-new account (0 points)", () => {
    expect(tierFromPoints(0)).toBe("initiate");
  });

  it("returns initiate just below the researcher threshold", () => {
    expect(tierFromPoints(249)).toBe("initiate");
  });

  it("returns researcher exactly at the threshold", () => {
    expect(tierFromPoints(250)).toBe("researcher");
  });

  it("returns the highest tier the customer qualifies for", () => {
    expect(tierFromPoints(999)).toBe("researcher");
    expect(tierFromPoints(1_000)).toBe("principal");
    expect(tierFromPoints(4_999)).toBe("principal");
    expect(tierFromPoints(5_000)).toBe("fellow");
    expect(tierFromPoints(14_999)).toBe("fellow");
    expect(tierFromPoints(15_000)).toBe("laureate");
    expect(tierFromPoints(1_000_000)).toBe("laureate");
  });

  it("collapses negative or non-finite inputs to initiate", () => {
    expect(tierFromPoints(-1)).toBe("initiate");
    expect(tierFromPoints(Number.NaN)).toBe("initiate");
    expect(tierFromPoints(Number.NEGATIVE_INFINITY)).toBe("initiate");
  });
});

describe("tierSpec", () => {
  it("returns the discount + raffle config for each tier", () => {
    expect(tierSpec("initiate").ownDiscountPct).toBe(0);
    expect(tierSpec("researcher").ownDiscountPct).toBe(2);
    expect(tierSpec("principal").ownDiscountPct).toBe(5);
    expect(tierSpec("fellow").ownDiscountPct).toBe(8);
    expect(tierSpec("laureate").ownDiscountPct).toBe(10);
  });

  it("caps own and referral discounts at 10% per founder spec", () => {
    for (const spec of TIER_SPECS) {
      expect(spec.ownDiscountPct).toBeLessThanOrEqual(10);
      expect(spec.referralLinkPct).toBeLessThanOrEqual(10);
    }
  });

  it("base raffle entries scale monotonically with tier", () => {
    let prev = -1;
    for (const spec of TIER_SPECS) {
      expect(spec.baseRaffleEntries).toBeGreaterThan(prev);
      prev = spec.baseRaffleEntries;
    }
  });
});

describe("nextTierProgress", () => {
  it("reports points needed for the next tier", () => {
    const progress = nextTierProgress(100);
    expect(progress?.next.tier).toBe("researcher");
    expect(progress?.pointsNeeded).toBe(150); // 250 - 100
  });

  it("returns 0 needed at exact threshold (just promoted)", () => {
    const progress = nextTierProgress(250);
    expect(progress?.next.tier).toBe("principal");
    expect(progress?.pointsNeeded).toBe(750); // 1000 - 250
  });

  it("returns null at the top tier (Laureate has nowhere to climb)", () => {
    expect(nextTierProgress(15_000)).toBeNull();
    expect(nextTierProgress(50_000)).toBeNull();
  });

  it("treats negative inputs as 0 for the points-needed math", () => {
    const progress = nextTierProgress(-50);
    expect(progress?.next.tier).toBe("researcher");
    expect(progress?.pointsNeeded).toBe(250);
  });
});

describe("earning rates", () => {
  it("constants match the PRD (1× own, 10× referee, 100 first-order bonus)", () => {
    expect(POINTS_PER_DOLLAR_OWN).toBe(1);
    expect(POINTS_PER_DOLLAR_REFEREE).toBe(10);
    expect(POINTS_BONUS_REFEREE_FIRST).toBe(100);
  });

  it("floors partial dollars on own spend (no fractional points)", () => {
    expect(pointsForOwnSpendCents(99)).toBe(0); // < $1
    expect(pointsForOwnSpendCents(100)).toBe(1); // $1
    expect(pointsForOwnSpendCents(199)).toBe(1); // $1.99 still 1pt
    expect(pointsForOwnSpendCents(20_000)).toBe(200); // $200 → 200pts
  });

  it("floors partial dollars on referee spend with the 10× multiplier", () => {
    expect(pointsForRefereeSpendCents(99)).toBe(0);
    expect(pointsForRefereeSpendCents(100)).toBe(10);
    expect(pointsForRefereeSpendCents(20_000)).toBe(2_000);
  });

  it("rejects negative / non-finite inputs without crashing", () => {
    expect(pointsForOwnSpendCents(-100)).toBe(0);
    expect(pointsForOwnSpendCents(Number.NaN)).toBe(0);
    expect(pointsForRefereeSpendCents(-1)).toBe(0);
  });

  it("a single $1k referral vaults Researcher → Fellow per founder design", () => {
    // $1000 referee spend × 10pts/$ = 10,000 points to the referrer.
    // Plus the 100pt first-order bonus = 10,100. From Researcher
    // (250–999) starting at 500pts that's 10,600pts → Fellow tier
    // (5,000–14,999). Confirms PRD §4.0 promise.
    const referee = pointsForRefereeSpendCents(100_000);
    const totalAfterFirstReferral = 500 + referee + POINTS_BONUS_REFEREE_FIRST;
    expect(totalAfterFirstReferral).toBe(10_600);
    expect(tierFromPoints(totalAfterFirstReferral)).toBe("fellow");
  });
});

describe("redemption catalog", () => {
  it("publishes the five PRD redemption options at the documented costs", () => {
    const byKind = Object.fromEntries(REDEMPTION_OPTIONS.map((o) => [o.kind, o.cost]));
    expect(byKind).toEqual({
      redeem_credit: 100,
      redeem_raffle_entry: 500,
      redeem_vial_5: 2_500,
      redeem_vial_10: 5_000,
      redeem_shipping: 10_000,
    });
  });
});
