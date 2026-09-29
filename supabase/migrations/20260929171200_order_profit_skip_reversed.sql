-- Undo reverses an expense with a new money row instead of deleting it, and allocations can't be
-- negative, so order profit must skip allocations whose expense has been reversed.

-- Profit per order: revenue from lines, HPP from sale movements (net of their reversals),
-- direct costs from allocations of expenses not reversed. All in whole rupiah.
create or replace view v_order_profit with (security_invoker = true) as
select c.workspace_id, c.id as card_id, c.number, c.title, c.status,
       coalesce(rev.revenue, 0)::bigint as revenue,
       coalesce(cogs.cogs, 0)::bigint   as cogs,
       coalesce(al.direct, 0)::bigint   as direct_costs,
       (coalesce(rev.revenue, 0) - coalesce(cogs.cogs, 0) - coalesce(al.direct, 0))::bigint as profit
from card c
join board b on b.id = c.board_id
join card_type t on t.id = b.card_type_id and t.kind = 'order'
left join lateral (
  select sum(qty::bigint * unit_price) as revenue from card_line where card_id = c.id
) rev on true
left join lateral (
  select round(sum(-m.qty * m.unit_cost)) as cogs from stock_movement m
   where m.card_id = c.id
     and (m.reason = 'sale'
          or (m.reason = 'reversal'
              and m.reverses_id in (select s.id from stock_movement s where s.card_id = c.id and s.reason = 'sale')))
) cogs on true
left join lateral (
  select sum(a.amount) as direct from cost_allocation a
   where a.card_id = c.id
     and not exists (select 1 from money_entry r where r.reverses_id = a.money_entry_id)
) al on true;
