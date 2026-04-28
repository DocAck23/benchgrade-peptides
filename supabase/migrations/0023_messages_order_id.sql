-- 2026-04-28: tag customer/admin messages with an optional order_id so
-- the "Speak to the team about this order" surface can attach the
-- thread turn to the order it's about. Admin views can then group or
-- filter by order without losing the single-thread model.
--
-- Why text and not a uuid: order_id is the human-facing slug
-- (e.g. BGP-893CE45D), already varchar in public.orders. A foreign key
-- against it would make admin tools unable to delete an order without
-- cascading messages — which we don't want, since the message context
-- has audit value beyond the order's lifecycle. Validated server-side.
--
-- RLS: the existing customers_read_own_messages /
-- customers_insert_own_messages policies already gate on
-- customer_user_id = auth.uid(), so adding a nullable column doesn't
-- change the security boundary. Server-side `sendCustomerMessage` is
-- responsible for asserting the order belongs to the caller before
-- accepting the order_id.
--
-- Rollback:
--   drop index if exists public.messages_order_id_idx;
--   alter table public.messages drop column if exists order_id;

alter table public.messages
  add column if not exists order_id text null;

-- Optional cap to keep payloads sane and prevent blob smuggling. Order
-- IDs are 12 chars in practice; 40 is comfortable headroom.
-- Wrapped in a DO block so re-runs (staging restores, CI rebuilds)
-- don't error on the duplicate constraint name.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'messages_order_id_len_chk'
      and conrelid = 'public.messages'::regclass
  ) then
    alter table public.messages
      add constraint messages_order_id_len_chk
      check (order_id is null or (char_length(order_id) between 1 and 40));
  end if;
end $$;

-- Partial index supports admin views ("show me all messages tagged with
-- order X"). Excludes the common null case so the index stays small.
create index if not exists messages_order_id_idx
  on public.messages (order_id, created_at desc)
  where order_id is not null;
