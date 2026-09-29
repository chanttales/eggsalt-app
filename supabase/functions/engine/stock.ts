// Stock actions on stage entry: reserve, release and move. Moves go through the ledger functions
// (consume_fifo, produce_batch), so lots, FIFO order and unit costs stay the database's job.

import { type CardRow, stockReader } from "./cards.ts";
import { type CardData, resolveValue, type Stage } from "./domain.ts";
import { EngineError } from "./http.ts";
import type { OpContext } from "./ops.ts";

type Action = Stage["onEnter"][number];
type ReserveAction = Extract<Action, { action: "reserve_stock" }>;
type ReleaseAction = Extract<Action, { action: "release_reservation" }>;
type MoveAction = Extract<Action, { action: "move_stock" }>;
type MoneyAction = Extract<Action, { action: "record_money" }>;

const LEDGER_REASON = {
  sale: "sale",
  production_out: "production_out",
  damage: "loss",
  adjust: "adjustment",
} as const;

interface ItemState {
  itemId: string;
  stateId: string;
}

/** Finds the item state a graph names; the item key may be left out when only one item has it. */
async function itemState(
  { tx, workspaceId }: OpContext,
  item: string | undefined,
  state: string,
): Promise<ItemState> {
  const rows = await tx<ItemState[]>`
    select i.id as "itemId", s.id as "stateId"
      from item_state s join item i on i.id = s.item_id
     where s.workspace_id = ${workspaceId} and s.key = ${state}
       and (${item ?? null}::text is null or i.key = ${item ?? null})`;
  const [found] = rows;
  if (!found)
    throw new EngineError("not_found", `Stock state ${item ? `${item}.` : ""}${state} not found`);
  if (rows.length > 1) {
    throw new EngineError("bad_request", `Several items have a ${state} state; name the item`);
  }
  return found;
}

/** Resolves a quantity such as {{lines.qty}} to a whole number. */
function quantity(value: number | string, data: CardData, allowZero = false): number {
  const qty = resolveValue(value, data);
  if (typeof qty !== "number" || !Number.isInteger(qty) || qty < 0 || (qty === 0 && !allowZero)) {
    throw new EngineError("conflict", `Quantity ${String(value)} is missing or not a whole number`);
  }
  return qty;
}

function amount(action: MoneyAction, data: CardData): number {
  const value = resolveValue(action.amount, data);
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new EngineError("conflict", `Amount ${String(action.amount)} is missing`);
  }
  return value;
}

async function setShortage(ctx: OpContext, card: CardRow, short: boolean): Promise<void> {
  const flags = short
    ? [...new Set([...card.flags, "shortage"])]
    : card.flags.filter((f) => f !== "shortage");
  await ctx.tx`
    update card set flags = ${flags}, row_version = row_version + 1, updated_at = now()
     where id = ${card.id}`;
}

export async function reserve(
  ctx: OpContext,
  card: CardRow,
  data: CardData,
  action: ReserveAction,
): Promise<Record<string, unknown>> {
  const { itemId, stateId } = await itemState(ctx, action.item, action.state);
  const qty = quantity(action.qty, data);
  const available = (await stockReader(ctx))({ item: action.item, state: action.state });
  // A pre-order is taken even when stock is short: the reservation shows what must be bought.
  const [row] = await ctx.tx<{ id: string }[]>`
    insert into reservation (workspace_id, card_id, item_id, state_id, qty)
    values (${ctx.workspaceId}, ${card.id}, ${itemId}, ${stateId}, ${qty})
    returning id`;
  const short = available < qty;
  await setShortage(ctx, card, short);
  return { reservationId: row?.id, state: action.state, qty, available, short };
}

export async function release(
  ctx: OpContext,
  card: CardRow,
  action: ReleaseAction,
): Promise<Record<string, unknown>> {
  const stateId = action.state ? (await itemState(ctx, undefined, action.state)).stateId : null;
  const rows = await ctx.tx<{ id: string }[]>`
    update reservation set status = 'released'
     where card_id = ${card.id} and status = 'active'
       and (${stateId}::uuid is null or state_id = ${stateId})
    returning id`;
  return { released: rows.map((r) => r.id) };
}

/** Stock this card may take: free stock plus what it reserved itself. */
async function checkTakeable(
  ctx: OpContext,
  card: CardRow,
  action: MoveAction,
  target: ItemState,
  qty: number,
): Promise<void> {
  const free = (await stockReader(ctx))({ item: action.item, state: action.state });
  const [own] = await ctx.tx<{ qty: number }[]>`
    select coalesce(sum(qty), 0)::integer as qty from reservation
     where card_id = ${card.id} and status = 'active'
       and item_id = ${target.itemId} and state_id = ${target.stateId}`;
  const takeable = free + (own?.qty ?? 0);
  if (qty > takeable) {
    throw new EngineError(
      "conflict",
      `Only ${Math.max(takeable, 0)} ${action.state} available; the rest is reserved or missing`,
    );
  }
}

