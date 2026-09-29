// Direct stock ops for onboarding and the Terima stok, Rebus and Retur screens: opening stock and
// the ledger functions receive_purchase, produce_batch and return_lot, after checking ids belong
// to the workspace and that reserved stock isn't touched. Retries with the same key return the
// first result.

import { z } from "zod";
import { EngineError } from "./http.ts";
import type { Op, OpContext } from "./ops.ts";

export const method = z.enum(["cash", "transfer", "qris", "credit_note", "other"]);

export function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new EngineError("bad_request", z.prettifyError(result.error));
  return result.data;
}

/** Stock movements and money entries this transaction wrote, so undo can reverse exactly them. */
export async function ledgerRows({ tx }: OpContext) {
  const movements = await tx<{ id: string }[]>`
    select id from stock_movement where xmin = pg_current_xact_id()::xid order by id`;
  const entries = await tx<{ id: string }[]>`
    select id from money_entry where xmin = pg_current_xact_id()::xid order by id`;
  return {
    movementIds: movements.map((m) => Number(m.id)),
    entryIds: entries.map((e) => Number(e.id)),
  };
}

/** Runs `work` once per idempotency key; the result is kept on the op's event. */
export async function once(
  ctx: OpContext,
  op: string,
  key: string,
  cardId: string | null,
  work: () => Promise<Record<string, unknown>>,
): Promise<unknown> {
  const [done] = await ctx.tx<{ result: unknown }[]>`
    select payload -> 'result' as result from card_event
     where workspace_id = ${ctx.workspaceId} and idempotency_key = ${key}`;
  if (done) return done.result;
  const result = await work();
  await ctx.tx`
    insert into card_event (workspace_id, card_id, type, payload, idempotency_key, actor)
    values (${ctx.workspaceId}, ${cardId}, 'action_run', ${ctx.tx.json({ op, result } as never)},
            ${key}, ${ctx.userId})`;
  return result;
}

async function stateOf(
  { tx, workspaceId }: OpContext,
  stateId: string,
): Promise<{ itemId: string; key: string }> {
  const [row] = await tx<{ itemId: string; key: string }[]>`
    select item_id as "itemId", key from item_state
     where id = ${stateId} and workspace_id = ${workspaceId}`;
  if (!row) throw new EngineError("not_found", "Stock state not found");
  return row;
}

async function checkCard({ tx, workspaceId }: OpContext, cardId: string | undefined) {
  if (!cardId) return;
  const [card] =
    await tx`select 1 from card where id = ${cardId} and workspace_id = ${workspaceId}`;
  if (!card) throw new EngineError("not_found", "Card not found");
}

/** On hand minus every active reservation. */
async function freeStock({ tx }: OpContext, itemId: string, stateId: string): Promise<number> {
  const [row] = await tx<{ available: number }[]>`
    select coalesce(sum(available), 0)::integer as available from v_stock_on_hand
     where item_id = ${itemId} and state_id = ${stateId}`;
  return row?.available ?? 0;
}

const receiveInput = z.strictObject({
  idempotencyKey: z.guid(),
  supplierId: z.guid(),
  stateId: z.guid(),
  qtyPaid: z.int().positive(),
  /** Free eggs; defaults to the supplier's bonus per purchase. */
  bonus: z.int().nonnegative().optional(),
  /** Price per paid egg; defaults to the latest buy price for this state. */
  unitPrice: z.int().nonnegative().optional(),
  method: method.default("cash"),
  cardId: z.guid().optional(),
});

const produceInput = z
  .strictObject({
    idempotencyKey: z.guid(),
    fromStateId: z.guid(),
    toStateId: z.guid(),
    lossStateId: z.guid().optional(),
    inputQty: z.int().positive(),
    goodQty: z.int().nonnegative(),
    /** LPG and other batch costs in rupiah, spread over the good eggs. */
    batchCost: z.int().nonnegative().default(0),
    cardId: z.guid().optional(),
  })
  .refine((p) => p.goodQty <= p.inputQty, "Good eggs can't be more than eggs boiled")
  .refine(
    (p) => p.goodQty === p.inputQty || p.lossStateId !== undefined,
    "Say where damaged eggs go (lossStateId)",
  );

