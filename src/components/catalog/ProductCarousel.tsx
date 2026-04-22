"use client";

import Link from "next/link";
import type { CatalogProduct } from "@/lib/catalog/data";
import { PRODUCTS, getMinPrice } from "@/lib/catalog/data";
import { formatPrice } from "@/lib/utils";

/**
 * Homepage product carousel.
 *
 * Infinite-loop marquee of product cards. CSS-only animation via the
 * `marquee-track` class defined in globals.css. The tile list is rendered
 * once as the real (announced, keyboard-reachable) set and once as an
 * aria-hidden + inert decorative duplicate so the visual loop is seamless
 * while assistive tech only sees each product once.
 *
 * Hover and focus-within pause the marquee. Users with
 * `prefers-reduced-motion: reduce` see a static row.
 */
export function ProductCarousel() {
  return (
    <section
      aria-label="Featured compounds"
      className="border-b rule py-14 overflow-hidden bg-paper-soft"
    >
      <div className="max-w-[1440px] mx-auto px-6 lg:px-10 mb-10 flex items-end justify-between gap-4">
        <div>
          <div className="label-eyebrow text-ink-muted mb-2">Featured compounds</div>
          <h2 className="font-display text-3xl lg:text-4xl text-ink leading-tight">
            From the catalog
          </h2>
        </div>
        <Link href="/catalog" className="text-sm text-teal hover:underline whitespace-nowrap">
          Browse all {PRODUCTS.length} →
        </Link>
      </div>

      {/* Marquee viewport */}
      <div className="relative">
        {/* edge fades for a premium feel */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-16 lg:w-32 bg-gradient-to-r from-paper-soft to-transparent z-10" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-16 lg:w-32 bg-gradient-to-l from-paper-soft to-transparent z-10" />

        <div className="marquee-track flex gap-4 lg:gap-5 w-max px-6 lg:px-10">
          {/* Real set — keyboard-reachable, announced */}
          <ul className="flex gap-4 lg:gap-5 shrink-0">
            {PRODUCTS.map((product) => (
              <li key={product.slug}>
                <ProductCarouselCard product={product} />
              </li>
            ))}
          </ul>
          {/* Decorative duplicate — hidden from assistive tech, removed from tab order */}
          <ul
            className="flex gap-4 lg:gap-5 shrink-0"
            aria-hidden="true"
            /* @ts-expect-error -- `inert` is valid HTML and supported in React 19 */
            inert=""
          >
            {PRODUCTS.map((product) => (
              <li key={`dup-${product.slug}`}>
                <ProductCarouselCard product={product} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function ProductCarouselCard({ product }: { product: CatalogProduct }) {
  const minPrice = getMinPrice(product);
  const sizes = product.variants.map((v) => `${v.size_mg}mg`).join(" · ");
  return (
    <Link
      href={`/catalog/${product.category_slug}/${product.slug}`}
      className="block w-[240px] lg:w-[280px] shrink-0 bg-paper border rule p-5 hover:bg-paper-deep transition-colors"
    >
      {/* Vial placeholder */}
      <div className="aspect-square bg-paper-deep border rule mb-4 flex items-center justify-center">
        <span className="font-mono-data text-[9px] text-ink-faint tracking-[0.2em] uppercase">
          vial · photo pending
        </span>
      </div>

      {product.molecular_formula && (
        <div className="font-mono-data text-[10px] text-ink-muted mb-2 truncate">
          {product.molecular_formula}
        </div>
      )}
      <h3 className="font-display text-lg text-ink leading-tight mb-3 truncate">
        {product.name}
      </h3>
      <div className="flex items-baseline justify-between pt-3 border-t rule">
        <span className="font-mono-data text-sm text-ink">
          from {formatPrice(minPrice * 100)}
        </span>
        <span className="label-eyebrow text-ink-muted">{sizes}</span>
      </div>
    </Link>
  );
}
