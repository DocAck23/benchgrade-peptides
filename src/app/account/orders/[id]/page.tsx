import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/client";
import { isValidUuid, type OrderStatus } from "@/lib/orders/status";
import { OrderTimeline, type OrderTimelineEvent } from "@/components/account/OrderTimeline";
import { OrderStatusPill } from "@/components/account/OrderStatusPill";
import { PendingPaymentPanel } from "@/components/account/PendingPaymentPanel";
import { formatPrice } from "@/lib/utils";
import { isPaymentMethod, enabledPaymentMethods, getPaymentMethodDetails, type PaymentMethod } from "@/lib/payments/methods";

export const metadata: Metadata = {
  title: "Order detail",
  robots: { index: false, follow: false },
};

type Carrier = "USPS" | "UPS" | "FedEx" | "DHL";

interface OrderItem {
  sku: string;
  product_slug: string;
  category_slug: string;
  name: string;
  size_mg: number;
  unit_price: number;
  quantity: number;
  vial_image: string;
}

interface OrderDetail {
  order_id: string;
  status: OrderStatus;
  items: OrderItem[];
  subtotal_cents: number;
  discount_cents: number | null;
  total_cents: number | null;
  free_vial_entitlement: { size_mg: 5 | 10 } | null;
  tracking_number: string | null;
  tracking_carrier: Carrier | null;
  shipped_at: string | null;
  funded_at: string | null;
  created_at: string;
  updated_at: string;
  payment_method: PaymentMethod | null;
  nowpayments_invoice_url: string | null;
}

const VALID_CARRIERS: readonly Carrier[] = ["USPS", "UPS", "FedEx", "DHL"];

function isCarrier(x: unknown): x is Carrier {
  return typeof x === "string" && (VALID_CARRIERS as readonly string[]).includes(x);
}

/**
 * Strict narrowing — RLS already returns nothing if the viewer doesn't
 * own the row, but on read we still verify the shape so a schema drift
 * never crashes the page.
 */
function narrow(row: unknown): OrderDetail | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  if (typeof r.order_id !== "string") return null;
  if (typeof r.created_at !== "string") return null;
  if (typeof r.updated_at !== "string") return null;
  if (typeof r.status !== "string") return null;
  if (typeof r.subtotal_cents !== "number") return null;
  if (!Array.isArray(r.items)) return null;

  const items: OrderItem[] = [];
  for (const it of r.items) {
    if (!it || typeof it !== "object") return null;
    const i = it as Record<string, unknown>;
    if (
      typeof i.sku !== "string" ||
      typeof i.name !== "string" ||
      typeof i.size_mg !== "number" ||
      typeof i.unit_price !== "number" ||
      typeof i.quantity !== "number" ||
      typeof i.product_slug !== "string" ||
      typeof i.category_slug !== "string"
    ) {
      return null;
    }
    items.push({
      sku: i.sku,
      name: i.name,
      size_mg: i.size_mg,
      unit_price: i.unit_price,
      quantity: i.quantity,
      product_slug: i.product_slug,
      category_slug: i.category_slug,
      vial_image: typeof i.vial_image === "string" ? i.vial_image : "",
    });
  }

  let entitlement: OrderDetail["free_vial_entitlement"] = null;
  const fv = r.free_vial_entitlement;
  if (fv && typeof fv === "object") {
    const sz = (fv as Record<string, unknown>).size_mg;
    if (sz === 5 || sz === 10) entitlement = { size_mg: sz };
  }

  return {
    order_id: r.order_id,
    status: r.status as OrderStatus,
    items,
    subtotal_cents: r.subtotal_cents,
    discount_cents: typeof r.discount_cents === "number" ? r.discount_cents : null,
    total_cents: typeof r.total_cents === "number" ? r.total_cents : null,
    free_vial_entitlement: entitlement,
    tracking_number: typeof r.tracking_number === "string" ? r.tracking_number : null,
    tracking_carrier: isCarrier(r.tracking_carrier) ? r.tracking_carrier : null,
    shipped_at: typeof r.shipped_at === "string" ? r.shipped_at : null,
    funded_at: typeof r.funded_at === "string" ? r.funded_at : null,
    created_at: r.created_at,
    updated_at: r.updated_at,
    payment_method:
      typeof r.payment_method === "string" && isPaymentMethod(r.payment_method)
        ? r.payment_method
        : null,
    nowpayments_invoice_url:
      typeof r.nowpayments_invoice_url === "string" ? r.nowpayments_invoice_url : null,
  };
}

