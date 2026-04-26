import { PRODUCTS, type CatalogProduct, type CatalogVariant } from "./data";

/**
 * Popular stacks — curated combinations of catalog SKUs that are
 * frequently bought together by repeat customers. Rendered on /catalog
 * as a "View popular stacks" section, each with an "Add stack to cart"
 * action that drops every line into the cart in one click.
 *
 * Stack contents reference live catalog SKUs only — if a SKU is removed
 * from the catalog, the resolveStack() helper drops the line and reports
 * a missing-line warning. No silent failures.
 *
 * Pricing: each stack's per-vial total is computed from current retail
 * prices. The Stack & Save engine still applies on top — adding a 3-vial
 * stack to an empty cart automatically unlocks the 15% off + free
 * shipping tier (per src/lib/cart/discounts.ts).
 */
export interface PopularStackLine {
  /** SKU of a single catalog variant. Must exist in PRODUCTS. */
  sku: string;
  /** Number of vials of this SKU to add to cart. */
  quantity: number;
}

export interface PopularStack {
  /** URL-friendly identifier. */
  slug: string;
  /** Display name — short, premium-coded. */
  name: string;
  /** One-line tagline that explains the stack at a glance. */
  tagline: string;
  /** 2-3 sentence "why this stack" — research framing, never therapeutic. */
  why: string;
  /** SKU + quantity tuples that compose the stack. */
  items: PopularStackLine[];
}

/**
 * Curated v1 popular stacks. Each uses class-coded names (BPC-157,
 * CJC-1295, etc.) and references actual catalog SKUs. No INNs leaked.
 *
 * Per spec §3, when 3+ vials land in cart Stack & Save automatically
 * unlocks 15% off + free domestic shipping — so every stack here gives
 * the customer a tier discount on top of the curation value.
 */
export const POPULAR_STACKS: PopularStack[] = [
  {
    slug: "wolverine-stack",
    name: "Wolverine Stack",
    tagline: "BPC-157 + TB-500 — the bench standard healing pair.",
    why: "BPC-157 and TB-500 are the two most-cited compounds in tissue-repair research. Studied together for synergistic effects on angiogenesis and ECM remodeling assays.",
    items: [
      { sku: "BGP-BPC-5", quantity: 1 },
      { sku: "BGP-TB-5", quantity: 1 },
    ],
  },
  {
    slug: "metabolic-pair",
    name: "Metabolic Pair",
    tagline: "GLP-1 S + AMY-A — incretin + amylin analog combination.",
    why: "Class-coded incretin and amylin analog studied together in metabolic-pathway research. Both ship with full identity on per-lot COA.",
    items: [
      { sku: "BGP-GLP1S-5", quantity: 1 },
      { sku: "BGP-AMYA-5", quantity: 1 },
    ],
  },
  {
    slug: "triple-agonist-gh",
    name: "Triple-Agonist + GH Pair",
    tagline: "GLP-3 R + Ipamorelin — incretin + GH-axis combination.",
    why: "Triple-receptor incretin agonist paired with a selective ghrelin receptor agonist. Used in cross-pathway metabolic + GH-axis research.",
    items: [
      { sku: "BGP-GLP3R-5", quantity: 1 },
      { sku: "BGP-IPA-5", quantity: 1 },
    ],
  },
  {
    slug: "gh-axis-stack",
    name: "GH-Axis Stack",
    tagline: "CJC-1295 + Ipamorelin — the GHRH/GHRP combination.",
    why: "Class-pairing of a GHRH analog with a selective ghrelin receptor agonist. The two arms of the GH-axis modeled in receptor-pathway studies.",
    items: [
      { sku: "BGP-CJC-5", quantity: 1 },
      { sku: "BGP-IPA-5", quantity: 1 },
    ],
  },
  {
    slug: "ghrh-pair",
    name: "GHRH Pair",
    tagline: "Sermorelin + Tesamorelin — comparative GHRH analog set.",
    why: "Two distinct GHRH analogs side-by-side for comparative receptor-pathway research. Useful for class-level pharmacology studies referencing endogenous GHRH.",
    items: [
      { sku: "BGP-SER-5", quantity: 1 },
      { sku: "BGP-TES-5", quantity: 1 },
    ],
  },
  {
    slug: "mega-recovery-stack",
    name: "Mega Recovery Stack",
    tagline: "GLP-3 R + Sermorelin + BPC-157 + TB-500 — four-vial cross-axis study set.",
    why: "Four-compound combination spanning incretin, GH-axis, and tissue-repair research arms. Designed for researchers running multi-pathway protocols who want a single bundled order.",
    items: [
      { sku: "BGP-GLP3R-5", quantity: 1 },
      { sku: "BGP-SER-5", quantity: 1 },
      { sku: "BGP-BPC-5", quantity: 1 },
      { sku: "BGP-TB-5", quantity: 1 },
    ],
  },
];

/**
 * Resolve a stack's lines against the live catalog. Drops any SKU that
 * has been removed and returns the resolved variants + the running
 * retail total in cents (pre-discount).
 */
export interface ResolvedPopularStack {
  stack: PopularStack;
  lines: Array<{
    line: PopularStackLine;
    product: CatalogProduct;
    variant: CatalogVariant;
  }>;
  /** Pre-discount retail total in cents. Stack & Save fires on top in cart. */
  retail_total_cents: number;
  /** SKUs from the stack that no longer exist in the catalog. */
  missing_skus: string[];
}

export function resolveStack(stack: PopularStack): ResolvedPopularStack {
  const lines: ResolvedPopularStack["lines"] = [];
  const missing: string[] = [];
  let total_cents = 0;
  for (const line of stack.items) {
    const product = PRODUCTS.find((p) => p.variants.some((v) => v.sku === line.sku));
    const variant = product?.variants.find((v) => v.sku === line.sku);
    if (!product || !variant) {
      missing.push(line.sku);
      continue;
    }
    lines.push({ line, product, variant });
    total_cents += Math.round(variant.retail_price * 100) * line.quantity;
  }
  return { stack, lines, retail_total_cents: total_cents, missing_skus: missing };
}

export function resolveAllStacks(): ResolvedPopularStack[] {
  return POPULAR_STACKS.map(resolveStack);
}
