/**
 * Bench Grade Peptides — full launch catalog.
 *
 * Scope: complete AgeREcode source list rolled in, priced at premium tier
 * (Peptide Sciences-equivalent retail). Three pack tiers per vial product
 * (1-vial / 5-pack / 10-pack); single-pack for capsules and topicals.
 *
 * Pricing model:
 *   - Single vial: premium retail anchor (Peptide Sciences level).
 *   - 5-pack: 5 × single × 0.95 (5% bundle discount).
 *   - 10-pack: 10 × single × 0.85 (15% bundle discount, our highest tier).
 *
 * Cost model (informational — not stored per-variant for capsule/topical):
 *   Wholesale = AgeREcode wholesale × pack_size. Operations adds $15 per
 *   ORDER + actual FedEx shipping at point-of-fulfillment; bundling
 *   amortizes the fixed $15 across more vials, which is why the bundle
 *   discounts compound the saving.
 *
 * Capsules, supplements, and topicals are listed but with vial_image=null
 * (blank card) — physical photography happens after manufacturer ships
 * sample bottles.
 *
 * BAC water and Acetic Acid water are NOT in inventory here per founder
 * direction — labels are still produced for the manufacturer hand-off
 * but they don't appear in PRODUCTS.
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
  /** Vials in the pack: 1, 5, or 10 (vials) — or 1 for single-bottle products */
  pack_size: number;
  sku: string;
  /** Supplier wholesale cost (USD) for the entire pack. */
  wholesale_cost: number;
  /** Retail price (USD) for the entire pack. */
  retail_price: number;
  /**
   * Bundle-supply pricing: the first unit of this variant in the cart is
   * free (BAC water, syringes, draw needles). Auto-added when the cart
   * contains lyophilized peptides; user can remove or top up. Subsequent
   * units charge `retail_price` each.
   */
  bundle_supply?: boolean;
}

export interface CatalogProduct {
  slug: string;
  name: string;
  category_slug: string;
  /** @deprecated — kept for legacy email/admin paths. Equals variants[0].size_mg. */
  dose_mg: number;
  cas_number: string | null;
  molecular_formula: string | null;
  molecular_weight: number | null;
  sequence: string | null;
  summary: string;
  research_context: string | null;
  /**
   * Path to the vial photograph for this SKU (relative to /public).
   * For SKUs awaiting photography (capsules, topicals), points at the
   * shared placeholder image — the UI renders an empty/coming-soon
   * treatment when it sees that path.
   */
  vial_image: string;
  /** Container type drives label dimensions and packaging spec. */
  container: "vial-3ml" | "vial-10ml" | "capsule-bottle" | "topical-bottle" | "supply";
  variants: CatalogVariant[];
}

export const CATEGORIES: readonly CatalogCategory[] = [
  {
    slug: "incretin-receptor-agonists",
    name: "Incretin Receptor Agonists",
    taxonomy_label: "Incretin receptor agonist research",
    description:
      "Class peptides studied in incretin-pathway metabolic research. Single-, dual-, and triple-receptor agonists. Coded designations used internally; full identities disclosed only on third-party Certificates of Analysis to verified customers.",
    sort_order: 1,
  },
  {
    slug: "growth-hormone",
    name: "Growth Hormone Axis",
    taxonomy_label: "GH-axis / GHSR research",
    description:
      "Compounds studied for interaction with the somatotropic axis — GHRH analogs, GHSR-1a agonists, IGF-1 family research peptides.",
    sort_order: 3,
  },
  {
    slug: "tissue-repair",
    name: "Tissue Repair & Remodeling",
    taxonomy_label: "ECM / tissue-repair research",
    description:
      "Compounds investigated in tissue-remodeling, extracellular-matrix, angiogenesis, and wound-closure research models.",
    sort_order: 4,
  },
  {
    slug: "cognitive",
    name: "Cognitive & Neuro",
    taxonomy_label: "CNS / neuroprotection research",
    description:
      "Peptides studied in neurotrophic, cognitive, and neuroprotection literature.",
    sort_order: 5,
  },
  {
    slug: "longevity",
    name: "Longevity & Cellular",
    taxonomy_label: "Senescence / mitochondrial research",
    description:
      "Compounds studied in senolytic, mitochondrial, and cellular-aging research models.",
    sort_order: 6,
  },
  {
    slug: "immune",
    name: "Immune & Inflammation",
    taxonomy_label: "Immunomodulation research",
    description:
      "Peptides studied in inflammation, innate-immunity, and thymus-axis research literature.",
    sort_order: 7,
  },
  {
    slug: "sexual-wellness",
    name: "Sexual Wellness",
    taxonomy_label: "Reproductive / hormonal research",
    description:
      "Peptides studied in reproductive-axis, melanocortin-receptor, and pair-bonding research literature.",
    sort_order: 8,
  },
  {
    slug: "specialty-blends",
    name: "Specialty Research Blends",
    taxonomy_label: "Multi-compound research blends",
    description:
      "Pre-formulated multi-peptide research blends — KLOW, GLOW, BPC/TB combo, CJC/Ipa combo, Super Human Blend.",
    sort_order: 2,
  },
  {
    slug: "liquid-formulations",
    name: "Liquid Formulations",
    taxonomy_label: "Liquid / large-volume research",
    description:
      "Pre-mixed liquid research solutions in 10mL multi-dose vials — L-Carnitine, LC120, LC216, and other liquid-blend research preparations.",
    sort_order: 9,
  },
  {
    slug: "topicals",
    name: "Topicals & Serums",
    taxonomy_label: "Topical research preparations",
    description:
      "Topical research preparations and serums for skin / external research applications.",
    sort_order: 11,
  },
] as const;

// Slug-to-filename mapping. The slug strings on the right come from the
// per-SKU photo batch in public/brand/vials/. Capsules/topicals/supplies
// don't have per-SKU photos yet — they fall through to the placeholder.
const VIAL_PHOTO: Record<string, string> = {
  // GLP-class (blinded)
  "glp1s": "glp-1-s-5mg",
  "glp2t": "glp-2-t-5mg",
  "glp3r": "glp-3-r-5mg",
  "amya": "amya-5mg",
  "glp2m-10mg": "glp-2-m-10mg",
  "glp2sv-10mg": "glp-2-sv-10mg",
  // CJC family
  "cjc-1295-no-dac": "cjc-1295-5mg",
  "cjc-1295-with-dac-5mg": "cjc-1295-w-dac-5mg",
  // Growth hormone secretagogues
  "ipamorelin": "ipamorelin-5mg",
  "ghrp-2": "ghrp-2-5mg",
  "ghrp-6": "ghrp-6-5mg",
  "hexarelin-acetate-5mg": "hexarelin-acetate-5mg",
  "sermorelin": "sermorelin-5mg",
  "tesamorelin": "tesamorelin-5mg",
  "mgf-2mg": "mgf-2mg",
  "igf-1-lr3-0-1mg": "igf-1-lr3-1mg",
  "igf-1-lr3-1mg": "igf-1-lr3-1mg",
  "follistatin-344-1mg": "follistatin-344-1mg",
  "hgh-fragment-176-191": "hgh-fragment-176-191-5mg",
  // Healing
  "bpc-157": "bpc-157-5mg",
  "tb-500": "tb-500-5mg",
  "ghk-cu": "ghk-cu-50mg",
  "ahk-cu": "ahk-cu-20mg",
  "kpv": "kpv-5mg",
  "larazatide-5mg": "larazatide-5mg",
  "ll-37-5mg": "ll-37-5mg",
  // Nootropics
  "selank": "selank-5mg",
  "semax": "semax-5mg",
  "cerebrolysin-60mg": "cerebrolysin-60mg",
  "cartalax-20mg": "cartalax-20mg",
  "dsip": "dsip-5mg",
  "dihexa": "dihexa-5mg",
  "humanin": "humanin-5mg",
  "pe-22-28-5mg": "pe-22-28-5mg",
  "pinealon": "pinealon-10mg",
  "ara-290": "ara-290-5mg",
  "epitalon": "epitalon-10mg",
  "mots-c": "mots-c-10mg",
  "ss-31-10mg": "ss-31-10mg",
  "foxo4-dri-10mg": "foxo4-dri-10mg",
  "5-amino-1mq": "5-amino-1mq-5mg",
  // Metabolic
  "aicar": "aicar-50mg",
  "aod-9604": "aod-9604-5mg",
  "adipotide": "adipotide-5mg",
  "slu-pp-332-5mg": "slu-pp-332-5mg",
  // Longevity
  "nad": "nad-100mg",
  "glutathione-1500mg": "glutathione-1500mg",
  "thymosin-alpha-1-5mg": "thymosin-alpha-1-5mg",
  "thymalin-10mg": "thymalin-10mg",
  // Sexual / aesthetic
  "pt-141-10mg": "pt-141-10mg",
  "melanotan-1-10mg": "melanotan-1-10mg",
  "melanotan-2-10mg": "melanotan-2-10mg",
  "oxytocin-acetate-2mg": "oxytocin-acetate-2mg",
  "kisspeptin": "kisspeptin-5mg",
  "vip": "vip-5mg",
  // Blends
  "klow-blend-80mg": "klow-blend-80mg",
  "glow-blend-70mg": "glow-blend-70mg",
  "bpc-tb-5-5mg": "bpc-157-tb-500-5mg",
  "bpc-tb-10-10mg": "bpc-157-tb-500-5mg",
  "cjc-ipa-5-5mg": "cjc-1295-ipamorelin-5mg",
  "super-human-blend-10ml": "super-human-blend-10mg",
  // Liquid carnitines
  "l-carnitine-10ml": "l-carnitine-10mg",
  "lc120-10ml": "lc120-10mg",
  "lc216-10ml": "lc216-10mg",
  // Topicals (uses cosmetic-research blends)
  "snap-8-10mg": "snap-8-10mg",
  // Diluents
  "acetic-acid-water-10ml": "acetic-acid-water-10ml",
};

