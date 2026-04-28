import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin/auth";
import { getSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Streams every prelaunch waitlist signup as CSV. Admin-only.
 * Useful for cohorted email blasts in Resend or import to a CRM.
 */
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supa = getSupabaseServer();
  if (!supa) {
    return NextResponse.json({ error: "DB unavailable" }, { status: 500 });
  }

  const { data } = await supa
    .from("prelaunch_signups")
    .select(
      "email_lower, signed_up_at, welcome_sent_at, unsubscribed_at, first_order_id, ip, user_agent",
    )
    .order("signed_up_at", { ascending: false });

  const header = [
    "email",
    "signed_up_at",
    "welcome_sent_at",
    "unsubscribed_at",
    "converted",
    "first_order_id",
    "ip",
    "user_agent",
  ];

  const rows = (data ?? []).map((r) => {
    const row = r as {
      email_lower: string;
      signed_up_at: string;
      welcome_sent_at: string | null;
      unsubscribed_at: string | null;
      first_order_id: string | null;
      ip: string | null;
      user_agent: string | null;
    };
    return [
      row.email_lower,
      row.signed_up_at,
      row.welcome_sent_at ?? "",
      row.unsubscribed_at ?? "",
      row.first_order_id ? "yes" : "no",
      row.first_order_id ?? "",
      row.ip ?? "",
      row.user_agent ?? "",
    ];
  });

  const csv = [header, ...rows]
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell ?? "");
          if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
          return s;
        })
        .join(","),
    )
    .join("\n");

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bgp-waitlist-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
