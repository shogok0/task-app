-- =============================================================================
-- 003_google_calendar.sql
-- Google OAuth token storage + task↔calendar event sync mapping.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- google_calendar_connections : one OAuth connection per user
-- -----------------------------------------------------------------------------
create table if not exists public.google_calendar_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null default 'google' check (provider = 'google'),
  google_email text,
  access_token text not null,
  refresh_token text,
  scope text,
  token_type text,
  expires_at timestamptz,
  calendar_id text not null default 'primary',
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists google_calendar_connections_last_synced_idx
  on public.google_calendar_connections (last_synced_at);
comment on table public.google_calendar_connections is
  'Per-user Google OAuth tokens + sync status for Calendar integration.';

-- -----------------------------------------------------------------------------
-- google_calendar_task_syncs : app task to Google Calendar event mapping
-- -----------------------------------------------------------------------------
create table if not exists public.google_calendar_task_syncs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  event_id text not null,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, task_id),
  unique (user_id, event_id)
);
create index if not exists google_calendar_task_syncs_user_idx
  on public.google_calendar_task_syncs (user_id, synced_at desc);
comment on table public.google_calendar_task_syncs is
  'Mapping rows to support idempotent upsert of task events.';

alter table public.google_calendar_connections enable row level security;
alter table public.google_calendar_task_syncs enable row level security;

-- Reuse shared updated_at trigger function from 002.
drop trigger if exists trg_google_calendar_connections_updated_at
  on public.google_calendar_connections;
create trigger trg_google_calendar_connections_updated_at
  before update on public.google_calendar_connections
  for each row execute function private.set_updated_at();

drop trigger if exists trg_google_calendar_task_syncs_updated_at
  on public.google_calendar_task_syncs;
create trigger trg_google_calendar_task_syncs_updated_at
  before update on public.google_calendar_task_syncs
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS policies
-- -----------------------------------------------------------------------------
drop policy if exists google_calendar_connections_select_self
  on public.google_calendar_connections;
create policy google_calendar_connections_select_self
  on public.google_calendar_connections
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists google_calendar_connections_insert_self
  on public.google_calendar_connections;
create policy google_calendar_connections_insert_self
  on public.google_calendar_connections
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists google_calendar_connections_update_self
  on public.google_calendar_connections;
create policy google_calendar_connections_update_self
  on public.google_calendar_connections
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists google_calendar_connections_delete_self
  on public.google_calendar_connections;
create policy google_calendar_connections_delete_self
  on public.google_calendar_connections
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists google_calendar_task_syncs_select_self
  on public.google_calendar_task_syncs;
create policy google_calendar_task_syncs_select_self
  on public.google_calendar_task_syncs
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists google_calendar_task_syncs_insert_self
  on public.google_calendar_task_syncs;
create policy google_calendar_task_syncs_insert_self
  on public.google_calendar_task_syncs
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists google_calendar_task_syncs_update_self
  on public.google_calendar_task_syncs;
create policy google_calendar_task_syncs_update_self
  on public.google_calendar_task_syncs
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists google_calendar_task_syncs_delete_self
  on public.google_calendar_task_syncs;
create policy google_calendar_task_syncs_delete_self
  on public.google_calendar_task_syncs
  for delete
  to authenticated
  using (user_id = (select auth.uid()));
