import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui";
import { ProductCard } from "@/components/catalogue/ProductCard";
import { CATEGORIES, PRODUCTS, getCategoryBySlug } from "@/lib/catalogue/data";

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
  };
}

export default async function CategoryPage({ params }: PageProps) {
  const { category: slug } = await params;
  const category = getCategoryBySlug(slug);
  if (!category) notFound();

  const products = PRODUCTS.filter((p) => p.category_slug === slug);

  return (
    <div className="bg-paper">
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
          <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
            {products.map((product) => (
              <ProductCard key={product.slug} product={product} categorySlug={category.slug} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
