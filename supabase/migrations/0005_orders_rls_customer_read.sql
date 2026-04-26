-- 2026-04-25 sprint-1: customers can SELECT their own orders.
--
-- Depends on 0004_add_tracking_and_customer_user.sql, which added
-- orders.customer_user_id (uuid, FK -> auth.users(id), ON DELETE SET NULL).
--
-- This migration adds a single SELECT policy on public.orders for the
-- `authenticated` role: a row is visible iff its customer_user_id matches
-- auth.uid(). No UPDATE/DELETE policies are added — absence of policies
-- means deny-by-default for `authenticated`. Service role continues to
-- bypass RLS as it always has, so server-side admin code is unaffected.
--
-- ruo_acknowledgments INTENTIONALLY receives no policy. RLS is already
-- enabled on it (see 0001_init_orders.sql) and we want it to stay
-- service-role-only — never readable by the customer who signed it.
--
-- Rollback strategy:
--   drop policy if exists "customers_read_own_orders" on public.orders;

-- Customers read only their own rows.
drop policy if exists "customers_read_own_orders" on public.orders;
create policy "customers_read_own_orders"
  on public.orders
  for select
  to authenticated
  using (customer_user_id = auth.uid());

-- Customers cannot UPDATE or DELETE — admin / service-role only.
-- (No policy for UPDATE/DELETE = deny-by-default for `authenticated`.)
