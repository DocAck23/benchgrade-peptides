import { describe, it, expect } from "vitest";
import { nextCycleDate, billPayInstructions } from "../cycles";

const START = new Date("2026-04-25T00:00:00Z");

describe("nextCycleDate", () => {
  // U-CYCLE-1: monthly cadence = +30 days
  it("U-CYCLE-1: monthly → +30 days", () => {
    const next = nextCycleDate(START, "monthly");
    expect(next).not.toBeNull();
    expect(next!.toISOString()).toBe("2026-05-25T00:00:00.000Z");
  });

  // U-CYCLE-2: quarterly cadence = +90 days
  it("U-CYCLE-2: quarterly → +90 days", () => {
    const next = nextCycleDate(START, "quarterly");
    expect(next).not.toBeNull();
    expect(next!.toISOString()).toBe("2026-07-24T00:00:00.000Z");
  });

  // U-CYCLE-3: once cadence = null (no further cycle)
  it("U-CYCLE-3: once → null", () => {
    expect(nextCycleDate(START, "once")).toBeNull();
  });

  it("does not mutate the input date", () => {
    const before = START.toISOString();
    nextCycleDate(START, "monthly");
    expect(START.toISOString()).toBe(before);
  });

  it("monthly handles start on the 31st predictably (+30d, not calendar month)", () => {
    const start = new Date("2026-01-31T00:00:00Z");
    const next = nextCycleDate(start, "monthly");
    expect(next!.toISOString()).toBe("2026-03-02T00:00:00.000Z");
  });
});

describe("billPayInstructions", () => {
  const baseInput = {
    cycle_total_cents: 13500,
    next_charge_date: new Date("2026-05-25T00:00:00Z"),
    subscription_memo: "BGP-SUB-abc12345",
    beneficiary_name: "Bench Grade Peptides LLC",
    beneficiary_routing: "021000021",
    beneficiary_account: "1234567890",
  };

  it("returns text and html keys", () => {
    const out = billPayInstructions(baseInput);
    expect(typeof out.text).toBe("string");
    expect(typeof out.html).toBe("string");
    expect(out.text.length).toBeGreaterThan(0);
    expect(out.html.length).toBeGreaterThan(0);
  });

  it("text contains the formatted dollar amount", () => {
    const out = billPayInstructions(baseInput);
    expect(out.text).toContain("$135.00");
  });

  it("text and html include the memo", () => {
    const out = billPayInstructions(baseInput);
    expect(out.text).toContain("BGP-SUB-abc12345");
    expect(out.html).toContain("BGP-SUB-abc12345");
  });

  it("text and html include routing and account", () => {
    const out = billPayInstructions(baseInput);
    expect(out.text).toContain("021000021");
    expect(out.text).toContain("1234567890");
    expect(out.html).toContain("021000021");
    expect(out.html).toContain("1234567890");
  });

  it("text and html include the beneficiary name", () => {
    const out = billPayInstructions(baseInput);
    expect(out.text).toContain("Bench Grade Peptides LLC");
    expect(out.html).toContain("Bench Grade Peptides LLC");
  });

  it("text and html include the next charge date (ISO date)", () => {
    const out = billPayInstructions(baseInput);
    expect(out.text).toContain("2026-05-25");
    expect(out.html).toContain("2026-05-25");
  });

  it("html uses tables for layout (email-safe)", () => {
    const out = billPayInstructions(baseInput);
    expect(out.html).toContain("<table");
  });

  it("html uses bold labels and monospace for amounts/numbers", () => {
    const out = billPayInstructions(baseInput);
    // bold tag for labels
    expect(out.html.toLowerCase()).toMatch(/<(strong|b)>/);
    // monospace styling for numeric fields
    expect(out.html.toLowerCase()).toMatch(/font-family:[^;]*(monospace|courier)/);
  });

  it("html contains no web font imports (system fallbacks only)", () => {
    const out = billPayInstructions(baseInput);
    expect(out.html).not.toMatch(/@import/i);
    expect(out.html).not.toMatch(/fonts\.googleapis/i);
  });

  it("formats cents with 2 decimal places (e.g. 5 cents)", () => {
    const out = billPayInstructions({ ...baseInput, cycle_total_cents: 12005 });
    expect(out.text).toContain("$120.05");
  });
});
