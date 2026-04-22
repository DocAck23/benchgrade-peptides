import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumb, Callout } from "@/components/ui";
import { MolecularDataPanel } from "@/components/catalog/MolecularDataPanel";
import { VariantPicker } from "@/components/catalog/VariantPicker";
import {
  CATEGORIES,
  PRODUCTS,
  getCategoryBySlug,
  getProductBySlug,
} from "@/lib/catalog/data";
import { RUO_STATEMENTS } from "@/lib/compliance";

interface PageProps {
  params: Promise<{ category: string; product: string }>;
}

export async function generateStaticParams() {
  return PRODUCTS.map((p) => ({
    category: p.category_slug,
    product: p.slug,
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category: categorySlug, product: productSlug } = await params;
  const product = getProductBySlug(productSlug);
  // Cross-check category matches — don't emit product metadata for a URL
  // that will 404 (e.g. /catalog/wrong-category/bpc-157).
  if (!product || product.category_slug !== categorySlug) {
    return { title: "Compound not found" };
  }
  return {
    title: product.name,
    description: product.summary,
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { category: categorySlug, product: productSlug } = await params;
  const category = getCategoryBySlug(categorySlug);
  const product = getProductBySlug(productSlug);
  if (!category || !product || product.category_slug !== categorySlug) notFound();

  return (
    <div className="bg-paper">
      <div className="max-w-[1280px] mx-auto px-6 lg:px-10 py-12 lg:py-16">
        <Breadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "Catalog", href: "/catalog" },
            { label: category.name, href: `/catalog/${category.slug}` },
            { label: product.name },
          ]}
        />

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px] gap-12 lg:gap-16">
          {/* Left column — photo + description + research context */}
          <div>
            {/* Vial photograph placeholder */}
            <div className="aspect-[4/5] bg-paper-soft border rule flex items-center justify-center max-w-lg">
              <div className="text-center">
                <div className="label-eyebrow text-ink-faint">Vial · photo pending</div>
                <div className="font-mono-data text-[11px] text-ink-faint mt-2">
                  {product.variants[0]?.sku}
                </div>
              </div>
            </div>

            <div className="mt-12 max-w-2xl space-y-8">
              <section>
                <h2 className="label-eyebrow text-ink-muted mb-4">Summary</h2>
                <p className="text-base text-ink leading-relaxed">{product.summary}</p>
              </section>

              {product.research_context && (
                <section>
                  <h2 className="label-eyebrow text-ink-muted mb-4">Research context</h2>
                  <p className="text-sm text-ink-soft leading-relaxed">
                    {product.research_context}
                  </p>
                </section>
              )}

              <Callout variant="ruo" title="Research use only">
                {RUO_STATEMENTS.product} By purchasing, customer certifies research use per our{" "}
                <Link href="/terms" className="text-teal underline">Terms of Sale</Link>.
              </Callout>
            </div>
          </div>

          {/* Right column — compound info + molecular data + purchase */}
          <aside className="lg:sticky lg:top-8 h-fit space-y-8">
            <div>
              <div className="label-eyebrow text-teal mb-3">{category.taxonomy_label}</div>
              <h1 className="font-display text-4xl lg:text-5xl text-ink leading-[1.1] mb-3">
                {product.name}
              </h1>
              {product.cas_number && (
                <div className="font-mono-data text-xs text-ink-muted">
                  CAS {product.cas_number}
                </div>
              )}
            </div>

            <MolecularDataPanel product={product} />

            <VariantPicker variants={product.variants} productName={product.name} />

            <div className="border-t rule pt-6 space-y-2">
              <p className="text-xs text-ink-muted leading-relaxed">
                Each lot ships with a Certificate of Analysis (HPLC + MS). COA link provided by
                email after dispatch and available in your order record.
              </p>
              <p className="text-xs text-ink-muted leading-relaxed">
                Cold-chain packed, US-domestic shipping only. Free ground shipping on orders over $200.
              </p>
              <p className="text-xs text-ink leading-relaxed pt-2 border-t rule">
                {RUO_STATEMENTS.product}
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
