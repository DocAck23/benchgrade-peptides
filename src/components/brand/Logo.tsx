import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoProps {
  /** Size tier — "sm" for header, "md" for default, "lg" for hero or footer. */
  size?: "sm" | "md" | "lg";
  /** When true, renders as plain element (no link). Use in footer where the wrapper is the link. */
  asStatic?: boolean;
  className?: string;
}

/**
 * Bench Grade Peptides wordmark — Concept 5 variant.
 *
 * Composition: peptide-bond diagram mark on the left, ultra-wide letter-spaced
 * "BENCH GRADE / PEPTIDES" wordmark to the right, clinical cyan accent dot.
 *
 * Evokes the Sigma-Aldrich / Merck Index / Thermo Fisher catalog typography.
 */
export function Logo({ size = "md", asStatic = false, className }: LogoProps) {
  const wordmark = (
    <span className={cn("flex items-center gap-3", className)}>
      <PeptideBondMark size={size} />
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "font-sans font-medium text-ink",
            size === "sm" && "text-xs tracking-[0.24em]",
            size === "md" && "text-sm tracking-[0.26em]",
            size === "lg" && "text-base tracking-[0.28em]"
          )}
        >
          BENCH&nbsp;GRADE
        </span>
        <span
          className={cn(
            "font-sans font-normal text-ink-muted mt-1",
            size === "sm" && "text-[9px] tracking-[0.32em]",
            size === "md" && "text-[10px] tracking-[0.34em]",
            size === "lg" && "text-[11px] tracking-[0.36em]"
          )}
        >
          PEPTIDES
        </span>
      </span>
    </span>
  );

  if (asStatic) return wordmark;

  return (
    <Link href="/" aria-label="Bench Grade Peptides — home" className="inline-block">
      {wordmark}
    </Link>
  );
}

/**
 * Stylized peptide-bond diagram.
 *
 * Simplified structural depiction of two amino-acid residues joined by a peptide
 * bond (N-C(=O)). Abstracted to near-iconographic form: two circles and a short
 * connecting double-line motif with the characteristic =O.
 */
function PeptideBondMark({ size }: { size: "sm" | "md" | "lg" }) {
  const dims = size === "sm" ? 24 : size === "md" ? 28 : 32;
  return (
    <svg
      width={dims}
      height={dims}
      viewBox="0 0 40 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="shrink-0"
    >
      {/* Left residue — amino group (N) */}
      <circle cx="6" cy="14" r="3.5" stroke="var(--color-ink)" strokeWidth="1.2" />
      {/* Bond line (left → C) */}
      <line x1="9.5" y1="14" x2="16" y2="14" stroke="var(--color-ink)" strokeWidth="1.2" />
      {/* Central carbonyl carbon */}
      <circle cx="20" cy="14" r="2" fill="var(--color-ink)" />
      {/* Double-bond to oxygen (=O) — two short parallel lines going up */}
      <line x1="19" y1="10.5" x2="19" y2="7" stroke="var(--color-ink)" strokeWidth="1.2" />
      <line x1="21" y1="10.5" x2="21" y2="7" stroke="var(--color-ink)" strokeWidth="1.2" />
      {/* Oxygen (O) — small circle above */}
      <circle cx="20" cy="5" r="1.3" stroke="var(--color-ink)" strokeWidth="1.2" fill="var(--color-paper)" />
      {/* Peptide-bond connection to right residue */}
      <line x1="22" y1="14" x2="30.5" y2="14" stroke="var(--color-ink)" strokeWidth="1.2" />
      {/* Right residue — amine/alpha carbon */}
      <circle cx="34" cy="14" r="3.5" stroke="var(--color-ink)" strokeWidth="1.2" />
      {/* Accent dot — clinical cyan */}
      <circle cx="34" cy="14" r="1.2" fill="#00A5B8" />
    </svg>
  );
}
