import { describe, it, expect } from "vitest";
import { PRODUCTS, CATEGORIES, getMinPrice, getMaxPrice, getProductBySlug } from "../data";

/**
 * Catalog invariants — updated 2026-04-25 to match the current multi-size
 * variant catalog (incretin-receptor-agonists / growth-hormone-axis / etc.).
 * The earlier "10 SKUs · 1/5/10 packs · one size per product · glp-1 slug"
 * regime is gone; assertions reflect what's actually shipping.
 */
describe("catalog — invariants", () => {
  it("ships at least 10 launch SKUs", () => {
    expect(PRODUCTS.length).toBeGreaterThanOrEqual(10);
  });

  it("every product has at least one variant", () => {
    for (const p of PRODUCTS) {
      expect(p.variants.length).toBeGreaterThan(0);
    }
  });

  it("each variant has a unique SKU across the whole catalog", () => {
    const skus = PRODUCTS.flatMap((p) => p.variants.map((v) => v.sku));
    expect(new Set(skus).size).toBe(skus.length);
  });

  it("wholesale cost is strictly below retail at every tier", () => {
    for (const p of PRODUCTS) {
      for (const v of p.variants) {
        expect(v.wholesale_cost).toBeGreaterThan(0);
        expect(v.retail_price).toBeGreaterThan(v.wholesale_cost);
      }
    }
  });

  it("every variant has gross margin of at least 50%", () => {
    for (const p of PRODUCTS) {
      for (const v of p.variants) {
        const margin = (v.retail_price - v.wholesale_cost) / v.retail_price;
        expect(margin).toBeGreaterThanOrEqual(0.5);
      }
    }
  });

  it("when a product has multi-size variants, $/mg drops as size grows", () => {
    for (const p of PRODUCTS) {
      const sized = [...p.variants].sort((a, b) => a.size_mg - b.size_mg);
      for (let i = 1; i < sized.length; i++) {
        const prev = sized[i - 1];
        const curr = sized[i];
        if (prev.size_mg === curr.size_mg) continue;
        const prevPerMg = prev.retail_price / prev.size_mg;
        const currPerMg = curr.retail_price / curr.size_mg;
        expect(currPerMg).toBeLessThanOrEqual(prevPerMg);
      }
    }
  });

  it("every variant has a positive size_mg", () => {
    for (const p of PRODUCTS) {
      for (const v of p.variants) {
        expect(v.size_mg).toBeGreaterThan(0);
      }
    }
  });

  it("every variant has a positive pack_size", () => {
    for (const p of PRODUCTS) {
      for (const v of p.variants) {
        expect(v.pack_size).toBeGreaterThan(0);
      }
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
});
