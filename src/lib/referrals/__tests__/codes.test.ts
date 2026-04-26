import { describe, it, expect } from "vitest";
import { generateReferralCode, validateReferralCode } from "../codes";

const CHARSET = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/;
const AMBIGUOUS = /[IO01]/;

describe("generateReferralCode (U-REF-1)", () => {
  it("generates codes 7-9 chars from the unambiguous charset", () => {
    for (let i = 0; i < 100; i++) {
      const code = generateReferralCode();
      expect(code.length).toBeGreaterThanOrEqual(7);
      expect(code.length).toBeLessThanOrEqual(9);
      expect(code).toMatch(CHARSET);
      expect(code).not.toMatch(AMBIGUOUS);
    }
  });

  it("uniqueness sanity over 1000 iterations (low collision rate)", () => {
    const seen = new Set<string>();
    let collisions = 0;
    for (let i = 0; i < 1000; i++) {
      const code = generateReferralCode();
      if (seen.has(code)) collisions++;
      seen.add(code);
    }
    // 32^7 ≈ 34 billion combos — collisions in 1000 iterations should be ~0.
    expect(collisions).toBeLessThan(2);
  });

  it("hits multiple lengths over many iterations", () => {
    const lengths = new Set<number>();
    for (let i = 0; i < 200; i++) lengths.add(generateReferralCode().length);
    // We expect to see at least 2 of {7,8,9} after 200 tries.
    expect(lengths.size).toBeGreaterThanOrEqual(2);
  });
});

describe("validateReferralCode (U-REF-2)", () => {
  it("accepts a generated code", () => {
    expect(validateReferralCode(generateReferralCode())).toBe(true);
  });

  it("accepts 4-char minimum", () => {
    expect(validateReferralCode("ABCD")).toBe(true);
  });

  it("accepts 8-char code", () => {
    expect(validateReferralCode("ABCDEFGH")).toBe(true);
  });

  it("accepts 12-char maximum", () => {
    expect(validateReferralCode("ABCDEFGH1234")).toBe(true);
  });

  it("rejects 3-char code (too short)", () => {
    expect(validateReferralCode("ABC")).toBe(false);
  });

  it("rejects 13-char code (too long)", () => {
    expect(validateReferralCode("ABCDEFGH12345")).toBe(false);
  });

  it("rejects lowercase", () => {
    expect(validateReferralCode("abcdefgh")).toBe(false);
  });

  it("rejects special chars", () => {
    expect(validateReferralCode("ABCD-EFG")).toBe(false);
    expect(validateReferralCode("ABCD EFG")).toBe(false);
    expect(validateReferralCode("ABCD!FG1")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(validateReferralCode("")).toBe(false);
  });
});
