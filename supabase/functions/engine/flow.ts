// Creating and moving cards. Entering a stage runs its onEnter actions in order, then follows an
// automatic arrow if one's rule holds (e.g. Cek stok → Disiapkan when stock is enough). Every step
// is a card_event, so history and undo can see exactly what happened.

import {
  cardData,
  type CardRow,
  checkFieldKeys,
  loadGraph,
  lockCard,
  stockReader,
} from "./cards.ts";
import {
  addDays,
  assertBusinessDate,
  autoRoute,
  type BoardGraph,
  businessDate,
  type CardData,
  missingRequiredFields,
  readPath,
  resolveValue,
  type Stage,
} from "./domain.ts";
import { EngineError } from "./http.ts";
import { recordMoneyAction } from "./money.ts";
import type { OpContext } from "./ops.ts";
import { batchOf, moveStock, release, reserve } from "./stock.ts";

/** Guards against arrows that route in a loop and links that create cards forever. */
const MAX_DEPTH = 10;

export interface NewCard {
  boardId: string;
  title: string;
  partyId?: string;
  dueAt?: string;
  orderedOn?: string;
  flags?: string[];
  fields?: Record<string, unknown>;
  lines?: { productId: string; qty: number; unitPrice?: number }[];
  parentCardId?: string;
}

async function unitPrice(
  { tx, workspaceId }: OpContext,
  productId: string,
  segment: string | null,
  on: string | null,
  qty: number,
): Promise<number> {
  // Latest sell price valid on the order day. A price for the customer's segment beats the general
  // one, then the highest minimum quantity the line reaches (e.g. from 100 eggs) wins. An order
  // dated before the first price was entered (past sales typed in late) uses the earliest price.
  const [price] = await tx<{ unit_price: string }[]>`
    select p.unit_price from price p join workspace w on w.id = p.workspace_id,
           lateral (select coalesce(${on}::date, (now() at time zone w.timezone)::date) as day) d
     where p.workspace_id = ${workspaceId} and p.product_id = ${productId} and p.kind = 'sell'
       and (p.segment is null or p.segment = ${segment})
       and p.min_qty <= ${qty}
     order by (p.valid_from <= d.day) desc, (p.segment is not null) desc, p.min_qty desc,
              case when p.valid_from <= d.day then d.day - p.valid_from else p.valid_from - d.day end
     limit 1`;
  if (!price) throw new EngineError("bad_request", "Product has no sell price; enter a unit price");
  return Number(price.unit_price);
}

