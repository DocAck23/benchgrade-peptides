import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import { getSupabaseServer } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/utils";
import { LocalTime } from "@/components/admin/LocalTime";

export const metadata: Metadata = {
  title: "Accounts · Admin",
  robots: { index: false, follow: false },
};

type Row = {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  confirmed: boolean;
  order_count: number;
  lifetime_cents: number;
  last_order_at: string | null;
};

function fmt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function AdminAccountsPage() {
  if (!(await isAdmin())) redirect("/admin/login");

  const supa = getSupabaseServer();
  const rows: Row[] = [];

  if (supa) {
    // Paginate auth users — supabase caps perPage at ~1000.
    const users: Array<{
      id: string;
      email: string | null;
      created_at: string;
      last_sign_in_at: string | null;
      email_confirmed_at: string | null;
      confirmed_at?: string | null;
    }> = [];
    let page = 1;
    while (page < 20) {
      const { data, error } = await supa.auth.admin.listUsers({
        page,
        perPage: 1000,
      });
      if (error || !data?.users?.length) break;
      users.push(
        ...(data.users as unknown as Array<{
          id: string;
          email: string | null;
          created_at: string;
          last_sign_in_at: string | null;
          email_confirmed_at: string | null;
          confirmed_at?: string | null;
        }>),
      );
      if (data.users.length < 1000) break;
      page++;
    }

    // Aggregate order stats per user_id in one query.
    const ids = users.map((u) => u.id);
    const orderAgg = new Map<
      string,
      { count: number; cents: number; last: string | null }
    >();
    if (ids.length > 0) {
      const { data: ords } = await supa
        .from("orders")
        .select("customer_user_id, total_cents, created_at, status")
        .in("customer_user_id", ids)
        .neq("status", "cancelled");
      if (ords) {
        for (const o of ords as Array<{
          customer_user_id: string;
          total_cents: number | null;
          created_at: string;
        }>) {
          const cur = orderAgg.get(o.customer_user_id) ?? {
            count: 0,
            cents: 0,
            last: null,
          };
          cur.count += 1;
          cur.cents += o.total_cents ?? 0;
          if (!cur.last || o.created_at > cur.last) cur.last = o.created_at;
          orderAgg.set(o.customer_user_id, cur);
        }
      }
    }

    for (const u of users) {
      const a = orderAgg.get(u.id);
      rows.push({
        id: u.id,
        email: u.email ?? "—",
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        confirmed: Boolean(u.email_confirmed_at ?? u.confirmed_at),
        order_count: a?.count ?? 0,
        lifetime_cents: a?.cents ?? 0,
        last_order_at: a?.last ?? null,
      });
    }
    rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }

  const total = rows.length;
  const buyers = rows.filter((r) => r.order_count > 0).length;
  const confirmed = rows.filter((r) => r.confirmed).length;
  const lifetime = rows.reduce((s, r) => s + r.lifetime_cents, 0);

  return (
    <article className="max-w-7xl mx-auto px-6 lg:px-10 py-12">
      <div className="flex items-baseline justify-between mb-8">
        <div>
          <div className="label-eyebrow text-ink-muted mb-2">Admin</div>
          <h1 className="font-display text-4xl text-ink">Customer accounts</h1>
          <p className="text-sm text-ink-muted mt-2 max-w-2xl">
            Every Bench Grade Peptides account (Supabase auth users). Order
            stats are aggregated from non-cancelled orders linked to each
            account via <code>customer_user_id</code>.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="/admin/accounts/export"
            className="text-xs px-3 h-8 inline-flex items-center border border-ink text-ink hover:bg-ink hover:text-paper transition-colors"
          >
            Export CSV
          </a>
          <a href="/admin" className="text-sm text-gold hover:underline">
            ← Back to orders
          </a>
        </div>
      </div>

      <section className="mb-8 grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Total accounts" value={total.toLocaleString()} />
        <Stat label="Email confirmed" value={confirmed.toLocaleString()} />
        <Stat label="Have ordered" value={buyers.toLocaleString()} />
        <Stat label="Lifetime revenue" value={formatPrice(lifetime)} />
      </section>

      <section>
        <h2 className="label-eyebrow text-ink-muted mb-3">
          Accounts · {total.toLocaleString()}
        </h2>
        {rows.length === 0 ? (
          <div className="border rule bg-paper-soft p-6 text-sm text-ink-muted">
            No accounts yet.
          </div>
        ) : (
          <div className="overflow-x-auto border rule bg-paper">
            <table className="w-full text-sm">
              <thead className="border-b rule bg-paper-soft">
                <tr>
                  <Th>Email</Th>
                  <Th>Joined</Th>
                  <Th>Last sign-in</Th>
                  <Th className="text-right">Orders</Th>
                  <Th className="text-right">Lifetime</Th>
                  <Th>Last order</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody className="divide-y rule">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-paper-soft">
                    <Td className="font-mono text-xs">
                      <a
                        href={`/admin?q=${encodeURIComponent(r.email)}`}
                        className="text-gold hover:underline"
                      >
                        {r.email}
                      </a>
                    </Td>
                    <Td>{r.created_at ? <LocalTime iso={r.created_at} /> : "—"}</Td>
                    <Td>{r.last_sign_in_at ? <LocalTime iso={r.last_sign_in_at} /> : "—"}</Td>
                    <Td className="text-right tabular-nums">
                      {r.order_count.toLocaleString()}
                    </Td>
                    <Td className="text-right tabular-nums">
                      {r.lifetime_cents > 0 ? formatPrice(r.lifetime_cents) : "—"}
                    </Td>
                    <Td>{r.last_order_at ? <LocalTime iso={r.last_order_at} /> : "—"}</Td>
                    <Td>
                      {r.confirmed ? (
                        <span className="text-gold">confirmed</span>
                      ) : (
                        <span className="text-ink-muted">pending</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rule bg-paper p-4">
      <div className="label-eyebrow text-ink-muted text-xs mb-1">{label}</div>
      <div className="font-display text-2xl text-ink">{value}</div>
    </div>
  );
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th className={`px-4 py-2 label-eyebrow text-xs text-ink-muted text-left ${className}`}>
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3 align-top ${className}`}>{children}</td>;
}
