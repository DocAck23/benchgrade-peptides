-- Fixed-window rate limiter storage. Applied via Supabase MCP on
-- 2026-04-22 under the name `rate_limits`. Source of truth is this file.

create table if not exists public.rate_limits (
  bucket text not null,
  window_start bigint not null,
  count integer not null default 0,
  primary key (bucket, window_start)
);

create index if not exists rate_limits_window_idx on public.rate_limits (window_start);

-- Atomic "increment and return new count" — closes the TOCTOU gap between
-- SELECT and UPDATE that would let two concurrent serverless invocations
-- both see count=5 and both decide they're under the limit.
--
-- SECURITY DEFINER is needed so the service-role call path can write to
-- the RLS-locked table. `set search_path` hardens against malicious
-- search-path injection (see PG security-definer guidance).
create or replace function public.increment_rate_limit(
  p_bucket text,
  p_window_start bigint
) returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  insert into public.rate_limits (bucket, window_start, count)
  values (p_bucket, p_window_start, 1)
  on conflict (bucket, window_start)
    do update set count = public.rate_limits.count + 1
  returning count into v_count;
  return v_count;
end;
$$;

alter table public.rate_limits enable row level security;
