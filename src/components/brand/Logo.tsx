import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoProps {
  /** Size tier. `xl` is responsive — downshifts on small screens. */
  size?: "sm" | "md" | "lg" | "xl";
  /** When true, renders as plain element (no link). Use in footer where the wrapper is the link. */
  asStatic?: boolean;
  className?: string;
}

/**
 * Bench Grade Peptides wordmark — Concept 5 variant.
 *
 * Composition: peptide-bond chemistry diagram on the left (labeled atoms
 * —N—C with =O above and below, plus a cyan checkmark accent), ultra-wide
 * letter-spaced "BENCH GRADE / PEPTIDES" wordmark to the right.
 *
 * Modeled directly on the Concept 5 reference image.
 */
export function Logo({ size = "md", asStatic = false, className }: LogoProps) {
  const wordmark = (
    <span className={cn("flex items-center gap-3 md:gap-4 min-w-0", className)}>
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
 * Peptide-bond chemistry mark.
 *
 * Labeled skeletal-formula notation:
 *
 *               O         ✓  (clinical cyan checkmark accent)
 *               ‖
 *        ─N━━━━C
 *               ‖
 *               O
 *
 * Atom labels in the display font (Geist) for visual consistency with
 * the wordmark. Two parallel vertical bond lines render each C=O double
 * bond. The cyan checkmark sits top-right as the brand accent.
 *
 * Renders as this detailed skeletal diagram at xl. At smaller sizes
 * (sm/md/lg) labels become illegible, so those tiers use a simplified
 * bond-dot variant without letters.
 */
function PeptideBondMark({ size }: { size: "sm" | "md" | "lg" | "xl" }) {
  if (size === "xl") {
    return (
      <svg
        viewBox="0 0 80 96"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0 h-[48px] w-auto md:h-[58px] lg:h-[72px]"
      >
        {/* Left R-group dash */}
        <line
          x1="4"
          y1="48"
          x2="14"
          y2="48"
          stroke="var(--color-ink)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* N letter */}
        <text
          x="23"
          y="54"
          fontSize="18"
          fontWeight="500"
          fill="var(--color-ink)"
          textAnchor="middle"
          style={{ fontFamily: "var(--font-display), sans-serif" }}
        >
          N
        </text>

        {/* Horizontal bond N ── C */}
        <line
          x1="31"
          y1="48"
          x2="43"
          y2="48"
          stroke="var(--color-ink)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* C letter */}
        <text
          x="52"
          y="54"
          fontSize="18"
          fontWeight="500"
          fill="var(--color-ink)"
          textAnchor="middle"
          style={{ fontFamily: "var(--font-display), sans-serif" }}
        >
          C
        </text>

        {/* Upper =O double bond (two parallel vertical lines) */}
        <line
          x1="50"
          y1="38"
          x2="50"
          y2="20"
          stroke="var(--color-ink)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <line
          x1="54"
          y1="38"
          x2="54"
          y2="20"
          stroke="var(--color-ink)"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Upper O letter */}
        <text
          x="52"
          y="14"
          fontSize="18"
          fontWeight="500"
          fill="var(--color-ink)"
          textAnchor="middle"
          style={{ fontFamily: "var(--font-display), sans-serif" }}
        >
          O
        </text>

        {/* Lower =O double bond */}
        <line
          x1="50"
          y1="60"
          x2="50"
          y2="78"
          stroke="var(--color-ink)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <line
          x1="54"
          y1="60"
          x2="54"
          y2="78"
          stroke="var(--color-ink)"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Lower O letter */}
        <text
          x="52"
          y="92"
          fontSize="18"
          fontWeight="500"
          fill="var(--color-ink)"
          textAnchor="middle"
          style={{ fontFamily: "var(--font-display), sans-serif" }}
        >
          O
        </text>

        {/* Cyan checkmark accent — clinical brand accent */}
        <path
          d="M 60 20 L 64 24 L 74 10"
          stroke="#00A5B8"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  // Smaller sizes use a simplified bond-dot variant (no atom labels — they'd
  // be unreadable at 22–36px tall).
  const height = size === "sm" ? 22 : size === "md" ? 26 : 36;
  const width = Math.round(height * 2.1);
  const lineStroke = size === "sm" ? 1.2 : size === "md" ? 1.3 : 1.4;
  const bondStroke = size === "sm" ? 1.0 : 1.2;

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 56 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="shrink-0"
    >
      <line
        x1="5"
        y1="17"
        x2="51"
        y2="17"
        stroke="var(--color-ink)"
        strokeWidth={lineStroke}
        strokeLinecap="round"
      />
      <circle cx="5" cy="17" r="3.5" fill="var(--color-ink)" />
      <circle cx="28" cy="17" r="2.8" fill="var(--color-ink)" />
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
      <circle
        cx="28"
        cy="3.8"
        r="2"
        fill="var(--color-paper)"
        stroke="var(--color-ink)"
        strokeWidth={bondStroke}
      />
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
