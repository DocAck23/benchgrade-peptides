import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import { getSupabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Funnel · Admin",
  robots: { index: false, follow: false },
};

const STEPS: Array<{ event: string; label: string; hint: string }> = [
  { event: "pageview", label: "Visited site", hint: "Any page on the site" },
  { event: "product_view", label: "Viewed a product", hint: "PDP page hit" },
  { event: "add_to_cart", label: "Added to cart", hint: "Add-to-cart click" },
  { event: "checkout_start", label: "Started checkout", hint: "Step 1 of checkout" },
  { event: "order_submitted", label: "Submitted order", hint: "Order placed" },
];

const RANGES: Array<{ key: string; label: string; days: number }> = [
  { key: "1d", label: "Last 24 hours", days: 1 },
  { key: "7d", label: "Last 7 days", days: 7 },
  { key: "30d", label: "Last 30 days", days: 30 },
  { key: "90d", label: "Last 90 days", days: 90 },
];

function pct(num: number, den: number): string {
  if (den === 0) return "—";
  return `${((num / den) * 100).toFixed(1)}%`;
}

export default async function AdminFunnelPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin/login");

  const params = await searchParams;
  const rangeKey = params.range ?? "7d";
  const range = RANGES.find((r) => r.key === rangeKey) ?? RANGES[1];
  const sinceIso = new Date(
    Date.now() - range.days * 24 * 60 * 60 * 1000,
  ).toISOString();

  const supa = getSupabaseServer();

  // Per-step session counts (one session counts once per step even if
  // it triggered the event multiple times — e.g. 3 product_view fires
  // = 1 session that got to "Viewed a product").
  const counts = new Map<string, number>();
  if (supa) {
    for (const step of STEPS) {
      const { data } = await supa
        .from("analytics_events")
        .select("session_id")
        .eq("event_name", step.event)
        .gte("created_at", sinceIso)
        .limit(50000);
      const uniq = new Set<string>();
      for (const row of (data ?? []) as Array<{ session_id: string }>) {
        if (row.session_id) uniq.add(row.session_id);
      }
      counts.set(step.event, uniq.size);
    }
  }

  const top = counts.get(STEPS[0].event) ?? 0;

  return (
    <article className="max-w-7xl mx-auto px-6 lg:px-10 py-12">
      <div className="flex items-baseline justify-between mb-8 gap-6 flex-wrap">
        <div>
          <div className="label-eyebrow text-ink-muted mb-2">Admin</div>
          <h1 className="font-display text-4xl text-ink">Conversion funnel</h1>
          <p className="text-sm text-ink-muted mt-2 max-w-2xl">
            Unique sessions that reached each step in the customer journey.
            Sourced from the first-party <code>analytics_events</code> table —
            bots are excluded at ingest.
          </p>
        </div>
        <div className="flex gap-2">
          {RANGES.map((r) => (
            <a
              key={r.key}
              href={`?range=${r.key}`}
              className={`text-xs px-3 h-8 inline-flex items-center border rule ${
                r.key === range.key
                  ? "bg-ink text-paper"
                  : "bg-paper text-ink hover:bg-paper-soft"
              }`}
            >
              {r.label}
            </a>
          ))}
        </div>
      </div>

      <section className="border rule bg-paper">
        <table className="w-full text-sm">
          <thead className="border-b rule bg-paper-soft">
            <tr>
              <Th>Step</Th>
              <Th className="text-right">Sessions</Th>
              <Th className="text-right">% of top</Th>
              <Th className="text-right">Step → next</Th>
              <Th>Drop-off</Th>
            </tr>
          </thead>
          <tbody className="divide-y rule">
            {STEPS.map((step, i) => {
              const here = counts.get(step.event) ?? 0;
              const next = STEPS[i + 1]
                ? counts.get(STEPS[i + 1].event) ?? 0
                : null;
              const stepPct = next != null ? pct(next, here) : "—";
              const barWidth = top > 0 ? (here / top) * 100 : 0;
              return (
                <tr key={step.event} className="hover:bg-paper-soft">
                  <Td>
                    <div className="font-medium text-ink">{step.label}</div>
                    <div className="text-xs text-ink-muted mt-0.5">
                      {step.hint} · <code>{step.event}</code>
                    </div>
                  </Td>
                  <Td className="text-right tabular-nums font-medium">
                    {here.toLocaleString()}
                  </Td>
                  <Td className="text-right tabular-nums text-ink-muted">
                    {pct(here, top)}
                  </Td>
                  <Td className="text-right tabular-nums">
                    {next != null ? (
                      <span
                        className={
                          next === 0
                            ? "text-ink-muted"
                            : here > 0 && next / here >= 0.5
                              ? "text-gold"
                              : "text-ink"
                        }
                      >
                        {stepPct}
                      </span>
                    ) : (
                      <span className="text-ink-muted">—</span>
                    )}
                  </Td>
                  <Td>
                    <div className="h-2 bg-paper-soft border rule overflow-hidden w-48">
                      <div
                        className="h-full bg-ink"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <p className="text-xs text-ink-muted mt-6 max-w-3xl">
        <strong>How to read this.</strong> "Sessions" is the count of distinct
        visitor sessions that fired the event at least once during the range.
        "Step → next" is the conversion rate from that step to the one below
        — green when ≥50% of sessions move on. The largest drop-offs are
        where to focus UX work. Sample is capped at 50,000 events per step
        per range to keep the page fast; widen to a shorter range for fully-
        accurate totals at high traffic volumes.
      </p>
    </article>
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
