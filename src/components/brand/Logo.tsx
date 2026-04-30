import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";

/**
 * `<Logo>` — surface-aware brand mark for Bench Grade Peptides.
 *
 * Sub-project A · Foundation, commit 9 of 22. Replaces the v1 laurel-logo
 * component with the v2 Pinyon-script wordmark lockup. The Pinyon Script
 * font itself is brand-rule reserved to the image asset (see
 * memory/brand_visual_identity_v2.md) — never loaded as a webfont.
 *
 * Asset reality:
 *   public/brand/logo-gold.png   — metallic gradient on transparent (primary)
 *   public/brand/logo-wine.png   — alpha-tinted wine flat
 *   public/brand/logo-red.png    — alpha-tinted brick-red flat
 *   public/brand/logo-cream.png  — alpha-tinted cream flat
 *   public/brand/logo-black.png  — alpha-tinted black flat
 *
 * Asset paths come from BRAND.logoMetallic / BRAND.logoFlat — sub-projects
 * never reach for raw paths (see FOUNDATION-CONTRACT Rule 2).
 *
 * API (v2):
 *   <Logo variant="gold" />               — explicit variant
 *   <Logo surface="wine" />               — surface auto-picks the variant
 *   <Logo size="nav" />                   — 260 px (header)
 *   <Logo size="footer" />                — 280 px
 *   <Logo size="hero" priority />         — 320 px
 *   <Logo size={240} />                   — explicit numeric width
 *   <Logo asStatic />                     — render without Link wrapper
 *
 * Legacy v1 props (preserved for back-compat through the codemod sweep):
 *   variant="mark"        → resolves via surface (cream→wine, wine→gold)
 *   variant="wordmark"    → text fallback (deprecated; kept silently working)
 *   variant="full"|"seal" → falls back to "mark" behavior
 *   size="sm"|"md"|"lg"|"xl" → maps to numeric widths
 */

// ---- v2 variants (transparent PNGs in /public/brand) ----
type LogoVariantV2 = "gold" | "wine" | "red" | "cream" | "black";
// ---- v1 variants (kept as accepted prop values; mapped internally) ----
type LogoVariantLegacy = "full" | "mark" | "wordmark" | "seal";
export type LogoVariant = LogoVariantV2 | LogoVariantLegacy;

export type LogoSurface = "cream" | "wine" | "red" | "gold" | "black";

export type LogoSizeV2 = "nav" | "footer" | "hero";
export type LogoSizeLegacy = "sm" | "md" | "lg" | "xl";
export type LogoSize = LogoSizeV2 | LogoSizeLegacy | number;

interface LogoProps {
  variant?: LogoVariant;
  surface?: LogoSurface;
  size?: LogoSize;
  /** Render without the `<Link href="/">` wrapper (Footer wraps it in its own link). */
  asStatic?: boolean;
  /** Apply Next/Image priority hint. Use sparingly — only for the LCP element. */
  priority?: boolean;
  className?: string;
}

// v2 named sizes (locked Foundation Q2): 180 / 280 / 320
const NAMED_SIZE_PX: Record<LogoSizeV2 | LogoSizeLegacy, number> = {
  nav: 260,
  footer: 280,
  hero: 320,
  sm: 64,
  md: 180, // legacy md ≈ v2 nav
  lg: 280, // legacy lg ≈ v2 footer
  xl: 320, // legacy xl ≈ v2 hero
};

// Surface → variant auto-pick. Picks the wordmark colorway that has the
// best contrast against the surface.
const SURFACE_VARIANT: Record<LogoSurface, LogoVariantV2> = {
  wine: "gold",
  cream: "wine",
  black: "gold",
  red: "gold",
  gold: "wine",
};

const ASSET_RATIO = BRAND.logoWidth / BRAND.logoHeight; // 1709 / 441

function resolveVariant(
  variant: LogoVariant | undefined,
  surface: LogoSurface | undefined
): LogoVariantV2 | "wordmark" {
  // v2 explicit variant wins
  if (
    variant === "gold" ||
    variant === "wine" ||
    variant === "red" ||
    variant === "cream" ||
    variant === "black"
  ) {
    return variant;
  }
  // v1 wordmark — kept as text fallback for back-compat
  if (variant === "wordmark") return "wordmark";
  // v1 mark / full / seal — resolve via surface
  return surface ? SURFACE_VARIANT[surface] : "gold";
}

function resolveWidthPx(size: LogoSize | undefined): number {
  if (typeof size === "number") return size;
  if (size && size in NAMED_SIZE_PX) return NAMED_SIZE_PX[size];
  return 180; // default = nav
}

function variantSrc(variant: LogoVariantV2): string {
  // brand.ts owns ALL variant paths via BRAND.logoVariants.
  // Codex adversarial review #2 fix P3: previously this hard-coded
  // /brand/logo-${variant}.png for the flat variants, breaking the
  // single-source-of-truth contract whenever an asset path moved.
  return BRAND.logoVariants[variant];
}

export function Logo({
  variant,
  surface,
  size = "nav",
  asStatic = false,
  priority = false,
  className,
}: LogoProps) {
  const resolved = resolveVariant(variant, surface);
  const widthPx = resolveWidthPx(size);
  const heightPx = Math.round(widthPx / ASSET_RATIO);

  // Legacy "wordmark" text-only path. v2 brand rule says lockup is an
  // image, but the Header/Footer might still pass variant="wordmark"
  // through prior code paths until the codemod sweep. Render text so
  // builds don't break; the image variants are the canonical path.
  if (resolved === "wordmark") {
    const node = (
      <span
        data-logo-surface={surface ?? "cream"}
        className={cn(
          "inline-block align-middle font-display uppercase tracking-[0.18em] leading-none",
          className
        )}
        style={{ width: widthPx }}
      >
        {BRAND.shortName}
      </span>
    );
    if (asStatic) return node;
    return (
      <Link
        href="/"
        aria-label={`${BRAND.name} — home`}
        className="inline-block"
      >
        {node}
      </Link>
    );
  }

  // Width: parent wrapper controls the rendered width via Tailwind
  // (so it can be responsive). `widthPx` from `size` prop is the
  // FALLBACK when no parent width is set — applied as max-width so
  // a smaller parent can still shrink the logo.
  const node = (
    <span
      data-logo-surface={surface ?? "cream"}
      data-logo-variant={resolved}
      className={cn("inline-block align-middle w-full", className)}
      style={{ maxWidth: widthPx, lineHeight: 0 }}
    >
      <Image
        src={variantSrc(resolved)}
        alt={BRAND.name}
        width={BRAND.logoWidth}
        height={BRAND.logoHeight}
        priority={priority}
        sizes={`${widthPx}px`}
        className="h-auto w-full select-none"
      />
    </span>
  );

  if (asStatic) return node;
  return (
    <Link
      href="/"
      aria-label={`${BRAND.name} — home`}
      className="inline-block"
    >
      {node}
    </Link>
  );
}
