/**
 * Bench Grade Peptides — launch catalog.
 *
 * Scope (2026-04-24 launch lock): 10 SKUs, one dose per product, three
 * pack tiers per SKU (single vial / 5-pack / Inner Circle 10-pack).
 *
 *   - Traditional peptides (6): BPC-157, TB-500, CJC-1295 (no DAC),
 *     Ipamorelin, GHK-Cu, NAD+.
 *   - GLP-1 class (4): GLP-1 S, GLP-1 T, GLP-1 T Max, GLP-1 R. Coded
 *     names only; CAS / molecular-formula / MW nulled; class-level
 *     citations. The underlying INN appears nowhere in the public
 *     catalog text, slug, or asset name.
 *
 * Wholesale cost comes from the supplier's Inner Circle price list
 * (per 10-vial kit). Per-pack wholesale = kit_cost * (pack_size / 10).
 * Retail prices are set to produce ≥65% gross margin on every 10-pack
 * and a monotonically cheaper per-vial cost as pack size grows.
 *
 * Stack bundles, additional dose variants, and the GLOW/KLOW supplier
 * kits are deferred to phase 2 per the founder's 2026-04-24 direction.
 */

export interface CatalogCategory {
  slug: string;
  name: string;
  /** Internal MoA-based label used for categorization only — NOT a marketing claim */
  taxonomy_label: string;
  /** Structure-function-free description; scans clean through the banned-terms linter */
  description: string;
  sort_order: number;
}

/**
 * Variant = one pack-size offering of a product.
 *
 * Historical `size_mg` was the variant differentiator (different doses).
 * In the 2026-04-24 launch each product has ONE dose; pack_size is the
 * differentiator. size_mg is retained on the variant so every existing
 * cart / email / admin path that displays "5mg" keeps working — it
 * mirrors the product-level dose_mg on every variant.
 */
export interface CatalogVariant {
  size_mg: number;
  /** Vials in the pack: 1, 5, or 10. Inner Circle pricing = 10. */
  pack_size: number;
  sku: string;
  /** Supplier cost (USD) for the entire pack, not per vial. */
  wholesale_cost: number;
  /** Retail price (USD) for the entire pack, not per vial. */
  retail_price: number;
}

export interface CatalogProduct {
  slug: string;
  name: string;
  category_slug: string;
  /** Fixed dose for this product (mg per vial). One dose per product in launch scope. */
  dose_mg: number;
  cas_number: string | null;
  molecular_formula: string | null;
  molecular_weight: number | null;
  sequence: string | null;
  /** Short research description — structure-function-free, no claims */
  summary: string;
  /** Longer research context with PubMed / DOI references */
  research_context: string | null;
  /** Path (relative to /public) of the vial photograph for this SKU */
  vial_image: string;
  variants: CatalogVariant[];
}

export const CATEGORIES: readonly CatalogCategory[] = [
  {
    slug: "tissue-repair",
    name: "Tissue-repair research peptides",
    taxonomy_label: "ECM / repair research",
    description:
      "Compounds investigated in tissue-remodeling and extracellular-matrix research models.",
    sort_order: 1,
  },
  {
    slug: "growth-hormone-secretagogues",
    name: "Growth hormone secretagogues",
    taxonomy_label: "GH axis research",
    description:
      "Compounds studied in the literature for their interaction with the growth hormone secretagogue receptor (GHSR) and somatotropic axis research.",
    sort_order: 2,
  },
  {
    slug: "metabolic",
    name: "Metabolic research",
    taxonomy_label: "Metabolic pathway research",
    description:
      "Compounds investigated in metabolic-pathway and energy-substrate research literature.",
    sort_order: 3,
  },
  {
    slug: "glp-1",
    name: "GLP-1 class research compounds",
    taxonomy_label: "Incretin / GLP-1R research",
    description:
      "Compounds studied in GLP-1 receptor and incretin-pathway research. Coded designations used internally; underlying identities disclosed only on third-party Certificates of Analysis to verified customers.",
    sort_order: 4,
  },
] as const;

function vialPath(slug: string): string {
  return `/brand/vials/${slug}.jpg?v=3`;
}

/**
 * Build three pack-tier variants for a product.
 * Wholesale cost per pack = kitCost * (packSize / 10).
 */
function packTiers(
  sku_prefix: string,
  kit_wholesale: number,
  single_price: number,
  five_pack_price: number,
  ten_pack_price: number,
  size_mg: number
): CatalogVariant[] {
  return [
    {
      size_mg,
      pack_size: 1,
      sku: `${sku_prefix}-1`,
      wholesale_cost: Math.round((kit_wholesale * 0.1) * 100) / 100,
      retail_price: single_price,
    },
    {
      size_mg,
      pack_size: 5,
      sku: `${sku_prefix}-5`,
      wholesale_cost: Math.round((kit_wholesale * 0.5) * 100) / 100,
      retail_price: five_pack_price,
    },
    {
      size_mg,
      pack_size: 10,
      sku: `${sku_prefix}-10`,
      wholesale_cost: kit_wholesale,
      retail_price: ten_pack_price,
    },
  ];
}

