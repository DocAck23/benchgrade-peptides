import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/utils";
import { isPaymentMethod, paymentMethodLabel, getPaymentMethodDetails, type PaymentMethod } from "@/lib/payments/methods";
import { verifySuccessToken } from "@/lib/orders/success-token";

export const metadata: Metadata = {
  title: "Order received",
  description: "Your order has been received.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ id?: string; t?: string }>;
}

interface OrderRow {
  order_id: string;
  customer: { name: string; email: string };
  items: Array<{ name: string; size_mg: number; pack_size: number; quantity: number; sku: string }>;
  subtotal_cents: number;
  total_cents: number | null;
  payment_method: string | null;
  status: string;
  nowpayments_invoice_url: string | null;
}

function memoFor(orderId: string): string {
  return `BGP-${orderId.slice(0, 8).toUpperCase()}`;
}

export default async function CheckoutSuccessPage({ searchParams }: PageProps) {
  const { id, t } = await searchParams;
  if (!id) redirect("/catalogue");

  // Privacy gate: only fetch the row if the caller has the HMAC token
  // we issued at submitOrder. Without it we still render the memo +
  // generic instructions, but never the customer name / items / totals.
  // Anyone who guesses or scrapes a UUID without the token gets the
  // minimal view, not a privacy leak.
  const tokenValid = id && t ? verifySuccessToken(id, t) : false;

  const supa = getSupabaseServer();
  let row: OrderRow | null = null;
  if (tokenValid && supa) {
    const { data } = await supa
      .from("orders")
      .select(
        "order_id, customer, items, subtotal_cents, total_cents, payment_method, status, nowpayments_invoice_url",
      )
      .eq("order_id", id)
      .maybeSingle();
    if (data && typeof data === "object") {
      row = data as unknown as OrderRow;
    }
  }

  // Defensive: if the row didn't load (DB hiccup, dev w/o supabase), still
  // render a minimal confirmation so the customer isn't stranded — they
  // already got the email, this is just the post-submit page.
  const memo = memoFor(id);
  const method: PaymentMethod | null =
    row?.payment_method && isPaymentMethod(row.payment_method) ? row.payment_method : null;
  const total = row?.total_cents ?? row?.subtotal_cents ?? null;
  const details = getPaymentMethodDetails();

  return (
    <article className="max-w-3xl mx-auto px-6 lg:px-10 py-14 lg:py-20">
      <div className="label-eyebrow text-gold-dark mb-4">Order received</div>
      <h1 className="font-display text-4xl lg:text-5xl leading-tight text-ink mb-3">
        Thank you{row?.customer.name ? `, ${row.customer.name.split(" ")[0]}` : ""}.
      </h1>
      <p className="text-base text-ink-soft mb-8 max-w-prose">
        We&rsquo;ve recorded your order with your RUO certification.
        {method
          ? ` Below is what you need to do to complete payment via ${paymentMethodLabel(method)}.`
          : " A confirmation email is on its way."}
      </p>

      {/* MEMO — the single most important piece of info. Wine-bordered,
          oversized, copy-able. Repeated in the confirmation email. */}
      <div className="border-2 border-wine bg-paper p-5 sm:p-6 text-center mb-8">
        <div className="label-eyebrow text-wine font-bold mb-2 text-[10px]">
          ⚑ Required on your payment
        </div>
        <div className="font-mono-data text-2xl sm:text-4xl text-wine font-bold tracking-[0.15em] my-3">
          {memo}
        </div>
        <p className="text-xs sm:text-sm text-ink-soft max-w-md mx-auto leading-snug">
          {method === "crypto" ? (
            <>The hosted payment link encodes your order ID, so no memo is needed for crypto.</>
          ) : (
            <>
              Type this code into the <strong>memo / note / reference</strong> field
              when you send your payment. It&rsquo;s the only way we can match your
              transfer to your order — we don&rsquo;t use a card processor.
            </>
          )}
        </p>
      </div>

      {/* PAYMENT INSTRUCTIONS — method-specific */}
      {method && method !== "crypto" && (
        <PaymentInstructions method={method} memo={memo} details={details} amount={total} />
      )}
      {method === "crypto" && (
        <div className="border rule bg-paper-soft p-5 sm:p-6 mb-8">
          <div className="label-eyebrow text-ink-muted mb-3">Crypto payment — pay now</div>
          {row?.nowpayments_invoice_url ? (
            <>
              <p className="text-sm text-ink-soft mb-4 leading-relaxed">
                One-click hosted payment page — pick BTC, ETH, USDT, USDC, LTC, or
                any of 40+ supported tokens. We auto-confirm on-chain (10–60 minutes
                depending on network) and your order ships within 1 business day.
              </p>
              <a
                href={row.nowpayments_invoice_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center h-12 px-8 bg-wine text-paper text-sm font-display uppercase tracking-[0.12em] hover:bg-ink transition-colors"
              >
                Open hosted payment page →
              </a>
              <p className="mt-3 text-[11px] text-ink-muted break-all">
                {row.nowpayments_invoice_url}
              </p>
            </>
          ) : (
            <p className="text-sm text-ink-soft leading-relaxed">
              We&rsquo;re generating your hosted NOWPayments link. It will arrive by
              email within a few minutes — or refresh this page to retrieve it as
              soon as it&rsquo;s ready.
            </p>
          )}
        </div>
      )}

      {/* ORDER SUMMARY */}
      {row && (
        <div className="border rule bg-paper p-5 sm:p-6 mb-8">
          <div className="label-eyebrow text-ink-muted mb-4">Order summary</div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm mb-4">
            <dt className="text-ink-muted">Order id</dt>
            <dd className="font-mono-data text-ink break-all">{row.order_id}</dd>
            <dt className="text-ink-muted">Email</dt>
            <dd className="text-ink break-all">{row.customer.email}</dd>
            <dt className="text-ink-muted">Method</dt>
            <dd className="text-ink">{method ? paymentMethodLabel(method) : "—"}</dd>
          </dl>
          <ul className="border-t rule pt-3 space-y-2 text-sm">
            {row.items.map((it, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span className="text-ink truncate">
                  {it.name}
                  {it.size_mg > 0 && (
                    <span className="text-ink-muted"> · {it.size_mg}mg × {it.quantity}</span>
                  )}
                </span>
                <span className="font-mono-data text-xs text-ink-muted whitespace-nowrap">
                  {it.sku}
                </span>
              </li>
            ))}
          </ul>
          {total !== null && (
            <div className="border-t rule mt-4 pt-3 flex items-baseline justify-between">
              <span className="label-eyebrow text-ink-muted">Total due</span>
              <span className="font-mono-data text-xl text-ink font-semibold">
                {formatPrice(total)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* WHAT HAPPENS NEXT */}
      <div className="border rule bg-paper-soft p-5 sm:p-6 mb-8">
        <div className="label-eyebrow text-ink-muted mb-3">What happens next</div>
        <ol className="list-decimal pl-5 space-y-2 text-sm text-ink-soft leading-relaxed">
          <li>
            We sent a confirmation email{row?.customer.email ? ` to ${row.customer.email}` : ""} with
            the same instructions and your memo.
          </li>
          {method === "crypto" ? (
            <li>Pay through the hosted NOWPayments link in the follow-up email.</li>
          ) : (
            <li>
              Send your {method ? paymentMethodLabel(method).toLowerCase() : "payment"} including
              the memo <span className="font-mono-data text-wine">{memo}</span>.
            </li>
          )}
          <li>
            Once we see funds, your order moves to packing and ships within 1–2 business days.
            You&rsquo;ll get a tracking email when the box leaves our lab.
          </li>
        </ol>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <Link
          href="/catalogue"
          className="inline-flex items-center h-10 px-5 border rule bg-paper text-ink hover:bg-paper-soft transition-colors"
        >
          ← Back to the catalogue
        </Link>
        <a
          href={`mailto:admin@benchgradepeptides.com?subject=Order%20${memo}`}
          className="text-teal hover:underline"
        >
          Questions? Email us
        </a>
      </div>
    </article>
  );
}

interface InstructionsProps {
  method: Exclude<PaymentMethod, "crypto">;
  memo: string;
  details: ReturnType<typeof getPaymentMethodDetails>;
  amount: number | null;
}

function PaymentInstructions({ method, memo, details, amount }: InstructionsProps) {
  const rows: Array<[string, string, boolean?]> = [];
  let title = "";
  let footer = "";

  if (method === "wire") {
    title = "Wire transfer instructions";
    if (details.wire) {
      rows.push(["Beneficiary", details.wire.beneficiary]);
      if (details.wire.beneficiaryAddress) rows.push(["Address", details.wire.beneficiaryAddress]);
      rows.push(["Bank", details.wire.bank]);
      if (details.wire.bankAddress) rows.push(["Bank address", details.wire.bankAddress]);
      rows.push(["Routing / ABA", details.wire.routing]);
      rows.push(["Account", details.wire.account]);
      rows.push(["Account type", details.wire.accountType]);
    }
    rows.push(["Memo / reference", memo, true]);
    footer = "Send the wire exactly as listed and include the memo. We ship within 1–2 business days of funds clearing.";
  } else if (method === "ach") {
    title = "ACH credit instructions";
    if (details.ach) {
      rows.push(["Beneficiary", details.ach.beneficiary]);
      rows.push(["Bank", details.ach.bank]);
      rows.push(["Routing", details.ach.routing]);
      rows.push(["Account", details.ach.account]);
      rows.push(["Account type", details.ach.accountType]);
    }
    rows.push(["Memo / reference", memo, true]);
    footer = "Customer-initiated ACH credit (push from your bank's bill-pay or external-transfer flow). Step-by-step at /payments/ach. Clears in 1–3 business days.";
  } else if (method === "zelle") {
    title = "Zelle instructions";
    if (details.zelle) {
      rows.push(["Name", details.zelle.name]);
      rows.push(["Zelle handle", details.zelle.handle]);
    }
    rows.push(["Memo / note", memo, true]);
    footer = "Send from your bank's Zelle app. Most US banks settle in seconds. $500 per-transaction cap on most banks; if your order is over $500, send via wire or ACH instead.";
  }

  return (
    <div className="border rule bg-paper p-5 sm:p-6 mb-8">
      <div className="label-eyebrow text-ink-muted mb-3">{title}</div>
      {amount !== null && (
        <div className="bg-paper-soft border rule px-3 py-2 mb-4 inline-flex items-baseline gap-3">
          <span className="text-[10px] uppercase tracking-[0.12em] text-ink-muted">Amount to send</span>
          <span className="font-mono-data text-base text-ink font-semibold">
            {formatPrice(amount)}
          </span>
        </div>
      )}
      <dl className="border-t rule">
        {rows.map(([label, value, highlight]) => (
          <div
            key={label}
            className="grid grid-cols-[120px_1fr] sm:grid-cols-[160px_1fr] items-baseline gap-3 py-2 border-b border-rule/60 last:border-b-0"
          >
            <dt className="label-eyebrow text-[10px] sm:text-xs">{label}</dt>
            <dd
              className={`min-w-0 break-words ${
                highlight
                  ? "font-mono-data text-base sm:text-lg text-wine font-bold tracking-[0.05em]"
                  : "text-sm text-ink font-mono-data"
              }`}
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>
      {footer && (
        <p className="mt-4 text-xs text-ink-soft leading-relaxed italic">
          {footer}
        </p>
      )}
    </div>
  );
}
