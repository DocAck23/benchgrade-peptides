-- 2026-04-29: customer-saved custom stacks (PRD-stack-builder).
--
-- Customers building a multi-vial combination on /catalogue/stacks/build
-- can save it under a name they pick and reload it next month with one
-- click. One row per (user, name) thanks to the unique index — duplicates
-- surface as a friendly error from the action layer.
--
-- The line composition lives in a JSONB blob rather than a per-line
-- table because:
--   * it's always read as a unit (load entire saved stack into the
--     builder, never query individual lines)
--   * the schema for a line is tiny ({sku, quantity}) and stable
--   * batch-updating an entire stack is one-row, atomic, no fan-out
-- Validation against the catalog happens in the action layer (Zod
-- + catalog SKU lookup); the DB stores opaque JSON.
--
-- Rollback:
--   drop policy if exists "customers_delete_own_saved_stacks" on public.saved_stacks;
--   drop policy if exists "customers_update_own_saved_stacks" on public.saved_stacks;
--   drop policy if exists "customers_insert_own_saved_stacks" on public.saved_stacks;
--   drop policy if exists "customers_read_own_saved_stacks" on public.saved_stacks;
--   drop trigger if exists saved_stacks_set_updated_at on public.saved_stacks;
--   drop function if exists public.saved_stacks_touch_updated_at();
--   drop table if exists public.saved_stacks;

create table if not exists public.saved_stacks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  -- lines: jsonb array of {sku: text, quantity: int}. Strict shape
  -- enforced by the server action; this column accepts any JSONB and
  -- relies on app-layer validation (avoids brittle CHECK on JSONB).
  lines jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Unique per-user name. A customer can't accidentally save two stacks
-- both called "Recovery" — the action layer surfaces the duplicate as
-- "You already have a stack named X" rather than a 23505.
create unique index if not exists saved_stacks_user_name_unique_idx
  on public.saved_stacks (user_id, lower(name));

create index if not exists saved_stacks_user_id_idx
  on public.saved_stacks (user_id, updated_at desc);

create or replace function public.saved_stacks_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists saved_stacks_set_updated_at on public.saved_stacks;
create trigger saved_stacks_set_updated_at
  before update on public.saved_stacks
  for each row execute function public.saved_stacks_touch_updated_at();

alter table public.saved_stacks enable row level security;

drop policy if exists "customers_read_own_saved_stacks" on public.saved_stacks;
create policy "customers_read_own_saved_stacks"
  on public.saved_stacks
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "customers_insert_own_saved_stacks" on public.saved_stacks;
create policy "customers_insert_own_saved_stacks"
  on public.saved_stacks
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "customers_update_own_saved_stacks" on public.saved_stacks;
create policy "customers_update_own_saved_stacks"
  on public.saved_stacks
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "customers_delete_own_saved_stacks" on public.saved_stacks;
create policy "customers_delete_own_saved_stacks"
  on public.saved_stacks
  for delete
  to authenticated
  using (user_id = auth.uid());
