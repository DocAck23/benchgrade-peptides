import type { Metadata } from "next";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/client";
import { OrderStatusPill } from "@/components/account/OrderStatusPill";
import { isValidStatus, type OrderStatus } from "@/lib/orders/status";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Orders",
  description: "Your order history.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/account/orders" },
};

interface OrderListRow {
  order_id: string;
  created_at: string;
  status: OrderStatus;
  total_cents: number | null;
  subtotal_cents: number;
  items: Array<{ quantity: number; name?: string }> | null;
}

function totalQty(items: OrderListRow["items"]): number {
  if (!Array.isArray(items)) return 0;
  return items.reduce((s, i) => s + (typeof i.quantity === "number" ? i.quantity : 0), 0);
}

export default async function OrdersListPage() {
  const supa = await createServerSupabase();

  // RLS scopes by customer_user_id = auth.uid() — the cookie-bound client
  // means we can't accidentally over-fetch for a different user.
  const { data } = await supa
    .from("orders")
    .select("order_id, created_at, status, total_cents, subtotal_cents, items")
    .order("created_at", { ascending: false })
    .limit(50);

  const orders: OrderListRow[] = Array.isArray(data)
    ? data.filter((r): r is OrderListRow => {
        if (!r || typeof r !== "object") return false;
        const o = r as Record<string, unknown>;
        return (
          typeof o.order_id === "string" &&
          typeof o.created_at === "string" &&
          isValidStatus(o.status) &&
          typeof o.subtotal_cents === "number"
        );
      })
    : [];

  return (
    <article className="space-y-10">
      <header>
        <div className="label-eyebrow text-ink-muted mb-3">Bench Journal · Orders</div>
        <h1 className="font-display text-4xl lg:text-5xl leading-tight text-ink">Your orders.</h1>
      </header>

      {orders.length === 0 ? (
        <div className="border rule bg-paper-soft p-10 text-center">
          <h2
            className="font-editorial text-2xl text-ink mb-3"
            style={{ fontFamily: "var(--font-editorial)" }}
          >
            No orders yet.
          </h2>
          <p className="text-ink-soft mb-6 max-w-prose mx-auto">
            Once you place an order it lives here — every lot, every COA, every tracking number.
          </p>
          <Link
            href="/catalogue"
            className="inline-flex items-center h-11 px-6 bg-wine text-paper font-display uppercase text-[12px] tracking-[0.14em] hover:bg-wine-deep transition-colors duration-200 ease-out"
          >
            Browse the catalogue
          </Link>
        </div>
      ) : (
        <ul className="divide-y rule border-y rule">
          {orders.map((order) => {
            const total = order.total_cents ?? order.subtotal_cents;
            const qty = totalQty(order.items);
            return (
              <li key={order.order_id}>
                <Link
                  href={`/account/orders/${order.order_id}`}
                  className="grid grid-cols-1 md:grid-cols-[1.5fr_auto_auto_auto] items-center gap-3 md:gap-6 py-5 px-2 -mx-2 hover:bg-paper-soft transition-colors duration-200 ease-out"
                >
                  <div className="min-w-0">
                    <div className="font-mono-data text-xs text-ink-muted uppercase tracking-wider">
                      BGP-{order.order_id.slice(0, 8)}
                    </div>
                    <div className="text-sm text-ink mt-1">
                      {qty} {qty === 1 ? "vial" : "vials"} · placed{" "}
                      {new Date(order.created_at).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </div>
                  </div>
                  <OrderStatusPill status={order.status} />
                  <span className="font-mono-data text-base text-ink">{formatPrice(total)}</span>
                  <span className="font-display uppercase text-[11px] tracking-[0.12em] text-gold-dark whitespace-nowrap">
                    View details →
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}
