import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui";
import { ProductCard } from "@/components/catalog/ProductCard";
import { CATEGORIES, PRODUCTS, getCategoryBySlug } from "@/lib/catalog/data";

interface PageProps {
  params: Promise<{ category: string }>;
}

export async function generateStaticParams() {
  return CATEGORIES.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category: slug } = await params;
  const category = getCategoryBySlug(slug);
  if (!category) return { title: "Catalog category not found" };
  return {
    title: category.name,
    description: category.description,
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
            { label: "Catalog", href: "/catalog" },
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-px bg-rule border rule">
            {products.map((product) => (
              <ProductCard key={product.slug} product={product} categorySlug={category.slug} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
