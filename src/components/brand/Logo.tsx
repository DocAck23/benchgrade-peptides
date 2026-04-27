import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * `<Logo>` — surface-aware brand mark for Bench Grade Peptides.
 *
 * Asset reality (2026-04-25 brand pivot):
 *   public/brand/logo-mark.svg   — wine `#5C1A1A` mark on transparent.
 *                                  Designed for cream surfaces; the only
 *                                  SVG variant on disk today.
 *
 * Future asset slots (referenced in spec §16.1, not yet on disk):
 *   logo-mark-gold-on-cream.svg  — proper gold detail on cream
 *   logo-mark-cream-on-wine.svg  — cream/gold mark for wine surfaces
 *   wordmark-only.svg            — wordmark glyphs only
 *   seal-mark.svg                — laurel seal without wordmark
 *
 * Until those land, every image variant resolves to logo-mark.svg and we
 * lean on surface-aware CSS (the `[data-logo-surface="wine"]` wrapper) to
 * invert the mark on wine backgrounds. `variant="wordmark"` skips the SVG
 * entirely and renders Cinzel uppercase text — works on either surface by
 * inheriting the surrounding `color`.
 *
 * The legacy `size` + `asStatic` API used by `<Header>` / `<Footer>` is
 * preserved verbatim so Sprint 0 Task 3 owns consumer migration on its own
 * timeline. Existing callers (e.g. `<Logo size="xl" priority />`) keep
 * working with no source change.
 *
 * TODO: replace the wine-surface CSS recolor with a proper
 *   `logo-mark-cream-on-wine.svg` once the asset lands.
 * TODO: wire `variant="full"` and `variant="seal"` to their dedicated SVGs
 *   once they exist; today they fall back to `logo-mark.svg`.
 */

const MARK_SRC = "/brand/logo-mark.svg";
// Gold-on-transparent variant — used on wine surfaces (Header, Footer, RUOBanner,
// premium tier callouts) where the wine fill of MARK_SRC would disappear.
const MARK_GOLD_SRC = "/brand/logo-mark-gold.svg";
// Native bbox of the traced mark — preserved from the F6 vector trace.
const MARK_WIDTH = 918;
const MARK_HEIGHT = 654;
const ASPECT = MARK_WIDTH / MARK_HEIGHT; // ≈ 1.40 : 1

export type LogoVariant = "full" | "mark" | "wordmark" | "seal";
export type LogoSurface = "cream" | "wine";
export type LogoSize = "sm" | "md" | "lg" | "xl";

interface LogoProps {
  /** Asset variant. Defaults to `"mark"`. */
  variant?: LogoVariant;
  /** Surface context. Drives CSS recolor on wine backgrounds. Defaults to `"cream"`. */
  surface?: LogoSurface;
  /** Legacy size tier. Used by `<Header>` (`size="xl"`). */
  size?: LogoSize;
  /** Render plain (no `<Link>` wrapper). Footer wraps the logo in its own link. */
  asStatic?: boolean;
  /** Apply `priority` loading. Use on the primary header logo. */
  priority?: boolean;
  className?: string;
}

const WIDTH_CLASSES: Record<LogoSize, string> = {
  sm: "w-16",
  md: "w-28",
  lg: "w-40",
  // Mobile: small enough that cart + hamburger have breathing room.
  // sm+ steps back up to the editorial-sized mark.
  xl: "w-28 sm:w-44 md:w-60 lg:w-[280px]",
};

function srcFor(variant: LogoVariant, surface: LogoSurface): string {
  // Surface-aware routing: wine surfaces get the gold-on-transparent SVG
  // so the mark stands against the wine background; cream surfaces get
  // the wine-on-transparent SVG (the original).
  switch (variant) {
    case "full":
    case "mark":
    case "seal":
    default:
      return surface === "wine" ? MARK_GOLD_SRC : MARK_SRC;
  }
}

export function Logo({
  variant = "mark",
  surface = "cream",
  size = "md",
  asStatic = false,
  priority = false,
  className,
}: LogoProps) {
  const sizingClass = WIDTH_CLASSES[size];

  // Wordmark path: inline Cinzel text. Inherits color from context, so a
  // cream surface gets wine glyphs and a wine surface gets cream glyphs
  // (provided the parent sets `color` via `[data-surface="wine"]`).
  if (variant === "wordmark") {
    const wordmark = (
      <span
        data-logo-surface={surface}
        className={cn(
          "inline-block align-middle font-display uppercase tracking-[0.18em] leading-none",
          sizingClass,
          className,
        )}
      >
        BENCH GRADE PEPTIDES
      </span>
    );
    if (asStatic) return wordmark;
    return (
      <Link href="/" aria-label="Bench Grade Peptides — home" className="inline-block">
        {wordmark}
      </Link>
    );
  }

  const src = srcFor(variant, surface);

  const imageEl = (
    <Image
      src={src}
      alt="Bench Grade Peptides"
      width={MARK_WIDTH}
      height={MARK_HEIGHT}
      priority={priority}
      unoptimized
      className="h-auto w-full select-none"
    />
  );

  // `data-logo-surface` is the hook for surface-aware CSS: on
  // `surface="wine"`, a global `filter`/`color` rule recolors the wine SVG
  // toward cream until a proper cream-on-wine asset ships.
  // TODO: replace with proper gold-on-wine SVG once asset lands.
  const wrapped = (
    <span
      data-logo-surface={surface}
      className={cn("inline-block align-middle", sizingClass, className)}
      style={{ aspectRatio: `${ASPECT}` }}
    >
      {imageEl}
    </span>
  );

  if (asStatic) return wrapped;

  return (
    <Link href="/" aria-label="Bench Grade Peptides — home" className="inline-block">
      {wrapped}
    </Link>
  );
}
