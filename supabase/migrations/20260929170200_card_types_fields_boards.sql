-- Configuration the owner draws: card types (Pesanan, Batch rebus, Pembelian) with custom fields,
-- boards, and versioned board graphs. Cards pin the version they started on, so a published
-- version must never change; editing a board means publishing a new version.

create type card_kind as enum ('order', 'production', 'purchase', 'custom');
create type field_type as enum (
  'text', 'number', 'money', 'date', 'datetime', 'select', 'party', 'boolean', 'formula'
);
create type version_status as enum ('draft', 'published', 'retired');

create table card_type (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspace(id) on delete cascade,
  key           text not null,
  name          text not null,                -- 'Pesanan', 'Batch rebus', 'Pembelian'
  kind          card_kind not null,           -- limits which step actions apply
  icon          text,
  unique (workspace_id, key)
);

create table field_def (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspace(id) on delete cascade,
  card_type_id  uuid not null references card_type(id) on delete cascade,
  key           text not null,
  label         jsonb not null,               -- {"id":"Ongkir","en":"Delivery cost"}
  type          field_type not null,
  config        jsonb not null default '{}'::jsonb,  -- options, formula, min/max
  required      boolean not null default false,
  sort          integer not null default 0,
  unique (card_type_id, key)
);
create index field_def_workspace_idx on field_def (workspace_id);

create table board (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references workspace(id) on delete cascade,
  card_type_id       uuid not null references card_type(id),
  name               text not null,
  sort               integer not null default 0,
  active_version_id  uuid,                    -- fk added below
  archived_at        timestamptz
);
create index board_workspace_idx on board (workspace_id) where archived_at is null;

create table board_version (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspace(id) on delete cascade,
  board_id      uuid not null references board(id) on delete cascade,
  version       integer not null,
  status        version_status not null default 'draft',
  graph         jsonb not null,               -- validated by boardGraph (zod) in packages/domain
  published_at  timestamptz,
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  unique (board_id, version)
);
create index board_version_workspace_idx on board_version (workspace_id);
alter table board add constraint board_active_version_fk
  foreign key (active_version_id) references board_version(id);

-- Once published, a version's graph is frozen and it can't go back to draft.
create function forbid_published_graph_change() returns trigger language plpgsql as $$
begin
  if old.status <> 'draft' and new.graph is distinct from old.graph then
    raise exception 'published board versions are immutable';
  end if;
  if old.status <> 'draft' and new.status = 'draft' then
    raise exception 'a published board version cannot return to draft';
  end if;
  return new;
end $$;
create trigger board_version_immutable before update on board_version
  for each row execute function forbid_published_graph_change();

create table view_config (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspace(id) on delete cascade,
  board_id      uuid not null references board(id) on delete cascade,
  type          text not null check (type in ('kanban', 'list', 'calendar', 'canvas')),
  config        jsonb not null default '{}'::jsonb
);
create index view_config_board_idx on view_config (board_id);

do $$
declare t text;
begin
  foreach t in array array['card_type', 'field_def', 'board', 'board_version', 'view_config'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select using (is_member(workspace_id))', t || '_read', t);
    execute format(
      'create policy %I on %I for all using (is_owner(workspace_id)) with check (is_owner(workspace_id))',
      t || '_owner_write', t);
  end loop;
end $$;
