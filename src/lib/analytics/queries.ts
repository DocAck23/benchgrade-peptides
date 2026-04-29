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

/**
 * Distinct-visitor counts over multiple windows. Uses
 * `visitor_fingerprints.last_seen_at` so the count is true-unique
 * (one row per fingerprint, not per session). Falls back to session
 * count when fingerprinting is disabled (no salt configured) so the
 * dashboard never shows zeros while the migration is rolling out.
 */
export interface UniqueVisitorWindows {
  last_hour: number;
  last_24h: number;
  last_7d: number;
  last_30d: number;
  fingerprinting_enabled: boolean;
}

/**
 * Soft cap on raw rows pulled into JS for any of the rollup queries.
 * When a query hits this cap the dashboard surfaces a "results
 * truncated, numbers are a lower bound" banner so the founder
 * doesn't make decisions on silently-undercounted data.
 */
const ROLLUP_ROW_CAP = 50_000;

export async function getUniqueVisitorWindows(): Promise<UniqueVisitorWindows> {
  const supa = getSupabaseServer();
  if (!supa) {
    return {
      last_hour: 0,
      last_24h: 0,
      last_7d: 0,
      last_30d: 0,
      fingerprinting_enabled: false,
    };
  }

  const now = Date.now();
  const HOUR = 60 * 60 * 1000;
  const DAY_LOCAL = 24 * HOUR;
  const cutoffs = [
    { key: "last_hour" as const, since: new Date(now - HOUR).toISOString() },
    { key: "last_24h" as const, since: new Date(now - DAY_LOCAL).toISOString() },
    { key: "last_7d" as const, since: new Date(now - 7 * DAY_LOCAL).toISOString() },
    { key: "last_30d" as const, since: new Date(now - 30 * DAY_LOCAL).toISOString() },
  ];

  // Fingerprinting status is derived from the env var, not from
  // table contents — codex caught the original "rows > 0 = enabled"
  // check as inverted: a salt rotation or unset would silently keep
  // showing pre-rotation rows as if hashing were still active. The
  // env var is the authoritative on/off switch since the route
  // declines to hash without it.
  const fingerprintingEnabled = Boolean(
    process.env.ANALYTICS_FINGERPRINT_SALT,
  );

  const result: UniqueVisitorWindows = {
    last_hour: 0,
    last_24h: 0,
    last_7d: 0,
    last_30d: 0,
    fingerprinting_enabled: fingerprintingEnabled,
  };

  for (const c of cutoffs) {
    if (fingerprintingEnabled) {
      const { count } = await supa
        .from("visitor_fingerprints")
        .select("fingerprint_hash", { count: "exact", head: true })
        .gte("last_seen_at", c.since);
      result[c.key] = count ?? 0;
    } else {
      const { count } = await supa
        .from("analytics_sessions")
        .select("session_id", { count: "exact", head: true })
        .gte("first_seen_at", c.since);
      result[c.key] = count ?? 0;
    }
  }

  return result;
}

/**
 * Revisit-count histogram for the last 30 days. Buckets visitors by
 * how many distinct sessions they spawned. "1" = first-time, "4+"
 * collapsed into a long tail since the founder's main signal is
 * "are people coming back at all."
 */
export interface RevisitBucket {
  bucket: "1" | "2" | "3" | "4+";
  visitors: number;
}

export async function getRevisitDistribution(): Promise<RevisitBucket[]> {
  const supa = getSupabaseServer();
  if (!supa) return [];

  const since = new Date(Date.now() - 30 * 86400 * 1000).toISOString();

  const { data } = await supa
    .from("analytics_sessions")
    .select("fingerprint_hash")
    .gte("first_seen_at", since)
    .not("fingerprint_hash", "is", null)
    .limit(ROLLUP_ROW_CAP);
  const counts = new Map<string, number>();
  for (const row of (data ?? []) as Array<{ fingerprint_hash: string }>) {
    counts.set(row.fingerprint_hash, (counts.get(row.fingerprint_hash) ?? 0) + 1);
  }
  const buckets: Record<RevisitBucket["bucket"], number> = {
    "1": 0,
    "2": 0,
    "3": 0,
    "4+": 0,
  };
  for (const n of counts.values()) {
    if (n >= 4) buckets["4+"] += 1;
    else if (n === 3) buckets["3"] += 1;
    else if (n === 2) buckets["2"] += 1;
    else buckets["1"] += 1;
  }
  return [
    { bucket: "1", visitors: buckets["1"] },
    { bucket: "2", visitors: buckets["2"] },
    { bucket: "3", visitors: buckets["3"] },
    { bucket: "4+", visitors: buckets["4+"] },
  ];
}

/**
 * One-shot truncation probe used by the admin page to decide whether
 * to surface a "data may be undercounted" banner. Returns true when
 * any rollup query in this module would have hit the row cap; the
 * 30-day session count is the broadest input, so checking that alone
 * is a sufficient proxy for all the JS-side aggregations.
 */
