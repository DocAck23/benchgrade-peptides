import Link from "next/link";
import { resolveAllStacks } from "@/lib/catalogue/stacks";
import { formatPrice } from "@/lib/utils";
import { AddStackToCartButton } from "./AddStackToCartButton";

const HERO_STACK_SLUGS = [
  "wolverine-stack",
  "mega-recovery-stack",
  "metabolic-cu-tripeptide-stack",
] as const;

export function PopularStacksHeroGrid() {
  const all = resolveAllStacks().filter((r) => r.lines.length >= 2);
  const featured = HERO_STACK_SLUGS
    .map((slug) => all.find((r) => r.stack.slug === slug))
    .filter((r): r is NonNullable<typeof r> => r !== undefined);
  if (featured.length === 0) return null;

  return (
    <aside aria-labelledby="hero-stacks-heading" className="lg:pt-2">
      <div className="label-eyebrow text-gold-dark mb-2 text-[11px] sm:text-xs">
        Curated combinations
      </div>
      <h2
        id="hero-stacks-heading"
        className="font-display text-2xl sm:text-3xl lg:text-[32px] text-wine leading-tight mb-4 sm:mb-5"
      >
        Browse popular peptide stacks.
      </h2>
      <p
        className="text-[14px] sm:text-[15px] italic text-ink-soft leading-snug mb-5 sm:mb-6"
        style={{ fontFamily: "var(--font-editorial)" }}
      >
        Click any stack to choose vial sizes, swap items, and add the whole
        bundle to your cart.
      </p>

      {/* Mobile: 3-column compact grid (image + name + price only).
          sm+: rich vertical list with description + add-to-cart button. */}
      <ul className="grid grid-cols-3 gap-2 sm:flex sm:flex-col sm:gap-4">
        {featured.map((r) => (
          <li
            key={r.stack.slug}
            className="border border-rule bg-paper-soft hover:border-gold-dark transition-colors duration-200"
          >
            {/* Mobile compact card */}
            <Link
              href={`/catalogue/stacks/${r.stack.slug}`}
              className="sm:hidden flex flex-col p-2 gap-1.5 hover:bg-paper transition-colors"
            >
              <div className="-mx-2 -mt-2 mb-1 bg-paper border-b border-rule">
                <img
                  src={r.stack.image}
                  alt=""
                  loading="lazy"
                  className="w-full aspect-square object-contain"
                />
              </div>
              <div className="label-eyebrow text-gold-dark text-[8px]">
                {r.lines.length}-vial
              </div>
              <h3 className="font-display text-[12px] text-ink leading-tight line-clamp-2 min-h-[2.4em]">
                {r.stack.name}
              </h3>
              <div className="mt-auto pt-1 border-t border-rule flex items-baseline justify-between gap-1">
                <span className="text-[8px] uppercase tracking-[0.05em] text-ink-muted font-display">Total</span>
                <span className="font-mono-data text-[11px] text-ink font-semibold whitespace-nowrap">
                  {formatPrice(r.retail_total_cents)}
                </span>
              </div>
            </Link>

            {/* sm+ rich card */}
            <Link
              href={`/catalogue/stacks/${r.stack.slug}`}
              className="hidden sm:flex group gap-4 px-4 pt-3 pb-2.5 focus-visible:outline-none"
            >
              <img
                src={r.stack.image}
                alt={`${r.stack.name} — ${r.lines.length} vials`}
                loading="lazy"
                className="w-20 h-20 flex-none object-contain bg-paper border border-rule"
              />
              <div className="flex-1 min-w-0 flex flex-col">
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <h3 className="font-display text-[17px] text-ink leading-tight truncate">
                    {r.stack.name}
                  </h3>
                  <span className="font-mono-data text-[11px] text-ink-muted whitespace-nowrap">
                    {r.lines.length} vials
                  </span>
                </div>
                <p className="text-[12.5px] text-ink-soft leading-snug line-clamp-2 mb-1.5">
                  {r.stack.tagline}
                </p>
                <div className="mt-auto flex items-center justify-between gap-3 pt-1.5 border-t border-rule">
                  <span className="font-mono-data text-[12.5px] text-ink">
                    {formatPrice(r.retail_total_cents)}
                  </span>
                  <span className="text-[10.5px] uppercase tracking-[0.1em] text-gold-dark font-display group-hover:underline underline-offset-4">
                    Customize →
                  </span>
                </div>
              </div>
            </Link>
            <div className="hidden sm:block px-4 pb-3">
              <AddStackToCartButton resolved={r} />
            </div>
          </li>
        ))}
      </ul>

      <Link
        href="/catalogue#popular-stacks"
        className="mt-5 sm:mt-6 inline-flex items-center justify-center w-full px-4 py-3 border border-wine text-wine font-display text-[13px] uppercase tracking-[0.12em] hover:bg-wine hover:text-paper transition-colors duration-200"
      >
        View all stacks →
      </Link>
    </aside>
  );
}

export default PopularStacksHeroGrid;
