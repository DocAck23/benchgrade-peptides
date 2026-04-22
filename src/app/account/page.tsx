import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Account",
  description: "Your Bench Grade Peptides account.",
};

export default function AccountPage() {
  return (
    <article className="max-w-3xl mx-auto px-6 lg:px-10 py-20 lg:py-28">
      <div className="label-eyebrow text-ink-muted mb-6">Account</div>
      <h1 className="font-display text-5xl lg:text-6xl leading-tight text-ink mb-10">
        Account.
      </h1>

      <div className="border rule bg-paper-soft p-12 text-center">
        <p className="text-ink-soft mb-6">
          Account self-service is in development. Contact us for order status or historical COA
          lookups in the meantime.
        </p>
        <Link
          href="/contact"
          className="inline-flex items-center h-12 px-8 border rule text-sm text-ink tracking-[0.04em] hover:bg-paper transition-colors"
        >
          Contact
        </Link>
      </div>
    </article>
  );
}
