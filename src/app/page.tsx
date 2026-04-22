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
        <div className="max-w-[1280px] mx-auto px-6 lg:px-10 py-24 lg:py-32">
          <div className="max-w-4xl">
            <div className="label-eyebrow text-teal mb-6">
              Research-grade synthetic peptides
            </div>
            <h1 className="font-display text-5xl lg:text-7xl leading-[1.05] text-ink tracking-tight">
              Reference-grade compounds for in&nbsp;vitro laboratory research.
            </h1>
            <p className="mt-8 text-lg lg:text-xl leading-relaxed text-ink-soft max-w-2xl">
              HPLC-verified purity, certificates of analysis published per lot, and cold-chain
              domestic shipping. Supplied for laboratory research use only — not drugs, supplements,
              or medical devices.
            </p>

            {/* Data chip row — editorial catalog signal */}
            <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4 border-t border-b rule py-5">
              {HERO_STATS.map((stat) => (
                <div key={stat.label} className="flex items-baseline gap-3">
                  <dt className="label-eyebrow text-ink-muted">{stat.label}</dt>
                  <dd className="font-mono-data text-2xl lg:text-3xl text-ink leading-none">{stat.value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/catalog"
                className="inline-flex items-center h-12 px-8 bg-ink text-paper text-sm tracking-[0.04em] font-medium hover:bg-teal transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
              >
                Browse the catalog
              </Link>
              <Link
                href="/compliance"
                className="inline-flex items-center h-12 px-8 border rule text-sm text-ink tracking-[0.04em] hover:bg-paper-soft transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
              >
                Compliance & RUO posture
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Revolving product carousel */}
      <ProductCarousel />

      {/* Trust points */}
      <section className="border-b rule">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-10 py-20">
          <div className="label-eyebrow text-ink-muted mb-10">
            Operating standards
          </div>
          <div className="grid md:grid-cols-3 gap-10 lg:gap-16">
            {TRUST_POINTS.map((point, idx) => (
              <div key={point.label} className="flex flex-col">
                <div className="font-mono-data text-xs text-teal mb-3">
                  0{idx + 1}
                </div>
                <h3 className="font-display text-2xl text-ink mb-3 leading-tight">
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
        <div className="max-w-[1280px] mx-auto px-6 lg:px-10 py-20">
          <div className="flex items-end justify-between flex-wrap gap-4 mb-10">
            <div>
              <div className="label-eyebrow text-ink-muted mb-3">Catalog</div>
              <h2 className="font-display text-4xl lg:text-5xl text-ink leading-none">
                Browse by research area
              </h2>
            </div>
            <Link
              href="/catalog"
              className="text-sm text-teal hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
            >
              View all compounds →
            </Link>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-rule border rule">
            {FEATURED_CATEGORIES.map((category) => (
              <Link
                key={category.slug}
                href={`/catalog/${category.slug}`}
                className="block bg-paper p-8 hover:bg-paper-soft transition-colors group focus-visible:outline-none focus-visible:bg-paper-soft"
              >
                <div className="flex items-baseline justify-between mb-2">
                  <span className="font-mono-data text-xs text-ink-muted">
                    {String(category.count).padStart(2, "0")} compounds
                  </span>
                  <span className="text-teal opacity-0 group-hover:opacity-100 transition-opacity">
                    →
                  </span>
                </div>
                <div className="font-display text-2xl text-ink leading-tight">
                  {category.label}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Compliance callout */}
      <section>
        <div className="max-w-[1280px] mx-auto px-6 lg:px-10 py-20">
          <div className="max-w-3xl">
            <div className="label-eyebrow text-ink-muted mb-6">Compliance posture</div>
            <h2 className="font-display text-3xl lg:text-4xl text-ink mb-6 leading-tight">
              A chemical supplier, not a pharmacy.
            </h2>
            <p className="text-base lg:text-lg leading-relaxed text-ink-soft mb-6">
              Bench Grade Peptides LLC is a research-chemical distributor. We are not a compounding pharmacy,
              outsourcing facility, or dietary supplement company as defined under FDA regulations.
              All products are sold for laboratory research use only and require customer certification
              of research intent at checkout.
            </p>
            <Link
              href="/compliance"
              className="inline-flex items-center text-sm text-teal hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
            >
              Full compliance statement and customer certification terms →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
