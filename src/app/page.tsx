import Link from "next/link";

const FEATURED_CATEGORIES = [
  {
    slug: "growth-hormone-secretagogues",
    label: "Growth hormone secretagogues",
    count: 11,
  },
  {
    slug: "tissue-repair",
    label: "Tissue-repair research peptides",
    count: 7,
  },
  {
    slug: "neuropeptides",
    label: "Neuropeptide research",
    count: 9,
  },
  {
    slug: "metabolic",
    label: "Metabolic research",
    count: 8,
  },
  {
    slug: "mitochondrial",
    label: "Mitochondrial & senescence research",
    count: 6,
  },
  {
    slug: "immunomodulatory",
    label: "Immunomodulatory research",
    count: 4,
  },
] as const;

const TRUST_POINTS = [
  {
    label: "HPLC + MS verified",
    detail: "Every lot tested for identity and purity. COA published per-lot, traceable from the vial label.",
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

export default function Home() {
  return (
    <div className="bg-[color:var(--color-paper)]">
      {/* Hero */}
      <section className="border-b rule">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-10 py-24 lg:py-32">
          <div className="max-w-4xl">
            <div className="label-eyebrow text-[color:var(--color-teal)] mb-6">
              Research-grade synthetic peptides
            </div>
            <h1 className="font-display text-5xl lg:text-7xl leading-[1.05] text-[color:var(--color-ink)] tracking-tight">
              Reference-grade compounds for in&nbsp;vitro laboratory research.
            </h1>
            <p className="mt-8 text-lg lg:text-xl leading-relaxed text-[color:var(--color-ink-soft)] max-w-2xl">
              HPLC-verified purity, certificates of analysis published per lot, and cold-chain domestic shipping.
              Supplied for laboratory research use only — not drugs, supplements, or medical devices.
            </p>
            <div className="mt-12 flex flex-wrap gap-4">
              <Link
                href="/catalog"
                className="inline-flex items-center h-12 px-6 bg-[color:var(--color-ink)] text-[color:var(--color-paper)] text-sm tracking-wide hover:bg-[color:var(--color-teal)] transition-colors"
              >
                Browse the catalog
              </Link>
              <Link
                href="/compliance"
                className="inline-flex items-center h-12 px-6 border rule text-sm text-[color:var(--color-ink)] tracking-wide hover:bg-[color:var(--color-paper-soft)] transition-colors"
              >
                Read compliance & RUO posture
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Trust points */}
      <section className="border-b rule">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-10 py-20">
          <div className="label-eyebrow text-[color:var(--color-ink-muted)] mb-10">
            Operating standards
          </div>
          <div className="grid md:grid-cols-3 gap-10 lg:gap-16">
            {TRUST_POINTS.map((point, idx) => (
              <div key={point.label} className="flex flex-col">
                <div className="font-mono-data text-xs text-[color:var(--color-teal)] mb-3">
                  0{idx + 1}
                </div>
                <h3 className="font-display text-2xl text-[color:var(--color-ink)] mb-3 leading-tight">
                  {point.label}
                </h3>
                <p className="text-sm leading-relaxed text-[color:var(--color-ink-soft)]">
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
              <div className="label-eyebrow text-[color:var(--color-ink-muted)] mb-3">
                Catalog
              </div>
              <h2 className="font-display text-4xl lg:text-5xl text-[color:var(--color-ink)] leading-none">
                Browse by research area
              </h2>
            </div>
            <Link
              href="/catalog"
              className="text-sm text-[color:var(--color-teal)] hover:underline"
            >
              View all compounds →
            </Link>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-[color:var(--color-rule)] border rule">
            {FEATURED_CATEGORIES.map((category) => (
              <Link
                key={category.slug}
                href={`/catalog/${category.slug}`}
                className="block bg-[color:var(--color-paper)] p-8 hover:bg-[color:var(--color-paper-soft)] transition-colors group"
              >
                <div className="flex items-baseline justify-between mb-2">
                  <span className="font-mono-data text-xs text-[color:var(--color-ink-muted)]">
                    {String(category.count).padStart(2, "0")} compounds
                  </span>
                  <span className="text-[color:var(--color-teal)] opacity-0 group-hover:opacity-100 transition-opacity">
                    →
                  </span>
                </div>
                <div className="font-display text-2xl text-[color:var(--color-ink)] leading-tight">
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
            <div className="label-eyebrow text-[color:var(--color-ink-muted)] mb-6">
              Compliance posture
            </div>
            <h2 className="font-display text-3xl lg:text-4xl text-[color:var(--color-ink)] mb-6 leading-tight">
              A chemical supplier, not a pharmacy.
            </h2>
            <p className="text-base lg:text-lg leading-relaxed text-[color:var(--color-ink-soft)] mb-6">
              Bench Grade Peptides LLC is a research-chemical distributor. We are not a compounding pharmacy,
              outsourcing facility, or dietary supplement company as defined under FDA regulations.
              All products are sold for laboratory research use only and require customer certification
              of research intent at checkout.
            </p>
            <Link
              href="/compliance"
              className="inline-flex items-center text-sm text-[color:var(--color-teal)] hover:underline"
            >
              Full compliance statement and customer certification terms →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
