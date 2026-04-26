import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb, Callout } from "@/components/ui";
import { ProductCard } from "@/components/catalog/ProductCard";
import { PopularStacks } from "@/components/catalog/PopularStacks";
import { CATEGORIES, PRODUCTS } from "@/lib/catalog/data";

export const metadata: Metadata = {
  title: "Catalog",
  description:
    "Full catalog of research-grade synthetic peptides. HPLC-verified purity, COA per lot, for laboratory research use only.",
  alternates: { canonical: "/catalog" },
  openGraph: {
    title: "Catalog · Bench Grade Peptides",
    description:
      "Full catalog of research-grade synthetic peptides. HPLC-verified purity, COA per lot.",
    url: "/catalog",
    type: "website",
  },
};

export default function CatalogPage() {
  return (
    <div className="bg-paper">
      <div className="max-w-[1280px] mx-auto px-5 sm:px-6 lg:px-10 py-8 sm:py-12 lg:py-16">
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Catalog" }]} />

        <header className="mt-4 sm:mt-6 mb-6 sm:mb-12 border-b rule pb-6 sm:pb-12">
          <div className="label-eyebrow text-ink-muted mb-2 sm:mb-4 text-[10px] sm:text-xs">Full catalog</div>
          <h1 className="font-display text-3xl sm:text-5xl lg:text-6xl text-ink leading-[1.08] sm:leading-[1.05] mb-3 sm:mb-6">
            Research-grade synthetic peptides.
          </h1>
          <p className="text-sm sm:text-base lg:text-lg text-ink-soft max-w-2xl leading-relaxed">
            Lyophilized powder, individual peptides only. HPLC + MS verified, certificate of analysis
            published per lot, cold-chain domestic shipping. Supplied for laboratory research use only —
            not drugs, supplements, or medical devices.
          </p>
        </header>

        <Callout variant="ruo" title="Research use only" className="mb-6 sm:mb-12">
          All products on this catalog are supplied for laboratory research use only. Not for human or
          veterinary use. Not a drug, supplement, or medical device. Customer certification is required at
          checkout per our{" "}
          <Link href="/terms" className="text-teal underline">Terms of Sale</Link>.
        </Callout>

        {/* Curated combinations — surface popular stacks above category browse. */}
        <PopularStacks />

        {/* Category sections */}
        {CATEGORIES.map((category) => {
          const products = PRODUCTS.filter((p) => p.category_slug === category.slug);
          if (products.length === 0) return null;

          return (
            <section key={category.slug} className="mb-12 sm:mb-20" aria-labelledby={`cat-${category.slug}`}>
              <div className="flex items-end justify-between gap-3 sm:gap-4 mb-4 sm:mb-8 border-b rule pb-3 sm:pb-4">
                <div>
                  <div className="label-eyebrow text-ink-muted mb-1 sm:mb-2 text-[10px] sm:text-xs">{category.taxonomy_label}</div>
                  <h2
                    id={`cat-${category.slug}`}
                    className="font-display text-xl sm:text-3xl lg:text-4xl text-ink leading-tight"
                  >
                    {category.name}
                  </h2>
                </div>
                <Link
                  href={`/catalog/${category.slug}`}
                  className="inline-flex items-center min-h-11 px-2 text-xs sm:text-sm text-teal hover:underline whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
                >
                  {products.length} →
                </Link>
              </div>
              <p className="text-xs sm:text-sm text-ink-soft mb-4 sm:mb-8 max-w-2xl leading-snug sm:leading-relaxed line-clamp-2 sm:line-clamp-none">
                {category.description}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
                {products.map((product) => (
                  <ProductCard key={product.slug} product={product} categorySlug={category.slug} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
