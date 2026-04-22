import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoProps {
  /** Size tier. `xl` is responsive — downshifts to lg-equivalent on small screens. */
  size?: "sm" | "md" | "lg" | "xl";
  /** When true, renders as plain element (no link). Use in footer where the wrapper is the link. */
  asStatic?: boolean;
  className?: string;
}

/**
 * Bench Grade Peptides wordmark — Concept 5 variant.
 *
 * Composition: peptide-bond mark on the left (the canonical —C(=O)—N—
 * peptide bond notation between two residues), ultra-wide letter-spaced
 * "BENCH GRADE / PEPTIDES" wordmark to the right, clinical cyan accent.
 *
 * The `xl` tier is responsive: it renders at roughly `lg` scale on
 * narrow mobile widths and grows to full xl at md+. Fixed-size tiers
 * (sm, md, lg) do not downshift.
 */
export function Logo({ size = "md", asStatic = false, className }: LogoProps) {
  const wordmark = (
    <span className={cn("flex items-center gap-3 md:gap-3.5 min-w-0", className)}>
      <PeptideBondMark size={size} />
      <span className="flex flex-col leading-none min-w-0">
        <span
          className={cn(
            "font-sans font-medium text-ink whitespace-nowrap",
            size === "sm" && "text-xs tracking-[0.24em]",
            size === "md" && "text-sm tracking-[0.26em]",
            size === "lg" && "text-lg tracking-[0.28em]",
            size === "xl" && "text-base tracking-[0.26em] md:text-xl md:tracking-[0.28em] lg:text-2xl lg:tracking-[0.30em]"
          )}
        >
          BENCH&nbsp;GRADE
        </span>
        <span
          className={cn(
            "font-sans font-normal text-ink-muted mt-[5px] whitespace-nowrap",
            size === "sm" && "text-[9px] tracking-[0.32em]",
            size === "md" && "text-[10px] tracking-[0.34em]",
            size === "lg" && "text-[11px] tracking-[0.36em]",
            size === "xl" && "text-[10px] tracking-[0.34em] md:text-[11px] md:tracking-[0.36em] lg:text-[13px] lg:tracking-[0.38em]"
          )}
        >
          PEPTIDES
        </span>
      </span>
    </span>
  );

  if (asStatic) return wordmark;

  return (
    <Link href="/" aria-label="Bench Grade Peptides — home" className="inline-block min-w-0">
      {wordmark}
    </Link>
  );
}

/**
 * Peptide-bond mark.
 *
 * Depicts the canonical peptide bond between two amino-acid residues:
 *
 *                  O
 *                  ‖
 *        (Rα)━━━━━C━━━━━(Rα')
 *                        (cyan accent)
 *
 * Scales cleanly from 22px (sm) up to 48px (xl) with the double-bond
 * notation remaining visible. At `xl`, the SVG is responsive — it sizes
 * down on mobile to match the wordmark's responsive downshift.
 */
function PeptideBondMark({ size }: { size: "sm" | "md" | "lg" | "xl" }) {
  // Fixed-size tiers: explicit width/height via SVG attributes.
  if (size !== "xl") {
    const height = size === "sm" ? 22 : size === "md" ? 26 : 36;
    const width = Math.round(height * 2.1);
    const lineStroke = size === "sm" ? 1.2 : size === "md" ? 1.3 : 1.4;
    const bondStroke = size === "sm" ? 1.0 : 1.2;
    return <BondSVG width={width} height={height} lineStroke={lineStroke} bondStroke={bondStroke} />;
  }

  // xl: responsive via Tailwind classes on the SVG element.
  return (
    <BondSVG
      className="h-[30px] w-[63px] md:h-[38px] md:w-[80px] lg:h-[48px] lg:w-[101px]"
      lineStroke={1.6}
      bondStroke={1.2}
    />
  );
}

function BondSVG({
  width,
  height,
  className,
  lineStroke,
  bondStroke,
}: {
  width?: number;
  height?: number;
  className?: string;
  lineStroke: number;
  bondStroke: number;
}) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 56 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      {/* Main horizontal bond line */}
      <line
        x1="5"
        y1="17"
        x2="51"
        y2="17"
        stroke="var(--color-ink)"
        strokeWidth={lineStroke}
        strokeLinecap="round"
      />
      {/* Residue 1 (alpha-carbon / left side) — filled */}
      <circle cx="5" cy="17" r="3.5" fill="var(--color-ink)" />
      {/* Carbonyl carbon — filled, slightly smaller than residues */}
      <circle cx="28" cy="17" r="2.8" fill="var(--color-ink)" />
      {/* Double bond upward from carbonyl carbon to oxygen */}
      <line
        x1="26.3"
        y1="14.2"
        x2="26.3"
        y2="6"
        stroke="var(--color-ink)"
        strokeWidth={bondStroke}
        strokeLinecap="round"
      />
      <line
        x1="29.7"
        y1="14.2"
        x2="29.7"
        y2="6"
        stroke="var(--color-ink)"
        strokeWidth={bondStroke}
        strokeLinecap="round"
      />
      {/* Oxygen atom above (open circle) */}
      <circle
        cx="28"
        cy="3.8"
        r="2"
        fill="var(--color-paper)"
        stroke="var(--color-ink)"
        strokeWidth={bondStroke}
      />
      {/* Residue 2 — open with clinical cyan accent */}
      <circle
        cx="51"
        cy="17"
        r="3.5"
        fill="var(--color-paper)"
        stroke="var(--color-ink)"
        strokeWidth={lineStroke}
      />
      <circle cx="51" cy="17" r="1.4" fill="#00A5B8" />
    </svg>
  );
}
