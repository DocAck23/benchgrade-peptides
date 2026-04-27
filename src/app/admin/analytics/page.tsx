import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import { formatPrice } from "@/lib/utils";
import {
  getKpiSummary,
  getFunnel,
  getTrafficSources,
  getTopPaths,
  getTopSkus,
  getCountryBreakdown,
  getDeviceBreakdown,
  getDailyTimeline,
} from "@/lib/analytics/queries";

export const metadata: Metadata = {
  title: "Analytics · Admin",
  robots: { index: false, follow: false },
};

// Dashboard reads recent state from Supabase; we always want fresh
// numbers. `dynamic = 'force-dynamic'` keeps Next from caching the RSC
// output between requests.
export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  if (!(await isAdmin())) redirect("/admin/login");

  const [kpi, funnel, sources, paths, skus, countries, devices, timeline] =
    await Promise.all([
      getKpiSummary(),
      getFunnel(7),
      getTrafficSources(7),
      getTopPaths(7),
      getTopSkus(30),
      getCountryBreakdown(7),
      getDeviceBreakdown(7),
      getDailyTimeline(30),
    ]);

  const maxFunnel = Math.max(1, ...funnel.map((f) => f.sessions));
  const maxSpark = Math.max(1, ...timeline.map((t) => t.sessions));

  return (
    <article className="max-w-7xl mx-auto px-6 lg:px-10 py-12 space-y-10">
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <div className="label-eyebrow text-ink-muted mb-2">Admin</div>
          <h1 className="font-display text-4xl text-ink">Analytics</h1>
          <p className="text-sm text-ink-soft mt-1">
            First-party visitor + funnel data. Updated live from
            <code className="font-mono-data text-xs ml-1">analytics_events</code>{" "}
            and <code className="font-mono-data text-xs">orders</code>.
          </p>
        </div>
        <a href="/admin" className="text-sm text-teal hover:underline">
          ← Back to orders
        </a>
      </header>

      {/* KPI tiles */}
      <section>
        <h2 className="label-eyebrow text-ink-muted mb-3">Last 7 days</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <Kpi label="Sessions 24h" value={kpi.sessions_24h.toLocaleString()} />
          <Kpi label="Sessions 7d" value={kpi.sessions_7d.toLocaleString()} />
          <Kpi label="Unique 7d" value={kpi.unique_visitors_7d.toLocaleString()} />
          <Kpi label="Pageviews 7d" value={kpi.pageviews_7d.toLocaleString()} />
          <Kpi label="Orders 7d" value={kpi.orders_7d.toLocaleString()} />
          <Kpi label="Revenue 7d" value={formatPrice(kpi.revenue_cents_7d)} />
          <Kpi
            label="Conversion 7d"
            value={`${kpi.conversion_pct_7d.toFixed(2)}%`}
          />
          <Kpi label="AOV 7d" value={formatPrice(kpi.aov_cents_7d)} />
          <Kpi
            label="Abandoned chk"
            value={`${kpi.abandoned_checkout_pct_7d.toFixed(1)}%`}
            tone="warn"
          />
          <Kpi
            label="Email capture"
            value={`${kpi.email_capture_pct_7d.toFixed(1)}%`}
          />
          <Kpi label="Sessions 30d" value={kpi.sessions_30d.toLocaleString()} />
        </div>
      </section>

      {/* Spark — sessions + orders by day */}
      <section className="border rule bg-paper-soft p-5">
        <h2 className="label-eyebrow text-ink-muted mb-3">
          Last 30 days · sessions vs orders
        </h2>
        <div className="flex items-end gap-px h-32">
          {timeline.map((d) => {
            const sessH = (d.sessions / maxSpark) * 100;
            const ordH = d.sessions > 0 ? (d.orders / d.sessions) * 100 : 0;
            return (
              <div
                key={d.day}
                className="flex-1 flex flex-col justify-end items-stretch min-w-0"
                title={`${d.day} · ${d.sessions} sess · ${d.orders} ord`}
              >
                <div
                  className="bg-ink"
                  style={{ height: `${Math.max(sessH, 1)}%` }}
                />
                {ordH > 0 && (
                  <div
                    className="bg-gold-dark"
                    style={{ height: `${Math.min(ordH, 30)}%` }}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-[10px] text-ink-muted mt-1 font-mono-data">
          <span>{timeline[0]?.day}</span>
          <span>{timeline[timeline.length - 1]?.day}</span>
        </div>
      </section>

      {/* Funnel */}
      <section>
        <h2 className="label-eyebrow text-ink-muted mb-3">
          Conversion funnel · 7 days
        </h2>
        <div className="border rule bg-paper">
          {funnel.map((f, i) => {
            const widthPct = Math.max((f.sessions / maxFunnel) * 100, 1);
            return (
              <div
                key={f.step}
                className={`flex items-center gap-3 px-5 py-3 ${
                  i < funnel.length - 1 ? "border-b rule" : ""
                }`}
              >
                <div className="w-40 shrink-0 text-sm text-ink">{f.step}</div>
                <div className="flex-1 h-7 bg-paper-soft border rule overflow-hidden relative">
                  <div
                    className="h-full bg-ink"
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
                <div className="w-24 text-right font-mono-data text-sm">
                  {f.sessions.toLocaleString()}
                </div>
                <div className="w-20 text-right text-xs text-ink-muted">
                  {i === 0
                    ? "—"
                    : `${(f.dropoff * 100).toFixed(1)}% drop`}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Two-column grids */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card title="Traffic sources · 7d">
          <Table
            head={["Source", "Sessions", "Orders", "Revenue"]}
            rows={sources.map((s) => [
              s.source,
              s.sessions.toLocaleString(),
              s.orders.toLocaleString(),
              formatPrice(s.revenue_cents),
            ])}
            empty="No sessions in window."
          />
        </Card>

        <Card title="Top pages · 7d">
          <Table
            head={["Path", "Views", "Unique"]}
            rows={paths.map((p) => [
              <span key={p.path} className="font-mono-data text-xs truncate block max-w-[280px]">
                {p.path}
              </span>,
              p.views.toLocaleString(),
              p.unique_sessions.toLocaleString(),
            ])}
            empty="No pageviews in window."
          />
        </Card>

        <Card title="Top SKUs · 30d">
          <Table
            head={["SKU", "Add-to-cart", "Orders"]}
            rows={skus.map((s) => [
              <span key={s.sku} className="font-mono-data text-xs">
                {s.sku}
              </span>,
              s.add_to_cart_events.toLocaleString(),
              s.orders_count.toLocaleString(),
            ])}
            empty="No SKU activity in window."
          />
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <Card title="Countries · 7d">
            <Table
              head={["Country", "Sessions"]}
              rows={countries.map((c) => [c.country, c.sessions.toLocaleString()])}
              empty="No data."
            />
          </Card>
          <Card title="Devices · 7d">
            <Table
              head={["Device", "Sessions"]}
              rows={devices.map((d) => [
                d.device_class,
                d.sessions.toLocaleString(),
              ])}
              empty="No data."
            />
          </Card>
        </div>
      </div>
    </article>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warn";
}) {
  return (
    <div className="border rule bg-paper px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.1em] text-ink-muted">
        {label}
      </div>
      <div
        className={`mt-1 font-mono-data text-xl ${tone === "warn" ? "text-wine" : "text-ink"}`}
      >
        {value}
      </div>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border rule bg-paper">
      <header className="px-5 py-3 border-b rule">
        <h3 className="label-eyebrow text-ink-muted">{title}</h3>
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Table({
  head,
  rows,
  empty,
}: {
  head: string[];
  rows: React.ReactNode[][];
  empty: string;
}) {
  if (rows.length === 0) {
    return <div className="text-sm text-ink-muted">{empty}</div>;
  }
  return (
    <div className="overflow-x-auto -mx-5">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b rule">
            {head.map((h, i) => (
              <th
                key={h}
                className={`px-5 py-2 label-eyebrow text-ink-muted font-normal ${
                  i === 0 ? "text-left" : "text-right"
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y rule">
          {rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((cell, ci) => (
                <td
                  key={ci}
                  className={`px-5 py-2 align-top ${
                    ci === 0 ? "text-left" : "text-right font-mono-data"
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
