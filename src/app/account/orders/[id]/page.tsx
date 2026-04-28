import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/client";
import { isValidUuid, type OrderStatus } from "@/lib/orders/status";
import { OrderTimeline, type OrderTimelineEvent } from "@/components/account/OrderTimeline";
import { OrderStatusPill } from "@/components/account/OrderStatusPill";
import { PendingPaymentPanel } from "@/components/account/PendingPaymentPanel";
import { OrderManagePanel } from "@/components/account/OrderManagePanel";
import { formatPrice } from "@/lib/utils";
import { isPaymentMethod, enabledPaymentMethods, getPaymentMethodDetails, type PaymentMethod } from "@/lib/payments/methods";
import { formatInvoiceNumber } from "@/lib/orders/invoice";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/site";

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
  invoice_number: number | null;
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
  ship_address: {
    ship_address_1: string;
    ship_address_2: string | null;
    ship_city: string;
    ship_state: string;
    ship_zip: string;
  } | null;
}

const VALID_CARRIERS: readonly Carrier[] = ["USPS", "UPS", "FedEx", "DHL"];

function isCarrier(x: unknown): x is Carrier {
  return typeof x === "string" && (VALID_CARRIERS as readonly string[]).includes(x);
}

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

  let ship_address: OrderDetail["ship_address"] = null;
  const c = r.customer;
  if (c && typeof c === "object") {
    const co = c as Record<string, unknown>;
    if (
      typeof co.ship_address_1 === "string" &&
      typeof co.ship_city === "string" &&
      typeof co.ship_state === "string" &&
      typeof co.ship_zip === "string"
    ) {
      ship_address = {
        ship_address_1: co.ship_address_1,
        ship_address_2:
          typeof co.ship_address_2 === "string" ? co.ship_address_2 : null,
        ship_city: co.ship_city,
        ship_state: co.ship_state,
        ship_zip: co.ship_zip,
      };
    }
  }

  return {
    order_id: r.order_id,
    invoice_number:
      typeof r.invoice_number === "number" ? r.invoice_number : null,
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
    ship_address,
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
  const placed: OrderTimelineEvent = { status: "awaiting_payment", at: order.created_at, label: "Placed" };

  const fundedReached =
    order.status === "funded" || order.status === "shipped";
  const funded: OrderTimelineEvent = {
    status: "funded",
    at: fundedReached ? order.funded_at ?? order.updated_at : null,
    label: "Paid",
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
      "order_id, invoice_number, status, items, subtotal_cents, discount_cents, total_cents, free_vial_entitlement, tracking_number, tracking_carrier, shipped_at, funded_at, created_at, updated_at, payment_method, nowpayments_invoice_url, customer"
    )
    .eq("order_id", id)
    .maybeSingle();

  if (error || !data) notFound();
  const order = narrow(data);
  if (!order) notFound();

  const subtotal = order.subtotal_cents;
  const discount = order.discount_cents ?? 0;
  const total = order.total_cents ?? subtotal - discount;
  const orderShort = `BGP-${order.order_id.slice(0, 8).toUpperCase()}`;
  const invoiceLabel =
    order.invoice_number !== null
      ? formatInvoiceNumber(order.invoice_number)
      : "INV-—";
  const isCancellable =
    order.status === "awaiting_payment" || order.status === "awaiting_wire";
  const shippingFree = subtotal >= FREE_SHIPPING_THRESHOLD * 100;

  return (
    <article className="space-y-8 max-w-4xl">
      <Link
        href="/account/orders"
        className="font-display uppercase text-[11px] tracking-[0.14em] text-gold-dark hover:text-ink transition-colors duration-200 ease-out"
      >
        ← All orders
      </Link>

      {/* Single outer card encompassing the whole order. Header strip
          carries order/invoice numbers + status pill; horizontal
          timeline reads left-to-right. Manage row sits above items so
          the customer's actions are within thumb's reach without
          scrolling. */}
      <section className="border rule bg-paper">
        <div className="px-6 lg:px-8 py-6 border-b rule">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 font-display uppercase text-[12px] tracking-[0.18em] text-ink-muted">
                <span>
                  Order ·{" "}
                  <span className="text-ink font-mono-data normal-case tracking-normal">
                    {orderShort}
                  </span>
                </span>
                <span>
                  Invoice ·{" "}
                  <span className="text-ink font-mono-data normal-case tracking-normal">
                    {invoiceLabel}
                  </span>
                </span>
              </div>
              <h1
                className="mt-3 font-editorial italic text-3xl lg:text-4xl text-ink leading-tight"
                style={{ fontFamily: "var(--font-editorial)" }}
              >
                {statusHeadline(order.status)}
              </h1>
            </div>
            <OrderStatusPill status={order.status} />
          </div>

          <div className="mt-6">
            <OrderTimeline
              events={buildTimeline(order)}
              orientation="horizontal"
            />
          </div>
        </div>

        {(order.status === "awaiting_payment" || order.status === "awaiting_wire") && (
          <div className="px-6 lg:px-8 py-6 border-b rule">
            <PendingPaymentPanel
              orderId={order.order_id}
              memo={`BGP-${order.order_id.slice(0, 8).toUpperCase()}`}
              amountCents={total}
              currentMethod={order.payment_method}
              availableMethods={enabledPaymentMethods()}
              details={getPaymentMethodDetails()}
              invoiceUrl={order.nowpayments_invoice_url}
            />
          </div>
        )}

        {/* Manage row — edit/cancel/speak buttons grouped right above
            the items list. Speak-to-team lives here too so it's within
            arm's reach instead of buried at the bottom. */}
        <div className="px-6 lg:px-8 py-5 border-b rule flex flex-wrap items-center gap-3">
          {isCancellable && order.ship_address && (
            <OrderManagePanel
              orderId={order.order_id}
              current={order.ship_address}
              compact
            />
          )}
          <Link
            href={`/account/messages?order_id=${encodeURIComponent(order.order_id)}`}
            className="inline-flex items-center justify-center h-10 px-4 bg-ink text-paper font-display uppercase text-[11px] tracking-[0.14em] hover:bg-gold-dark transition-colors duration-200 ease-out sm:ml-auto"
          >
            Speak to the team →
          </Link>
        </div>

        <div className="px-6 lg:px-8 py-5 border-b rule">
          <h2 className="font-display uppercase text-[12px] tracking-[0.18em] text-ink mb-4">
            Items
          </h2>
          <ul className="divide-y rule -mx-6 lg:-mx-8">
            {order.items.map((item, idx) => (
              <li
                key={`${item.sku}-${idx}`}
                className="px-6 lg:px-8 py-4 flex items-start gap-4"
              >
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
        </div>

        <dl className="px-6 lg:px-8 py-5 space-y-2 text-sm">
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
          <div className="flex justify-between">
            <dt className="text-ink-muted">Shipping</dt>
            <dd className="font-mono-data text-ink">
              {shippingFree ? "Free" : "Calculated at fulfillment"}
            </dd>
          </div>
          <div className="flex justify-between pt-2 border-t rule">
            <dt className="font-display uppercase text-[12px] tracking-[0.18em] text-ink">Total</dt>
            <dd className="font-mono-data text-base text-ink">{formatPrice(total)}</dd>
          </div>
        </dl>
      </section>

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
          Per-lot Certificate of Analysis is published on each product page and
          a printed copy ships inside every order. The vial itself carries a QR
          code that resolves to the exact lot record.
        </p>
      </section>
    </article>
  );
}
