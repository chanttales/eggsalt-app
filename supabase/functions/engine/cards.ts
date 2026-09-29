// Card state the engine works with: the row, its board graph, the data rules read, and stock.

import { EngineError } from "./http.ts";
import type { OpContext } from "./ops.ts";
import { type BoardGraph, type CardData, parseBoardGraph, type RuleContext } from "./domain.ts";

export interface CardRow {
  id: string;
  number: number;
  board_id: string;
  board_version_id: string;
  stage_key: string;
  status: "open" | "done" | "cancelled";
  title: string;
  party_id: string | null;
  flags: string[];
  fields: Record<string, unknown>;
  row_version: number;
}

export interface CardSummary {
  cardId: string;
  number: number;
  stage: string;
  status: string;
  rowVersion: number;
}

export async function lockCard({ tx, workspaceId }: OpContext, cardId: string): Promise<CardRow> {
  const [card] = await tx<CardRow[]>`
    select id, number, board_id, board_version_id, stage_key, status, title, party_id, flags,
           fields, row_version
      from card where id = ${cardId} and workspace_id = ${workspaceId} for update`;
  if (!card) throw new EngineError("not_found", "Card not found");
  return card;
}

export async function cardSummary({ tx }: OpContext, cardId: string): Promise<CardSummary> {
  const [row] = await tx<CardSummary[]>`
    select id as "cardId", number, stage_key as stage, status, row_version as "rowVersion"
      from card where id = ${cardId}`;
  if (!row) throw new EngineError("not_found", "Card not found");
  return row;
}

export async function loadGraph({ tx }: OpContext, versionId: string): Promise<BoardGraph> {
  const [row] = await tx<
    { graph: unknown }[]
  >`select graph from board_version where id = ${versionId}`;
  if (!row) throw new EngineError("not_found", "Board version not found");
  return parseBoardGraph(row.graph);
}

/** Rejects field keys the card type doesn't define. */
export async function checkFieldKeys(
  { tx }: OpContext,
  boardId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  const keys = Object.keys(fields);
  if (keys.length === 0) return;
  const known = await tx<{ key: string }[]>`
    select f.key from field_def f join board b on b.card_type_id = f.card_type_id
     where b.id = ${boardId}`;
  const allowed = new Set(known.map((f) => f.key));
  const unknown = keys.filter((k) => !allowed.has(k));
  if (unknown.length > 0)
    throw new EngineError("bad_request", `Unknown fields: ${unknown.join(", ")}`);
}

/** What rules and {{references}} can read: fields, line totals, the customer. */
export async function cardData({ tx }: OpContext, card: CardRow): Promise<CardData> {
  const [lines] = await tx<{ qty: number; total: number }[]>`
    select coalesce(sum(qty), 0)::integer as qty, coalesce(sum(qty::bigint * unit_price), 0)::bigint as total
      from card_line where card_id = ${card.id}`;
  const [party] = card.party_id
    ? await tx<{ name: string; segment: string | null }[]>`
        select name, segment from party where id = ${card.party_id}`
    : [];
  return {
    number: card.number,
    title: card.title,
    flags: card.flags,
    fields: card.fields,
    lines: { qty: lines?.qty ?? 0, total: Number(lines?.total ?? 0) },
    party: party ?? null,
  };
}

/** Stock available (on hand minus active reservations) per item and state key, read once. */
export async function stockReader({
  tx,
  workspaceId,
}: OpContext): Promise<RuleContext["stockAvailable"]> {
  const rows = await tx<{ item: string; state: string; available: number }[]>`
    select i.key as item, s.key as state, coalesce(v.available, 0)::integer as available
      from item_state s
      join item i on i.id = s.item_id
      left join v_stock_on_hand v on v.item_id = i.id and v.state_id = s.id
     where s.workspace_id = ${workspaceId}`;
  return ({ item, state }) =>
    rows
      .filter((r) => r.state === state && (item === undefined || r.item === item))
      .reduce((sum, r) => sum + r.available, 0);
}
