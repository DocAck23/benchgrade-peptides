-- 2026-04-28: sequential invoice numbers on orders.
--
-- Every order gets a parallel `invoice_number` that increments by 1
-- per insert. We start the sequence at 196 (founder's call: orders
-- 1–195 will be backfilled with 196..N+195 in created_at order so
-- early customers see invoice numbers that read like the business
-- has been around). The order_id slug (BGP-XXXX) stays the customer-
-- facing identifier; invoice_number is parallel for accounting.
--
-- Safety: the sequence and column are added together so future
-- INSERTs into orders never miss an invoice number — the column
-- default calls nextval(). Existing rows are backfilled in a single
-- UPDATE that walks created_at chronologically. The column is then
-- declared NOT NULL once the backfill lands.
--
-- Rollback:
--   alter table public.orders drop column if exists invoice_number;
--   drop sequence if exists public.orders_invoice_seq;

create sequence if not exists public.orders_invoice_seq
  as bigint
  minvalue 196
  start with 196
  increment by 1
  no cycle;

alter table public.orders
  add column if not exists invoice_number bigint;

-- Backfill: assign sequential invoice numbers in order of creation.
-- Wrapped in a DO block so re-runs (CI rebuilds, staging restores)
-- don't double-bump the sequence — only fires while there are still
-- rows lacking an invoice_number.
--
-- Codex caught a subtle bug here on review: the original draft used
-- `set invoice_number = nextval(...)` inside the UPDATE, which
-- consumed sequence values but in heap/planner order — Postgres
-- doesn't guarantee a join with a CTE visits rows in the CTE's
-- output order. The fix derives the value deterministically from
-- the CTE's row_number (so historical orders get 196, 197, 198, …
-- in created_at order) and we then setval() the sequence to align
-- so future INSERTs continue cleanly from the next number.
do $$
declare
  remaining int;
  highest bigint;
begin
  select count(*) into remaining from public.orders where invoice_number is null;
  if remaining > 0 then
    with ordered as (
      select order_id,
             row_number() over (order by created_at, order_id) as rn
        from public.orders
       where invoice_number is null
    )
    update public.orders o
       set invoice_number = 195 + ordered.rn
      from ordered
     where o.order_id = ordered.order_id;
  end if;

  -- Realign the sequence so the next nextval() returns one past the
  -- highest invoice number now in the table. is_called=true so the
  -- next nextval() advances and returns highest+1; if the table is
  -- empty after backfill we leave the sequence at its initial 196.
  select max(invoice_number) into highest from public.orders;
  if highest is not null then
    perform setval('public.orders_invoice_seq', highest, true);
  end if;
end $$;

-- Now lock down: every row has a number, and the sequence keeps
-- producing the next one for new inserts.
alter table public.orders
  alter column invoice_number set default nextval('public.orders_invoice_seq');

alter table public.orders
  alter column invoice_number set not null;

-- Uniqueness — defensive: the sequence guarantees no collision today,
-- but a future copy/paste insert that supplies its own value
-- shouldn't be able to clobber another row's invoice number.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_invoice_number_unique'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_invoice_number_unique unique (invoice_number);
  end if;
end $$;
