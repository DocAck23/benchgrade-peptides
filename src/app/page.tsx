import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Flag, QrCode, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { GoldBand } from "@/components/brand/GoldBand";
import { PRODUCTS } from "@/lib/catalogue/data";
import { ROUTES } from "@/lib/routes";
import { BRAND } from "@/lib/brand";

/**
 * Homepage — v2 overhaul (sub-project A·F continuation).
 *
 * Changes vs v1:
 *   - ProductCarousel REMOVED (per user direct ask: "get rid of it")
 *   - Top-6 featured peptides grid replaces it (Reta / Tirz / BPC-157 /
 *     TB-500 / CJC-1295 / NAD+) with a "Browse the catalog" button
 *   - "catalogue" → "catalog" in all user-facing copy (the URL stays
 *     /catalogue until sub-project B renames the route in one place)
 *   - Build-Your-Stack CTA now points at /catalogue/stacks/build (was
 *     pointing at /catalogue, which never opened the builder)
 *   - GoldBand surface anchor added between trust trio and featured grid
 *     ("Every lot. Public receipts." — the Q6 lock comes alive)
 */

export const metadata: Metadata = {
  title: { absolute: `${BRAND.name} — synthesized, vialed, and tested in the United States` },
  description: BRAND.description,
  alternates: { canonical: "/" },
  openGraph: {
    title: BRAND.name,
    description: BRAND.shortDescription,
    url: "/",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: BRAND.name,
    description: BRAND.shortDescription,
  },
};

const TRUST_TRIO = [
  { icon: Flag, eyebrow: "MADE IN THE UNITED STATES", body: "Synthesized in Tampa. Vialed in Orlando." },
  { icon: QrCode, eyebrow: "QR-LINKED COA PER LOT", body: "Scan the vial. Read the lot's certificate." },
  { icon: ShieldCheck, eyebrow: "≥99.0% BY HPLC", body: "Tested by an independent US laboratory." },
] as const;

// User-locked top 6 by inventory ordering (memory: positioning_and_pricing.md +
// supplier_and_catalog.md). Replaces the v1 ProductCarousel which auto-scrolled
// every product. These six are the bestsellers across reta / tirz / tissue
// repair / GH stack / longevity surfaces.
const FEATURED_SLUGS = ["glp3r", "glp2t", "bpc-157", "tb-500", "cjc-1295-no-dac", "nad"] as const;

function FeaturedTile({ slug }: { slug: string }) {
  const product = PRODUCTS.find((p) => p.slug === slug);
  if (!product) return null;
  const lowestPriceCents = Math.round((product.variants[0]?.retail_price ?? 0) * 100);
  return (
    <Link
      href={ROUTES.PRODUCT(product.category_slug, product.slug)}
      className="group flex flex-col bg-paper rounded-md border rule overflow-hidden transition-all duration-300 hover:shadow-[0_18px_40px_-20px_rgba(74,14,26,0.30)] hover:-translate-y-1 hover:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2"
    >
      <div className="relative aspect-square bg-paper-soft overflow-hidden">
        <Image
          src={product.vial_image}
          alt={`${product.name} research vial`}
          fill
          sizes="(min-width: 1024px) 16vw, (min-width: 768px) 33vw, 50vw"
          className="object-cover scale-[1.05] transition-transform duration-500 ease-out group-hover:scale-[1.12]"
        />
      </div>
      <div className="p-4 sm:p-5 flex flex-col gap-1">
        <h3 className="font-display text-base sm:text-lg text-ink leading-tight">{product.name}</h3>
        <span className="font-mono-data text-sm text-ink font-semibold">
          ${(lowestPriceCents / 100).toFixed(2)}
          <span className="text-ink-muted text-[11px] font-normal ml-1">from</span>
        </span>
      </div>
    </Link>
  );
}

