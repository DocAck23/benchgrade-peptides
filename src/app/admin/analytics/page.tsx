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
  getUniqueVisitorWindows,
  getRevisitDistribution,
  getFirstVsReturningConversion,
  getTopAbandonmentPaths,
  getTopSearches,
  getAdAttribution,
  isRollupTruncated,
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

  const [
    kpi,
    funnel,
    sources,
    paths,
    skus,
    countries,
    devices,
    timeline,
    uniques,
    revisits,
    conversionSplit,
    abandonment,
    searches,
    ads,
  ] = await Promise.all([
    getKpiSummary(),
    getFunnel(7),
    getTrafficSources(7),
    getTopPaths(7),
    getTopSkus(30),
    getCountryBreakdown(7),
    getDeviceBreakdown(7),
    getDailyTimeline(30),
    getUniqueVisitorWindows(),
    getRevisitDistribution(),
    getFirstVsReturningConversion(30),
    getTopAbandonmentPaths(30),
    getTopSearches(30),
    getAdAttribution(30),
  ]);
  const dataTruncated = await isRollupTruncated(30);

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
        <a href="/admin" className="text-sm text-gold hover:underline">
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

      {dataTruncated && (
        <section
          className="border-2 border-wine bg-wine/5 px-5 py-4"
          aria-live="polite"
        >
          <div className="text-sm text-wine">
            <span className="font-bold">Heads up:</span> the 30-day session
            count exceeded the dashboard&rsquo;s 50,000-row rollup cap. The
            revisit, conversion, abandonment, search, and ad-attribution
            sections below are computed over the most recent 50,000 rows
            only — treat their numbers as a lower bound until the queries
            are pushed into a SQL view.
          </div>
        </section>
      )}

      {/* Unique visitors across rolling windows. Built off
          visitor_fingerprints (salted-hash IP+UA-class). Falls back
          to session counts when fingerprinting is disabled (no salt
          configured); we surface that explicitly so the founder
          knows when the number is "estimated unique sessions" vs
          "estimated unique people." */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="label-eyebrow text-ink-muted">Unique visitors</h2>
          {!uniques.fingerprinting_enabled && (
            <span className="text-[10px] text-ink-muted">
              fingerprinting disabled — set ANALYTICS_FINGERPRINT_SALT to upgrade these to true uniques
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Last hour" value={uniques.last_hour.toLocaleString()} />
          <Kpi label="Last 24h" value={uniques.last_24h.toLocaleString()} />
          <Kpi label="Last 7d" value={uniques.last_7d.toLocaleString()} />
          <Kpi label="Last 30d" value={uniques.last_30d.toLocaleString()} />
        </div>
      </section>

      {/* Revisit cadence: how many times each visitor has come back
          in the last 30 days. "1" is first-time-only — anything in
          2/3/4+ is meaningful retention signal. */}
      <section>
        <h2 className="label-eyebrow text-ink-muted mb-3">
          Revisits · last 30d
        </h2>
        <div className="border rule bg-paper">
          {(() => {
            const total = revisits.reduce((s, r) => s + r.visitors, 0);
            const max = Math.max(1, ...revisits.map((r) => r.visitors));
            return revisits.map((r, i) => {
              const widthPct = Math.max((r.visitors / max) * 100, 1);
              const sharePct =
                total > 0 ? ((r.visitors / total) * 100).toFixed(1) : "0";
              return (
                <div
                  key={r.bucket}
                  className={`flex items-center gap-3 px-5 py-3 ${
                    i < revisits.length - 1 ? "border-b rule" : ""
                  }`}
                >
                  <div className="w-32 shrink-0 text-sm text-ink">
                    {r.bucket === "1"
                      ? "1 visit (first-time only)"
                      : `${r.bucket} visits`}
                  </div>
                  <div className="flex-1 h-7 bg-paper-soft border rule overflow-hidden">
                    <div
                      className="h-full bg-ink"
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                  <div className="w-24 text-right font-mono-data text-sm">
                    {r.visitors.toLocaleString()}
                  </div>
                  <div className="w-20 text-right text-xs text-ink-muted">
                    {sharePct}%
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </section>

      {/* First-vs-returning conversion. Each side shows the cohort
          size + the conversion %. Comparison is the headline number
          — does the brand's repeat-visit experience close better
          than the first impression? */}
      <section>
        <h2 className="label-eyebrow text-ink-muted mb-3">
          First-time vs returning conversion · last 30d
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border rule bg-paper p-5">
            <div className="label-eyebrow text-ink-muted">First-time visitors</div>
            <div className="mt-2 font-mono-data text-3xl text-ink">
              {conversionSplit.first_visit_pct.toFixed(2)}%
            </div>
            <div className="mt-1 text-xs text-ink-muted">
              {conversionSplit.first_visit_orders.toLocaleString()} orders /{" "}
              {conversionSplit.first_visit_total.toLocaleString()} sessions
            </div>
          </div>
          <div className="border rule bg-paper p-5">
            <div className="label-eyebrow text-ink-muted">Returning visitors</div>
            <div className="mt-2 font-mono-data text-3xl text-ink">
              {conversionSplit.returning_pct.toFixed(2)}%
            </div>
            <div className="mt-1 text-xs text-ink-muted">
              {conversionSplit.returning_orders.toLocaleString()} orders /{" "}
              {conversionSplit.returning_total.toLocaleString()} sessions
            </div>
          </div>
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

      {/* Abandonment + search side-by-side. These are the two
          surfaces the founder asked about most directly: where do
          people drop off, and what are they looking for. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card title="Top abandonment pages · 30d">
          <Table
            head={["Last page seen", "Sessions"]}
            rows={abandonment.map((row) => [
              <span
                key={row.path}
                className="font-mono-data text-xs truncate block max-w-[280px]"
                title={row.path}
              >
                {row.path}
              </span>,
              row.count.toLocaleString(),
            ])}
            empty="No abandoned sessions in window."
          />
        </Card>

        <Card title="Top searches · 30d">
          <Table
            head={["Term", "Searches"]}
            rows={searches.map((row) => [
              <span key={row.term} className="text-sm">
                {row.term}
              </span>,
              row.count.toLocaleString(),
            ])}
            empty="No catalogue searches in window."
          />
        </Card>
      </div>

      {/* Ad attribution rollup. Empty until the founder runs paid
          campaigns; structured for fast scan once data lands.
          Identifier truncated visually to keep the column tight on
          mobile (ad ids are long alphanumeric blobs). */}
      <section>
        <h2 className="label-eyebrow text-ink-muted mb-3">
          Ad attribution · 30d
        </h2>
        <div className="border rule bg-paper">
          <Table
            head={["Source", "Identifier", "Sessions", "Orders"]}
            rows={ads.map((row) => [
              <span
                key={`${row.source}:${row.identifier}`}
                className="font-mono-data text-xs uppercase tracking-wider"
              >
                {row.source}
              </span>,
              <span
                key={`${row.source}-${row.identifier}-id`}
                className="font-mono-data text-xs text-ink-muted truncate block max-w-[280px]"
                title={row.identifier}
              >
                {row.identifier}
              </span>,
              row.sessions.toLocaleString(),
              row.orders.toLocaleString(),
            ])}
            empty="No ad-attributed sessions yet."
          />
        </div>
      </section>
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
