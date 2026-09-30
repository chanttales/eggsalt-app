-- Past sales entered late. A card can carry the day the order really happened; while it is being
-- entered (same business day it was created), the stock and money rows it writes are dated that
-- day, so stock, Uang and Laporan show the sale on the right day. Rows written on later days keep
-- their real time (for example a payment that actually arrives today).
alter table card add column ordered_on date;

create function date_rows_to_order_day() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_on date;
  v_created timestamptz;
  v_tz text;
  v_today date;
  v_at timestamptz;
begin
  if new.card_id is null then return new; end if;
  select c.ordered_on, c.created_at, coalesce(w.timezone, 'Asia/Jakarta')
    into v_on, v_created, v_tz
    from card c join workspace w on w.id = c.workspace_id
   where c.id = new.card_id;
  v_today := (now() at time zone v_tz)::date;
  if v_on is null or v_on >= v_today or (v_created at time zone v_tz)::date <> v_today then
    return new;
  end if;
  v_at := (v_on + time '12:00') at time zone v_tz;
  if tg_table_name = 'stock_movement' then
    new.created_at := v_at;
  elsif (new.occurred_at at time zone v_tz)::date = v_today then
    -- Only entries dated today move; an entry given its own date keeps it.
    new.occurred_at := v_at;
  end if;
  return new;
end $$;

create trigger stock_movement_order_day before insert on stock_movement
  for each row execute function date_rows_to_order_day();
create trigger money_entry_order_day before insert on money_entry
  for each row execute function date_rows_to_order_day();
