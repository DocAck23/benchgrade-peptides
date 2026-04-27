import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumb, Callout } from "@/components/ui";
import { MolecularDataPanel } from "@/components/catalogue/MolecularDataPanel";
import { VariantPicker } from "@/components/catalogue/VariantPicker";
import { ProductViewBeacon } from "@/components/analytics/ProductViewBeacon";
import {
  CATEGORIES,
  PRODUCTS,
  getCategoryBySlug,
  getProductBySlug,
} from "@/lib/catalogue/data";
import { RUO_STATEMENTS } from "@/lib/compliance";
import { SITE_URL } from "@/lib/site";

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
  // that will 404 (e.g. /catalogue/wrong-category/bpc-157).
  if (!product || product.category_slug !== categorySlug) {
    return { title: "Compound not found", robots: { index: false, follow: false } };
  }
  const canonical = `/catalogue/${product.category_slug}/${product.slug}`;
  const description = `${product.summary} Research use only. HPLC-verified, COA per lot.`;
  return {
    title: product.name,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${product.name} · Bench Grade Peptides`,
      description,
      url: canonical,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${product.name} · Bench Grade Peptides`,
      description,
    },
    // Compliance hardening: keep PDPs indexable (researchers do find
    // us through search), but suppress Google's auto-extracted
    // snippets and image previews. Both can pull therapeutic-claim-
    // adjacent language out of the page body (mechanism notes,
    // research context) and surface it on the SERP next to a vial
    // photo — exactly the optic the FDA uses to argue "intended use."
    // The description meta we set above drives the result-card text;
    // everything else is suppressed.
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

export default async function ProductPage({ params }: PageProps) {
  const { category: categorySlug, product: productSlug } = await params;
  const category = getCategoryBySlug(categorySlug);
  const product = getProductBySlug(productSlug);
  if (!category || !product || product.category_slug !== categorySlug) notFound();

  const minPrice = Math.min(...product.variants.map((v) => v.retail_price));
  const maxPrice = Math.max(...product.variants.map((v) => v.retail_price));
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.summary,
    image: `${SITE_URL}${product.vial_image.split("?")[0]}`,
    sku: product.variants[0]?.sku,
    category: category.name,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "USD",
      lowPrice: minPrice,
      highPrice: maxPrice,
      offerCount: product.variants.length,
      availability: "https://schema.org/InStock",
      seller: { "@type": "Organization", name: "Bench Grade Peptides" },
    },
    ...(product.molecular_formula && { molecularFormula: product.molecular_formula }),
    ...(product.molecular_weight && { molecularWeight: `${product.molecular_weight} g/mol` }),
    ...(product.cas_number && {
      identifier: { "@type": "PropertyValue", propertyID: "CAS", value: product.cas_number },
    }),
  };

  return (
    <div className="bg-paper">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ProductViewBeacon
        sku={product.variants[0]?.sku ?? product.slug}
        productSlug={product.slug}
        categorySlug={product.category_slug}
      />
      <div className="max-w-[1280px] mx-auto px-6 lg:px-10 py-12 lg:py-16">
        <Breadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "Catalogue", href: "/catalogue" },
            { label: category.name, href: `/catalogue/${category.slug}` },
            { label: product.name },
          ]}
        />

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px] gap-12 lg:gap-16">
          {/* Left column — photo + description + research context */}
          <div>
            {/* Vial photograph */}
            <div className="relative aspect-[4/5] bg-paper-soft border rule overflow-hidden max-w-lg">
              <Image
                src={product.vial_image}
                alt={`${product.name} research vial`}
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
                priority
              />
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

            <VariantPicker product={product} />

            <div className="border-t rule pt-6 space-y-2">
              <p className="text-xs text-ink-muted leading-relaxed">
                Per-lot Certificate of Analysis (HPLC + MS) is published on this page
                and a printed copy ships inside every shipment.
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
