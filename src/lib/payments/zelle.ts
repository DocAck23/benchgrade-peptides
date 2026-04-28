/**
 * Zelle per-transaction cap. Most US banks default to $500 for new
 * Zelle business recipients; this rises to $1k–$5k as the relationship
 * matures with the bank. Bumping this constant updates the warning
 * copy in checkout, the accordion subtitle, and the success-page
 * payment-method block all at once.
 */
export const ZELLE_PER_TX_CAP_USD = 500;

/**
 * Format with a leading "$" for inline display in copy strings.
 */
export const ZELLE_PER_TX_CAP_LABEL = `$${ZELLE_PER_TX_CAP_USD}`;
