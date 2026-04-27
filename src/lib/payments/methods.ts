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

/**
 * Customer-facing payment-account details, resolved server-side so env
 * vars never reach the browser bundle. The shape mirrors what we want
 * to render in each checkout-accordion panel and in the order-
 * confirmation email so the customer sees identical numbers in both
 * places. Only methods enabled by `enabledPaymentMethods` will have
 * non-null entries; every field is a plain string with no escaping
 * applied (callers must escape before HTML interpolation).
 */
export interface PaymentMethodDetails {
  wire: {
    beneficiary: string;
    beneficiaryAddress: string | null;
    bank: string;
    bankAddress: string | null;
    routing: string;
    account: string;
    accountType: "Checking";
  } | null;
  ach: {
    beneficiary: string;
    bank: string;
    routing: string;
    account: string;
    accountType: "Checking";
    instructionsUrl: string;
  } | null;
  zelle: {
    name: string;
    handle: string;
  } | null;
  crypto: {
    /** Whether NOWPayments hosted-link flow is enabled. */
    enabled: boolean;
  };
}

export function getPaymentMethodDetails(): PaymentMethodDetails {
  const enabled = enabledPaymentMethods();
  const has = (m: PaymentMethod) => enabled.includes(m);

  const wire = has("wire")
    ? {
        beneficiary: process.env.WIRE_BENEFICIARY ?? "Bench Grade Peptides LLC",
        beneficiaryAddress: process.env.WIRE_BENEFICIARY_ADDRESS ?? null,
        bank: process.env.WIRE_BANK ?? "",
        bankAddress: process.env.WIRE_BANK_ADDRESS ?? null,
        routing: process.env.WIRE_ROUTING ?? "",
        account: process.env.WIRE_ACCOUNT ?? "",
        accountType: "Checking" as const,
      }
    : null;

  const ach = has("ach")
    ? {
        beneficiary: process.env.WIRE_BENEFICIARY ?? "Bench Grade Peptides LLC",
        bank: process.env.WIRE_BANK ?? "",
        routing: process.env.WIRE_ROUTING ?? "",
        account: process.env.WIRE_ACCOUNT ?? "",
        accountType: "Checking" as const,
        instructionsUrl: "/payments/ach",
      }
    : null;

  const zelle = has("zelle")
    ? {
        name: process.env.WIRE_BENEFICIARY ?? "Bench Grade Peptides LLC",
        handle: process.env.ZELLE_ID ?? "",
      }
    : null;

  return {
    wire,
    ach,
    zelle,
    crypto: { enabled: has("crypto") },
  };
}
