import type { Metadata } from "next";
import { CartPageClient } from "./CartPageClient";

export const metadata: Metadata = {
  title: "Cart",
  description: "Your Bench Grade Peptides cart.",
  robots: { index: false, follow: false },
};

export default function CartPage() {
  return <CartPageClient />;
}
