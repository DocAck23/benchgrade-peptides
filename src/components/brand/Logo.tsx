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
 * Composition: peptide-bond molecule on the left (proper organic-chem
 * skeletal formula — zigzag backbone, implicit carbons at vertices, only
 * heteroatoms labeled, C=O carbonyl and N-H amide explicit), ultra-wide
 * letter-spaced "BENCH GRADE / PEPTIDES" wordmark to the right.
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
 * Peptide-bond mark — organic-chem skeletal formula.
 *
 * Depicts the canonical peptide bond between two amino-acid residues in
 * proper skeletal notation:
 *
 *                   O
 *                   ‖      ✓  (cyan accent)
 *              ╱━━━━╲━━━━N━━━━╲
 *             ╱           │     ╲
 *                          H
 *
 * Chemistry-accurate conventions:
 *   - Carbons are implicit at vertices (no "C" labels — this is skeletal
 *     style, not Lewis notation)
 *   - Only heteroatoms (N, O) are labeled
 *   - The C=O double bond is drawn as two parallel lines
 *   - The N-H hydrogen is explicit (shown as "H" with a short single bond),
 *     per standard amide depiction
 *   - Zigzag chain geometry (~120° bond angles) represents the peptide
 *     backbone
 *   - Clinical cyan checkmark accent near the carbonyl oxygen
 */
function PeptideBondMark({ size }: { size: "sm" | "md" | "lg" | "xl" }) {
  if (size === "xl") {
    return <SkeletalPeptideBondSVG responsive />;
  }

  // Smaller sizes use a simplified bond-dot variant (labels unreadable below ~40px).
  const height = size === "sm" ? 22 : size === "md" ? 26 : 36;
  return <SimplifiedBondSVG height={height} />;
}

/**
 * Full skeletal-formula peptide bond (xl).
 * viewBox: 0 0 120 80. Carbon vertices implicit. Heteroatoms labeled.
 */
function SkeletalPeptideBondSVG({ responsive }: { responsive?: boolean }) {
  const ink = "var(--color-ink)";
  const bondStroke = 2.2;
  const doubleBondStroke = 1.8;
  const labelFontSize = 14;
  // Short gap between the bond endpoint and the letter centered at that point
  // so the bond line doesn't pierce the letter.
  return (
    <svg
      viewBox="0 0 120 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn(
        "shrink-0",
        responsive && "h-[44px] w-auto md:h-[56px] lg:h-[68px]"
      )}
    >
      {/* ---- Backbone zigzag ---- */}
      {/* Segment 1: far-left Cα_1 → first vertex (carbonyl carbon) */}
      <line x1="6" y1="56" x2="28" y2="36" stroke={ink} strokeWidth={bondStroke} strokeLinecap="round" />
      {/* Segment 2: carbonyl C → N (peptide bond) — the N letter sits at this vertex,
          so the line ends short of the letter. */}
      <line x1="28" y1="36" x2="46" y2="56" stroke={ink} strokeWidth={bondStroke} strokeLinecap="round" />
      {/* Segment 3: N → Cα_2 (start of continuation) */}
      <line x1="58" y1="56" x2="76" y2="36" stroke={ink} strokeWidth={bondStroke} strokeLinecap="round" />
      {/* Segment 4: Cα_2 → far-right end */}
      <line x1="76" y1="36" x2="98" y2="56" stroke={ink} strokeWidth={bondStroke} strokeLinecap="round" />

      {/* ---- C=O double bond (up from the first vertex at x=28, y=36) ---- */}
      <line x1="25" y1="32" x2="25" y2="18" stroke={ink} strokeWidth={doubleBondStroke} strokeLinecap="round" />
      <line x1="31" y1="32" x2="31" y2="18" stroke={ink} strokeWidth={doubleBondStroke} strokeLinecap="round" />

      {/* ---- Oxygen label above the double bond ---- */}
      <text
        x="28"
        y="14"
        fontSize={labelFontSize}
        fontWeight="500"
        fill={ink}
        textAnchor="middle"
        style={{ fontFamily: "var(--font-display), sans-serif" }}
      >
        O
      </text>

      {/* ---- Nitrogen at the bottom-middle vertex (x=52, y=56) ---- */}
      {/* Bonds terminate short of the N letter to leave a clean gap */}
      <line x1="46" y1="56" x2="48" y2="56" stroke="transparent" />
      <text
        x="52"
        y="60"
        fontSize={labelFontSize}
        fontWeight="500"
        fill={ink}
        textAnchor="middle"
        style={{ fontFamily: "var(--font-display), sans-serif" }}
      >
        N
      </text>

      {/* ---- N-H bond (short line down from N, then H label) ---- */}
      <line x1="52" y1="64" x2="52" y2="70" stroke={ink} strokeWidth={doubleBondStroke} strokeLinecap="round" />
      <text
        x="52"
        y="78"
        fontSize={labelFontSize}
        fontWeight="500"
        fill={ink}
        textAnchor="middle"
        style={{ fontFamily: "var(--font-display), sans-serif" }}
      >
        H
      </text>

      {/* ---- Clinical cyan checkmark accent — upper-right of the oxygen ---- */}
      <path
        d="M 42 14 L 46 18 L 56 6"
        stroke="#00A5B8"
        strokeWidth="2.6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Simplified bond-dot variant for sm/md/lg sizes.
 * At these sizes, atom labels become unreadable — so fall back to the
 * circle-and-line abstraction while preserving the C=O double-bond detail.
 */
function SimplifiedBondSVG({ height }: { height: number }) {
  const width = Math.round(height * 2.1);
  const lineStroke = height >= 30 ? 1.4 : height >= 24 ? 1.3 : 1.2;
  const bondStroke = height >= 24 ? 1.2 : 1.0;
  const ink = "var(--color-ink)";
  const paper = "var(--color-paper)";
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
      <line x1="5" y1="17" x2="51" y2="17" stroke={ink} strokeWidth={lineStroke} strokeLinecap="round" />
      <circle cx="5" cy="17" r="3.5" fill={ink} />
      <circle cx="28" cy="17" r="2.8" fill={ink} />
      <line x1="26.3" y1="14.2" x2="26.3" y2="6" stroke={ink} strokeWidth={bondStroke} strokeLinecap="round" />
      <line x1="29.7" y1="14.2" x2="29.7" y2="6" stroke={ink} strokeWidth={bondStroke} strokeLinecap="round" />
      <circle cx="28" cy="3.8" r="2" fill={paper} stroke={ink} strokeWidth={bondStroke} />
      <circle cx="51" cy="17" r="3.5" fill={paper} stroke={ink} strokeWidth={lineStroke} />
      <circle cx="51" cy="17" r="1.4" fill="#00A5B8" />
    </svg>
  );
}
