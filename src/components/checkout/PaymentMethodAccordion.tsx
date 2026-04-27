"use client";

import { useId } from "react";
import Link from "next/link";
import { ChevronDown, AlertCircle, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type PaymentMethod,
  type PaymentMethodDetails,
  paymentMethodLabel,
} from "@/lib/payments/methods";

interface AccordionProps {
  availableMethods: PaymentMethod[];
  details: PaymentMethodDetails;
  selected: PaymentMethod | "";
  onSelect: (m: PaymentMethod) => void;
}

const RECOMMENDED: Record<PaymentMethod, string | null> = {
  wire: "Recommended for first-time buyers — fastest",
  ach: "Best for repeat buyers — free, after one-time setup",
  zelle: "Instant for orders under $500",
  crypto: "Auto-confirms on-chain — no admin reconciliation",
};

const HEADLINE_BLURB: Record<PaymentMethod, string> = {
  wire: "Same-day to 1 business day clear · ~$15–30 wire fee at your bank",
  ach: "Free · 1–3 business days clear · 1–2 day verification on first use",
  zelle: "Instant at most US banks · $500 per-transaction cap",
  crypto: "BTC, ETH, USDT, USDC, LTC · 10–60 minutes",
};

export function PaymentMethodAccordion({
  availableMethods,
  details,
  selected,
  onSelect,
}: AccordionProps) {
  const groupId = useId();
  // Codex P2 #12 — switched off `role="radiogroup"` + `role="radio"`.
  // We never implemented arrow-key roving focus; screen-reader users
  // expecting radio behavior would have been stranded. Standard
  // disclosure pattern (button with aria-expanded → labelled region)
  // is the right semantic for an accordion-of-payment-options. The
  // radio behavior is reconstructed through `aria-pressed` so AT users
  // still hear which option is currently selected.
  return (
    <div className="border rule bg-paper" role="group" aria-label="Payment method">
      {availableMethods.map((method, idx) => {
        const isOpen = selected === method;
        const panelId = `${groupId}-panel-${method}`;
        const triggerId = `${groupId}-trigger-${method}`;
        return (
          <div
            key={method}
            className={cn(
              "border-b rule last:border-b-0 transition-colors",
              isOpen && "bg-paper-soft"
            )}
          >
            {/* Header — clicking selects this method AND expands its panel.
                Keyboard: Enter / Space toggles via the native button. */}
            <button
              type="button"
              aria-pressed={isOpen}
              aria-expanded={isOpen}
              aria-controls={panelId}
              id={triggerId}
              onClick={() => onSelect(method)}
              className={cn(
                "w-full flex items-start gap-3 p-4 sm:p-5 text-left transition-colors",
                isOpen
                  ? "bg-paper-soft"
                  : "bg-paper hover:bg-paper-soft focus-visible:bg-paper-soft"
              )}
            >
              <span
                className={cn(
                  "mt-1 inline-flex items-center justify-center w-4 h-4 rounded-full border-2 shrink-0 transition-colors",
                  isOpen ? "border-ink bg-ink" : "border-ink-soft bg-paper"
                )}
                aria-hidden="true"
              >
                {isOpen && <span className="block w-1.5 h-1.5 rounded-full bg-paper" />}
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex items-baseline justify-between gap-2 flex-wrap">
                  <span className="font-display text-base sm:text-lg text-ink">
                    {paymentMethodLabel(method)}
                  </span>
                  {RECOMMENDED[method] && idx === 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.1em] font-display text-gold-dark bg-gold-light/30 px-2 py-0.5">
                      <Zap className="w-3 h-3" strokeWidth={2} />
                      {RECOMMENDED[method]}
                    </span>
                  )}
                </span>
                <span className="block text-xs text-ink-muted mt-1 leading-relaxed">
                  {HEADLINE_BLURB[method]}
                </span>
              </span>
              <ChevronDown
                aria-hidden="true"
                className={cn(
                  "w-5 h-5 text-ink-muted shrink-0 transition-transform duration-200",
                  isOpen && "rotate-180"
                )}
                strokeWidth={1.5}
              />
            </button>

            {/* Panel — `inert` removes it from tab order when collapsed so
                tabbing through the form skips closed panels. */}
            <div
              id={panelId}
              role="region"
              aria-labelledby={triggerId}
              inert={!isOpen}
              className={cn(
                "overflow-hidden transition-[max-height,opacity] duration-200 ease-out",
                isOpen ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0"
              )}
            >
              <div className="px-4 sm:px-5 pb-5 pt-1 text-sm text-ink leading-relaxed">
                {method === "wire" && details.wire && (
                  <WirePanel d={details.wire} />
                )}
                {method === "ach" && details.ach && (
                  <AchPanel d={details.ach} />
                )}
                {method === "zelle" && details.zelle && (
                  <ZellePanel d={details.zelle} />
                )}
                {method === "crypto" && details.crypto.enabled && (
                  <CryptoPanel />
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MemoCallout() {
  return (
    <div className="my-4 border-2 border-wine bg-paper p-3 sm:p-4 text-center">
      <div className="font-display text-[10px] tracking-[0.18em] uppercase text-wine font-bold mb-2">
        ⚑ Required on your payment
      </div>
      <p className="text-xs sm:text-sm text-ink-soft mb-1 leading-snug">
        Type your <strong>order memo</strong> (a code starting with{" "}
        <span className="font-mono-data text-wine">BGP-</span>) into the{" "}
        <strong>memo / note</strong> field of the transfer. We email the exact memo
        the moment you submit this order.
      </p>
      <p className="text-[11px] text-ink-muted italic mt-2 leading-snug">
        We don&rsquo;t use a card processor — the memo is the only way we link a
        payment to your order. Skip it and your order sits until we email to confirm.
      </p>
    </div>
  );
}

function DetailRow({ label, value, mono = true, copy = false }: { label: string; value: string; mono?: boolean; copy?: boolean }) {
  return (
    <div className="grid grid-cols-[110px_1fr] sm:grid-cols-[140px_1fr] items-baseline gap-3 py-2 border-b border-rule/60 last:border-b-0">
      <dt className="label-eyebrow text-[10px] sm:text-xs">{label}</dt>
      <dd className={cn("text-ink min-w-0 break-words", mono ? "font-mono-data text-xs sm:text-sm" : "text-sm")}>
        {value}
        {copy && <CopyButton value={value} />}
      </dd>
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof navigator !== "undefined" && navigator.clipboard) {
          void navigator.clipboard.writeText(value);
        }
      }}
      className="ml-2 text-[10px] uppercase tracking-[0.08em] text-gold-dark hover:text-wine"
      aria-label={`Copy ${value}`}
    >
      copy
    </button>
  );
}

function WirePanel({ d }: { d: NonNullable<PaymentMethodDetails["wire"]> }) {
  return (
    <div>
      <p className="text-sm text-ink-soft mb-3">
        Domestic wire transfer. We ship within 1–2 business days of funds clearing.
        Your bank typically charges $15–30 to send.
      </p>
      <dl className="bg-paper border rule px-4 py-1">
        <DetailRow label="Beneficiary" value={d.beneficiary} mono={false} />
        {d.beneficiaryAddress && <DetailRow label="Address" value={d.beneficiaryAddress} mono={false} />}
        <DetailRow label="Bank" value={d.bank} mono={false} />
        {d.bankAddress && <DetailRow label="Bank address" value={d.bankAddress} mono={false} />}
        <DetailRow label="Routing / ABA" value={d.routing} copy />
        <DetailRow label="Account" value={d.account} copy />
        <DetailRow label="Account type" value={d.accountType} mono={false} />
      </dl>
      <MemoCallout />
    </div>
  );
}

function AchPanel({ d }: { d: NonNullable<PaymentMethodDetails["ach"]> }) {
  return (
    <div>
      <p className="text-sm text-ink-soft mb-3">
        Free, customer-initiated ACH transfer from your bank&rsquo;s bill-pay or
        external-transfer flow.{" "}
        <Link href={d.instructionsUrl} className="text-gold-dark underline-offset-2 hover:underline">
          Step-by-step instructions →
        </Link>
      </p>
      <div className="border-l-4 border-warn/60 bg-warn/5 px-4 py-3 mb-4 text-xs text-ink leading-relaxed flex gap-2">
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-warn" strokeWidth={2} />
        <span>
          <strong className="font-display text-ink">First-time use takes 1–2 days.</strong>{" "}
          Most banks require a small micro-deposit verification when adding a new
          recipient. If you need this order to ship within 24 hours, choose{" "}
          <strong>Wire</strong> instead.
        </span>
      </div>
      <dl className="bg-paper border rule px-4 py-1">
        <DetailRow label="Beneficiary" value={d.beneficiary} mono={false} />
        <DetailRow label="Bank" value={d.bank} mono={false} />
        <DetailRow label="Routing" value={d.routing} copy />
        <DetailRow label="Account" value={d.account} copy />
        <DetailRow label="Account type" value={d.accountType} mono={false} />
      </dl>
      <MemoCallout />
    </div>
  );
}

function ZellePanel({ d }: { d: NonNullable<PaymentMethodDetails["zelle"]> }) {
  return (
    <div>
      <p className="text-sm text-ink-soft mb-3">
        Send instantly via Zelle from your bank&rsquo;s mobile app. Most major US
        banks settle in seconds.
      </p>
      <div className="border-l-4 border-warn/60 bg-warn/5 px-4 py-3 mb-4 text-xs text-ink leading-relaxed flex gap-2">
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-warn" strokeWidth={2} />
        <span>
          <strong className="font-display text-ink">$500 per-transaction cap</strong>{" "}
          at most banks. If your order is over $500, choose Wire or ACH so it goes
          through in one transfer.
        </span>
      </div>
      <dl className="bg-paper border rule px-4 py-1">
        <DetailRow label="Name" value={d.name} mono={false} />
        <DetailRow label="Zelle ID" value={d.handle} copy />
      </dl>
      <MemoCallout />
    </div>
  );
}

function CryptoPanel() {
  return (
    <div>
      <p className="text-sm text-ink-soft mb-3">
        Pay in BTC, ETH, USDT, USDC, LTC, or any of 40+ supported tokens. Funds are
        auto-converted to USDC on receipt. <strong className="font-display text-ink">No memo
        required</strong> — the hosted payment link encodes your order ID, so reconciliation
        is automatic.
      </p>
      <div className="bg-paper border rule p-4 text-sm text-ink-soft leading-relaxed">
        <p className="mb-2">
          <strong className="font-display text-ink">What happens after you submit:</strong>
        </p>
        <ol className="list-decimal pl-5 space-y-1 text-ink">
          <li>
            We email a <strong>hosted payment link</strong> from{" "}
            <span className="font-mono-data">nowpayments.io</span>
          </li>
          <li>You pick a token, send to the deposit address shown</li>
          <li>The transaction is auto-confirmed (10–60 min depending on network)</li>
          <li>Your order flips to paid; we ship within 1 business day</li>
        </ol>
      </div>
    </div>
  );
}
