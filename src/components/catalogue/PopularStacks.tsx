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
        <div className="flex flex-col items-end gap-2 max-w-sm">
          <p className="hidden sm:block text-sm text-ink-soft italic text-right" style={{ fontFamily: "var(--font-editorial)" }}>
            Frequently studied together. One-click add — Stack &amp; Save tier
            discount applies automatically.
          </p>
          <Link
            href="/catalogue/stacks/build"
            className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-display uppercase tracking-[0.12em] text-wine border-b border-wine hover:text-gold-dark hover:border-gold-dark transition-colors"
          >
            Or build your own →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
        {resolved.map((r) => (
          <article
            key={r.stack.slug}
            className="border border-rule bg-paper p-3 sm:p-4 lg:p-5 flex flex-col gap-2 sm:gap-3 overflow-hidden"
            aria-labelledby={`stack-${r.stack.slug}`}
          >
            {/* Mobile: whole card is a single link to the stack page,
                so the cramped 3-per-row layout always has one clear tap
                target. From sm up we keep the image + content separate
                links so the items inside the list can deep-link to
                individual products. */}
            <Link
              href={`/catalogue/stacks/${r.stack.slug}`}
              className="sm:hidden -m-2 p-2 flex flex-col gap-2 hover:bg-paper transition-colors"
              aria-labelledby={`stack-${r.stack.slug}`}
            >
              <div className="-mx-2 -mt-2 mb-1 bg-paper border-b border-rule">
                <img
                  src={r.stack.image}
                  alt=""
                  loading="lazy"
                  className="w-full aspect-square object-contain"
                />
              </div>
              <div className="label-eyebrow text-gold-dark text-[8px] mb-0.5">
                {r.lines.length}-vial
              </div>
              <h3
                id={`stack-${r.stack.slug}`}
                className="font-display text-[12px] text-ink leading-tight line-clamp-2 min-h-[2.4em]"
              >
                {r.stack.name}
              </h3>
              <div className="mt-auto pt-1.5 border-t border-rule flex items-baseline justify-between gap-1">
                <span className="text-[8px] uppercase tracking-[0.05em] text-ink-muted font-display">
                  Total
                </span>
                <span className="font-mono-data text-[11px] text-ink font-semibold whitespace-nowrap">
                  {formatPrice(r.retail_total_cents)}
                </span>
              </div>
            </Link>

            {/* Tablet & desktop card — full content, AddStackToCart CTA.
                The image, header, and lines all sit INSIDE the card
                padding box so the cream-bleed-into-paper artifact
                founder noticed (negative-margin tagline band visible
                under the card edge) is gone. The whole card is now a
                clean stack of stacked sections, each properly bordered
                and contained. */}
            <Link
              href={`/catalogue/stacks/${r.stack.slug}`}
              className="hidden sm:block bg-paper-soft border border-rule mb-1"
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
            <header className="hidden sm:block">
              <div className="label-eyebrow text-gold-dark text-[11px] sm:text-xs mb-2">
                {r.lines.length}-vial stack
              </div>
              <h3
                className="font-display text-lg sm:text-xl lg:text-2xl text-ink leading-tight mb-2"
              >
                {r.stack.name}
              </h3>
              <p className="text-[14px] sm:text-[15px] text-ink leading-snug">
                {r.stack.tagline}
              </p>
            </header>

            <ul className="hidden sm:block border-t border-rule pt-3 space-y-1.5 text-[13px] sm:text-[14px]">
              {r.lines.map(({ product, variant, line }) => (
                <li
                  key={variant.sku}
                  className="flex items-baseline justify-between gap-3"
                >
                  <Link
                    href={`/catalogue/${product.category_slug}/${product.slug}`}
                    className="font-medium text-ink hover:text-wine transition-colors duration-200 underline-offset-2 hover:underline truncate"
                  >
                    {product.name} · {variant.size_mg}mg{line.quantity > 1 ? ` × ${line.quantity}` : ""}
                  </Link>
                  <span className="font-mono-data text-ink-muted text-[13px] whitespace-nowrap">
                    {formatPrice(variant.retail_price * line.quantity * 100)}
                  </span>
                </li>
              ))}
            </ul>

            <p className="hidden sm:block text-[13px] italic text-ink-soft leading-relaxed pt-2 border-t border-rule/60" style={{ fontFamily: "var(--font-editorial)" }}>
              {r.stack.why}
            </p>

            <div className="hidden sm:flex mt-auto pt-3 border-t border-rule flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <div className="text-[11px] uppercase tracking-[0.1em] text-ink-muted font-display">
                  Retail total
                </div>
                <div className="font-mono-data text-base sm:text-lg text-ink font-semibold">
                  {formatPrice(r.retail_total_cents)}
                </div>
              </div>
              <AddStackToCartButton resolved={r} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default PopularStacks;
