import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CardProps {
  children: ReactNode;
  className?: string;
  /** When true, removes internal padding — use for custom-layout cards like product photos that fill the card. */
  flush?: boolean;
}

/**
 * Card surface (spec §16.1):
 *   - paper-soft cream background
 *   - 1px gold-tinted hairline rule (`--color-rule`)
 *   - 4px (`--radius-md`) corners
 * On wine surfaces (`[data-surface="wine"]` ancestor) the rule colour
 * automatically flips via the `[data-surface="wine"]` rules in globals.css —
 * consumers who need an explicit wine card can override with `border-rule-wine`.
 */
export function Card({ children, className, flush = false }: CardProps) {
  return (
    <div
      className={cn(
        "bg-paper-soft border border-rule rounded-md",
        !flush && "p-6",
        className
      )}
    >
      {children}
    </div>
  );
}
