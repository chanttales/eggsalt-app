-- Onboarding: a signed-in user creates a workspace from a template and becomes its owner. Clients
-- can't insert workspaces or members themselves, so this runs as a security definer function.
-- It copies the template's configuration only (items, states, products, prices, supplier,
-- expense categories, card types, fields, published boards); opening stock goes through the
-- engine like every other stock change.
--
-- p_options may override template defaults:
--   {"settings": {"lpg_per_batch": 1000, "expected_loss_per_batch": 2},
--    "prices": {"telur_asin_matang": {"sell": 3500, "buy": 2500}}}

create function create_workspace_from_template(
  p_name text, p_template text, p_options jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  p jsonb;
  w uuid;
  it jsonb; st jsonb; pr jsonb; sp jsonb; ec jsonb; ct jsonb; f jsonb; b jsonb;
  v_item uuid; v_state uuid; v_product uuid; v_type uuid; v_board uuid; v_version uuid;
  v_sell bigint; v_buy bigint;
begin
  if v_user is null then raise exception 'not signed in'; end if;
  if coalesce(trim(p_name), '') = '' or length(trim(p_name)) > 80 then
    raise exception 'business name must be 1 to 80 characters';
  end if;
  select payload into p from template where key = p_template and is_public;
  if not found then raise exception 'template % not found', p_template; end if;

  insert into workspace (name, settings)
  values (trim(p_name),
          coalesce(p -> 'settings', '{}'::jsonb)
            || jsonb_build_object('customer_segments', coalesce(p -> 'customer_segments', '[]'::jsonb))
            || coalesce(p_options -> 'settings', '{}'::jsonb))
  returning id into w;
  insert into member (workspace_id, user_id, role) values (w, v_user, 'owner');

  for it in select * from jsonb_array_elements(coalesce(p -> 'items', '[]'::jsonb)) loop
    insert into item (workspace_id, key, name, unit, pack_name, pack_size)
    values (w, it ->> 'key', it ->> 'name', coalesce(it ->> 'unit', 'butir'), it ->> 'pack_name',
            (it ->> 'pack_size')::integer)
    returning id into v_item;
    for st in select * from jsonb_array_elements(coalesce(it -> 'states', '[]'::jsonb)) loop
      insert into item_state (workspace_id, item_id, key, name, sellable, returnable, color, sort)
      values (w, v_item, st ->> 'key', st ->> 'name', coalesce((st ->> 'sellable')::boolean, true),
              coalesce((st ->> 'returnable')::boolean, false), st ->> 'color',
              coalesce((st ->> 'sort')::integer, 0));
    end loop;
  end loop;

  for sp in select * from jsonb_array_elements(coalesce(p -> 'suppliers', '[]'::jsonb)) loop
    insert into party (workspace_id, kind, name, return_days, bonus_per_purchase, min_purchase_qty)
    values (w, 'supplier', sp ->> 'name', (sp ->> 'return_days')::integer,
            (sp ->> 'bonus_per_purchase')::integer, (sp ->> 'min_purchase_qty')::integer);
  end loop;

  for pr in select * from jsonb_array_elements(coalesce(p -> 'products', '[]'::jsonb)) loop
    select i.id, s.id into v_item, v_state
      from item i join item_state s on s.item_id = i.id
     where i.workspace_id = w and i.key = pr ->> 'item' and s.key = pr ->> 'state';
    if v_state is null then raise exception 'template product % has no item state', pr ->> 'key'; end if;
    insert into product (workspace_id, item_id, state_id, name)
    values (w, v_item, v_state, pr ->> 'name')
    returning id into v_product;
    v_sell := coalesce((p_options #>> array['prices', pr ->> 'key', 'sell'])::bigint,
                       (pr ->> 'sell_price')::bigint);
    v_buy := coalesce((p_options #>> array['prices', pr ->> 'key', 'buy'])::bigint,
                      (pr ->> 'buy_price')::bigint);
    if v_sell is not null then
      insert into price (workspace_id, product_id, kind, unit_price) values (w, v_product, 'sell', v_sell);
    end if;
    if v_buy is not null then
      insert into price (workspace_id, product_id, kind, unit_price) values (w, v_product, 'buy', v_buy);
    end if;
  end loop;

  for ec in select * from jsonb_array_elements(coalesce(p -> 'expense_categories', '[]'::jsonb)) loop
    insert into expense_category (workspace_id, key, name, sort)
    values (w, ec ->> 'key', ec ->> 'name', coalesce((ec ->> 'sort')::integer, 0));
  end loop;

  for ct in select * from jsonb_array_elements(coalesce(p -> 'card_types', '[]'::jsonb)) loop
    insert into card_type (workspace_id, key, name, kind, icon)
    values (w, ct ->> 'key', ct ->> 'name', (ct ->> 'kind')::card_kind, ct ->> 'icon')
    returning id into v_type;
    for f in select * from jsonb_array_elements(coalesce(ct -> 'fields', '[]'::jsonb)) loop
      insert into field_def (workspace_id, card_type_id, key, label, type, config, required, sort)
      values (w, v_type, f ->> 'key', f -> 'label', (f ->> 'type')::field_type,
              coalesce(f -> 'config', '{}'::jsonb), coalesce((f ->> 'required')::boolean, false),
              coalesce((f ->> 'sort')::integer, 0));
    end loop;
  end loop;

  for b in select * from jsonb_array_elements(coalesce(p -> 'boards', '[]'::jsonb)) loop
    v_board := null;
    insert into board (workspace_id, key, card_type_id, name, sort)
    select w, b ->> 'key', t.id, b ->> 'name', coalesce((b ->> 'sort')::integer, 0)
      from card_type t where t.workspace_id = w and t.key = b ->> 'card_type'
    returning id into v_board;
    if v_board is null then raise exception 'template board % has no card type', b ->> 'key'; end if;
    insert into board_version (workspace_id, board_id, version, status, graph, published_at, created_by)
    values (w, v_board, 1, 'published', b -> 'graph', now(), v_user)
    returning id into v_version;
    update board set active_version_id = v_version where id = v_board;
  end loop;

  return w;
end $$;

revoke execute on function create_workspace_from_template(text, text, jsonb) from public, anon;
grant execute on function create_workspace_from_template(text, text, jsonb) to authenticated;
