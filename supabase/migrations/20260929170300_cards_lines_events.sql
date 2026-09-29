-- Records: cards (an order, a boiling batch, a purchase), their lines and their history.
-- Only the engine writes these (service role); members can read them. Card events are append-only:
-- an undo is a new event that points at the one it reverses.

create type card_status as enum ('open', 'done', 'cancelled');
create type card_event_type as enum (
  'created', 'moved', 'skipped', 'field_changed', 'action_run', 'undone', 'comment'
);

create table card (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references workspace(id) on delete cascade,
  number            integer not null,          -- human number per workspace (#012)
  board_id          uuid not null references board(id),
  board_version_id  uuid not null references board_version(id),   -- pinned version
  stage_key         text not null,
  status            card_status not null default 'open',
  title             text not null,
  party_id          uuid references party(id),
  due_at            timestamptz,
  flags             text[] not null default '{}',   -- 'urgent', 'shortage', 'preorder'
  fields            jsonb not null default '{}'::jsonb,
  parent_card_id    uuid references card(id),       -- order → its production batch, etc.
  row_version       integer not null default 1,     -- optimistic concurrency for the outbox
  created_by        uuid references auth.users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (workspace_id, number)
);
create index card_open_stage_idx on card (workspace_id, board_id, stage_key) where status = 'open';
create index card_open_due_idx on card (workspace_id, due_at) where status = 'open';
create index card_parent_idx on card (parent_card_id);

-- Order lines copy the price at order time, so later price changes don't rewrite past profit.
create table card_line (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspace(id) on delete cascade,
  card_id       uuid not null references card(id) on delete cascade,
  product_id    uuid not null references product(id),
  qty           integer not null check (qty > 0),
  unit_price    bigint not null check (unit_price >= 0)
);
create index card_line_card_idx on card_line (card_id);

create table card_event (
  id                 bigint generated always as identity primary key,
  workspace_id       uuid not null references workspace(id) on delete cascade,
  card_id            uuid references card(id) on delete cascade,
  type               card_event_type not null,
  from_stage         text,
  to_stage           text,
  payload            jsonb not null default '{}'::jsonb,
  -- Set by the client's outbox, so a retried request can't post the same move twice.
  idempotency_key    uuid,
  reverses_event_id  bigint references card_event(id),
  actor              uuid references auth.users(id),
  created_at         timestamptz not null default now()
);
create unique index card_event_idempotency_idx on card_event (workspace_id, idempotency_key)
  where idempotency_key is not null;
create index card_event_card_idx on card_event (card_id, created_at);

do $$
declare t text;
begin
  foreach t in array array['card', 'card_line', 'card_event'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select using (is_member(workspace_id))', t || '_read', t);
  end loop;
end $$;

-- History is append-only for everyone, the engine included. Deleting a whole workspace still
-- cascades, because foreign-key actions don't need these privileges.
revoke update, delete, truncate on card_event from public, anon, authenticated, service_role;
