import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * Server-side analytics queries used by the admin dashboard. Centralized
 * here so the page component stays presentational and the SQL is in
 * one place we can later push into a Postgres view if rollup speed
 * becomes an issue.
 *
 * All queries are server-action / RSC only — never imported into the
 * client bundle.
 */

export interface KpiSummary {
  sessions_24h: number;
  sessions_7d: number;
  sessions_30d: number;
  unique_visitors_7d: number;
  pageviews_7d: number;
  orders_7d: number;
  revenue_cents_7d: number;
  conversion_pct_7d: number;
  aov_cents_7d: number;
  abandoned_checkout_pct_7d: number;
  email_capture_pct_7d: number;
}

export interface FunnelRow {
  step: string;
  /** Distinct sessions that fired this event in the window. */
  sessions: number;
  /** Drop-off vs. the previous step (0..1). 0 on the first step. */
  dropoff: number;
}

export interface SourceRow {
  source: string;
  sessions: number;
  orders: number;
  revenue_cents: number;
}

export interface PathRow {
  path: string;
  views: number;
  unique_sessions: number;
}

export interface SkuRow {
  sku: string;
  add_to_cart_events: number;
  orders_count: number;
}

export interface CountryRow {
  country: string;
  sessions: number;
}

export interface DeviceRow {
  device_class: string;
  sessions: number;
}

export interface DailyPoint {
  day: string;
  sessions: number;
  orders: number;
}

const DAY = 24 * 60 * 60 * 1000;
const isoNow = () => new Date().toISOString();
const isoAgo = (days: number) =>
  new Date(Date.now() - days * DAY).toISOString();

/**
 * Headline KPI tiles. Each window is computed independently — we don't
 * try to derive 30d from 7d since the underlying tables are append-
 * only and the indexes make repeated time-bound counts cheap.
 */
