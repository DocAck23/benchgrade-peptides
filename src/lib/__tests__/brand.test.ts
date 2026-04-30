import { describe, expect, it } from "vitest";
import { BRAND } from "../brand";

describe("BRAND metadata", () => {
  it("identifies the company correctly", () => {
    expect(BRAND.name).toBe("Bench Grade Peptides");
    expect(BRAND.legalName).toBe("Bench Grade Peptides LLC");
    expect(BRAND.shortName).toBe("Bench Grade");
  });

  it("has the v2 tagline + description", () => {
    expect(BRAND.tagline).toBe("Synthesized in Tampa. Vialed in Orlando.");
    expect(BRAND.description).toMatch(/^Research-grade synthetic peptides\./);
    expect(BRAND.description).toMatch(/Synthesized in Tampa/);
    expect(BRAND.description).toMatch(/HPLC-verified per lot/);
    expect(BRAND.description).toMatch(/laboratory research use only/);
  });

  it("points at the v2 brand assets", () => {
    expect(BRAND.logoMetallic).toBe("/brand/logo-gold.png");
    expect(BRAND.logoFlat).toBe("/brand/logo-flat.svg");
    expect(BRAND.monogram).toBe("/brand/bg-monogram.svg");
  });

  it("preserves the lockup natural ratio (1709×441)", () => {
    expect(BRAND.logoWidth).toBe(1709);
    expect(BRAND.logoHeight).toBe(441);
  });

  it("encodes the US LLC address", () => {
    expect(BRAND.address.addressCountry).toBe("US");
    expect(BRAND.address.streetAddress).toBe("8 The Green");
    expect(BRAND.address.addressLocality).toBe("Dover");
    expect(BRAND.address.addressRegion).toBe("DE");
  });

  it("contact email is the public admin alias", () => {
    expect(BRAND.email).toBe("admin@benchgradepeptides.com");
  });

  // Snapshot lock — any change to the brand contract should require an explicit
  // snapshot update + diff review.
  it("matches the locked brand contract snapshot", () => {
    expect(BRAND).toMatchInlineSnapshot(`
      {
        "address": {
          "addressCountry": "US",
          "addressLocality": "Dover",
          "addressRegion": "DE",
          "postalCode": "19901",
          "streetAddress": "8 The Green",
        },
        "description": "Research-grade synthetic peptides. Synthesized in Tampa, vialed in Orlando, HPLC-verified per lot by an independent US laboratory. CoA on every vial. For laboratory research use only.",
        "email": "admin@benchgradepeptides.com",
        "legalName": "Bench Grade Peptides LLC",
        "logoFlat": "/brand/logo-flat.svg",
        "logoHeight": 441,
        "logoMetallic": "/brand/logo-gold.png",
        "logoWidth": 1709,
        "monogram": "/brand/bg-monogram.svg",
        "name": "Bench Grade Peptides",
        "ogImage": "/brand/og-default.png",
        "sameAs": [],
        "shortDescription": "HPLC-verified research peptides. Made in the United States.",
        "shortName": "Bench Grade",
        "tagline": "Synthesized in Tampa. Vialed in Orlando.",
      }
    `);
  });
});
