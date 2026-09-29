"use client";

import { parseBoardGraph, type BoardGraph } from "@domain";
import { useQuery } from "@tanstack/react-query";
import { dayKey } from "@/lib/format";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

// Reads for the screens. Row-level security limits every table to the user's workspaces, and each
// query is keyed by workspace so switching businesses never shows the other one's cached data.

function useWorkspaceId(): string | undefined {
  const { state } = useSession();
  return state.status === "signed_in" ? state.workspace?.id : undefined;
}

function useWorkspaceQuery<T>(
  name: string,
  load: (workspaceId: string) => Promise<T>,
  ready = true,
) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: [workspaceId, name],
    queryFn: () => load(workspaceId as string),
    enabled: Boolean(workspaceId) && ready,
  });
}

function must<T>({ data, error }: { data: T; error: unknown }): NonNullable<T> {
  if (error) throw error;
  return data as NonNullable<T>;
}

export type CardKind = "order" | "production" | "purchase" | "custom";

export interface Board {
  id: string;
  key: string;
  name: string;
  sort: number;
  kind: CardKind;
  cardTypeId: string;
  versionId: string;
  graph: BoardGraph;
}

export function useBoards() {
  return useWorkspaceQuery("boards", async (workspaceId) => {
    const rows = must(
      await supabase()
        .from("board")
        .select(
          "id, key, name, sort, card_type_id, active_version_id, card_type (kind), board_version!board_active_version_fk (graph)",
        )
        .eq("workspace_id", workspaceId)
        .is("archived_at", null)
        .order("sort"),
    );
    return rows.flatMap((row): Board[] => {
      const version = row.board_version as unknown as { graph: unknown } | null;
      const type = row.card_type as unknown as { kind: CardKind } | null;
      if (!version || !type || !row.active_version_id) return [];
      return [
        {
          id: row.id,
          key: row.key,
          name: row.name,
          sort: row.sort,
          kind: type.kind,
          cardTypeId: row.card_type_id,
          versionId: row.active_version_id,
          graph: parseBoardGraph(version.graph),
        },
      ];
    });
  });
}

export interface CardLine {
  productId: string;
  qty: number;
  unitPrice: number;
}

export interface Card {
  id: string;
  number: number;
  boardId: string;
  versionId: string;
  stageKey: string;
  status: "open" | "done" | "cancelled";
  title: string;
  partyId: string | null;
  partyName: string | null;
  partySegment: string | null;
  dueAt: string | null;
  flags: string[];
  fields: Record<string, unknown>;
  parentCardId: string | null;
  rowVersion: number;
  createdAt: string;
  updatedAt: string;
  lines: CardLine[];
}

const CARD_COLUMNS =
  "id, number, board_id, board_version_id, stage_key, status, title, party_id, due_at, flags, fields, parent_card_id, row_version, created_at, updated_at, party (name, segment), card_line (product_id, qty, unit_price)";

type CardRow = {
  id: string;
  number: number;
  board_id: string;
  board_version_id: string;
  stage_key: string;
  status: Card["status"];
  title: string;
  party_id: string | null;
  due_at: string | null;
  flags: string[];
  fields: Record<string, unknown>;
  parent_card_id: string | null;
  row_version: number;
  created_at: string;
  updated_at: string;
  party: { name: string; segment: string | null } | null;
  card_line: { product_id: string; qty: number; unit_price: number }[];
};

function toCard(row: CardRow): Card {
  return {
    id: row.id,
    number: row.number,
    boardId: row.board_id,
    versionId: row.board_version_id,
    stageKey: row.stage_key,
    status: row.status,
    title: row.title,
    partyId: row.party_id,
    partyName: row.party?.name ?? null,
    partySegment: row.party?.segment ?? null,
    dueAt: row.due_at,
    flags: row.flags,
    fields: row.fields,
    parentCardId: row.parent_card_id,
    rowVersion: row.row_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lines: row.card_line.map((l) => ({
      productId: l.product_id,
      qty: l.qty,
      unitPrice: Number(l.unit_price),
    })),
  };
}

export function cardQty(card: Card): number {
  return card.lines.reduce((sum, l) => sum + l.qty, 0);
}

export function cardTotal(card: Card): number {
  return card.lines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0);
}

/** Open cards on every board, newest first. */
export function useOpenCards() {
  return useWorkspaceQuery("cards-open", async (workspaceId) => {
    const rows = must(
      await supabase()
        .from("card")
        .select(CARD_COLUMNS)
        .eq("workspace_id", workspaceId)
        .eq("status", "open")
        .order("created_at", { ascending: false }),
    );
    return (rows as unknown as CardRow[]).map(toCard);
  });
}

