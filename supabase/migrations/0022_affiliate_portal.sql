-- 2026-04-27 launch-sprint W6: affiliate portal (invite + 1099 + W9).
--
-- Layers a formal contractor-onboarding flow on top of the existing
-- Sprint-4 affiliate program. Three append-only tables + storage RLS
-- for the private `affiliate-w9` bucket.
--
--   * public.affiliate_invites    — one-time invite tokens generated
--                                    by the founder (admin). Consumed
--                                    on first sign-up via the link.
--   * public.affiliate_agreements — append-only e-signature ledger.
--                                    Re-signing a new version makes a
--                                    NEW row; the old one stays as
--                                    evidence.
--   * public.affiliate_w9         — W9 PDF upload ledger. The bytes
--                                    live in Storage; this table is
--                                    metadata + audit trail.
--
-- RLS lets each affiliate read their own rows; admin reads via the
-- service-role client. ALL writes go through server actions (no
-- INSERT / UPDATE / DELETE policies for `authenticated`).
--
-- Storage bucket `affiliate-w9` (private) must be created manually in
-- the Supabase dashboard before the upload flow works — see
-- docs/AFFILIATE-PORTAL-MANUAL.md. The storage.objects RLS policies
-- below are idempotent and safe to apply before the bucket exists.

create table if not exists public.affiliate_invites (
  token uuid primary key default gen_random_uuid(),
  created_by_admin boolean not null default true,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  consumed_at timestamptz,
  consumed_by_user_id uuid references auth.users(id) on delete set null,
  note text
);

create table if not exists public.affiliate_agreements (
  id uuid primary key default gen_random_uuid(),
  affiliate_user_id uuid not null references auth.users(id) on delete cascade,
  agreement_version text not null,
  signed_name text not null,
  signed_at timestamptz not null default now(),
  ip text,
  user_agent text,
  agreement_html text not null
);

create table if not exists public.affiliate_w9 (
  id uuid primary key default gen_random_uuid(),
  affiliate_user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  original_filename text not null,
  uploaded_at timestamptz not null default now(),
  ip text,
  user_agent text,
  byte_size integer not null check (byte_size > 0 and byte_size <= 5242880),
  superseded_at timestamptz
);

create index if not exists affiliate_invites_consumed_idx
  on public.affiliate_invites (consumed_at);
create index if not exists affiliate_agreements_user_idx
  on public.affiliate_agreements (affiliate_user_id, signed_at desc);
create index if not exists affiliate_w9_user_idx
  on public.affiliate_w9 (affiliate_user_id, uploaded_at desc);

alter table public.affiliate_invites enable row level security;
alter table public.affiliate_agreements enable row level security;
alter table public.affiliate_w9 enable row level security;

-- Affiliate sees their own consumed invite (rare; mostly admin-read).
drop policy if exists "invitee_reads_own_invite" on public.affiliate_invites;
create policy "invitee_reads_own_invite"
  on public.affiliate_invites
  for select
  to authenticated
  using (consumed_by_user_id = auth.uid());

-- Affiliate reads their own signed agreements.
drop policy if exists "affiliate_reads_own_agreement" on public.affiliate_agreements;
create policy "affiliate_reads_own_agreement"
  on public.affiliate_agreements
  for select
  to authenticated
  using (affiliate_user_id = auth.uid());

-- Affiliate reads their own W9 ledger rows.
drop policy if exists "affiliate_reads_own_w9" on public.affiliate_w9;
create policy "affiliate_reads_own_w9"
  on public.affiliate_w9
  for select
  to authenticated
  using (affiliate_user_id = auth.uid());

-- Storage RLS for the private `affiliate-w9` bucket. The bucket itself
-- is created out-of-band in the Supabase dashboard; these policies
-- gate object access once it exists. Path convention:
-- "affiliate-w9/<auth.uid>/<uuid>.pdf" — the second segment is the
-- owner's UUID. The service role bypasses RLS, so admin reads (via
-- getSupabaseServer) work unconditionally.

drop policy if exists "affiliate_w9_owner_select" on storage.objects;
create policy "affiliate_w9_owner_select"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'affiliate-w9'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "affiliate_w9_owner_insert" on storage.objects;
create policy "affiliate_w9_owner_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'affiliate-w9'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
