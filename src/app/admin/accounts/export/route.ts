import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin/auth";
import { getSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Streams every customer account as CSV. Admin-only. Spotty data
 * (no email confirm, no orders) still flows through — empty fields
 * become empty CSV cells, not nulls or "undefined" strings.
 */
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supa = getSupabaseServer();
  if (!supa) {
    return NextResponse.json({ error: "DB unavailable" }, { status: 500 });
  }

  // Pull every auth user (paginate to avoid the 1000-perPage cap).
  const users: Array<{
    id: string;
    email: string | null;
    created_at: string;
    last_sign_in_at: string | null;
    email_confirmed_at: string | null;
  }> = [];
  let page = 1;
  while (page < 50) {
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
      }>),
    );
    if (data.users.length < 1000) break;
    page++;
  }

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
    for (const o of (ords ?? []) as Array<{
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

  const rows = users
    .slice()
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .map((u) => {
      const a = orderAgg.get(u.id);
      return [
        u.email ?? "",
        u.created_at,
        u.last_sign_in_at ?? "",
        u.email_confirmed_at ? "yes" : "no",
        String(a?.count ?? 0),
        a ? (a.cents / 100).toFixed(2) : "0.00",
        a?.last ?? "",
      ];
    });

  const header = [
    "email",
    "joined",
    "last_sign_in",
    "email_confirmed",
    "order_count",
    "lifetime_revenue_usd",
    "last_order_at",
  ];

  const csv = [header, ...rows]
    .map((row) =>
      row.map((cell) => {
        const s = String(cell ?? "");
        // Escape commas, quotes, newlines per RFC 4180.
        if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
        return s;
      }).join(","),
    )
    .join("\n");

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bgp-accounts-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