function trackingUrl(carrier: Carrier, n: string): string {
  const num = encodeURIComponent(n);
  switch (carrier) {
    case "USPS":
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${num}`;
    case "UPS":
      return `https://www.ups.com/track?tracknum=${num}`;
    case "FedEx":
      return `https://www.fedex.com/fedextrack/?tracknums=${num}`;
    case "DHL":
      return `https://www.dhl.com/global-en/home/tracking.html?tracking-id=${num}`;
  }
}

function statusHeadline(status: OrderStatus): string {
  switch (status) {
    case "awaiting_payment":
    case "awaiting_wire":
      return "Awaiting payment.";
    case "funded":
      return "Packing your order.";
    case "shipped":
      return "On its way.";
    case "cancelled":
      return "Order cancelled.";
    case "refunded":
      return "Order refunded.";
  }
}

function buildTimeline(order: OrderDetail): OrderTimelineEvent[] {
  const placed: OrderTimelineEvent = { status: "awaiting_payment", at: order.created_at, label: "Order placed" };

  // Prefer the discrete funded_at timestamp set by markOrderFunded /
  // the NOWPayments IPN. Fall back to updated_at for legacy rows
  // backfilled by migration 0012.
  const fundedReached =
    order.status === "funded" || order.status === "shipped";
  const funded: OrderTimelineEvent = {
    status: "funded",
    at: fundedReached ? order.funded_at ?? order.updated_at : null,
    label: "Payment received",
  };

  const shipped: OrderTimelineEvent = {
    status: "shipped",
    at: order.shipped_at,
    label: "Shipped",
  };

  if (order.status === "cancelled") {
    return [placed, { status: "cancelled", at: order.updated_at, label: "Cancelled" }];
  }
  if (order.status === "refunded") {
    return [placed, funded, { status: "refunded", at: order.updated_at, label: "Refunded" }];
  }
  return [placed, funded, shipped];
}