export async function getKpiSummary(): Promise<KpiSummary> {
  const supa = getSupabaseServer();
  if (!supa) return emptyKpi();

  const w24 = isoAgo(1);
  const w7 = isoAgo(7);
  const w30 = isoAgo(30);

  // Session counts. `head: true, count: 'exact'` returns count without
  // pulling the rows. We also fetch the 7d session-ID set explicitly
  // for the conversion-rate calc — see codex review #7: the previous
  // version mixed orders-by-created-at against sessions-by-first-seen,
  // so a returning visitor inflated conversion. Now we count only
  // orders that came from sessions started inside the same window.
  const sessions24 = await supa
    .from("analytics_sessions")
    .select("session_id", { count: "exact", head: true })
    .gte("first_seen_at", w24);
  const { data: sessions7Rows, count: sessions7Count } = await supa
    .from("analytics_sessions")
    .select("session_id", { count: "exact" })
    .gte("first_seen_at", w7);
  const sessions7Ids = new Set(
    (sessions7Rows ?? []).map((r) => (r as { session_id: string }).session_id),
  );
  const sessions30 = await supa
    .from("analytics_sessions")
    .select("session_id", { count: "exact", head: true })
    .gte("first_seen_at", w30);

  // 7d unique visitors = distinct session_ids with at least one
  // pageview. Done client-side because Supabase doesn't expose
  // `count(distinct)` cleanly through the JS client.
  const { data: pv7Rows } = await supa
    .from("analytics_events")
    .select("session_id")
    .eq("event_name", "pageview")
    .gte("occurred_at", w7);
  const uniqueVisitors7 = new Set(
    (pv7Rows ?? []).map((r) => (r as { session_id: string }).session_id),
  ).size;
  const pageviews7 = pv7Rows?.length ?? 0;

  // Orders + revenue from the orders table (truth, not the events
  // stream — which only sees what the client beacon sent and could
  // miss back-end-only flows like wire-payment confirmations).
  const { data: orderRows7 } = await supa
    .from("orders")
    .select("order_id, total_cents, created_at, status")
    .gte("created_at", w7)
    .neq("status", "cancelled");
  const orders7 = orderRows7?.length ?? 0;
  const revenueCents7 =
    (orderRows7 ?? []).reduce(
      (s, r) => s + ((r as { total_cents: number | null }).total_cents ?? 0),
      0,
    ) ?? 0;

  // Sessions that fired `checkout_start` but never `order_submitted`
  // → abandoned checkout. We count distinct sessions for both events
  // in the same window.
  const { data: csRows } = await supa
    .from("analytics_events")
    .select("session_id")
    .eq("event_name", "checkout_start")
    .gte("occurred_at", w7);
  const checkoutStartSet = new Set(
    (csRows ?? []).map((r) => (r as { session_id: string }).session_id),
  );
  const { data: osRows } = await supa
    .from("analytics_events")
    .select("session_id")
    .eq("event_name", "order_submitted")
    .gte("occurred_at", w7);
  const orderSubmittedSet = new Set(
    (osRows ?? []).map((r) => (r as { session_id: string }).session_id),
  );
  const startedNotFinished = [...checkoutStartSet].filter(
    (s) => !orderSubmittedSet.has(s),
  ).length;
  const abandonedPct =
    checkoutStartSet.size > 0
      ? (startedNotFinished / checkoutStartSet.size) * 100
      : 0;

  // Email-capture: sessions whose row has `customer_email_lower` set
  // (populated server-side on order_submitted) divided by sessions
  // that hit checkout. Even an abandoned checkout flow with the email
  // typed will get counted IF the client beacon fires
  // `order_submitted` — which it doesn't until submit success. So
  // this metric is effectively "sessions that placed an order ÷
  // sessions that started checkout."
  const { data: emailedRows } = await supa
    .from("analytics_sessions")
    .select("session_id")
    .gte("first_seen_at", w7)
    .not("customer_email_lower", "is", null);
  const emailed7 = emailedRows?.length ?? 0;
  const emailCapturePct =
    checkoutStartSet.size > 0 ? (emailed7 / checkoutStartSet.size) * 100 : 0;

  // Conversion: distinct in-window sessions that fired
  // `order_submitted` divided by all in-window sessions. Numerator
  // and denominator now share the same population (codex review #7).
  const convertedSessions = [...orderSubmittedSet].filter((id) =>
    sessions7Ids.has(id),
  ).length;
  const conversionPct =
    (sessions7Count ?? 0) > 0
      ? (convertedSessions / (sessions7Count ?? 1)) * 100
      : 0;
  const aovCents = orders7 > 0 ? Math.round(revenueCents7 / orders7) : 0;

  return {
    sessions_24h: sessions24.count ?? 0,
    sessions_7d: sessions7Count ?? 0,
    sessions_30d: sessions30.count ?? 0,
    unique_visitors_7d: uniqueVisitors7,
    pageviews_7d: pageviews7,
    orders_7d: orders7,
    revenue_cents_7d: revenueCents7,
    conversion_pct_7d: conversionPct,
    aov_cents_7d: aovCents,
    abandoned_checkout_pct_7d: abandonedPct,
    email_capture_pct_7d: emailCapturePct,
  };
}

function emptyKpi(): KpiSummary {
  return {
    sessions_24h: 0,
    sessions_7d: 0,
    sessions_30d: 0,
    unique_visitors_7d: 0,
    pageviews_7d: 0,
    orders_7d: 0,
    revenue_cents_7d: 0,
    conversion_pct_7d: 0,
    aov_cents_7d: 0,
    abandoned_checkout_pct_7d: 0,
    email_capture_pct_7d: 0,
  };
}

/**
 * Funnel — distinct sessions that hit each step in the last 7 days.
 * Drop-off computed against the previous step.
 */
export async function getFunnel(windowDays = 7): Promise<FunnelRow[]> {
  const supa = getSupabaseServer();
  if (!supa) return [];
  const since = isoAgo(windowDays);

  const steps: Array<{ key: string; label: string }> = [
    { key: "pageview", label: "Pageview" },
    { key: "product_view", label: "Product page" },
    { key: "add_to_cart", label: "Add to cart" },
    { key: "checkout_start", label: "Checkout start" },
    { key: "order_submitted", label: "Order submitted" },
  ];

  const counts: number[] = [];
  for (const s of steps) {
    const { data } = await supa
      .from("analytics_events")
      .select("session_id")
      .eq("event_name", s.key)
      .gte("occurred_at", since);
    const distinct = new Set(
      (data ?? []).map((r) => (r as { session_id: string }).session_id),
    ).size;
    counts.push(distinct);
  }

  return steps.map((s, i) => ({
    step: s.label,
    sessions: counts[i],
    dropoff:
      i === 0 || counts[i - 1] === 0 ? 0 : 1 - counts[i] / counts[i - 1],
  }));
}

