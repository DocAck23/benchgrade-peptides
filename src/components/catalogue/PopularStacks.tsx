import Link from "next/link";
import { resolveAllStacks } from "@/lib/catalogue/stacks";
import { formatPrice } from "@/lib/utils";
import { AddStackToCartButton } from "./AddStackToCartButton";

/**
 * "Popular stacks" section on /catalogue. Surfaces curated SKU combinations
 * that are frequently bought together — each rendered as a card with the
 * stack contents, retail total, and a one-click "Add stack to cart" button
 * that drops every line into the cart at once.
 *
 * Stack & Save tier discount fires automatically once the items land in
 * the cart (3+ vials → 15% off + free shipping). The card surfaces the
 * pre-discount total; the cart drawer + checkout summary handle the
 * tier reveal.
 *
 * Pure server component for SEO; the per-card CTA is a client component
 * (AddStackToCartButton) that hooks into useCart().
 */
export function PopularStacks() {
  const resolved = resolveAllStacks().filter((r) => r.lines.length >= 2);
  if (resolved.length === 0) return null;

  return (
    <section
      id="popular-stacks"
      className="mb-12 sm:mb-20 scroll-mt-20"
      aria-labelledby="popular-stacks-heading"
      data-section="popular-stacks"
    >
      <div className="flex items-end justify-between gap-3 sm:gap-4 mb-4 sm:mb-8 border-b rule pb-3 sm:pb-4">
        <div>
          <div className="label-eyebrow text-gold-dark mb-1 sm:mb-2 text-[10px] sm:text-xs">
            Curated combinations
          </div>
          <h2
            id="popular-stacks-heading"
            className="font-display text-xl sm:text-3xl lg:text-4xl text-ink leading-tight"
          >
            Popular stacks
          </h2>
        </div>
        <p className="hidden sm:block text-sm text-ink-soft italic max-w-xs text-right" style={{ fontFamily: "var(--font-editorial)" }}>
          Frequently studied together. One-click add — Stack &amp; Save tier
          discount applies automatically.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
        {resolved.map((r) => (
          <article
            key={r.stack.slug}
            className="border border-rule bg-paper-soft p-3 sm:p-5 lg:p-6 flex flex-col gap-3"
            aria-labelledby={`stack-${r.stack.slug}`}
          >
            <Link
              href={`/catalogue/stacks/${r.stack.slug}`}
              className="-mx-3 sm:-mx-5 lg:-mx-6 -mt-3 sm:-mt-5 lg:-mt-6 mb-1 block bg-paper border-b border-rule"
              aria-hidden="true"
              tabIndex={-1}
            >
              <img
                src={r.stack.image}
                alt={`${r.stack.name} — ${r.lines.length} vials`}
                loading="lazy"
                className="w-full aspect-[4/5] object-contain"
              />
            </Link>
            <header>
              <div className="label-eyebrow text-gold-dark text-[10px] sm:text-xs mb-1.5">
                {r.lines.length}-vial stack
              </div>
              <h3
                id={`stack-${r.stack.slug}`}
                className="font-display text-lg sm:text-xl lg:text-2xl text-ink leading-tight mb-2"
              >
                {r.stack.name}
              </h3>
              <p
                className="text-sm sm:text-[15px] italic text-ink-soft leading-snug"
                style={{ fontFamily: "var(--font-editorial)" }}
              >
                {r.stack.tagline}
              </p>
            </header>

            <ul className="border-t border-rule pt-3 space-y-1.5 text-[13px] sm:text-sm">
              {r.lines.map(({ product, variant, line }) => (
                <li
                  key={variant.sku}
                  className="flex items-baseline justify-between gap-3"
                >
                  <Link
                    href={`/catalogue/${product.category_slug}/${product.slug}`}
                    className="text-ink hover:text-wine transition-colors duration-200 underline-offset-2 hover:underline"
                  >
                    {product.name} · {variant.size_mg}mg{line.quantity > 1 ? ` × ${line.quantity}` : ""}
                  </Link>
                  <span className="font-mono-data text-ink-muted text-xs whitespace-nowrap">
                    {formatPrice(variant.retail_price * line.quantity * 100)}
                  </span>
                </li>
              ))}
            </ul>

            <p className="text-xs sm:text-[13px] text-ink-soft leading-relaxed">
              {r.stack.why}
            </p>

            <div className="mt-auto pt-3 border-t border-rule flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-[0.1em] text-ink-muted font-display">
                  Retail total
                </div>
                <div className="font-mono-data text-base sm:text-lg text-ink font-semibold">
                  {formatPrice(r.retail_total_cents)}
                </div>
              </div>
              <div className="w-full sm:w-auto sm:flex-1 sm:max-w-[200px]">
                <AddStackToCartButton resolved={r} />
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default PopularStacks;
