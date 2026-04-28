import type { OrderStatus } from "@/lib/orders/status";
import { cn } from "@/lib/utils";

/**
 * Order timeline — full lifecycle always visible (no "click to expand"
 * friction per spec §16.4). Reached states render with a gold dot and
 * ink text; pending states render muted.
 *
 * The component is intentionally pure: parents derive event timestamps
 * from the order row (created_at, funded_at-equivalent, shipped_at,
 * delivered_at) and pass them in.
 */

const STATUS_LABELS: Record<OrderStatus, string> = {
  awaiting_payment: "Order placed",
  awaiting_wire: "Order placed",
  funded: "Payment received",
  shipped: "Shipped",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export interface OrderTimelineEvent {
  status: OrderStatus;
  /** ISO timestamp when this state was reached, or null if pending. */
  at: string | null;
  /** Optional override for the row label. */
  label?: string;
}

export interface OrderTimelineProps {
  events: OrderTimelineEvent[];
  /**
   * "horizontal" renders dots on a single horizontal track with labels
   * stacked underneath — for the order detail header where we want the
   * status read at a glance. "vertical" (default) keeps the long-form
   * stacked layout used elsewhere.
   */
  orientation?: "vertical" | "horizontal";
}

const formatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "long",
  timeStyle: "short",
});

const shortFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

function formatAt(iso: string): string {
  // Render e.g. "April 25, 2026 at 4:18 PM" → swap separator to · for editorial feel.
  return formatter.format(new Date(iso)).replace(" at ", " · ");
}

function formatAtShort(iso: string): string {
  return shortFormatter.format(new Date(iso));
}

export function OrderTimeline({
  events,
  orientation = "vertical",
}: OrderTimelineProps) {
  if (orientation === "horizontal") {
    return (
      <ol
        className="grid grid-flow-col auto-cols-fr items-start gap-2"
        aria-label="Order timeline"
      >
        {events.map((evt, i) => {
          const reached = Boolean(evt.at);
          const isLast = i === events.length - 1;
          const nextReached = !isLast && Boolean(events[i + 1]?.at);
          const label = evt.label ?? STATUS_LABELS[evt.status];
          return (
            <li
              key={`${evt.status}-${i}`}
              className="relative flex flex-col items-center text-center"
            >
              {/* Connector line to the next dot — colored gold up to
                  the last reached state, then muted. Sits behind the
                  dot via z-index. */}
              {!isLast && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-1.5 left-1/2 right-[-50%] h-px",
                    reached && nextReached ? "bg-gold" : "bg-rule",
                  )}
                />
              )}
              <span
                aria-hidden="true"
                className={cn(
                  "relative z-10 h-3 w-3 rounded-full border-2 shrink-0",
                  reached
                    ? "bg-gold border-gold"
                    : "bg-paper border-rule",
                )}
              />
              <div
                className={cn(
                  "mt-2 font-display uppercase text-[10px] tracking-[0.14em] leading-tight",
                  reached ? "text-ink" : "text-ink-muted",
                )}
              >
                {label}
              </div>
              <div
                className={cn(
                  "mt-0.5 font-mono-data text-[10px] leading-tight",
                  reached ? "text-ink-soft" : "text-ink-muted",
                )}
              >
                {evt.at ? formatAtShort(evt.at) : "—"}
              </div>
            </li>
          );
        })}
      </ol>
    );
  }
  return (
    <ol className="space-y-5" aria-label="Order timeline">
      {events.map((evt, i) => {
        const reached = Boolean(evt.at);
        const label = evt.label ?? STATUS_LABELS[evt.status];
        return (
          <li key={`${evt.status}-${i}`} className="flex items-start gap-4">
            <span
              aria-hidden="true"
              className={cn(
                "mt-1.5 h-2 w-2 rounded-full shrink-0",
                reached ? "bg-gold" : "bg-rule"
              )}
            />
            <div className="min-w-0">
              <div
                className={cn(
                  "font-display uppercase text-[11px] tracking-[0.18em]",
                  reached ? "text-ink" : "text-ink-muted"
                )}
              >
                {label}
              </div>
              <div
                className={cn(
                  "font-editorial text-sm mt-0.5",
                  reached ? "text-ink-soft" : "text-ink-muted"
                )}
                style={{ fontFamily: "var(--font-editorial)" }}
              >
                {evt.at ? formatAt(evt.at) : "Pending"}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
