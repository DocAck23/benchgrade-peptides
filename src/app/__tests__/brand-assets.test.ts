// Foundation acceptance gate (PRD §7): every v2 brand asset must be
// present at the expected path under /public/brand. Catches the case
// where extract-logo-variants.py was never run, or assets were
// accidentally deleted.
import { describe, it, expect } from "vitest";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { BRAND } from "../../lib/brand";

const PUBLIC = resolve(__dirname, "../../../public");

function assetExists(relPath: string): boolean {
  return existsSync(resolve(PUBLIC, relPath.replace(/^\//, "")));
}

describe("Foundation brand assets", () => {
  it("BRAND.logoMetallic file exists and has size > 0", () => {
    expect(assetExists(BRAND.logoMetallic)).toBe(true);
    const size = statSync(resolve(PUBLIC, BRAND.logoMetallic.replace(/^\//, ""))).size;
    expect(size).toBeGreaterThan(0);
  });

  it("BRAND.logoFlat file exists", () => {
    expect(assetExists(BRAND.logoFlat)).toBe(true);
  });

  it("BRAND.monogram file exists", () => {
    expect(assetExists(BRAND.monogram)).toBe(true);
  });

  it("each wordmark variant PNG is present", () => {
    for (const variant of ["gold", "wine", "red", "cream", "black"]) {
      expect(assetExists(`/brand/logo-${variant}.png`)).toBe(true);
    }
  });

  it("monogram variants present (gold for footer crest, wine + cream + mask for other surfaces)", () => {
    for (const v of ["gold", "wine", "cream", "mask"]) {
      expect(assetExists(`/brand/bg-monogram-${v}.png`)).toBe(true);
    }
  });

  it("Glacial Indifference woff2 files are committed", () => {
    expect(assetExists("/fonts/glacial-indifference/GlacialIndifference-Regular.woff2")).toBe(true);
    expect(assetExists("/fonts/glacial-indifference/GlacialIndifference-Bold.woff2")).toBe(true);
    expect(assetExists("/fonts/glacial-indifference/LICENSE.txt")).toBe(true);
  });
});