export interface StockLevel {
  itemId: string;
  stateId: string;
  stateKey: string;
  stateName: string;
  onHand: number;
  reserved: number;
  available: number;
  sellable: boolean;
  returnable: boolean;
  color: string | null;
  packName: string | null;
  packSize: number | null;
}

export function useStockLevels() {
  return useWorkspaceQuery("stock-levels", async (workspaceId) => {
    const [levels, states] = await Promise.all([
      supabase()
        .from("v_stock_on_hand")
        .select("item_id, state_id, on_hand, reserved, available")
        .eq("workspace_id", workspaceId),
      supabase()
        .from("item_state")
        .select(
          "id, item_id, key, name, sort, sellable, returnable, color, item (pack_name, pack_size)",
        )
        .eq("workspace_id", workspaceId)
        .order("sort"),
    ]);
    const byState = new Map(must(levels).map((l) => [l.state_id, l]));
    return must(states).map((s): StockLevel => {
      const item = s.item as unknown as {
        pack_name: string | null;
        pack_size: number | null;
      } | null;
      return {
        itemId: s.item_id,
        stateId: s.id,
        stateKey: s.key,
        stateName: s.name,
        onHand: byState.get(s.id)?.on_hand ?? 0,
        reserved: byState.get(s.id)?.reserved ?? 0,
        available: byState.get(s.id)?.available ?? 0,
        sellable: s.sellable,
        returnable: s.returnable,
        color: s.color,
        packName: item?.pack_name ?? null,
        packSize: item?.pack_size ?? null,
      };
    });
  });
}

export interface ReturnLot {
  id: string;
  receivedAt: string;
  returnBy: string;
  qtyRemaining: number;
  daysLeft: number;
  supplierId: string | null;
}

/** Supplier lots with raw eggs still to use or send back, soonest first. */
export function useReturnLots() {
  return useWorkspaceQuery("lots-return", async (workspaceId) => {
    const rows = must(
      await supabase()
        .from("v_lots_return_due")
        .select("id, received_at, return_by, qty_remaining, days_left, supplier_id")
        .eq("workspace_id", workspaceId)
        .order("return_by"),
    );
    return rows.map((r): ReturnLot => ({
      id: r.id,
      receivedAt: r.received_at,
      returnBy: r.return_by,
      qtyRemaining: r.qty_remaining,
      daysLeft: r.days_left,
      supplierId: r.supplier_id,
    }));
  });
}

export interface OrderMoney {
  cardId: string;
  title: string;
  number: number;
  revenue: number;
  cogs: number;
  directCosts: number;
  profit: number;
  paid: number;
}

/** Revenue, HPP, costs and payments per order card, from the profit view and the money ledger. */
export function useOrderMoney() {
  return useWorkspaceQuery("order-money", async (workspaceId) => {
    const [profit, payments] = await Promise.all([
      supabase()
        .from("v_order_profit")
        .select("card_id, number, title, revenue, cogs, direct_costs, profit")
        .eq("workspace_id", workspaceId),
      supabase()
        .from("money_entry")
        .select("id, card_id, kind, amount, reverses_id")
        .eq("workspace_id", workspaceId)
        .not("card_id", "is", null)
        .in("kind", ["customer_payment", "reversal"]),
    ]);
    const entries = must(payments);
    const reversed = new Set(entries.map((e) => e.reverses_id).filter(Boolean));
    const paid = new Map<string, number>();
    for (const e of entries) {
      if (e.kind !== "customer_payment" || reversed.has(e.id) || !e.card_id) continue;
      paid.set(e.card_id, (paid.get(e.card_id) ?? 0) + Number(e.amount));
    }
    // A plain object, not a Map, because the cache is saved to IndexedDB as JSON.
    const byCard: Record<string, OrderMoney> = Object.fromEntries(
      must(profit).map((p) => [
        p.card_id,
        {
          cardId: p.card_id,
          title: p.title,
          number: p.number,
          revenue: Number(p.revenue),
          cogs: Number(p.cogs),
          directCosts: Number(p.direct_costs),
          profit: Number(p.profit),
          paid: paid.get(p.card_id) ?? 0,
        } satisfies OrderMoney,
      ]),
    );
    return byCard;
  });
}

export interface Settings {
  timezone: string;
  lpgPerBatch: number;
  expectedLossPerBatch: number;
  unpaidAfterDays: number;
  raw: Record<string, unknown>;
}

export function useSettings() {
  return useWorkspaceQuery("settings", async (workspaceId) => {
    const row = must(
      await supabase()
        .from("workspace")
        .select("timezone, settings")
        .eq("id", workspaceId)
        .single(),
    );
    const s = (row.settings ?? {}) as Record<string, unknown>;
    const num = (v: unknown, fallback: number) => (typeof v === "number" ? v : fallback);
    return {
      timezone: row.timezone,
      lpgPerBatch: num(s.lpg_per_batch, 0),
      expectedLossPerBatch: num(s.expected_loss_per_batch, 0),
      unpaidAfterDays: num(s.unpaid_after_days, 7),
      raw: s,
    } satisfies Settings;
  });
}

