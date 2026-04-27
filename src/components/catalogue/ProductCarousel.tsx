"use client";

import Image from "next/image";
import Link from "next/link";
import type { CatalogProduct } from "@/lib/catalogue/data";
import { PRODUCTS, getMinPrice } from "@/lib/catalogue/data";
import { formatPrice } from "@/lib/utils";
import { QuickAddButton } from "./QuickAddButton";

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
      data-surface="wine"
      className="py-16 sm:py-20 overflow-hidden bg-wine"
    >
      <div className="max-w-[1440px] mx-auto px-6 lg:px-10 mb-10 flex items-end justify-between gap-4">
        <div>
          <div className="label-eyebrow text-gold-light mb-2">Featured compounds</div>
          <h2 className="font-display text-3xl lg:text-4xl text-paper leading-tight">
            From the catalogue
          </h2>
        </div>
        <Link href="/catalogue" className="text-sm text-gold-light hover:underline whitespace-nowrap">
          Browse all {PRODUCTS.length} →
        </Link>
      </div>

      {/* Marquee viewport — on mobile this is a native horizontal scroll
          container (with the marquee animation disabled in globals.css).
          `touch-action: pan-x` declares horizontal-pan as the primary
          gesture so iOS / Android don't lose the swipe to vertical-pan
          arbitration. `overscroll-x-contain` keeps page-level horizontal
          chrome scroll out of it. */}
      <div
        className="relative overflow-x-auto overflow-y-hidden md:overflow-hidden overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-x pan-y" }}
      >
        {/* edge fades for a premium feel — desktop only; on mobile they
            get in the way of the swipe-to-end visual cue. */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-16 lg:w-32 bg-gradient-to-r from-wine to-transparent z-10 hidden md:block" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-16 lg:w-32 bg-gradient-to-l from-wine to-transparent z-10 hidden md:block" />

        <div className="marquee-track flex gap-2 sm:gap-4 lg:gap-5 w-max px-3 sm:px-6 lg:px-10">
          {/* Real set — keyboard-reachable, announced */}
          <ul className="flex gap-2 sm:gap-4 lg:gap-5 shrink-0">
            {PRODUCTS.map((product) => (
              <li key={product.slug}>
                <ProductCarouselCard product={product} />
              </li>
            ))}
          </ul>
          {/* Decorative duplicate — hidden from assistive tech, removed from tab order */}
          <ul
            className="flex gap-2 sm:gap-4 lg:gap-5 shrink-0"
            aria-hidden="true"
            inert
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
    <article className="w-[108px] sm:w-[240px] lg:w-[280px] shrink-0 bg-paper border rule p-2 sm:p-5 hover:bg-paper-soft transition-colors flex flex-col">
      <Link
        href={`/catalogue/${product.category_slug}/${product.slug}`}
        className="block focus-visible:outline-none"
      >
        {/* Vial photograph */}
        <div className="relative aspect-square bg-paper-soft border rule mb-2 sm:mb-4 overflow-hidden">
          <Image
            src={product.vial_image}
            alt={`${product.name} research vial`}
            fill
            sizes="(min-width: 640px) 280px, 108px"
            className="object-cover scale-[1.1] [object-position:60%_50%]"
          />
        </div>

        {product.molecular_formula && (
          <div className="hidden sm:block font-mono-data text-[10px] text-ink-muted mb-2 truncate">
            {product.molecular_formula}
          </div>
        )}
        <h3 className="font-display text-[12px] sm:text-lg text-ink leading-tight mb-2 sm:mb-3 line-clamp-2 sm:truncate min-h-[2.4em] sm:min-h-0">
          {product.name}
        </h3>
        <div className="flex items-baseline justify-between pt-2 sm:pt-3 border-t rule gap-1">
          <span className="font-mono-data text-[11px] sm:text-sm text-ink">
            from {formatPrice(minPrice * 100)}
          </span>
          <span className="hidden sm:inline label-eyebrow text-ink-muted">{sizes}</span>
        </div>
      </Link>

      {/* Quick-add hidden on mobile — the cramped 108px card prefers the
          tap-to-open detail page. From sm up the size selector + add CTA
          land back as siblings. */}
      <div className="hidden sm:block mt-3">
        <QuickAddButton product={product} size="sm" />
      </div>
    </article>
  );
}
