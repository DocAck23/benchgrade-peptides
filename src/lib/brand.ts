/**
 * Centralized brand metadata — single source of truth.
 *
 * Codex Review #1 (sub-project A · Foundation) flagged the brand description /
 * logo URL as duplicated across root metadata, page metadata, OpenGraph,
 * Twitter cards, JSON-LD, OG image generator, apple-icon, contact page, and
 * email templates. Touching one without the others left stale copy. This
 * module is the fix: every brand-meaning surface reads from `BRAND`.
 *
 * Editing this file is a brand-voice change — review the diff for SEO
 * impact (Schema.org, OpenGraph, Twitter cards all read from here).
 */
export const BRAND = {
  // Identity
  name: "Bench Grade Peptides",
  legalName: "Bench Grade Peptides LLC",
  shortName: "Bench Grade",

  // Brand voice — single source of truth for SEO + social cards
  tagline: "Synthesized in Tampa. Vialed in Orlando.",
  description:
    "Research-grade synthetic peptides. Synthesized in Tampa, vialed in Orlando, HPLC-verified per lot by an independent US laboratory. CoA on every vial. For laboratory research use only.",
  shortDescription:
    "HPLC-verified research peptides. Made in the United States.",

  // Asset paths (served from /public/brand)
  logoMetallic: "/brand/logo-gold.png",
  logoFlat: "/brand/logo-flat.svg",
  monogram: "/brand/bg-monogram.svg",
  ogImage: "/brand/og-default.png",

  // Lockup natural dimensions (used by next/image width/height defaults)
  logoWidth: 1709,
  logoHeight: 441,

  // Entity (used by Schema.org JSON-LD)
  address: {
    streetAddress: "8 The Green",
    addressLocality: "Dover",
    addressRegion: "DE",
    postalCode: "19901",
    addressCountry: "US",
  },
  email: "admin@benchgradepeptides.com",
  sameAs: [] as readonly string[],
} as const;

export type Brand = typeof BRAND;
