import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui";
import { ProductCard } from "@/components/catalogue/ProductCard";
import { CATEGORIES, PRODUCTS, getCategoryBySlug } from "@/lib/catalogue/data";
import { SITE_URL } from "@/lib/site";

interface PageProps {
  params: Promise<{ category: string }>;
}

export async function generateStaticParams() {
  return CATEGORIES.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category: slug } = await params;
  const category = getCategoryBySlug(slug);
  if (!category) return { title: "Catalogue category not found", robots: { index: false, follow: false } };
  const canonical = `/catalogue/${category.slug}`;
  return {
    title: category.name,
    description: category.description,
    alternates: { canonical },
    openGraph: {
      title: `${category.name} · Bench Grade Peptides`,
      description: category.description,
      url: canonical,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${category.name} · Bench Grade Peptides`,
      description: category.description,
    },
    // Same compliance posture as PDPs: indexable but no auto-snippets
    // and no image previews — keeps SERP cards from auto-extracting
    // therapeutic-claim-adjacent text from product cards on the page.
    robots: {
      index: true,
      follow: true,
      nosnippet: true,
      noimageindex: true,
      googleBot: {
        index: true,
        follow: true,
        nosnippet: true,
        noimageindex: true,
      },
    },
  };
}

export default async function CategoryPage({ params }: PageProps) {
  const { category: slug } = await params;
  const category = getCategoryBySlug(slug);
  if (!category) notFound();

  const products = PRODUCTS.filter((p) => p.category_slug === slug);

  // BreadcrumbList JSON-LD — mirrors the visual breadcrumb. Lets Google
  // render the SERP card with the category path instead of the bare URL.
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Catalogue", item: `${SITE_URL}/catalogue` },
      { "@type": "ListItem", position: 3, name: category.name, item: `${SITE_URL}/catalogue/${category.slug}` },
    ],
  };

  // Cross-link siblings so each category surface exposes the rest of
  // the catalogue without forcing the visitor back to /catalogue.
  const siblings = CATEGORIES.filter((c) => c.slug !== category.slug);

  return (
    <div className="bg-paper">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <div className="max-w-[1280px] mx-auto px-6 lg:px-10 py-12 lg:py-16">
        <Breadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "Catalogue", href: "/catalogue" },
            { label: category.name },
          ]}
        />

        <header className="mt-6 mb-12 border-b rule pb-12">
          <div className="label-eyebrow text-teal mb-4">{category.taxonomy_label}</div>
          <h1 className="font-display text-5xl lg:text-6xl text-ink leading-[1.05] mb-6">
            {category.name}
          </h1>
          <p className="text-base lg:text-lg text-ink-soft max-w-2xl leading-relaxed">
            {category.description}
          </p>
          <p className="mt-6 label-eyebrow text-ink-muted">
            {products.length} {products.length === 1 ? "compound" : "compounds"}
          </p>
        </header>

        {products.length === 0 ? (
          <p className="text-sm text-ink-muted">No compounds currently listed in this category.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 gap-2 sm:gap-3 lg:gap-4">
            {products.map((product) => (
              <ProductCard key={product.slug} product={product} categorySlug={category.slug} />
            ))}
          </div>
        )}

        {siblings.length > 0 && (
          <nav
            aria-label="Other categories"
            className="mt-16 pt-8 border-t rule"
          >
            <div className="label-eyebrow text-ink-muted mb-4">Other categories</div>
            <ul className="flex flex-wrap gap-x-6 gap-y-3">
              {siblings.map((s) => (
                <li key={s.slug}>
                  <Link
                    href={`/catalogue/${s.slug}`}
                    className="text-sm text-ink-soft hover:text-wine underline underline-offset-4 decoration-rule"
                  >
                    {s.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </div>
  );
}
