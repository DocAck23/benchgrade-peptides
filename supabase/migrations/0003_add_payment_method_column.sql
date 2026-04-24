-- 2026-04-24 launch: payment methods are first-class on orders.
-- Wire, ACH, Zelle, Crypto — no card processor in launch scope.
-- Status rename: awaiting_wire -> awaiting_payment (generic inbox
-- state for all methods). Legacy value kept in the check constraint
-- so any pre-rename row still reads out of the admin dashboard.

alter table public.orders
  drop constraint if exists orders_status_check;

alter table public.orders
  add constraint orders_status_check
  check (status in (
    'awaiting_payment',
    'awaiting_wire',  -- legacy compatibility; new rows use awaiting_payment
    'funded',
    'shipped',
    'cancelled',
    'refunded'
  ));

alter table public.orders
  add column if not exists payment_method text;

alter table public.orders
  drop constraint if exists orders_payment_method_check;

alter table public.orders
  add constraint orders_payment_method_check
  check (payment_method in ('wire', 'ach', 'zelle', 'crypto') or payment_method is null);

create index if not exists orders_payment_method_idx
  on public.orders (payment_method);
