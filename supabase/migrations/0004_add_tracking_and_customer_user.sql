-- 2026-04-25 sprint-1: tracking columns + customer ownership FK.
--
-- Adds shipment tracking metadata (tracking_number, tracking_carrier,
-- shipped_at) and a nullable customer_user_id FK to auth.users so the
-- customer portal can scope reads to "my orders". Email-based claim
-- (linkOrdersToUser) populates customer_user_id post-signup.
--
-- Rollback strategy (reversible):
--   alter table public.orders
--     drop constraint if exists orders_shipped_requires_tracking;
--   drop index if exists public.orders_customer_email_lower_idx;
--   drop index if exists public.orders_customer_user_id_idx;
--   alter table public.orders
--     drop column if exists customer_user_id,
--     drop column if exists shipped_at,
--     drop column if exists tracking_carrier,
--     drop column if exists tracking_number;

alter table public.orders
  add column if not exists tracking_number text,
  add column if not exists tracking_carrier text
    check (tracking_carrier is null
           or tracking_carrier in ('USPS','UPS','FedEx','DHL')),
  add column if not exists shipped_at timestamptz,
  add column if not exists customer_user_id uuid
    references auth.users(id) on delete set null;

-- Index for the portal query: list orders by customer
create index if not exists orders_customer_user_id_idx
  on public.orders (customer_user_id, created_at desc)
  where customer_user_id is not null;

-- Email-based claim lookup is case-insensitive
create index if not exists orders_customer_email_lower_idx
  on public.orders (lower(customer->>'email'));

-- Status transition guard: shipped requires tracking_number not null.
-- Belt-and-suspenders alongside the server action's runtime check.
alter table public.orders
  drop constraint if exists orders_shipped_requires_tracking;
alter table public.orders
  add constraint orders_shipped_requires_tracking
  check (status <> 'shipped' or tracking_number is not null);
