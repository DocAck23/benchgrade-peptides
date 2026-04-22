import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "neutral" | "accent" | "warn" | "success";

interface BadgeProps {
  variant?: Variant;
  children: ReactNode;
  className?: string;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  neutral: "text-ink-muted border-rule",
  accent: "text-teal border-teal",
  warn: "text-[color:var(--color-warn)] border-[color:var(--color-warn)]",
  success: "text-[color:var(--color-success)] border-[color:var(--color-success)]",
};

export function Badge({ variant = "neutral", children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center h-5 px-2 label-eyebrow border bg-paper",
        VARIANT_CLASSES[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
