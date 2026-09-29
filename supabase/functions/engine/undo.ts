// Undo: nothing is deleted. Each step is reversed by new rows (reversal movements and money
// entries, reservation status, the previous stage), and an `undone` event records which events it
// covered. A card move is undone with everything it triggered (actions, automatic moves, linked
// cards that haven't moved on). Only the latest manual move of a card can be undone.

import { z } from "zod";
import { type CardRow, cardSummary, lockCard } from "./cards.ts";
import { EngineError } from "./http.ts";
import { parse } from "./ledger-ops.ts";
import type { Op, OpContext } from "./ops.ts";

interface EventRow {
  id: string;
  card_id: string | null;
  type: string;
  from_stage: string | null;
  payload: Record<string, unknown>;
}

const ids = (value: unknown): number[] =>
  Array.isArray(value) ? value.filter((v): v is number => typeof v === "number") : [];

async function reverseMovements({ tx }: OpContext, movementIds: number[]): Promise<void> {
  for (const id of [...movementIds].reverse()) {
    await tx`
      insert into stock_movement (workspace_id, lot_id, qty, reason, unit_cost, card_id,
                                  reverses_id, created_by)
      select workspace_id, lot_id, -qty, 'reversal', unit_cost, card_id, id, auth.uid()
        from stock_movement m
       where m.id = ${id}
         and not exists (select 1 from stock_movement r where r.reverses_id = m.id)`;
  }
}

async function reverseMoney({ tx }: OpContext, entryIds: number[]): Promise<void> {
  for (const id of [...entryIds].reverse()) {
    await tx`
      insert into money_entry (workspace_id, direction, kind, amount, method, category_id,
                               card_id, lot_id, party_id, note, reverses_id, created_by)
      select workspace_id,
             case direction when 'in' then 'out'::money_direction else 'in'::money_direction end,
             'reversal', amount, method, category_id, card_id, lot_id, party_id, 'Dibatalkan', id,
             auth.uid()
        from money_entry m
       where m.id = ${id}
         and not exists (select 1 from money_entry r where r.reverses_id = m.id)`;
  }
}

/** Puts fields back to their earlier values; a field that was empty becomes empty again. */
async function restoreFields(
  { tx }: OpContext,
  cardId: string,
  before: Record<string, unknown>,
): Promise<void> {
  await tx`
    update card set fields = jsonb_strip_nulls(fields || ${tx.json(before as never)}),
                    row_version = row_version + 1, updated_at = now()
     where id = ${cardId}`;
}

/** Reverses one event's effects. */
async function compensate(ctx: OpContext, card: CardRow | null, e: EventRow): Promise<void> {
  const { tx } = ctx;
  const p = e.payload;
  if (e.type === "moved" && card) {
    await tx`
      update card set stage_key = ${e.from_stage}, status = 'open',
                      row_version = row_version + 1, updated_at = now()
       where id = ${card.id}`;
    return;
  }
  if (e.type === "created" && card) {
    await tx`
      update card set status = 'cancelled', row_version = row_version + 1, updated_at = now()
       where id = ${card.id}`;
    return;
  }
  if (e.type === "field_changed" && card) {
    await restoreFields(ctx, card.id, (p.before ?? {}) as Record<string, unknown>);
    return;
  }
  if (e.type !== "action_run") return;

  // A direct op (receive-stock, produce, return-lot, record-money): its result lists its rows.
  if (typeof p.op === "string") {
    const result = (p.result ?? {}) as Record<string, unknown>;
    await reverseMovements(ctx, ids(result.movementIds));
    await reverseMoney(ctx, ids(result.entryIds));
    return;
  }
  switch (p.action) {
    case "move_stock":
      await reverseMovements(ctx, ids(p.movementIds));
      if (p.reason === "sale" && card) {
        await tx`
          update reservation set status = 'active'
           where card_id = ${card.id} and status = 'consumed'`;
      }
      return;
    case "reserve_stock":
      if (typeof p.reservationId === "string") {
        await tx`update reservation set status = 'released' where id = ${p.reservationId}`;
      }
      return;
    case "release_reservation": {
      const released = Array.isArray(p.released) ? (p.released as string[]) : [];
      if (released.length > 0) {
        await tx`update reservation set status = 'active' where id in ${tx(released)}`;
      }
      return;
    }
    case "record_money":
      if (typeof p.entryId === "number") await reverseMoney(ctx, [p.entryId]);
      return;
    case "set_field":
      if (card && typeof p.field === "string") {
        await restoreFields(ctx, card.id, { [p.field]: p.before ?? null });
      }
      return;
    case "create_linked_card":
      if (typeof p.cardId === "string") await cancelLinked(ctx, p.cardId);
      return;
    case "remind":
      if (typeof p.notificationId === "string") {
        await tx`delete from notification where id = ${p.notificationId}`;
      }
      return;
    default:
      return; // check_stock and steps covered by a batch change nothing to reverse
  }
}