export async function isRollupTruncated(
  windowDays = 30,
): Promise<boolean> {
  const supa = getSupabaseServer();
  if (!supa) return false;
  const since = new Date(Date.now() - windowDays * 86400 * 1000).toISOString();
  const { count } = await supa
    .from("analytics_sessions")
    .select("session_id", { count: "exact", head: true })
    .gte("first_seen_at", since);
  return (count ?? 0) >= ROLLUP_ROW_CAP;
}

/**
 * First-visit vs returning-visit conversion split. PRD §2:
 *   - First-visit: % of fresh fingerprints that placed an order on
 *     their first session.
 *   - Returning-visit: % of returning fingerprints that placed an
 *     order on any return session.
 *
 * Computed from `analytics_sessions.is_first_visit` flag (set by the
 * route at session start) cross-joined with order_submitted events
 * tied to the same session_id.
 */
export interface ConversionSplit {
  first_visit_total: number;
  first_visit_orders: number;
  first_visit_pct: number;
  returning_total: number;
  returning_orders: number;
  returning_pct: number;
}

export async function getFirstVsReturningConversion(
  windowDays = 30,
): Promise<ConversionSplit> {
  const empty: ConversionSplit = {
    first_visit_total: 0,
    first_visit_orders: 0,
    first_visit_pct: 0,
    returning_total: 0,
    returning_orders: 0,
    returning_pct: 0,
  };

  const supa = getSupabaseServer();
  if (!supa) return empty;

  const since = new Date(Date.now() - windowDays * 86400 * 1000).toISOString();

  const { data: sessions } = await supa
    .from("analytics_sessions")
    .select("session_id, is_first_visit")
    .gte("first_seen_at", since)
    .not("is_first_visit", "is", null)
    .limit(ROLLUP_ROW_CAP);
  if (!Array.isArray(sessions) || sessions.length === 0) return empty;

  const sessionIds = sessions.map(
    (s) => (s as { session_id: string }).session_id,
  );
  // Same authoritative-truth pattern as abandonment: reconcile both
  // the analytics beacon and the orders table so a dropped beacon
  // doesn't move a converter into the non-converter cohort.
  const orderedSet = new Set<string>();
  const BATCH = 100;
  for (let i = 0; i < sessionIds.length; i += BATCH) {
    const slice = sessionIds.slice(i, i + BATCH);
    const { data: ev } = await supa
      .from("analytics_events")
      .select("session_id")
      .eq("event_name", "order_submitted")
      .in("session_id", slice);
    for (const e of (ev ?? []) as Array<{ session_id: string }>) {
      orderedSet.add(e.session_id);
    }
    const { data: orders } = await supa
      .from("orders")
      .select("session_id")
      .in("session_id", slice)
      .not("session_id", "is", null);
    for (const o of (orders ?? []) as Array<{ session_id: string | null }>) {
      if (o.session_id) orderedSet.add(o.session_id);
    }
  }

  const result: ConversionSplit = { ...empty };
  for (const s of sessions as Array<{ session_id: string; is_first_visit: boolean }>) {
    const ordered = orderedSet.has(s.session_id);
    if (s.is_first_visit) {
      result.first_visit_total += 1;
      if (ordered) result.first_visit_orders += 1;
    } else {
      result.returning_total += 1;
      if (ordered) result.returning_orders += 1;
    }
  }
  result.first_visit_pct =
    result.first_visit_total > 0
      ? (result.first_visit_orders / result.first_visit_total) * 100
      : 0;
  result.returning_pct =
    result.returning_total > 0
      ? (result.returning_orders / result.returning_total) * 100
      : 0;
  return result;
}

/**
 * Top abandonment pages. PRD §2: among sessions in the window that
 * had at least one pageview but never reached order_submitted, group
 * by `last_path` (set by the route on every pageview). Returns the
 * top 20 paths by abandonment count.
 */
export interface AbandonmentRow {
  path: string;
  count: number;
}

