import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import { getSupabaseServer } from "@/lib/supabase/server";
import { LocalTime } from "@/components/admin/LocalTime";

export const metadata: Metadata = {
  title: "Waitlist · Admin",
  robots: { index: false, follow: false },
};

type Signup = {
  email_lower: string;
  signed_up_at: string;
  welcome_sent_at: string | null;
  unsubscribed_at: string | null;
  first_order_id: string | null;
  ip: string | null;
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

export default async function AdminWaitlistPage() {
  if (!(await isAdmin())) redirect("/admin/login");

  const supa = getSupabaseServer();
  const rows: Signup[] = [];
  let total = 0;
  let converted = 0;
  let unsubscribed = 0;
  let welcomeSent = 0;

  if (supa) {
    const { data, count } = await supa
      .from("prelaunch_signups")
      .select(
        "email_lower, signed_up_at, welcome_sent_at, unsubscribed_at, first_order_id, ip",
        { count: "exact" },
      )
      .order("signed_up_at", { ascending: false })
      .limit(1000);
    if (data) {
      for (const r of data as Signup[]) {
        rows.push(r);
        if (r.first_order_id) converted++;
        if (r.unsubscribed_at) unsubscribed++;
        if (r.welcome_sent_at) welcomeSent++;
      }
    }
    total = count ?? rows.length;
  }

  return (
    <article className="max-w-7xl mx-auto px-6 lg:px-10 py-12">
      <div className="flex items-baseline justify-between mb-8">
        <div>
          <div className="label-eyebrow text-ink-muted mb-2">Admin</div>
          <h1 className="font-display text-4xl text-ink">Pre-launch waitlist</h1>
          <p className="text-sm text-ink-muted mt-2 max-w-2xl">
            Everyone who signed up via the launch popup. They were emailed the
            FIRST250 code in the welcome email and can claim it after creating
            an account at checkout. FIRST250 is capped at 250 redemptions
            site-wide.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="/admin/waitlist/export"
            className="text-xs px-3 h-8 inline-flex items-center border border-ink text-ink hover:bg-ink hover:text-paper transition-colors"
          >
            Export CSV
          </a>
          <a href="/admin" className="text-sm text-teal hover:underline">
            ← Back to orders
          </a>
        </div>
      </div>

      <section className="mb-8 grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Total signups" value={total.toLocaleString()} />
        <Stat label="Welcome email sent" value={welcomeSent.toLocaleString()} />
        <Stat label="Converted (first order)" value={converted.toLocaleString()} />
        <Stat label="Unsubscribed" value={unsubscribed.toLocaleString()} />
      </section>

      <section>
        <h2 className="label-eyebrow text-ink-muted mb-3">
          Signups · showing {rows.length}
          {total > rows.length ? ` of ${total}` : ""}
        </h2>
        {rows.length === 0 ? (
          <div className="border rule bg-paper-soft p-6 text-sm text-ink-muted">
            No signups yet.
          </div>
        ) : (
          <div className="overflow-x-auto border rule bg-paper">
            <table className="w-full text-sm">
              <thead className="border-b rule bg-paper-soft">
                <tr>
                  <Th>Email</Th>
                  <Th>Signed up</Th>
                  <Th>Welcome</Th>
                  <Th>First order</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody className="divide-y rule">
                {rows.map((r) => (
                  <tr key={r.email_lower} className="hover:bg-paper-soft">
                    <Td className="font-mono text-xs">{r.email_lower}</Td>
                    <Td>{r.signed_up_at ? <LocalTime iso={r.signed_up_at} /> : "—"}</Td>
                    <Td>{r.welcome_sent_at ? <LocalTime iso={r.welcome_sent_at} /> : "—"}</Td>
                    <Td>
                      {r.first_order_id ? (
                        <a
                          href={`/admin?q=${encodeURIComponent(r.email_lower)}`}
                          className="text-teal hover:underline"
                        >
                          ordered
                        </a>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td>
                      {r.unsubscribed_at ? (
                        <span className="text-ink-muted">unsubscribed</span>
                      ) : r.first_order_id ? (
                        <span className="text-teal">converted</span>
                      ) : r.welcome_sent_at ? (
                        <span className="text-ink">on list</span>
                      ) : (
                        <span className="text-ink-muted">queued</span>
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

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left px-4 py-2 label-eyebrow text-xs text-ink-muted">
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
