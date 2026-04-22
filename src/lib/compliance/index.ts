/**
 * Compliance barrel.
 *
 * Centralized import for RUO compliance utilities.
 * See /Users/ahmed/.claude/projects/-Users-ahmed-Research-Only-Peptides/memory/ruo_compliance_framework.md
 */

export { BANNED_TERMS, complianceLint, assertCompliant } from "./banned-terms";
export type { BannedTerm, BannedCategory, ComplianceViolation } from "./banned-terms";
export { validateRequiredElements } from "./required-elements";
export type { MissingElement, RequiredElementsInput } from "./required-elements";

export const RUO_STATEMENTS = {
  /** Single-line statement for product pages and banners */
  short: "For laboratory research use only. Not for human or veterinary use.",
  /** Disclaimer for every product page */
  product: "This product is for laboratory research use only. Not for human or veterinary use. Not a drug, supplement, or medical device.",
  /** Site-wide footer banner */
  banner: "All products sold for laboratory research purposes only. Not for human or veterinary use.",
  /** Customer certification at checkout */
  certification:
    "I certify that I am a researcher or a representative of a research institution. I will use this product solely for in vitro research purposes. I will not administer this product to humans or animals. I understand this product is not a drug, supplement, or medical device.",
} as const;
