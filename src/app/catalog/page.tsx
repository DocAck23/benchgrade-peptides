import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb, Callout } from "@/components/ui";
import { ProductCard } from "@/components/catalog/ProductCard";
import { CATEGORIES, PRODUCTS } from "@/lib/catalog/data";

export const metadata: Metadata = {
  title: "Catalog",
  description:
    "Full catalog of research-grade synthetic peptides. HPLC-verified purity, COA per lot, for laboratory research use only.",
};

export default function CatalogPage() {
  return (
    <div className="bg-paper">
      <div className="max-w-[1280px] mx-auto px-6 lg:px-10 py-12 lg:py-16">
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Catalog" }]} />

        <header className="mt-6 mb-12 border-b rule pb-12">
          <div className="label-eyebrow text-ink-muted mb-4">Full catalog</div>
          <h1 className="font-display text-5xl lg:text-6xl text-ink leading-[1.05] mb-6">
            Research-grade synthetic peptides.
          </h1>
          <p className="text-base lg:text-lg text-ink-soft max-w-2xl leading-relaxed">
            Lyophilized powder, individual peptides only. HPLC + MS verified, certificate of analysis
            published per lot, cold-chain domestic shipping. Supplied for laboratory research use only —
            not drugs, supplements, or medical devices.
          </p>
        </header>

        <Callout variant="ruo" title="Research use only" className="mb-12">
          All products on this catalog are supplied for laboratory research use only. Not for human or
          veterinary use. Not a drug, supplement, or medical device. Customer certification is required at
          checkout per our{" "}
          <Link href="/terms" className="text-teal underline">Terms of Sale</Link>.
        </Callout>

        {/* Category sections */}
        {CATEGORIES.map((category) => {
          const products = PRODUCTS.filter((p) => p.category_slug === category.slug);
          if (products.length === 0) return null;

          return (
            <section key={category.slug} className="mb-20" aria-labelledby={`cat-${category.slug}`}>
              <div className="flex items-end justify-between gap-4 mb-8 border-b rule pb-4">
                <div>
                  <div className="label-eyebrow text-ink-muted mb-2">{category.taxonomy_label}</div>
                  <h2
                    id={`cat-${category.slug}`}
                    className="font-display text-3xl lg:text-4xl text-ink leading-tight"
                  >
                    {category.name}
                  </h2>
                </div>
                <Link
                  href={`/catalog/${category.slug}`}
                  className="text-sm text-teal hover:underline whitespace-nowrap"
                >
                  {products.length} {products.length === 1 ? "compound" : "compounds"} →
                </Link>
              </div>
              <p className="text-sm text-ink-soft mb-8 max-w-2xl leading-relaxed">
                {category.description}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-px bg-rule border rule">
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
