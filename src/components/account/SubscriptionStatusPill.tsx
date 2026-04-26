import { cn } from "@/lib/utils";
import type { SubscriptionRow } from "@/lib/supabase/types";

/**
 * Status pill for customer-facing subscription surfaces.
 *
 * Variants per Wave C2 spec §16.4:
 *   - Active    → gold-on-paper-soft, gold-dark border
 *   - Paused    → ink-soft on paper-soft, gold-dark border
 *   - Cancelled → ink-muted on paper, neutral border
 *   - Completed → ink-muted on paper, neutral border
 *
 * Inter font, uppercase tracked 0.08em, 11px — matches OrderStatusPill chrome.
 */

type SubStatus = SubscriptionRow["status"];

interface PillVariant {
  label: string;
  className: string;
}

function variantFor(status: SubStatus): PillVariant {
  switch (status) {
    case "active":
      return {
        label: "Active",
        className: "bg-paper-soft text-gold-dark border border-gold-dark",
      };
    case "paused":
      return {
        label: "Paused",
        className: "bg-paper-soft text-ink-soft border border-gold-dark",
      };
    case "cancelled":
      return {
        label: "Cancelled",
        className: "bg-paper text-ink-muted border rule",
      };
    case "completed":
      return {
        label: "Completed",
        className: "bg-paper text-ink-muted border rule",
      };
  }
}

export interface SubscriptionStatusPillProps {
  status: SubStatus;
}

export function SubscriptionStatusPill({ status }: SubscriptionStatusPillProps) {
  const v = variantFor(status);
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-1 rounded-sm uppercase",
        "text-[11px] tracking-[0.08em] font-medium",
        v.className
      )}
      data-status={status}
    >
      {v.label}
    </span>
  );
}
