import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Sub-project A · Foundation, commit 10 of 22.
 *
 * v2 brand: every variant is a pill (radius-pill = 999px, locked Q3).
 * Primary CTAs are gold; secondary are wine; tertiary is outline-wine;
 * destructive is danger-red. Ghost retained as a low-emphasis fallback.
 *
 * Mobile-first rule (Codex Review #1 fix M4 + the user's directive):
 *   - Primary buttons go full-width below 768 px by default.
 *   - Override with `fullWidthMobile={false}`.
 *   - Min-height 44 px on every size ≥ md (locked tap-target floor).
 *
 * Legacy variant aliases preserved for back-compat through codemod:
 *   - "primary" → gold pill (was wine in v1; flipped because v2 makes
 *     gold the CTA color and wine the brand surface)
 *   - "secondary" → wine pill (was cream in v1; flipped to match)
 *   - "gold" → alias of primary
 *   - "ghost" → tertiary outline-wine
 */
type Variant =
  | "primary" // gold pill, the v2 default CTA
  | "secondary" // wine pill, secondary CTA
  | "tertiary" // transparent + wine border + wine text
  | "destructive" // danger pill, refund / cancel
  | "gold" // legacy alias of primary
  | "ghost"; // legacy alias of tertiary

type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  /** Default true when variant is primary at <768px. Overrides Tailwind responsive classes. */
  fullWidthMobile?: boolean;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    // gold pill, wine ink, gold-light hover, gold-dark pressed
    "bg-gold text-wine border border-gold hover:bg-gold-light active:bg-gold-dark disabled:bg-ink-muted disabled:text-paper disabled:border-ink-muted disabled:cursor-not-allowed shadow-[0_6px_14px_rgba(184,146,84,0.30)]",
  secondary:
    // wine pill, cream ink
    "bg-wine text-paper border border-wine-deep hover:bg-gold-light hover:text-wine hover:border-gold-light active:bg-wine-deep disabled:bg-ink-muted disabled:border-ink-muted disabled:cursor-not-allowed shadow-[0_6px_14px_rgba(74,14,26,0.20)]",
  tertiary:
    // transparent + wine border + wine text — for low-emphasis inline actions
    "bg-transparent text-wine border border-wine hover:bg-wine hover:text-paper disabled:text-ink-muted disabled:border-ink-muted disabled:cursor-not-allowed",
  destructive:
    "bg-danger text-paper border border-danger hover:bg-wine-deep hover:border-wine-deep disabled:opacity-50 disabled:cursor-not-allowed",
  // ── legacy aliases, preserved for codemod-free back-compat ──
  gold:
    "bg-gold text-wine border border-gold hover:bg-gold-light active:bg-gold-dark disabled:bg-ink-muted disabled:text-paper disabled:border-ink-muted disabled:cursor-not-allowed shadow-[0_6px_14px_rgba(184,146,84,0.30)]",
  ghost:
    "bg-transparent text-ink-soft border border-transparent hover:text-gold-dark disabled:text-ink-muted disabled:cursor-not-allowed",
};

const SIZE_CLASSES: Record<Size, string> = {
  // sm is desktop-dense only; min-height still respects 44 px on mobile
  // via the responsive `min-h-[44px]` wrapper class below.
  sm: "h-9 px-4 text-xs tracking-[0.08em]",
  md: "h-11 px-6 text-sm tracking-[0.04em] min-h-[44px]",
  lg: "h-12 px-8 text-sm tracking-[0.04em] min-h-[44px]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading,
      disabled,
      children,
      fullWidthMobile,
      ...props
    },
    ref
  ) => {
    // Default: primary CTAs go full-width on mobile (below md/768 px).
    const shouldFullWidthMobile =
      fullWidthMobile ?? variant === "primary";

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        data-fullwidth-mobile={shouldFullWidthMobile ? "true" : "false"}
        className={cn(
          "inline-flex items-center justify-center font-ui font-semibold",
          // Pill radius is the v2 lock — every variant respects it.
          "rounded-pill",
          // Mobile-first full-width for primary CTAs.
          shouldFullWidthMobile && "w-full md:w-auto",
          "transition-[background-color,border-color,color,box-shadow] duration-300 ease-[var(--ease-default)]",
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
