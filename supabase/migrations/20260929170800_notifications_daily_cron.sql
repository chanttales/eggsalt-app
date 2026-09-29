-- Notifications and the daily job that fills them. Every morning at 07:00 WIB the job looks for
-- lots due back to the supplier (reminder on day 4, due on day 5), pre-orders to boil tomorrow,
-- and orders still unpaid after N days. dedupe_key makes each reminder appear once however often
-- the job runs. The app renders text from kind + data (i18n); title is the Indonesian fallback.

create table notification (
  id            bigint generated always as identity primary key,
  workspace_id  uuid not null references workspace(id) on delete cascade,
  user_id       uuid references auth.users(id),   -- null = all members
  kind          text not null,                    -- 'return_tomorrow', 'return_due', 'boil_h1', 'unpaid'
  title         text not null,
  body          text,
  data          jsonb not null default '{}'::jsonb,
  link          text,                             -- app route, e.g. '/stok/lot?id=…'
  due_at        timestamptz,
  dedupe_key    text,                             -- e.g. 'return_due:<lot_id>'
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);
create unique index notification_dedupe on notification (workspace_id, dedupe_key)
  where dedupe_key is not null;
create index notification_inbox_idx on notification (workspace_id, created_at desc);

alter table notification enable row level security;
create policy notification_read on notification for select
  using (is_member(workspace_id) and (user_id is null or user_id = (select auth.uid())));
create policy notification_mark_read on notification for update
  using (is_member(workspace_id) and (user_id is null or user_id = (select auth.uid())));
-- Members may only mark as read; the engine and the daily job create rows.
revoke insert, update, delete, truncate on notification from public, anon, authenticated;
grant update (read_at) on notification to authenticated;

create function daily_notifications() returns integer
language plpgsql set search_path = public as $$
declare
  n integer := 0;
  v_rows integer;
begin
  -- Day 4: remind that the lot goes back tomorrow.
  insert into notification (workspace_id, kind, title, data, link, due_at, dedupe_key)
  select l.workspace_id, 'return_tomorrow',
         format('Besok retur: %s %s', l.qty_remaining, s.name),
         jsonb_build_object('lot_id', l.id, 'qty', l.qty_remaining, 'state', s.name, 'return_by', l.return_by),
         '/stok/lot?id=' || l.id, l.return_by::timestamp at time zone w.timezone,
         'return_tomorrow:' || l.id
    from stock_lot l
    join workspace w on w.id = l.workspace_id
    join item_state s on s.id = l.state_id and s.returnable
   where l.qty_remaining > 0 and l.return_by = (now() at time zone w.timezone)::date + 1
  on conflict (workspace_id, dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics v_rows = row_count; n := n + v_rows;

  -- Day 5 (or later, if missed): the lot is due back today.
  insert into notification (workspace_id, kind, title, data, link, due_at, dedupe_key)
  select l.workspace_id, 'return_due',
         format('Retur hari ini: %s %s', l.qty_remaining, s.name),
         jsonb_build_object('lot_id', l.id, 'qty', l.qty_remaining, 'state', s.name, 'return_by', l.return_by),
         '/stok/lot?id=' || l.id, l.return_by::timestamp at time zone w.timezone,
         'return_due:' || l.id
    from stock_lot l
    join workspace w on w.id = l.workspace_id
    join item_state s on s.id = l.state_id and s.returnable
   where l.qty_remaining > 0 and l.return_by <= (now() at time zone w.timezone)::date
  on conflict (workspace_id, dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics v_rows = row_count; n := n + v_rows;

  -- H-1: open pre-orders due tomorrow need boiling today.
  insert into notification (workspace_id, kind, title, data, link, due_at, dedupe_key)
  select c.workspace_id, 'boil_h1',
         format('Rebus hari ini untuk %s (besok)', c.title),
         jsonb_build_object('card_id', c.id, 'number', c.number, 'title', c.title),
         '/kartu?id=' || c.id, c.due_at, 'boil_h1:' || c.id
    from card c
    join workspace w on w.id = c.workspace_id
   where c.status = 'open' and 'preorder' = any (c.flags)
     and (c.due_at at time zone w.timezone)::date = (now() at time zone w.timezone)::date + 1
  on conflict (workspace_id, dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics v_rows = row_count; n := n + v_rows;

  -- Orders not fully paid N days after they were made (workspace setting, default 7).
  insert into notification (workspace_id, kind, title, data, link, dedupe_key)
  select o.workspace_id, 'unpaid',
         format('Belum dibayar: %s', o.title),
         jsonb_build_object('card_id', o.card_id, 'number', o.number, 'title', o.title,
                            'owed', o.revenue - coalesce(p.paid, 0)),
         '/kartu?id=' || o.card_id, 'unpaid:' || o.card_id
    from v_order_profit o
    join card k on k.id = o.card_id
    join workspace w on w.id = o.workspace_id
    left join lateral (
      select sum(case when m.kind = 'customer_payment' then m.amount else -m.amount end) as paid
        from money_entry m
       where m.card_id = o.card_id
         and (m.kind = 'customer_payment'
              or (m.kind = 'reversal' and m.reverses_id in
                  (select x.id from money_entry x where x.card_id = o.card_id and x.kind = 'customer_payment')))
    ) p on true
   where o.status <> 'cancelled' and o.revenue > coalesce(p.paid, 0)
     and k.created_at < now() - make_interval(days => coalesce((w.settings ->> 'unpaid_after_days')::integer, 7))
  on conflict (workspace_id, dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics v_rows = row_count; n := n + v_rows;

  return n;
end $$;
revoke execute on function daily_notifications() from public, anon, authenticated;

-- 00:00 UTC = 07:00 WIB.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('daily-notifications', '0 0 * * *', 'select public.daily_notifications()');