export default async function CustomerOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isValidUuid(id)) notFound();

  const supa = await createServerSupabase();
  const { data, error } = await supa
    .from("orders")
    .select(
      "order_id, status, items, subtotal_cents, discount_cents, total_cents, free_vial_entitlement, tracking_number, tracking_carrier, shipped_at, funded_at, created_at, updated_at, payment_method, nowpayments_invoice_url"
    )
    .eq("order_id", id)
    .maybeSingle();

  // Per spec I-RLS-2: a non-owner gets `data === null` from the cookie-scoped
  // query (RLS suppresses the row) → must surface as 404, never as a distinct
  // error code that would leak existence.
  if (error || !data) notFound();
  const order = narrow(data);
  if (!order) notFound();

  const subtotal = order.subtotal_cents;
  const discount = order.discount_cents ?? 0;
  const total = order.total_cents ?? subtotal - discount;

  return (
    <article className="space-y-12 max-w-4xl">
      <header>
        <Link
          href="/account/orders"
          className="font-display uppercase text-[11px] tracking-[0.14em] text-gold-dark hover:text-ink transition-colors duration-200 ease-out"
        >
          ← All orders
        </Link>
        <div className="mt-4 flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <div className="font-display uppercase text-[12px] tracking-[0.18em] text-ink-muted">
              Order · BGP-{order.order_id.slice(0, 8)}
            </div>
            <h1
              className="mt-2 font-editorial italic text-4xl lg:text-5xl text-ink leading-tight"
              style={{ fontFamily: "var(--font-editorial)" }}
            >
              {statusHeadline(order.status)}
            </h1>
          </div>
          <OrderStatusPill status={order.status} />
        </div>
      </header>

      {(order.status === "awaiting_payment" || order.status === "awaiting_wire") && (
        <PendingPaymentPanel
          orderId={order.order_id}
          memo={`BGP-${order.order_id.slice(0, 8).toUpperCase()}`}
          amountCents={total}
          currentMethod={order.payment_method}
          availableMethods={enabledPaymentMethods()}
          details={getPaymentMethodDetails()}
          invoiceUrl={order.nowpayments_invoice_url}
        />
      )}

      {order.free_vial_entitlement && (
        <section className="border rule bg-gold/10 border-gold-dark p-5 flex items-start gap-4">
          <div className="font-display uppercase text-[11px] tracking-[0.18em] text-gold-dark mt-0.5 shrink-0">
            Bonus
          </div>
          <p className="text-sm text-ink">
            Free {order.free_vial_entitlement.size_mg}mg vial of choice — select at next checkout.
          </p>
        </section>
      )}

      <section className="border rule bg-paper">
        <div className="px-6 py-4 border-b rule">
          <h2 className="font-display uppercase text-[12px] tracking-[0.18em] text-ink">Items</h2>
        </div>
        <ul className="divide-y rule">
          {order.items.map((item, idx) => (
            <li key={`${item.sku}-${idx}`} className="px-6 py-5 flex items-start gap-4">
              {item.vial_image ? (
                <div className="shrink-0 w-16 h-16 bg-paper-soft border rule overflow-hidden relative">
                  <Image
                    src={item.vial_image}
                    alt=""
                    fill
                    sizes="64px"
                    className="object-contain"
                  />
                </div>
              ) : (
                <div className="shrink-0 w-16 h-16 bg-paper-soft border rule" aria-hidden="true" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-ink">{item.name}</div>
                <div className="font-mono-data text-xs text-ink-muted mt-0.5">
                  {item.size_mg}mg · {item.sku} · qty {item.quantity}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono-data text-sm text-ink">
                  {formatPrice(item.unit_price * item.quantity * 100)}
                </div>
                <div className="font-mono-data text-[11px] text-ink-muted mt-0.5">
                  {formatPrice(item.unit_price * 100)} ea
                </div>
              </div>
            </li>
          ))}
        </ul>
        <dl className="px-6 py-5 border-t rule space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-muted">Subtotal</dt>
            <dd className="font-mono-data text-ink">{formatPrice(subtotal)}</dd>
          </div>
          {discount > 0 && (
            <div className="flex justify-between">
              <dt className="text-ink-muted">Stack &amp; Save / Same-SKU</dt>
              <dd className="font-mono-data text-ink">−{formatPrice(discount)}</dd>
            </div>
          )}
          <div className="flex justify-between pt-2 border-t rule">
            <dt className="font-display uppercase text-[12px] tracking-[0.18em] text-ink">Total</dt>
            <dd className="font-mono-data text-base text-ink">{formatPrice(total)}</dd>
          </div>
        </dl>
      </section>

      <section className="border rule bg-paper p-6 lg:p-8">
        <h2 className="font-display uppercase text-[12px] tracking-[0.18em] text-ink mb-5">
          Status timeline
        </h2>
        <OrderTimeline events={buildTimeline(order)} />
      </section>

      {order.tracking_number && order.tracking_carrier && (
        <section className="border rule bg-paper-soft p-6">
          <div className="label-eyebrow text-ink-muted mb-2">Tracking</div>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div className="font-mono-data text-sm text-ink break-all">
              {order.tracking_carrier} · {order.tracking_number}
            </div>
            <a
              href={trackingUrl(order.tracking_carrier, order.tracking_number)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-display uppercase text-[11px] tracking-[0.14em] text-gold-dark hover:text-ink transition-colors duration-200 ease-out"
            >
              Track shipment →
            </a>
          </div>
        </section>
      )}

      <section className="border rule bg-paper-soft p-6">
        <div className="label-eyebrow text-ink-muted mb-2">Certificate of Analysis</div>
        <p className="text-sm text-ink-soft">
          Per-lot COA available — coming when storage backend lands. Reach out via{" "}
          <Link href="/contact" className="text-gold-dark hover:text-ink underline">
            contact
          </Link>{" "}
          if you need a copy now.
        </p>
      </section>
    </article>
  );
}
