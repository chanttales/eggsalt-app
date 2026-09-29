-- Ledger functions. The engine calls these inside one transaction so every stock change posts its
-- movements (and money, where it applies) together. Costing matches packages/domain/src/costing.ts:
-- unit cost to 4 decimals, bonus eggs lower the unit cost, lost eggs cost nothing and their cost
-- moves onto the good eggs. They run as their owner (security definer) because lots are locked
-- with FOR UPDATE and nobody else holds UPDATE on stock_lot; only the engine may execute them.

-- Take qty out of the oldest lots first. Returns what was taken and at what cost.
create function consume_fifo(
  p_workspace uuid, p_item uuid, p_state uuid, p_qty integer,
  p_reason movement_reason, p_card uuid default null, p_event bigint default null
) returns table (lot_id uuid, qty integer, unit_cost numeric)
language plpgsql security definer set search_path = public as $$
declare
  r record;
  need integer := p_qty;
  take integer;
begin
  if p_qty is null or p_qty <= 0 then raise exception 'qty must be positive'; end if;
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

-- Receive a supplier purchase as a new lot plus the money paid. return_by comes from the
-- supplier's return_days counted from today in the workspace time zone.
create function receive_purchase(
  p_workspace uuid, p_supplier uuid, p_item uuid, p_state uuid,
  p_qty_paid integer, p_bonus integer, p_price bigint,
  p_method pay_method default 'cash', p_card uuid default null, p_event bigint default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_lot uuid;
  v_total bigint;
  v_qty integer;
  v_unit numeric;
  v_tz text;
  v_days integer;
begin
  if p_qty_paid is null or p_qty_paid <= 0 then raise exception 'paid qty must be positive'; end if;
  if coalesce(p_bonus, 0) < 0 then raise exception 'bonus qty must not be negative'; end if;
  if p_price is null or p_price < 0 then raise exception 'price must not be negative'; end if;
  v_total := p_qty_paid::bigint * p_price;
  v_qty := p_qty_paid + coalesce(p_bonus, 0);
  v_unit := round(v_total::numeric / v_qty, 4);
  select timezone into v_tz from workspace where id = p_workspace;
  select return_days into v_days from party where id = p_supplier and workspace_id = p_workspace;
  insert into stock_lot (workspace_id, item_id, state_id, source, source_card_id, supplier_id,
                         return_by, qty_in, qty_remaining, unit_cost, purchase_price)
  values (p_workspace, p_item, p_state, 'purchase', p_card, p_supplier,
          (now() at time zone coalesce(v_tz, 'Asia/Jakarta'))::date + v_days,
          v_qty, 0, v_unit, p_price)
  returning id into v_lot;
  insert into stock_movement (workspace_id, lot_id, qty, reason, unit_cost, card_id, event_id, created_by)
  values (p_workspace, v_lot, v_qty, 'purchase', v_unit, p_card, p_event, auth.uid());
  if v_total > 0 then
    insert into money_entry (workspace_id, direction, kind, amount, method, card_id, lot_id, party_id,
                             event_id, created_by)
    values (p_workspace, 'out', 'stock_purchase', v_total, p_method, p_card, v_lot, p_supplier,
            p_event, auth.uid());
  end if;
  return v_lot;
end $$;

-- Boil a batch: consume input FIFO, put good eggs in a new lot at
-- (input cost + batch cost) / good qty, and lost eggs in a zero-cost loss lot.
-- Returns the good lot (null when every egg was lost).
create function produce_batch(
  p_workspace uuid, p_item uuid, p_from_state uuid, p_to_state uuid, p_loss_state uuid,
  p_input_qty integer, p_good_qty integer, p_batch_cost bigint, p_card uuid,
  p_event bigint default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_input_cost numeric := 0;
  v_unit numeric;
  v_lot uuid;
  v_loss_lot uuid;
begin
  if p_good_qty is null or p_good_qty < 0 or p_good_qty > p_input_qty then
    raise exception 'invalid good qty';
  end if;
  if coalesce(p_batch_cost, 0) < 0 then raise exception 'batch cost must not be negative'; end if;
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

-- Return eggs from one lot to its supplier (the day-5 rule). Refund defaults to qty x price paid.
create function return_lot(
  p_workspace uuid, p_lot uuid, p_qty integer, p_refund bigint default null,
  p_method pay_method default 'cash', p_event bigint default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  l stock_lot;
  v_refund bigint;
begin
  select * into l from stock_lot where id = p_lot and workspace_id = p_workspace for update;
  if not found then raise exception 'lot not found'; end if;
  if p_qty is null or p_qty <= 0 or p_qty > l.qty_remaining then raise exception 'invalid return qty'; end if;
  if p_refund < 0 then raise exception 'refund must not be negative'; end if;
  v_refund := coalesce(p_refund, p_qty::bigint * coalesce(l.purchase_price, 0));
  insert into stock_movement (workspace_id, lot_id, qty, reason, unit_cost, event_id, created_by)
  values (p_workspace, p_lot, -p_qty, 'supplier_return', l.unit_cost, p_event, auth.uid());
  if v_refund > 0 then
    insert into money_entry (workspace_id, direction, kind, amount, method, lot_id, party_id, event_id, created_by)
    values (p_workspace, 'in', 'supplier_refund', v_refund, p_method, p_lot, l.supplier_id, p_event, auth.uid());
  end if;
end $$;

-- Engine only.
revoke execute on function
  consume_fifo(uuid, uuid, uuid, integer, movement_reason, uuid, bigint),
  receive_purchase(uuid, uuid, uuid, uuid, integer, integer, bigint, pay_method, uuid, bigint),
  produce_batch(uuid, uuid, uuid, uuid, uuid, integer, integer, bigint, uuid, bigint),
  return_lot(uuid, uuid, integer, bigint, pay_method, bigint)
  from public, anon, authenticated;
grant execute on function
  consume_fifo(uuid, uuid, uuid, integer, movement_reason, uuid, bigint),
  receive_purchase(uuid, uuid, uuid, uuid, integer, integer, bigint, pay_method, uuid, bigint),
  produce_batch(uuid, uuid, uuid, uuid, uuid, integer, integer, bigint, uuid, bigint),
  return_lot(uuid, uuid, integer, bigint, pay_method, bigint)
  to service_role;
