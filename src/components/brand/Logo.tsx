import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoProps {
  /** Size tier. `xl` is responsive — downshifts on small screens. */
  size?: "sm" | "md" | "lg" | "xl";
  /** When true, renders as plain element (no link). Use in footer where the wrapper is the link. */
  asStatic?: boolean;
  /** Apply priority loading. Use on the primary header logo for fastest paint. */
  priority?: boolean;
  className?: string;
}

/** Intrinsic dimensions of `public/brand/logo-full.jpg`. Preserves aspect ratio. */
const INTRINSIC_WIDTH = 1376;
const INTRINSIC_HEIGHT = 768;
const ASPECT = INTRINSIC_WIDTH / INTRINSIC_HEIGHT; // ≈ 1.79 : 1

const WIDTH_CLASSES: Record<NonNullable<LogoProps["size"]>, string> = {
  sm: "w-24",
  md: "w-36",
  lg: "w-52",
  xl: "w-56 md:w-72 lg:w-[340px]",
};

/**
 * Bench Grade Peptides wordmark — Concept 5.
 *
 * Uses the approved Concept 5 rendered image as the source of truth for the
 * brand identity (peptide-bond chemistry mark + "BENCH GRADE PEPTIDES"
 * wordmark composed). Previously we ran an SVG approximation; switched to
 * the rendered image so the logo matches what was approved 1:1.
 *
 * The image background color (warm paper) is tuned to match our
 * `--color-paper` token so it blends cleanly into the header and footer.
 */
export function Logo({ size = "md", asStatic = false, priority = false, className }: LogoProps) {
  const imageEl = (
    <Image
      src="/brand/logo-full.png"
      alt="Bench Grade Peptides"
      width={INTRINSIC_WIDTH}
      height={INTRINSIC_HEIGHT}
      priority={priority}
      className="h-auto w-full select-none"
    />
  );

  const wrapped = (
    <span
      className={cn("inline-block align-middle", WIDTH_CLASSES[size], className)}
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
