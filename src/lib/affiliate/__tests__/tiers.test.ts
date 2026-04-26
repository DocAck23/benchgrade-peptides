import { describe, it, expect } from "vitest";
import {
  affiliateTier,
  commissionPercent,
  personalVialDiscount,
  redemptionRatio,
  nextTier,
} from "../tiers";

describe("U-AFFTIER-1: affiliateTier thresholds (bronze)", () => {
  it("returns bronze for fresh state", () => {
    expect(
      affiliateTier({ successful_referrals_count: 0, total_earned_cents: 0 })
    ).toBe("bronze");
  });

  it("returns bronze just under both thresholds", () => {
    expect(
      affiliateTier({
        successful_referrals_count: 4,
        total_earned_cents: 99_999,
      })
    ).toBe("bronze");
  });
});

describe("U-AFFTIER-2: silver via OR semantics", () => {
  it("unlocks silver at exactly 5 refs even with no earnings", () => {
    expect(
      affiliateTier({ successful_referrals_count: 5, total_earned_cents: 0 })
    ).toBe("silver");
  });

  it("unlocks silver at exactly $1k earnings even with 0 refs", () => {
    expect(
      affiliateTier({
        successful_referrals_count: 0,
        total_earned_cents: 100_000,
      })
    ).toBe("silver");
  });

  it("stays silver just under gold thresholds", () => {
    expect(
      affiliateTier({
        successful_referrals_count: 14,
        total_earned_cents: 499_999,
      })
    ).toBe("silver");
  });
});

describe("U-AFFTIER-3: gold via OR semantics", () => {
  it("unlocks gold at exactly 15 refs", () => {
    expect(
      affiliateTier({ successful_referrals_count: 15, total_earned_cents: 0 })
    ).toBe("gold");
  });

  it("unlocks gold at exactly $5k earnings", () => {
    expect(
      affiliateTier({
        successful_referrals_count: 0,
        total_earned_cents: 500_000,
      })
    ).toBe("gold");
  });

  it("stays gold just under eminent thresholds", () => {
    expect(
      affiliateTier({
        successful_referrals_count: 49,
        total_earned_cents: 2_499_999,
      })
    ).toBe("gold");
  });
});

describe("U-AFFTIER-4: eminent via OR semantics", () => {
  it("unlocks eminent at exactly 50 refs", () => {
    expect(
      affiliateTier({ successful_referrals_count: 50, total_earned_cents: 0 })
    ).toBe("eminent");
  });

  it("unlocks eminent at exactly $25k earnings", () => {
    expect(
      affiliateTier({
        successful_referrals_count: 0,
        total_earned_cents: 2_500_000,
      })
    ).toBe("eminent");
  });

  it("stays eminent for very high values", () => {
    expect(
      affiliateTier({
        successful_referrals_count: 9999,
        total_earned_cents: 999_999_999,
      })
    ).toBe("eminent");
  });
});

describe("U-AFFDISC-1: personal vial discount table", () => {
  it("bronze=10, silver=15, gold=20, eminent=25", () => {
    expect(personalVialDiscount("bronze")).toBe(10);
    expect(personalVialDiscount("silver")).toBe(15);
    expect(personalVialDiscount("gold")).toBe(20);
    expect(personalVialDiscount("eminent")).toBe(25);
  });
});

describe("U-AFFREDEEM-1: redemption ratio table", () => {
  it("bronze=1.10, silver=1.20, gold=1.30, eminent=1.40", () => {
    expect(redemptionRatio("bronze")).toBe(1.1);
    expect(redemptionRatio("silver")).toBe(1.2);
    expect(redemptionRatio("gold")).toBe(1.3);
    expect(redemptionRatio("eminent")).toBe(1.4);
  });
});

describe("commissionPercent table", () => {
  it("bronze=10, silver=12, gold=15, eminent=18", () => {
    expect(commissionPercent("bronze")).toBe(10);
    expect(commissionPercent("silver")).toBe(12);
    expect(commissionPercent("gold")).toBe(15);
    expect(commissionPercent("eminent")).toBe(18);
  });
});

describe("nextTier", () => {
  it("from bronze -> silver with 5 refs / $1k thresholds", () => {
    expect(nextTier("bronze")).toEqual({
      tier: "silver",
      refs_needed: 5,
      earnings_needed_cents: 100_000,
    });
  });

  it("from silver -> gold with 15 refs / $5k thresholds", () => {
    expect(nextTier("silver")).toEqual({
      tier: "gold",
      refs_needed: 15,
      earnings_needed_cents: 500_000,
    });
  });

  it("from gold -> eminent with 50 refs / $25k thresholds", () => {
    expect(nextTier("gold")).toEqual({
      tier: "eminent",
      refs_needed: 50,
      earnings_needed_cents: 2_500_000,
    });
  });

  it("from eminent returns null", () => {
    expect(nextTier("eminent")).toBeNull();
  });
});
