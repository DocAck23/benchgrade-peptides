import type { Metadata } from "next";
import { CheckoutPageClient } from "./CheckoutPageClient";
import { enabledPaymentMethods } from "@/lib/payments/methods";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Complete your Bench Grade Peptides order.",
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  // Server-side read of env vars determines which methods appear in the
  // selector. This isolates the env-var check to server code and keeps
  // the client bundle free of process.env references.
  const methods = enabledPaymentMethods();
  return <CheckoutPageClient availableMethods={methods} />;
}
