-- Workspaces (one per business), their members, and the helpers every row-level security policy uses.
-- Conventions for all migrations: money = bigint rupiah; unit costs = numeric(12,4); quantities =
-- integer; every business table has workspace_id for RLS; ledgers are append-only.

create extension if not exists pgcrypto;

create type member_role as enum ('owner', 'staff');

create table workspace (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  currency      text not null default 'IDR',
  timezone      text not null default 'Asia/Jakarta',
  locale        text not null default 'id-ID',
  accent_color  text,
  -- production settings, e.g. {"lpg_per_batch":1000,"expected_loss_per_batch":2,"max_batch_size":60}
  settings      jsonb not null default '{}'::jsonb,
  next_card_no  integer not null default 1,
  created_at    timestamptz not null default now()
);

create table member (
  workspace_id  uuid not null references workspace(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  role          member_role not null default 'owner',
  display_name  text,
  created_at    timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index member_user_idx on member (user_id);

-- security definer so policies can check membership without recursing into member's own policy.
create function is_member(p_workspace uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from member where workspace_id = p_workspace and user_id = (select auth.uid())
  );
$$;

create function is_owner(p_workspace uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from member
    where workspace_id = p_workspace and user_id = (select auth.uid()) and role = 'owner'
  );
$$;

alter table workspace enable row level security;
create policy workspace_read on workspace for select using (is_member(id));
create policy workspace_owner_update on workspace for update using (is_owner(id)) with check (is_owner(id));

-- Members are added by the engine (onboarding, invites); people can only see who shares their workspace.
alter table member enable row level security;
create policy member_read on member for select using (is_member(workspace_id));
