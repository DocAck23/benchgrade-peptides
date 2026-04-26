import { describe, it, expect } from "vitest";
import { computeCommission, computeClawback } from "../commission";

describe("U-AFFCOMM-1: commissionPercent application via computeCommission", () => {
  it("bronze 10% on $100.00 (10000 cents) = 1000 cents", () => {
    expect(computeCommission(10_000, "bronze")).toBe(1_000);
  });

  it("silver 12% on $100.00 = 1200 cents", () => {
    expect(computeCommission(10_000, "silver")).toBe(1_200);
  });

  it("gold 15% on $100.00 = 1500 cents", () => {
    expect(computeCommission(10_000, "gold")).toBe(1_500);
  });

  it("eminent 18% on $100.00 = 1800 cents", () => {
    expect(computeCommission(10_000, "eminent")).toBe(1_800);
  });
});

describe("U-AFFCALC-1: integer-cents rounding", () => {
  it("rounds half up (Math.round) — 12345 cents @ 10% = 1235", () => {
    // 12345 * 0.10 = 1234.5 -> Math.round -> 1235
    expect(computeCommission(12_345, "bronze")).toBe(1_235);
  });

  it("rounds correctly for silver 12% on 33 cents: 3.96 -> 4", () => {
    expect(computeCommission(33, "silver")).toBe(4);
  });

  it("rounds correctly for eminent 18% on 1 cent: 0.18 -> 0", () => {
    expect(computeCommission(1, "eminent")).toBe(0);
  });

  it("zero order yields zero commission", () => {
    expect(computeCommission(0, "gold")).toBe(0);
  });

  it("returns positive integer for typical order", () => {
    const result = computeCommission(7_777, "gold"); // 1166.55 -> 1167
    expect(result).toBe(1_167);
    expect(Number.isInteger(result)).toBe(true);
  });
});

describe("U-AFFCALC-2: computeClawback", () => {
  it("returns the negation of the original amount", () => {
    expect(computeClawback(1_500)).toBe(-1_500);
  });

  it("zero clawback for zero original", () => {
    expect(computeClawback(0)).toBe(0);
  });

  it("preserves integer-cents", () => {
    const result = computeClawback(98_765);
    expect(result).toBe(-98_765);
    expect(Number.isInteger(result)).toBe(true);
  });
});
