-- Receive a purchase made on an earlier day: the lot, its return date and the payment are dated
-- that day, so FIFO order, return reminders and reports match what really happened.
drop function receive_purchase(uuid, uuid, uuid, uuid, integer, integer, bigint, pay_method, uuid, bigint);

create function receive_purchase(
  p_workspace uuid, p_supplier uuid, p_item uuid, p_state uuid,
  p_qty_paid integer, p_bonus integer, p_price bigint,
  p_method pay_method default 'cash', p_card uuid default null, p_event bigint default null,
  p_received date default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_lot uuid;
  v_total bigint;
  v_qty integer;
  v_unit numeric;
  v_tz text;
  v_days integer;
  v_today date;
  v_day date;
  v_at timestamptz;
begin
  if p_qty_paid is null or p_qty_paid <= 0 then raise exception 'paid qty must be positive'; end if;
  if coalesce(p_bonus, 0) < 0 then raise exception 'bonus qty must not be negative'; end if;
  if p_price is null or p_price < 0 then raise exception 'price must not be negative'; end if;
  select coalesce(timezone, 'Asia/Jakarta') into v_tz from workspace where id = p_workspace;
  v_today := (now() at time zone v_tz)::date;
  v_day := coalesce(p_received, v_today);
  if v_day > v_today then raise exception 'purchase date must not be in the future'; end if;
  -- Today keeps the exact time; an earlier day is recorded at noon business time.
  v_at := case when v_day = v_today then now() else (v_day + time '12:00') at time zone v_tz end;
  v_total := p_qty_paid::bigint * p_price;
  v_qty := p_qty_paid + coalesce(p_bonus, 0);
  v_unit := round(v_total::numeric / v_qty, 4);
  select return_days into v_days from party where id = p_supplier and workspace_id = p_workspace;
  insert into stock_lot (workspace_id, item_id, state_id, source, source_card_id, supplier_id,
                         received_at, return_by, qty_in, qty_remaining, unit_cost, purchase_price)
  values (p_workspace, p_item, p_state, 'purchase', p_card, p_supplier,
          v_at, v_day + v_days, v_qty, 0, v_unit, p_price)
  returning id into v_lot;
  insert into stock_movement (workspace_id, lot_id, qty, reason, unit_cost, card_id, event_id, created_by)
  values (p_workspace, v_lot, v_qty, 'purchase', v_unit, p_card, p_event, auth.uid());
  if v_total > 0 then
    insert into money_entry (workspace_id, direction, kind, amount, method, card_id, lot_id, party_id,
                             occurred_at, event_id, created_by)
    values (p_workspace, 'out', 'stock_purchase', v_total, p_method, p_card, v_lot, p_supplier,
            v_at, p_event, auth.uid());
  end if;
  return v_lot;
end $$;

-- Engine only.
revoke execute on function
  receive_purchase(uuid, uuid, uuid, uuid, integer, integer, bigint, pay_method, uuid, bigint, date)
  from public, anon, authenticated;
grant execute on function
  receive_purchase(uuid, uuid, uuid, uuid, integer, integer, bigint, pay_method, uuid, bigint, date)
  to service_role;
