-- =============================================================================
-- 004_ical_feed_tokens.sql
-- Per-user private iCal feed token for external calendar subscriptions.
-- =============================================================================

create table if not exists public.ical_feed_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token text unique not null,
  enabled boolean not null default true,
  last_accessed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.ical_feed_tokens is
  'Private token used to serve per-user iCal feed without interactive login.';

alter table public.ical_feed_tokens enable row level security;

drop trigger if exists trg_ical_feed_tokens_updated_at on public.ical_feed_tokens;
create trigger trg_ical_feed_tokens_updated_at
  before update on public.ical_feed_tokens
  for each row execute function private.set_updated_at();

drop policy if exists ical_feed_tokens_select_self on public.ical_feed_tokens;
create policy ical_feed_tokens_select_self
  on public.ical_feed_tokens
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists ical_feed_tokens_insert_self on public.ical_feed_tokens;
create policy ical_feed_tokens_insert_self
  on public.ical_feed_tokens
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists ical_feed_tokens_update_self on public.ical_feed_tokens;
create policy ical_feed_tokens_update_self
  on public.ical_feed_tokens
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists ical_feed_tokens_delete_self on public.ical_feed_tokens;
create policy ical_feed_tokens_delete_self
  on public.ical_feed_tokens
  for delete
  to authenticated
  using (user_id = (select auth.uid()));