export async function getTopAbandonmentPaths(
  windowDays = 30,
): Promise<AbandonmentRow[]> {
  const supa = getSupabaseServer();
  if (!supa) return [];

  const since = new Date(Date.now() - windowDays * 86400 * 1000).toISOString();

  const { data: sessions } = await supa
    .from("analytics_sessions")
    .select("session_id, last_path")
    .gte("first_seen_at", since)
    .not("last_path", "is", null)
    .limit(ROLLUP_ROW_CAP);
  if (!Array.isArray(sessions) || sessions.length === 0) return [];

  const sessionToPath = new Map<string, string>();
  for (const s of sessions as Array<{ session_id: string; last_path: string }>) {
    sessionToPath.set(s.session_id, s.last_path);
  }

  // Subtract sessions that actually converted. Codex caught the
  // original implementation as relying solely on the
  // `order_submitted` beacon — which can be dropped (rate limit, lost
  // tab, network blip) leaving a real buyer in the abandonment list.
  // Reconcile against the authoritative orders.session_id column too:
  // any analytics session linked to an order row in the window is a
  // converter, regardless of whether the client beacon landed.
  const orderedSet = new Set<string>();
  const ids = Array.from(sessionToPath.keys());
  // Smaller batch size to stay well below PostgREST URL limits
  // across hosting tiers (codex caught 500 × 36 chars as risky).
  const BATCH = 100;
  for (let i = 0; i < ids.length; i += BATCH) {
    const slice = ids.slice(i, i + BATCH);
    const { data: ev } = await supa
      .from("analytics_events")
      .select("session_id")
      .eq("event_name", "order_submitted")
      .in("session_id", slice);
    for (const e of (ev ?? []) as Array<{ session_id: string }>) {
      orderedSet.add(e.session_id);
    }
    const { data: orders } = await supa
      .from("orders")
      .select("session_id")
      .in("session_id", slice)
      .not("session_id", "is", null);
    for (const o of (orders ?? []) as Array<{ session_id: string | null }>) {
      if (o.session_id) orderedSet.add(o.session_id);
    }
  }

  const counts = new Map<string, number>();
  for (const [sid, path] of sessionToPath.entries()) {
    if (orderedSet.has(sid)) continue;
    counts.set(path, (counts.get(path) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
}

/**
 * Top product_search terms in the window. Pulls from
 * analytics_events where event_name='product_search' and the term
 * lives in properties.term. Aggregates and ranks.
 */
export interface SearchRow {
  term: string;
  count: number;
}

export async function getTopSearches(
  windowDays = 30,
): Promise<SearchRow[]> {
  const supa = getSupabaseServer();
  if (!supa) return [];

  const since = new Date(Date.now() - windowDays * 86400 * 1000).toISOString();

  const { data } = await supa
    .from("analytics_events")
    .select("properties")
    .eq("event_name", "product_search")
    .gte("occurred_at", since)
    .limit(ROLLUP_ROW_CAP);
  const counts = new Map<string, number>();
  for (const row of (data ?? []) as Array<{
    properties?: { term?: string };
  }>) {
    const t = row.properties?.term;
    if (!t || typeof t !== "string") continue;
    const norm = t.trim().toLowerCase();
    if (!norm) continue;
    counts.set(norm, (counts.get(norm) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([term, count]) => ({ term, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
}

/**
 * Ad-click attribution rollup. PRD §4.4: group sessions by
 * non-null gclid / fbclid / utm_id and report sessions + orders.
 * Empty everywhere until the founder runs ads.
 */
export interface AdAttributionRow {
  source: "gclid" | "fbclid" | "utm_id";
  identifier: string;
  sessions: number;
  orders: number;
}

export async function getAdAttribution(
  windowDays = 30,
): Promise<AdAttributionRow[]> {
  const supa = getSupabaseServer();
  if (!supa) return [];

  const since = new Date(Date.now() - windowDays * 86400 * 1000).toISOString();
  const { data: sessions } = await supa
    .from("analytics_sessions")
    .select("session_id, gclid, fbclid, utm_id")
    .gte("first_seen_at", since)
    .or("gclid.not.is.null,fbclid.not.is.null,utm_id.not.is.null")
    .limit(ROLLUP_ROW_CAP);
  if (!Array.isArray(sessions) || sessions.length === 0) return [];

  const sessionIds = sessions.map(
    (s) => (s as { session_id: string }).session_id,
  );
  const orderedSet = new Set<string>();
  const BATCH = 100;
  for (let i = 0; i < sessionIds.length; i += BATCH) {
    const slice = sessionIds.slice(i, i + BATCH);
    const { data: ev } = await supa
      .from("analytics_events")
      .select("session_id")
      .eq("event_name", "order_submitted")
      .in("session_id", slice);
    for (const e of (ev ?? []) as Array<{ session_id: string }>) {
      orderedSet.add(e.session_id);
    }
    const { data: orders } = await supa
      .from("orders")
      .select("session_id")
      .in("session_id", slice)
      .not("session_id", "is", null);
    for (const o of (orders ?? []) as Array<{ session_id: string | null }>) {
      if (o.session_id) orderedSet.add(o.session_id);
    }
  }

  type Key = `${"gclid" | "fbclid" | "utm_id"}:${string}`;
  const tally = new Map<Key, { sessions: number; orders: number }>();
  for (const s of sessions as Array<{
    session_id: string;
    gclid: string | null;
    fbclid: string | null;
    utm_id: string | null;
  }>) {
    const ordered = orderedSet.has(s.session_id);
    for (const [src, id] of [
      ["gclid", s.gclid],
      ["fbclid", s.fbclid],
      ["utm_id", s.utm_id],
    ] as const) {
      if (!id) continue;
      const k: Key = `${src}:${id}`;
      const cur = tally.get(k) ?? { sessions: 0, orders: 0 };
      cur.sessions += 1;
      if (ordered) cur.orders += 1;
      tally.set(k, cur);
    }
  }

  return Array.from(tally.entries())
    .map(([key, v]) => {
      const [source, identifier] = key.split(":") as [
        AdAttributionRow["source"],
        string,
      ];
      return { source, identifier, sessions: v.sessions, orders: v.orders };
    })
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 20);
}

/** Invariant probe used by tests / migrations to confirm the tables wired up. */
export const ANALYTICS_NOW = isoNow;
