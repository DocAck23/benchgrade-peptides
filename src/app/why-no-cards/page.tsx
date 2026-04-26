import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Why no cards? · Bench Grade Peptides",
  description:
    "A note from the bench on why Bench Grade Peptides doesn't accept credit cards yet — and why wire, ACH, Zelle, and crypto are the right rails for serious researchers.",
  alternates: { canonical: "/why-no-cards" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Why no cards? · Bench Grade Peptides",
    description:
      "A note from the bench on why we run on direct rails — wire, ACH, Zelle, crypto — instead of card processors.",
    url: "/why-no-cards",
    type: "article",
  },
  twitter: {
    card: "summary",
    title: "Why no cards? · Bench Grade Peptides",
    description:
      "A note from the bench on why we run on direct rails instead of card processors.",
  },
};

export default function WhyNoCardsPage() {
  return (
    <article className="max-w-2xl mx-auto px-6 lg:px-10 py-20 lg:py-28 bg-paper text-ink">
      <div className="label-eyebrow mb-6">A note from the bench</div>
      <h1 className="font-display text-4xl lg:text-5xl leading-tight text-ink mb-12">
        Why we don&rsquo;t take cards yet.
      </h1>

      <div className="space-y-10 font-editorial text-lg text-ink-soft leading-relaxed">
        <section>
          <h2 className="font-display text-2xl text-ink mb-4">
            The merchant landscape
          </h2>
          <p>
            Research-use-only peptides sit in a category that card processors
            scrutinize heavily. Stripe, Square, Shopify Payments, and the
            networks behind them classify the space as high-risk and routinely
            close accounts without notice &mdash; even for operators running
            clean compliance programs. Several premium-tier suppliers learned
            this the hard way in 2025 and 2026: Peptide Sciences, Amino
            Asylum, and Science.bio all lost their merchant relationships and
            ultimately wound down. We&rsquo;re operating on a different
            runway.
          </p>
        </section>

        <section data-surface="wine" className="px-6 py-8 -mx-6">
          <h2 className="font-display text-2xl text-paper mb-4">
            What this protects
          </h2>
          <p className="text-paper-soft">
            Wire, ACH, Zelle, and crypto are direct rails. There is no
            third-party processor with a thirty-day shut-off button between
            you and your order. There is no chargeback fraud &mdash; the most
            common abuse pattern in this industry &mdash; because direct
            settlement doesn&rsquo;t reverse on a whim. Processing fees are
            lower, and we don&rsquo;t pass them on to you. And privacy is
            different in kind: card networks log a merchant name on every
            statement; bank rails are opaque to your network.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink mb-4">
            Where we&rsquo;re going
          </h2>
          <p>
            Card processing is on the roadmap. Every order strengthens the
            case for premium merchant approval &mdash; established account
            history, a low chargeback rate, a clean compliance record. Until
            then, the four rails work. If anything, the slight friction is a
            feature for serious researchers who&rsquo;d rather pay by wire
            than by impulse.
          </p>
        </section>

        <hr className="rule border-t mt-16" />

        <div className="pt-8 flex flex-col items-start gap-6">
          <Link
            href="/checkout"
            className="font-display uppercase tracking-[0.18em] text-sm px-6 py-3 border border-gold-dark text-gold-dark hover:bg-gold-dark hover:text-paper transition-colors"
          >
            Back to checkout
          </Link>
          <p className="font-mono-data text-xs text-ink-muted">
            Last updated 2026-04-25
          </p>
        </div>
      </div>
    </article>
  );
}