export async function createCard(
  ctx: OpContext,
  spec: NewCard,
  opts: { idempotencyKey?: string; enforceRequire: boolean; depth: number },
): Promise<string> {
  const { tx, workspaceId, userId } = ctx;
  const [board] = await tx<{ card_type_id: string; version_id: string }[]>`
    select b.card_type_id, v.id as version_id
      from board b join board_version v on v.id = b.active_version_id and v.status = 'published'
     where b.id = ${spec.boardId} and b.workspace_id = ${workspaceId} and b.archived_at is null`;
  if (!board) throw new EngineError("not_found", "Board not found or not published");
  const graph = await loadGraph(ctx, board.version_id);
  const fields = spec.fields ?? {};
  await checkFieldKeys(ctx, spec.boardId, fields);

  let segment: string | null = null;
  if (spec.partyId) {
    const [party] = await tx<{ segment: string | null }[]>`
      select segment from party where id = ${spec.partyId} and workspace_id = ${workspaceId}`;
    if (!party) throw new EngineError("not_found", "Customer or supplier not found");
    segment = party.segment;
  }
  if (spec.parentCardId) {
    const [parent] = await tx`
      select 1 from card where id = ${spec.parentCardId} and workspace_id = ${workspaceId}`;
    if (!parent) throw new EngineError("not_found", "Parent card not found");
  }
  if (spec.orderedOn) {
    const [future] = await tx`
      select 1 from workspace
       where id = ${workspaceId} and ${spec.orderedOn}::date > (now() at time zone timezone)::date`;
    if (future) throw new EngineError("bad_request", "Order date can't be in the future");
  }
  const entry = stageOf(graph, graph.entry);
  if (opts.enforceRequire) {
    const missing = missingRequiredFields(entry, { fields });
    if (missing.length > 0) throw new EngineError("bad_request", `Fill in: ${missing.join(", ")}`);
  }

  const [{ number }] = await tx<{ number: number }[]>`
    update workspace set next_card_no = next_card_no + 1 where id = ${workspaceId}
    returning next_card_no - 1 as number`;
  const [card] = await tx<CardRow[]>`
    insert into card (workspace_id, number, board_id, board_version_id, stage_key, title, party_id,
                      due_at, ordered_on, flags, fields, parent_card_id, created_by)
    values (${workspaceId}, ${number}, ${spec.boardId}, ${board.version_id}, ${graph.entry},
            ${spec.title}, ${spec.partyId ?? null}, ${spec.dueAt ?? null}, ${spec.orderedOn ?? null},
            ${spec.flags ?? []},
            ${tx.json(fields as never)}, ${spec.parentCardId ?? null}, ${userId})
    returning id, number, board_id, board_version_id, stage_key, status, title, party_id, flags,
              fields, row_version`;
  if (!card) throw new EngineError("internal", "Card was not created");

  for (const line of spec.lines ?? []) {
    const [product] = await tx`
      select 1 from product where id = ${line.productId} and workspace_id = ${workspaceId}`;
    if (!product) throw new EngineError("not_found", "Product not found");
    const price =
      line.unitPrice ??
      (await unitPrice(ctx, line.productId, segment, spec.orderedOn ?? null, line.qty));
    await tx`
      insert into card_line (workspace_id, card_id, product_id, qty, unit_price)
      values (${workspaceId}, ${card.id}, ${line.productId}, ${line.qty}, ${price})`;
  }

  await tx`
    insert into card_event (workspace_id, card_id, type, to_stage, payload, idempotency_key, actor)
    values (${workspaceId}, ${card.id}, 'created', ${graph.entry},
            ${tx.json({ parentCardId: spec.parentCardId ?? null })}, ${opts.idempotencyKey ?? null},
            ${userId})`;
  await enterStage(ctx, card, graph, entry, opts.depth);
  return card.id;
}

/** Moves a locked card along an arrow the caller has already checked, then enters the stage. */
export async function moveTo(
  ctx: OpContext,
  card: CardRow,
  graph: BoardGraph,
  to: string,
  opts: { idempotencyKey?: string; auto: boolean; depth: number },
): Promise<void> {
  const { tx, workspaceId, userId } = ctx;
  const status = graph.terminal.includes(to) ? "done" : "open";
  const [moved] = await tx<CardRow[]>`
    update card set stage_key = ${to}, status = ${status}, row_version = row_version + 1,
                    updated_at = now()
     where id = ${card.id}
    returning id, number, board_id, board_version_id, stage_key, status, title, party_id, flags,
              fields, row_version`;
  if (!moved) throw new EngineError("not_found", "Card not found");
  await tx`
    insert into card_event (workspace_id, card_id, type, from_stage, to_stage, payload,
                            idempotency_key, actor)
    values (${workspaceId}, ${card.id}, 'moved', ${card.stage_key}, ${to},
            ${tx.json({ auto: opts.auto })}, ${opts.idempotencyKey ?? null}, ${userId})`;
  await enterStage(ctx, moved, graph, stageOf(graph, to), opts.depth);
}

async function enterStage(
  ctx: OpContext,
  card: CardRow,
  graph: BoardGraph,
  stage: Stage,
  depth: number,
): Promise<void> {
  if (depth > MAX_DEPTH) throw new EngineError("conflict", "Too many automatic steps in a row");
  // Actions another action already covered (a batch's damaged-egg move), by index.
  const handledBy = new Map<number, number>();
  for (const [index, action] of stage.onEnter.entries()) {
    card = await lockCard(ctx, card.id);
    const data = await cardData(ctx, card);
    const covering = handledBy.get(index);
    const detail =
      covering === undefined
        ? await runAction(ctx, card, data, stage, index, action, depth, handledBy)
        : { handledBy: covering };
    await ctx.tx`
      insert into card_event (workspace_id, card_id, type, to_stage, payload, actor)
      values (${ctx.workspaceId}, ${card.id}, 'action_run', ${stage.key},
              ${ctx.tx.json({ index, action: action.action, ...detail } as never)}, ${ctx.userId})`;
  }
  if (graph.terminal.includes(stage.key)) return;
  card = await lockCard(ctx, card.id);
  const next = autoRoute(graph, stage.key, {
    card: await cardData(ctx, card),
    stockAvailable: await stockReader(ctx),
  });
  if (next) await moveTo(ctx, card, graph, next.to, { auto: true, depth: depth + 1 });
}

