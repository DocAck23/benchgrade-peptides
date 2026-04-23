import Link from "next/link";
import { CATEGORIES, PRODUCTS } from "@/lib/catalog/data";
import { ProductCarousel } from "@/components/catalog/ProductCarousel";

/** Derive featured categories from catalog data so counts stay in sync
 *  with the actual SKU list. Shows the top 6 categories by product count. */
const FEATURED_CATEGORIES = CATEGORIES
  .map((c) => ({
    slug: c.slug,
    label: c.name,
    count: PRODUCTS.filter((p) => p.category_slug === c.slug).length,
  }))
  .filter((c) => c.count > 0)
  .sort((a, b) => b.count - a.count)
  .slice(0, 6);

/** Total product count, derived from data. */
const TOTAL_COMPOUNDS = PRODUCTS.length;

const TRUST_POINTS = [
  {
    label: "HPLC + MS verified",
    detail: "Every lot analytically verified for identity and purity. COA published per lot, traceable from the vial label.",
  },
  {
    label: "Cold-chain shipping",
    detail: "Lyophilized peptides packed with cold packs where appropriate. US-domestic ground, 2-day, and overnight tiers.",
  },
  {
    label: "Lot traceability",
    detail: "Every outbound vial logged against a lot number, COA version, and customer acknowledgment record.",
  },
] as const;

const HERO_STATS = [
  { value: String(TOTAL_COMPOUNDS), label: "compounds" },
  { value: "99%+", label: "HPLC purity" },
  { value: "Per-lot", label: "COA" },
] as const;

export default function Home() {
  return (
    <div className="bg-paper">
      {/* Hero */}
      <section className="border-b rule">
        <div className="max-w-[1280px] mx-auto px-5 sm:px-6 lg:px-10 py-10 sm:py-16 lg:py-32">
          <div className="max-w-4xl">
            <div className="label-eyebrow text-teal mb-3 sm:mb-6 text-[10px] sm:text-xs">
              Research-grade synthetic peptides
            </div>
            <h1 className="font-display text-[32px] leading-[1.08] sm:text-5xl lg:text-7xl sm:leading-[1.05] text-ink tracking-tight">
              Reference-grade compounds for in&nbsp;vitro laboratory research.
            </h1>
            <p className="mt-4 sm:mt-8 text-sm sm:text-lg lg:text-xl leading-relaxed text-ink-soft max-w-2xl">
              HPLC-verified purity, certificates of analysis published per lot, and cold-chain
              domestic shipping. Supplied for laboratory research use only — not drugs, supplements,
              or medical devices.
            </p>

            {/* Data chip row — editorial catalog signal */}
            <dl className="mt-6 sm:mt-10 flex flex-wrap gap-x-6 sm:gap-x-10 gap-y-3 sm:gap-y-4 border-t border-b rule py-3 sm:py-5">
              {HERO_STATS.map((stat) => (
                <div key={stat.label} className="flex items-baseline gap-2 sm:gap-3">
                  <dt className="label-eyebrow text-ink-muted text-[10px] sm:text-xs">{stat.label}</dt>
                  <dd className="font-mono-data text-lg sm:text-2xl lg:text-3xl text-ink leading-none">{stat.value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-6 sm:mt-10 flex flex-wrap gap-3 sm:gap-4">
              <Link
                href="/catalog"
                className="inline-flex items-center h-11 sm:h-12 px-6 sm:px-8 bg-ink text-paper text-sm tracking-[0.04em] font-medium hover:bg-teal transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
              >
                Browse the catalog
              </Link>
              <Link
                href="/compliance"
                className="inline-flex items-center h-11 sm:h-12 px-6 sm:px-8 border rule text-sm text-ink tracking-[0.04em] hover:bg-paper-soft transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
              >
                Compliance & RUO
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Revolving product carousel */}
      <ProductCarousel />

      {/* Trust points */}
      <section className="border-b rule">
        <div className="max-w-[1280px] mx-auto px-5 sm:px-6 lg:px-10 py-10 sm:py-16 lg:py-20">
          <div className="label-eyebrow text-ink-muted mb-6 sm:mb-10 text-[10px] sm:text-xs">
            Operating standards
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-10 lg:gap-16">
            {TRUST_POINTS.map((point, idx) => (
              <div key={point.label} className="flex flex-col">
                <div className="font-mono-data text-[11px] sm:text-xs text-teal mb-2 sm:mb-3">
                  0{idx + 1}
                </div>
                <h3 className="font-display text-lg sm:text-2xl text-ink mb-2 sm:mb-3 leading-tight">
                  {point.label}
                </h3>
                <p className="text-sm leading-relaxed text-ink-soft">
                  {point.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured categories */}
      <section className="border-b rule">
        <div className="max-w-[1280px] mx-auto px-5 sm:px-6 lg:px-10 py-10 sm:py-16 lg:py-20">
          <div className="flex items-end justify-between flex-wrap gap-3 sm:gap-4 mb-6 sm:mb-10">
            <div>
              <div className="label-eyebrow text-ink-muted mb-2 sm:mb-3 text-[10px] sm:text-xs">Catalog</div>
              <h2 className="font-display text-2xl sm:text-4xl lg:text-5xl text-ink leading-none">
                Browse by research area
              </h2>
            </div>
            <Link
              href="/catalog"
              className="text-sm text-teal hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
            >
              View all →
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
            {FEATURED_CATEGORIES.map((category) => (
              <Link
                key={category.slug}
                href={`/catalog/${category.slug}`}
                className="block bg-paper border rule p-4 sm:p-6 lg:p-8 hover:bg-paper-soft transition-colors group focus-visible:outline-none focus-visible:bg-paper-soft"
              >
                <div className="flex items-baseline justify-between mb-2">
                  <span className="font-mono-data text-[10px] sm:text-xs text-ink-muted">
                    {String(category.count).padStart(2, "0")} compounds
                  </span>
                  <span className="text-teal opacity-0 group-hover:opacity-100 transition-opacity">
                    →
                  </span>
                </div>
                <div className="font-display text-sm sm:text-xl lg:text-2xl text-ink leading-tight">
                  {category.label}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Compliance callout */}
      <section>
        <div className="max-w-[1280px] mx-auto px-5 sm:px-6 lg:px-10 py-10 sm:py-16 lg:py-20">
          <div className="max-w-3xl">
            <div className="label-eyebrow text-ink-muted mb-3 sm:mb-6 text-[10px] sm:text-xs">Compliance posture</div>
            <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl text-ink mb-4 sm:mb-6 leading-tight">
              A chemical supplier, not a pharmacy.
            </h2>
            <p className="text-sm sm:text-base lg:text-lg leading-relaxed text-ink-soft mb-4 sm:mb-6">
              Bench Grade Peptides LLC is a research-chemical distributor. We are not a compounding pharmacy,
              outsourcing facility, or dietary supplement company as defined under FDA regulations.
              All products are sold for laboratory research use only and require customer certification
              of research intent at checkout.
            </p>
            <Link
              href="/compliance"
              className="inline-flex items-center text-sm text-teal hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
            >
              Full compliance statement →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