export async function getTrafficSources(
  windowDays = 7,
  limit = 10,
): Promise<SourceRow[]> {
  const supa = getSupabaseServer();
  if (!supa) return [];
  const since = isoAgo(windowDays);

  // Pull sessions in window.
  const { data: sessRows } = await supa
    .from("analytics_sessions")
    .select("session_id, utm_source, referrer")
    .gte("first_seen_at", since);

  // Pull orders in window with their session_id (added in migration
  // 0020). Each order belongs to exactly one session, so revenue
  // attributes to one source — no double-count for repeat customers
  // who showed up via multiple sources (codex review #6).
  const { data: orderRows } = await supa
    .from("orders")
    .select("session_id, total_cents, status")
    .gte("created_at", since)
    .neq("status", "cancelled");

  // session_id → { source key, sessions count }
  type Bucket = { sessions: number; orders: number; revenue_cents: number };
  const byKey = new Map<string, Bucket>();
  const sessionKey = new Map<string, string>();

  const bucketFor = (utm: string | null, referrer: string | null) => {
    let key = utm?.trim().toLowerCase();
    if (!key && referrer) {
      try {
        key = new URL(referrer).host.replace(/^www\./, "");
      } catch {
        key = referrer;
      }
    }
    return key || "(direct)";
  };

  for (const r of (sessRows ?? []) as Array<{
    session_id: string;
    utm_source: string | null;
    referrer: string | null;
  }>) {
    const key = bucketFor(r.utm_source, r.referrer);
    sessionKey.set(r.session_id, key);
    const b = byKey.get(key) ?? { sessions: 0, orders: 0, revenue_cents: 0 };
    b.sessions += 1;
    byKey.set(key, b);
  }

  for (const o of (orderRows ?? []) as Array<{
    session_id: string | null;
    total_cents: number | null;
  }>) {
    const sid = o.session_id;
    if (!sid) continue;
    const key = sessionKey.get(sid);
    if (!key) continue;
    const b = byKey.get(key);
    if (!b) continue;
    b.orders += 1;
    b.revenue_cents += o.total_cents ?? 0;
  }

  const rows: SourceRow[] = [...byKey.entries()].map(([source, b]) => ({
    source,
    sessions: b.sessions,
    orders: b.orders,
    revenue_cents: b.revenue_cents,
  }));
  rows.sort((a, b) => b.sessions - a.sessions);
  return rows.slice(0, limit);
}

