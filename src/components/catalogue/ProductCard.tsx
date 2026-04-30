import Image from "next/image";
import Link from "next/link";
import type { CatalogProduct } from "@/lib/catalogue/data";
import { QuickAddButton } from "./QuickAddButton";

interface ProductCardProps {
  product: CatalogProduct;
  categorySlug: string;
  /**
   * Customer's tier-driven own-order discount percent (0–10). When >0,
   * the QuickAddButton shows a strikethrough retail price above the
   * personalized one. Default 0 (anonymous viewer or Initiate tier).
   */
  tierDiscountPct?: number;
}

/**
 * Product card for the catalogue grid.
 *
 * The card is intentionally sparse — image, formula, name, summary,
 * and the QuickAddButton block. The price/size/qty machinery lives
 * inside QuickAddButton so a single point price reflects the chosen
 * variant + quantity (no more "$110 – $400" range that confused
 * customers about the entry-level cost).
 */
export function ProductCard({
  product,
  categorySlug,
  tierDiscountPct = 0,
}: ProductCardProps) {
  return (
    <article className="group flex flex-col bg-paper border rule rounded-md p-2 sm:p-5 lg:p-6 transition-all duration-300 hover:border-gold hover:shadow-[0_18px_40px_-20px_rgba(74,14,26,0.30)] hover:-translate-y-1">
      <Link
        href={`/catalogue/${categorySlug}/${product.slug}`}
        className="flex flex-col flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:rounded-md"
      >
        {/* Vial photograph — Zara-style: minimal frame, scale on hover */}
        <div className="relative aspect-square bg-paper-soft rounded-md mb-2 sm:mb-4 overflow-hidden">
          <Image
            src={product.vial_image}
            alt={`${product.name} research vial`}
            fill
            sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 33vw"
            className="object-cover scale-[1.05] [object-position:60%_50%] transition-transform duration-500 ease-out group-hover:scale-[1.12]"
          />
        </div>

        {/* Text area — minimalist Zara-style: formula + name only.
            The italic summary line + multi-row description were removed
            per direct user ask ("get rid of small description italicized
            bottom of catalogue card", "too much wording below title"). */}
        <div className="flex-1 flex flex-col">
          <div className="hidden sm:block h-4 mb-2">
            {product.molecular_formula && (
              <span className="font-mono-data text-[11px] text-ink-muted block truncate">
                {product.molecular_formula}
              </span>
            )}
          </div>
          <h3 className="font-display text-sm sm:text-lg lg:text-xl text-ink leading-tight mb-1 sm:mb-2 line-clamp-2 min-h-[2.6em] sm:min-h-0 sm:h-[3em]">
            {product.name}
          </h3>
        </div>
      </Link>

      {/* Quick-add — sibling to the Link so the size/qty controls and
          Add button don't trigger the parent navigation. Hidden on
          mobile (3-per-row leaves no room); customers tap the card
          to land on the PDP and add from there. */}
      <div className="hidden sm:block mt-3 sm:mt-4">
        <QuickAddButton
          product={product}
          size="sm"
          tierDiscountPct={tierDiscountPct}
        />
      </div>
    </article>
  );
}
