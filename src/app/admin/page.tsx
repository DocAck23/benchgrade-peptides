import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import { getSupabaseServer } from "@/lib/supabase/server";
import { LocalTime } from "@/components/admin/LocalTime";
import { formatPrice } from "@/lib/utils";
import { isPaymentMethod } from "@/lib/payments/methods";
import { escapeLikePattern } from "@/lib/text/like-escape";
import { MarkFundedButton } from "./MarkFundedButton";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

interface OrderRow {
  order_id: string;
  customer: { name: string; email: string };
  subtotal_cents: number;
  /** Server-computed amount owed (post-discount). Null on legacy rows. */
  total_cents: number | null;
  status: string;
  /** Null only on legacy rows from before payment_method was first-class. */
  payment_method: string | null;
  created_at: string;
  items: { quantity: number }[];
}

// Defensive: Supabase can return rows whose JSONB shape has drifted.
// We narrow to "renderable" — and if ANY field is malformed (including
// any item), the whole row is rejected. Silently rendering an undercount
// would hide the drift from ops.
function safeNarrow(row: unknown): OrderRow | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  if (typeof r.order_id !== "string") return null;
  if (typeof r.subtotal_cents !== "number") return null;
  const totalCents = typeof r.total_cents === "number" ? r.total_cents : null;
  if (typeof r.status !== "string") return null;
  if (typeof r.created_at !== "string") return null;
  const customer = r.customer as Record<string, unknown> | null;
  if (!customer || typeof customer.name !== "string" || typeof customer.email !== "string") return null;
  if (!Array.isArray(r.items) || r.items.length === 0) return null;
  const items: Array<{ quantity: number }> = [];
  for (const it of r.items) {
    if (!it || typeof it !== "object") return null;
    const qty = (it as Record<string, unknown>).quantity;
    if (typeof qty !== "number") return null;
    items.push({ quantity: qty });
  }
  // Accept either the enum values or null (legacy rows). Any other
  // string is a sign of schema drift — reject the whole row rather
  // than render garbage.
  const pm = r.payment_method;
  let paymentMethod: string | null;
  if (pm === null || pm === undefined) {
    paymentMethod = null;
  } else if (isPaymentMethod(pm)) {
    paymentMethod = pm;
  } else {
    return null;
  }
  return {
    order_id: r.order_id,
    customer: { name: customer.name, email: customer.email },
    subtotal_cents: r.subtotal_cents,
    total_cents: totalCents,
    status: r.status,
    payment_method: paymentMethod,
    created_at: r.created_at,
    items,
  };
}

