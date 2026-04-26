"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { redeemCommissionForVialCredit } from "@/app/actions/affiliate";
import { redemptionRatio } from "@/lib/affiliate/tiers";
import type { AffiliateRow } from "@/lib/supabase/types";
import { formatPrice, cn } from "@/lib/utils";

/**
 * RedeemCommissionForm — converts available commission into vial credit at the
 * affiliate's tier ratio (Wave B2 §C-AFFDASH-3).
 *
 * Input: dollars (positive integer). Live preview multiplies by tier ratio.
 * Submit calls server action; success refreshes the dashboard.
 * Disabled when balance is zero.
 */

interface RedeemCommissionFormProps {
  affiliate: AffiliateRow;
}

const primaryBtn =
  "inline-flex items-center justify-center h-11 px-6 bg-wine text-paper font-display uppercase text-[12px] tracking-[0.14em] hover:bg-wine-deep transition-colors duration-200 ease-out disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold";

export function RedeemCommissionForm({ affiliate }: RedeemCommissionFormProps) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [, startTransition] = useTransition();

  const ratio = redemptionRatio(affiliate.tier);
  const balanceDollars = affiliate.available_balance_cents / 100;
  const isDisabled = affiliate.available_balance_cents === 0;

  const parsed = useMemo(() => {
    if (amount.trim() === "") return null;
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return null;
    return n;
  }, [amount]);

  const previewCredit = parsed !== null ? parsed * ratio : null;
  const overBalance =
    parsed !== null && parsed * 100 > affiliate.available_balance_cents;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (parsed === null) {
      setError("Enter a positive whole-dollar amount.");
      return;
    }
    if (overBalance) {
      setError("Amount exceeds your available balance.");
      return;
    }
    setPending(true);
    const res = await redeemCommissionForVialCredit({
      amount_cents: parsed * 100,
    });
    setPending(false);
    if (!res.ok) {
      setError(res.error ?? "Couldn't redeem — try again in a moment.");
      return;
    }
    setSuccess(
      `Redeemed ${formatPrice(parsed * 100)} → ${formatPrice(
        Math.round(parsed * 100 * ratio)
      )} in vial credit.`
    );
    setAmount("");
    startTransition(() => router.refresh());
  }

  return (
    <form
      onSubmit={onSubmit}
      className="border rule bg-paper p-5 space-y-4"
      data-testid="redeem-commission-form"
      aria-disabled={isDisabled}
    >
      <div>
        <h3 className="font-display uppercase text-[12px] tracking-[0.14em] text-ink mb-1">
          Redeem for vial credit
        </h3>
        <p className="text-xs text-ink-soft">
          Available balance:{" "}
          <span className="font-mono">
            {formatPrice(affiliate.available_balance_cents)}
          </span>
          {" · "}Your tier ratio: {ratio.toFixed(2)}×
        </p>
      </div>

      <div className="space-y-1">
        <label
          htmlFor="redeem-amount"
          className="block text-xs text-ink-soft uppercase tracking-[0.08em]"
        >
          Amount (USD)
        </label>
        <input
          id="redeem-amount"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={isDisabled || pending}
          placeholder={isDisabled ? "0" : `up to ${balanceDollars}`}
          className="w-full h-11 px-3 border rule bg-paper-soft text-ink font-mono focus-visible:outline-none focus-visible:border-gold focus-visible:ring-2 focus-visible:ring-gold transition-colors duration-200 ease-out disabled:opacity-60"
          aria-describedby="redeem-preview"
        />
      </div>

      <p
        id="redeem-preview"
        className={cn(
          "font-editorial text-sm",
          previewCredit !== null && !overBalance
            ? "text-gold-dark"
            : "text-ink-soft"
        )}
      >
        {previewCredit !== null
          ? `You'll receive ${formatPrice(
              Math.round(previewCredit * 100)
            )} in vial credit (at your tier ratio of ${ratio.toFixed(2)}×).`
          : "Enter a whole-dollar amount to preview your vial credit."}
      </p>

      <button
        type="submit"
        disabled={isDisabled || pending || parsed === null || overBalance}
        className={primaryBtn}
      >
        {pending ? "Redeeming…" : "Redeem"}
      </button>

      {error && (
        <p
          role="alert"
          className="text-sm text-wine-deep border rule bg-paper-soft p-3"
        >
          {error}
        </p>
      )}
      {success && (
        <p
          role="status"
          className="text-sm text-gold-dark border rule bg-paper-soft p-3"
        >
          {success}
        </p>
      )}
    </form>
  );
}

export default RedeemCommissionForm;