/**
 * Launch catalog — 10 SKUs × 3 pack tiers = 30 variants.
 */
export const PRODUCTS: readonly CatalogProduct[] = [
  // ========== TISSUE REPAIR ==========
  {
    slug: "bpc-157",
    name: "BPC-157",
    category_slug: "tissue-repair",
    dose_mg: 10,
    cas_number: "137525-51-0",
    molecular_formula: "C62H98N16O22",
    molecular_weight: 1419.55,
    sequence: "Gly-Glu-Pro-Pro-Pro-Gly-Lys-Pro-Ala-Asp-Asp-Ala-Gly-Leu-Val",
    summary:
      "15-amino-acid synthetic pentadecapeptide derived from body-protection compound. Studied in tissue-repair and gastric-epithelium literature.",
    research_context:
      "Sikiric et al., J Physiol Pharmacol (2014). Gwyer, Wragg & Wilson, Cell Tissue Res (2019).",
    vial_image: vialPath("bpc-157"),
    variants: packTiers("BGP-BPC157-10", 97, 65, 275, 450, 10),
  },
  {
    slug: "tb-500",
    name: "TB-500",
    category_slug: "tissue-repair",
    dose_mg: 5,
    cas_number: "77591-33-4",
    molecular_formula: "C212H350N56O78S",
    molecular_weight: 4963.44,
    sequence: "N-Ac-SDKPDMAEIEKFDKSKLKKTETQEKNPLPSKETIEQEKQAGES",
    summary:
      "Synthetic acetylated analog of thymosin-β4 (1-43 fragment). Investigated in tissue-regeneration and angiogenesis literature.",
    research_context:
      "Goldstein et al., Ann NY Acad Sci (2012). Crockford et al., Ann NY Acad Sci (2010).",
    vial_image: vialPath("tb-500"),
    variants: packTiers("BGP-TB500-5", 131, 75, 325, 525, 5),
  },
  {
    slug: "ghk-cu",
    name: "GHK-Cu",
    category_slug: "tissue-repair",
    dose_mg: 50,
    cas_number: "89030-95-5",
    molecular_formula: "C14H24CuN6O4",
    molecular_weight: 403.93,
    sequence: "Gly-His-Lys (+ Cu²⁺)",
    summary:
      "Copper tripeptide-1 endogenous to human plasma. Studied in fibroblast, collagen-synthesis, and extracellular-matrix research.",
    research_context:
      "Pickart & Margolina, Biomed Res Int (2018). Pickart et al., Biochem J (1980).",
    vial_image: vialPath("ghk-cu"),
    variants: packTiers("BGP-GHKCU-50", 48, 40, 165, 245, 50),
  },

  // ========== GROWTH HORMONE SECRETAGOGUES ==========
  {
    slug: "cjc-1295-no-dac",
    name: "CJC-1295 (no DAC)",
    category_slug: "growth-hormone-secretagogues",
    dose_mg: 5,
    cas_number: "863288-34-0",
    molecular_formula: "C152H252N44O42",
    molecular_weight: 3367.89,
    sequence:
      "Tyr-D-Ala-Asp-Ala-Ile-Phe-Thr-Gln-Ser-Tyr-Arg-Lys-Val-Leu-Ala-Gln-Leu-Ser-Ala-Arg-Lys-Leu-Leu-Gln-Asp-Ile-Leu-Ser-Arg (Mod-GRF 1-29)",
    summary:
      "Modified GHRH analog (Mod-GRF 1-29), N-terminally capped without drug-affinity complex. Studied in growth-hormone-secretagogue pathway literature.",
    research_context:
      "Teichman et al., J Clin Endocrinol Metab (2006). Short half-life suits pulsatile GH-release research.",
    vial_image: vialPath("cjc-1295-no-dac"),
    variants: packTiers("BGP-CJC-5", 117, 60, 250, 395, 5),
  },
  {
    slug: "ipamorelin",
    name: "Ipamorelin",
    category_slug: "growth-hormone-secretagogues",
    dose_mg: 5,
    cas_number: "170851-70-4",
    molecular_formula: "C38H49N9O5",
    molecular_weight: 711.85,
    sequence: "Aib-His-D-2-Nal-D-Phe-Lys-NH2",
    summary:
      "Selective GHSR-1a agonist pentapeptide. Studied in growth-hormone release kinetics research without significant prolactin or cortisol elevation in reported models.",
    research_context:
      "Raun et al., Eur J Endocrinol (1998). Stacks with a GHRH analog for synergistic GH-pulse research.",
    vial_image: vialPath("ipamorelin"),
    variants: packTiers("BGP-IPA-5", 55, 45, 175, 275, 5),
  },

  // ========== METABOLIC ==========
  {
    slug: "nad-plus",
    name: "NAD+",
    category_slug: "metabolic",
    dose_mg: 500,
    cas_number: "53-84-9",
    molecular_formula: "C21H27N7O14P2",
    molecular_weight: 663.43,
    sequence: null,
    summary:
      "Nicotinamide adenine dinucleotide (oxidized form). Cellular redox cofactor studied in sirtuin, mitochondrial, and DNA-damage-repair research.",
    research_context:
      "Covarrubias et al., Nat Rev Mol Cell Biol (2021). Imai & Guarente, Trends Cell Biol (2014).",
    vial_image: vialPath("nad-plus"),
    variants: packTiers("BGP-NAD-500", 110, 65, 275, 425, 500),
  },

  // ========== GLP-1 CLASS (coded names only) ==========
  {
    slug: "glp1-s",
    name: "GLP-1 S",
    category_slug: "glp-1",
    dose_mg: 10,
    cas_number: null,
    molecular_formula: null,
    molecular_weight: null,
    sequence: null,
    summary:
      "GLP-1 receptor agonist — lipidated 31-residue peptide analog in the GLP-1 class. Full identity disclosed on the third-party Certificate of Analysis to verified customers.",
    research_context:
      "Drucker, Cell Metab (2018). Müller et al., Mol Metab (2019). Class-level GLP-1R pharmacology reviews.",
    vial_image: vialPath("glp1-s"),
    variants: packTiers("BGP-GLP1S-10", 76, 85, 350, 550, 10),
  },
  {
    slug: "glp1-t",
    name: "GLP-1 T",
    category_slug: "glp-1",
    dose_mg: 15,
    cas_number: null,
    molecular_formula: null,
    molecular_weight: null,
    sequence: null,
    summary:
      "Dual GIP / GLP-1 receptor agonist — 39-residue peptide analog. Full identity disclosed on the third-party Certificate of Analysis to verified customers.",
    research_context:
      "Drucker, Cell Metab (2018). Unimolecular dual-agonist pharmacology class reviews.",
    vial_image: vialPath("glp1-t"),
    variants: packTiers("BGP-GLP1T-15", 103, 105, 450, 725, 15),
  },
  {
    slug: "glp1-t-max",
    name: "GLP-1 T Max",
    category_slug: "glp-1",
    dose_mg: 30,
    cas_number: null,
    molecular_formula: null,
    molecular_weight: null,
    sequence: null,
    summary:
      "High-dose variant of the dual GIP / GLP-1 receptor agonist class compound. For longer-duration research protocols. Full identity disclosed on the third-party Certificate of Analysis to verified customers.",
    research_context:
      "Drucker, Cell Metab (2018). Unimolecular dual-agonist pharmacology class reviews.",
    vial_image: vialPath("glp1-t-max"),
    variants: packTiers("BGP-GLP1TMAX-30", 152, 145, 625, 975, 30),
  },
  {
    slug: "glp1-r",
    name: "GLP-1 R",
    category_slug: "glp-1",
    dose_mg: 10,
    cas_number: null,
    molecular_formula: null,
    molecular_weight: null,
    sequence: null,
    summary:
      "Triple-agonist peptide in the GLP-1 / GIP / glucagon receptor class. Full identity disclosed on the third-party Certificate of Analysis to verified customers.",
    research_context:
      "Drucker, Cell Metab (2018). Triple-agonist incretin pharmacology reviews.",
    vial_image: vialPath("glp1-r"),
    variants: packTiers("BGP-GLP1R-10", 138, 135, 575, 925, 10),
  },
];

// ---------- helpers ----------

export function getCategoryBySlug(slug: string): CatalogCategory | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

export function getProductBySlug(slug: string): CatalogProduct | undefined {
  return PRODUCTS.find((p) => p.slug === slug);
}

export function getMinPrice(product: CatalogProduct): number {
  return Math.min(...product.variants.map((v) => v.retail_price));
}

export function getMaxPrice(product: CatalogProduct): number {
  return Math.max(...product.variants.map((v) => v.retail_price));
}

/** Per-vial retail price for a given variant. */
export function perVialPrice(variant: CatalogVariant): number {
  return variant.retail_price / variant.pack_size;
}

/**
 * Legacy export kept for compatibility with any downstream import.
 * In the new pack-tier model there's no separate quantity selector;
 * quantity on cart = number of PACKS of the chosen variant (typically 1).
 */
export const QUANTITY_TIERS: readonly number[] = [1] as const;
