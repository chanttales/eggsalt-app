-- Stock ledger. A lot is one batch of eggs in one state (a delivery from the supplier, the good eggs
-- of a boiling batch). Every change is a movement row; a trigger keeps the lot's remaining qty in
-- sync and the CHECK on that column makes negative stock impossible. Reservations hold stock for
-- orders so "available" = on hand - active reservations. Only the engine writes here.

create type lot_source as enum ('opening', 'purchase', 'production', 'adjustment');
create type movement_reason as enum (
  'opening', 'purchase', 'production_in', 'production_out', 'loss', 'sale',
  'supplier_return', 'adjustment', 'reversal'
);
create type reservation_status as enum ('active', 'consumed', 'released');

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
create index stock_lot_fifo_idx on stock_lot (workspace_id, item_id, state_id, received_at)
  where qty_remaining > 0;
create index stock_lot_return_idx on stock_lot (workspace_id, return_by)
  where qty_remaining > 0 and return_by is not null;

create table stock_movement (
  id            bigint generated always as identity primary key,
  workspace_id  uuid not null references workspace(id) on delete cascade,
  lot_id        uuid not null references stock_lot(id),
  qty           integer not null check (qty <> 0),   -- + into lot, - out of lot
  reason        movement_reason not null,
  unit_cost     numeric(12,4) not null,              -- copied from lot at posting time
  card_id       uuid references card(id),
  event_id      bigint references card_event(id),
  reverses_id   bigint references stock_movement(id),
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now()
);
create index stock_movement_lot_idx on stock_movement (lot_id);
create index stock_movement_card_idx on stock_movement (workspace_id, card_id);

-- security definer: callers can't update stock_lot themselves, only through a movement.
create function apply_movement() returns trigger
language plpgsql security definer set search_path = public as $$
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
create index reservation_active_idx on reservation (workspace_id, item_id, state_id)
  where status = 'active';

do $$
declare t text;
begin
  foreach t in array array['stock_lot', 'stock_movement', 'reservation'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select using (is_member(workspace_id))', t || '_read', t);
  end loop;
end $$;

-- Movements are append-only and lots change only through movements, for every role.
revoke update, delete, truncate on stock_movement from public, anon, authenticated, service_role;
revoke update, delete, truncate on stock_lot from public, anon, authenticated, service_role;
