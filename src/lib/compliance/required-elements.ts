/**
 * Required-element validator for product pages.
 *
 * Every product page must render:
 *   1. RUO banner (site-wide, handled by layout)
 *   2. Molecular data block (MW, MF, CAS, sequence, purity %)
 *   3. COA link for the current lot
 *   4. "Not a drug, supplement, or medical device" footer line
 *   5. Link to Terms of Sale
 *
 * This module exports a pure validator usable at render time and in tests.
 */

/**
 * Intentionally narrow local types — this validator works off the
 * minimal shape each page has at render time, not the full catalog row.
 * Decouples compliance from schema churn.
 */
export interface RequiredElementsProduct {
  name: string;
  cas_number: string | null;
  molecular_formula: string | null;
  molecular_weight: number | null;
}

export interface RequiredElementsVariant {
  purity_percent: number | null;
  coa_url: string | null;
  lot_number: string | null;
}

export interface RequiredElementsInput {
  product: RequiredElementsProduct;
  variant: RequiredElementsVariant;
  pageMarkup: string;
}

export interface MissingElement {
  element: string;
  framework_ref: string;
}

export function validateRequiredElements(input: RequiredElementsInput): MissingElement[] {
  const missing: MissingElement[] = [];
  const { product, variant, pageMarkup } = input;

  if (!product.cas_number) {
    missing.push({ element: "CAS number", framework_ref: "RUO framework §3 — molecular data required on every product page" });
  }
  if (!product.molecular_formula) {
    missing.push({ element: "molecular formula", framework_ref: "RUO framework §3" });
  }
  if (!product.molecular_weight) {
    missing.push({ element: "molecular weight", framework_ref: "RUO framework §3" });
  }
  if (!variant.purity_percent) {
    missing.push({ element: "purity %", framework_ref: "RUO framework §6 — quality signal requirement" });
  }
  if (!variant.coa_url) {
    missing.push({ element: "COA link", framework_ref: "RUO framework §6 — per-lot COA requirement" });
  }
  if (!variant.lot_number) {
    missing.push({ element: "lot number", framework_ref: "RUO framework §6 — lot traceability" });
  }

  // Markup-level checks — require RUO strings to be present in the rendered page
  const ruoStatement = /for laboratory research use only/i;
  if (!ruoStatement.test(pageMarkup)) {
    missing.push({ element: "RUO statement on page", framework_ref: "RUO framework §3 — RUO line required per product" });
  }
  const notDrug = /not a drug,\s*supplement,\s*or medical device/i;
  if (!notDrug.test(pageMarkup)) {
    missing.push({ element: 'required "Not a drug, supplement, or medical device" line', framework_ref: "RUO framework §3" });
  }
  if (!/\/terms/i.test(pageMarkup)) {
    missing.push({ element: "link to Terms of Sale", framework_ref: "RUO framework §7" });
  }

  return missing;
}
