import { Check, X } from "lucide-react";
import type { CommissionLedgerRow } from "@/lib/supabase/types";
import { formatPrice, cn } from "@/lib/utils";

/**
 * CommissionLedgerTable — paginated history of commission events.
 *
 * Pure server component (Wave B2 §C-AFFDASH-2). Receives the rows the parent
 * already sliced. Empty state is a sales surface.
 *
 * Columns: Date · Kind · Amount · Order Ref
 *  - earned           → green check + "Earned"           → +$X.XX
 *  - clawback         → red X + "Clawback"               → −$X.XX
 *  - redemption_debit → "Redeemed for vial credit"       → −$X.XX
 *  - payout_debit     → "Paid out"                       → −$X.XX
 */

export interface CommissionLedgerTableProps {
  entries: CommissionLedgerRow[];
}

interface KindMeta {
  label: string;
  sign: "+" | "−";
  icon?: "check" | "x";
  iconClass?: string;
}

function metaFor(kind: CommissionLedgerRow["kind"]): KindMeta {
  switch (kind) {
    case "earned":
      return { label: "Earned", sign: "+", icon: "check", iconClass: "text-gold-dark" };
    case "clawback":
      return { label: "Clawback", sign: "−", icon: "x", iconClass: "text-wine-deep" };
    case "redemption_debit":
      return { label: "Redeemed for vial credit", sign: "−" };
    case "payout_debit":
      return { label: "Paid out", sign: "−" };
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function CommissionLedgerTable({ entries }: CommissionLedgerTableProps) {
  if (entries.length === 0) {
    return (
      <div
        className="border rule bg-paper-soft p-6 text-center"
        data-testid="commission-ledger-empty"
      >
        <p className="font-editorial text-base text-ink-soft">
          No commission yet — share your link to start earning.
        </p>
      </div>
    );
  }

  return (
    <div className="border rule bg-paper overflow-x-auto">
      <table className="w-full text-sm" data-testid="commission-ledger-table">
        <thead>
          <tr className="border-b rule text-left">
            <th className="px-4 py-3 font-display uppercase text-[11px] tracking-[0.14em] text-ink-soft">
              Date
            </th>
            <th className="px-4 py-3 font-display uppercase text-[11px] tracking-[0.14em] text-ink-soft">
              Kind
            </th>
            <th className="px-4 py-3 font-display uppercase text-[11px] tracking-[0.14em] text-ink-soft text-right">
              Amount
            </th>
            <th className="px-4 py-3 font-display uppercase text-[11px] tracking-[0.14em] text-ink-soft">
              Order Ref
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((row) => {
            const m = metaFor(row.kind);
            return (
              <tr
                key={row.id}
                className="border-b rule last:border-0"
                data-kind={row.kind}
              >
                <td className="px-4 py-3 text-ink-soft whitespace-nowrap">
                  {formatDate(row.created_at)}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 text-ink">
                    {m.icon === "check" && (
                      <Check
                        className={cn("w-3.5 h-3.5", m.iconClass)}
                        strokeWidth={2}
                        aria-hidden
                      />
                    )}
                    {m.icon === "x" && (
                      <X
                        className={cn("w-3.5 h-3.5", m.iconClass)}
                        strokeWidth={2}
                        aria-hidden
                      />
                    )}
                    {m.label}
                  </span>
                </td>
                <td
                  className={cn(
                    "px-4 py-3 font-mono text-right whitespace-nowrap",
                    row.kind === "earned" ? "text-gold-dark" : "text-ink"
                  )}
                >
                  {m.sign}
                  {formatPrice(Math.abs(row.amount_cents))}
                </td>
                <td className="px-4 py-3 text-ink-soft font-mono text-xs">
                  {row.source_order_id ? row.source_order_id.slice(0, 8) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default CommissionLedgerTable;
