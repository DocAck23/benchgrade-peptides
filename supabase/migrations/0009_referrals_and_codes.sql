-- 2026-04-25 sprint-3 wave A1: referral codes, referrals, free-vial
-- entitlements.
--
-- Adds three related tables:
--   * `public.referral_codes` -- one code per customer (post-first-order),
--     short uppercase alnum, used in /r/CODE deep links.
--   * `public.referrals` -- one row per attributed referee (referrer +
--     referee_email, optionally referee_user_id once the referee signs
--     up). Lifecycle: pending -> shipped -> redeemed (or cancelled).
--   * `public.free_vial_entitlements` -- credits granted to a customer
--     (referrer or stack-save tier) for one free 5mg or 10mg vial.
--     Lifecycle: available -> redeemed (or expired).
--
-- RLS allows authenticated users to look up any referral code (so the
-- /r/CODE attribution path works on signup), and lets customers read
-- their own referrals (as referrer) and their own entitlements.
-- All INSERT / UPDATE / DELETE go through service role.
--
-- Rollback strategy:
--   drop policy if exists "customers_read_own_entitlements" on public.free_vial_entitlements;
--   drop policy if exists "customers_read_own_referrals" on public.referrals;
--   drop policy if exists "anyone_read_referral_codes" on public.referral_codes;
--   drop index if exists public.free_vial_entitlements_customer_status_idx;
--   drop index if exists public.referrals_referee_email_per_code_idx;
--   drop index if exists public.referrals_code_idx;
--   drop index if exists public.referrals_referrer_idx;
--   drop index if exists public.referral_codes_owner_idx;
--   drop table if exists public.free_vial_entitlements;
--   drop table if exists public.referrals;
--   drop table if exists public.referral_codes;
--
-- Rollback semantics: free_vial_entitlements references referrals and
-- orders; referrals references referral_codes and orders. Dropping in
-- the order above (entitlements -> referrals -> codes) avoids FK
-- conflicts. Orders rows are untouched (FKs are ON DELETE SET NULL).

-- Each customer has ONE referral code (generated post-first-order)
create table public.referral_codes (
  code text primary key check (code ~ '^[A-Z0-9]{4,12}$'),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- One code per owner
create unique index referral_codes_owner_idx
  on public.referral_codes (owner_user_id);

-- One row per attributed referee
create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  referee_user_id uuid references auth.users(id) on delete set null,
  referee_email text not null,
  code text not null references public.referral_codes(code) on delete cascade,
  attributed_at timestamptz not null default now(),
  redeemed_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending', 'shipped', 'redeemed', 'cancelled')),
  first_order_id uuid references public.orders(order_id) on delete set null,
  created_at timestamptz not null default now()
);

create index referrals_referrer_idx
  on public.referrals (referrer_user_id, created_at desc);

create index referrals_code_idx
  on public.referrals (code);

-- A given email can only be attributed once per code (case-insensitive).
create unique index referrals_referee_email_per_code_idx
  on public.referrals (code, lower(referee_email));

-- Free-vial credits: granted to referrer on referee's first-order-shipped,
-- or to the customer themselves at Stack&Save tier 8/12, or by admin.
create table public.free_vial_entitlements (
  id uuid primary key default gen_random_uuid(),
  customer_user_id uuid not null references auth.users(id) on delete cascade,
  size_mg integer not null check (size_mg in (5, 10)),
  source text not null
    check (source in ('referral', 'stack_save_8', 'stack_save_12', 'admin_grant')),
  source_referral_id uuid references public.referrals(id) on delete set null,
  granted_at timestamptz not null default now(),
  redeemed_at timestamptz,
  redeemed_order_id uuid references public.orders(order_id) on delete set null,
  status text not null default 'available'
    check (status in ('available', 'redeemed', 'expired'))
);

create index free_vial_entitlements_customer_status_idx
  on public.free_vial_entitlements (customer_user_id, status);

-- RLS -- same pattern as orders/subscriptions
alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;
alter table public.free_vial_entitlements enable row level security;

-- Anyone authenticated can SELECT a referral_code (lookup by code on
-- /r/CODE attribution + checkout discount apply). Codes are short and
-- public by design; ownership is not sensitive.
create policy "anyone_read_referral_codes"
  on public.referral_codes
  for select
  to authenticated
  using (true);

-- Customers see their own referrals (as referrer)
create policy "customers_read_own_referrals"
  on public.referrals
  for select
  to authenticated
  using (referrer_user_id = auth.uid());

-- Customers see their own entitlements
create policy "customers_read_own_entitlements"
  on public.free_vial_entitlements
  for select
  to authenticated
  using (customer_user_id = auth.uid());

-- No INSERT / UPDATE / DELETE policies for `authenticated` -- service
-- role only. All write paths (claim referral, grant entitlement,
-- redeem entitlement, generate code) go through server actions that
-- use the service-role client.
