import Image from "next/image";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";

/**
 * `<GoldBand>` — the surface-anchor primitive from Q6 lock (sub-project A).
 *
 * Foundation commit 15 of 22.
 *
 * Q6 surface-language rule: cream throughout the page + ONE gold band per
 * page as the loudest single statement. The band sits where the page wants
 * its anchor moment (purity stat strip on home, "every lot has a CoA" on
 * a product detail page, etc.).
 *
 * Per FOUNDATION-CONTRACT Rule 9, Foundation ships the primitive but does
 * NOT place it on any page. Sub-project F places it on the homepage; D
 * places it on PDPs.
 *
 * Visual: full-bleed gold field, wine type, optional BG monogram dividers
 * flanking the headline (mirrors the gold strip on the vial label). Mobile
 * stacks vertically; desktop ≥768 puts dividers inline.
 */

interface GoldBandProps {
  eyebrow?: string;
  headline: string;
  /** Default true. Wraps the headline with twin BG monograms on desktop. */
  withMonogramDividers?: boolean;
  className?: string;
}

export function GoldBand({
  eyebrow,
  headline,
  withMonogramDividers = true,
  className,
}: GoldBandProps) {
  const monogram = withMonogramDividers ? (
    <Image
      src="/brand/bg-monogram-wine.png"
      alt=""
      aria-hidden="true"
      width={56}
      height={56}
      className="block h-8 w-auto md:h-10 opacity-90"
    />
  ) : null;

  return (
    <section
      data-surface="gold"
      className={cn(
        "w-full bg-gold text-wine py-8 md:py-10 px-5 md:px-8",
        className
      )}
    >
      <div className="max-w-[1280px] mx-auto flex flex-col items-center gap-4 md:flex-row md:items-center md:justify-center md:gap-6 text-center md:text-left">
        {monogram}
        <div className="flex flex-col items-center md:items-start">
          {eyebrow ? (
            <div className="font-ui uppercase text-[10px] md:text-[11px] tracking-[0.32em] font-bold text-wine/80 mb-1">
              {eyebrow}
            </div>
          ) : null}
          <h2 className="font-display text-xl md:text-2xl lg:text-3xl leading-tight text-wine">
            {headline}
          </h2>
        </div>
        {monogram ? (
          // Second monogram only renders on desktop, per the Q6 mockup —
          // monograms flank the headline horizontally.
          <span className="hidden md:block">{monogram}</span>
        ) : null}
      </div>
      {/* aria-label fallback so the section is announced as a meaningful
          landmark even if a screen reader skips the visual headline */}
      <span className="sr-only">{eyebrow ? `${eyebrow}. ` : ""}{headline}. {BRAND.name}.</span>
    </section>
  );
}
