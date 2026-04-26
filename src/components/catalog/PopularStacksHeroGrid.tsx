import Link from "next/link";
import { resolveAllStacks } from "@/lib/catalog/stacks";
import { formatPrice } from "@/lib/utils";

/**
 * Hero-side popular-stacks grid. Renders the right column of the homepage
 * hero — a compact list of curated stack mini-cards. Each card click-
 * throughs to the stack picker at `/catalog/stacks/[slug]` where the
 * customer chooses vial sizes per line, optionally removes/swaps items,
 * sets stack quantity, and adds the whole thing to cart in one step.
 *
 * Pure server component for SEO. Card surface stays cream/paper-soft so
 * the cards "pop" against either a paper or wine hero background.
 */
export function PopularStacksHeroGrid() {
  const resolved = resolveAllStacks().filter((r) => r.lines.length >= 2);
  if (resolved.length === 0) return null;

  return (
    <aside aria-labelledby="hero-stacks-heading" className="lg:pt-2">
      <div className="label-eyebrow text-gold-dark mb-2 text-[11px] sm:text-xs">
        Curated combinations
      </div>
      <h2
        id="hero-stacks-heading"
        className="font-display text-2xl sm:text-3xl lg:text-[32px] text-wine leading-tight mb-5 sm:mb-6"
      >
        Browse popular peptide stacks.
      </h2>
      <p
        className="text-[14px] sm:text-[15px] italic text-ink-soft leading-snug mb-6 sm:mb-7"
        style={{ fontFamily: "var(--font-editorial)" }}
      >
        Click any stack to choose vial sizes, swap items, and add the whole
        bundle to your cart.
      </p>

      <ul className="space-y-3 sm:space-y-4">
        {resolved.map((r) => (
          <li key={r.stack.slug}>
            <Link
              href={`/catalog/stacks/${r.stack.slug}`}
              className="group block border border-rule bg-paper-soft hover:bg-paper-soft hover:border-gold-dark transition-colors duration-200 px-4 sm:px-5 py-3.5 sm:py-4"
            >
              <div className="flex items-baseline justify-between gap-3 mb-1.5">
                <h3 className="font-display text-base sm:text-[17px] text-ink leading-tight">
                  {r.stack.name}
                </h3>
                <span className="font-mono-data text-xs text-ink-muted whitespace-nowrap">
                  {r.lines.length} vial{r.lines.length === 1 ? "" : "s"}
                </span>
              </div>
              <p className="text-[12.5px] sm:text-[13px] text-ink-soft leading-snug mb-2">
                {r.stack.tagline}
              </p>
              <div className="flex items-center justify-between gap-3 pt-2 border-t border-rule">
                <span className="font-mono-data text-[13px] text-ink">
                  {formatPrice(r.retail_total_cents)}
                </span>
                <span className="text-[11px] uppercase tracking-[0.1em] text-gold-dark font-display group-hover:underline underline-offset-4">
                  Customize →
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export default PopularStacksHeroGrid;
