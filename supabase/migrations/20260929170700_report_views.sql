-- Report views. security_invoker makes each view run with the caller's rights, so the RLS on the
-- underlying tables keeps every member inside their own workspace.

-- Stock per item and state: on hand, held for orders, and free to promise.
create view v_stock_on_hand with (security_invoker = true) as
select l.workspace_id, l.item_id, l.state_id,
       sum(l.qty_remaining)::integer as on_hand,
       coalesce(r.reserved, 0)::integer as reserved,
       (sum(l.qty_remaining) - coalesce(r.reserved, 0))::integer as available
from stock_lot l
left join lateral (
  select sum(x.qty) as reserved from reservation x
   where x.workspace_id = l.workspace_id and x.item_id = l.item_id
     and x.state_id = l.state_id and x.status = 'active'
) r on true
group by l.workspace_id, l.item_id, l.state_id, r.reserved;

-- Lots that must go back to the supplier, with days left in the workspace time zone
-- (0 = today, negative = overdue).
create view v_lots_return_due with (security_invoker = true) as
select l.*, (l.return_by - (now() at time zone w.timezone)::date) as days_left
from stock_lot l
join workspace w on w.id = l.workspace_id
join item_state s on s.id = l.state_id and s.returnable
where l.qty_remaining > 0 and l.return_by is not null;

-- Profit per order: revenue from lines, HPP from sale movements (net of their reversals),
-- direct costs from allocations. All in whole rupiah.
create view v_order_profit with (security_invoker = true) as
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
  select sum(amount) as direct from cost_allocation where card_id = c.id
) al on true;