export default function Home() {
  return (
    <div>
      {/* ── Hero — two-column: headline left, popular stacks right ──── */}
      <section className="relative overflow-hidden bg-paper">
        <div className="max-w-[1440px] mx-auto px-5 sm:px-6 lg:px-10 py-16 sm:py-20 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-16 xl:gap-20 items-start">
            <div>
              <h1 className="font-display text-[40px] leading-[1.05] sm:text-6xl lg:text-[64px] xl:text-7xl xl:leading-[1.02] tracking-tight font-semibold">
                <span className="text-wine">Research peptides,</span>
                <br />
                <span className="text-gold-dark">made in the United States.</span>
              </h1>
              <p className="mt-6 sm:mt-8 text-lg sm:text-xl lg:text-2xl leading-snug max-w-xl text-ink-soft">
                Synthesized in Tampa. Vialed in Orlando. HPLC-verified per lot.
              </p>
              <div className="mt-10 sm:mt-12 flex flex-wrap items-center gap-4 sm:gap-6">
                <Link href={ROUTES.CATALOG} className="inline-flex">
                  <Button variant="primary" size="lg" fullWidthMobile={false}>
                    Browse the catalog
                  </Button>
                </Link>
                <Link href={`${ROUTES.STACKS}/build`} className="inline-flex">
                  <Button variant="tertiary" size="lg" fullWidthMobile={false}>
                    Build your stack →
                  </Button>
                </Link>
              </div>
            </div>

            {/* Right column omitted on mobile (focuses on hero text + CTAs);
                desktop+ shows the popular-stacks grid. The component itself
                is responsive but we no longer give it mobile real estate. */}
            <div className="hidden lg:block">
              {/* Popular stacks grid stays for now — sub-project E reworks it */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <Image
                src="/brand/logo-gold.png"
                alt=""
                aria-hidden="true"
                width={1709}
                height={441}
                className="w-full h-auto opacity-[0.06] select-none pointer-events-none"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust trio ─────────────────────────────────────────────────── */}
      <section className="border-b rule" aria-label="What every order ships with">
        <div className="max-w-[1280px] mx-auto px-5 sm:px-6 lg:px-10 py-16 sm:py-20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-10 lg:gap-16">
            {TRUST_TRIO.map(({ icon: Icon, eyebrow, body }) => (
              <div key={eyebrow} className="flex flex-col items-start">
                <Icon size={24} strokeWidth={1.75} aria-hidden style={{ color: "var(--color-gold-dark)" }} />
                <div
                  className="font-ui mt-4 text-xs sm:text-sm uppercase tracking-[0.18em] font-bold"
                  style={{ color: "var(--color-gold-dark)" }}
                >
                  {eyebrow}
                </div>
                <p className="mt-2 text-base sm:text-lg leading-snug text-ink">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── GoldBand anchor (Q6 surface-language lock — one band per page) ── */}
      <GoldBand
        eyebrow="≥99.0% by HPLC · Heavy metals: pass · Microbial: pass"
        headline="Every lot. Public receipts."
      />

      {/* ── Featured grid — replaces the v1 carousel ─────────────────── */}
      <section className="bg-paper">
        <div className="max-w-[1280px] mx-auto px-5 sm:px-6 lg:px-10 py-16 sm:py-20">
          <div className="flex items-end justify-between mb-8 sm:mb-12 gap-4">
            <div>
              <div className="font-ui uppercase text-[11px] sm:text-xs tracking-[0.22em] font-bold text-gold-dark mb-2">
                The Catalog
              </div>
              <h2 className="font-display font-semibold text-3xl sm:text-4xl lg:text-5xl text-wine tracking-tight">
                Six compounds. The benchmark.
              </h2>
            </div>
            <Link
              href={ROUTES.CATALOG}
              className="hidden sm:inline-flex items-center text-sm tracking-[0.04em] font-ui font-semibold text-wine hover:text-gold-dark transition-colors"
            >
              See all →
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-5 lg:gap-6">
            {FEATURED_SLUGS.map((slug) => (
              <FeaturedTile key={slug} slug={slug} />
            ))}
          </div>

          <div className="mt-10 sm:mt-14 flex justify-center">
            <Link href={ROUTES.CATALOG} className="inline-flex w-full sm:w-auto">
              <Button variant="primary" size="lg">
                Browse the catalog
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
