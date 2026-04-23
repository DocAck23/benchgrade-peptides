import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Order received",
  description: "Your order has been received.",
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ id?: string }>;
}

export default async function CheckoutSuccessPage({ searchParams }: PageProps) {
  const { id } = await searchParams;
  return (
    <article className="max-w-3xl mx-auto px-6 lg:px-10 py-20 lg:py-28">
      <div className="label-eyebrow text-ink-muted mb-4">Order received</div>
      <h1 className="font-display text-5xl lg:text-6xl leading-tight text-ink mb-8">
        Thank you.
      </h1>
      <div className="border rule bg-paper-soft p-8 space-y-4">
        <p className="text-base text-ink leading-relaxed">
          Your order has been received and recorded with your RUO certification.
        </p>
        {id && (
          <p className="font-mono-data text-sm text-ink-muted">
            Reference: <span className="text-ink">{id}</span>
          </p>
        )}
        <p className="text-sm text-ink-soft leading-relaxed">
          A confirmation email with wire-transfer instructions is on its way to the address on your
          order. We ship within 1–2 business days of receiving funds.
        </p>
      </div>
      <div className="mt-10">
        <Link href="/catalog" className="text-sm text-teal hover:underline">
          ← Back to the catalog
        </Link>
      </div>
    </article>
  );
}
