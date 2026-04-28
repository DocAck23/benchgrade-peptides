-- 2026-04-28: rewards / tier / raffle foundation (sprint G1).
--
-- Three new tables:
--
--   * points_ledger        — append-only credit/debit log; the source of
--                            truth. Every earn / redeem / reversal /
--                            admin adjustment writes one row here.
--   * user_rewards         — denormalized state per user (tier, current
--                            balance, lifetime totals). Recomputed from
--                            the ledger on every change + nightly cron.
--   * vial_credits         — free vials owed to a user (raffle prize,
--                            point redemption, or admin gift). Redeemed
--                            at a future checkout.
--
-- Tier-points use a "rolling 12-month bucket" model: each ledger row
-- has bucket_month = trunc(created_at, 'month'); aggregates filter
-- where bucket_month >= now() - 12 months. Spending the redeemable
-- balance never affects tier-points (the two columns are independent
-- on every ledger row).
--
-- RLS: customer reads own rows on every table; INSERTs always go via
-- service role from server actions (no customer-side write policy on
-- points_ledger or user_rewards). vial_credits reads-only for the
-- customer; admin/service role writes.
--
-- Rollback:
--   drop policy if exists "users_read_own_vial_credits" on public.vial_credits;
--   drop policy if exists "users_read_own_rewards" on public.user_rewards;
--   drop policy if exists "users_read_own_points_ledger" on public.points_ledger;
--   drop trigger if exists user_rewards_set_recomputed_at on public.user_rewards;
--   drop function if exists public.user_rewards_touch_recomputed_at();
--   drop table if exists public.vial_credits;
--   drop table if exists public.user_rewards;
--   drop table if exists public.points_ledger;
--   drop type if exists public.points_ledger_kind;
--   drop type if exists public.reward_tier;
--   drop type if exists public.vial_credit_source;

-- Tier enum — lowercase snake_case to match Postgres conventions; UI
-- maps to title-case display strings.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'reward_tier') then
    create type public.reward_tier as enum (
      'initiate', 'researcher', 'principal', 'fellow', 'laureate'
    );
  end if;
end $$;

-- Ledger row kinds. Earning kinds have positive deltas; redemption
-- kinds have negative deltas; reversals can go either way.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'points_ledger_kind') then
    create type public.points_ledger_kind as enum (
      'earn_own_spend',
      'earn_referee_first',
      'earn_referee_spend',
      'redeem_credit',
      'redeem_raffle_entry',
      'redeem_vial_5',
      'redeem_vial_10',
      'redeem_shipping',
      'admin_credit',
      'admin_debit',
      'reversal'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'vial_credit_source') then
    create type public.vial_credit_source as enum (
      'redemption', 'raffle', 'admin'
    );
  end if;
end $$;

-- ---------- points_ledger ----------
create table if not exists public.points_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind public.points_ledger_kind not null,
  -- Both deltas are signed integers. Earning rows: positive on both.
  -- Redemption rows: balance_delta negative, tier_delta zero (PRD §4.3
  -- — spending never affects tier-points). Reversals symmetric.
  tier_delta integer not null,
  balance_delta integer not null,
  -- Month the credit was earned, used for rolling-window aging.
  -- Truncated to the first of the month (UTC). Set by the action layer
  -- on insert; we don't compute from created_at because admin
  -- adjustments may need to back-date a credit to a specific month
  -- (e.g., correcting a missed earn from two months ago).
  bucket_month date not null,
  -- Source order id: text because orders.order_id is a UUID stored as
  -- text in the existing schema. No FK because cancelled orders should
  -- still leave the audit row intact.
  source_order_id text,
  source_referral_user_id uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists points_ledger_user_id_idx
  on public.points_ledger (user_id, created_at desc);

-- Active-bucket index: covers tier rollup queries that filter to
-- bucket_month within the last 12 months. Partial-index on rows whose
-- tier_delta is non-zero so we don't waste pages on pure-redemption
-- rows (which contribute nothing to tier).
create index if not exists points_ledger_tier_window_idx
  on public.points_ledger (user_id, bucket_month)
  where tier_delta <> 0;

alter table public.points_ledger enable row level security;

drop policy if exists "users_read_own_points_ledger" on public.points_ledger;
create policy "users_read_own_points_ledger"
  on public.points_ledger
  for select
  to authenticated
  using (user_id = auth.uid());

-- No INSERT / UPDATE / DELETE policy for authenticated. All writes go
-- via service role from action layer.

