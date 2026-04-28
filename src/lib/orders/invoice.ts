/**
 * Display formatter for the orders.invoice_number sequence.
 *
 * The DB stores a plain integer (e.g. 196, 197, 198…); customer-
 * facing surfaces always render the padded `INV-00196` form so the
 * receipts look uniform regardless of where in the sequence the
 * order landed. Five digits is enough headroom for ~99k orders past
 * the seed.
 */
export function formatInvoiceNumber(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "INV-—";
  return `INV-${String(Math.floor(n)).padStart(5, "0")}`;
}
