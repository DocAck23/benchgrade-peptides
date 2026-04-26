-- 2026-04-25 sprint-1 task-7: persist server-computed discount + total
-- on each order row alongside the existing pre-discount subtotal.
--
-- Why three columns instead of one:
--   * subtotal_cents (already exists) — pre-discount sum, kept for analytics
--   * discount_cents — Stack&Save + Same-SKU multiplier, totalled
--   * total_cents — what the customer actually owes (subtotal - discount)
--   * free_vial_entitlement — JSON {"size_mg": 5} or {"size_mg": 10} or null,
--       captured at order-time so a later catalog rule change can't retroactively
--       grant or revoke a free vial after the customer placed the order.
--
-- All math is integer cents. No floats touch the DB.
--
-- Rollback strategy (reversible):
--   alter table public.orders
--     drop column if exists free_vial_entitlement,
--     drop column if exists total_cents,
--     drop column if exists discount_cents;

alter table public.orders
  add column if not exists discount_cents integer not null default 0
    check (discount_cents >= 0),
  add column if not exists total_cents integer not null default 0
    check (total_cents >= 0),
  add column if not exists free_vial_entitlement jsonb;