-- ---------- user_rewards ----------
create table if not exists public.user_rewards (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tier public.reward_tier not null default 'initiate',
  -- Sum of tier_delta over the rolling 12-month window. Recomputed.
  tier_points integer not null default 0,
  -- Sum of balance_delta over all time. Spendable.
  available_balance integer not null default 0,
  -- Lifetime sum of positive tier_delta — never decays. Used for
  -- "lifetime points earned" UI metric.
  lifetime_points_earned integer not null default 0,
  -- Cached referral metrics; cheaper than aggregating ledger every page render.
  referee_count integer not null default 0,
  referee_total_spend_cents integer not null default 0,
  -- Free-shipping-for-12-months redemption parks an expiry timestamp here.
  free_shipping_until timestamptz,
  recomputed_at timestamptz not null default now()
);

create or replace function public.user_rewards_touch_recomputed_at()
returns trigger
language plpgsql
as $$
begin
  new.recomputed_at = now();
  return new;
end;
$$;

drop trigger if exists user_rewards_set_recomputed_at on public.user_rewards;
create trigger user_rewards_set_recomputed_at
  before update on public.user_rewards
  for each row execute function public.user_rewards_touch_recomputed_at();

alter table public.user_rewards enable row level security;

drop policy if exists "users_read_own_rewards" on public.user_rewards;
create policy "users_read_own_rewards"
  on public.user_rewards
  for select
  to authenticated
  using (user_id = auth.uid());

-- ---------- vial_credits ----------
create table if not exists public.vial_credits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source public.vial_credit_source not null,
  -- Cap on the size the customer can claim; null = unrestricted (raffle
  -- "any vial" prize). 5 or 10 for redemptions per the catalog table.
  max_size_mg integer check (max_size_mg is null or max_size_mg between 1 and 200),
  issued_at timestamptz not null default now(),
  redeemed_at timestamptz,
  redeemed_order_id text,
  note text
);

create index if not exists vial_credits_user_id_idx
  on public.vial_credits (user_id, issued_at desc);

-- Partial index on outstanding (unredeemed) credits so the redemption
-- UI can list them quickly without scanning the full history.
create index if not exists vial_credits_outstanding_idx
  on public.vial_credits (user_id, issued_at desc)
  where redeemed_at is null;

alter table public.vial_credits enable row level security;

drop policy if exists "users_read_own_vial_credits" on public.vial_credits;
create policy "users_read_own_vial_credits"
  on public.vial_credits
  for select
  to authenticated
  using (user_id = auth.uid());

-- No customer-side write — issuance always service role; redemption
-- happens via a server action that updates redeemed_at + redeemed_order_id.

-- ---------- Atomic debit RPC ----------
--
-- Codex caught a TOCTOU race in the JS-level debit path: a balance
-- check followed by an INSERT can be interleaved by a concurrent
-- redemption, both passing the check and both inserting, which
-- drives `available_balance` below zero. The fix is a single
-- transaction that guards the insert on the live aggregate balance.
--
-- This RPC computes the current balance from the ledger inside the
-- same query that inserts the debit row, then either succeeds (and
-- returns the new ledger row id) or returns NULL when funds are
-- insufficient. The caller can distinguish "not enough points" from
-- a database error by the return value.
--
-- Returns the inserted row id on success, NULL when the balance is
-- below the requested debit amount.
create or replace function public.points_ledger_atomic_debit(
  p_user_id uuid,
  p_kind public.points_ledger_kind,
  p_balance_delta integer,
  p_tier_delta integer,
  p_bucket_month date,
  p_source_order_id text,
  p_source_referral_user_id uuid,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
  v_id uuid;
begin
  if p_balance_delta <= 0 then
    raise exception 'p_balance_delta must be positive (received %)', p_balance_delta;
  end if;

  -- Compute live balance under a row-level lock against any other
  -- concurrent debit on the same user. We approximate the lock by
  -- aggregating with FOR UPDATE on the user_rewards row; if the row
  -- doesn't exist yet (zero-balance new account), nothing to lock
  -- against and the balance is zero.
  perform 1
  from public.user_rewards
  where user_id = p_user_id
  for update;

  select coalesce(sum(balance_delta), 0)
    into v_balance
    from public.points_ledger
   where user_id = p_user_id;

  if v_balance < p_balance_delta then
    return null;
  end if;

  insert into public.points_ledger (
    user_id, kind, tier_delta, balance_delta, bucket_month,
    source_order_id, source_referral_user_id, note
  ) values (
    p_user_id, p_kind, -abs(p_tier_delta), -p_balance_delta, p_bucket_month,
    p_source_order_id, p_source_referral_user_id, p_note
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.points_ledger_atomic_debit(
  uuid, public.points_ledger_kind, integer, integer, date, text, uuid, text
) from public, anon, authenticated;
grant execute on function public.points_ledger_atomic_debit(
  uuid, public.points_ledger_kind, integer, integer, date, text, uuid, text
) to service_role;
