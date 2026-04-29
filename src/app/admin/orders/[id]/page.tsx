import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LocalTime } from "@/components/admin/LocalTime";
import { isAdmin } from "@/lib/admin/auth";
import { getSupabaseServer } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/utils";
import { StatusControls } from "./StatusControls";
import { CopyMemo } from "./CopyMemo";
import { isPaymentMethod } from "@/lib/payments/methods";
import { isValidStatus } from "@/lib/orders/status";

export const metadata: Metadata = {
  title: "Order",
  robots: { index: false, follow: false },
};

interface Acknowledgment {
  certification_text: string;
  certification_version: string;
  certification_hash: string;
  is_adult: boolean;
  is_researcher: boolean;
  accepts_ruo: boolean;
  acknowledged_at: string;
  ip: string;
  user_agent: string;
}

interface Customer {
  name: string;
  email: string;
  institution?: string;
  phone?: string;
  ship_address_1: string;
  ship_address_2?: string;
  ship_city: string;
  ship_state: string;
  ship_zip: string;
  notes?: string;
}

interface OrderItem {
  sku: string;
  name: string;
  size_mg: number;
  pack_size: number;
  unit_price: number;
  quantity: number;
  product_slug: string;
  category_slug: string;
}

interface OrderRow {
  order_id: string;
  customer: Customer;
  items: OrderItem[];
  subtotal_cents: number;
  status: string;
  payment_method: string | null;
  acknowledgment: Acknowledgment;
  created_at: string;
  updated_at: string;
}

/**
 * Strict runtime narrowing — refuse to render anything that isn't
 * shaped like an OrderRow. Previously this page used `data as OrderRow`
 * which silently rendered garbage on any schema drift. Now a bad row
 * returns null and the page shows an explicit error instead of crashing
 * at the moment ops most needs the dashboard.
 */
