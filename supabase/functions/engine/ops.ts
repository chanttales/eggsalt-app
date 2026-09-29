// Engine operations by name. Each op runs inside one database transaction that already knows the
// caller and has checked they belong to the workspace. Later tasks add money and undo ops.

import type { TransactionSql } from "postgres";
import { z } from "zod";
import {
  cardData,
  cardSummary,
  checkFieldKeys,
  loadGraph,
  lockCard,
  stockReader,
} from "./cards.ts";
import { transitionOptions } from "./domain.ts";
import { createCard, moveTo } from "./flow.ts";
import { EngineError } from "./http.ts";
import { ledgerOps } from "./ledger-ops.ts";

export type Role = "owner" | "staff";

export interface OpContext {
  tx: TransactionSql;
  userId: string;
  workspaceId: string;
  role: Role;
}

export type Op = (ctx: OpContext, input: unknown) => Promise<unknown>;

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new EngineError("bad_request", z.prettifyError(result.error));
  return result.data;
}

/**
 * The app's outbox sends each change with a key and may retry it. A key that already ran returns
 * the card as it is now instead of doing the work twice.
 */
async function replay(ctx: OpContext, key: string) {
  const [done] = await ctx.tx<{ card_id: string }[]>`
    select card_id from card_event
     where workspace_id = ${ctx.workspaceId} and idempotency_key = ${key}`;
  return done ? cardSummary(ctx, done.card_id) : undefined;
}

const fieldsInput = z.record(z.string(), z.unknown());

const createCardInput = z.strictObject({
  idempotencyKey: z.guid(),
  boardId: z.guid(),
  title: z.string().trim().min(1).max(120),
  partyId: z.guid().optional(),
  dueAt: z.iso.datetime({ offset: true }).optional(),
  flags: z
    .array(z.string().regex(/^[a-z][a-z0-9_]{0,23}$/))
    .max(10)
    .optional(),
  fields: fieldsInput.optional(),
  lines: z
    .array(
      z.strictObject({
        productId: z.guid(),
        qty: z.int().positive(),
        unitPrice: z.int().nonnegative().optional(),
      }),
    )
    .max(50)
    .optional(),
  parentCardId: z.guid().optional(),
});

const moveCardInput = z.strictObject({
  idempotencyKey: z.guid(),
  cardId: z.guid(),
  to: z.string().min(1),
  /** The row_version the app last saw; a different one means someone else changed the card. */
  rowVersion: z.int().positive().optional(),
  /** Fields filled in on the way, e.g. the delivery cost when moving to Dikirim. */
  fields: fieldsInput.optional(),
});

export const ops: Record<string, Op> = {
  /** Checks sign-in and membership end to end; returns who the engine thinks you are. */
  ping: ({ userId, workspaceId, role }) => Promise.resolve({ userId, workspaceId, role }),

  "create-card": async (ctx, raw) => {
    const { idempotencyKey, ...spec } = parse(createCardInput, raw);
    const done = await replay(ctx, idempotencyKey);
    if (done) return done;
    const cardId = await createCard(ctx, spec, { idempotencyKey, enforceRequire: true, depth: 0 });
    return cardSummary(ctx, cardId);
  },

  "move-card": async (ctx, raw) => {
    const input = parse(moveCardInput, raw);
    const done = await replay(ctx, input.idempotencyKey);
    if (done) return done;

    let card = await lockCard(ctx, input.cardId);
    if (card.status !== "open") throw new EngineError("conflict", "This card is already closed");
    if (input.rowVersion !== undefined && input.rowVersion !== card.row_version) {
      throw new EngineError("conflict", "The card changed since you opened it; refresh and retry");
    }
    if (input.fields && Object.keys(input.fields).length > 0) {
      await checkFieldKeys(ctx, card.board_id, input.fields);
      await ctx.tx`
        insert into card_event (workspace_id, card_id, type, from_stage, payload, actor)
        values (${ctx.workspaceId}, ${card.id}, 'field_changed', ${card.stage_key},
                ${ctx.tx.json({
                  before: Object.fromEntries(
                    Object.keys(input.fields).map((k) => [k, card.fields[k] ?? null]),
                  ),
                  after: input.fields,
                } as never)}, ${ctx.userId})`;
      await ctx.tx`
        update card set fields = fields || ${ctx.tx.json(input.fields as never)},
                        updated_at = now()
         where id = ${card.id}`;
      card = await lockCard(ctx, card.id);
    }

    const graph = await loadGraph(ctx, card.board_version_id);
    const option = transitionOptions(graph, card.stage_key, {
      card: await cardData(ctx, card),
      stockAvailable: await stockReader(ctx),
    }).find((o) => o.transition.to === input.to);
    if (!option) {
      throw new EngineError("bad_request", `No arrow from ${card.stage_key} to ${input.to}`);
    }
    if (!option.allowed) {
      throw new EngineError(
        "conflict",
        option.missingFields.length > 0
          ? `Fill in: ${option.missingFields.join(", ")}`
          : "This arrow's rule doesn't hold for the card right now",
      );
    }
    await moveTo(ctx, card, graph, input.to, {
      idempotencyKey: input.idempotencyKey,
      auto: false,
      depth: 0,
    });
    return cardSummary(ctx, card.id);
  },

  ...ledgerOps,
};
