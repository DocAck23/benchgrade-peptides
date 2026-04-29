-- 2026-04-28: analytics expansion — visitor fingerprints, last-path,
-- search events, ad-click identifiers.
--
-- The existing analytics_sessions / analytics_events tables (migration
-- 0016) capture session-level activity. To answer the founder's
-- questions ("unique visitors", "revisit count", "first-time vs
-- returning", "abandonment page", "top searches") we need:
--
--   1. A visitor identity that survives the 30-day session cookie.
--      Solved with a salted SHA-256 hash of the IP + UA-class.
--      One-way, no PII at rest.
--   2. A `last_path` field on the session so every render of
--      /admin/analytics can read the abandonment page in O(sessions)
--      instead of reconstructing from the events stream.
--   3. A `product_search` event type so catalogue search emissions
--      can flow through the existing event pipeline.
--   4. `gclid` / `fbclid` / `utm_id` columns alongside the existing
--      UTM fields for ad attribution once paid acquisition launches.
--
-- Privacy: no raw IP is persisted — the route hashes inline and
-- writes only the hash. The salt lives in
-- ANALYTICS_FINGERPRINT_SALT; rotating it intentionally severs the
-- link from old fingerprints to new sessions (data-retention reset).
--
-- Rollback:
--   alter table public.analytics_sessions drop column if exists fingerprint_hash;
--   alter table public.analytics_sessions drop column if exists last_path;
--   alter table public.analytics_sessions drop column if exists is_first_visit;
--   alter table public.analytics_sessions drop column if exists gclid;
--   alter table public.analytics_sessions drop column if exists fbclid;
--   alter table public.analytics_sessions drop column if exists utm_id;
--   alter table public.analytics_events drop constraint if exists analytics_events_event_name_check;
--   alter table public.analytics_events add constraint analytics_events_event_name_check check (event_name in ('pageview', 'product_view', 'add_to_cart', 'remove_from_cart', 'checkout_start', 'checkout_step', 'coupon_attempt', 'order_submitted', 'order_funded', 'subscription_started', 'affiliate_click', 'referral_click', 'coa_request', 'newsletter_signup'));
--   drop index if exists public.visitor_fingerprints_last_seen_idx;
--   drop table if exists public.visitor_fingerprints;

-- ---------- visitor_fingerprints ----------
-- One row per (IP-class + UA-class) hash. The fingerprint persists
-- forever (until salt rotation) so the founder can see "this person
-- has come back 7 times in 6 weeks" even after the session cookie
-- has rotated multiple times.
create table if not exists public.visitor_fingerprints (
  fingerprint_hash text primary key,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  -- Cumulative counts for revisit-distribution histograms. Kept in
  -- sync by the analytics route on every event insert (cheap; the
  -- session/event row is the audit trail).
  session_count integer not null default 1,
  event_count integer not null default 0,
  -- First time this fingerprint placed a funded order. Lets us
  -- compute "first-session converters" without a full reconstruction
  -- of session history.
  ordered_at timestamptz
);

-- Time-window queries scan recently-active fingerprints first.
create index if not exists visitor_fingerprints_last_seen_idx
  on public.visitor_fingerprints (last_seen_at desc);

-- Conversion cohort lookup — admin "ordered visitors" filter.
create index if not exists visitor_fingerprints_ordered_idx
  on public.visitor_fingerprints (ordered_at desc)
  where ordered_at is not null;

alter table public.visitor_fingerprints enable row level security;

-- No customer-side read/write — admin (service-role) only. The
-- absence of any policy + RLS-enabled is a fail-closed default that
-- gates this table to service-role queries only.

-- ---------- analytics_sessions: new columns ----------
alter table public.analytics_sessions
  add column if not exists fingerprint_hash text
    references public.visitor_fingerprints(fingerprint_hash)
    on delete set null;

alter table public.analytics_sessions
  add column if not exists last_path text;

alter table public.analytics_sessions
  add column if not exists is_first_visit boolean;

alter table public.analytics_sessions
  add column if not exists gclid text;

alter table public.analytics_sessions
  add column if not exists fbclid text;

alter table public.analytics_sessions
  add column if not exists utm_id text;

create index if not exists analytics_sessions_fingerprint_idx
  on public.analytics_sessions (fingerprint_hash, first_seen_at desc)
  where fingerprint_hash is not null;

create index if not exists analytics_sessions_gclid_idx
  on public.analytics_sessions (gclid)
  where gclid is not null;

create index if not exists analytics_sessions_fbclid_idx
  on public.analytics_sessions (fbclid)
  where fbclid is not null;

-- ---------- analytics_events: extend allowed event names ----------
-- Drop and re-add the CHECK constraint so the existing schema
-- accepts the new `product_search` event without breaking on insert.
-- Wrap in a DO block for re-run safety.
do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.analytics_events'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%event_name%';
  if cname is not null then
    execute format('alter table public.analytics_events drop constraint %I', cname);
  end if;
end $$;

alter table public.analytics_events
  add constraint analytics_events_event_name_check
  check (event_name in (
    'pageview',
    'product_view',
    'add_to_cart',
    'remove_from_cart',
    'checkout_start',
    'checkout_step',
    'coupon_attempt',
    'order_submitted',
    'order_funded',
    'subscription_started',
    'affiliate_click',
    'referral_click',
    'coa_request',
    'newsletter_signup',
    'product_search'
  ));
