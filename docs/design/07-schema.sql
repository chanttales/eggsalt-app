-- Business Whiteboard ("Papan") · draft schema v1 · 2026-09-29
-- Step 7 (Data Model). Target: Supabase Postgres 15+.
-- Will be split into supabase/migrations/*.sql during development.
-- Conventions: money = bigint rupiah; unit costs = numeric(12,4); quantities = integer (butir);
-- every business table has workspace_id for RLS; ledgers are append-only.

create extension if not exists pgcrypto;

-- ───────────────────────── Enums ─────────────────────────
create type member_role      as enum ('owner', 'staff');
create type party_kind       as enum ('customer', 'supplier');
create type card_kind        as enum ('order', 'production', 'purchase', 'custom');
create type card_status      as enum ('open', 'done', 'cancelled');
create type version_status   as enum ('draft', 'published', 'retired');
create type field_type       as enum ('text', 'number', 'money', 'date', 'datetime', 'select', 'party', 'boolean', 'formula');
create type card_event_type  as enum ('created', 'moved', 'skipped', 'field_changed', 'action_run', 'undone', 'comment');
create type lot_source       as enum ('opening', 'purchase', 'production', 'adjustment');
create type movement_reason  as enum ('opening', 'purchase', 'production_in', 'production_out', 'loss', 'sale', 'supplier_return', 'adjustment', 'reversal');
create type reservation_status as enum ('active', 'consumed', 'released');
create type money_direction  as enum ('in', 'out');
create type money_kind       as enum ('customer_payment', 'supplier_refund', 'stock_purchase', 'expense', 'owner_draw', 'owner_capital', 'reversal');
create type pay_method       as enum ('cash', 'transfer', 'qris', 'credit_note', 'other');

-- ───────────────────────── Tenancy ─────────────────────────
create table workspace (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  currency      text not null default 'IDR',
  timezone      text not null default 'Asia/Jakarta',
  locale        text not null default 'id-ID',
  accent_color  text,
  -- production settings (editable): {"lpg_per_batch":1000,"expected_loss_per_batch":2,"max_batch_size":60}
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

-- ───────────────────────── Lists ─────────────────────────
create table party (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references workspace(id) on delete cascade,
  kind               party_kind not null,
  name               text not null,
  segment            text,                 -- 'Warung', 'Catering', … (customer type, editable list)
  phone              text,
  address            text,
  -- supplier terms (null for customers)
  return_days        integer check (return_days >= 0),        -- 5
  bonus_per_purchase integer check (bonus_per_purchase >= 0), -- 5
  min_purchase_qty   integer check (min_purchase_qty >= 0),   -- 100
  fields             jsonb not null default '{}'::jsonb,
  archived_at        timestamptz,
  created_at         timestamptz not null default now()
);
create index on party (workspace_id, kind) where archived_at is null;

create table item (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspace(id) on delete cascade,
  name          text not null,                -- 'Telur asin bebek'
  unit          text not null default 'butir',
  pack_name     text default 'tray',
  pack_size     integer check (pack_size > 0) default 30,
  created_at    timestamptz not null default now()
);

create table item_state (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspace(id) on delete cascade,
  item_id       uuid not null references item(id) on delete cascade,
  key           text not null,                -- 'mentah' | 'matang' | 'rusak'
  name          text not null,
  sellable      boolean not null default true,
  returnable    boolean not null default false,  -- mentah: true (5-day supplier return)
  color         text,
  sort          integer not null default 0,
  unique (item_id, key)
);

create table product (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspace(id) on delete cascade,
  item_id       uuid not null references item(id),
  state_id      uuid not null references item_state(id),
  name          text not null,                -- 'Telur asin matang'
  active        boolean not null default true
);

create table price (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspace(id) on delete cascade,
  product_id    uuid not null references product(id) on delete cascade,
  kind          text not null check (kind in ('sell', 'buy')),
  segment       text,                         -- null = all customers; 'Catering' = override
  supplier_id   uuid references party(id),    -- for kind='buy'
  unit_price    bigint not null check (unit_price >= 0),
  valid_from    date not null default current_date
);
create index on price (product_id, kind, valid_from desc);

create table expense_category (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspace(id) on delete cascade,
  key           text not null,                -- 'lpg', 'delivery', 'accommodation', 'other'
  name          text not null,
  sort          integer not null default 0,
  unique (workspace_id, key)
);

-- ───────────────────────── Configuration (boards) ─────────────────────────
create table card_type (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspace(id) on delete cascade,
  key           text not null,
  name          text not null,                -- 'Pesanan', 'Batch rebus', 'Pembelian'
  kind          card_kind not null,
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

create table board (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references workspace(id) on delete cascade,
  card_type_id       uuid not null references card_type(id),
  name               text not null,
  sort               integer not null default 0,
  active_version_id  uuid,                    -- fk added below
  archived_at        timestamptz
);

create table board_version (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspace(id) on delete cascade,
  board_id      uuid not null references board(id) on delete cascade,
  version       integer not null,
  status        version_status not null default 'draft',
  graph         jsonb not null,               -- {stages[], transitions[], entry, terminal[]} validated by zod in packages/domain
  published_at  timestamptz,
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  unique (board_id, version)
);
alter table board add constraint board_active_version_fk
  foreign key (active_version_id) references board_version(id);

-- Published versions are immutable.
create function forbid_published_graph_change() returns trigger language plpgsql as $$
begin
  if old.status <> 'draft' and new.graph is distinct from old.graph then
    raise exception 'published board versions are immutable';
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

-- ───────────────────────── Records (cards) ─────────────────────────
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
create index on card (workspace_id, board_id, stage_key) where status = 'open';
create index on card (workspace_id, due_at) where status = 'open';
create index on card (parent_card_id);

create table card_line (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspace(id) on delete cascade,
  card_id       uuid not null references card(id) on delete cascade,
  product_id    uuid not null references product(id),
  qty           integer not null check (qty > 0),
  unit_price    bigint not null check (unit_price >= 0)
);
create index on card_line (card_id);

create table card_event (
  id               bigint generated always as identity primary key,
  workspace_id     uuid not null references workspace(id) on delete cascade,
  card_id          uuid references card(id) on delete cascade,
  type             card_event_type not null,
  from_stage       text,
  to_stage         text,
  payload          jsonb not null default '{}'::jsonb,
  idempotency_key  uuid,
  reverses_event_id bigint references card_event(id),
  actor            uuid references auth.users(id),
  created_at       timestamptz not null default now()
);
create unique index card_event_idem on card_event (workspace_id, idempotency_key) where idempotency_key is not null;
create index on card_event (card_id, created_at);

-- ───────────────────────── Stock ledger ─────────────────────────
create table stock_lot (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspace(id) on delete cascade,
  item_id         uuid not null references item(id),
  state_id        uuid not null references item_state(id),
  source          lot_source not null,
  source_card_id  uuid references card(id),
  supplier_id     uuid references party(id),
  received_at     timestamptz not null default now(),
  return_by       date,                         -- received date (WIB) + supplier.return_days
  qty_in          integer not null check (qty_in >= 0),
  qty_remaining   integer not null check (qty_remaining >= 0),   -- maintained by trigger only
  unit_cost       numeric(12,4) not null check (unit_cost >= 0),
  purchase_price  bigint,                       -- price paid per egg (refund basis), purchases only
  closed_at       timestamptz
);
create index lot_fifo on stock_lot (workspace_id, item_id, state_id, received_at) where qty_remaining > 0;
create index on stock_lot (workspace_id, return_by) where qty_remaining > 0 and return_by is not null;

create table stock_movement (
  id            bigint generated always as identity primary key,
  workspace_id  uuid not null references workspace(id) on delete cascade,
  lot_id        uuid not null references stock_lot(id),
  qty           integer not null check (qty <> 0),   -- + into lot, − out of lot
  reason        movement_reason not null,
  unit_cost     numeric(12,4) not null,              -- copied from lot at posting time
  card_id       uuid references card(id),
  event_id      bigint references card_event(id),
  reverses_id   bigint references stock_movement(id),
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now()
);
create index on stock_movement (lot_id);
create index on stock_movement (workspace_id, card_id);

-- Keep lot.qty_remaining in sync; the CHECK on stock_lot blocks negative stock.
create function apply_movement() returns trigger language plpgsql as $$
begin
  update stock_lot
     set qty_remaining = qty_remaining + new.qty,
         closed_at = case when qty_remaining + new.qty = 0 then now() else null end
   where id = new.lot_id;
  return new;
end $$;
create trigger stock_movement_apply after insert on stock_movement
  for each row execute function apply_movement();

create table reservation (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspace(id) on delete cascade,
  card_id       uuid not null references card(id) on delete cascade,
  item_id       uuid not null references item(id),
  state_id      uuid not null references item_state(id),
  qty           integer not null check (qty > 0),
  status        reservation_status not null default 'active',
  created_at    timestamptz not null default now()
);
create index on reservation (workspace_id, item_id, state_id) where status = 'active';

-- ───────────────────────── Money ledger ─────────────────────────
create table money_entry (
  id            bigint generated always as identity primary key,
  workspace_id  uuid not null references workspace(id) on delete cascade,
  direction     money_direction not null,
  kind          money_kind not null,
  amount        bigint not null check (amount > 0),
  method        pay_method,
  category_id   uuid references expense_category(id),
  card_id       uuid references card(id),
  lot_id        uuid references stock_lot(id),
  party_id      uuid references party(id),
  note          text,
  occurred_at   timestamptz not null default now(),
  event_id      bigint references card_event(id),
  reverses_id   bigint references money_entry(id),
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now()
);
create index on money_entry (workspace_id, occurred_at);
create index on money_entry (workspace_id, card_id);

-- Spreads an expense onto orders (delivery trip) or production lots (LPG).
create table cost_allocation (
  id              bigint generated always as identity primary key,
  workspace_id    uuid not null references workspace(id) on delete cascade,
  money_entry_id  bigint not null references money_entry(id),
  card_id         uuid references card(id),
  lot_id          uuid references stock_lot(id),
  amount          bigint not null check (amount > 0),
  check ((card_id is null) <> (lot_id is null))
);
create index on cost_allocation (card_id);
create index on cost_allocation (lot_id);

-- ───────────────────────── Notifications & templates ─────────────────────────
create table notification (
  id            bigint generated always as identity primary key,
  workspace_id  uuid not null references workspace(id) on delete cascade,
  user_id       uuid references auth.users(id),   -- null = all members
  kind          text not null,                    -- 'return_due', 'return_tomorrow', 'boil_h1', 'unpaid', 'low_stock'
  title         text not null,
  body          text,
  link          text,                             -- app route, e.g. '/stok/lot?id=…'
  due_at        timestamptz,
  dedupe_key    text,                             -- e.g. 'return_due:<lot_id>'
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);
create unique index notification_dedupe on notification (workspace_id, dedupe_key) where dedupe_key is not null;

create table template (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,               -- 'telur-asin'
  name        text not null,
  payload     jsonb not null,                     -- items, states, products, prices, card types, boards, categories
  is_public   boolean not null default true
);

-- ───────────────────────── Ledger functions ─────────────────────────
-- Called by the engine Edge Function inside one transaction.

-- Take qty out of the oldest lots first. Returns what was taken and at what cost.
create function consume_fifo(
  p_workspace uuid, p_item uuid, p_state uuid, p_qty integer,
  p_reason movement_reason, p_card uuid default null, p_event bigint default null
) returns table (lot_id uuid, qty integer, unit_cost numeric)
language plpgsql as $$
declare
  r record;
  need integer := p_qty;
  take integer;
begin
  if p_qty <= 0 then raise exception 'qty must be positive'; end if;
  for r in
    select l.id, l.qty_remaining, l.unit_cost from stock_lot l
     where l.workspace_id = p_workspace and l.item_id = p_item and l.state_id = p_state
       and l.qty_remaining > 0
     order by l.received_at, l.id
     for update
  loop
    exit when need = 0;
    take := least(need, r.qty_remaining);
    insert into stock_movement (workspace_id, lot_id, qty, reason, unit_cost, card_id, event_id, created_by)
    values (p_workspace, r.id, -take, p_reason, r.unit_cost, p_card, p_event, auth.uid());
    lot_id := r.id; qty := take; unit_cost := r.unit_cost;
    return next;
    need := need - take;
  end loop;
  if need > 0 then
    raise exception 'insufficient stock: short by %', need using errcode = 'P0001';
  end if;
end $$;

-- Receive a supplier purchase: bonus eggs lower the unit cost; return_by from supplier terms.
create function receive_purchase(
  p_workspace uuid, p_supplier uuid, p_item uuid, p_state uuid,
  p_qty_paid integer, p_bonus integer, p_price bigint,
  p_method pay_method default 'cash', p_card uuid default null, p_event bigint default null
) returns uuid
language plpgsql as $$
declare
  v_lot uuid;
  v_total bigint := p_qty_paid::bigint * p_price;
  v_qty integer := p_qty_paid + coalesce(p_bonus, 0);
  v_tz text;
  v_days integer;
begin
  select timezone into v_tz from workspace where id = p_workspace;
  select return_days into v_days from party where id = p_supplier;
  insert into stock_lot (workspace_id, item_id, state_id, source, source_card_id, supplier_id,
                         return_by, qty_in, qty_remaining, unit_cost, purchase_price)
  values (p_workspace, p_item, p_state, 'purchase', p_card, p_supplier,
          case when v_days is null then null else (now() at time zone v_tz)::date + v_days end,
          v_qty, 0, round(v_total::numeric / v_qty, 4), p_price)
  returning id into v_lot;
  insert into stock_movement (workspace_id, lot_id, qty, reason, unit_cost, card_id, event_id, created_by)
  values (p_workspace, v_lot, v_qty, 'purchase', round(v_total::numeric / v_qty, 4), p_card, p_event, auth.uid());
  insert into money_entry (workspace_id, direction, kind, amount, method, card_id, lot_id, party_id, event_id, created_by)
  values (p_workspace, 'out', 'stock_purchase', v_total, p_method, p_card, v_lot, p_supplier, p_event, auth.uid());
  return v_lot;
end $$;

-- Boil: consume input (FIFO), create output lot at (input cost + batch costs) / good qty, loss lot at zero cost.
create function produce_batch(
  p_workspace uuid, p_item uuid, p_from_state uuid, p_to_state uuid, p_loss_state uuid,
  p_input_qty integer, p_good_qty integer, p_batch_cost bigint, p_card uuid, p_event bigint default null
) returns uuid
language plpgsql as $$
declare
  v_input_cost numeric := 0;
  v_unit numeric;
  v_lot uuid;
  v_loss_lot uuid;
begin
  if p_good_qty < 0 or p_good_qty > p_input_qty then raise exception 'invalid good qty'; end if;
  select coalesce(sum(c.qty * c.unit_cost), 0) into v_input_cost
    from consume_fifo(p_workspace, p_item, p_from_state, p_input_qty, 'production_out', p_card, p_event) c;
  v_unit := case when p_good_qty = 0 then 0
                 else round((v_input_cost + coalesce(p_batch_cost, 0)) / p_good_qty, 4) end;
  if p_good_qty > 0 then
    insert into stock_lot (workspace_id, item_id, state_id, source, source_card_id, qty_in, qty_remaining, unit_cost)
    values (p_workspace, p_item, p_to_state, 'production', p_card, p_good_qty, 0, v_unit)
    returning id into v_lot;
    insert into stock_movement (workspace_id, lot_id, qty, reason, unit_cost, card_id, event_id, created_by)
    values (p_workspace, v_lot, p_good_qty, 'production_in', v_unit, p_card, p_event, auth.uid());
  end if;
  if p_input_qty > p_good_qty then
    insert into stock_lot (workspace_id, item_id, state_id, source, source_card_id, qty_in, qty_remaining, unit_cost)
    values (p_workspace, p_item, p_loss_state, 'production', p_card, p_input_qty - p_good_qty, 0, 0)
    returning id into v_loss_lot;
    insert into stock_movement (workspace_id, lot_id, qty, reason, unit_cost, card_id, event_id, created_by)
    values (p_workspace, v_loss_lot, p_input_qty - p_good_qty, 'loss', 0, p_card, p_event, auth.uid());
  end if;
  return v_lot;
end $$;

-- Return unboiled eggs from a specific lot to the supplier (day-5 rule). Refund defaults to qty × price paid.
create function return_lot(
  p_workspace uuid, p_lot uuid, p_qty integer, p_refund bigint default null,
  p_method pay_method default 'cash', p_event bigint default null
) returns void
language plpgsql as $$
declare l stock_lot;
begin
  select * into l from stock_lot where id = p_lot and workspace_id = p_workspace for update;
  if not found then raise exception 'lot not found'; end if;
  if p_qty <= 0 or p_qty > l.qty_remaining then raise exception 'invalid return qty'; end if;
  insert into stock_movement (workspace_id, lot_id, qty, reason, unit_cost, event_id, created_by)
  values (p_workspace, p_lot, -p_qty, 'supplier_return', l.unit_cost, p_event, auth.uid());
  insert into money_entry (workspace_id, direction, kind, amount, method, lot_id, party_id, event_id, created_by)
  values (p_workspace, 'in', 'supplier_refund', coalesce(p_refund, p_qty::bigint * coalesce(l.purchase_price, 0)),
          p_method, p_lot, l.supplier_id, p_event, auth.uid());
end $$;

-- ───────────────────────── Report views ─────────────────────────
create view v_stock_on_hand with (security_invoker = true) as
select l.workspace_id, l.item_id, l.state_id,
       sum(l.qty_remaining)::integer as on_hand,
       coalesce((select sum(r.qty) from reservation r
                  where r.workspace_id = l.workspace_id and r.item_id = l.item_id
                    and r.state_id = l.state_id and r.status = 'active'), 0)::integer as reserved
from stock_lot l
group by l.workspace_id, l.item_id, l.state_id;

create view v_lots_return_due with (security_invoker = true) as
select l.*, (l.return_by - (now() at time zone w.timezone)::date) as days_left
from stock_lot l
join workspace w on w.id = l.workspace_id
join item_state s on s.id = l.state_id and s.returnable
where l.qty_remaining > 0 and l.return_by is not null;

-- Profit per order: revenue from lines, HPP from sale movements, direct costs from allocations.
create view v_order_profit with (security_invoker = true) as
select c.workspace_id, c.id as card_id, c.number, c.title, c.status,
       coalesce(rev.revenue, 0) as revenue,
       coalesce(cogs.cogs, 0)   as cogs,
       coalesce(al.direct, 0)   as direct_costs,
       coalesce(rev.revenue, 0) - coalesce(cogs.cogs, 0) - coalesce(al.direct, 0) as profit
from card c
join board b on b.id = c.board_id
join card_type t on t.id = b.card_type_id and t.kind = 'order'
left join lateral (select sum(qty::bigint * unit_price) as revenue from card_line where card_id = c.id) rev on true
left join lateral (select round(sum(-qty * unit_cost))::bigint as cogs from stock_movement
                    where card_id = c.id and reason = 'sale') cogs on true
left join lateral (select sum(amount) as direct from cost_allocation where card_id = c.id) al on true;

-- ───────────────────────── Row-level security ─────────────────────────
create function is_member(p_workspace uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from member where workspace_id = p_workspace and user_id = auth.uid());
$$;
create function is_owner(p_workspace uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from member where workspace_id = p_workspace and user_id = auth.uid() and role = 'owner');
$$;

do $$
declare t text;
begin
  -- Read access for members on every workspace table.
  foreach t in array array['member','party','item','item_state','product','price','expense_category',
                           'card_type','field_def','board','board_version','view_config','card','card_line',
                           'card_event','stock_lot','stock_movement','reservation','money_entry',
                           'cost_allocation','notification']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select using (is_member(workspace_id))', t || '_read', t);
  end loop;
  -- Owners may edit configuration and lists directly. Cards, ledgers and events are written only by the engine (service role).
  foreach t in array array['party','item','item_state','product','price','expense_category',
                           'card_type','field_def','board','board_version','view_config']
  loop
    execute format('create policy %I on %I for all using (is_owner(workspace_id)) with check (is_owner(workspace_id))', t || '_owner_write', t);
  end loop;
end $$;

alter table workspace enable row level security;
create policy workspace_read on workspace for select using (is_member(id));
create policy workspace_owner_update on workspace for update using (is_owner(id));
create policy notification_mark_read on notification for update using (is_member(workspace_id));

-- Ledger tables are append-only even for the engine.
revoke update, delete on stock_movement, money_entry, card_event, cost_allocation from public;