/** Reverses a card's events from `fromId` on, newest first; returns the event ids it covered. */
async function undoCardFrom(ctx: OpContext, cardId: string, fromId: string): Promise<string[]> {
  const card = await lockCard(ctx, cardId);
  const events = await ctx.tx<(EventRow & { reverses_event_id: string | null })[]>`
    select id, card_id, type, from_stage, payload, reverses_event_id from card_event
     where card_id = ${cardId} and id >= ${fromId} order by id`;
  const covered = new Set(
    events
      .filter((e) => e.type === "undone")
      .flatMap((e) => ((e.payload.covered as string[] | undefined) ?? []).map(String)),
  );
  const live = events.filter((e) => e.type !== "undone" && !covered.has(String(e.id)));
  const laterMove = live.find(
    (e) => String(e.id) !== String(fromId) && e.type === "moved" && e.payload.auto !== true,
  );
  if (laterMove) {
    throw new EngineError("conflict", `Card #${card.number} moved on since; undo that step first`);
  }
  for (const e of [...live].reverse()) await compensate(ctx, card, e);
  return live.map((e) => String(e.id));
}

/** Cancels a card an action created, unless someone has already worked on it. */
async function cancelLinked(ctx: OpContext, cardId: string): Promise<void> {
  const [created] = await ctx.tx<{ id: string }[]>`
    select id from card_event where card_id = ${cardId} and type = 'created'`;
  if (!created) return;
  const covered = await undoCardFrom(ctx, cardId, created.id);
  await ctx.tx`
    insert into card_event (workspace_id, card_id, type, payload, reverses_event_id, actor)
    values (${ctx.workspaceId}, ${cardId}, 'undone', ${ctx.tx.json({ covered })}, ${created.id},
            ${ctx.userId})`;
}

const undoInput = z.strictObject({
  idempotencyKey: z.guid(),
  /** The card_event to undo: a manual move, a card's creation, or a direct stock/money op. */
  eventId: z.int().positive(),
});

export const undoOps: Record<string, Op> = {
  undo: async (ctx, raw) => {
    const input = parse(undoInput, raw);
    const { tx, workspaceId } = ctx;
    const [done] = await tx<{ result: unknown }[]>`
      select payload -> 'result' as result from card_event
       where workspace_id = ${workspaceId} and idempotency_key = ${input.idempotencyKey}`;
    if (done) return done.result;

    const [event] = await tx<EventRow[]>`
      select id, card_id, type, from_stage, payload from card_event
       where id = ${input.eventId} and workspace_id = ${workspaceId}`;
    if (!event) throw new EngineError("not_found", "Step not found");
    const [already] = await tx`
      select 1 from card_event where reverses_event_id = ${event.id} and type = 'undone'`;
    if (already) throw new EngineError("conflict", "This step was already undone");

    let covered: string[];
    let result: unknown;
    try {
      if (event.type === "action_run" && typeof event.payload.op === "string") {
        await compensate(ctx, null, event);
        covered = [String(event.id)];
        result = { undone: Number(event.id), op: event.payload.op };
      } else if (
        event.card_id &&
        (event.type === "created" || (event.type === "moved" && event.payload.auto !== true))
      ) {
        covered = await undoCardFrom(ctx, event.card_id, event.id);
        result = await cardSummary(ctx, event.card_id);
      } else {
        throw new EngineError("bad_request", "This step can't be undone on its own");
      }
    } catch (err) {
      // A reversal that would take a lot below zero: the stock has been used since.
      if ((err as { code?: string }).code === "23514") {
        throw new EngineError(
          "conflict",
          "Some of this stock has been used since, so it can't be undone",
        );
      }
      throw err;
    }
    await tx`
      insert into card_event (workspace_id, card_id, type, payload, idempotency_key,
                              reverses_event_id, actor)
      values (${workspaceId}, ${event.card_id}, 'undone', ${tx.json({ covered, result } as never)},
              ${input.idempotencyKey}, ${event.id}, ${ctx.userId})`;
    return result;
  },
};