/** One card, open or closed. */
export function useCard(id: string | null) {
  return useWorkspaceQuery(
    `card:${id}`,
    async (workspaceId) => {
      const { data: row, error } = await supabase()
        .from("card")
        .select(CARD_COLUMNS)
        .eq("workspace_id", workspaceId)
        .eq("id", id as string)
        .maybeSingle();
      if (error) throw error;
      return row ? toCard(row as unknown as CardRow) : null;
    },
    Boolean(id),
  );
}

/** Cards linked to this one: the batch an order started, or the order a batch serves. */
export function useLinkedCards(card: Card | undefined) {
  return useWorkspaceQuery(
    `card-links:${card?.id}`,
    async (workspaceId) => {
      if (!card) return [];
      const filter = card.parentCardId
        ? `parent_card_id.eq.${card.id},id.eq.${card.parentCardId}`
        : `parent_card_id.eq.${card.id}`;
      const rows = must(
        await supabase()
          .from("card")
          .select(CARD_COLUMNS)
          .eq("workspace_id", workspaceId)
          .or(filter),
      );
      return (rows as unknown as CardRow[]).map(toCard);
    },
    Boolean(card),
  );
}

export interface CardEvent {
  id: number;
  type: string;
  fromStage: string | null;
  toStage: string | null;
  payload: Record<string, unknown>;
  reversesEventId: number | null;
  createdAt: string;
}

export function useCardEvents(cardId: string | null) {
  return useWorkspaceQuery(
    `card-events:${cardId}`,
    async (workspaceId) => {
      const rows = must(
        await supabase()
          .from("card_event")
          .select("id, type, from_stage, to_stage, payload, reverses_event_id, created_at")
          .eq("workspace_id", workspaceId)
          .eq("card_id", cardId as string)
          .order("id", { ascending: false }),
      );
      return rows.map((e): CardEvent => ({
        id: Number(e.id),
        type: e.type,
        fromStage: e.from_stage,
        toStage: e.to_stage,
        payload: e.payload ?? {},
        reversesEventId: e.reverses_event_id === null ? null : Number(e.reverses_event_id),
        createdAt: e.created_at,
      }));
    },
    Boolean(cardId),
  );
}

/** The graph a card follows: the board version it was created on, not necessarily the latest. */
export function useVersionGraph(versionId: string | undefined) {
  return useWorkspaceQuery(
    `version:${versionId}`,
    async (workspaceId) => {
      const row = must(
        await supabase()
          .from("board_version")
          .select("graph")
          .eq("workspace_id", workspaceId)
          .eq("id", versionId as string)
          .single(),
      );
      return parseBoardGraph(row.graph);
    },
    Boolean(versionId),
  );
}

export type FieldType =
  "text" | "number" | "money" | "date" | "datetime" | "select" | "party" | "boolean" | "formula";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  options: string[];
  min?: number;
  max?: number;
}

export function useFieldDefs(cardTypeId: string | undefined) {
  return useWorkspaceQuery(
    `fields:${cardTypeId}`,
    async (workspaceId) => {
      const rows = must(
        await supabase()
          .from("field_def")
          .select("key, label, type, config, required, sort")
          .eq("workspace_id", workspaceId)
          .eq("card_type_id", cardTypeId as string)
          .order("sort"),
      );
      return rows.map((f): FieldDef => {
        const label = (f.label ?? {}) as Record<string, string>;
        const config = (f.config ?? {}) as { options?: string[]; min?: number; max?: number };
        return {
          key: f.key,
          label: label.id ?? label.en ?? f.key,
          type: f.type,
          required: f.required,
          options: config.options ?? [],
          min: config.min,
          max: config.max,
        };
      });
    },
    Boolean(cardTypeId),
  );
}

export interface Product {
  id: string;
  name: string;
  itemId: string;
  stateId: string;
  /** Latest general sell and buy prices valid today (segment prices are applied by the engine). */
  sellPrice: number | null;
  buyPrice: number | null;
}

export function useProducts() {
  return useWorkspaceQuery("products", async (workspaceId) => {
    const [products, prices] = await Promise.all([
      supabase()
        .from("product")
        .select("id, name, item_id, state_id")
        .eq("workspace_id", workspaceId)
        .eq("active", true)
        .order("name"),
      supabase()
        .from("price")
        .select("product_id, kind, unit_price, valid_from")
        .eq("workspace_id", workspaceId)
        .is("segment", null)
        .order("valid_from", { ascending: false }),
    ]);
    const today = dayKey();
    const latest = (productId: string, kind: "sell" | "buy") => {
      const p = must(prices).find(
        (x) => x.product_id === productId && x.kind === kind && x.valid_from <= today,
      );
      return p ? Number(p.unit_price) : null;
    };
    return must(products).map((p): Product => ({
      id: p.id,
      name: p.name,
      itemId: p.item_id,
      stateId: p.state_id,
      sellPrice: latest(p.id, "sell"),
      buyPrice: latest(p.id, "buy"),
    }));
  });
}

