-- 2026-04-25 sprint-3 wave A1: customer <-> admin messaging table.
--
-- Adds the `public.messages` table that captures a single-thread
-- customer/admin conversation (one thread per customer; rows are
-- chronological turns). RLS lets the customer read/insert/update only
-- their own rows. Server-side action layer enforces:
--   * INSERT sender must be 'customer' (RLS WITH CHECK already pins this)
--   * UPDATE only the `read_at` column is mutable (Postgres RLS lacks
--     per-column WITH CHECK; we whitelist columns in the action)
-- Admin writes (sender='admin') happen via service-role and bypass RLS.
--
-- Rollback strategy:
--   drop policy if exists "customers_update_own_messages_read" on public.messages;
--   drop policy if exists "customers_insert_own_messages" on public.messages;
--   drop policy if exists "customers_read_own_messages" on public.messages;
--   drop index if exists public.messages_unread_admin_idx;
--   drop index if exists public.messages_customer_user_id_idx;
--   drop table if exists public.messages;
--
-- Rollback semantics: dropping the table cascades all indexes/policies;
-- no foreign keys reference `messages`, so teardown is clean.

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  customer_user_id uuid not null references auth.users(id) on delete cascade,
  sender text not null check (sender in ('customer', 'admin')),
  body text not null check (length(body) > 0 and length(body) <= 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

-- Indexes
create index messages_customer_user_id_idx
  on public.messages (customer_user_id, created_at desc);

-- Partial index supports the unread-admin-reply badge on /account
create index messages_unread_admin_idx
  on public.messages (customer_user_id, sender, read_at)
  where sender = 'admin' and read_at is null;

-- RLS
alter table public.messages enable row level security;

-- Customers read only their own thread
create policy "customers_read_own_messages"
  on public.messages
  for select
  to authenticated
  using (customer_user_id = auth.uid());

-- Customers can insert into their own thread, only as 'customer' sender.
create policy "customers_insert_own_messages"
  on public.messages
  for insert
  to authenticated
  with check (customer_user_id = auth.uid() and sender = 'customer');

-- Customers can update rows in their own thread (for marking admin
-- replies as read). Per-column restriction (only `read_at` mutable) is
-- enforced server-side in the action layer.
create policy "customers_update_own_messages_read"
  on public.messages
  for update
  to authenticated
  using (customer_user_id = auth.uid())
  with check (customer_user_id = auth.uid());

-- No DELETE policy for `authenticated` -- service role only.
-- Admin INSERT (sender='admin') bypasses RLS via service role.
