/**
 * Payment methods available at checkout.
 *
 * No card processor in the launch config — Bench Grade is wire / ACH /
 * Zelle / crypto only. Each method is independently gated behind
 * env vars so the UI only offers options that are actually funded +
 * configured. Missing env var = hidden method, no broken button.
 */

export const PAYMENT_METHODS = ["wire", "ach", "zelle", "crypto"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export function isPaymentMethod(v: unknown): v is PaymentMethod {
  return typeof v === "string" && (PAYMENT_METHODS as readonly string[]).includes(v);
}

/** Fastest-UX-first ordering for the checkout radio selector. */
const DISPLAY_ORDER: PaymentMethod[] = ["zelle", "crypto", "ach", "wire"];

/**
 * Returns which payment methods are currently ENABLED, gated on the
 * env vars that would be needed to actually fulfill the payment.
 *
 * Wire + ACH share the same underlying bank credentials (Relay
 * routing + account) — they're enabled together or not at all.
 * Zelle needs ZELLE_ID. Crypto needs a NOWPayments API key.
 */
export function enabledPaymentMethods(): PaymentMethod[] {
  const wireReady =
    !!process.env.WIRE_BENEFICIARY &&
    !!process.env.WIRE_BANK &&
    !!process.env.WIRE_ROUTING &&
    !!process.env.WIRE_ACCOUNT;
  const zelleReady = !!process.env.ZELLE_ID;
  // Crypto requires BOTH the API key (to create invoices) AND the IPN
  // secret (to verify incoming webhooks). Without the secret, a real
  // payment would clear at NOWPayments but never flip the order to
  // funded on our side — the customer pays and the order stalls.
  const cryptoReady =
    !!process.env.NOWPAYMENTS_API_KEY && !!process.env.NOWPAYMENTS_IPN_SECRET;

  return DISPLAY_ORDER.filter((m) => {
    if (m === "wire" || m === "ach") return wireReady;
    if (m === "zelle") return zelleReady;
    if (m === "crypto") return cryptoReady;
    return false;
  });
}

export function paymentMethodLabel(m: PaymentMethod): string {
  switch (m) {
    case "wire":
      return "Wire transfer";
    case "ach":
      return "ACH transfer";
    case "zelle":
      return "Zelle";
    case "crypto":
      return "Cryptocurrency";
  }
}

export function paymentMethodBlurb(m: PaymentMethod): string {
  switch (m) {
    case "wire":
      return "Same-day to 1 business day. Best for institutional buyers.";
    case "ach":
      return "2-3 business days. Lowest friction for bank-to-bank.";
    case "zelle":
      return "Instant for most major US banks. Orders under $500 only.";
    case "crypto":
      return "BTC, USDT, USDC and more. Converted to USDC on receipt.";
  }
}