const returnInput = z.strictObject({
  idempotencyKey: z.guid(),
  lotId: z.guid(),
  qty: z.int().positive(),
  /** Refund in rupiah; defaults to qty × the price paid for this lot. */
  refund: z.int().nonnegative().optional(),
  method: method.default("cash"),
});

const openingInput = z.strictObject({
  idempotencyKey: z.guid(),
  stateId: z.guid(),
  qty: z.int().positive(),
  /** Cost per egg; defaults to the latest buy price for this state, or 0 if there is none. */
  unitCost: z.number().nonnegative().optional(),
});

export const ledgerOps: Record<string, Op> = {
  /** Stock already on hand when the business starts using Papan. No money moves. */
  "opening-stock": async (ctx, raw) => {
    const input = parse(openingInput, raw);
    if (ctx.role !== "owner")
      throw new EngineError("forbidden", "Only an owner can set opening stock");
    return once(ctx, "opening-stock", input.idempotencyKey, null, async () => {
      const { tx, workspaceId } = ctx;
      const state = await stateOf(ctx, input.stateId);
      let unitCost = input.unitCost;
      if (unitCost === undefined) {
        const [price] = await tx<{ unit_price: string }[]>`
          select p.unit_price from price p join product d on d.id = p.product_id
           where p.workspace_id = ${workspaceId} and p.kind = 'buy' and d.state_id = ${input.stateId}
           order by p.valid_from desc limit 1`;
        unitCost = price ? Number(price.unit_price) : 0;
      }
      const [lot] = await tx<{ id: string }[]>`
        insert into stock_lot (workspace_id, item_id, state_id, source, qty_in, qty_remaining,
                               unit_cost)
        values (${workspaceId}, ${state.itemId}, ${input.stateId}, 'opening', ${input.qty}, 0,
                round(${unitCost}::numeric, 4))
        returning id`;
      await tx`
        insert into stock_movement (workspace_id, lot_id, qty, reason, unit_cost, created_by)
        values (${workspaceId}, ${lot?.id}, ${input.qty}, 'opening', round(${unitCost}::numeric, 4),
                auth.uid())`;
      return { lotId: lot?.id, qty: input.qty, unitCost, ...(await ledgerRows(ctx)) };
    });
  },

  "receive-stock": async (ctx, raw) => {
    const input = parse(receiveInput, raw);
    return once(ctx, "receive-stock", input.idempotencyKey, input.cardId ?? null, async () => {
      const { tx, workspaceId } = ctx;
      const [supplier] = await tx<{ bonus: number | null }[]>`
        select bonus_per_purchase as bonus from party
         where id = ${input.supplierId} and workspace_id = ${workspaceId} and kind = 'supplier'`;
      if (!supplier) throw new EngineError("not_found", "Supplier not found");
      const state = await stateOf(ctx, input.stateId);
      await checkCard(ctx, input.cardId);
      let unitPrice = input.unitPrice;
      if (unitPrice === undefined) {
        const [price] = await tx<{ unit_price: string }[]>`
          select p.unit_price from price p join product d on d.id = p.product_id
                                           join workspace w on w.id = p.workspace_id
           where p.workspace_id = ${workspaceId} and p.kind = 'buy' and d.state_id = ${input.stateId}
             and (p.supplier_id is null or p.supplier_id = ${input.supplierId})
             and p.valid_from <= (now() at time zone w.timezone)::date
           order by (p.supplier_id is not null) desc, p.valid_from desc
           limit 1`;
        if (!price) throw new EngineError("bad_request", "No buy price saved; enter the price");
        unitPrice = Number(price.unit_price);
      }
      const bonus = input.bonus ?? supplier.bonus ?? 0;
      const [row] = await tx<{ lot: string }[]>`
        select receive_purchase(${workspaceId}, ${input.supplierId}, ${state.itemId},
                                ${input.stateId}, ${input.qtyPaid}, ${bonus}, ${unitPrice},
                                ${input.method}, ${input.cardId ?? null}) as lot`;
      const [lot] = await tx<{ qty: number; unitCost: string; returnBy: string | null }[]>`
        select qty_in as qty, unit_cost as "unitCost", return_by::text as "returnBy"
          from stock_lot where id = ${row?.lot ?? null}`;
      return {
        lotId: row?.lot,
        qty: lot?.qty,
        unitCost: Number(lot?.unitCost),
        total: input.qtyPaid * unitPrice,
        returnBy: lot?.returnBy ?? null,
        ...(await ledgerRows(ctx)),
      };
    });
  },

  produce: async (ctx, raw) => {
    const input = parse(produceInput, raw);
    return once(ctx, "produce", input.idempotencyKey, input.cardId ?? null, async () => {
      const { tx, workspaceId } = ctx;
      const from = await stateOf(ctx, input.fromStateId);
      const to = await stateOf(ctx, input.toStateId);
      const loss = input.lossStateId ? await stateOf(ctx, input.lossStateId) : undefined;
      if (to.itemId !== from.itemId || (loss && loss.itemId !== from.itemId)) {
        throw new EngineError("bad_request", "All states must belong to the same item");
      }
      await checkCard(ctx, input.cardId);
      const free = await freeStock(ctx, from.itemId, input.fromStateId);
      if (input.inputQty > free) {
        throw new EngineError(
          "conflict",
          `Only ${Math.max(free, 0)} ${from.key} available; the rest is reserved or missing`,
        );
      }
      const [row] = await tx<{ lot: string | null }[]>`
        select produce_batch(${workspaceId}, ${from.itemId}, ${input.fromStateId},
                             ${input.toStateId}, ${input.lossStateId ?? null}, ${input.inputQty},
                             ${input.goodQty}, ${input.batchCost}, ${input.cardId ?? null}) as lot`;
      const [lot] = await tx<{ unitCost: string }[]>`
        select unit_cost as "unitCost" from stock_lot where id = ${row?.lot ?? null}`;
      return {
        goodLotId: row?.lot ?? null,
        input: input.inputQty,
        good: input.goodQty,
        loss: input.inputQty - input.goodQty,
        unitCost: lot ? Number(lot.unitCost) : null,
        ...(await ledgerRows(ctx)),
      };
    });
  },

  "return-lot": async (ctx, raw) => {
    const input = parse(returnInput, raw);
    return once(ctx, "return-lot", input.idempotencyKey, null, async () => {
      const { tx, workspaceId } = ctx;
      const [lot] = await tx<
        { itemId: string; stateId: string; key: string; price: string | null }[]
      >`
        select l.item_id as "itemId", l.state_id as "stateId", s.key, l.purchase_price as price
          from stock_lot l join item_state s on s.id = l.state_id
         where l.id = ${input.lotId} and l.workspace_id = ${workspaceId}`;
      if (!lot) throw new EngineError("not_found", "Lot not found");
      const free = await freeStock(ctx, lot.itemId, lot.stateId);
      if (input.qty > free) {
        throw new EngineError(
          "conflict",
          `Only ${Math.max(free, 0)} ${lot.key} are free to return; the rest is reserved`,
        );
      }
      await tx`
        select return_lot(${workspaceId}, ${input.lotId}, ${input.qty}, ${input.refund ?? null},
                          ${input.method})`;
      return {
        lotId: input.lotId,
        qty: input.qty,
        refund: input.refund ?? input.qty * Number(lot.price ?? 0),
        ...(await ledgerRows(ctx)),
      };
    });
  },
};