/** The batch move (production_out to a state) a damaged-egg move belongs to, if any. */
export function batchOf(stage: Stage, action: MoveAction): number | undefined {
  if (action.reason !== "damage" || !action.toState) return undefined;
  const i = stage.onEnter.findIndex(
    (other) =>
      other.action === "move_stock" &&
      other.reason === "production_out" &&
      other.toState !== undefined &&
      other.state === action.state &&
      other.item === action.item,
  );
  return i === -1 ? undefined : i;
}

/**
 * Moves stock out of a state, or from one state to another. A production_out move with a target
 * state is a boiling batch: damaged-egg moves and card-allocated expenses in the same stage join
 * it, so good eggs carry the whole batch cost (input + LPG) as in the PRD's HPP table.
 * Returns what it did, and the indexes of sibling actions it handled.
 */
export async function moveStock(
  ctx: OpContext,
  card: CardRow,
  data: CardData,
  stage: Stage,
  index: number,
  action: MoveAction,
): Promise<{ detail: Record<string, unknown>; handled: number[] }> {
  const { tx, workspaceId } = ctx;
  const from = await itemState(ctx, action.item, action.state);
  const [mark] = await tx<{ id: string }[]>`
    select coalesce(max(id), 0) as id from stock_movement where card_id = ${card.id}`;
  const movementIds = async () =>
    (
      await tx<{ id: string }[]>`
        select id from stock_movement where card_id = ${card.id} and id > ${mark?.id ?? 0}
         order by id`
    ).map((m) => Number(m.id));

  if (action.toState && action.reason === "production_out") {
    const to = await itemState(ctx, action.item, action.toState);
    const good = quantity(action.qty, data, true);
    const handled: number[] = [];
    let loss = 0;
    let lossStateKey: string | undefined;
    let batchCost = 0;
    stage.onEnter.forEach((other, i) => {
      if (i === index) return;
      if (
        other.action === "move_stock" &&
        other.reason === "damage" &&
        other.toState &&
        other.state === action.state &&
        other.item === action.item
      ) {
        if (lossStateKey && lossStateKey !== other.toState) {
          throw new EngineError("bad_request", "A batch can send damaged eggs to one state only");
        }
        lossStateKey = other.toState;
        loss += quantity(other.qty, data, true);
        handled.push(i);
      }
      if (
        other.action === "record_money" &&
        other.kind === "expense" &&
        other.allocate === "card"
      ) {
        batchCost += amount(other, data);
      }
    });
    const lossState = lossStateKey ? await itemState(ctx, action.item, lossStateKey) : undefined;
    const input = good + loss;
    if (input === 0) throw new EngineError("conflict", "A batch needs at least one egg");
    await checkTakeable(ctx, card, action, from, input);
    const [row] = await tx<{ lot: string | null }[]>`
      select produce_batch(${workspaceId}, ${from.itemId}, ${from.stateId}, ${to.stateId},
                           ${lossState?.stateId ?? null}, ${input}, ${good}, ${batchCost},
                           ${card.id}) as lot`;
    return {
      detail: {
        state: action.state,
        toState: action.toState,
        input,
        good,
        loss,
        batchCost,
        goodLotId: row?.lot ?? null,
        movementIds: await movementIds(),
      },
      handled,
    };
  }

  const qty = quantity(action.qty, data);
  await checkTakeable(ctx, card, action, from, qty);
  const reason = LEDGER_REASON[action.reason];
  const taken = await tx<{ lot_id: string; qty: number; unit_cost: string }[]>`
    select * from consume_fifo(${workspaceId}, ${from.itemId}, ${from.stateId}, ${qty},
                               ${reason}, ${card.id})`;

  if (action.toState) {
    if (action.reason === "sale")
      throw new EngineError("bad_request", "A sale can't go to a state");
    const to = await itemState(ctx, action.item, action.toState);
    // Damaged stock keeps no value; an adjustment keeps its cost.
    const cost =
      action.reason === "damage"
        ? 0
        : taken.reduce((sum, t) => sum + t.qty * Number(t.unit_cost), 0) / qty;
    const [lot] = await tx<{ id: string }[]>`
      insert into stock_lot (workspace_id, item_id, state_id, source, source_card_id, qty_in,
                             qty_remaining, unit_cost)
      values (${workspaceId}, ${to.itemId}, ${to.stateId}, 'adjustment', ${card.id}, ${qty}, 0,
              round(${cost}::numeric, 4))
      returning id`;
    await tx`
      insert into stock_movement (workspace_id, lot_id, qty, reason, unit_cost, card_id, created_by)
      values (${workspaceId}, ${lot?.id}, ${qty}, ${reason}, round(${cost}::numeric, 4), ${card.id},
              auth.uid())`;
  }

  if (action.reason === "sale") {
    await tx`
      update reservation set status = 'consumed'
       where card_id = ${card.id} and status = 'active'
         and item_id = ${from.itemId} and state_id = ${from.stateId}`;
  }
  return {
    detail: {
      state: action.state,
      toState: action.toState ?? null,
      qty,
      reason,
      lots: taken.map((t) => ({ lotId: t.lot_id, qty: t.qty, unitCost: Number(t.unit_cost) })),
      movementIds: await movementIds(),
    },
    handled: [],
  };
}