export async function getTopPaths(
  windowDays = 7,
  limit = 15,
): Promise<PathRow[]> {
  const supa = getSupabaseServer();
  if (!supa) return [];
  const since = isoAgo(windowDays);
  const { data } = await supa
    .from("analytics_events")
    .select("path, session_id")
    .eq("event_name", "pageview")
    .gte("occurred_at", since);

  const byPath = new Map<string, { views: number; sessions: Set<string> }>();
  for (const r of (data ?? []) as Array<{ path: string | null; session_id: string }>) {
    const key = (r.path ?? "/").split("?")[0];
    const cur = byPath.get(key) ?? { views: 0, sessions: new Set<string>() };
    cur.views += 1;
    cur.sessions.add(r.session_id);
    byPath.set(key, cur);
  }
  return [...byPath.entries()]
    .map(([path, v]) => ({
      path,
      views: v.views,
      unique_sessions: v.sessions.size,
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, limit);
}

export async function getTopSkus(
  windowDays = 30,
  limit = 15,
): Promise<SkuRow[]> {
  const supa = getSupabaseServer();
  if (!supa) return [];
  const since = isoAgo(windowDays);

  // add_to_cart counts from the events stream.
  const { data: addRows } = await supa
    .from("analytics_events")
    .select("properties")
    .eq("event_name", "add_to_cart")
    .gte("occurred_at", since);

  const addBySku = new Map<string, number>();
  for (const r of (addRows ?? []) as Array<{ properties: Record<string, unknown> | null }>) {
    const sku = typeof r.properties?.sku === "string" ? r.properties.sku : null;
    if (!sku) continue;
    addBySku.set(sku, (addBySku.get(sku) ?? 0) + 1);
  }

  // Order counts from the orders.items JSONB.
  const { data: orderRows } = await supa
    .from("orders")
    .select("items, status, created_at")
    .gte("created_at", since)
    .neq("status", "cancelled");

  const orderedBySku = new Map<string, number>();
  for (const o of (orderRows ?? []) as Array<{ items: Array<{ sku: string }> | null }>) {
    for (const item of o.items ?? []) {
      if (!item.sku) continue;
      orderedBySku.set(item.sku, (orderedBySku.get(item.sku) ?? 0) + 1);
    }
  }

  const allSkus = new Set([...addBySku.keys(), ...orderedBySku.keys()]);
  return [...allSkus]
    .map((sku) => ({
      sku,
      add_to_cart_events: addBySku.get(sku) ?? 0,
      orders_count: orderedBySku.get(sku) ?? 0,
    }))
    .sort((a, b) => b.add_to_cart_events - a.add_to_cart_events)
    .slice(0, limit);
}

export async function getCountryBreakdown(
  windowDays = 7,
  limit = 10,
): Promise<CountryRow[]> {
  const supa = getSupabaseServer();
  if (!supa) return [];
  const since = isoAgo(windowDays);
  const { data } = await supa
    .from("analytics_sessions")
    .select("country")
    .gte("first_seen_at", since);

  const counts = new Map<string, number>();
  for (const r of (data ?? []) as Array<{ country: string | null }>) {
    const k = r.country ?? "??";
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([country, sessions]) => ({ country, sessions }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, limit);
}

export async function getDeviceBreakdown(windowDays = 7): Promise<DeviceRow[]> {
  const supa = getSupabaseServer();
  if (!supa) return [];
  const since = isoAgo(windowDays);
  const { data } = await supa
    .from("analytics_sessions")
    .select("device_class")
    .gte("first_seen_at", since);
  const counts = new Map<string, number>();
  for (const r of (data ?? []) as Array<{ device_class: string | null }>) {
    const k = r.device_class ?? "unknown";
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([device_class, sessions]) => ({ device_class, sessions }))
    .sort((a, b) => b.sessions - a.sessions);
}

/**
 * Daily timeline for the dashboard's spark chart. Sessions + orders
 * over the last 30 days.
 */
export async function getDailyTimeline(windowDays = 30): Promise<DailyPoint[]> {
  const supa = getSupabaseServer();
  if (!supa) return [];
  const since = isoAgo(windowDays);

  const { data: sessRows } = await supa
    .from("analytics_sessions")
    .select("first_seen_at")
    .gte("first_seen_at", since);
  const { data: orderRows } = await supa
    .from("orders")
    .select("created_at, status")
    .gte("created_at", since)
    .neq("status", "cancelled");

  const sessByDay = new Map<string, number>();
  for (const r of (sessRows ?? []) as Array<{ first_seen_at: string }>) {
    const day = r.first_seen_at.slice(0, 10);
    sessByDay.set(day, (sessByDay.get(day) ?? 0) + 1);
  }
  const ordersByDay = new Map<string, number>();
  for (const r of (orderRows ?? []) as Array<{ created_at: string }>) {
    const day = r.created_at.slice(0, 10);
    ordersByDay.set(day, (ordersByDay.get(day) ?? 0) + 1);
  }
  const days: DailyPoint[] = [];
  for (let i = windowDays - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * DAY).toISOString().slice(0, 10);
    days.push({
      day: d,
      sessions: sessByDay.get(d) ?? 0,
      orders: ordersByDay.get(d) ?? 0,
    });
  }
  return days;
}

/** Invariant probe used by tests / migrations to confirm the tables wired up. */
export const ANALYTICS_NOW = isoNow;
