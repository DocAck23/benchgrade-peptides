import { describe, it, expect } from "vitest";
import { PRODUCTS, CATEGORIES } from "../data";

/**
 * RUO compliance guard: oral capsules and oral supplements MUST NOT
 * appear in the public catalogue. Selling oral consumables under the
 * Research-Use-Only enforcement-discretion framing is the highest-risk
 * thing this storefront could do — capsules look like supplements,
 * read like supplements, and a regulator will treat them as
 * unapproved drugs the moment one ships.
 *
 * If this test fails, do NOT relax it — remove the offending SKU /
 * category instead. See `memory/supplier_and_catalog.md` for the
 * scope rule.
 */
describe("RUO catalogue scope — no oral consumables", () => {
  it("CATEGORIES does not include `capsules`", () => {
    expect(CATEGORIES.some((c) => c.slug === "capsules")).toBe(false);
  });

  it("PRODUCTS contains no capsule-bottle SKUs", () => {
    const capsuleProducts = PRODUCTS.filter(
      (p) => p.container === "capsule-bottle",
    );
    expect(capsuleProducts).toEqual([]);
  });

  it("PRODUCTS contains no SKUs categorised as `capsules`", () => {
    const inCapsuleCategory = PRODUCTS.filter(
      (p) => p.category_slug === "capsules",
    );
    expect(inCapsuleCategory).toEqual([]);
  });

  it("no product name implies an oral consumable form", () => {
    // Defensive: a product that's been miscategorised but is still
    // an oral consumable (capsule / softgel / lozenge / sublingual)
    // would slip past the structural checks above. Catch by name.
    const ORAL_HINT = /\b(capsule|softgel|lozenge|sublingual|oral)\b/i;
    const hits = PRODUCTS.filter((p) => ORAL_HINT.test(p.name));
    expect(hits).toEqual([]);
  });
});
