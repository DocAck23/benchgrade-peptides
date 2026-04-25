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

/**
 * F6 logo (laurel wreath + chemist + "BENCH GRADE PEPTIDES" wordmark)
 * traced as vector. Source: research/vial-templates/F6-maroon-vector.svg
 * — maroon ink on transparent background, paints cleanly on the cream
 * paper ground used across the site.
 *
 * Roughly square (4:3 from the cropped trace bbox). Width classes drive
 * the visual size; height auto-scales by aspect ratio.
 */
const ASPECT = 918 / 654; // ≈ 1.40 : 1 — matches the F6-maroon-vector traced bbox

const WIDTH_CLASSES: Record<NonNullable<LogoProps["size"]>, string> = {
  // Bumped sizes 2026-04-25 — F6 hero treatment, big and centered.
  sm: "w-16",
  md: "w-28",
  lg: "w-40",
  xl: "w-44 md:w-60 lg:w-[280px]",
};

export function Logo({ size = "md", asStatic = false, priority = false, className }: LogoProps) {
  const imageEl = (
    <Image
      src="/brand/logo-f6.svg"
      alt="Bench Grade Peptides"
      width={918}
      height={654}
      priority={priority}
      unoptimized
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
