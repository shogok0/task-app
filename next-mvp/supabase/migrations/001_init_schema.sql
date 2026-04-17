-- =============================================================================
-- 001_init_schema.sql
-- Initial schema for 課題管理 (task management app).
-- Creates 7 tables, enables RLS. Policies/functions/triggers live in 002.
-- =============================================================================

create extension if not exists pgcrypto;
create schema if not exists private;

-- -----------------------------------------------------------------------------
-- profiles : public-visible user data mirrored from auth.users
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.profiles is 'Per-user profile mirrored from auth.users on signup.';

-- -----------------------------------------------------------------------------
-- groups : classes / teams
-- -----------------------------------------------------------------------------
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  invite_code text unique not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','ARCHIVED')),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.groups is 'Class/team container. invite_code is auto-generated.';

-- -----------------------------------------------------------------------------
-- group_memberships : M:N users↔groups with role + soft-leave
-- -----------------------------------------------------------------------------
create table public.group_memberships (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'MEMBER' check (role in ('MEMBER','ADMIN')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  unique (group_id, user_id)
);
create index group_memberships_user_group_idx
  on public.group_memberships (user_id, group_id);
create index group_memberships_active_idx
  on public.group_memberships (group_id) where left_at is null;
comment on table public.group_memberships is 'Active membership = left_at IS NULL. Rejoin nulls it out.';

-- -----------------------------------------------------------------------------
-- tasks : personal or group-scoped
-- -----------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete set null,
  scope_type text not null check (scope_type in ('PERSONAL','GROUP')),
  subject text,
  title text not null check (char_length(title) between 1 and 200),
  description text,
  deadline_at timestamptz not null,
  status text not null default 'OPEN' check (status in ('OPEN','ARCHIVED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint tasks_scope_consistency check (
    (scope_type = 'PERSONAL' and group_id is null and owner_user_id is not null)
    or (scope_type = 'GROUP' and group_id is not null and owner_user_id is null)
  )
);
create index tasks_owner_deadline_idx
  on public.tasks (owner_user_id, deadline_at) where deleted_at is null;
create index tasks_group_deadline_idx
  on public.tasks (group_id, deadline_at) where deleted_at is null;
create index tasks_deadline_idx
  on public.tasks (deadline_at) where deleted_at is null;
comment on table public.tasks is 'Personal (owner_user_id) or group (group_id). Soft-deleted via deleted_at.';

-- -----------------------------------------------------------------------------
-- task_submissions : per-user submission state for a task
-- -----------------------------------------------------------------------------
create table public.task_submissions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'PENDING' check (status in ('PENDING','SUBMITTED')),
  submitted_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (task_id, user_id)
);
create index task_submissions_user_status_idx
  on public.task_submissions (user_id, status);
comment on table public.task_submissions is 'One row per (task, user). GROUP tasks fan-out on create via trigger.';

-- -----------------------------------------------------------------------------
-- notification_settings : per-user preferences
-- -----------------------------------------------------------------------------
create table public.notification_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references auth.users(id) on delete cascade,
  email_enabled boolean not null default false,
  email_address text,
  remind_before_days smallint not null default 1 check (remind_before_days between 0 and 30),
  push_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.notification_settings is 'Auto-created on signup via trigger on auth.users.';

-- -----------------------------------------------------------------------------
-- notification_deliveries : audit log + dedup
-- -----------------------------------------------------------------------------
create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  channel text not null check (channel in ('EMAIL','PUSH')),
  notification_type text not null default 'DEADLINE_REMINDER'
    check (notification_type in ('DEADLINE_REMINDER')),
  scheduled_for timestamptz not null,
  status text not null default 'QUEUED'
    check (status in ('QUEUED','SENT','FAILED','SKIPPED')),
  provider_message_id text,
  error_message text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (user_id, task_id, channel, notification_type, scheduled_for)
);
create index notification_deliveries_user_sched_idx
  on public.notification_deliveries (user_id, scheduled_for);
create index notification_deliveries_queued_idx
  on public.notification_deliveries (status, scheduled_for) where status = 'QUEUED';
comment on table public.notification_deliveries is 'Send audit + dedup. UNIQUE prevents double-send.';

-- -----------------------------------------------------------------------------
-- Enable RLS on all tables. Policies live in 002.
-- -----------------------------------------------------------------------------
alter table public.profiles                enable row level security;
alter table public.groups                  enable row level security;
alter table public.group_memberships       enable row level security;
alter table public.tasks                   enable row level security;
alter table public.task_submissions        enable row level security;
alter table public.notification_settings   enable row level security;
alter table public.notification_deliveries enable row level security;
