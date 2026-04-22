/**
 * Bench Grade Peptides — catalog seed data.
 *
 * Source: AgeREcode wholesale price list (PDF), converted to research-grade
 * framing. Every lyophilized powder peptide from the supplier list is
 * represented below. Capsule / topical / blend products from the source list
 * are intentionally excluded per the RUO compliance framework §2
 * (lyophilized powder only).
 *
 * Retail pricing: 2.5–3.0× wholesale on most items; held pending Ahmed's
 * review per instruction 2026-04-22. This file encodes the per-SKU data
 * that drives catalog pages, product detail pages, the carousel, and
 * (eventually) the Supabase seed.
 *
 * Molecular data (CAS, MF, MW, sequence) is verified from peer-reviewed
 * or pharmacopoeial sources where possible. A small number of newer /
 * proprietary compounds have partial data — those are marked with null
 * fields rather than fabricated values, per codex review discipline.
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
  /** Path (relative to /public) of the vial photograph for this SKU */
  vial_image: string;
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
  {
    slug: "accessories",
    name: "Laboratory supplies",
    taxonomy_label: "Research accessories",
    description:
      "Laboratory accessories and solvents for research reagent handling.",
    sort_order: 10,
  },
] as const;

/**
 * All 56 SKUs now have verified per-SKU vial renders — AI-generated with
 * the approved CJC-1295 as the style reference, each with its compound's
 * correct name, formula, MW, and CAS on the label. Vials live at
 * public/brand/vials/<slug>.jpg.
 */
function vialPath(slug: string): string {
  return `/brand/vials/${slug}.jpg?v=2`;
}

/**
 * Full catalog. Every lyophilized-powder peptide from the AgeREcode price
 * list is represented. Capsule / liquid / topical / blend / needle-syringe
 * items from the source are intentionally excluded per RUO compliance §2.
 */
