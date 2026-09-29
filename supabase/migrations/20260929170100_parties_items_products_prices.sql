-- Lists the owner edits directly: customers and suppliers, stocked items and their states
-- (mentah / matang / rusak), products sold or bought, and dated prices.

create type party_kind as enum ('customer', 'supplier');

create table party (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references workspace(id) on delete cascade,
  kind               party_kind not null,
  name               text not null,
  segment            text,                 -- customer type, e.g. 'Warung', 'Catering'
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
create index party_workspace_kind_idx on party (workspace_id, kind) where archived_at is null;

create table item (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspace(id) on delete cascade,
  name          text not null,                -- 'Telur asin bebek'
  unit          text not null default 'butir',
  pack_name     text default 'tray',
  pack_size     integer check (pack_size > 0) default 30,
  created_at    timestamptz not null default now()
);
create index item_workspace_idx on item (workspace_id);

create table item_state (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspace(id) on delete cascade,
  item_id       uuid not null references item(id) on delete cascade,
  key           text not null,                -- 'mentah' | 'matang' | 'rusak'
  name          text not null,
  sellable      boolean not null default true,
  returnable    boolean not null default false, -- mentah: true (day-5 supplier return)
  color         text,
  sort          integer not null default 0,
  unique (item_id, key)
);
create index item_state_workspace_idx on item_state (workspace_id);

create table product (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspace(id) on delete cascade,
  item_id       uuid not null references item(id),
  state_id      uuid not null references item_state(id),
  name          text not null,                -- 'Telur asin matang'
  active        boolean not null default true
);
create index product_workspace_idx on product (workspace_id);

-- Prices are dated so a change never rewrites past orders (order lines copy the price anyway).
create table price (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspace(id) on delete cascade,
  product_id    uuid not null references product(id) on delete cascade,
  kind          text not null check (kind in ('sell', 'buy')),
  segment       text,                         -- null = all customers; 'Catering' = override
  supplier_id   uuid references party(id),    -- for kind = 'buy'
  unit_price    bigint not null check (unit_price >= 0),
  valid_from    date not null default current_date
);
create index price_lookup_idx on price (product_id, kind, valid_from desc);
create index price_workspace_idx on price (workspace_id);

do $$
declare t text;
begin
  foreach t in array array['party', 'item', 'item_state', 'product', 'price'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select using (is_member(workspace_id))', t || '_read', t);
    execute format(
      'create policy %I on %I for all using (is_owner(workspace_id)) with check (is_owner(workspace_id))',
      t || '_owner_write', t);
  end loop;
end $$;
