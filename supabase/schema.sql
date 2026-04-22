-- Bench Grade Peptides — Supabase schema
-- Generated 2026-04-22. Apply via `supabase db push` or `psql -f schema.sql`.

-- ---- Extensions ----
create extension if not exists "pgcrypto";   -- gen_random_uuid
create extension if not exists "citext";     -- case-insensitive email

-- ---- Categories ----
create table if not exists categories (
  slug text primary key,
  name text not null,
  internal_taxonomy_label text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ---- Products ----
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  cas_number text,
  molecular_formula text,
  molecular_weight numeric(10,4),
  sequence text,
  category_slug text not null references categories(slug) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_category_idx on products(category_slug) where is_active;

-- ---- Product variants (mg strengths) ----
create table if not exists product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  size_mg numeric(10,3) not null,
  sku text unique not null,
  wholesale_cost numeric(10,2) not null,
  retail_price numeric(10,2) not null,
  stock_on_hand int not null default 0,
  purity_percent numeric(5,2),
  coa_url text,
  lot_number text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_id, size_mg)
);
create index if not exists product_variants_product_idx on product_variants(product_id) where is_active;

-- ---- Customers ----
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  email citext unique not null,
  is_institutional boolean not null default false,
  institutional_verification_ref text,
  created_at timestamptz not null default now()
);

-- ---- RUO acknowledgments (compliance audit trail) ----
-- Every checkout creates one of these. Never delete; retention is a compliance asset.
create table if not exists ruo_acknowledgments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete set null,
  email citext not null,
  ip_address inet not null,
  user_agent text not null,
  acknowledged_at timestamptz not null default now(),
  certification_text text not null,
  certification_hash text not null   -- SHA-256 of the certification text
);
create index if not exists ruo_ack_email_idx on ruo_acknowledgments(email);
create index if not exists ruo_ack_time_idx on ruo_acknowledgments(acknowledged_at desc);

-- ---- Orders ----
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete restrict,
  order_number text unique not null,
  status text not null check (status in ('pending_payment','payment_received','processing','shipped','delivered','cancelled')),
  payment_method text not null check (payment_method in ('ach','wire','check')),
  subtotal numeric(10,2) not null,
  shipping_cost numeric(10,2) not null,
  total numeric(10,2) not null,
  ruo_acknowledgment_id uuid not null references ruo_acknowledgments(id) on delete restrict,
  shipping_address jsonb not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_customer_idx on orders(customer_id);
create index if not exists orders_status_idx on orders(status);

-- ---- Order items ----
create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  variant_id uuid not null references product_variants(id) on delete restrict,
  quantity int not null check (quantity > 0),
  unit_price numeric(10,2) not null,
  line_total numeric(10,2) not null,
  lot_number_at_fulfillment text,
  coa_url_at_fulfillment text
);
create index if not exists order_items_order_idx on order_items(order_id);

-- ---- Flag rules for suspicious order patterns ----
-- Populated by internal admin tool. Informational; doesn't auto-block.
create table if not exists order_flags (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  flag_type text not null,      -- 'residential_repeat' | 'name_mismatch' | 'quantity_spike' | 'known_address'
  detail text,
  resolved_at timestamptz,
  resolved_by text,
  created_at timestamptz not null default now()
);

-- ---- updated_at trigger helper ----
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists products_updated_at on products;
create trigger products_updated_at before update on products
  for each row execute function set_updated_at();

drop trigger if exists variants_updated_at on product_variants;
create trigger variants_updated_at before update on product_variants
  for each row execute function set_updated_at();

drop trigger if exists orders_updated_at on orders;
create trigger orders_updated_at before update on orders
  for each row execute function set_updated_at();

-- ---- Row Level Security ----
-- Products and categories: public read.
-- Customers, orders, acknowledgments: owner or admin only (session-gated).
-- Adjust policies per actual auth model as we finalize.
alter table categories enable row level security;
alter table products enable row level security;
alter table product_variants enable row level security;

create policy "public read categories" on categories for select using (true);
create policy "public read active products" on products for select using (is_active);
create policy "public read active variants" on product_variants for select using (is_active);

-- Note: no public write policies. All writes go through service-role on server.
