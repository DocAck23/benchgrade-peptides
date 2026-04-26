import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "destructive" | "gold";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

/**
 * Locked brand variants (spec §16.1):
 *   - primary    → wine surface, paper text, gold-light hover, wine-deep pressed
 *   - secondary  → cream surface, ink text, gold border on hover/focus
 *   - ghost      → transparent, ink-soft text, gold-dark hover
 *   - destructive→ danger surface, paper text (refund/cancel only)
 *   - gold       → gold surface, wine text, gold-dark pressed (high-emphasis CTAs)
 */
const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-wine text-paper border border-wine-deep hover:bg-gold-light hover:text-wine hover:border-gold-light active:bg-wine-deep disabled:bg-ink-muted disabled:border-ink-muted disabled:cursor-not-allowed",
  secondary:
    "bg-paper text-ink border border-rule hover:border-gold focus-visible:border-gold disabled:text-ink-muted disabled:cursor-not-allowed",
  ghost:
    "bg-transparent text-ink-soft border border-transparent hover:text-gold-dark disabled:text-ink-muted disabled:cursor-not-allowed",
  destructive:
    "bg-danger text-paper border border-danger hover:bg-wine-deep hover:border-wine-deep disabled:opacity-50 disabled:cursor-not-allowed",
  gold:
    "bg-gold text-wine border border-gold hover:bg-gold-light active:bg-gold-dark disabled:bg-ink-muted disabled:text-paper disabled:border-ink-muted disabled:cursor-not-allowed",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-9 px-4 text-xs tracking-[0.08em]",
  md: "h-11 px-6 text-sm tracking-[0.04em]",
  lg: "h-12 px-8 text-sm tracking-[0.04em]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center font-sans font-medium rounded-sm",
          "transition-[background-color,border-color,color] duration-300 ease-[var(--ease-default)]",
          VARIANT_CLASSES[variant],
          SIZE_CLASSES[size],
          className
        )}
        {...props}
      >
        {loading ? <span className="label-eyebrow">Working…</span> : children}
      </button>
    );
  }
);
Button.displayName = "Button";
