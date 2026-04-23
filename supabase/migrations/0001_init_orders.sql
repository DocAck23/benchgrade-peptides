-- Bench Grade Peptides initial schema.
-- Source of truth: this file. Applied to the live project via Supabase MCP
-- as `init_orders_schema` on 2026-04-22.

create table if not exists public.orders (
  order_id uuid primary key,
  customer jsonb not null,
  items jsonb not null,
  subtotal_cents integer not null check (subtotal_cents >= 0),
  acknowledgment jsonb not null,
  status text not null default 'awaiting_wire'
    check (status in ('awaiting_wire','funded','shipped','cancelled','refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_customer_email_idx
  on public.orders ((customer->>'email'));

-- Compliance mirror: append-only duplicate of the acknowledgment block so
-- the evidentiary record survives even if the order row is deleted.
create table if not exists public.ruo_acknowledgments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(order_id) on delete set null,
  certification_text text not null,
  certification_hash text not null,
  is_adult boolean not null,
  is_researcher boolean not null,
  accepts_ruo boolean not null,
  ip text,
  user_agent text,
  acknowledged_at timestamptz not null,
  server_received_at timestamptz not null default now()
);

create index if not exists ruo_ack_hash_idx on public.ruo_acknowledgments (certification_hash);
create index if not exists ruo_ack_received_idx on public.ruo_acknowledgments (server_received_at desc);

alter table public.orders enable row level security;
alter table public.ruo_acknowledgments enable row level security;

-- No RLS policies = nothing is readable or writable except via service role,
-- which bypasses RLS. The storefront's server action uses the service-role
-- key server-side only; the anon/publishable key has no access.

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists orders_touch_updated_at on public.orders;
create trigger orders_touch_updated_at
  before update on public.orders
  for each row execute function public.touch_updated_at();
