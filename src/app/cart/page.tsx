import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Cart",
  description: "Your Bench Grade Peptides cart.",
};

export default function CartPage() {
  return (
    <article className="max-w-3xl mx-auto px-6 lg:px-10 py-20 lg:py-28">
      <div className="label-eyebrow text-ink-muted mb-6">Cart</div>
      <h1 className="font-display text-5xl lg:text-6xl leading-tight text-ink mb-10">
        Your cart.
      </h1>

      <div className="border rule bg-paper-soft p-12 text-center">
        <p className="text-ink-soft mb-6">
          Your cart is empty. Browse the catalog to add research compounds.
        </p>
        <Link
          href="/catalog"
          className="inline-flex items-center h-12 px-8 bg-ink text-paper text-sm tracking-[0.04em] hover:bg-teal transition-colors"
        >
          Browse the catalog
        </Link>
      </div>

      <p className="mt-8 text-xs text-ink-muted leading-relaxed">
        Cart persistence and checkout flow ship in the next phase alongside the server-side RUO
        acknowledgment pipeline.
      </p>
    </article>
  );
}
