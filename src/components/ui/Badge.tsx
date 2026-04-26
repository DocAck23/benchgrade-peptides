import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Locked brand badge variants (spec §16.1):
 *   - neutral / cream → paper bg, ink text, gold rule
 *   - accent  / gold  → gold bg, ink text
 *   - wine            → wine bg, paper text
 *   - success         → success bg, paper text
 *   - warn / danger   → danger bg, paper text
 *
 * Existing prop API (`neutral | accent | warn | success`) is preserved; the
 * additional `gold | wine | cream | danger` values are forward-compatible
 * aliases for surfaces that want to opt into the locked palette explicitly.
 */
type Variant = "neutral" | "accent" | "warn" | "success" | "gold" | "wine" | "cream" | "danger";

interface BadgeProps {
  variant?: Variant;
  children: ReactNode;
  className?: string;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  neutral: "bg-paper text-ink border border-rule",
  cream: "bg-paper text-ink border border-rule",
  accent: "bg-gold text-ink border border-gold",
  gold: "bg-gold text-ink border border-gold",
  wine: "bg-wine text-paper border border-wine-deep",
  success: "bg-[color:var(--color-success)] text-paper border border-[color:var(--color-success)]",
  warn: "bg-[color:var(--color-danger)] text-paper border border-[color:var(--color-danger)]",
  danger: "bg-[color:var(--color-danger)] text-paper border border-[color:var(--color-danger)]",
};

export function Badge({ variant = "neutral", children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center h-5 px-2 rounded-sm",
        "font-sans text-[11px] font-semibold uppercase tracking-[0.18em]",
        VARIANT_CLASSES[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
