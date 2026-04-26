import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DataRowProps {
  label: string;
  value: ReactNode;
  /** When true, the value uses the monospace/tabular-numerals style (for CAS, MW, sequences, prices) */
  mono?: boolean;
  /** When true, value wraps — useful for long sequences */
  wrap?: boolean;
  className?: string;
}

/**
 * Horizontal key-value row for molecular data panels.
 *
 * Locked brand styling (spec §16.1):
 *   - hairline divider above (gold-tinted rule)
 *   - label in eyebrow style (Inter, gold-dark per .label-eyebrow)
 *   - value defaults to ink/Inter; `mono` switches to JetBrains Mono for
 *     numerics, lot IDs, sequences, prices
 *   - paper-soft alternating row stripe via :nth-child(even) — applied with
 *     Tailwind's even: variant so consumers can stack <DataRow/> rows inside
 *     a <dl> and get auto-striping for free
 */
export function DataRow({ label, value, mono = false, wrap = false, className }: DataRowProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-[140px_1fr] items-baseline gap-4 py-3 px-3",
        "border-t border-rule first:border-t-0",
        "even:bg-paper-soft",
        className
      )}
    >
      <dt className="label-eyebrow">{label}</dt>
      <dd
        className={cn(
          "text-sm text-ink",
          mono ? "font-mono-data" : "font-sans",
          wrap ? "break-words" : "truncate"
        )}
      >
        {value}
      </dd>
    </div>
  );
}
