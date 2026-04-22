/**
 * Bench Grade Peptides — catalog seed data.
 *
 * This is the authoritative static source for the catalog during development.
 * Once Supabase is provisioned, this will be loaded into the `products` and
 * `product_variants` tables via `scripts/seed-catalog.ts`.
 *
 * Sourcing: AgeREcode wholesale price list (PDF on disk), converted to
 * research-grade framing. Capsule / liquid / topical / blend / accessory
 * SKUs from the source list are intentionally excluded per the RUO compliance
 * framework §2 (lyophilized powder only).
 *
 * Retail pricing: 2.5–3.0× wholesale on most items, with specialty / thin-margin
 * SKUs priced above the category value-leaders. See memory/ruo_compliance_framework.md
 * and prior pricing analysis for rationale.
 *
 * Molecular data (MW, MF, CAS, sequence) is verified from peer-reviewed sources
 * where available. Fields marked with `null` are pending verification.
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

export interface CatalogVariant {
  size_mg: number;
  sku: string;
  wholesale_cost: number;
  retail_price: number;
}

export interface CatalogProduct {
  slug: string;
  name: string;
  category_slug: string;
  cas_number: string | null;
  molecular_formula: string | null;
  molecular_weight: number | null;
  sequence: string | null;
  /** Short research description — structure-function-free, no claims */
  summary: string;
  /** Longer research context with PubMed / DOI references */
  research_context: string | null;
  variants: CatalogVariant[];
}

export const CATEGORIES: readonly CatalogCategory[] = [
  {
    slug: "growth-hormone-secretagogues",
    name: "Growth hormone secretagogues",
    taxonomy_label: "GH axis research",
    description:
      "Compounds studied in the literature for their interaction with the growth hormone secretagogue receptor (GHSR) and somatotropic axis research.",
    sort_order: 1,
  },
  {
    slug: "tissue-repair",
    name: "Tissue-repair research peptides",
    taxonomy_label: "ECM / repair research",
    description:
      "Compounds investigated in tissue-remodeling and extracellular-matrix research models.",
    sort_order: 2,
  },
  {
    slug: "neuropeptides",
    name: "Neuropeptide research",
    taxonomy_label: "CNS research",
    description:
      "Compounds studied for their interaction with neuropeptide receptors and CNS research models.",
    sort_order: 3,
  },
  {
    slug: "metabolic",
    name: "Metabolic research",
    taxonomy_label: "Metabolic pathway research",
    description:
      "Compounds investigated in metabolic-pathway and energy-substrate research literature.",
    sort_order: 4,
  },
  {
    slug: "mitochondrial",
    name: "Mitochondrial & senescence research",
    taxonomy_label: "Mitochondrial / senescence research",
    description:
      "Compounds studied in mitochondrial bioenergetics and cellular-senescence research models.",
    sort_order: 5,
  },
  {
    slug: "hypothalamic",
    name: "Hypothalamic peptide research",
    taxonomy_label: "Hypothalamic axis research",
    description:
      "Compounds studied for their interaction with hypothalamic signaling pathways.",
    sort_order: 6,
  },
  {
    slug: "immunomodulatory",
    name: "Immunomodulatory research",
    taxonomy_label: "Immunological research",
    description:
      "Compounds investigated in immunological research and thymic-peptide literature.",
    sort_order: 7,
  },
  {
    slug: "glp-1",
    name: "GLP-1 class research compounds",
    taxonomy_label: "Incretin / GLP-1R research",
    description:
      "Compounds studied in GLP-1 receptor and incretin-pathway research.",
    sort_order: 8,
  },
  {
    slug: "other",
    name: "Other research compounds",
    taxonomy_label: "Miscellaneous research",
    description:
      "Research compounds studied across various literature domains.",
    sort_order: 9,
  },
] as const;

/**
 * Tier-1 launch catalog.
 *
 * These 15 products have full molecular-data detail for demo purposes. Phase 2
 * expansion will backfill the full ~60-SKU catalog from the AgeREcode source list.
 */
