-- 2026-04-28: customer profile table.
--
-- Customer-editable profile info. Today the order JSON snapshots
-- whatever was typed at checkout — that's the right shape for an
-- audit trail (the address that order shipped to is whatever they
-- said at the time) but a poor source of truth for "their default
-- shipping address." This table separates the two: one row per
-- auth.users.id, customer can read/update their own row only.
--
-- The dashboard greeting reads from user_metadata.first_name (set on
-- claim and on profile-save), so this table is the canonical store
-- and user_metadata is the convenience mirror.
--
-- Rollback:
--   drop policy if exists "customers_update_own_profile" on public.profiles;
--   drop policy if exists "customers_insert_own_profile" on public.profiles;
--   drop policy if exists "customers_read_own_profile" on public.profiles;
--   drop trigger if exists profiles_set_updated_at on public.profiles;
--   drop function if exists public.profiles_touch_updated_at();
--   drop table if exists public.profiles;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_name text check (first_name is null or char_length(first_name) between 1 and 60),
  last_name  text check (last_name  is null or char_length(last_name)  between 1 and 60),
  phone      text check (phone      is null or char_length(phone)      between 1 and 40),
  institution text check (institution is null or char_length(institution) between 1 and 200),
  ship_address_1 text check (ship_address_1 is null or char_length(ship_address_1) between 1 and 200),
  ship_address_2 text check (ship_address_2 is null or char_length(ship_address_2) between 1 and 200),
  ship_city  text check (ship_city  is null or char_length(ship_city)  between 1 and 100),
  ship_state text check (ship_state is null or char_length(ship_state) between 1 and 10),
  ship_zip   text check (ship_zip   is null or ship_zip ~ '^\d{5}(-\d{4})?$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.profiles_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.profiles_touch_updated_at();

alter table public.profiles enable row level security;

-- Customers read only their own profile.
drop policy if exists "customers_read_own_profile" on public.profiles;
create policy "customers_read_own_profile"
  on public.profiles
  for select
  to authenticated
  using (user_id = auth.uid());

-- Customers can insert their own profile (first save creates the row).
drop policy if exists "customers_insert_own_profile" on public.profiles;
create policy "customers_insert_own_profile"
  on public.profiles
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- Customers can update their own profile.
drop policy if exists "customers_update_own_profile" on public.profiles;
create policy "customers_update_own_profile"
  on public.profiles
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- No DELETE policy for `authenticated` — service role only (admin
-- tooling) and on cascade from auth.users.
