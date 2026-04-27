"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { changeOrderPaymentMethod } from "@/app/actions/account";
import { paymentMethodLabel, type PaymentMethod, type PaymentMethodDetails } from "@/lib/payments/methods";
import { formatPrice, cn } from "@/lib/utils";

interface Props {
  orderId: string;
  memo: string;
  amountCents: number;
  currentMethod: PaymentMethod | null;
  availableMethods: readonly PaymentMethod[];
  details: PaymentMethodDetails;
  invoiceUrl: string | null;
}

/**
 * Customer-facing pay-now panel. Renders only on awaiting-payment orders.
 *
 * Shows the memo as a wine-bordered block, the bank/ACH/Zelle details
 * for the current method (or the NOWPayments hosted link for crypto),
 * and a "Change method" affordance that toggles a small picker. On
 * select, calls the changeOrderPaymentMethod server action; for crypto
 * the action also creates a NOWPayments invoice and emails the link.
 */
export function PendingPaymentPanel({
  orderId,
  memo,
  amountCents,
  currentMethod,
  availableMethods,
  details,
  invoiceUrl,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);

  const onSelect = (m: PaymentMethod) => {
    if (m === currentMethod) {
      setChanging(false);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await changeOrderPaymentMethod(orderId, m);
      if (!res.ok) {
        setError(res.error ?? "Failed to change method.");
        return;
      }
      setChanging(false);
      router.refresh();
    });
  };

  return (
    <section className="border-2 border-wine bg-paper-soft p-5 sm:p-7 space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <div className="label-eyebrow text-wine font-bold mb-1">Pay your order</div>
          <h2 className="font-display text-2xl text-ink leading-tight">
            Awaiting payment — {formatPrice(amountCents)} due
          </h2>
        </div>
        <div className="text-xs text-ink-muted">
          Order BGP-{orderId.slice(0, 8).toUpperCase()}
        </div>
      </div>

      {/* Memo block — wine-bordered, oversized */}
      {currentMethod !== "crypto" && (
        <div className="border-2 border-wine bg-paper p-4 sm:p-5 text-center">
          <div className="label-eyebrow text-wine font-bold mb-2 text-[10px]">
            ⚑ Required on your payment
          </div>
          <div className="font-mono-data text-2xl sm:text-3xl text-wine font-bold tracking-[0.15em] my-2">
            {memo}
          </div>
          <p className="text-xs sm:text-sm text-ink-soft max-w-md mx-auto leading-snug">
            Type this code into the <strong>memo / note / reference</strong> field
            when you send your payment. It&rsquo;s the only way we can match your
            transfer to your order.
          </p>
        </div>
      )}

      {/* Method selector */}
      <div className="border rule bg-paper">
        <div className="px-4 py-3 border-b rule flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-ink-muted">Current method</div>
            <div className="font-display text-base text-ink">
              {currentMethod ? paymentMethodLabel(currentMethod) : "— not chosen —"}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setChanging((v) => !v)}
            className="text-xs h-9 px-4 border rule bg-paper hover:bg-paper-soft text-ink transition-colors"
          >
            {changing ? "Cancel" : "Change method"}
          </button>
        </div>

        {changing && (
          <ul className="divide-y rule">
            {availableMethods.map((m) => (
              <li key={m}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onSelect(m)}
                  className={cn(
                    "w-full text-left px-4 py-3 hover:bg-paper-soft transition-colors flex items-center justify-between gap-3",
                    pending && "opacity-60",
                    m === currentMethod && "bg-paper-soft",
                  )}
                >
                  <div>
                    <div className="font-display text-sm text-ink">{paymentMethodLabel(m)}</div>
                    <div className="text-[11px] text-ink-muted">{HEADLINE[m]}</div>
                  </div>
                  {m === currentMethod ? (
                    <span className="text-[10px] uppercase tracking-[0.12em] text-gold-dark">
                      Current
                    </span>
                  ) : (
                    <span className="text-[10px] uppercase tracking-[0.12em] text-ink-muted">
                      {pending ? "Switching…" : "Choose"}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        {error && (
          <div className="px-4 py-3 border-t border-oxblood/40 bg-oxblood/5 text-oxblood text-xs">
            {error}
          </div>
        )}

        {/* Method-specific instruction body */}
        {!changing && currentMethod && (
          <div className="px-4 py-5 sm:px-6 sm:py-6">
            {currentMethod === "wire" && details.wire && (
              <BankRows
                rows={[
                  ["Beneficiary", details.wire.beneficiary],
                  ...(details.wire.beneficiaryAddress ? [["Address", details.wire.beneficiaryAddress]] : []),
                  ["Bank", details.wire.bank],
                  ...(details.wire.bankAddress ? [["Bank address", details.wire.bankAddress]] : []),
                  ["Routing / ABA", details.wire.routing],
                  ["Account", details.wire.account],
                  ["Account type", details.wire.accountType],
                ] as Array<[string, string]>}
                footer="Send the wire exactly as listed and include the memo. We ship within 1–2 business days of funds clearing."
              />
            )}
            {currentMethod === "ach" && details.ach && (
              <BankRows
                rows={[
                  ["Beneficiary", details.ach.beneficiary],
                  ["Bank", details.ach.bank],
                  ["Routing", details.ach.routing],
                  ["Account", details.ach.account],
                  ["Account type", details.ach.accountType],
                ]}
                footer={
                  <>
                    Customer-initiated ACH credit — push from your bank&rsquo;s bill-pay or external-transfer flow.{" "}
                    <Link href="/payments/ach" className="text-gold-dark underline">
                      Step-by-step instructions →
                    </Link>
                  </>
                }
              />
            )}
            {currentMethod === "zelle" && details.zelle && (
              <BankRows
                rows={[
                  ["Name", details.zelle.name],
                  ["Zelle handle", details.zelle.handle],
                ]}
                footer="Send from your bank's Zelle app. $500 per-transaction cap on most banks."
              />
            )}
            {currentMethod === "crypto" && (
              <CryptoBlock invoiceUrl={invoiceUrl} />
            )}
          </div>
        )}
      </div>
    </section>
  );
}

const HEADLINE: Record<PaymentMethod, string> = {
  wire: "Same-day clear · ~$15–30 wire fee",
  ach: "Free · 1–3 business days clear",
  zelle: "Instant · $500 per-transaction cap",
  crypto: "Auto-confirms on-chain · 10–60 minutes",
};

function BankRows({
  rows,
  footer,
}: {
  rows: Array<[string, string]>;
  footer?: React.ReactNode;
}) {
  return (
    <div>
      <dl>
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="grid grid-cols-[120px_1fr] sm:grid-cols-[160px_1fr] items-baseline gap-3 py-2 border-b border-rule/60 last:border-b-0"
          >
            <dt className="label-eyebrow text-[10px] sm:text-xs">{label}</dt>
            <dd className="font-mono-data text-sm text-ink min-w-0 break-words">{value}</dd>
          </div>
        ))}
      </dl>
      {footer && (
        <p className="mt-4 text-xs text-ink-soft leading-relaxed italic">{footer}</p>
      )}
    </div>
  );
}

function CryptoBlock({ invoiceUrl }: { invoiceUrl: string | null }) {
  if (!invoiceUrl) {
    return (
      <p className="text-sm text-ink-soft leading-relaxed">
        We&rsquo;re generating your hosted NOWPayments link. Refresh in a few
        moments — if it doesn&rsquo;t appear, click <strong>Change method</strong> above and
        re-select Crypto to retry, or email{" "}
        <a href="mailto:admin@benchgradepeptides.com" className="text-gold-dark underline">
          admin@benchgradepeptides.com
        </a>.
      </p>
    );
  }
  return (
    <div className="text-center">
      <p className="text-sm text-ink-soft mb-4 leading-relaxed">
        One-click hosted payment page — pick your token (BTC, ETH, USDT, USDC, LTC,
        or 40+ more), send to the deposit address shown, and we auto-confirm on-chain.
      </p>
      <a
        href={invoiceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center h-12 px-8 bg-wine text-paper text-sm font-display uppercase tracking-[0.12em] hover:bg-ink transition-colors"
      >
        Open hosted payment page →
      </a>
      <p className="mt-3 text-[11px] text-ink-muted break-all">{invoiceUrl}</p>
    </div>
  );
}
