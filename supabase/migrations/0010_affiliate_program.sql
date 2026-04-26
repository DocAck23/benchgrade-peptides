-- 2026-04-25 sprint-4 wave A1: affiliate program tables.
--
-- Adds four related tables that layer the formal affiliate program on
-- top of the Sprint 3 referrals system:
--
--   * `public.affiliate_applications` -- pending review queue. Anyone
--     (authed or anonymous) can submit; admin reviews and either
--     approves -> creates an `affiliates` row, or rejects.
--   * `public.affiliates` -- one row per approved affiliate (1:1 with
--     auth.users via user_id). Tracks tier (bronze/silver/gold/eminent),
--     payout method/handle, running balances (available / earned /
--     paid / redeemed), and reuses the customer's Sprint-3 referral_code.
--   * `public.commission_ledger` -- append-only ledger. One row per
--     commission event: `earned` (positive cents) when a referee's
--     order is funded, `clawback` (negative) on refund within 30d,
--     `redemption_debit` (negative) when commission is converted to a
--     vial entitlement, `payout_debit` (negative) when monthly cash
--     payout is sent. The affiliate's `available_balance_cents` is the
--     running sum of these entries.
--   * `public.affiliate_payouts` -- monthly batch payment record.
--     $50 floor enforced by CHECK. Lifecycle: pending -> sent (with
--     external_reference) | failed.
--
-- RLS lets each affiliate read their own row, ledger entries, payouts,
-- and any application they submitted while authed. All INSERT / UPDATE
-- / DELETE go through the service role.
--
-- Rollback strategy:
--   drop policy if exists "affiliates_read_own_payouts" on public.affiliate_payouts;
--   drop policy if exists "affiliates_read_own_ledger" on public.commission_ledger;
--   drop policy if exists "affiliates_read_own_row" on public.affiliates;
--   drop policy if exists "applicants_read_own_applications" on public.affiliate_applications;
--   drop trigger if exists affiliates_touch_updated_at on public.affiliates;
--   drop index if exists public.affiliate_payouts_affiliate_idx;
--   drop index if exists public.commission_ledger_referral_idx;
--   drop index if exists public.commission_ledger_affiliate_idx;
--   drop index if exists public.affiliates_user_id_idx;
--   drop index if exists public.affiliate_applications_status_idx;
--   drop table if exists public.affiliate_payouts;
--   drop table if exists public.commission_ledger;
--   drop table if exists public.affiliates;
--   drop table if exists public.affiliate_applications;
--
-- Rollback semantics: affiliate_payouts and commission_ledger reference
-- affiliates; affiliates references affiliate_applications. Dropping in
-- the order above (payouts -> ledger -> affiliates -> applications)
-- avoids FK conflicts. orders / referrals rows are untouched (FKs are
-- ON DELETE SET NULL).

-- Application queue: anyone can apply, admin reviews.
create table public.affiliate_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_email text not null,
  applicant_name text not null,
  audience_description text not null check (length(audience_description) <= 2000),
  website_or_social text,
  applicant_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  reviewed_by_admin text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index affiliate_applications_status_idx
  on public.affiliate_applications (status, created_at desc);

-- Approved affiliates. One row per user.
create table public.affiliates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  application_id uuid references public.affiliate_applications(id) on delete set null,
  tier text not null default 'bronze'
    check (tier in ('bronze', 'silver', 'gold', 'eminent')),
  payout_method text not null default 'zelle'
    check (payout_method in ('zelle', 'crypto', 'wire')),
  payout_handle text,
  available_balance_cents integer not null default 0,
  total_earned_cents integer not null default 0,
  total_paid_cents integer not null default 0,
  total_redeemed_cents integer not null default 0,
  approved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index affiliates_user_id_idx
  on public.affiliates (user_id);

-- Reuse the touch_updated_at() function from 0001_init_orders.sql.
drop trigger if exists affiliates_touch_updated_at on public.affiliates;
create trigger affiliates_touch_updated_at
  before update on public.affiliates
  for each row execute function public.touch_updated_at();

-- Append-only commission ledger.
create table public.commission_ledger (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  source_referral_id uuid references public.referrals(id) on delete set null,
  source_order_id uuid references public.orders(order_id) on delete set null,
  kind text not null
    check (kind in ('earned', 'clawback', 'redemption_debit', 'payout_debit')),
  amount_cents integer not null,
  tier_at_time text not null,
  created_at timestamptz not null default now()
);

create index commission_ledger_affiliate_idx
  on public.commission_ledger (affiliate_id, created_at desc);

create index commission_ledger_referral_idx
  on public.commission_ledger (source_referral_id);

-- Monthly payout records. $50 floor enforced.
create table public.affiliate_payouts (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  amount_cents integer not null check (amount_cents >= 5000),
  method text not null check (method in ('zelle', 'crypto', 'wire')),
  external_reference text,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed')),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  notes text
);

create index affiliate_payouts_affiliate_idx
  on public.affiliate_payouts (affiliate_id, created_at desc);

-- RLS -- same pattern as orders / referrals.
alter table public.affiliate_applications enable row level security;
alter table public.affiliates enable row level security;
alter table public.commission_ledger enable row level security;
alter table public.affiliate_payouts enable row level security;

-- Authed applicants see their own application (matched by applicant_user_id).
-- Anonymous applicants must be looked up by admin via service role.
create policy "applicants_read_own_applications"
  on public.affiliate_applications
  for select
  to authenticated
  using (applicant_user_id = auth.uid());

-- Affiliates see their own row.
create policy "affiliates_read_own_row"
  on public.affiliates
  for select
  to authenticated
  using (user_id = auth.uid());

-- Affiliates see their own ledger entries.
create policy "affiliates_read_own_ledger"
  on public.commission_ledger
  for select
  to authenticated
  using (
    affiliate_id in (
      select id from public.affiliates where user_id = auth.uid()
    )
  );

-- Affiliates see their own payouts.
create policy "affiliates_read_own_payouts"
  on public.affiliate_payouts
  for select
  to authenticated
  using (
    affiliate_id in (
      select id from public.affiliates where user_id = auth.uid()
    )
  );

-- No INSERT / UPDATE / DELETE policies for `authenticated` -- service
-- role only. All write paths (apply, approve, earn commission,
-- clawback, redeem, payout) go through server actions that use the
-- service-role client.
