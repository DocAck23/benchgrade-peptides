import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import { getSupabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Visitors · Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface SessionRow {
  session_id: string;
  first_seen_at: string;
  last_seen_at: string;
  country: string | null;
  device_class: string | null;
  utm_source: string | null;
  referrer: string | null;
  landing_path: string | null;
  customer_email_lower: string | null;
}

interface SessionWithOutcome extends SessionRow {
  page_count: number;
  did_checkout: boolean;
  did_submit: boolean;
}

export default async function AdminVisitorsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; outcome?: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin/login");
  const { days = "7", outcome = "all" } = await searchParams;
  const windowDays = Math.min(Math.max(Number.parseInt(days, 10) || 7, 1), 90);

  const supa = getSupabaseServer();
  const since = new Date(
    Date.now() - windowDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  let rows: SessionWithOutcome[] = [];
  let totalSessions = 0;

  if (supa) {
    const { data: sessRows, count } = await supa
      .from("analytics_sessions")
      .select(
        "session_id, first_seen_at, last_seen_at, country, device_class, utm_source, referrer, landing_path, customer_email_lower",
        { count: "exact" },
      )
      .gte("first_seen_at", since)
      .order("first_seen_at", { ascending: false })
      .limit(500);
    totalSessions = count ?? 0;

    const sessionIds = (sessRows ?? []).map(
      (s) => (s as SessionRow).session_id,
    );

    // One bulk fetch of events for the visible sessions.
    const eventsBySession = new Map<
      string,
      { pageviews: number; checkoutStart: boolean; submit: boolean }
    >();
    if (sessionIds.length > 0) {
      const { data: ev } = await supa
        .from("analytics_events")
        .select("session_id, event_name")
        .in("session_id", sessionIds);
      for (const e of (ev ?? []) as Array<{
        session_id: string;
        event_name: string;
      }>) {
        const cur =
          eventsBySession.get(e.session_id) ?? {
            pageviews: 0,
            checkoutStart: false,
            submit: false,
          };
        if (e.event_name === "pageview") cur.pageviews += 1;
        if (e.event_name === "checkout_start") cur.checkoutStart = true;
        if (e.event_name === "order_submitted") cur.submit = true;
        eventsBySession.set(e.session_id, cur);
      }
    }

    rows = (sessRows ?? []).map((s) => {
      const r = s as SessionRow;
      const e = eventsBySession.get(r.session_id) ?? {
        pageviews: 0,
        checkoutStart: false,
        submit: false,
      };
      return {
        ...r,
        page_count: e.pageviews,
        did_checkout: e.checkoutStart,
        did_submit: e.submit,
      };
    });
  }

  // Outcome filter — applied after the bulk fetch since the outcome
  // depends on joined event data the SQL doesn't see directly.
  const filtered = rows.filter((r) => {
    if (outcome === "ordered") return r.did_submit;
    if (outcome === "abandoned") return r.did_checkout && !r.did_submit;
    if (outcome === "browsed") return !r.did_checkout && r.page_count > 0;
    return true;
  });

  return (
    <article className="max-w-7xl mx-auto px-6 lg:px-10 py-12 space-y-6">
      <header className="flex items-baseline justify-between gap-4 mb-6">
        <div>
          <div className="label-eyebrow text-ink-muted mb-2">Admin</div>
          <h1 className="font-display text-4xl text-ink">Visitors</h1>
          <p className="text-sm text-ink-soft mt-1">
            {totalSessions.toLocaleString()} sessions in the last {windowDays} days.
          </p>
        </div>
        <a href="/admin" className="text-sm text-teal hover:underline">
          ← Back to orders
        </a>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs label-eyebrow text-ink-muted mr-2">Window</span>
        {[1, 7, 30, 90].map((d) => (
          <FilterPill
            key={d}
            href={`/admin/visitors?days=${d}&outcome=${outcome}`}
            active={windowDays === d}
            label={`${d}d`}
          />
        ))}
        <span className="text-xs label-eyebrow text-ink-muted ml-6 mr-2">
          Outcome
        </span>
        {[
          { v: "all", l: "All" },
          { v: "browsed", l: "Browsed" },
          { v: "abandoned", l: "Abandoned checkout" },
          { v: "ordered", l: "Ordered" },
        ].map((o) => (
          <FilterPill
            key={o.v}
            href={`/admin/visitors?days=${windowDays}&outcome=${o.v}`}
            active={outcome === o.v}
            label={o.l}
          />
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="border rule bg-paper-soft p-6 text-sm text-ink-muted">
          No sessions match this filter.
        </div>
      ) : (
        <div className="overflow-x-auto border rule bg-paper">
          <table className="w-full text-sm">
            <thead className="border-b rule bg-paper-soft">
              <tr>
                <Th>When</Th>
                <Th>Source</Th>
                <Th>Landing</Th>
                <Th>Geo</Th>
                <Th>Device</Th>
                <Th>Pages</Th>
                <Th>Email</Th>
                <Th>Outcome</Th>
                <Th>{""}</Th>
              </tr>
            </thead>
            <tbody className="divide-y rule">
              {filtered.map((r) => (
                <tr key={r.session_id} className="hover:bg-paper-soft">
                  <Td>
                    <span className="font-mono-data text-xs text-ink-muted whitespace-nowrap">
                      {new Date(r.first_seen_at).toLocaleString()}
                    </span>
                  </Td>
                  <Td>
                    <span className="text-xs">
                      {r.utm_source ?? referrerHost(r.referrer) ?? "(direct)"}
                    </span>
                  </Td>
                  <Td>
                    <span className="font-mono-data text-xs">
                      {(r.landing_path ?? "/").slice(0, 60)}
                    </span>
                  </Td>
                  <Td>
                    <span className="text-xs">{r.country ?? "??"}</span>
                  </Td>
                  <Td>
                    <span className="text-xs">{r.device_class ?? "—"}</span>
                  </Td>
                  <Td>
                    <span className="font-mono-data text-xs">
                      {r.page_count}
                    </span>
                  </Td>
                  <Td>
                    {r.customer_email_lower ? (
                      <span className="text-xs text-teal">
                        {r.customer_email_lower}
                      </span>
                    ) : (
                      <span className="text-xs text-ink-muted">—</span>
                    )}
                  </Td>
                  <Td>
                    <Outcome row={r} />
                  </Td>
                  <Td>
                    <Link
                      href={`/admin/visitors/${r.session_id}`}
                      className="text-teal text-xs hover:underline"
                    >
                      Path →
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}

function referrerHost(ref: string | null): string | null {
  if (!ref) return null;
  try {
    return new URL(ref).host.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function Outcome({ row }: { row: SessionWithOutcome }) {
  if (row.did_submit) {
    return <Badge tone="ok" label="Ordered" />;
  }
  if (row.did_checkout) {
    return <Badge tone="warn" label="Abandoned" />;
  }
  if (row.page_count > 0) {
    return <Badge tone="muted" label="Browsed" />;
  }
  return <Badge tone="muted" label="Bounced" />;
}

function Badge({
  tone,
  label,
}: {
  tone: "ok" | "warn" | "muted";
  label: string;
}) {
  const cls =
    tone === "ok"
      ? "bg-teal/10 text-teal"
      : tone === "warn"
        ? "bg-oxblood/10 text-oxblood"
        : "bg-ink-muted/15 text-ink-muted";
  return (
    <span
      className={`inline-block px-2 py-0.5 text-[10px] font-mono-data uppercase ${cls}`}
    >
      {label}
    </span>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left label-eyebrow text-ink-muted font-normal">
      {children}
    </th>
  );
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-top">{children}</td>;
}
function FilterPill({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center h-8 px-3 border text-xs transition-colors ${
        active ? "border-ink bg-ink text-paper" : "rule bg-paper text-ink hover:bg-paper-soft"
      }`}
    >
      {label}
    </Link>
  );
}
