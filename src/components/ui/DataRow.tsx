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
 * Visual pattern: hairline divider above, label on the left in eyebrow style,
 * value on the right in either sans or mono.
 */
export function DataRow({ label, value, mono = false, wrap = false, className }: DataRowProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-[140px_1fr] items-baseline gap-4 py-3 border-t rule",
        "first:border-t-0",
        className
      )}
    >
      <dt className="label-eyebrow text-ink-muted">{label}</dt>
      <dd
        className={cn(
          "text-sm text-ink",
          mono && "font-mono-data",
          wrap ? "break-words" : "truncate"
        )}
      >
        {value}
      </dd>
    </div>
  );
}