function vialPath(slug: string, container: "vial-3ml" | "vial-10ml" | "capsule-bottle" | "topical-bottle" | "supply"): string {
  const fname = VIAL_PHOTO[slug];
  if (fname) {
    return `/brand/vials/${fname}.jpg?v=56`;
  }
  return "/brand/vials/_placeholder.jpg?v=4";
}

/**
 * Build three pack-tier variants for a vial product at premium retail.
 *
 * @param sku_prefix    SKU stem; pack-size suffix (-1 / -5 / -10) appended.
 * @param wholesale_per_vial AgeREcode wholesale cost per single vial (USD).
 * @param single_price  Retail price for 1 vial (USD).
 * @param size_mg       Size of each vial in mg.
 *
 * 5-pack price = 5 × single × 0.95 (5% bundle discount) — rounded.
 * 10-pack price = 10 × single × 0.85 (15% bundle discount) — rounded.
 */
function packTiers(
  sku_prefix: string,
  wholesale_per_vial: number,
  single_price: number,
  size_mg: number,
): CatalogVariant[] {
  const five_pack = Math.round(5 * single_price * 0.95);
  const ten_pack = Math.round(10 * single_price * 0.85);
  return [
    {
      size_mg,
      pack_size: 1,
      sku: `${sku_prefix}-1`,
      wholesale_cost: wholesale_per_vial,
      retail_price: single_price,
    },
    {
      size_mg,
      pack_size: 5,
      sku: `${sku_prefix}-5`,
      wholesale_cost: Math.round(wholesale_per_vial * 5 * 100) / 100,
      retail_price: five_pack,
    },
    {
      size_mg,
      pack_size: 10,
      sku: `${sku_prefix}-10`,
      wholesale_cost: Math.round(wholesale_per_vial * 10 * 100) / 100,
      retail_price: ten_pack,
    },
  ];
}

/** Build a single-pack variant for capsules / topicals / single-pack-only SKUs. */
function singlePack(
  sku: string,
  wholesale_cost: number,
  retail_price: number,
  size_mg: number,
): CatalogVariant[] {
  return [{ size_mg, pack_size: 1, sku, wholesale_cost, retail_price }];
}

