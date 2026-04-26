-- 2026-04-25 sprint-2 wave A1: subscriptions table + RLS + orders link.
--
-- Adds the `public.subscriptions` table that captures a customer's
-- recurring stack (plan duration, payment cadence, ship cadence, items,
-- per-cycle pricing, lifecycle state). Links `public.orders` to a
-- subscription cycle via a nullable `subscription_id` FK so each shipped
-- cycle is auditable from the order side. Enables RLS with SELECT and
-- UPDATE policies for the customer's own rows; INSERT/DELETE remain
-- service-role only (deny-by-default for `authenticated`).
--
-- Reuses the `public.touch_updated_at()` trigger function defined in
-- `0001_init_orders.sql`.
--
-- Rollback strategy:
--   alter table public.orders drop column if exists subscription_id;
--   drop policy if exists "customers_update_own_subscriptions" on public.subscriptions;
--   drop policy if exists "customers_read_own_subscriptions" on public.subscriptions;
--   drop table if exists public.subscriptions;
--
-- Rollback semantics: the policies and table are torn down cleanly; the
-- subscription_id link on orders is dropped with the column. Service role
-- always bypassed RLS, so admin paths are unaffected.

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_user_id uuid not null references auth.users(id) on delete cascade,
  -- Plan terms
  plan_duration_months integer not null check (plan_duration_months in (1, 3, 6, 9, 12)),
  payment_cadence text not null check (payment_cadence in ('prepay', 'bill_pay')),
  ship_cadence text not null check (ship_cadence in ('monthly', 'quarterly', 'once')),
  -- Stack contents -- captured at signup, immutable until customer requests swap
  items jsonb not null,
  -- Per-cycle pricing
  cycle_subtotal_cents integer not null check (cycle_subtotal_cents >= 0),
  cycle_total_cents integer not null check (cycle_total_cents >= 0),
  discount_percent integer not null check (discount_percent >= 0 and discount_percent <= 50),
  -- Lifecycle
  status text not null default 'active'
    check (status in ('active', 'paused', 'cancelled', 'completed')),
  -- Timing -- NULL when not applicable (e.g., once-and-done)
  next_ship_date timestamptz,
  next_charge_date timestamptz,
  cycles_completed integer not null default 0 check (cycles_completed >= 0),
  cycles_total integer not null check (cycles_total > 0),
  -- Audit
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paused_at timestamptz,
  cancelled_at timestamptz
);

-- Constraint: bill_pay + 1mo is invalid (per spec section 4.4)
alter table public.subscriptions
  add constraint subscriptions_billpay_min_duration
  check (payment_cadence <> 'bill_pay' or plan_duration_months >= 3);

-- Indexes
create index subscriptions_customer_user_id_idx
  on public.subscriptions (customer_user_id, created_at desc);

create index subscriptions_status_next_ship_idx
  on public.subscriptions (status, next_ship_date)
  where status = 'active' and next_ship_date is not null;

-- updated_at trigger (reuses public.touch_updated_at from 0001)
create trigger subscriptions_touch_updated_at
  before update on public.subscriptions
  for each row execute function public.touch_updated_at();

-- Link orders to subscription cycles
alter table public.orders
  add column if not exists subscription_id uuid
    references public.subscriptions(id) on delete set null;

create index if not exists orders_subscription_id_idx
  on public.orders (subscription_id, created_at desc)
  where subscription_id is not null;

-- RLS
alter table public.subscriptions enable row level security;

-- Customers read only their own subscriptions
create policy "customers_read_own_subscriptions"
  on public.subscriptions
  for select
  to authenticated
  using (customer_user_id = auth.uid());

-- Customers can UPDATE their own subscription only for status changes
-- (pause / resume / cancel). The WITH CHECK clause restricts which fields
-- they can change -- but Postgres RLS doesn't have per-column check, so
-- we handle field-restriction in the server action layer (see Wave B1).
create policy "customers_update_own_subscriptions"
  on public.subscriptions
  for update
  to authenticated
  using (customer_user_id = auth.uid())
  with check (customer_user_id = auth.uid());

-- No INSERT or DELETE policies for `authenticated` -- service role only.
