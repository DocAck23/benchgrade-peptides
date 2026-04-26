import type { Metadata } from "next";
import { CheckoutPageClient } from "./CheckoutPageClient";
import { enabledPaymentMethods } from "@/lib/payments/methods";
import { getMyAffiliateState } from "@/app/actions/affiliate";
import type { AffiliateTier } from "@/lib/affiliate/tiers";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Complete your Bench Grade Peptides order.",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  // Server-side read of env vars determines which methods appear in the
  // selector. This isolates the env-var check to server code and keeps
  // the client bundle free of process.env references.
  const methods = enabledPaymentMethods();

  // Sprint 4 Wave C — pass affiliate state down so CheckoutPageClient can
  // render the personal-discount preview. This is COSMETIC; submitOrder
  // re-resolves the affiliate row server-side and applies the actual
  // discount. Best-effort: any error → no preview (order still works).
  let affiliate: { tier: AffiliateTier } | null = null;
  try {
    const state = await getMyAffiliateState();
    if (state.ok && state.is_affiliate && state.affiliate) {
      affiliate = { tier: state.affiliate.tier };
    }
  } catch {
    affiliate = null;
  }

  return (
    <CheckoutPageClient availableMethods={methods} affiliate={affiliate} />
  );
}
