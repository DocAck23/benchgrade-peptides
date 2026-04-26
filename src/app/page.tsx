import Link from "next/link";
import { Flag, QrCode, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ProductCarousel } from "@/components/catalog/ProductCarousel";

/**
 * Homepage — locked brand visual system (spec §16.1, §16.4).
 *
 * Wine hero · cream trust trio · cream featured carousel · cream editorial
 * callout · wine bottom CTA. Cinzel display, Cormorant editorial italic,
 * gold high-emphasis CTAs. Server-rendered for SEO.
 *
 * Strict scope: this file only. Catalog/cart/checkout/Logo/Layout/UI primitives
 * are owned by other Sprint 0 + Wave 2 tasks.
 */

const TRUST_TRIO = [
  {
    icon: Flag,
    eyebrow: "MADE IN USA",
    body: "Synthesized and tested stateside.",
  },
  {
    icon: QrCode,
    eyebrow: "QR-COA PER VIAL",
    body: "Scan any vial — receipts on demand.",
  },
  {
    icon: ShieldCheck,
    eyebrow: "≥99% HPLC VERIFIED",
    body: "Independent lab confirms purity per lot.",
  },
] as const;


export default function Home() {
  return (
    <div>
      {/* ── Hero — paper surface, wine + gold split headline ─────────── */}
      <section className="relative overflow-hidden bg-paper">
        <div className="max-w-[1280px] mx-auto px-5 sm:px-6 lg:px-10 py-24 sm:py-28 lg:py-32">
          <div className="max-w-4xl">
            <h1 className="font-display font-display-heavy text-[40px] leading-[1.05] sm:text-6xl lg:text-7xl xl:text-[80px] xl:leading-[1.02] tracking-tight">
              <span className="text-wine">Research peptides,</span>
              <br />
              <span className="text-gold-dark italic" style={{ fontFamily: "var(--font-editorial)" }}>
                synthesized stateside.
              </span>
            </h1>
            <p
              className="mt-6 sm:mt-8 text-xl sm:text-2xl lg:text-3xl italic leading-snug max-w-2xl text-ink-soft"
              style={{ fontFamily: "var(--font-editorial)" }}
            >
              Made in USA. Verified per lot. Receipts on every vial.
            </p>

            <div className="mt-10 sm:mt-12 flex flex-wrap items-center gap-6 sm:gap-8">
              <Link href="/catalog" className="inline-flex">
                <Button variant="gold" size="lg">
                  Browse the catalog
                </Button>
              </Link>
              <Link
                href="/why-no-cards"
                className="inline-flex items-center text-sm tracking-[0.04em] underline underline-offset-[6px] decoration-1 transition-colors duration-200 ease-[var(--ease-default)] hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 text-wine"
                style={{
                  textDecorationColor: "var(--color-gold)",
                }}
              >
                Why no cards? →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust trio ─────────────────────────────────────────────────── */}
      <section className="border-b rule" aria-label="What every order ships with">
        <div className="max-w-[1280px] mx-auto px-5 sm:px-6 lg:px-10 py-20 sm:py-24">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-10 lg:gap-16">
            {TRUST_TRIO.map(({ icon: Icon, eyebrow, body }) => (
              <div key={eyebrow} className="flex flex-col items-start">
                <Icon
                  size={24}
                  strokeWidth={1.75}
                  aria-hidden
                  style={{ color: "var(--color-gold-dark)" }}
                />
                <div
                  className="font-display mt-4 text-xs sm:text-sm uppercase tracking-[0.18em] font-semibold"
                  style={{ color: "var(--color-gold-dark)" }}
                >
                  {eyebrow}
                </div>
                <p className="mt-2 text-base sm:text-lg leading-snug text-ink">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Catalog + Build your stack (single wine surface) ────────────
          Combines the previously-split "From the catalog" carousel and
          "Build your stack" CTA into one cohesive wine-surface section.
          Carousel renders inline, gold "Build your stack" button below. */}
      <section data-surface="wine" className="border-t border-rule-wine">
        <div className="max-w-[1280px] mx-auto px-5 sm:px-6 lg:px-10 py-20 sm:py-24 lg:py-28">
          <div className="text-center mb-12 sm:mb-16">
            <div className="label-eyebrow text-gold-light mb-3 text-[11px] sm:text-xs">
              From the catalog
            </div>
            <h2 className="font-display font-display-heavy text-4xl sm:text-5xl lg:text-6xl tracking-tight text-paper">
              Build your stack.
            </h2>
            <p
              className="mt-5 text-lg sm:text-xl italic max-w-2xl mx-auto"
              style={{ fontFamily: "var(--font-editorial)", color: "var(--color-paper-soft)" }}
            >
              One catalog. One standard. Receipts on every vial.
            </p>
          </div>

          <div className="bg-paper rounded-sm overflow-hidden border border-rule-wine">
            <ProductCarousel />
          </div>

          <div className="mt-12 sm:mt-14 flex flex-wrap items-center justify-center gap-5 sm:gap-7">
            <Link href="/catalog" className="inline-flex">
              <Button variant="gold" size="lg">
                Build your stack →
              </Button>
            </Link>
            <Link
              href="/catalog#popular-stacks"
              className="inline-flex items-center text-sm tracking-[0.04em] underline underline-offset-[6px] decoration-1 transition-colors duration-200 hover:opacity-80"
              style={{
                color: "var(--color-gold-light)",
                textDecorationColor: "var(--color-gold)",
              }}
            >
              View popular stacks →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