export const PRODUCTS: readonly CatalogProduct[] = [
  {
    slug: "glp1s",
    name: "GLP-1 S",
    dose_mg: 5,
    category_slug: "incretin-receptor-agonists",
    cas_number: null,
    molecular_formula: null,
    molecular_weight: null,
    sequence: "Single-receptor incretin class agonist (full identity on COA)",
    summary:
      "Single-receptor incretin class agonist studied in incretin-pathway metabolic research.",
    research_context:
      "Drucker, Cell Metab (2018). Class-level GLP-1R pharmacology reviews. Müller et al., Mol Metab (2019).",
    vial_image: vialPath("glp1s", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 5, pack_size: 1, sku: "BGP-GLP1S-5", wholesale_cost: 24.75, retail_price: 110.0 },
      { size_mg: 10, pack_size: 1, sku: "BGP-GLP1S-10", wholesale_cost: 33.0, retail_price: 180.0 },
      { size_mg: 30, pack_size: 1, sku: "BGP-GLP1S-30", wholesale_cost: 37.0, retail_price: 400.0 },
    ],
  },
  {
    slug: "glp2t",
    name: "GLP-2 T",
    dose_mg: 5,
    category_slug: "incretin-receptor-agonists",
    cas_number: null,
    molecular_formula: null,
    molecular_weight: null,
    sequence: "Dual-receptor incretin class agonist (full identity on COA)",
    summary:
      "Dual-receptor incretin class agonist studied in metabolic-pathway research.",
    research_context:
      "Drucker, Cell Metab (2018). Class-level dual-agonist incretin pharmacology reviews.",
    vial_image: vialPath("glp2t", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 5, pack_size: 1, sku: "BGP-GLP2T-5", wholesale_cost: 19.0, retail_price: 130.0 },
      { size_mg: 10, pack_size: 1, sku: "BGP-GLP2T-10", wholesale_cost: 24.0, retail_price: 230.0 },
      { size_mg: 15, pack_size: 1, sku: "BGP-GLP2T-15", wholesale_cost: 31.0, retail_price: 300.0 },
      { size_mg: 30, pack_size: 1, sku: "BGP-GLP2T-30", wholesale_cost: 39.0, retail_price: 550.0 },
      { size_mg: 60, pack_size: 1, sku: "BGP-GLP2T-60", wholesale_cost: 61.75, retail_price: 1050.0 },
    ],
  },
  {
    slug: "glp3r",
    name: "GLP-3 R",
    dose_mg: 5,
    category_slug: "incretin-receptor-agonists",
    cas_number: null,
    molecular_formula: null,
    molecular_weight: null,
    sequence: "Triple-receptor incretin class agonist (full identity on COA)",
    summary:
      "Triple-receptor incretin class agonist studied in metabolic-pathway research.",
    research_context:
      "Drucker, Cell Metab (2018). Class-level triple-agonist incretin pharmacology reviews.",
    vial_image: vialPath("glp3r", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 5, pack_size: 1, sku: "BGP-GLP3R-5", wholesale_cost: 21.0, retail_price: 170.0 },
      { size_mg: 10, pack_size: 1, sku: "BGP-GLP3R-10", wholesale_cost: 32.75, retail_price: 280.0 },
      { size_mg: 30, pack_size: 1, sku: "BGP-GLP3R-30", wholesale_cost: 71.0, retail_price: 480.0 },
      { size_mg: 50, pack_size: 1, sku: "BGP-GLP3R-50", wholesale_cost: 82.25, retail_price: 720.0 },
      { size_mg: 60, pack_size: 1, sku: "BGP-GLP3R-60", wholesale_cost: 110.0, retail_price: 850.0 },
    ],
  },
  {
    slug: "amya",
    name: "AMY-A",
    dose_mg: 5,
    category_slug: "incretin-receptor-agonists",
    cas_number: null,
    molecular_formula: null,
    molecular_weight: null,
    sequence: "Long-acting amylin analog class agonist (full identity on COA)",
    summary:
      "Long-acting amylin analog class agonist studied alongside incretin-receptor agonists in metabolic-pathway research.",
    research_context:
      "Class-level amylin pharmacology reviews. Lutz, Physiol Behav (2010). Trevaskis et al., Endocrinology (2010).",
    vial_image: vialPath("amya", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 5, pack_size: 1, sku: "BGP-AMYA-5", wholesale_cost: 33.75, retail_price: 130.0 },
      { size_mg: 10, pack_size: 1, sku: "BGP-AMYA-10", wholesale_cost: 56.25, retail_price: 220.0 },
    ],
  },
  {
    slug: "glp2m-10mg",
    name: "GLP-2 M 10mg",
    dose_mg: 10,
    category_slug: "incretin-receptor-agonists",
    cas_number: null,
    molecular_formula: null,
    molecular_weight: null,
    sequence: "Dual-receptor incretin class agonist (full identity on COA)",
    summary:
      "Dual-receptor incretin class agonist studied in metabolic-pathway research.",
    research_context:
      "Drucker, Cell Metab (2018). Class-level dual-agonist incretin pharmacology reviews.",
    vial_image: vialPath("glp2m-10mg", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 10, pack_size: 1, sku: "BGP-GLP2M-10", wholesale_cost: 65.0, retail_price: 200.0 },
    ],
  },
  {
    slug: "glp2sv-10mg",
    name: "GLP-2 SV 10mg",
    dose_mg: 10,
    category_slug: "incretin-receptor-agonists",
    cas_number: null,
    molecular_formula: null,
    molecular_weight: null,
    sequence: "Dual-receptor incretin class agonist (full identity on COA)",
    summary:
      "Dual-receptor incretin class agonist studied in metabolic-pathway research.",
    research_context:
      "Drucker, Cell Metab (2018). Class-level dual-agonist incretin pharmacology reviews.",
    vial_image: vialPath("glp2sv-10mg", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 10, pack_size: 1, sku: "BGP-GLP2SV-10", wholesale_cost: 89.5, retail_price: 260.0 },
    ],
  },
  {
    slug: "cjc-1295-no-dac",
    name: "CJC-1295 (no DAC)",
    dose_mg: 5,
    category_slug: "growth-hormone",
    cas_number: "863288-34-0",
    molecular_formula: "C152H252N44O42",
    molecular_weight: 3367.89,
    sequence: "Mod-GRF (1-29) — Tyr-D-Ala-Asp-Ala-Ile-Phe-Thr-Gln-Ser-Tyr-Arg-Lys-Val-Leu-Ala-Gln-Leu-Ser-Ala-Arg-Lys-Leu-Leu-Gln-Asp-Ile-Leu-Ser-Arg",
    summary:
      "Modified GHRH (1-29) analog without drug-affinity complex. Short half-life GH-axis research peptide.",
    research_context:
      "Teichman et al., J Clin Endocrinol Metab (2006).",
    vial_image: vialPath("cjc-1295-no-dac", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 5, pack_size: 1, sku: "BGP-CJC-5", wholesale_cost: 24.75, retail_price: 80.0 },
      { size_mg: 10, pack_size: 1, sku: "BGP-CJC-10", wholesale_cost: 51.0, retail_price: 130.0 },
    ],
  },
  {
    slug: "cjc-1295-with-dac-5mg",
    name: "CJC-1295 with DAC 5mg",
    dose_mg: 5,
    category_slug: "growth-hormone",
    cas_number: "863288-34-0",
    molecular_formula: "C165H269N47O46",
    molecular_weight: 3647.13,
    sequence: "GHRH analog with drug-affinity complex (extended half-life)",
    summary:
      "GHRH analog with drug-affinity complex. Extended-half-life GH-axis research peptide.",
    research_context:
      "Teichman et al., J Clin Endocrinol Metab (2006).",
    vial_image: vialPath("cjc-1295-with-dac-5mg", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 5, pack_size: 1, sku: "BGP-CJCDAC-5", wholesale_cost: 50.75, retail_price: 130.0 },
    ],
  },
  {
    slug: "ipamorelin",
    name: "Ipamorelin",
    dose_mg: 5,
    category_slug: "growth-hormone",
    cas_number: "170851-70-4",
    molecular_formula: "C38H49N9O5",
    molecular_weight: 711.85,
    sequence: "Aib-His-D-2-Nal-D-Phe-Lys-NH2",
    summary:
      "Selective GHSR-1a agonist pentapeptide. Studied in pulsatile GH-release research.",
    research_context:
      "Raun et al., Eur J Endocrinol (1998).",
    vial_image: vialPath("ipamorelin", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 5, pack_size: 1, sku: "BGP-IPA-5", wholesale_cost: 15.0, retail_price: 75.0 },
      { size_mg: 10, pack_size: 1, sku: "BGP-IPA-10", wholesale_cost: 26.0, retail_price: 115.0 },
    ],
  },
  {
    slug: "ghrp-2",
    name: "GHRP-2",
    dose_mg: 5,
    category_slug: "growth-hormone",
    cas_number: "158861-67-7",
    molecular_formula: "C45H55N9O6",
    molecular_weight: 817.95,
    sequence: "D-Ala-D-2-Nal-Ala-Trp-D-Phe-Lys-NH2",
    summary:
      "Synthetic hexapeptide ghrelin mimetic. GHSR-1a agonist studied in growth-hormone-release research.",
    research_context:
      "Bowers et al., Endocrinology (1991).",
    vial_image: vialPath("ghrp-2", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 5, pack_size: 1, sku: "BGP-GHRP2-5", wholesale_cost: 14.75, retail_price: 70.0 },
      { size_mg: 10, pack_size: 1, sku: "BGP-GHRP2-10", wholesale_cost: 21.0, retail_price: 110.0 },
    ],
  },
  {
    slug: "ghrp-6",
    name: "GHRP-6",
    dose_mg: 5,
    category_slug: "growth-hormone",
    cas_number: "87616-84-0",
    molecular_formula: "C46H56N12O6",
    molecular_weight: 873.01,
    sequence: "His-D-Trp-Ala-Trp-D-Phe-Lys-NH2",
    summary:
      "Hexapeptide ghrelin mimetic with appetite-research activity. GHSR-1a agonist.",
    research_context:
      "Bowers et al., Endocrinology (1984).",
    vial_image: vialPath("ghrp-6", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 5, pack_size: 1, sku: "BGP-GHRP6-5", wholesale_cost: 14.75, retail_price: 70.0 },
      { size_mg: 10, pack_size: 1, sku: "BGP-GHRP6-10", wholesale_cost: 21.0, retail_price: 110.0 },
    ],
  },
  {
    slug: "hexarelin-acetate-5mg",
    name: "Hexarelin Acetate 5mg",
    dose_mg: 5,
    category_slug: "growth-hormone",
    cas_number: "140703-51-1",
    molecular_formula: "C47H58N12O6",
    molecular_weight: 887.04,
    sequence: "His-D-2-methyl-Trp-Ala-Trp-D-Phe-Lys-NH2",
    summary:
      "Synthetic hexapeptide GHSR agonist studied in cardiac-axis and GH-release research.",
    research_context:
      "Locatelli et al., Endocrinology (1994).",
    vial_image: vialPath("hexarelin-acetate-5mg", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 5, pack_size: 1, sku: "BGP-HEX-5", wholesale_cost: 26.0, retail_price: 90.0 },
    ],
  },
  {
    slug: "sermorelin",
    name: "Sermorelin",
    dose_mg: 5,
    category_slug: "growth-hormone",
    cas_number: "86168-78-7",
    molecular_formula: "C149H246N44O42S",
    molecular_weight: 3357.93,
    sequence: "GHRH (1-29) NH2",
    summary:
      "29-residue GHRH analog. Studied as a research probe of the somatotropic axis.",
    research_context:
      "Walker, Treat Endocrinol (2006).",
    vial_image: vialPath("sermorelin", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 5, pack_size: 1, sku: "BGP-SER-5", wholesale_cost: 23.75, retail_price: 85.0 },
      { size_mg: 10, pack_size: 1, sku: "BGP-SER-10", wholesale_cost: 37.0, retail_price: 140.0 },
    ],
  },
  {
    slug: "tesamorelin",
    name: "Tesamorelin",
    dose_mg: 5,
    category_slug: "growth-hormone",
    cas_number: "218949-48-5",
    molecular_formula: "C221H366N72O67S",
    molecular_weight: 5135.85,
    sequence: "N-terminally hexenoyl-modified GHRH (1-44)",
    summary:
      "Stabilized GHRH analog studied in lipodystrophy and visceral-adiposity research models.",
    research_context:
      "Falutz et al., NEJM (2007).",
    vial_image: vialPath("tesamorelin", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 5, pack_size: 1, sku: "BGP-TES-5", wholesale_cost: 29.25, retail_price: 100.0 },
      { size_mg: 10, pack_size: 1, sku: "BGP-TES-10", wholesale_cost: 55.5, retail_price: 160.0 },
    ],
  },
  {
    slug: "mgf-2mg",
    name: "MGF 2mg",
    dose_mg: 2,
    category_slug: "growth-hormone",
    cas_number: "67763-97-7",
    molecular_formula: "C121H200N42O39",
    molecular_weight: 2867.21,
    sequence: "C-terminal Ec exon splice variant of IGF-1",
    summary:
      "Mechano-Growth Factor — splice variant of IGF-1 studied in myocyte-growth and ECM-remodeling research.",
    research_context:
      "Goldspink, Curr Opin Clin Nutr Metab Care (2007).",
    vial_image: vialPath("mgf-2mg", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 2, pack_size: 1, sku: "BGP-MGF-2", wholesale_cost: 24.0, retail_price: 90.0 },
    ],
  },
  {
    slug: "igf-1-lr3-0-1mg",
    name: "IGF-1 LR3 0.1mg",
    dose_mg: 1,
    category_slug: "growth-hormone",
    cas_number: "946870-92-4",
    molecular_formula: "C400H625N111O115S9",
    molecular_weight: 9111.10,
    sequence: "Long R3 IGF-1 (83-residue analog with N-terminal extension and Arg-3 substitution)",
    summary:
      "Long Arg3 IGF-1 — extended-half-life IGF-1 analog used in muscle-research models.",
    research_context:
      "Tomas et al., Endocrinology (1993).",
    vial_image: vialPath("igf-1-lr3-0-1mg", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 1, pack_size: 1, sku: "BGP-IGF1-01", wholesale_cost: 13.0, retail_price: 65.0 },
    ],
  },
  {
    slug: "igf-1-lr3-1mg",
    name: "IGF-1 LR3 1mg",
    dose_mg: 1,
    category_slug: "growth-hormone",
    cas_number: "946870-92-4",
    molecular_formula: "C400H625N111O115S9",
    molecular_weight: 9111.10,
    sequence: "Long R3 IGF-1 analog",
    summary:
      "Long Arg3 IGF-1 — research-volume vial.",
    research_context:
      "Tomas et al., Endocrinology (1993).",
    vial_image: vialPath("igf-1-lr3-1mg", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 1, pack_size: 1, sku: "BGP-IGF1-1", wholesale_cost: 67.5, retail_price: 175.0 },
    ],
  },
  {
    slug: "follistatin-344-1mg",
    name: "Follistatin-344 1mg",
    dose_mg: 1,
    category_slug: "growth-hormone",
    cas_number: "80449-31-6",
    molecular_formula: "C1551H2438N430O462S26",
    molecular_weight: 35189.82,
    sequence: "344-residue myostatin-binding glycoprotein",
    summary:
      "Activin / myostatin antagonist studied in muscle-research literature.",
    research_context:
      "Lee, Annu Rev Cell Dev Biol (2004).",
    vial_image: vialPath("follistatin-344-1mg", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 1, pack_size: 1, sku: "BGP-FOLL-1", wholesale_cost: 77.0, retail_price: 200.0 },
    ],
  },
  {
    slug: "hgh-fragment-176-191",
    name: "HGH Fragment 176-191",
    dose_mg: 5,
    category_slug: "growth-hormone",
    cas_number: "66004-57-7",
    molecular_formula: "C78H123N23O23S2",
    molecular_weight: 1817.07,
    sequence: "Tyr-Leu-Arg-Ile-Val-Gln-Cys-Arg-Ser-Val-Glu-Gly-Ser-Cys-Gly-Phe (176-191 fragment)",
    summary:
      "C-terminal 16-residue fragment of human growth hormone studied in lipolysis research.",
    research_context:
      "Heffernan et al., J Endocrinol (2001).",
    vial_image: vialPath("hgh-fragment-176-191", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 5, pack_size: 1, sku: "BGP-HGHF-5", wholesale_cost: 37.5, retail_price: 110.0 },
      { size_mg: 10, pack_size: 1, sku: "BGP-HGHF-10", wholesale_cost: 42.75, retail_price: 150.0 },
    ],
  },
  {
    slug: "bpc-157",
    name: "BPC-157",
    dose_mg: 5,
    category_slug: "tissue-repair",
    cas_number: "137525-51-0",
    molecular_formula: "C62H98N16O22",
    molecular_weight: 1419.55,
    sequence: "Gly-Glu-Pro-Pro-Pro-Gly-Lys-Pro-Ala-Asp-Asp-Ala-Gly-Leu-Val",
    summary:
      "15-amino-acid synthetic pentadecapeptide derived from body-protection compound. Tissue-repair research peptide.",
    research_context:
      "Sikiric et al., J Physiol Pharmacol (2014). Gwyer, Wragg & Wilson, Cell Tissue Res (2019).",
    vial_image: vialPath("bpc-157", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 5, pack_size: 1, sku: "BGP-BPC-5", wholesale_cost: 17.0, retail_price: 90.0 },
      { size_mg: 10, pack_size: 1, sku: "BGP-BPC-10", wholesale_cost: 22.5, retail_price: 140.0 },
    ],
  },
  {
    slug: "tb-500",
    name: "TB-500",
    dose_mg: 5,
    category_slug: "tissue-repair",
    cas_number: "77591-33-4",
    molecular_formula: "C212H350N56O78S",
    molecular_weight: 4963.44,
    sequence: "N-Ac-SDKPDMAEIEKFDKSKLKKTETQEKNPLPSKETIEQEKQAGES",
    summary:
      "Synthetic acetylated thymosin-β4 (1-43) analog. Studied in tissue-regeneration research.",
    research_context:
      "Goldstein et al., Ann NY Acad Sci (2012).",
    vial_image: vialPath("tb-500", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 5, pack_size: 1, sku: "BGP-TB-5", wholesale_cost: 28.0, retail_price: 110.0 },
      { size_mg: 10, pack_size: 1, sku: "BGP-TB-10", wholesale_cost: 49.5, retail_price: 170.0 },
    ],
  },
  {
    slug: "ghk-cu",
    name: "GHK-Cu",
    dose_mg: 50,
    category_slug: "tissue-repair",
    cas_number: "89030-95-5",
    molecular_formula: "C14H24CuN6O4",
    molecular_weight: 403.93,
    sequence: "Gly-His-Lys + Cu²⁺",
    summary:
      "Copper tripeptide-1. Studied in extracellular-matrix and fibroblast research.",
    research_context:
      "Pickart & Margolina, Biomed Res Int (2018).",
    vial_image: vialPath("ghk-cu", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 50, pack_size: 1, sku: "BGP-GHK-50", wholesale_cost: 11.75, retail_price: 90.0 },
      { size_mg: 100, pack_size: 1, sku: "BGP-GHK-100", wholesale_cost: 14.75, retail_price: 130.0 },
    ],
  },
  {
    slug: "ahk-cu",
    name: "AHK-Cu",
    dose_mg: 20,
    category_slug: "tissue-repair",
    cas_number: "76172-89-7",
    molecular_formula: "C15H26CuN6O3",
    molecular_weight: 401.95,
    sequence: "Ala-His-Lys + Cu²⁺",
    summary:
      "Copper tripeptide variant studied in hair-follicle and dermal-research literature.",
    research_context:
      "Trüeb, Int J Trichology (2013).",
    vial_image: vialPath("ahk-cu", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 20, pack_size: 1, sku: "BGP-AHK-20", wholesale_cost: 35.0, retail_price: 80.0 },
      { size_mg: 50, pack_size: 1, sku: "BGP-AHK-50", wholesale_cost: 55.0, retail_price: 115.0 },
    ],
  },
  {
    slug: "kpv",
    name: "KPV",
    dose_mg: 5,
    category_slug: "tissue-repair",
    cas_number: "67727-97-3",
    molecular_formula: "C19H27N5O4",
    molecular_weight: 389.45,
    sequence: "Lys-Pro-Val (α-MSH 11-13)",
    summary:
      "C-terminal α-MSH tripeptide studied in inflammation and gut-mucosal research.",
    research_context:
      "Cutuli et al., Peptides (2000).",
    vial_image: vialPath("kpv", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 5, pack_size: 1, sku: "BGP-KPV-5", wholesale_cost: 13.5, retail_price: 70.0 },
      { size_mg: 10, pack_size: 1, sku: "BGP-KPV-10", wholesale_cost: 17.0, retail_price: 100.0 },
    ],
  },
  {
    slug: "larazatide-5mg",
    name: "Larazatide 5mg",
    dose_mg: 5,
    category_slug: "tissue-repair",
    cas_number: "258818-34-7",
    molecular_formula: "C40H69N15O14",
    molecular_weight: 1000.07,
    sequence: "Gly-Gly-Val-Leu-Val-Gln-Pro-Gly",
    summary:
      "Synthetic octapeptide studied in tight-junction and intestinal-permeability research.",
    research_context:
      "Paterson et al., Aliment Pharmacol Ther (2007).",
    vial_image: vialPath("larazatide-5mg", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 5, pack_size: 1, sku: "BGP-LAR-5", wholesale_cost: 37.5, retail_price: 115.0 },
    ],
  },
  {
    slug: "ll-37-5mg",
    name: "LL-37 (Cathelicidin) 5mg",
    dose_mg: 5,
    category_slug: "tissue-repair",
    cas_number: "154947-66-7",
    molecular_formula: "C205H340N60O53",
    molecular_weight: 4493.27,
    sequence: "LLGDFFRKSKEKIGKEFKRIVQRIKDFLRNLVPRTES",
    summary:
      "37-residue human cathelicidin antimicrobial peptide studied in innate-immunity and wound-healing research.",
    research_context:
      "Vandamme et al., Cell Immunol (2012).",
    vial_image: vialPath("ll-37-5mg", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 5, pack_size: 1, sku: "BGP-LL37-5", wholesale_cost: 30.0, retail_price: 100.0 },
    ],
  },
  {
    slug: "selank",
    name: "Selank",
    dose_mg: 5,
    category_slug: "cognitive",
    cas_number: "129954-34-3",
    molecular_formula: "C33H57N11O9",
    molecular_weight: 751.88,
    sequence: "Thr-Lys-Pro-Arg-Pro-Gly-Pro",
    summary:
      "Synthetic tuftsin analog studied in anxiolytic and immunomodulatory research literature.",
    research_context:
      "Kost et al., Bull Exp Biol Med (2001).",
    vial_image: vialPath("selank", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 5, pack_size: 1, sku: "BGP-SEL-5", wholesale_cost: 13.5, retail_price: 70.0 },
      { size_mg: 10, pack_size: 1, sku: "BGP-SEL-10", wholesale_cost: 22.5, retail_price: 115.0 },
    ],
  },
  {
    slug: "semax",
    name: "Semax",
    dose_mg: 5,
    category_slug: "cognitive",
    cas_number: "80714-61-0",
    molecular_formula: "C37H51N9O10S",
    molecular_weight: 813.91,
    sequence: "Met-Glu-His-Phe-Pro-Gly-Pro",
    summary:
      "Synthetic ACTH (4-7) analog studied in neuroprotection and BDNF-pathway research.",
    research_context:
      "Ashmarin et al., Patol Fiziol Eksp Ter (1995).",
    vial_image: vialPath("semax", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 5, pack_size: 1, sku: "BGP-SEMX-5", wholesale_cost: 12.5, retail_price: 70.0 },
      { size_mg: 10, pack_size: 1, sku: "BGP-SEMX-10", wholesale_cost: 20.25, retail_price: 110.0 },
    ],
  },
  {
    slug: "cerebrolysin-60mg",
    name: "Cerebrolysin 60mg",
    dose_mg: 60,
    category_slug: "cognitive",
    cas_number: "12656-61-0",
    molecular_formula: null,
    molecular_weight: null,
    sequence: "Porcine brain-derived neuropeptide complex (mixture)",
    summary:
      "Porcine brain-derived neuropeptide preparation studied in neurotrophic and neuroprotection research.",
    research_context:
      "Plosker & Gauthier, CNS Drugs (2009).",
    vial_image: vialPath("cerebrolysin-60mg", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 60, pack_size: 1, sku: "BGP-CER-60", wholesale_cost: 15.0, retail_price: 80.0 },
    ],
  },
  {
    slug: "cartalax-20mg",
    name: "Cartalax 20mg",
    dose_mg: 20,
    category_slug: "cognitive",
    cas_number: "1417266-58-6",
    molecular_formula: "C18H30N6O6",
    molecular_weight: 426.47,
    sequence: "Ala-Glu-Asp-Pro",
    summary:
      "Synthetic peptide bioregulator studied in joint and cartilage research models.",
    research_context:
      "Khavinson, Bull Exp Biol Med (2002).",
    vial_image: vialPath("cartalax-20mg", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 20, pack_size: 1, sku: "BGP-CAR-20", wholesale_cost: 25.0, retail_price: 90.0 },
    ],
  },
  {
    slug: "dsip",
    name: "DSIP",
    dose_mg: 5,
    category_slug: "cognitive",
    cas_number: "62568-57-4",
    molecular_formula: "C35H48N10O15",
    molecular_weight: 848.81,
    sequence: "Trp-Ala-Gly-Gly-Asp-Ala-Ser-Gly-Glu",
    summary:
      "Delta-sleep-inducing nonapeptide studied in sleep-architecture research.",
    research_context:
      "Schoenenberger, Eur Neurol (1984).",
    vial_image: vialPath("dsip", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 5, pack_size: 1, sku: "BGP-DSIP-5", wholesale_cost: 18.0, retail_price: 75.0 },
      { size_mg: 10, pack_size: 1, sku: "BGP-DSIP-10", wholesale_cost: 33.0, retail_price: 115.0 },
    ],
  },
  {
    slug: "dihexa",
    name: "Dihexa",
    dose_mg: 5,
    category_slug: "cognitive",
    cas_number: "1401708-83-5",
    molecular_formula: "C44H58N6O6",
    molecular_weight: 766.97,
    sequence: "N-hexanoic-Tyr-Ile-(6) aminohexanoic amide",
    summary:
      "Angiotensin IV analog studied in synaptogenesis and HGF/c-Met receptor research.",
    research_context:
      "McCoy et al., J Pharmacol Exp Ther (2013).",
    vial_image: vialPath("dihexa", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 5, pack_size: 1, sku: "BGP-DIH-5", wholesale_cost: 34.0, retail_price: 100.0 },
      { size_mg: 10, pack_size: 1, sku: "BGP-DIH-10", wholesale_cost: 45.0, retail_price: 150.0 },
    ],
  },
  {
    slug: "humanin",
    name: "Humanin",
    dose_mg: 5,
    category_slug: "cognitive",
    cas_number: "330936-69-1",
    molecular_formula: "C129H205N37O30S2",
    molecular_weight: 2849.36,
    sequence: "MAPRGFSCLLLLTSEIDLPVKRRA (24-residue mitochondrial-derived peptide)",
    summary:
      "24-residue mitochondrial-derived peptide studied in cytoprotection and Alzheimer's research.",
    research_context:
      "Hashimoto et al., PNAS (2001).",
    vial_image: vialPath("humanin", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 5, pack_size: 1, sku: "BGP-HUM-5", wholesale_cost: 26.0, retail_price: 90.0 },
      { size_mg: 10, pack_size: 1, sku: "BGP-HUM-10", wholesale_cost: 45.0, retail_price: 140.0 },
    ],
  },
  {
    slug: "pe-22-28-5mg",
    name: "PE-22-28 5mg",
    dose_mg: 5,
    category_slug: "cognitive",
    cas_number: null,
    molecular_formula: "C36H58N12O8",
    molecular_weight: 778.93,
    sequence: "Spadin-derived 7-residue peptide",
    summary:
      "Spadin-derived peptide studied in TREK-1 channel and depression research models.",
    research_context:
      "Mazella et al., PLoS Biol (2010).",
    vial_image: vialPath("pe-22-28-5mg", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 5, pack_size: 1, sku: "BGP-PE2228-5", wholesale_cost: 24.0, retail_price: 85.0 },
    ],
  },
  {
    slug: "pinealon",
    name: "Pinealon",
    dose_mg: 10,
    category_slug: "cognitive",
    cas_number: "117811-42-2",
    molecular_formula: "C13H20N4O6",
    molecular_weight: 328.32,
    sequence: "Glu-Asp-Arg",
    summary:
      "Pineal-gland-derived synthetic tripeptide studied in cognitive-aging research.",
    research_context:
      "Khavinson et al., Neuro Endocrinol Lett (2011).",
    vial_image: vialPath("pinealon", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 10, pack_size: 1, sku: "BGP-PIN-10", wholesale_cost: 23.0, retail_price: 80.0 },
      { size_mg: 20, pack_size: 1, sku: "BGP-PIN-20", wholesale_cost: 31.5, retail_price: 115.0 },
    ],
  },
  {
    slug: "ara-290",
    name: "ARA-290",
    dose_mg: 5,
    category_slug: "cognitive",
    cas_number: "1208243-50-8",
    molecular_formula: "C46H73N15O20",
    molecular_weight: 1156.16,
    sequence: "Cibinetide — 11-residue erythropoietin-derived peptide",
    summary:
      "Erythropoietin-derived 11-residue research peptide studied in neuropathy and tissue-protection literature.",
    research_context:
      "Brines et al., Mol Med (2014).",
    vial_image: vialPath("ara-290", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 5, pack_size: 1, sku: "BGP-ARA-5", wholesale_cost: 16.25, retail_price: 70.0 },
      { size_mg: 10, pack_size: 1, sku: "BGP-ARA-10", wholesale_cost: 23.0, retail_price: 115.0 },
    ],
  },
  {
    slug: "epitalon",
    name: "Epitalon",
    dose_mg: 10,
    category_slug: "longevity",
    cas_number: "307297-39-8",
    molecular_formula: "C14H22N4O9",
    molecular_weight: 390.35,
    sequence: "Ala-Glu-Asp-Gly",
    summary:
      "Pineal tetrapeptide bioregulator studied in telomere and aging-related research.",
    research_context:
      "Khavinson et al., Neuro Endocrinol Lett (2003).",
    vial_image: vialPath("epitalon", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 10, pack_size: 1, sku: "BGP-EPI-10", wholesale_cost: 17.0, retail_price: 80.0 },
      { size_mg: 50, pack_size: 1, sku: "BGP-EPI-50", wholesale_cost: 49.5, retail_price: 145.0 },
    ],
  },
  {
    slug: "mots-c",
    name: "MOTS-c",
    dose_mg: 10,
    category_slug: "longevity",
    cas_number: "1627580-64-6",
    molecular_formula: "C82H134N22O22S",
    molecular_weight: 1820.18,
    sequence: "Mitochondrial 12S rRNA-encoded 16-residue peptide",
    summary:
      "Mitochondrial-derived 16-residue peptide studied in metabolic-homeostasis and exercise-physiology research.",
    research_context:
      "Lee et al., Cell Metab (2015).",
    vial_image: vialPath("mots-c", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 10, pack_size: 1, sku: "BGP-MOTS-10", wholesale_cost: 24.75, retail_price: 115.0 },
      { size_mg: 40, pack_size: 1, sku: "BGP-MOTS-40", wholesale_cost: 65.25, retail_price: 220.0 },
    ],
  },
  {
    slug: "ss-31-10mg",
    name: "SS-31 (Elamipretide) 10mg",
    dose_mg: 10,
    category_slug: "longevity",
    cas_number: "736992-21-5",
    molecular_formula: "C32H49N9O5",
    molecular_weight: 639.79,
    sequence: "D-Arg-2′,6′-dimethyl-Tyr-Lys-Phe-NH2",
    summary:
      "Mitochondria-targeting tetrapeptide studied in mitochondrial dysfunction and cardiolipin research.",
    research_context:
      "Szeto, Br J Pharmacol (2014).",
    vial_image: vialPath("ss-31-10mg", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 10, pack_size: 1, sku: "BGP-SS31-10", wholesale_cost: 31.5, retail_price: 110.0 },
    ],
  },
  {
    slug: "foxo4-dri-10mg",
    name: "FOXO4-DRI 10mg",
    dose_mg: 10,
    category_slug: "longevity",
    cas_number: null,
    molecular_formula: "C108H192N42O28",
    molecular_weight: 2474.88,
    sequence: "D-retro-inverso FOXO4-p53 interaction peptide",
    summary:
      "D-retro-inverso peptide studied in senolytic and FOXO4-p53 interaction research.",
    research_context:
      "Baar et al., Cell (2017).",
    vial_image: vialPath("foxo4-dri-10mg", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 10, pack_size: 1, sku: "BGP-FOXO-10", wholesale_cost: 86.5, retail_price: 230.0 },
    ],
  },
  {
    slug: "5-amino-1mq",
    name: "5-Amino-1MQ",
    dose_mg: 5,
    category_slug: "longevity",
    cas_number: "1414747-22-4",
    molecular_formula: "C10H10N2",
    molecular_weight: 158.20,
    sequence: null,
    summary:
      "Small-molecule NNMT inhibitor studied in metabolic and adipose-research models.",
    research_context:
      "Neelakantan et al., Biochem Pharmacol (2018).",
    vial_image: vialPath("5-amino-1mq", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 5, pack_size: 1, sku: "BGP-5A1MQ-5", wholesale_cost: 22.5, retail_price: 80.0 },
      { size_mg: 10, pack_size: 1, sku: "BGP-5A1MQ-10", wholesale_cost: 33.75, retail_price: 130.0 },
    ],
  },
  {
    slug: "aicar",
    name: "AICAR",
    dose_mg: 50,
    category_slug: "longevity",
    cas_number: "2627-69-2",
    molecular_formula: "C9H14N4O5",
    molecular_weight: 258.23,
    sequence: null,
    summary:
      "AMPK activator nucleoside studied in metabolic and exercise-mimetic research.",
    research_context:
      "Narkar et al., Cell (2008).",
    vial_image: vialPath("aicar", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 50, pack_size: 1, sku: "BGP-AICAR-50", wholesale_cost: 24.0, retail_price: 80.0 },
      { size_mg: 100, pack_size: 1, sku: "BGP-AICAR-100", wholesale_cost: 34.0, retail_price: 120.0 },
    ],
  },
  {
    slug: "aod-9604",
    name: "AOD-9604",
    dose_mg: 5,
    category_slug: "longevity",
    cas_number: "221231-10-3",
    molecular_formula: "C78H123N23O23S2",
    molecular_weight: 1817.06,
    sequence: "HGH 177-191 fragment with Tyr-α2-MSH N-terminal modification",
    summary:
      "Modified HGH C-terminal fragment studied in lipolysis-research models.",
    research_context:
      "Heffernan et al., J Endocrinol (2001).",
    vial_image: vialPath("aod-9604", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 5, pack_size: 1, sku: "BGP-AOD-5", wholesale_cost: 32.75, retail_price: 90.0 },
      { size_mg: 10, pack_size: 1, sku: "BGP-AOD-10", wholesale_cost: 50.75, retail_price: 145.0 },
    ],
  },
  {
    slug: "adipotide",
    name: "Adipotide",
    dose_mg: 5,
    category_slug: "longevity",
    cas_number: "859209-74-6",
    molecular_formula: "C108H162N32O27",
    molecular_weight: 2334.65,
    sequence: "CKGGRAKDC-GG-D(KLAKLAK)2",
    summary:
      "Targeted pro-apoptotic peptidomimetic studied in adipose-research models.",
    research_context:
      "Barnhart et al., Sci Transl Med (2011).",
    vial_image: vialPath("adipotide", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 5, pack_size: 1, sku: "BGP-ADP-5", wholesale_cost: 61.0, retail_price: 150.0 },
      { size_mg: 10, pack_size: 1, sku: "BGP-ADP-10", wholesale_cost: 75.0, retail_price: 220.0 },
    ],
  },
  {
    slug: "slu-pp-332-5mg",
    name: "SLU-PP-332 5mg",
    dose_mg: 5,
    category_slug: "longevity",
    cas_number: null,
    molecular_formula: "C28H30N4O3",
    molecular_weight: 470.57,
    sequence: null,
    summary:
      "ERR (estrogen-related receptor) agonist studied in mitochondrial-biogenesis and exercise-mimetic research.",
    research_context:
      "Billon et al., Nat Metab (2024).",
    vial_image: vialPath("slu-pp-332-5mg", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 5, pack_size: 1, sku: "BGP-SLU-5", wholesale_cost: 45.0, retail_price: 130.0 },
    ],
  },
  {
    slug: "nad",
    name: "NAD+",
    dose_mg: 100,
    category_slug: "longevity",
    cas_number: "53-84-9",
    molecular_formula: "C21H27N7O14P2",
    molecular_weight: 663.43,
    sequence: null,
    summary:
      "Nicotinamide adenine dinucleotide — cellular redox cofactor studied in sirtuin and mitochondrial research.",
    research_context:
      "Covarrubias et al., Nat Rev Mol Cell Biol (2021).",
    vial_image: vialPath("nad", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 100, pack_size: 1, sku: "BGP-NAD-100", wholesale_cost: 13.0, retail_price: 65.0 },
      { size_mg: 500, pack_size: 1, sku: "BGP-NAD-500", wholesale_cost: 30.0, retail_price: 130.0 },
      { size_mg: 1000, pack_size: 1, sku: "BGP-NAD-1000", wholesale_cost: 35.0, retail_price: 180.0 },
    ],
  },
  {
    slug: "glutathione-1500mg",
    name: "Glutathione 1500mg",
    dose_mg: 1500,
    category_slug: "longevity",
    cas_number: "70-18-8",
    molecular_formula: "C10H17N3O6S",
    molecular_weight: 307.32,
    sequence: "γ-Glu-Cys-Gly",
    summary:
      "Reduced glutathione tripeptide — master antioxidant studied in oxidative-stress research.",
    research_context:
      "Forman et al., Mol Aspects Med (2009).",
    vial_image: vialPath("glutathione-1500mg", "vial-10ml"),
    container: "vial-10ml",
    variants: [
      { size_mg: 1500, pack_size: 1, sku: "BGP-GLUT-1500", wholesale_cost: 22.5, retail_price: 90.0 },
    ],
  },
  {
    slug: "thymosin-alpha-1-5mg",
    name: "Thymosin Alpha-1 5mg",
    dose_mg: 5,
    category_slug: "immune",
    cas_number: "62304-98-7",
    molecular_formula: "C129H215N33O55",
    molecular_weight: 3108.30,
    sequence: "N-Ac-SDAAVDTSSEITTKDLKEKKEVVEEAEN",
    summary:
      "28-residue acetylated thymic peptide studied in immune-modulation research.",
    research_context:
      "Goldstein et al., Ann NY Acad Sci (2007).",
    vial_image: vialPath("thymosin-alpha-1-5mg", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 5, pack_size: 1, sku: "BGP-TA1-5", wholesale_cost: 31.0, retail_price: 115.0 },
    ],
  },
  {
    slug: "thymalin-10mg",
    name: "Thymalin 10mg",
    dose_mg: 10,
    category_slug: "immune",
    cas_number: null,
    molecular_formula: null,
    molecular_weight: null,
    sequence: "Bovine thymus-derived peptide complex",
    summary:
      "Thymus-derived peptide complex studied in immune-aging research models.",
    research_context:
      "Khavinson, Adv Gerontol (2002).",
    vial_image: vialPath("thymalin-10mg", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 10, pack_size: 1, sku: "BGP-THY-10", wholesale_cost: 21.5, retail_price: 90.0 },
    ],
  },
  {
    slug: "pt-141-10mg",
    name: "PT-141 (Bremelanotide) 10mg",
    dose_mg: 10,
    category_slug: "sexual-wellness",
    cas_number: "189691-06-3",
    molecular_formula: "C50H68N14O10",
    molecular_weight: 1025.18,
    sequence: "Ac-Nle-cyclo[Asp-His-D-Phe-Arg-Trp-Lys]-OH",
    summary:
      "Cyclic heptapeptide melanocortin agonist studied in libido and sexual-physiology research.",
    research_context:
      "Diamond et al., J Sex Med (2006).",
    vial_image: vialPath("pt-141-10mg", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 10, pack_size: 1, sku: "BGP-PT141-10", wholesale_cost: 24.0, retail_price: 90.0 },
    ],
  },
  {
    slug: "melanotan-1-10mg",
    name: "Melanotan-1 10mg",
    dose_mg: 10,
    category_slug: "sexual-wellness",
    cas_number: "75921-69-6",
    molecular_formula: "C78H111N21O19",
    molecular_weight: 1646.86,
    sequence: "Ac-Ser-Tyr-Ser-Nle-Glu-His-D-Phe-Arg-Trp-Gly-Lys-Pro-Val-NH2",
    summary:
      "13-residue α-MSH analog studied in melanogenesis research.",
    research_context:
      "Hadley & Dorr, Peptides (2006).",
    vial_image: vialPath("melanotan-1-10mg", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 10, pack_size: 1, sku: "BGP-MT1-10", wholesale_cost: 17.0, retail_price: 80.0 },
    ],
  },
  {
    slug: "melanotan-2-10mg",
    name: "Melanotan-2 10mg",
    dose_mg: 10,
    category_slug: "sexual-wellness",
    cas_number: "121062-08-6",
    molecular_formula: "C50H69N15O9",
    molecular_weight: 1024.18,
    sequence: "Ac-Nle-cyclo[Asp-His-D-Phe-Arg-Trp-Lys]-NH2",
    summary:
      "Cyclic α-MSH analog studied in melanocortin and sexual-physiology research.",
    research_context:
      "Hadley & Dorr, Peptides (2006).",
    vial_image: vialPath("melanotan-2-10mg", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 10, pack_size: 1, sku: "BGP-MT2-10", wholesale_cost: 15.75, retail_price: 70.0 },
    ],
  },
  {
    slug: "oxytocin-acetate-2mg",
    name: "Oxytocin Acetate 2mg",
    dose_mg: 2,
    category_slug: "sexual-wellness",
    cas_number: "50-56-6",
    molecular_formula: "C43H66N12O12S2",
    molecular_weight: 1007.19,
    sequence: "Cys-Tyr-Ile-Gln-Asn-Cys-Pro-Leu-Gly-NH2 (cyclic)",
    summary:
      "Cyclic nonapeptide neurohypophyseal hormone studied in pair-bonding and social-behavior research.",
    research_context:
      "Lee et al., Prog Neurobiol (2009).",
    vial_image: vialPath("oxytocin-acetate-2mg", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 2, pack_size: 1, sku: "BGP-OXY-2", wholesale_cost: 13.5, retail_price: 70.0 },
    ],
  },
  {
    slug: "kisspeptin",
    name: "Kisspeptin",
    dose_mg: 5,
    category_slug: "sexual-wellness",
    cas_number: "374675-21-5",
    molecular_formula: "C63H83N17O14",
    molecular_weight: 1302.45,
    sequence: "Kisspeptin-10 (45-54)",
    summary:
      "GPR54 agonist decapeptide studied in HPG-axis and reproductive-research models.",
    research_context:
      "Pinilla et al., Physiol Rev (2012).",
    vial_image: vialPath("kisspeptin", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 5, pack_size: 1, sku: "BGP-KIS-5", wholesale_cost: 22.5, retail_price: 80.0 },
      { size_mg: 10, pack_size: 1, sku: "BGP-KIS-10", wholesale_cost: 37.0, retail_price: 125.0 },
    ],
  },
  {
    slug: "vip",
    name: "VIP",
    dose_mg: 5,
    category_slug: "sexual-wellness",
    cas_number: "37221-79-7",
    molecular_formula: "C147H237N43O43S",
    molecular_weight: 3326.81,
    sequence: "HSDAVFTDNYTRLRKQMAVKKYLNSILN-NH2",
    summary:
      "Vasoactive intestinal peptide studied in vasodilation, pulmonary, and reproductive research models.",
    research_context:
      "Said & Mutt, Eur J Biochem (1972).",
    vial_image: vialPath("vip", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 5, pack_size: 1, sku: "BGP-VIP-5", wholesale_cost: 28.0, retail_price: 100.0 },
      { size_mg: 10, pack_size: 1, sku: "BGP-VIP-10", wholesale_cost: 50.0, retail_price: 160.0 },
    ],
  },
  {
    slug: "klow-blend-80mg",
    name: "KLOW Blend 80mg",
    dose_mg: 80,
    category_slug: "specialty-blends",
    cas_number: null,
    molecular_formula: null,
    molecular_weight: null,
    sequence: "Multi-peptide research blend: GHK-Cu / BPC-157 / TB-500 / KPV",
    summary:
      "Pre-formulated tissue-repair research blend combining GHK-Cu, BPC-157, TB-500, and KPV in a single vial.",
    research_context:
      "See individual compound research contexts.",
    vial_image: vialPath("klow-blend-80mg", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 80, pack_size: 1, sku: "BGP-KLOW-80", wholesale_cost: 66.0, retail_price: 180.0 },
    ],
  },
  {
    slug: "glow-blend-70mg",
    name: "GLOW Blend 70mg",
    dose_mg: 70,
    category_slug: "specialty-blends",
    cas_number: null,
    molecular_formula: null,
    molecular_weight: null,
    sequence: "Multi-peptide research blend",
    summary:
      "Pre-formulated dermal / collagen-axis research blend in a single vial.",
    research_context:
      "See individual compound research contexts.",
    vial_image: vialPath("glow-blend-70mg", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 70, pack_size: 1, sku: "BGP-GLOW-70", wholesale_cost: 64.0, retail_price: 180.0 },
    ],
  },
  {
    slug: "bpc-tb-5-5mg",
    name: "BPC-157 / TB-500 5/5mg",
    dose_mg: 5,
    category_slug: "specialty-blends",
    cas_number: null,
    molecular_formula: null,
    molecular_weight: null,
    sequence: "BPC-157 5mg + TB-500 5mg blend",
    summary:
      "Pre-mixed BPC-157 + TB-500 tissue-repair research blend.",
    research_context:
      "See BPC-157 and TB-500 individual entries.",
    vial_image: vialPath("bpc-tb-5-5mg", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 5, pack_size: 1, sku: "BGP-BPCTB-55", wholesale_cost: 33.75, retail_price: 130.0 },
    ],
  },
  {
    slug: "bpc-tb-10-10mg",
    name: "BPC-157 / TB-500 10/10mg",
    dose_mg: 10,
    category_slug: "specialty-blends",
    cas_number: null,
    molecular_formula: null,
    molecular_weight: null,
    sequence: "BPC-157 10mg + TB-500 10mg blend",
    summary:
      "Pre-mixed BPC-157 + TB-500 — extended research vial.",
    research_context:
      "See BPC-157 and TB-500 individual entries.",
    vial_image: vialPath("bpc-tb-10-10mg", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 10, pack_size: 1, sku: "BGP-BPCTB-1010", wholesale_cost: 62.0, retail_price: 200.0 },
    ],
  },
  {
    slug: "cjc-ipa-5-5mg",
    name: "CJC-1295 (no DAC) + Ipamorelin 5/5mg",
    dose_mg: 5,
    category_slug: "specialty-blends",
    cas_number: null,
    molecular_formula: null,
    molecular_weight: null,
    sequence: "CJC-1295 (no DAC) 5mg + Ipamorelin 5mg blend",
    summary:
      "Pre-mixed GHRH analog + GHSR-1a agonist research blend.",
    research_context:
      "See CJC-1295 and Ipamorelin individual entries.",
    vial_image: vialPath("cjc-ipa-5-5mg", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 5, pack_size: 1, sku: "BGP-CJCIPA-55", wholesale_cost: 33.0, retail_price: 90.0 },
    ],
  },
  {
    slug: "super-human-blend-10ml",
    name: "Super Human Blend 10mL",
    dose_mg: 10,
    category_slug: "specialty-blends",
    cas_number: null,
    molecular_formula: null,
    molecular_weight: null,
    sequence: "Multi-peptide liquid research blend",
    summary:
      "Pre-formulated multi-peptide liquid research blend in a 10mL multi-dose vial.",
    research_context:
      "See individual compound research contexts.",
    vial_image: vialPath("super-human-blend-10ml", "vial-10ml"),
    container: "vial-10ml",
    variants: [
      { size_mg: 10, pack_size: 1, sku: "BGP-SHB-10ML", wholesale_cost: 29.25, retail_price: 130.0 },
    ],
  },
  {
    slug: "l-carnitine-10ml",
    name: "L-Carnitine (liquid) 10mL",
    dose_mg: 10,
    category_slug: "liquid-formulations",
    cas_number: "541-15-1",
    molecular_formula: "C7H15NO3",
    molecular_weight: 161.20,
    sequence: null,
    summary:
      "Liquid L-Carnitine research formulation, 600 mg/mL in 10mL multi-dose vial.",
    research_context:
      "Pekala et al., Curr Drug Metab (2011).",
    vial_image: vialPath("l-carnitine-10ml", "vial-10ml"),
    container: "vial-10ml",
    variants: [
      { size_mg: 10, pack_size: 1, sku: "BGP-LCAR-10ML", wholesale_cost: 24.75, retail_price: 80.0 },
    ],
  },
  {
    slug: "lc120-10ml",
    name: "LC120 (liquid) 10mL",
    dose_mg: 10,
    category_slug: "liquid-formulations",
    cas_number: null,
    molecular_formula: null,
    molecular_weight: null,
    sequence: "Liquid research blend (proprietary)",
    summary:
      "Pre-formulated liquid research blend in 10mL multi-dose vial.",
    research_context:
      null,
    vial_image: vialPath("lc120-10ml", "vial-10ml"),
    container: "vial-10ml",
    variants: [
      { size_mg: 10, pack_size: 1, sku: "BGP-LC120-10ML", wholesale_cost: 21.5, retail_price: 80.0 },
    ],
  },
  {
    slug: "lc216-10ml",
    name: "LC216 (liquid) 10mL",
    dose_mg: 10,
    category_slug: "liquid-formulations",
    cas_number: null,
    molecular_formula: null,
    molecular_weight: null,
    sequence: "Liquid research blend (proprietary)",
    summary:
      "Pre-formulated liquid research blend in 10mL multi-dose vial.",
    research_context:
      null,
    vial_image: vialPath("lc216-10ml", "vial-10ml"),
    container: "vial-10ml",
    variants: [
      { size_mg: 10, pack_size: 1, sku: "BGP-LC216-10ML", wholesale_cost: 21.5, retail_price: 80.0 },
    ],
  },
  {
    slug: "snap-8-10mg",
    name: "SNAP-8 10mg",
    dose_mg: 10,
    category_slug: "tissue-repair",
    cas_number: "868844-74-0",
    molecular_formula: "C40H64N12O14",
    molecular_weight: 936.99,
    sequence: "Ac-Glu-Glu-Met-Gln-Arg-Arg-NH2 (8-mer)",
    summary:
      "SNARE-mimetic research peptide studied in topical / dermal applications.",
    research_context:
      "Reddy et al., Int J Cosmet Sci (2010).",
    vial_image: vialPath("snap-8-10mg", "vial-3ml"),
    container: "vial-3ml",
    variants: [
      { size_mg: 10, pack_size: 1, sku: "BGP-SNAP8-10", wholesale_cost: 12.5, retail_price: 70.0 },
    ],
  },
  {
    slug: "snap-8-ghkcu-topical-serum-30ml",
    name: "SNAP-8 + GHK-Cu Topical Serum 30mL",
    dose_mg: 1,
    category_slug: "topicals",
    cas_number: null,
    molecular_formula: null,
    molecular_weight: null,
    sequence: "SNAP-8 + GHK-Cu in topical research vehicle",
    summary:
      "Topical research serum combining SNAP-8 and GHK-Cu — 30mL amber pump bottle.",
    research_context:
      "See SNAP-8 and GHK-Cu individual entries.",
    vial_image: vialPath("snap-8-ghkcu-topical-serum-30ml", "topical-bottle"),
    container: "topical-bottle",
    variants: [
      { size_mg: 1, pack_size: 1, sku: "BGP-SNAPGHK-30", wholesale_cost: 21.5, retail_price: 80.0 },
    ],
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

/** Per-vial / per-unit retail price for a given variant. */
export function perVialPrice(variant: CatalogVariant): number {
  return variant.retail_price / variant.pack_size;
}

// ---------- bundle supplies ----------
//
// Hidden from /catalogue (kept out of PRODUCTS) but reachable as cart
// line items via auto-add when a lyophilized peptide enters the cart.
// Pricing model: first unit of each variant is free, additional units
// charge retail_price. Quantity ratio: 1 supply per 5 lyo vials, ceil.
//
// User can decrement / remove supplies entirely (e.g. "I have plenty
// from last order") — auto-add only fires on add/upsize, never re-adds
// after a manual removal unless a *new* threshold crossing happens.

export const SUPPLIES: readonly CatalogProduct[] = [
  {
    slug: "bac-water-10ml",
    name: "Bacteriostatic Water 10ml",
    category_slug: "supplies",
    dose_mg: 0,
    cas_number: null,
    molecular_formula: null,
    molecular_weight: null,
    sequence: null,
    summary:
      "Sterile bacteriostatic water for reconstitution of lyophilized research peptides. 10ml multi-use vial.",
    research_context: null,
    vial_image: "/brand/supplies/bac-water.jpg",
    container: "supply",
    variants: [
      {
        size_mg: 10,
        pack_size: 1,
        sku: "BAC-WATER-10ML",
        wholesale_cost: 2,
        retail_price: 8,
        bundle_supply: true,
      },
    ],
  },
  {
    slug: "insulin-syringes-100",
    name: "Insulin Syringes 29G ½″ — pack of 100",
    category_slug: "supplies",
    dose_mg: 0,
    cas_number: null,
    molecular_formula: null,
    molecular_weight: null,
    sequence: null,
    summary:
      "Single-use 1ml insulin syringes (29G × ½″) for subcutaneous research administration. 100 per pack.",
    research_context: null,
    vial_image: "/brand/supplies/insulin-syringes.jpg",
    container: "supply",
    variants: [
      {
        size_mg: 0,
        pack_size: 1,
        sku: "SYRINGE-INSULIN-100",
        wholesale_cost: 4,
        retail_price: 15,
        bundle_supply: true,
      },
    ],
  },
  {
    slug: "draw-needles-100",
    name: "Draw Needles 18G — pack of 100",
    category_slug: "supplies",
    dose_mg: 0,
    cas_number: null,
    molecular_formula: null,
    molecular_weight: null,
    sequence: null,
    summary:
      "18-gauge drawing needles for transferring bacteriostatic water from vial to syringe during reconstitution. 100 per pack.",
    research_context: null,
    vial_image: "/brand/supplies/draw-needles.jpg",
    container: "supply",
    variants: [
      {
        size_mg: 0,
        pack_size: 1,
        sku: "NEEDLE-DRAW-100",
        wholesale_cost: 4,
        retail_price: 15,
        bundle_supply: true,
      },
    ],
  },
];

const SUPPLY_SKUS = new Set(
  SUPPLIES.flatMap((p) => p.variants.map((v) => v.sku)),
);

export function isSupplySku(sku: string): boolean {
  return SUPPLY_SKUS.has(sku);
}

export function getSupplyVariantBySku(
  sku: string,
): { product: CatalogProduct; variant: CatalogVariant } | undefined {
  for (const p of SUPPLIES) {
    const v = p.variants.find((v) => v.sku === sku);
    if (v) return { product: p, variant: v };
  }
  return undefined;
}

/**
 * Lyophilized vials require BAC water + needles to reconstitute.
 * Pre-mixed liquids, capsules, and topicals do not. Drives auto-add of
 * supplies in the cart.
 */
export function requiresReconstitution(product: CatalogProduct): boolean {
  if (product.category_slug === "liquid-formulations") return false;
  if (product.container === "capsule-bottle") return false;
  if (product.container === "topical-bottle") return false;
  if (product.container === "supply") return false;
  return true;
}
