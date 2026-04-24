import { describe, it, expect } from "vitest";
import { PRODUCTS, CATEGORIES, getMinPrice, getMaxPrice, getProductBySlug } from "../data";

describe("catalog — launch invariants", () => {
  it("has exactly 10 launch SKUs", () => {
    expect(PRODUCTS.length).toBe(10);
  });

  it("every product has exactly 3 pack tiers (1, 5, 10)", () => {
    for (const p of PRODUCTS) {
      expect(p.variants.length).toBe(3);
      const packSizes = p.variants.map((v) => v.pack_size).sort((a, b) => a - b);
      expect(packSizes).toEqual([1, 5, 10]);
    }
  });

  it("each variant has a unique SKU across the whole catalog", () => {
    const skus = PRODUCTS.flatMap((p) => p.variants.map((v) => v.sku));
    expect(new Set(skus).size).toBe(skus.length);
  });

  it("pricing is monotonically cheaper per-vial as pack size grows", () => {
    for (const p of PRODUCTS) {
      const byPack = [...p.variants].sort((a, b) => a.pack_size - b.pack_size);
      const [single, five, ten] = byPack;
      const pv = (v: typeof single) => v.retail_price / v.pack_size;
      expect(pv(single)).toBeGreaterThan(pv(five));
      expect(pv(five)).toBeGreaterThan(pv(ten));
    }
  });

  it("wholesale cost is strictly below retail at every tier", () => {
    for (const p of PRODUCTS) {
      for (const v of p.variants) {
        expect(v.wholesale_cost).toBeGreaterThan(0);
        expect(v.retail_price).toBeGreaterThan(v.wholesale_cost);
      }
    }
  });

  it("10-pack gross margin is at least 65% on every SKU", () => {
    for (const p of PRODUCTS) {
      const kit = p.variants.find((v) => v.pack_size === 10);
      if (!kit) throw new Error(`${p.slug} missing 10-pack`);
      const margin = (kit.retail_price - kit.wholesale_cost) / kit.retail_price;
      expect(margin).toBeGreaterThanOrEqual(0.65);
    }
  });

  it("every product references an existing category", () => {
    const catSlugs = new Set(CATEGORIES.map((c) => c.slug));
    for (const p of PRODUCTS) {
      expect(catSlugs.has(p.category_slug)).toBe(true);
    }
  });

  it("getMinPrice returns the lowest variant retail price", () => {
    for (const p of PRODUCTS) {
      const min = Math.min(...p.variants.map((v) => v.retail_price));
      expect(getMinPrice(p)).toBe(min);
    }
  });

  it("getMaxPrice returns the highest variant retail price", () => {
    for (const p of PRODUCTS) {
      const max = Math.max(...p.variants.map((v) => v.retail_price));
      expect(getMaxPrice(p)).toBe(max);
    }
  });

  it("getProductBySlug returns the right product or undefined", () => {
    for (const p of PRODUCTS) {
      expect(getProductBySlug(p.slug)?.slug).toBe(p.slug);
    }
    expect(getProductBySlug("not-a-real-slug")).toBeUndefined();
  });

  it("GLP-1 SKUs keep their coded names, never the underlying compound INN", () => {
    const glp = PRODUCTS.filter((p) => p.category_slug === "glp-1");
    expect(glp.length).toBeGreaterThan(0);
    for (const p of glp) {
      for (const forbidden of [
        "semaglutide",
        "tirzepatide",
        "retatrutide",
        "cagrilintide",
      ]) {
        expect(p.name.toLowerCase()).not.toContain(forbidden);
        expect(p.slug.toLowerCase()).not.toContain(forbidden);
        expect((p.summary ?? "").toLowerCase()).not.toContain(forbidden);
      }
    }
  });

  it("GLP-1 SKUs have null CAS / molecular formula / MW (coded-name compliance)", () => {
    const glp = PRODUCTS.filter((p) => p.category_slug === "glp-1");
    for (const p of glp) {
      expect(p.cas_number).toBeNull();
      expect(p.molecular_formula).toBeNull();
      expect(p.molecular_weight).toBeNull();
    }
  });

  it("every product has a dose_mg and it is positive", () => {
    for (const p of PRODUCTS) {
      expect(p.dose_mg).toBeGreaterThan(0);
    }
  });

  it("every variant has size_mg matching the product dose_mg (during launch: one dose per product)", () => {
    for (const p of PRODUCTS) {
      for (const v of p.variants) {
        expect(v.size_mg).toBe(p.dose_mg);
      }
    }
  });
});
