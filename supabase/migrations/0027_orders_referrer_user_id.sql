-- 2026-04-28: lock referral attribution on the orders row itself.
--
-- Codex caught a PRD §4.11 violation: rewards/order-hooks was
-- re-querying the referrals table at award time to find the referrer,
-- which means a retroactive admin edit (or a backdated referral row)
-- could change who earns referee-spend points on a subsequent funded
-- order — exactly what "attribution is locked at order placement"
-- forbids.
--
-- Fix: persist `referrer_user_id` on the order at placement, sourced
-- from the bgp_ref cookie. Backfill existing rows from the referrals
-- table so historical orders carry the same attribution they would
-- have inferred dynamically. Going forward, the application reads
-- this column instead of re-querying.
--
-- Backwards compat: nullable column, no NOT NULL constraint — guest
-- orders, and orders placed without a referral cookie, carry NULL.
--
-- Rollback:
--   alter table public.orders drop column if exists referrer_user_id;

alter table public.orders
  add column if not exists referrer_user_id uuid
  references auth.users(id) on delete set null;

create index if not exists orders_referrer_user_id_idx
  on public.orders (referrer_user_id, created_at desc)
  where referrer_user_id is not null;

-- Backfill: for every order that has no referrer_user_id today, look
-- up the earliest referral attribution for the customer (PRD §4.11:
-- first attribution wins) and pin it. Wrapped in DO so re-runs are
-- safe: it only updates rows still missing the column.
do $$
declare
  remaining int;
begin
  select count(*) into remaining
    from public.orders
   where referrer_user_id is null
     and customer_user_id is not null;
  if remaining = 0 then
    return;
  end if;

  with attributed as (
    select distinct on (referee_user_id)
           referee_user_id,
           referrer_user_id,
           attributed_at
      from public.referrals
     where referee_user_id is not null
     order by referee_user_id, attributed_at asc
  )
  update public.orders o
     set referrer_user_id = a.referrer_user_id
    from attributed a
   where o.referrer_user_id is null
     and o.customer_user_id = a.referee_user_id
     and a.referrer_user_id is not null;
end $$;