function narrowOrderRow(row: unknown): OrderRow | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;

  if (typeof r.order_id !== "string") return null;
  if (typeof r.subtotal_cents !== "number") return null;
  if (typeof r.created_at !== "string") return null;
  if (typeof r.updated_at !== "string") return null;
  if (typeof r.status !== "string" || !isValidStatus(r.status)) return null;

  const pm = r.payment_method;
  let paymentMethod: string | null;
  if (pm === null || pm === undefined) paymentMethod = null;
  else if (isPaymentMethod(pm)) paymentMethod = pm;
  else return null;

  const customer = r.customer as Record<string, unknown> | null;
  if (
    !customer ||
    typeof customer.name !== "string" ||
    typeof customer.email !== "string" ||
    typeof customer.ship_address_1 !== "string" ||
    typeof customer.ship_city !== "string" ||
    typeof customer.ship_state !== "string" ||
    typeof customer.ship_zip !== "string"
  )
    return null;

  if (!Array.isArray(r.items) || r.items.length === 0) return null;
  const items: OrderItem[] = [];
  for (const it of r.items) {
    if (!it || typeof it !== "object") return null;
    const i = it as Record<string, unknown>;
    if (
      typeof i.sku !== "string" ||
      typeof i.name !== "string" ||
      typeof i.size_mg !== "number" ||
      typeof i.pack_size !== "number" ||
      typeof i.unit_price !== "number" ||
      typeof i.quantity !== "number" ||
      typeof i.product_slug !== "string" ||
      typeof i.category_slug !== "string"
    )
      return null;
    items.push({
      sku: i.sku,
      name: i.name,
      size_mg: i.size_mg,
      pack_size: i.pack_size,
      unit_price: i.unit_price,
      quantity: i.quantity,
      product_slug: i.product_slug,
      category_slug: i.category_slug,
    });
  }

  const ack = r.acknowledgment as Record<string, unknown> | null;
  if (
    !ack ||
    typeof ack.certification_text !== "string" ||
    typeof ack.certification_version !== "string" ||
    typeof ack.certification_hash !== "string" ||
    typeof ack.is_adult !== "boolean" ||
    typeof ack.is_researcher !== "boolean" ||
    typeof ack.accepts_ruo !== "boolean" ||
    typeof ack.acknowledged_at !== "string" ||
    typeof ack.ip !== "string" ||
    typeof ack.user_agent !== "string"
  )
    return null;

  return {
    order_id: r.order_id,
    customer: customer as unknown as Customer,
    items,
    subtotal_cents: r.subtotal_cents,
    status: r.status,
    payment_method: paymentMethod,
    acknowledgment: ack as unknown as Acknowledgment,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export default async function AdminOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin/login");
  const { id } = await params;

  const supa = getSupabaseServer();
  if (!supa) {
    return (
      <article className="max-w-4xl mx-auto px-6 py-10">
        <p className="text-oxblood">Supabase not configured.</p>
      </article>
    );
  }

  const { data, error } = await supa
    .from("orders")
    .select("*")
    .eq("order_id", id)
    .maybeSingle();
  if (error) {
    return (
      <article className="max-w-4xl mx-auto px-6 py-10">
        <p className="text-oxblood">{error.message}</p>
      </article>
    );
  }
  if (!data) notFound();
  const order = narrowOrderRow(data);
  if (!order) {
    return (
      <article className="max-w-4xl mx-auto px-6 py-10">
        <p className="text-oxblood">
          Order row has an unexpected shape. Schema drift suspected — check
          Supabase directly. Row id: {id}
        </p>
      </article>
    );
  }

  return (
    <article className="max-w-4xl mx-auto px-6 lg:px-10 py-10 space-y-10">
      <div>
        <Link href="/admin" className="text-xs text-teal hover:underline">
          ← All orders
        </Link>
        <div className="mt-4 flex items-baseline justify-between gap-4">
          <div>
            <div className="label-eyebrow text-ink-muted mb-1">Order</div>
            <h1 className="font-mono-data text-lg text-ink">{order.order_id}</h1>
            <div className="text-xs text-ink-muted mt-1">
              Placed <LocalTime iso={order.created_at} /> · updated{" "}
              <LocalTime iso={order.updated_at} />
            </div>
            {order.payment_method && (
              <div className="font-mono-data text-xs text-teal mt-2 uppercase tracking-wider">
                Payment method: {order.payment_method}
              </div>
            )}
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className="text-[10px] uppercase tracking-wider text-ink-muted">
                Payment memo
              </span>
              <CopyMemo memo={`BGP-${order.order_id.slice(0, 8).toUpperCase()}`} />
            </div>
          </div>
          <StatusControls orderId={order.order_id} current={order.status} />
        </div>
      </div>

      <section className="border rule bg-paper p-6">
        <h2 className="label-eyebrow text-ink-muted mb-3">Customer</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <Dt>Name</Dt>
          <Dd>{order.customer.name}</Dd>
          <Dt>Email</Dt>
          <Dd>
            <a href={`mailto:${order.customer.email}`} className="text-teal hover:underline">
              {order.customer.email}
            </a>
          </Dd>
          {order.customer.phone && (
            <>
              <Dt>Phone</Dt>
              <Dd>{order.customer.phone}</Dd>
            </>
          )}
          {order.customer.institution && (
            <>
              <Dt>Institution</Dt>
              <Dd>{order.customer.institution}</Dd>
            </>
          )}
          <Dt>Ship to</Dt>
          <Dd>
            <div>{order.customer.ship_address_1}</div>
            {order.customer.ship_address_2 && <div>{order.customer.ship_address_2}</div>}
            <div>
              {order.customer.ship_city}, {order.customer.ship_state} {order.customer.ship_zip}
            </div>
          </Dd>
          {order.customer.notes && (
            <>
              <Dt>Notes</Dt>
              <Dd>{order.customer.notes}</Dd>
            </>
          )}
        </dl>
      </section>

      <section className="border rule bg-paper">
        <div className="px-6 py-4 border-b rule flex items-baseline justify-between">
          <h2 className="label-eyebrow text-ink-muted">Items</h2>
          <span className="font-mono-data text-lg text-ink">
            {formatPrice(order.subtotal_cents)}
          </span>
        </div>
        <ul className="divide-y rule">
          {order.items.map((item) => (
            <li key={item.sku} className="px-6 py-4 flex items-baseline justify-between gap-4">
              <div>
                <div className="text-ink">{item.name}</div>
                <div className="font-mono-data text-xs text-ink-muted">
                  {item.pack_size}-vial pack · {item.size_mg}mg ea. · {item.sku} × {item.quantity}
                </div>
              </div>
              <span className="font-mono-data text-sm text-ink">
                {formatPrice(item.unit_price * item.quantity * 100)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="border rule bg-paper-soft p-6">
        <h2 className="label-eyebrow text-ink-muted mb-3">RUO acknowledgment</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <Dt>Acknowledged</Dt>
          <Dd><LocalTime iso={order.acknowledgment.acknowledged_at} /></Dd>
          <Dt>IP / UA</Dt>
          <Dd className="font-mono-data text-xs break-all">
            {order.acknowledgment.ip} · {order.acknowledgment.user_agent}
          </Dd>
          <Dt>Certification version</Dt>
          <Dd className="font-mono-data text-xs">{order.acknowledgment.certification_version}</Dd>
          <Dt>SHA-256</Dt>
          <Dd className="font-mono-data text-xs break-all">
            {order.acknowledgment.certification_hash}
          </Dd>
          <Dt>Flags</Dt>
          <Dd className="font-mono-data text-xs">
            adult:{String(order.acknowledgment.is_adult)} · researcher:
            {String(order.acknowledgment.is_researcher)} · ruo:
            {String(order.acknowledgment.accepts_ruo)}
          </Dd>
        </dl>
        <details className="mt-4">
          <summary className="text-xs text-ink-muted cursor-pointer hover:text-ink">
            Certification text
          </summary>
          <p className="mt-2 text-xs text-ink-soft leading-relaxed whitespace-pre-wrap">
            {order.acknowledgment.certification_text}
          </p>
        </details>
      </section>
    </article>
  );
}

function Dt({ children }: { children: React.ReactNode }) {
  return <dt className="text-ink-muted">{children}</dt>;
}
function Dd({ children, className }: { children: React.ReactNode; className?: string }) {
  return <dd className={className ?? "text-ink"}>{children}</dd>;
}
