"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { markOrderFunded } from "@/app/actions/admin";
import { formatPrice, cn } from "@/lib/utils";

export interface ReconRow {
  order_id: string;
  memo: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  payment_method: string | null;
  amount_cents: number;
  age_days: number;
  created_at: string;
  status: string;
}

interface Props {
  rows: ReconRow[];
  mode: "awaiting" | "funded";
}

/**
 * Reconciliation table — searchable list of orders awaiting payment (or
 * already funded, awaiting shipment). Search matches across memo,
 * customer name/email/phone, and the dollar amount, so the operator
 * can paste any field from a bank statement and find the match.
 *
 * Aged rows are highlighted: yellow ≥ 3 days, red ≥ 7 days. The
 * "Mark funded" button calls the existing `markOrderFunded` server
 * action — same path taken by the order detail page.
 */
export function ReconciliationTable({ rows, mode }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [methodFilter, setMethodFilter] = useState<string>("");
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (methodFilter && r.payment_method !== methodFilter) return false;
      if (!q) return true;
      const dollars = (r.amount_cents / 100).toFixed(2);
      return (
        r.memo.toLowerCase().includes(q) ||
        r.customer_name.toLowerCase().includes(q) ||
        r.customer_email.toLowerCase().includes(q) ||
        (r.customer_phone?.toLowerCase().includes(q) ?? false) ||
        dollars.includes(q) ||
        r.amount_cents.toString().includes(q) ||
        r.order_id.toLowerCase().includes(q)
      );
    });
  }, [rows, query, methodFilter]);

  const onMarkFunded = (orderId: string) => {
    if (pending) return;
    setError(null);
    setBusyId(orderId);
    startTransition(async () => {
      const result = await markOrderFunded(orderId);
      setBusyId(null);
      if (!result.ok) {
        setError(result.error ?? "Failed to mark funded.");
        return;
      }
      router.refresh();
    });
  };

  const methods = Array.from(
    new Set(rows.map((r) => r.payment_method).filter((m): m is string => !!m))
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search memo, name, email, phone, $amount…"
          className="flex-1 min-w-[240px] h-10 px-3 border rule bg-paper text-sm focus:outline-none focus:border-ink"
          aria-label="Search reconciliation queue"
        />
        {methods.length > 1 && (
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="h-10 px-3 border rule bg-paper text-sm focus:outline-none focus:border-ink"
            aria-label="Filter by payment method"
          >
            <option value="">All methods</option>
            {methods.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && (
        <div className="border border-oxblood/40 bg-oxblood/5 text-oxblood px-4 py-3 text-sm mb-4">
          {error}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-ink-muted text-sm py-12 text-center">
          {rows.length === 0
            ? mode === "awaiting"
              ? "No orders awaiting payment. 🎉"
              : "Nothing in the funded queue right now."
            : "No matches."}
        </p>
      ) : (
        <div className="border rule bg-paper overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-paper-soft">
              <tr className="text-left">
                <Th>Memo</Th>
                <Th>Age</Th>
                <Th>Customer</Th>
                <Th>Method</Th>
                <Th>Amount</Th>
                <Th aria-label="Action" />
              </tr>
            </thead>
            <tbody className="divide-y rule">
              {filtered.map((r) => {
                const aged = r.age_days >= 7 ? "red" : r.age_days >= 3 ? "yellow" : null;
                return (
                  <tr
                    key={r.order_id}
                    className={cn(
                      "hover:bg-paper-soft",
                      aged === "red" && "bg-oxblood/5",
                      aged === "yellow" && "bg-warn/5"
                    )}
                  >
                    <Td>
                      <button
                        type="button"
                        className="font-mono-data text-sm text-ink hover:text-wine"
                        onClick={() => {
                          if (typeof navigator !== "undefined" && navigator.clipboard) {
                            void navigator.clipboard.writeText(r.memo);
                          }
                        }}
                        title="Click to copy"
                      >
                        {r.memo}
                      </button>
                    </Td>
                    <Td>
                      <span
                        className={cn(
                          "font-mono-data text-xs whitespace-nowrap",
                          aged === "red" && "text-oxblood font-bold",
                          aged === "yellow" && "text-warn",
                          !aged && "text-ink-muted"
                        )}
                      >
                        {r.age_days}d
                      </span>
                    </Td>
                    <Td>
                      <div className="text-ink">{r.customer_name}</div>
                      <div className="text-xs text-ink-muted">{r.customer_email}</div>
                      {r.customer_phone && (
                        <div className="text-xs text-ink-muted font-mono-data">{r.customer_phone}</div>
                      )}
                    </Td>
                    <Td>
                      <span className="inline-block px-2 py-0.5 text-[11px] font-mono-data uppercase bg-paper-soft border rule text-ink-muted">
                        {r.payment_method ?? "—"}
                      </span>
                    </Td>
                    <Td>
                      <span className="font-mono-data text-base text-ink">
                        {formatPrice(r.amount_cents)}
                      </span>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2 justify-end">
                        <Link
                          href={`/admin/orders/${r.order_id}`}
                          className="text-xs text-ink-muted hover:text-ink"
                        >
                          Open
                        </Link>
                        {mode === "awaiting" && (
                          <button
                            type="button"
                            disabled={pending && busyId === r.order_id}
                            onClick={() => onMarkFunded(r.order_id)}
                            className="text-xs h-8 px-3 bg-ink text-paper hover:bg-gold transition-colors disabled:opacity-60"
                          >
                            {busyId === r.order_id ? "Marking…" : "Mark funded"}
                          </button>
                        )}
                        {mode === "funded" && (
                          <Link
                            href={`/admin/orders/${r.order_id}`}
                            className="text-xs h-8 px-3 inline-flex items-center bg-ink text-paper hover:bg-gold transition-colors"
                          >
                            Ship →
                          </Link>
                        )}
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-ink-muted">
        Tip: aged ≥ 3 days highlights yellow, ≥ 7 days highlights red. Reach out
        to the customer (reply to their order confirmation) when an order ages
        past 5 days.
      </p>
    </div>
  );
}

function Th({ children, ...rest }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className="px-4 py-3 label-eyebrow text-ink-muted font-normal" {...rest}>
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-top">{children}</td>;
}
