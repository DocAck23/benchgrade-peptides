-- 2026-04-28: monthly raffle (sprint G3 of the rewards system).
--
-- The PRD's raffle model:
--   • Every month, one winner.
--   • Entries-per-customer formula: base(tier) + own_spend/$25
--     + referee_spend/$10 (calendar-month sums).
--   • Prize alternates: odd months → 2 vials of choice (issued as
--     vial_credits, redeemable at any future checkout).
--     even months → cash payout ($500 default, configurable per
--     month, paid off-platform via Zelle/wire/check).
--
-- Tables:
--
--   raffle_months — one row per (year, month). Admin pre-configures
--     the prize spec; cron snapshots entries on the last day, draws
--     on the 1st. Founder confirms before the prize email fires.
--
--   raffle_entries — denormalized snapshot of who had how many entries
--     when the draw happened. PK (month, user_id) keeps the
--     historical record stable even if new earnings land after the
--     snapshot.
--
--   cash_payouts — admin-managed list of cash prizes owed; tracks
--     payment method + paid_at so the founder can reconcile against
--     bank records.
--
-- Rollback:
--   drop policy if exists "users_read_own_cash_payouts" on public.cash_payouts;
--   drop policy if exists "users_read_own_raffle_entries" on public.raffle_entries;
--   drop policy if exists "public_read_raffle_months" on public.raffle_months;
--   drop table if exists public.cash_payouts;
--   drop table if exists public.raffle_entries;
--   drop table if exists public.raffle_months;
--   drop type if exists public.raffle_prize_kind;
--   drop type if exists public.cash_payout_method;

-- Prize kinds. `cash` and `vials_2` for now; future kinds can be
-- added with a separate migration.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'raffle_prize_kind') then
    create type public.raffle_prize_kind as enum ('cash', 'vials_2');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'cash_payout_method') then
    create type public.cash_payout_method as enum ('zelle', 'wire', 'check');
  end if;
end $$;

-- ---------- raffle_months ----------
create table if not exists public.raffle_months (
  -- First-of-month UTC. Acts as a stable identifier independent of
  -- timezone — '2026-05-01' refers to the May 2026 raffle drawn on
  -- June 1.
  month date primary key,
  prize_kind public.raffle_prize_kind not null,
  -- For cash months: the dollar prize in cents. Founder sets this
  -- per-month (e.g. $500 default, $750 for a banner month). Null on
  -- vial months.
  prize_amount_cents integer
    check (prize_amount_cents is null or prize_amount_cents between 0 and 1000000),
  -- For vial months: cap on size in mg (null = unrestricted "any
  -- vial" prize). Captured at award time onto each issued vial_credit
  -- so a customer redeeming later can't pick a larger vial than
  -- promised.
  vial_size_cap_mg integer
    check (vial_size_cap_mg is null or vial_size_cap_mg between 1 and 200),
  -- Snapshot lifecycle timestamps.
  entry_snapshot_at timestamptz,
  winner_user_id uuid references auth.users(id) on delete set null,
  drawn_at timestamptz,
  -- Required separate confirmation step before any prize email goes
  -- out — guards against a cron-induced send to the wrong person.
  confirmed_by_admin_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists raffle_months_drawn_at_idx
  on public.raffle_months (drawn_at desc)
  where drawn_at is not null;

alter table public.raffle_months enable row level security;

-- Public read: customers see what this month's prize is + last
-- month's winner (if confirmed). No write policy → admin-only.
drop policy if exists "public_read_raffle_months" on public.raffle_months;
create policy "public_read_raffle_months"
  on public.raffle_months
  for select
  to anon, authenticated
  using (true);

-- ---------- raffle_entries ----------
create table if not exists public.raffle_entries (
  month date not null references public.raffle_months(month) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_count integer not null check (entry_count > 0),
  primary key (month, user_id)
);

create index if not exists raffle_entries_month_idx
  on public.raffle_entries (month);

alter table public.raffle_entries enable row level security;

-- Customers read their own row only — admin sees the full month via
-- service role.
drop policy if exists "users_read_own_raffle_entries" on public.raffle_entries;
create policy "users_read_own_raffle_entries"
  on public.raffle_entries
  for select
  to authenticated
  using (user_id = auth.uid());

-- ---------- cash_payouts ----------
create table if not exists public.cash_payouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  -- For raffle wins: the source month. Future kinds (referral
  -- bounties, etc.) would store null here.
  source_month date references public.raffle_months(month) on delete set null,
  paid_at timestamptz,
  paid_method public.cash_payout_method,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists cash_payouts_user_id_idx
  on public.cash_payouts (user_id, created_at desc);

create index if not exists cash_payouts_pending_idx
  on public.cash_payouts (created_at desc)
  where paid_at is null;

alter table public.cash_payouts enable row level security;

drop policy if exists "users_read_own_cash_payouts" on public.cash_payouts;
create policy "users_read_own_cash_payouts"
  on public.cash_payouts
  for select
  to authenticated
  using (user_id = auth.uid());

-- No customer-side write — admin issues, admin marks paid via
-- service role.
