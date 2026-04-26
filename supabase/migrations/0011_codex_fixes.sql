-- 2026-04-25 codex review #3 fixes:
-- 1. Allow null customer_user_id on subscriptions (guest checkout creates the
--    subscription before magic-link claim binds the auth user)
-- 2. Drop overly-broad UPDATE policies that allowed customers to mutate any
--    column on their owned rows. Switch all customer-facing writes to
--    service-role-via-server-action with explicit ownership verification.
-- 3. Drop INSERT policy on messages that allowed customers to insert with
--    any payload (sender field could be forged); INSERTs route through
--    sendCustomerMessage which uses service-role with sender='customer' fixed.
--
-- Rollback strategy:
--   alter table public.subscriptions alter column customer_user_id set not null;
--   create policy "customers_update_own_subscriptions" on public.subscriptions
--     for update to authenticated
--     using (customer_user_id = auth.uid())
--     with check (customer_user_id = auth.uid());
--   create policy "customers_update_own_messages_read" on public.messages
--     for update to authenticated
--     using (customer_user_id = auth.uid())
--     with check (customer_user_id = auth.uid());
--   create policy "customers_insert_own_messages" on public.messages
--     for insert to authenticated
--     with check (customer_user_id = auth.uid() and sender = 'customer');
--
-- Rollback semantics: customer-facing writes will once again hit RLS with
-- per-row UPDATE permission. The server-action layer continues to enforce
-- explicit ownership filters either way; this migration tightens defense in
-- depth so a future bug in the action layer cannot silently mutate fields
-- the customer should not control.

alter table public.subscriptions
  alter column customer_user_id drop not null;

drop policy if exists "customers_update_own_subscriptions" on public.subscriptions;
drop policy if exists "customers_update_own_messages_read" on public.messages;
drop policy if exists "customers_insert_own_messages" on public.messages;