const STATUS_LABELS: Record<string, string> = {
  awaiting_payment: "Awaiting payment",
  awaiting_wire: "Awaiting wire", // legacy fallback for pre-rename rows
  funded: "Funded",
  shipped: "Shipped",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

const STATUS_CLASSES: Record<string, string> = {
  awaiting_payment: "bg-oxblood/10 text-oxblood",
  awaiting_wire: "bg-oxblood/10 text-oxblood",
  funded: "bg-teal/10 text-teal",
  shipped: "bg-ink/10 text-ink",
  cancelled: "bg-ink-muted/20 text-ink-muted",
  refunded: "bg-ink-muted/20 text-ink-muted",
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin/login");
  const { status, q } = await searchParams;
  const search = (q ?? "").trim();

  const supa = getSupabaseServer();
  let orders: OrderRow[] = [];
  let loadError: string | null = null;

  if (!supa) {
    loadError = "Supabase not configured.";
  } else {
    let query = supa
      .from("orders")
      .select("order_id, customer, subtotal_cents, total_cents, status, payment_method, created_at, items")
      .order("created_at", { ascending: false })
      .limit(100);
    if (status) query = query.eq("status", status);
    if (search) {
      // Search across customer name + email (JSONB) and order id.
      const safe = escapeLikePattern(search);
      const pattern = `%${safe}%`;
      query = query.or(
        [
          `customer->>email.ilike.${pattern}`,
          `customer->>name.ilike.${pattern}`,
          `order_id.ilike.${pattern}`,
        ].join(","),
      );
    }
    const { data, error } = await query;
    if (error) loadError = error.message;
    else {
      const raw = Array.isArray(data) ? data : [];
      orders = raw.map(safeNarrow).filter((o): o is OrderRow => o !== null);
      const skipped = raw.length - orders.length;
      if (skipped > 0) {
        // Codex P1 #11 — surface schema drift instead of silently undercounting.
        loadError = `${skipped} row${skipped === 1 ? "" : "s"} hidden due to schema drift (malformed JSONB or unknown payment method).`;
      }
    }
  }

  return (
    <article className="max-w-6xl mx-auto px-6 lg:px-10 py-10">
      <div className="flex items-baseline justify-between mb-8">
        <div>
          <div className="label-eyebrow text-ink-muted mb-1">Admin</div>
          <h1 className="font-display text-3xl text-ink">Orders</h1>
        </div>
        <div className="flex items-baseline gap-4">
          {/* Section nav + logout live in the admin layout. */}
        </div>
      </div>

      <form action="/admin" method="get" className="flex gap-2 mb-4">
        {status && <input type="hidden" name="status" value={status} />}
        <input
          type="search"
          name="q"
          defaultValue={search}
          placeholder="Search by name, email, or order ID…"
          className="flex-1 h-9 px-3 border rule bg-paper text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:border-ink"
        />
        <button
          type="submit"
          className="h-9 px-4 text-xs bg-ink text-paper hover:bg-gold transition-colors"
        >
          Search
        </button>
        {search && (
          <Link
            href={status ? `/admin?status=${status}` : "/admin"}
            className="h-9 px-3 inline-flex items-center text-xs text-ink-soft hover:text-ink"
          >
            Clear
          </Link>
        )}
      </form>

      <div className="flex flex-wrap gap-2 mb-6">
        <FilterPill
          href={search ? `/admin?q=${encodeURIComponent(search)}` : "/admin"}
          active={!status}
          label="All"
        />
        {Object.entries(STATUS_LABELS).map(([k, v]) => {
          const params = new URLSearchParams();
          params.set("status", k);
          if (search) params.set("q", search);
          return (
            <FilterPill
              key={k}
              href={`/admin?${params.toString()}`}
              active={status === k}
              label={v}
            />
          );
        })}
      </div>

      {loadError && (
        <div className="border border-oxblood/40 bg-oxblood/5 text-oxblood px-4 py-3 text-sm mb-6">
          {loadError}
        </div>
      )}

      {orders.length === 0 && !loadError ? (
        <p className="text-ink-muted text-sm">No orders yet.</p>
      ) : (
        <div className="border rule bg-paper">
          <table className="w-full text-sm">
            <thead className="bg-paper-soft">
              <tr className="text-left">
                <Th>Date</Th>
                <Th>Customer</Th>
                <Th>Items</Th>
                <Th>Method</Th>
                <Th>Total</Th>
                <Th>Status</Th>
                <Th aria-label="Action" />
              </tr>
            </thead>
            <tbody className="divide-y rule">
              {orders.map((o) => {
                const totalQty = o.items.reduce((s, i) => s + i.quantity, 0);
                return (
                  <tr key={o.order_id} className="hover:bg-paper-soft">
                    <Td>
                      <LocalTime
                        iso={o.created_at}
                        className="font-mono-data text-xs text-ink-muted"
                      />
                    </Td>
                    <Td>
                      <div className="text-ink">{o.customer.name}</div>
                      <div className="text-xs text-ink-muted">{o.customer.email}</div>
                    </Td>
                    <Td>
                      <span className="font-mono-data text-xs">
                        {totalQty} {totalQty === 1 ? "vial" : "vials"}
                      </span>
                    </Td>
                    <Td>
                      <span className="font-mono-data text-xs text-ink-muted uppercase">
                        {o.payment_method ?? "—"}
                      </span>
                    </Td>
                    <Td>
                      <span className="font-mono-data text-ink">
                        {formatPrice(o.total_cents ?? o.subtotal_cents)}
                      </span>
                    </Td>
                    <Td>
                      <span
                        className={`inline-block px-2 py-0.5 text-xs font-mono-data ${
                          STATUS_CLASSES[o.status] ?? ""
                        }`}
                      >
                        {STATUS_LABELS[o.status] ?? o.status}
                      </span>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        {(o.status === "awaiting_payment" ||
                          o.status === "awaiting_wire") && (
                          <MarkFundedButton orderId={o.order_id} />
                        )}
                        <Link
                          href={`/admin/orders/${o.order_id}`}
                          className="text-teal text-xs hover:underline"
                        >
                          Open →
                        </Link>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </article>
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

function FilterPill({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center h-9 px-4 border text-xs transition-colors ${
        active ? "border-ink bg-ink text-paper" : "rule bg-paper text-ink hover:bg-paper-soft"
      }`}
    >
      {label}
    </Link>
  );
}