function stageOf(graph: BoardGraph, key: string): Stage {
  const stage = graph.stages.find((s) => s.key === key);
  if (!stage) throw new EngineError("conflict", `Stage ${key} is not on this board`);
  return stage;
}

type Action = Stage["onEnter"][number];

/** Runs one onEnter action and returns what it did, for the action_run event. */
async function runAction(
  ctx: OpContext,
  card: CardRow,
  data: CardData,
  stage: Stage,
  index: number,
  action: Action,
  depth: number,
  handledBy: Map<number, number>,
): Promise<Record<string, unknown>> {
  const { tx, workspaceId } = ctx;
  switch (action.action) {
    case "set_field": {
      const value = resolveValue(action.value, data);
      await tx`
        update card set fields = fields || ${tx.json({ [action.field]: value } as never)},
                        row_version = row_version + 1, updated_at = now()
         where id = ${card.id}`;
      return { field: action.field, before: card.fields[action.field] ?? null, after: value };
    }
    case "check_stock": {
      const available = (await stockReader(ctx))({ item: action.item, state: action.state });
      const needed = Number(readPath(data, "lines.qty") ?? 0);
      const short = available < needed;
      const flags = short
        ? [...new Set([...card.flags, "shortage"])]
        : card.flags.filter((f) => f !== "shortage");
      await tx`
        update card set flags = ${flags}, row_version = row_version + 1, updated_at = now()
         where id = ${card.id}`;
      return { state: action.state, available, needed, short };
    }
    case "create_linked_card": {
      const [board] = await tx<{ id: string }[]>`
        select id from board
         where workspace_id = ${workspaceId} and key = ${action.board} and archived_at is null`;
      if (!board) throw new EngineError("not_found", `Board ${action.board} not found`);
      const fields = Object.fromEntries(
        Object.entries(action.fields ?? {}).map(([k, v]) => [k, resolveValue(v, data)]),
      );
      const cardId = await createCard(
        ctx,
        {
          boardId: board.id,
          title: card.title,
          partyId: card.party_id ?? undefined,
          fields,
          parentCardId: card.id,
        },
        { enforceRequire: false, depth: depth + 1 },
      );
      return { cardId };
    }
    case "remind": {
      const from = action.from ? readPath(data, action.from) : undefined;
      if (action.from && (typeof from !== "string" || from.length < 10)) {
        throw new EngineError("conflict", `Reminder needs ${action.from}`);
      }
      const base = typeof from === "string" ? assertBusinessDate(from.slice(0, 10)) : today();
      const date = addDays(base, action.offsetDays);
      const [row] = await tx<{ id: string }[]>`
        insert into notification (workspace_id, kind, title, data, link, due_at, dedupe_key)
        select ${workspaceId}, 'remind', ${action.message},
               ${tx.json({ card_id: card.id, number: card.number, title: card.title })},
               ${"/kartu?id=" + card.id}, (${date}::date + time '08:00') at time zone w.timezone,
               ${`remind:${card.id}:${stage.key}:${index}`}
          from workspace w where w.id = ${workspaceId}
        on conflict (workspace_id, dedupe_key) where dedupe_key is not null do nothing
        returning id`;
      return { date, notificationId: row?.id ?? null };
    }
    case "reserve_stock":
      return reserve(ctx, card, data, action);
    case "release_reservation":
      return release(ctx, card, action);
    case "move_stock": {
      const batch = batchOf(stage, action);
      if (batch !== undefined) return { handledBy: batch };
      const { detail, handled } = await moveStock(ctx, card, data, stage, index, action);
      for (const i of handled) handledBy.set(i, index);
      return detail;
    }
    case "record_money":
      return recordMoneyAction(ctx, card, data, action);
  }
}

function today(): ReturnType<typeof businessDate> {
  return businessDate(new Date());
}
