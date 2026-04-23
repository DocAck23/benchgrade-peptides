import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import { getSupabaseServer } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/utils";
import { LogoutButton } from "./LogoutButton";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

interface OrderRow {
  order_id: string;
  customer: { name: string; email: string };
  subtotal_cents: number;
  status: string;
  created_at: string;
  items: { quantity: number }[];
}

const STATUS_LABELS: Record<string, string> = {
  awaiting_wire: "Awaiting wire",
  funded: "Funded",
  shipped: "Shipped",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

const STATUS_CLASSES: Record<string, string> = {
  awaiting_wire: "bg-oxblood/10 text-oxblood",
  funded: "bg-teal/10 text-teal",
  shipped: "bg-ink/10 text-ink",
  cancelled: "bg-ink-muted/20 text-ink-muted",
  refunded: "bg-ink-muted/20 text-ink-muted",
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin/login");
  const { status } = await searchParams;

  const supa = getSupabaseServer();
  let orders: OrderRow[] = [];
  let loadError: string | null = null;

  if (!supa) {
    loadError = "Supabase not configured.";
  } else {
    let query = supa
      .from("orders")
      .select("order_id, customer, subtotal_cents, status, created_at, items")
      .order("created_at", { ascending: false })
      .limit(100);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) loadError = error.message;
    else orders = (data as OrderRow[]) ?? [];
  }

  return (
    <article className="max-w-6xl mx-auto px-6 lg:px-10 py-10">
      <div className="flex items-baseline justify-between mb-8">
        <div>
          <div className="label-eyebrow text-ink-muted mb-1">Admin</div>
          <h1 className="font-display text-3xl text-ink">Orders</h1>
        </div>
        <LogoutButton />
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <FilterPill href="/admin" active={!status} label="All" />
        {Object.entries(STATUS_LABELS).map(([k, v]) => (
          <FilterPill
            key={k}
            href={`/admin?status=${k}`}
            active={status === k}
            label={v}
          />
        ))}
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
                      <span className="font-mono-data text-xs text-ink-muted">
                        {new Date(o.created_at).toLocaleString()}
                      </span>
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
                      <span className="font-mono-data text-ink">
                        {formatPrice(o.subtotal_cents)}
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
                      <Link
                        href={`/admin/orders/${o.order_id}`}
                        className="text-teal text-xs hover:underline"
                      >
                        Open →
                      </Link>
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
