-- Money ledger. Every rupiah in or out is one row in whole rupiah; corrections are reversal rows,
-- never edits. A cost allocation spreads an expense onto an order (delivery) or a production lot
-- (LPG) so it shows up in that order's profit or that batch's HPP. Only the engine writes these;
-- expense categories are an owner-editable list.

create type money_direction as enum ('in', 'out');
create type money_kind as enum (
  'customer_payment', 'supplier_refund', 'stock_purchase', 'expense', 'owner_draw',
  'owner_capital', 'reversal'
);
create type pay_method as enum ('cash', 'transfer', 'qris', 'credit_note', 'other');

create table expense_category (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspace(id) on delete cascade,
  key           text not null,                -- 'lpg', 'delivery', 'accommodation', 'other'
  name          text not null,
  sort          integer not null default 0,
  unique (workspace_id, key)
);

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
create index money_entry_time_idx on money_entry (workspace_id, occurred_at);
create index money_entry_card_idx on money_entry (workspace_id, card_id);

create table cost_allocation (
  id              bigint generated always as identity primary key,
  workspace_id    uuid not null references workspace(id) on delete cascade,
  money_entry_id  bigint not null references money_entry(id),
  card_id         uuid references card(id),
  lot_id          uuid references stock_lot(id),
  amount          bigint not null check (amount > 0),
  -- Exactly one target: an order or a lot.
  check ((card_id is null) <> (lot_id is null))
);
create index cost_allocation_card_idx on cost_allocation (card_id);
create index cost_allocation_lot_idx on cost_allocation (lot_id);
create index cost_allocation_entry_idx on cost_allocation (money_entry_id);

do $$
declare t text;
begin
  foreach t in array array['expense_category', 'money_entry', 'cost_allocation'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select using (is_member(workspace_id))', t || '_read', t);
  end loop;
end $$;
create policy expense_category_owner_write on expense_category for all
  using (is_owner(workspace_id)) with check (is_owner(workspace_id));

-- The money ledger is append-only for every role.
revoke update, delete, truncate on money_entry, cost_allocation
  from public, anon, authenticated, service_role;