export interface Party {
  id: string;
  kind: "customer" | "supplier";
  name: string;
  segment: string | null;
  phone: string | null;
  returnDays: number | null;
  bonusPerPurchase: number | null;
  minPurchaseQty: number | null;
}

export function useParties(kind: Party["kind"]) {
  return useWorkspaceQuery(`parties:${kind}`, async (workspaceId) => {
    const rows = must(
      await supabase()
        .from("party")
        .select("id, kind, name, segment, phone, return_days, bonus_per_purchase, min_purchase_qty")
        .eq("workspace_id", workspaceId)
        .eq("kind", kind)
        .is("archived_at", null)
        .order("name"),
    );
    return rows.map((p): Party => ({
      id: p.id,
      kind: p.kind,
      name: p.name,
      segment: p.segment,
      phone: p.phone,
      returnDays: p.return_days,
      bonusPerPurchase: p.bonus_per_purchase,
      minPurchaseQty: p.min_purchase_qty,
    }));
  });
}

export interface Lot {
  id: string;
  stateId: string;
  source: string;
  supplierId: string | null;
  supplierName: string | null;
  receivedAt: string;
  returnBy: string | null;
  qtyIn: number;
  qtyRemaining: number;
  unitCost: number;
  purchasePrice: number | null;
}

/** Lots with stock left, oldest first (the order FIFO takes them in). */
export function useOpenLots() {
  return useWorkspaceQuery("lots-open", async (workspaceId) => {
    const rows = must(
      await supabase()
        .from("stock_lot")
        .select(
          "id, state_id, source, supplier_id, received_at, return_by, qty_in, qty_remaining, unit_cost, purchase_price, party (name)",
        )
        .eq("workspace_id", workspaceId)
        .gt("qty_remaining", 0)
        .order("received_at"),
    );
    return rows.map((l): Lot => ({
      id: l.id,
      stateId: l.state_id,
      source: l.source,
      supplierId: l.supplier_id,
      supplierName: (l.party as unknown as { name: string } | null)?.name ?? null,
      receivedAt: l.received_at,
      returnBy: l.return_by,
      qtyIn: l.qty_in,
      qtyRemaining: l.qty_remaining,
      unitCost: Number(l.unit_cost),
      purchasePrice: l.purchase_price === null ? null : Number(l.purchase_price),
    }));
  });
}

export interface ExpenseCategory {
  id: string;
  key: string;
  name: string;
}

export function useExpenseCategories() {
  return useWorkspaceQuery("expense-categories", async (workspaceId) => {
    const rows = must(
      await supabase()
        .from("expense_category")
        .select("id, key, name")
        .eq("workspace_id", workspaceId)
        .order("sort"),
    );
    return rows.map((c): ExpenseCategory => ({ id: c.id, key: c.key, name: c.name }));
  });
}

export interface MoneyEntry {
  id: number;
  direction: "in" | "out";
  kind: string;
  amount: number;
  method: string | null;
  categoryName: string | null;
  cardId: string | null;
  partyName: string | null;
  note: string | null;
  occurredAt: string;
  /** Cancelled by a later reversal entry, or itself a reversal. */
  reversed: boolean;
}

type Named = { name: string };

/** Ledger entries since an instant, newest first. Reversal pairs are flagged, not dropped. */
export function useMoneyEntries(since: string) {
  return useWorkspaceQuery(`money-entries:${since}`, async (workspaceId) => {
    const rows = must(
      await supabase()
        .from("money_entry")
        .select(
          "id, direction, kind, amount, method, card_id, note, occurred_at, reverses_id, expense_category (name), party (name)",
        )
        .eq("workspace_id", workspaceId)
        .gte("occurred_at", since)
        .order("occurred_at", { ascending: false }),
    );
    const reversed = new Set(rows.map((r) => r.reverses_id).filter(Boolean));
    return rows.map((r): MoneyEntry => ({
      id: r.id,
      direction: r.direction,
      kind: r.kind,
      amount: Number(r.amount),
      method: r.method,
      categoryName: (r.expense_category as unknown as Named | null)?.name ?? null,
      cardId: r.card_id,
      partyName: (r.party as unknown as Named | null)?.name ?? null,
      note: r.note,
      occurredAt: r.occurred_at,
      reversed: r.kind === "reversal" || reversed.has(r.id),
    }));
  });
}
