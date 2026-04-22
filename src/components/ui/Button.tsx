import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-ink text-paper hover:bg-teal disabled:bg-ink-faint disabled:cursor-not-allowed",
  secondary:
    "border rule text-ink bg-paper hover:bg-paper-soft disabled:text-ink-faint disabled:cursor-not-allowed",
  ghost:
    "text-ink-soft hover:text-teal disabled:text-ink-faint disabled:cursor-not-allowed",
  destructive:
    "bg-oxblood text-paper hover:bg-oxblood-hover disabled:opacity-50 disabled:cursor-not-allowed",
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
          "inline-flex items-center justify-center font-medium transition-colors",
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