export const PRODUCTS: readonly CatalogProduct[] = [
  // --- Growth hormone secretagogues ---
  {
    slug: "cjc-1295-no-dac",
    name: "CJC-1295 (no DAC)",
    category_slug: "growth-hormone-secretagogues",
    cas_number: "863288-34-0",
    molecular_formula: "C152H252N44O42",
    molecular_weight: 3367.89,
    sequence: "Tyr-D-Ala-Asp-Ala-Ile-Phe-Thr-Gln-Ser-Tyr-Arg-Lys-Val-Leu-Ala-Gln-Leu-Ser-Ala-Arg-Lys-Leu-Leu-Gln-Asp-Ile-Leu-Ser-Arg-NH2",
    summary:
      "A 29-residue analog of growth hormone-releasing hormone (GHRH) with modifications at positions 2, 8, 15, and 27 for enhanced in vitro stability.",
    research_context:
      "Also known as Mod GRF 1-29. Referenced in GHRH receptor research literature as a stabilized GHRH analog. See Teichman et al., J Clin Endocrinol Metab (2006).",
    variants: [
      { size_mg: 5, sku: "BGP-CJC1295ND-5", wholesale_cost: 24.75, retail_price: 45.0 },
      { size_mg: 10, sku: "BGP-CJC1295ND-10", wholesale_cost: 51.0, retail_price: 85.0 },
    ],
  },
  {
    slug: "ipamorelin",
    name: "Ipamorelin",
    category_slug: "growth-hormone-secretagogues",
    cas_number: "170851-70-4",
    molecular_formula: "C38H49N9O5",
    molecular_weight: 711.85,
    sequence: "Aib-His-D-2-Nal-D-Phe-Lys-NH2",
    summary:
      "A pentapeptide studied as a selective ghrelin-receptor (GHSR) agonist in growth hormone secretagogue research.",
    research_context:
      "Reported to show selectivity for GH release without significant elevation of cortisol or prolactin in rodent and swine models. Raun et al., Eur J Endocrinol (1998).",
    variants: [
      { size_mg: 5, sku: "BGP-IPAM-5", wholesale_cost: 15.0, retail_price: 45.0 },
      { size_mg: 10, sku: "BGP-IPAM-10", wholesale_cost: 26.0, retail_price: 78.0 },
    ],
  },
  {
    slug: "sermorelin",
    name: "Sermorelin",
    category_slug: "growth-hormone-secretagogues",
    cas_number: "86168-78-7",
    molecular_formula: "C149H246N44O42S",
    molecular_weight: 3357.88,
    sequence: "Tyr-Ala-Asp-Ala-Ile-Phe-Thr-Asn-Ser-Tyr-Arg-Lys-Val-Leu-Gly-Gln-Leu-Ser-Ala-Arg-Lys-Leu-Leu-Gln-Asp-Ile-Met-Ser-Arg-NH2",
    summary:
      "The 29-residue active fragment of human GHRH (GRF 1-29). Studied as a reference GHRH-receptor agonist.",
    research_context:
      "Classical GHRH fragment used in pituitary research. Thorner et al., J Clin Invest (1988).",
    variants: [
      { size_mg: 5, sku: "BGP-SERM-5", wholesale_cost: 23.75, retail_price: 48.0 },
      { size_mg: 10, sku: "BGP-SERM-10", wholesale_cost: 37.0, retail_price: 88.0 },
    ],
  },
  {
    slug: "tesamorelin",
    name: "Tesamorelin",
    category_slug: "growth-hormone-secretagogues",
    cas_number: "901758-09-6",
    molecular_formula: "C170H286N44O46",
    molecular_weight: 5195.81,
    sequence: "(trans-3-hexenoyl)-Tyr-Ala-Asp-Ala-Ile-Phe-Thr-Asn-Ser-Tyr-Arg-Lys-Val-Leu-Gly-Gln-Leu-Ser-Ala-Arg-Lys-Leu-Leu-Gln-Asp-Ile-Met-Ser-Arg-NH2",
    summary:
      "A stabilized GHRH analog with N-terminal trans-3-hexenoyl modification. Studied in GHRH-receptor research.",
    research_context:
      "Ferdinandi et al., Basic Clin Pharmacol Toxicol (2007) — pharmacokinetics of the stabilized GHRH analog in rodent and primate models.",
    variants: [
      { size_mg: 5, sku: "BGP-TESA-5", wholesale_cost: 29.25, retail_price: 72.0 },
      { size_mg: 10, sku: "BGP-TESA-10", wholesale_cost: 55.5, retail_price: 135.0 },
    ],
  },
  // --- Tissue-repair research peptides ---
  {
    slug: "bpc-157",
    name: "BPC-157",
    category_slug: "tissue-repair",
    cas_number: "137525-51-0",
    molecular_formula: "C62H98N16O22",
    molecular_weight: 1419.55,
    sequence: "Gly-Glu-Pro-Pro-Pro-Gly-Lys-Pro-Ala-Asp-Asp-Ala-Gly-Leu-Val",
    summary:
      "A 15-residue synthetic pentadecapeptide derived from the sequence of a gastric protective protein. Studied extensively in rodent tissue-remodeling research literature.",
    research_context:
      "Widely referenced in gastric and connective-tissue research models. Sikiric et al., Curr Pharm Des (2013) — review of BPC 157 research literature.",
    variants: [
      { size_mg: 5, sku: "BGP-BPC157-5", wholesale_cost: 17.0, retail_price: 52.0 },
      { size_mg: 10, sku: "BGP-BPC157-10", wholesale_cost: 22.5, retail_price: 95.0 },
    ],
  },
  {
    slug: "tb-500",
    name: "TB-500 (Thymosin β-4 fragment)",
    category_slug: "tissue-repair",
    cas_number: "77591-33-4",
    molecular_formula: "C212H350N56O78S",
    molecular_weight: 4963.44,
    sequence: "Ac-Ser-Asp-Lys-Pro-Asp-Met-Ala-Glu-Ile-Glu-Lys-Phe-Asp-Lys-Ser-Lys-Leu-Lys-Lys-Thr-Glu-Thr-Gln-Glu-Lys-Asn-Pro-Leu-Pro-Ser-Lys-Glu-Thr-Ile-Glu-Gln-Glu-Lys-Gln-Ala-Gly-Glu-Ser",
    summary:
      "A 43-residue synthetic analog of the N-terminal fragment of thymosin β-4. Studied in actin-sequestration and extracellular-matrix research.",
    research_context:
      "Goldstein et al., Ann N Y Acad Sci (2012) — thymosin β-4 in tissue-research models.",
    variants: [
      { size_mg: 5, sku: "BGP-TB500-5", wholesale_cost: 28.0, retail_price: 78.0 },
      { size_mg: 10, sku: "BGP-TB500-10", wholesale_cost: 49.5, retail_price: 135.0 },
    ],
  },
  {
    slug: "ghk-cu",
    name: "GHK-Cu",
    category_slug: "tissue-repair",
    cas_number: "89030-95-5",
    molecular_formula: "C14H24CuN6O4",
    molecular_weight: 403.93,
    sequence: "Gly-His-Lys (copper complex)",
    summary:
      "A copper-binding tripeptide naturally present in human plasma. Studied in fibroblast and extracellular-matrix research.",
    research_context:
      "Pickart & Margolina, Int J Mol Sci (2018) — review of GHK-Cu research literature.",
    variants: [
      { size_mg: 50, sku: "BGP-GHKCU-50", wholesale_cost: 11.75, retail_price: 58.0 },
      { size_mg: 100, sku: "BGP-GHKCU-100", wholesale_cost: 14.75, retail_price: 88.0 },
    ],
  },
  {
    slug: "kpv",
    name: "KPV",
    category_slug: "tissue-repair",
    cas_number: "66199-06-2",
    molecular_formula: "C17H25N5O4",
    molecular_weight: 363.41,
    sequence: "Lys-Pro-Val",
    summary:
      "The C-terminal tripeptide of α-MSH. Studied in melanocortin-pathway and mucosal-research literature.",
    research_context:
      "Luger et al., Ann N Y Acad Sci (2003) — α-MSH C-terminal tripeptide research.",
    variants: [
      { size_mg: 5, sku: "BGP-KPV-5", wholesale_cost: 13.5, retail_price: 42.0 },
      { size_mg: 10, sku: "BGP-KPV-10", wholesale_cost: 17.0, retail_price: 58.0 },
    ],
  },
  // --- Neuropeptides ---
  {
    slug: "selank",
    name: "Selank",
    category_slug: "neuropeptides",
    cas_number: "129954-34-3",
    molecular_formula: "C33H57N11O9",
    molecular_weight: 751.88,
    sequence: "Thr-Lys-Pro-Arg-Pro-Gly-Pro",
    summary:
      "A synthetic heptapeptide analog of the immunomodulatory peptide tuftsin. Studied in CNS research literature in Russian and international journals.",
    research_context:
      "Semenova et al., Bull Exp Biol Med (2005) — neurochemical research with Selank analogs.",
    variants: [
      { size_mg: 5, sku: "BGP-SELK-5", wholesale_cost: 13.5, retail_price: 32.0 },
      { size_mg: 10, sku: "BGP-SELK-10", wholesale_cost: 22.5, retail_price: 55.0 },
    ],
  },
  {
    slug: "semax",
    name: "Semax",
    category_slug: "neuropeptides",
    cas_number: "80714-61-0",
    molecular_formula: "C37H51N9O10S",
    molecular_weight: 813.91,
    sequence: "Met-Glu-His-Phe-Pro-Gly-Pro",
    summary:
      "A synthetic heptapeptide fragment-analog of ACTH(4-10). Studied in CNS neuropeptide research.",
    research_context:
      "Kaplan et al., Neurosci Behav Physiol (2009) — Semax in CNS research models.",
    variants: [
      { size_mg: 5, sku: "BGP-SEMX-5", wholesale_cost: 12.5, retail_price: 30.0 },
      { size_mg: 10, sku: "BGP-SEMX-10", wholesale_cost: 20.25, retail_price: 48.0 },
    ],
  },
  {
    slug: "epitalon",
    name: "Epitalon",
    category_slug: "mitochondrial",
    cas_number: "307297-39-8",
    molecular_formula: "C14H22N4O9",
    molecular_weight: 390.35,
    sequence: "Ala-Glu-Asp-Gly",
    summary:
      "A synthetic tetrapeptide studied in pineal-gland and telomere research literature.",
    research_context:
      "Khavinson et al., Bull Exp Biol Med (2003) — Epitalon peptide research in cellular-aging models.",
    variants: [
      { size_mg: 10, sku: "BGP-EPIT-10", wholesale_cost: 17.0, retail_price: 48.0 },
      { size_mg: 50, sku: "BGP-EPIT-50", wholesale_cost: 49.5, retail_price: 140.0 },
    ],
  },
  {
    slug: "mots-c",
    name: "MOTS-c",
    category_slug: "mitochondrial",
    cas_number: "1627580-64-6",
    molecular_formula: "C78H113N21O19S",
    molecular_weight: 1712.02,
    sequence: "Met-Arg-Trp-Gln-Glu-Met-Gly-Tyr-Ile-Phe-Tyr-Pro-Arg-Lys-Leu-Arg",
    summary:
      "A 16-residue mitochondrial-derived peptide encoded in the 12S rRNA region of mitochondrial DNA. Studied in mitochondrial bioenergetics research.",
    research_context:
      "Lee et al., Cell Metab (2015) — original MOTS-c characterization in mitochondrial research.",
    variants: [
      { size_mg: 10, sku: "BGP-MOTSC-10", wholesale_cost: 24.75, retail_price: 85.0 },
      { size_mg: 40, sku: "BGP-MOTSC-40", wholesale_cost: 65.25, retail_price: 195.0 },
    ],
  },
  {
    slug: "thymosin-alpha-1",
    name: "Thymosin α-1",
    category_slug: "immunomodulatory",
    cas_number: "62304-98-7",
    molecular_formula: "C129H215N33O55",
    molecular_weight: 3108.32,
    sequence: "Ac-Ser-Asp-Ala-Ala-Val-Asp-Thr-Ser-Ser-Glu-Ile-Thr-Thr-Lys-Asp-Leu-Lys-Glu-Lys-Lys-Glu-Val-Val-Glu-Glu-Ala-Glu-Asn",
    summary:
      "A 28-residue thymic peptide. Studied in immunological research literature for thymic-peptide signaling.",
    research_context:
      "King & Tuthill, Semin Oncol (2018) — Thymosin α-1 in immunological research.",
    variants: [
      { size_mg: 5, sku: "BGP-TA1-5", wholesale_cost: 31.0, retail_price: 79.0 },
    ],
  },
  {
    slug: "pt-141",
    name: "PT-141 (Bremelanotide)",
    category_slug: "hypothalamic",
    cas_number: "189691-06-3",
    molecular_formula: "C50H68N14O10",
    molecular_weight: 1025.18,
    sequence: "Ac-Nle-cyclo[Asp-His-D-Phe-Arg-Trp-Lys]-OH",
    summary:
      "A cyclic heptapeptide analog of α-MSH. Studied in melanocortin-receptor research.",
    research_context:
      "Shadiack et al., J Pharmacol Exp Ther (2007) — melanocortin-receptor research with cyclic analogs.",
    variants: [
      { size_mg: 10, sku: "BGP-PT141-10", wholesale_cost: 24.0, retail_price: 58.0 },
    ],
  },
  {
    slug: "semaglutide",
    name: "Semaglutide",
    category_slug: "glp-1",
    cas_number: "910463-68-2",
    molecular_formula: "C187H291N45O59",
    molecular_weight: 4113.58,
    sequence: "His-Aib-Glu-Gly-Thr-Phe-Thr-Ser-Asp-Val-Ser-Ser-Tyr-Leu-Glu-Gly-Gln-Ala-Ala-Lys(γ-Glu-γ-Glu-C18-diacid)-Glu-Phe-Ile-Ala-Trp-Leu-Val-Arg-Gly-Arg-Gly",
    summary:
      "A lipidated 31-residue analog of GLP-1(7-37) with Aib substitution at position 8. Studied in GLP-1 receptor research.",
    research_context:
      "Lau et al., J Med Chem (2015) — original characterization of the lipidated GLP-1 analog.",
    variants: [
      { size_mg: 5, sku: "BGP-SEMA-5", wholesale_cost: 24.75, retail_price: 62.0 },
      { size_mg: 10, sku: "BGP-SEMA-10", wholesale_cost: 33.0, retail_price: 85.0 },
    ],
  },
] as const;

// ---- Accessor helpers ----

export function getCategoryBySlug(slug: string): CatalogCategory | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

export function getProductBySlug(slug: string): CatalogProduct | undefined {
  return PRODUCTS.find((p) => p.slug === slug);
}

export function getProductsByCategory(categorySlug: string): readonly CatalogProduct[] {
  return PRODUCTS.filter((p) => p.category_slug === categorySlug);
}

export function getMinPrice(product: CatalogProduct): number {
  return Math.min(...product.variants.map((v) => v.retail_price));
}

export function getMaxPrice(product: CatalogProduct): number {
  return Math.max(...product.variants.map((v) => v.retail_price));
}