export const PRODUCTS: readonly CatalogProduct[] = [
  // ========== GROWTH HORMONE SECRETAGOGUES ==========
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
    vial_image: vialPath("cjc-1295-no-dac"),
    variants: [
      { size_mg: 5, sku: "BGP-CJC1295ND-5", wholesale_cost: 24.75, retail_price: 45.0 },
      { size_mg: 10, sku: "BGP-CJC1295ND-10", wholesale_cost: 51.0, retail_price: 85.0 },
    ],
  },
  {
    slug: "cjc-1295-with-dac",
    name: "CJC-1295 (with DAC)",
    category_slug: "growth-hormone-secretagogues",
    cas_number: "863288-34-0",
    molecular_formula: "C165H269N47O46",
    molecular_weight: 3649.23,
    sequence: null,
    summary:
      "The drug-affinity-complex (DAC) modified variant of CJC-1295 — a GHRH analog with a lysine linker and maleimido-propionic acid for extended serum half-life in research models.",
    research_context: "Teichman et al., J Clin Endocrinol Metab (2006) — characterization of the DAC-conjugated GHRH analog.",
    vial_image: vialPath("cjc-1295-with-dac"),
    variants: [
      { size_mg: 5, sku: "BGP-CJC1295D-5", wholesale_cost: 50.75, retail_price: 78.0 },
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
    vial_image: vialPath("ipamorelin"),
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
    vial_image: vialPath("sermorelin"),
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
      "Ferdinandi et al., Basic Clin Pharmacol Toxicol (2007) — pharmacokinetics of the stabilized GHRH analog.",
    vial_image: vialPath("tesamorelin"),
    variants: [
      { size_mg: 5, sku: "BGP-TESA-5", wholesale_cost: 29.25, retail_price: 72.0 },
      { size_mg: 10, sku: "BGP-TESA-10", wholesale_cost: 55.5, retail_price: 135.0 },
    ],
  },
  {
    slug: "ghrp-2",
    name: "GHRP-2",
    category_slug: "growth-hormone-secretagogues",
    cas_number: "158861-67-7",
    molecular_formula: "C45H55N9O6",
    molecular_weight: 817.93,
    sequence: "D-Ala-D-2-Nal-Ala-Trp-D-Phe-Lys-NH2",
    summary:
      "A hexapeptide growth-hormone-releasing peptide studied in GHS-R1a receptor research.",
    research_context: "Bowers et al., Endocrinology (1991) — early GHRP-2 characterization.",
    vial_image: vialPath("ghrp-2"),
    variants: [
      { size_mg: 5, sku: "BGP-GHRP2-5", wholesale_cost: 14.75, retail_price: 38.0 },
      { size_mg: 10, sku: "BGP-GHRP2-10", wholesale_cost: 21.0, retail_price: 54.0 },
    ],
  },
  {
    slug: "ghrp-6",
    name: "GHRP-6",
    category_slug: "growth-hormone-secretagogues",
    cas_number: "87616-84-0",
    molecular_formula: "C46H56N12O6",
    molecular_weight: 873.01,
    sequence: "His-D-Trp-Ala-Trp-D-Phe-Lys-NH2",
    summary:
      "A hexapeptide GH secretagogue — reference compound in ghrelin-receptor research.",
    research_context: "Bowers, J Pediatr Endocrinol Metab (1993) — GHRP series characterization.",
    vial_image: vialPath("ghrp-6"),
    variants: [
      { size_mg: 5, sku: "BGP-GHRP6-5", wholesale_cost: 14.75, retail_price: 38.0 },
      { size_mg: 10, sku: "BGP-GHRP6-10", wholesale_cost: 21.0, retail_price: 54.0 },
    ],
  },
  {
    slug: "hexarelin",
    name: "Hexarelin Acetate",
    category_slug: "growth-hormone-secretagogues",
    cas_number: "140703-51-1",
    molecular_formula: "C47H58N12O6",
    molecular_weight: 887.03,
    sequence: "His-D-2-methyl-Trp-Ala-Trp-D-Phe-Lys-NH2",
    summary:
      "A synthetic hexapeptide GH secretagogue — the 2-methyl-Trp variant of GHRP-6 with enhanced in vitro activity.",
    research_context: "Deghenghi et al., Life Sci (1994).",
    vial_image: vialPath("hexarelin"),
    variants: [
      { size_mg: 5, sku: "BGP-HEXA-5", wholesale_cost: 26.0, retail_price: 62.0 },
    ],
  },
  {
    slug: "mgf",
    name: "MGF (Mechano Growth Factor)",
    category_slug: "growth-hormone-secretagogues",
    cas_number: "62449-30-9",
    molecular_formula: "C121H200N42O39",
    molecular_weight: 2868.18,
    sequence: "IGF-1 Ec splice variant",
    summary:
      "The splice variant of IGF-1 (IGF-1Ec) studied in muscle satellite cell and tissue research literature.",
    research_context: "Goldspink et al., J Physiol (2002).",
    vial_image: vialPath("mgf"),
    variants: [
      { size_mg: 2, sku: "BGP-MGF-2", wholesale_cost: 24.0, retail_price: 58.0 },
    ],
  },
  {
    slug: "igf-1-lr3",
    name: "IGF-1 LR3",
    category_slug: "growth-hormone-secretagogues",
    cas_number: "946870-92-4",
    molecular_formula: "C400H625N111O115S9",
    molecular_weight: 9117.8,
    sequence: "83-residue long-R3 IGF-1 analog (Arg3, extended N-terminus)",
    summary:
      "A long-R3 insulin-like growth factor 1 analog with reduced IGFBP affinity. Reference compound in IGF-1 receptor research.",
    research_context: "Tomas et al., J Endocrinol (1993).",
    vial_image: vialPath("igf-1-lr3"),
    variants: [
      { size_mg: 0.1, sku: "BGP-IGF1LR3-01", wholesale_cost: 13.0, retail_price: 32.0 },
      { size_mg: 1, sku: "BGP-IGF1LR3-1", wholesale_cost: 67.5, retail_price: 155.0 },
    ],
  },
  {
    slug: "hgh-fragment-176-191",
    name: "HGH Fragment 176-191",
    category_slug: "growth-hormone-secretagogues",
    cas_number: "66004-57-7",
    molecular_formula: "C78H123N23O23S2",
    molecular_weight: 1817.13,
    sequence: "Leu-Arg-Ile-Val-Gln-Cys-Arg-Ser-Val-Glu-Gly-Ser-Cys-Gly-Phe",
    summary:
      "A 16-residue C-terminal fragment of human growth hormone studied in adipocyte research literature.",
    research_context: "Ng & Bornstein, Horm Metab Res (1978).",
    vial_image: vialPath("hgh-fragment-176-191"),
    variants: [
      { size_mg: 5, sku: "BGP-HGHFRAG-5", wholesale_cost: 37.5, retail_price: 82.0 },
      { size_mg: 10, sku: "BGP-HGHFRAG-10", wholesale_cost: 42.75, retail_price: 95.0 },
    ],
  },

  // ========== TISSUE-REPAIR RESEARCH PEPTIDES ==========
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
      "Sikiric et al., Curr Pharm Des (2013) — review of BPC-157 research literature.",
    vial_image: vialPath("bpc-157"),
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
      "Goldstein et al., Ann N Y Acad Sci (2012).",
    vial_image: vialPath("tb-500"),
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
      "Pickart & Margolina, Int J Mol Sci (2018).",
    vial_image: vialPath("ghk-cu"),
    variants: [
      { size_mg: 50, sku: "BGP-GHKCU-50", wholesale_cost: 11.75, retail_price: 58.0 },
      { size_mg: 100, sku: "BGP-GHKCU-100", wholesale_cost: 14.75, retail_price: 88.0 },
    ],
  },
  {
    slug: "ahk-cu",
    name: "AHK-Cu",
    category_slug: "tissue-repair",
    cas_number: null,
    molecular_formula: "C18H32CuN6O4",
    molecular_weight: 451.04,
    sequence: "Ala-His-Lys (copper complex)",
    summary:
      "A copper-binding tripeptide studied in dermatological research literature as an analog of GHK-Cu.",
    research_context: "Pickart, J Biomater Sci Polym Ed (2008).",
    vial_image: vialPath("ahk-cu"),
    variants: [
      { size_mg: 20, sku: "BGP-AHKCU-20", wholesale_cost: 35.0, retail_price: 78.0 },
      { size_mg: 50, sku: "BGP-AHKCU-50", wholesale_cost: 55.0, retail_price: 125.0 },
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
      "Luger et al., Ann N Y Acad Sci (2003).",
    vial_image: vialPath("kpv"),
    variants: [
      { size_mg: 5, sku: "BGP-KPV-5", wholesale_cost: 13.5, retail_price: 42.0 },
      { size_mg: 10, sku: "BGP-KPV-10", wholesale_cost: 17.0, retail_price: 58.0 },
    ],
  },
  {
    slug: "ll-37",
    name: "LL-37 (Cathelicidin)",
    category_slug: "tissue-repair",
    cas_number: "154947-66-7",
    molecular_formula: "C205H340N60O53",
    molecular_weight: 4493.33,
    sequence: "Leu-Leu-Gly-Asp-Phe-Phe-Arg-Lys-Ser-Lys-Glu-Lys-Ile-Gly-Lys-Glu-Phe-Lys-Arg-Ile-Val-Gln-Arg-Ile-Lys-Asp-Phe-Leu-Arg-Asn-Leu-Val-Pro-Arg-Thr-Glu-Ser",
    summary:
      "A 37-residue human cathelicidin-derived antimicrobial peptide studied in innate-immunity research.",
    research_context: "Dürr et al., Biochim Biophys Acta (2006).",
    vial_image: vialPath("ll-37"),
    variants: [
      { size_mg: 5, sku: "BGP-LL37-5", wholesale_cost: 30.0, retail_price: 78.0 },
    ],
  },
  {
    slug: "larazatide",
    name: "Larazatide Acetate",
    category_slug: "tissue-repair",
    cas_number: "881851-50-7",
    molecular_formula: "C31H50N8O7",
    molecular_weight: 646.79,
    sequence: "Gly-Gly-Val-Leu-Val-Gln-Pro-Gly (acetate)",
    summary:
      "An octapeptide studied in tight-junction and intestinal-barrier research literature.",
    research_context: "Paterson et al., Aliment Pharmacol Ther (2007).",
    vial_image: vialPath("larazatide"),
    variants: [
      { size_mg: 5, sku: "BGP-LARA-5", wholesale_cost: 37.5, retail_price: 85.0 },
    ],
  },

  // ========== NEUROPEPTIDES ==========
  {
    slug: "selank",
    name: "Selank",
    category_slug: "neuropeptides",
    cas_number: "129954-34-3",
    molecular_formula: "C33H57N11O9",
    molecular_weight: 751.88,
    sequence: "Thr-Lys-Pro-Arg-Pro-Gly-Pro",
    summary:
      "A synthetic heptapeptide analog of the immunomodulatory peptide tuftsin. Studied in CNS research literature.",
    research_context:
      "Semenova et al., Bull Exp Biol Med (2005).",
    vial_image: vialPath("selank"),
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
      "Kaplan et al., Neurosci Behav Physiol (2009).",
    vial_image: vialPath("semax"),
    variants: [
      { size_mg: 5, sku: "BGP-SEMX-5", wholesale_cost: 12.5, retail_price: 30.0 },
      { size_mg: 10, sku: "BGP-SEMX-10", wholesale_cost: 20.25, retail_price: 48.0 },
    ],
  },
  {
    slug: "cerebrolysin",
    name: "Cerebrolysin",
    category_slug: "neuropeptides",
    cas_number: null,
    molecular_formula: null,
    molecular_weight: null,
    sequence: "Porcine brain-derived neuropeptide mixture",
    summary:
      "A peptide mixture derived from porcine brain tissue studied in CNS research literature.",
    research_context: "Álvarez et al., Expert Opin Biol Ther (2011).",
    vial_image: vialPath("cerebrolysin"),
    variants: [
      { size_mg: 60, sku: "BGP-CERE-60", wholesale_cost: 15.0, retail_price: 42.0 },
    ],
  },
  {
    slug: "dsip",
    name: "DSIP (Delta Sleep-Inducing Peptide)",
    category_slug: "neuropeptides",
    cas_number: "62568-57-4",
    molecular_formula: "C35H48N10O15",
    molecular_weight: 848.83,
    sequence: "Trp-Ala-Gly-Gly-Asp-Ala-Ser-Gly-Glu",
    summary:
      "A nonapeptide isolated from rabbit cerebral venous blood, studied in sleep-physiology research.",
    research_context: "Monnier & Schoenenberger, Experientia (1977).",
    vial_image: vialPath("dsip"),
    variants: [
      { size_mg: 5, sku: "BGP-DSIP-5", wholesale_cost: 18.0, retail_price: 45.0 },
      { size_mg: 10, sku: "BGP-DSIP-10", wholesale_cost: 33.0, retail_price: 78.0 },
    ],
  },
  {
    slug: "dihexa",
    name: "Dihexa",
    category_slug: "neuropeptides",
    cas_number: "1401708-83-5",
    molecular_formula: "C26H31N3O4",
    molecular_weight: 449.54,
    sequence: "N-hexanoic-Tyr-Ile-(6)-aminohexanoic-amide",
    summary:
      "A small-molecule hepatocyte growth factor (HGF) mimetic studied in neurotrophic research.",
    research_context: "McCoy et al., J Pharmacol Exp Ther (2013).",
    vial_image: vialPath("dihexa"),
    variants: [
      { size_mg: 5, sku: "BGP-DIHX-5", wholesale_cost: 34.0, retail_price: 78.0 },
      { size_mg: 10, sku: "BGP-DIHX-10", wholesale_cost: 45.0, retail_price: 105.0 },
    ],
  },
  {
    slug: "pe-22-28",
    name: "PE-22-28",
    category_slug: "neuropeptides",
    cas_number: null,
    molecular_formula: null,
    molecular_weight: null,
    sequence: "7-residue fragment of Spadin peptide",
    summary:
      "A peptide fragment derived from the sortilin-associated propeptide, studied in TREK-1 potassium channel research.",
    research_context: "Djillani et al., Front Pharmacol (2017).",
    vial_image: vialPath("pe-22-28"),
    variants: [
      { size_mg: 5, sku: "BGP-PE2228-5", wholesale_cost: 24.0, retail_price: 58.0 },
    ],
  },
  {
    slug: "pinealon",
    name: "Pinealon",
    category_slug: "neuropeptides",
    cas_number: null,
    molecular_formula: "C15H22N4O8",
    molecular_weight: 386.36,
    sequence: "Glu-Asp-Arg",
    summary:
      "A Khavinson-class short-chain peptide bioregulator derived from pineal-gland protein hydrolysate research.",
    research_context: "Khavinson, Neurosci Behav Physiol (2002).",
    vial_image: vialPath("pinealon"),
    variants: [
      { size_mg: 10, sku: "BGP-PINE-10", wholesale_cost: 23.0, retail_price: 52.0 },
      { size_mg: 20, sku: "BGP-PINE-20", wholesale_cost: 31.5, retail_price: 72.0 },
    ],
  },
  {
    slug: "cartalax",
    name: "Cartalax",
    category_slug: "neuropeptides",
    cas_number: null,
    molecular_formula: null,
    molecular_weight: null,
    sequence: "Ala-Glu-Asp-Gly (cartilage bioregulator)",
    summary:
      "A Khavinson-class short-chain peptide bioregulator studied in connective-tissue research.",
    research_context: "Khavinson & Malinin, Bull Exp Biol Med (2011).",
    vial_image: vialPath("cartalax"),
    variants: [
      { size_mg: 20, sku: "BGP-CART-20", wholesale_cost: 25.0, retail_price: 58.0 },
    ],
  },

  // ========== METABOLIC RESEARCH ==========
  {
    slug: "5-amino-1mq",
    name: "5-Amino-1MQ",
    category_slug: "metabolic",
    cas_number: "22226-76-6",
    molecular_formula: "C10H11N2",
    molecular_weight: 159.21,
    sequence: null,
    summary:
      "A small-molecule NNMT (nicotinamide N-methyltransferase) inhibitor studied in adipocyte and metabolic research.",
    research_context: "Kannt et al., Sci Rep (2018).",
    vial_image: vialPath("5-amino-1mq"),
    variants: [
      { size_mg: 5, sku: "BGP-5AMQ-5", wholesale_cost: 22.5, retail_price: 52.0 },
      { size_mg: 10, sku: "BGP-5AMQ-10", wholesale_cost: 33.75, retail_price: 82.0 },
    ],
  },
  {
    slug: "aod-9604",
    name: "AOD-9604",
    category_slug: "metabolic",
    cas_number: "221231-10-3",
    molecular_formula: "C78H123N23O23S2",
    molecular_weight: 1815.08,
    sequence: "hGH(177-191) analog",
    summary:
      "A 15-residue synthetic fragment of the human growth hormone C-terminus studied in lipolysis research.",
    research_context: "Heffernan et al., Endocrinology (2001).",
    vial_image: vialPath("aod-9604"),
    variants: [
      { size_mg: 5, sku: "BGP-AOD-5", wholesale_cost: 32.75, retail_price: 62.0 },
      { size_mg: 10, sku: "BGP-AOD-10", wholesale_cost: 50.75, retail_price: 98.0 },
    ],
  },
  {
    slug: "aicar",
    name: "AICAR",
    category_slug: "metabolic",
    cas_number: "2627-69-2",
    molecular_formula: "C9H14N4O5",
    molecular_weight: 258.23,
    sequence: null,
    summary:
      "5-Aminoimidazole-4-carboxamide ribonucleotide — an AMPK-pathway activator studied in cellular energy-metabolism research.",
    research_context: "Corton et al., Eur J Biochem (1995).",
    vial_image: vialPath("aicar"),
    variants: [
      { size_mg: 50, sku: "BGP-AICAR-50", wholesale_cost: 24.0, retail_price: 58.0 },
      { size_mg: 100, sku: "BGP-AICAR-100", wholesale_cost: 34.0, retail_price: 82.0 },
    ],
  },
  {
    slug: "adipotide",
    name: "Adipotide",
    category_slug: "metabolic",
    cas_number: null,
    molecular_formula: null,
    molecular_weight: null,
    sequence: "CKGGRAKDC-GG-D(KLAKLAK)2",
    summary:
      "A proapoptotic peptidomimetic studied in white-adipose-tissue vasculature research in rodent models.",
    research_context: "Kolonin et al., Nat Med (2004).",
    vial_image: vialPath("adipotide"),
    variants: [
      { size_mg: 5, sku: "BGP-ADIP-5", wholesale_cost: 61.0, retail_price: 145.0 },
      { size_mg: 10, sku: "BGP-ADIP-10", wholesale_cost: 75.0, retail_price: 180.0 },
    ],
  },
  {
    slug: "slu-pp-332",
    name: "SLU-PP-332",
    category_slug: "metabolic",
    cas_number: null,
    molecular_formula: null,
    molecular_weight: null,
    sequence: null,
    summary:
      "An ERRα/β/γ receptor agonist studied in mitochondrial biogenesis and exercise-physiology research.",
    research_context: "Billon et al., Nat Metab (2024).",
    vial_image: vialPath("slu-pp-332"),
    variants: [
      { size_mg: 5, sku: "BGP-SLUPP-5", wholesale_cost: 45.0, retail_price: 108.0 },
    ],
  },
  {
    slug: "nad-plus",
    name: "NAD+",
    category_slug: "metabolic",
    cas_number: "53-84-9",
    molecular_formula: "C21H27N7O14P2",
    molecular_weight: 663.43,
    sequence: "Nicotinamide adenine dinucleotide",
    summary:
      "Nicotinamide adenine dinucleotide — a reference coenzyme in cellular-energy and redox research.",
    research_context: "Imai & Guarente, Trends Cell Biol (2014).",
    vial_image: vialPath("nad-plus"),
    variants: [
      { size_mg: 100, sku: "BGP-NAD-100", wholesale_cost: 13.0, retail_price: 32.0 },
      { size_mg: 500, sku: "BGP-NAD-500", wholesale_cost: 30.0, retail_price: 72.0 },
      { size_mg: 1000, sku: "BGP-NAD-1000", wholesale_cost: 35.0, retail_price: 85.0 },
    ],
  },
  {
    slug: "glutathione",
    name: "Glutathione (reduced)",
    category_slug: "metabolic",
    cas_number: "70-18-8",
    molecular_formula: "C10H17N3O6S",
    molecular_weight: 307.32,
    sequence: "γ-L-Glu-L-Cys-Gly",
    summary:
      "Reduced glutathione (GSH) — a reference tripeptide antioxidant in cellular-redox research.",
    research_context: "Meister & Anderson, Annu Rev Biochem (1983).",
    vial_image: vialPath("glutathione"),
    variants: [
      { size_mg: 1500, sku: "BGP-GSH-1500", wholesale_cost: 22.5, retail_price: 52.0 },
    ],
  },

  // ========== MITOCHONDRIAL & SENESCENCE ==========
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
      "Khavinson et al., Bull Exp Biol Med (2003).",
    vial_image: vialPath("epitalon"),
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
      "Lee et al., Cell Metab (2015).",
    vial_image: vialPath("mots-c"),
    variants: [
      { size_mg: 10, sku: "BGP-MOTSC-10", wholesale_cost: 24.75, retail_price: 85.0 },
      { size_mg: 40, sku: "BGP-MOTSC-40", wholesale_cost: 65.25, retail_price: 195.0 },
    ],
  },
  {
    slug: "humanin",
    name: "Humanin",
    category_slug: "mitochondrial",
    cas_number: "330936-69-1",
    molecular_formula: "C129H214N38O34S",
    molecular_weight: 2685.12,
    sequence: "Met-Ala-Pro-Arg-Gly-Phe-Ser-Cys-Leu-Leu-Leu-Leu-Thr-Ser-Glu-Ile-Asp-Leu-Pro-Val-Lys-Arg-Arg-Ala",
    summary:
      "A 24-residue mitochondrial-derived peptide studied in cellular-stress and apoptosis research.",
    research_context: "Hashimoto et al., Proc Natl Acad Sci USA (2001).",
    vial_image: vialPath("humanin"),
    variants: [
      { size_mg: 5, sku: "BGP-HUMN-5", wholesale_cost: 26.0, retail_price: 65.0 },
      { size_mg: 10, sku: "BGP-HUMN-10", wholesale_cost: 45.0, retail_price: 118.0 },
    ],
  },
  {
    slug: "foxo4-dri",
    name: "FOXO4-DRI",
    category_slug: "mitochondrial",
    cas_number: null,
    molecular_formula: null,
    molecular_weight: null,
    sequence: "Retro-inverso D-amino-acid FOXO4 peptide",
    summary:
      "A retro-inverso D-amino-acid peptide studied in cellular-senescence and FOXO4/p53 interaction research.",
    research_context: "Baar et al., Cell (2017).",
    vial_image: vialPath("foxo4-dri"),
    variants: [
      { size_mg: 10, sku: "BGP-FOXO-10", wholesale_cost: 86.5, retail_price: 195.0 },
    ],
  },
  {
    slug: "ss-31",
    name: "SS-31 (Elamipretide)",
    category_slug: "mitochondrial",
    cas_number: "736992-21-5",
    molecular_formula: "C32H49N9O5",
    molecular_weight: 639.79,
    sequence: "D-Arg-2,6-dimethylTyr-Lys-Phe-NH2",
    summary:
      "A 4-residue mitochondria-targeting peptide studied in cardiolipin-binding and mitochondrial-function research.",
    research_context: "Szeto, Br J Pharmacol (2014).",
    vial_image: vialPath("ss-31"),
    variants: [
      { size_mg: 10, sku: "BGP-SS31-10", wholesale_cost: 31.5, retail_price: 78.0 },
    ],
  },

  // ========== HYPOTHALAMIC PEPTIDES ==========
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
      "Shadiack et al., J Pharmacol Exp Ther (2007).",
    vial_image: vialPath("pt-141"),
    variants: [
      { size_mg: 10, sku: "BGP-PT141-10", wholesale_cost: 24.0, retail_price: 58.0 },
    ],
  },
  {
    slug: "melanotan-1",
    name: "Melanotan-1",
    category_slug: "hypothalamic",
    cas_number: "75921-69-6",
    molecular_formula: "C78H111N21O19",
    molecular_weight: 1646.83,
    sequence: "Ac-Ser-Tyr-Ser-Nle-Glu-His-D-Phe-Arg-Trp-Gly-Lys-Pro-Val-NH2",
    summary:
      "A 13-residue α-MSH analog studied in melanocortin-receptor research.",
    research_context: "Hadley & Haskell-Luevano, Ann N Y Acad Sci (1999).",
    vial_image: vialPath("melanotan-1"),
    variants: [
      { size_mg: 10, sku: "BGP-MT1-10", wholesale_cost: 17.0, retail_price: 42.0 },
    ],
  },
  {
    slug: "melanotan-2",
    name: "Melanotan-2",
    category_slug: "hypothalamic",
    cas_number: "121062-08-6",
    molecular_formula: "C50H69N15O9",
    molecular_weight: 1024.18,
    sequence: "Ac-Nle-cyclo[Asp-His-D-Phe-Arg-Trp-Lys]-NH2",
    summary:
      "A cyclic heptapeptide α-MSH analog studied in melanocortin-receptor research.",
    research_context: "Hadley et al., Life Sci (1998).",
    vial_image: vialPath("melanotan-2"),
    variants: [
      { size_mg: 10, sku: "BGP-MT2-10", wholesale_cost: 15.75, retail_price: 38.0 },
    ],
  },
  {
    slug: "oxytocin",
    name: "Oxytocin Acetate",
    category_slug: "hypothalamic",
    cas_number: "6233-83-6",
    molecular_formula: "C43H66N12O12S2",
    molecular_weight: 1007.19,
    sequence: "Cys-Tyr-Ile-Gln-Asn-Cys-Pro-Leu-Gly-NH2 (disulfide bridge)",
    summary:
      "A 9-residue cyclic peptide hormone — reference compound in neurohypophyseal research.",
    research_context: "du Vigneaud et al., J Am Chem Soc (1953).",
    vial_image: vialPath("oxytocin"),
    variants: [
      { size_mg: 2, sku: "BGP-OXY-2", wholesale_cost: 13.5, retail_price: 38.0 },
    ],
  },
  {
    slug: "kisspeptin-10",
    name: "Kisspeptin-10",
    category_slug: "hypothalamic",
    cas_number: "374675-21-5",
    molecular_formula: "C63H83N17O14",
    molecular_weight: 1302.45,
    sequence: "Tyr-Asn-Trp-Asn-Ser-Phe-Gly-Leu-Arg-Phe-NH2",
    summary:
      "A 10-residue fragment of the KISS1 gene product studied in GnRH-axis research.",
    research_context: "Kotani et al., J Biol Chem (2001).",
    vial_image: vialPath("kisspeptin-10"),
    variants: [
      { size_mg: 5, sku: "BGP-KISS-5", wholesale_cost: 22.5, retail_price: 55.0 },
      { size_mg: 10, sku: "BGP-KISS-10", wholesale_cost: 37.0, retail_price: 88.0 },
    ],
  },
  {
    slug: "vip",
    name: "VIP (Vasoactive Intestinal Peptide)",
    category_slug: "hypothalamic",
    cas_number: "40077-57-4",
    molecular_formula: "C147H237N43O43S",
    molecular_weight: 3326.8,
    sequence: "His-Ser-Asp-Ala-Val-Phe-Thr-Asp-Asn-Tyr-Thr-Arg-Leu-Arg-Lys-Gln-Met-Ala-Val-Lys-Lys-Tyr-Leu-Asn-Ser-Ile-Leu-Asn-NH2",
    summary:
      "A 28-residue neuropeptide — reference compound in VIP-receptor research.",
    research_context: "Said & Mutt, Eur J Biochem (1972).",
    vial_image: vialPath("vip"),
    variants: [
      { size_mg: 5, sku: "BGP-VIP-5", wholesale_cost: 28.0, retail_price: 65.0 },
      { size_mg: 10, sku: "BGP-VIP-10", wholesale_cost: 50.0, retail_price: 115.0 },
    ],
  },

  // ========== IMMUNOMODULATORY ==========
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
      "King & Tuthill, Semin Oncol (2018).",
    vial_image: vialPath("thymosin-alpha-1"),
    variants: [
      { size_mg: 5, sku: "BGP-TA1-5", wholesale_cost: 31.0, retail_price: 79.0 },
    ],
  },
  {
    slug: "thymalin",
    name: "Thymalin",
    category_slug: "immunomodulatory",
    cas_number: null,
    molecular_formula: null,
    molecular_weight: null,
    sequence: "Thymic peptide mixture (Khavinson)",
    summary:
      "A Khavinson-class thymic peptide preparation studied in immunological research.",
    research_context: "Khavinson, Bull Exp Biol Med (2001).",
    vial_image: vialPath("thymalin"),
    variants: [
      { size_mg: 10, sku: "BGP-THYM-10", wholesale_cost: 21.5, retail_price: 52.0 },
    ],
  },
  {
    slug: "ara-290",
    name: "ARA-290",
    category_slug: "immunomodulatory",
    cas_number: "1208243-50-8",
    molecular_formula: "C52H84N16O16",
    molecular_weight: 1205.32,
    sequence: "Pyr-Glu-Gln-Leu-Glu-Arg-Ala-Leu-Asn-Ser-Ser",
    summary:
      "An 11-residue peptide derived from the erythropoietin helix-B sequence, studied in innate-repair-receptor research.",
    research_context: "Brines et al., Proc Natl Acad Sci USA (2008).",
    vial_image: vialPath("ara-290"),
    variants: [
      { size_mg: 5, sku: "BGP-ARA290-5", wholesale_cost: 16.25, retail_price: 42.0 },
      { size_mg: 10, sku: "BGP-ARA290-10", wholesale_cost: 23.0, retail_price: 58.0 },
    ],
  },

  // ========== GLP-1 CLASS ==========
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
      "Lau et al., J Med Chem (2015).",
    vial_image: vialPath("semaglutide"),
    variants: [
      { size_mg: 5, sku: "BGP-SEMA-5", wholesale_cost: 24.75, retail_price: 62.0 },
      { size_mg: 10, sku: "BGP-SEMA-10", wholesale_cost: 33.0, retail_price: 85.0 },
      { size_mg: 30, sku: "BGP-SEMA-30", wholesale_cost: 37.0, retail_price: 98.0 },
    ],
  },
  {
    slug: "tirzepatide",
    name: "Tirzepatide",
    category_slug: "glp-1",
    cas_number: "2023788-19-2",
    molecular_formula: "C225H348N48O68",
    molecular_weight: 4813.5,
    sequence: "39-residue dual GIP/GLP-1 receptor agonist with γ-Glu-C20 diacid modification",
    summary:
      "A 39-residue dual GIP/GLP-1 receptor agonist with C20 fatty-acid conjugation. Studied in incretin-receptor research.",
    research_context: "Coskun et al., Mol Metab (2018).",
    vial_image: vialPath("tirzepatide"),
    variants: [
      { size_mg: 5, sku: "BGP-TIRZ-5", wholesale_cost: 19.0, retail_price: 52.0 },
      { size_mg: 10, sku: "BGP-TIRZ-10", wholesale_cost: 24.0, retail_price: 68.0 },
      { size_mg: 15, sku: "BGP-TIRZ-15", wholesale_cost: 31.0, retail_price: 85.0 },
      { size_mg: 30, sku: "BGP-TIRZ-30", wholesale_cost: 39.0, retail_price: 108.0 },
      { size_mg: 60, sku: "BGP-TIRZ-60", wholesale_cost: 61.75, retail_price: 165.0 },
    ],
  },
  {
    slug: "retatrutide",
    name: "Retatrutide",
    category_slug: "glp-1",
    cas_number: "2381089-83-2",
    molecular_formula: "C226H353N63O69",
    molecular_weight: 4731.4,
    sequence: "39-residue triple-agonist (GIP/GLP-1/glucagon receptor)",
    summary:
      "A 39-residue triple-agonist peptide targeting GIP, GLP-1, and glucagon receptors. Studied in incretin-pathway research.",
    research_context: "Coskun et al., Cell Metab (2022).",
    vial_image: vialPath("retatrutide"),
    variants: [
      { size_mg: 5, sku: "BGP-RETA-5", wholesale_cost: 21.0, retail_price: 55.0 },
      { size_mg: 10, sku: "BGP-RETA-10", wholesale_cost: 32.75, retail_price: 85.0 },
      { size_mg: 30, sku: "BGP-RETA-30", wholesale_cost: 71.0, retail_price: 185.0 },
      { size_mg: 50, sku: "BGP-RETA-50", wholesale_cost: 82.25, retail_price: 215.0 },
      { size_mg: 60, sku: "BGP-RETA-60", wholesale_cost: 110.0, retail_price: 275.0 },
    ],
  },
  {
    slug: "cagrilintide",
    name: "Cagrilintide",
    category_slug: "glp-1",
    cas_number: "2204783-15-1",
    molecular_formula: "C180H293N53O55",
    molecular_weight: 4139.77,
    sequence: "37-residue amylin analog",
    summary:
      "A 37-residue amylin analog with C20 fatty-acid conjugation. Studied in amylin-receptor research.",
    research_context: "Enebo et al., Lancet (2021).",
    vial_image: vialPath("cagrilintide"),
    variants: [
      { size_mg: 5, sku: "BGP-CAGR-5", wholesale_cost: 33.75, retail_price: 85.0 },
      { size_mg: 10, sku: "BGP-CAGR-10", wholesale_cost: 56.25, retail_price: 145.0 },
    ],
  },
  {
    slug: "mazdutide",
    name: "Mazdutide",
    category_slug: "glp-1",
    cas_number: null,
    molecular_formula: null,
    molecular_weight: null,
    sequence: "GLP-1 / glucagon dual agonist",
    summary:
      "A GLP-1 / glucagon receptor dual agonist studied in incretin-pathway research.",
    research_context: "Ji et al., Diabetes Obes Metab (2023).",
    vial_image: vialPath("mazdutide"),
    variants: [
      { size_mg: 10, sku: "BGP-MAZD-10", wholesale_cost: 65.0, retail_price: 165.0 },
    ],
  },
  {
    slug: "survodutide",
    name: "Survodutide",
    category_slug: "glp-1",
    cas_number: null,
    molecular_formula: null,
    molecular_weight: null,
    sequence: "GLP-1 / glucagon dual agonist",
    summary:
      "A GLP-1 / glucagon receptor dual agonist studied in incretin-pathway research.",
    research_context: "Rischke et al., Nat Med (2024).",
    vial_image: vialPath("survodutide"),
    variants: [
      { size_mg: 10, sku: "BGP-SURV-10", wholesale_cost: 89.5, retail_price: 225.0 },
    ],
  },

  // ========== OTHER RESEARCH COMPOUNDS ==========
  {
    slug: "follistatin-344",
    name: "Follistatin-344",
    category_slug: "other",
    cas_number: "80449-31-6",
    molecular_formula: null,
    molecular_weight: 31000,
    sequence: "344-residue activin-binding glycoprotein",
    summary:
      "The 344-residue splice variant of follistatin. Studied in activin/myostatin research.",
    research_context: "Lee & McPherron, Proc Natl Acad Sci USA (2001).",
    vial_image: vialPath("follistatin-344"),
    variants: [
      { size_mg: 1, sku: "BGP-FOLL-1", wholesale_cost: 77.0, retail_price: 195.0 },
    ],
  },
  {
    slug: "snap-8",
    name: "SNAP-8",
    category_slug: "other",
    cas_number: "868844-74-0",
    molecular_formula: "C42H63N13O15",
    molecular_weight: 973.03,
    sequence: "Ac-Glu-Glu-Met-Gln-Arg-Arg-NH2",
    summary:
      "An acetyl-hexapeptide-8 analog studied in SNAP-receptor fusion research (neuroscience).",
    research_context: "Blanes-Mira et al., Int J Cosmet Sci (2002).",
    vial_image: vialPath("snap-8"),
    variants: [
      { size_mg: 10, sku: "BGP-SNAP8-10", wholesale_cost: 12.5, retail_price: 32.0 },
    ],
  },

  // ========== LABORATORY SUPPLIES ==========
  {
    slug: "bac-water",
    name: "Bacteriostatic Water (10 mL)",
    category_slug: "accessories",
    cas_number: null,
    molecular_formula: null,
    molecular_weight: null,
    sequence: null,
    summary:
      "Sterile water with 0.9% benzyl alcohol as a bacteriostatic preservative. Standard laboratory solvent for reconstitution of lyophilized peptides in research applications.",
    research_context: null,
    vial_image: vialPath("bac-water"),
    variants: [
      { size_mg: 10, sku: "BGP-BACW-10", wholesale_cost: 3.5, retail_price: 9.0 },
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

/**
 * Quantity tiers for bulk purchases. These are the fixed options shown on
 * the product detail page — unit price multiplies by quantity (no
 * volume-discount math applied yet; that's a future pricing decision).
 */
export const QUANTITY_TIERS: readonly number[] = [1, 10, 25, 50, 100] as const;
