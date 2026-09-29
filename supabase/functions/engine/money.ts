// Money: the record_money stage action and the record-money op (Uang → catat pengeluaran/pemasukan).
// Every entry is whole rupiah in the append-only money ledger. An expense can be spread onto orders
// (delivery cost) or lots, so it shows up where it was spent.

import { z } from "zod";
import type { CardRow } from "./cards.ts";
import { type CardData, resolveValue, type Stage } from "./domain.ts";
import { EngineError } from "./http.ts";
import { method, once, parse } from "./ledger-ops.ts";
import type { Op, OpContext } from "./ops.ts";

type MoneyAction = Extract<Stage["onEnter"][number], { action: "record_money" }>;
type Method = z.infer<typeof method>;

const DIRECTION = {
  customer_payment: "in",
  other_income: "in",
  owner_capital: "in",
  expense: "out",
  owner_draw: "out",
} as const;
type Kind = keyof typeof DIRECTION;

/** The step action's kinds, in the ledger's words. */
const ACTION_KIND: Record<MoneyAction["kind"], Kind> = {
  customer_payment: "customer_payment",
  income: "other_income",
  expense: "expense",
};

interface Entry {
  kind: Kind;
  amount: number;
  method: Method;
  categoryId?: string | null;
  cardId?: string | null;
  partyId?: string | null;
  note?: string | null;
  occurredAt?: string;
  allocations?: { cardId?: string; lotId?: string; amount: number }[];
}

async function categoryId({ tx, workspaceId }: OpContext, key: string): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    select id from expense_category where workspace_id = ${workspaceId} and key = ${key}`;
  if (!row) throw new EngineError("not_found", `Expense category ${key} not found`);
  return row.id;
}

async function post(ctx: OpContext, entry: Entry): Promise<{ entryId: number; allocated: number }> {
  const { tx, workspaceId, userId } = ctx;
  const [row] = await tx<{ id: string }[]>`
    insert into money_entry (workspace_id, direction, kind, amount, method, category_id, card_id,
                             party_id, note, occurred_at, created_by)
    values (${workspaceId}, ${DIRECTION[entry.kind]}, ${entry.kind}, ${entry.amount},
            ${entry.method}, ${entry.categoryId ?? null}, ${entry.cardId ?? null},
            ${entry.partyId ?? null}, ${entry.note ?? null},
            coalesce(${entry.occurredAt ?? null}::timestamptz, now()), ${userId})
    returning id`;
  const entryId = Number(row?.id);
  let allocated = 0;
  for (const a of entry.allocations ?? []) {
    await tx`
      insert into cost_allocation (workspace_id, money_entry_id, card_id, lot_id, amount)
      values (${workspaceId}, ${entryId}, ${a.cardId ?? null}, ${a.lotId ?? null}, ${a.amount})`;
    allocated += a.amount;
  }
  return { entryId, allocated };
}

function methodOf(value: unknown): Method {
  const parsed = method.safeParse(value);
  return parsed.success ? parsed.data : "cash";
}

/** record_money on stage entry, e.g. the payment at Dibayar or the delivery cost at Dikirim. */
export async function recordMoneyAction(
  ctx: OpContext,
  card: CardRow,
  data: CardData,
  action: MoneyAction,
): Promise<Record<string, unknown>> {
  const amount = resolveValue(action.amount, data);
  if (typeof amount !== "number" || !Number.isInteger(amount) || amount < 0) {
    throw new EngineError("conflict", `Amount ${String(action.amount)} is missing`);
  }
  if (amount === 0) return { skipped: "zero amount" };
  const kind = ACTION_KIND[action.kind];
  const allocate = kind === "expense" && action.allocate === "card";
  const { entryId } = await post(ctx, {
    kind,
    amount,
    method: methodOf(card.fields.metode_bayar),
    categoryId: action.category ? await categoryId(ctx, action.category) : null,
    cardId: card.id,
    partyId: card.party_id,
    allocations: allocate ? [{ cardId: card.id, amount }] : [],
  });
  return { entryId, kind, amount, allocatedToCard: allocate };
}

const recordInput = z
  .strictObject({
    idempotencyKey: z.guid(),
    kind: z.enum(Object.keys(DIRECTION) as [Kind, ...Kind[]]),
    amount: z.int().positive(),
    method: method.default("cash"),
    categoryId: z.guid().optional(),
    cardId: z.guid().optional(),
    partyId: z.guid().optional(),
    note: z.string().trim().max(500).optional(),
    occurredAt: z.iso.datetime({ offset: true }).optional(),
    /** Spread an expense onto orders or lots, e.g. one trip's fuel across three deliveries. */
    allocations: z
      .array(
        z
          .strictObject({
            cardId: z.guid().optional(),
            lotId: z.guid().optional(),
            amount: z.int().positive(),
          })
          .refine((a) => (a.cardId === undefined) !== (a.lotId === undefined), {
            message: "Allocate to a card or a lot",
          }),
      )
      .max(50)
      .default([]),
  })
  .refine((e) => e.allocations.length === 0 || e.kind === "expense", {
    message: "Only expenses can be allocated",
  })
  .refine((e) => e.allocations.reduce((sum, a) => sum + a.amount, 0) <= e.amount, {
    message: "Allocations add up to more than the amount",
  });

export const moneyOps: Record<string, Op> = {
  "record-money": async (ctx, raw) => {
    const input = parse(recordInput, raw);
    return once(ctx, "record-money", input.idempotencyKey, input.cardId ?? null, async () => {
      const { tx, workspaceId } = ctx;
      const exists = async (
        table: "expense_category" | "card" | "party" | "stock_lot",
        id?: string,
      ) => {
        if (!id) return;
        const [row] = await tx`
          select 1 from ${tx(table)} where id = ${id} and workspace_id = ${workspaceId}`;
        if (!row) throw new EngineError("not_found", `${table.replace("_", " ")} not found`);
      };
      await exists("expense_category", input.categoryId);
      await exists("card", input.cardId);
      await exists("party", input.partyId);
      for (const a of input.allocations) {
        await exists("card", a.cardId);
        await exists("stock_lot", a.lotId);
      }
      const { entryId, allocated } = await post(ctx, input);
      return { entryId, kind: input.kind, amount: input.amount, allocated, entryIds: [entryId] };
    });
  },
};
