import { describe, it, expect } from "vitest";
import {
  computeRaffleEntries,
  startOfMonthUtc,
  startOfNextMonthUtc,
  monthKey,
} from "../entries";

describe("computeRaffleEntries", () => {
  it("returns the tier base when no spend is recorded", () => {
    expect(
      computeRaffleEntries({
        tier: "initiate",
        ownSpendCentsThisMonth: 0,
        refereeSpendCentsThisMonth: 0,
      }),
    ).toBe(1); // Initiate base = 1
    expect(
      computeRaffleEntries({
        tier: "laureate",
        ownSpendCentsThisMonth: 0,
        refereeSpendCentsThisMonth: 0,
      }),
    ).toBe(25); // Laureate base = 25
  });

  it("adds 1 entry per $25 of own funded spend", () => {
    expect(
      computeRaffleEntries({
        tier: "initiate",
        ownSpendCentsThisMonth: 2_500, // $25
        refereeSpendCentsThisMonth: 0,
      }),
    ).toBe(2); // base 1 + own 1
    expect(
      computeRaffleEntries({
        tier: "initiate",
        ownSpendCentsThisMonth: 4_999, // $49.99 (rounded down to 1 entry)
        refereeSpendCentsThisMonth: 0,
      }),
    ).toBe(2);
    expect(
      computeRaffleEntries({
        tier: "initiate",
        ownSpendCentsThisMonth: 50_000, // $500
        refereeSpendCentsThisMonth: 0,
      }),
    ).toBe(21); // base 1 + own 20
  });

  it("adds 1 entry per $10 of referee funded spend (2.5x own rate)", () => {
    expect(
      computeRaffleEntries({
        tier: "initiate",
        ownSpendCentsThisMonth: 0,
        refereeSpendCentsThisMonth: 1_000, // $10
      }),
    ).toBe(2); // base 1 + ref 1
    expect(
      computeRaffleEntries({
        tier: "initiate",
        ownSpendCentsThisMonth: 0,
        refereeSpendCentsThisMonth: 100_000, // $1,000
      }),
    ).toBe(101); // base 1 + ref 100
  });

  it("composes all three inputs (worked example from PRD)", () => {
    // PRD §4.8 worked example: a Principal who spends $300 themselves
    // and whose referees spent $800 collectively.
    expect(
      computeRaffleEntries({
        tier: "principal",
        ownSpendCentsThisMonth: 30_000,
        refereeSpendCentsThisMonth: 80_000,
      }),
    ).toBe(98); // base 6 + own 12 + ref 80
  });

  it("Laureate banner-month example from PRD", () => {
    // A Laureate who refers a $2k buyer + places their own $500 order.
    expect(
      computeRaffleEntries({
        tier: "laureate",
        ownSpendCentsThisMonth: 50_000,
        refereeSpendCentsThisMonth: 200_000,
      }),
    ).toBe(245); // 25 + 20 + 200
  });

  it("clamps negative or NaN inputs to zero (defensive)", () => {
    expect(
      computeRaffleEntries({
        tier: "initiate",
        ownSpendCentsThisMonth: -100,
        refereeSpendCentsThisMonth: -50,
      }),
    ).toBe(1);
    expect(
      computeRaffleEntries({
        tier: "initiate",
        ownSpendCentsThisMonth: Number.NaN,
        refereeSpendCentsThisMonth: 0,
      }),
    ).toBe(1);
  });
});

describe("month key helpers", () => {
  it("startOfMonthUtc collapses any moment in the month to the first of the month UTC", () => {
    const d = new Date(Date.UTC(2026, 4, 28, 19, 30, 0)); // May 28, 2026 19:30 UTC
    const start = startOfMonthUtc(d);
    expect(start.toISOString()).toBe("2026-05-01T00:00:00.000Z");
  });

  it("startOfNextMonthUtc rolls into the next month even at year-end", () => {
    const dec = new Date(Date.UTC(2026, 11, 31, 23, 59, 0));
    expect(startOfNextMonthUtc(dec).toISOString()).toBe(
      "2027-01-01T00:00:00.000Z",
    );
  });

  it("monthKey formats as YYYY-MM-01", () => {
    expect(monthKey(new Date(Date.UTC(2026, 0, 15)))).toBe("2026-01-01");
    expect(monthKey(new Date(Date.UTC(2026, 11, 1)))).toBe("2026-12-01");
  });
});
