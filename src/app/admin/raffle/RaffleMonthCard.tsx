"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  configureRaffleMonth,
  confirmRaffleDraw,
} from "@/app/actions/raffle";

interface RaffleMonthCardProps {
  month: string;
  prizeKind: "cash" | "vials_2";
  prizeAmountCents: number | null;
  entrySnapshotAt: string | null;
  drawnAt: string | null;
  confirmedAt: string | null;
  winnerUserId: string | null;
  totalEntries: number;
}

/**
 * One row per raffle month. Two action surfaces:
 *
 *   1. Configure (only while NOT confirmed): toggle prize kind +
 *      cash amount. Updates the raffle_months row.
 *   2. Confirm winner (only after drawn_at, before
 *      confirmed_by_admin_at): triggers the prize side-effects
 *      (cash_payouts insert or two vial_credits inserts).
 *
 * Both actions show inline error banners on failure and call
 * router.refresh() on success so the parent server component
 * re-renders the row's status.
 */
export function RaffleMonthCard({
  month,
  prizeKind,
  prizeAmountCents,
  entrySnapshotAt,
  drawnAt,
  confirmedAt,
  winnerUserId,
  totalEntries,
}: RaffleMonthCardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftKind, setDraftKind] = useState<"cash" | "vials_2">(prizeKind);
  const [draftAmount, setDraftAmount] = useState<string>(
    prizeAmountCents != null ? String(prizeAmountCents / 100) : "500",
  );

  const isConfirmed = Boolean(confirmedAt);
  const isSnapshotted = Boolean(entrySnapshotAt);
  const canConfigure = !isConfirmed && !isSnapshotted;
  const canConfirm = drawnAt && !isConfirmed && winnerUserId;

  const onSave = () => {
    setError(null);
    const cents =
      draftKind === "cash"
        ? Math.round(parseFloat(draftAmount || "0") * 100)
        : undefined;
    if (
      draftKind === "cash" &&
      (!Number.isFinite(cents) || (cents ?? 0) <= 0)
    ) {
      setError("Enter a positive cash amount in dollars.");
      return;
    }
    startTransition(async () => {
      const res = await configureRaffleMonth({
        month,
        prize_kind: draftKind,
        prize_amount_cents: draftKind === "cash" ? cents : undefined,
      });
      if (!res.ok) {
        setError(res.error ?? "Could not save.");
        return;
      }
      setEditing(false);
      router.refresh();
    });
  };

  const onConfirm = () => {
    if (!confirm(`Confirm the ${month} draw and issue the prize?`)) return;
    setError(null);
    startTransition(async () => {
      const res = await confirmRaffleDraw({ month });
      if (!res.ok) {
        setError(res.error ?? "Could not confirm.");
        return;
      }
      router.refresh();
    });
  };

  return (
    <section className="border rule bg-paper p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-3">
        <div>
          <div className="label-eyebrow text-ink-muted mb-1">
            {month}
          </div>
          <div className="font-display text-lg text-ink">
            {prizeKind === "cash"
              ? prizeAmountCents != null
                ? `$${(prizeAmountCents / 100).toFixed(2)} cash`
                : "Cash (amount unset)"
              : "2 vials of choice"}
          </div>
        </div>
        <div className="text-xs text-ink-muted text-right">
          <div>{totalEntries.toLocaleString()} entries</div>
          {isConfirmed && (
            <div className="mt-1 text-gold-dark">Confirmed</div>
          )}
        </div>
      </div>

      {error && (
        <div className="border-l-4 border-l-[color:var(--color-danger)] bg-paper-soft px-3 py-2 text-sm text-ink mb-3">
          {error}
        </div>
      )}

      {editing ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <label className="text-sm flex items-center gap-2">
              <input
                type="radio"
                name={`kind-${month}`}
                value="cash"
                checked={draftKind === "cash"}
                onChange={() => setDraftKind("cash")}
                disabled={pending}
              />
              Cash
            </label>
            <label className="text-sm flex items-center gap-2">
              <input
                type="radio"
                name={`kind-${month}`}
                value="vials_2"
                checked={draftKind === "vials_2"}
                onChange={() => setDraftKind("vials_2")}
                disabled={pending}
              />
              2 vials of choice
            </label>
          </div>
          {draftKind === "cash" && (
            <label className="text-sm flex items-center gap-2">
              <span className="label-eyebrow text-ink-muted text-[10px]">
                Amount ($)
              </span>
              <input
                type="number"
                min={0}
                max={10_000}
                step={1}
                value={draftAmount}
                onChange={(e) => setDraftAmount(e.target.value)}
                disabled={pending}
                className="h-9 px-3 border rule bg-paper text-sm w-32"
              />
            </label>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onSave}
              disabled={pending}
              className="text-xs h-9 px-4 bg-ink text-paper hover:bg-gold transition-colors disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
              disabled={pending}
              className="text-xs h-9 px-4 border rule bg-paper hover:bg-paper-soft text-ink transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {canConfigure && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs h-9 px-4 border rule bg-paper hover:bg-paper-soft text-ink transition-colors"
            >
              Configure prize
            </button>
          )}
          {canConfirm && (
            <button
              type="button"
              onClick={onConfirm}
              disabled={pending}
              className="text-xs h-9 px-4 bg-wine text-paper hover:bg-wine/90 transition-colors disabled:opacity-60"
            >
              {pending ? "Confirming…" : "Confirm winner"}
            </button>
          )}
        </div>
      )}

      <div className="mt-3 text-xs text-ink-muted space-y-1">
        <div>
          Snapshot:{" "}
          {entrySnapshotAt ? (
            <span className="text-ink">complete</span>
          ) : (
            <span>pending (cron fires last day of month)</span>
          )}
        </div>
        <div>
          Draw:{" "}
          {drawnAt ? (
            <span className="text-ink">
              {winnerUserId ? `winner ${winnerUserId.slice(0, 8)}…` : "no entries"}
            </span>
          ) : (
            <span>pending (cron fires 1st of next month)</span>
          )}
        </div>
      </div>
    </section>
  );
}
