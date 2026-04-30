import Link from "next/link";
import { resolveAllStacks } from "@/lib/catalogue/stacks";
import { formatPrice } from "@/lib/utils";
import { AddStackToCartButton } from "./AddStackToCartButton";

/**
 * Popular stacks — Zara-style minimalism (sub-project A·v2 batch).
 *
 * v1 had retail-total labels, italic descriptions, per-line price tables,
 * and an Add-to-cart pill all visible BEFORE the user clicked the card.
 * User feedback: "we need to redo ours to be similar to [Zara]. chic.
 * minimal. less words. I want people to click the catalogue and then
 * they can see the words."
 *
 * v2: image + stack name + total price. That's it. The Add-to-cart pill,
 * configurator, descriptions, line breakdown — all live on the stack
 * detail page (/catalogue/stacks/[slug]) once the user clicks in.
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
      <div className="flex items-end justify-between gap-3 sm:gap-4 mb-6 sm:mb-10 pb-3 sm:pb-4">
        <div>
          <div className="font-ui uppercase text-[10px] sm:text-xs tracking-[0.22em] font-bold text-gold-dark mb-2">
            Curated combinations
          </div>
          <h2
            id="popular-stacks-heading"
            className="font-display text-2xl sm:text-3xl lg:text-4xl text-wine leading-tight font-semibold tracking-tight"
          >
            Popular stacks.
          </h2>
        </div>
        <Link
          href="/catalogue/stacks/build"
          className="hidden sm:inline-flex items-center gap-1.5 text-xs font-ui uppercase tracking-[0.12em] font-bold text-wine hover:text-gold-dark transition-colors"
        >
          Or build your own →
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-3 sm:gap-5 lg:gap-6">
        {resolved.map((r) => (
          <article
            key={r.stack.slug}
            className="group flex flex-col bg-paper rounded-md overflow-hidden"
            aria-labelledby={`stack-${r.stack.slug}`}
          >
            <Link
              href={`/catalogue/stacks/${r.stack.slug}`}
              className="flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold rounded-md transition-all duration-300 hover:-translate-y-1"
            >
              <div className="relative aspect-[4/5] bg-paper-soft overflow-hidden rounded-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.stack.image}
                  alt={`${r.stack.name} — ${r.lines.length} vials`}
                  loading="lazy"
                  className="w-full h-full object-contain transition-transform duration-500 ease-out group-hover:scale-[1.06]"
                />
              </div>

              <div className="pt-3 sm:pt-4 px-1 flex flex-col gap-0.5">
                <h3
                  id={`stack-${r.stack.slug}`}
                  className="font-display text-[13px] sm:text-base lg:text-lg text-ink leading-tight line-clamp-2 min-h-[2.4em] sm:min-h-0"
                >
                  {r.stack.name}
                </h3>
                <span className="font-mono-data text-[12px] sm:text-sm text-ink-muted">
                  {formatPrice(r.retail_total_cents)}
                  <span className="text-ink-muted/70 ml-1">· {r.lines.length} vials</span>
                </span>
              </div>
            </Link>
            {/* Add-to-cart sibling to the Link so clicking the pill
                doesn't navigate to the stack page. */}
            <div className="mt-3 px-1">
              <AddStackToCartButton resolved={r} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default PopularStacks;
