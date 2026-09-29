// HPP (cost of goods) math. Mirrors the ledger functions in the database so the app can preview
// exactly what the engine will post. Unit costs keep 4 decimals (numeric(12,4) in Postgres);
// money is rounded to whole rupiah only when a cost is booked.

import { assertRupiah, lineTotal, roundRupiah, sumRupiah, type Rupiah } from "./money";
import { assertPositiveQuantity, assertQuantity } from "./quantity";

const UNIT_COST_SCALE = 10_000;

/** Rounds a per-unit cost to 4 decimals, half away from zero (same as Postgres round(x, 4)). */
export function roundUnitCost(cost: number): number {
  if (!Number.isFinite(cost)) {
    throw new RangeError(`Cannot round unit cost ${cost}`);
  }
  // The tiny nudge keeps values like 1.00005, stored as 1.0000499999..., rounding up as in SQL.
  const scaled = Math.round(Math.abs(cost) * UNIT_COST_SCALE * (1 + Number.EPSILON));
  return scaled === 0 ? 0 : (Math.sign(cost) * scaled) / UNIT_COST_SCALE;
}

export interface PurchaseLot {
  /** Eggs received, bonus included. */
  qty: number;
  /** What was paid: paid qty x price. Bonus eggs are free. */
  total: Rupiah;
  /** Real cost per egg, lowered by the bonus. */
  unitCost: number;
}

/** Buying 200 at Rp 2.300 with 5 bonus: 205 eggs, Rp 460.000, Rp 2.243,9024 each. */
export function purchaseLot(input: {
  paidQty: number;
  unitPrice: Rupiah;
  bonusQty?: number;
}): PurchaseLot {
  const paidQty = assertPositiveQuantity(input.paidQty);
  const bonusQty = assertQuantity(input.bonusQty ?? 0);
  if (bonusQty < 0) {
    throw new RangeError(`Bonus cannot be negative, got ${bonusQty}`);
  }
  const qty = paidQty + bonusQty;
  const total = lineTotal(input.unitPrice, paidQty);
  return { qty, total, unitCost: roundUnitCost(total / qty) };
}

export interface LotBalance {
  lotId: string;
  qtyRemaining: number;
  unitCost: number;
}

export interface LotTake {
  lotId: string;
  qty: number;
  unitCost: number;
}

export class InsufficientStockError extends Error {
  readonly shortBy: number;

  constructor(shortBy: number) {
    super(`insufficient stock: short by ${shortBy}`);
    this.name = "InsufficientStockError";
    this.shortBy = shortBy;
  }
}

/** Takes `qty` from lots in the given order (oldest first), like the engine's FIFO. */
export function consumeFifo(lots: readonly LotBalance[], qty: number): LotTake[] {
  let needed = assertPositiveQuantity(qty);
  const takes: LotTake[] = [];
  for (const lot of lots) {
    if (needed === 0) break;
    const take = Math.min(assertQuantity(lot.qtyRemaining), needed);
    if (take <= 0) continue;
    takes.push({ lotId: lot.lotId, qty: take, unitCost: lot.unitCost });
    needed -= take;
  }
  if (needed > 0) {
    throw new InsufficientStockError(needed);
  }
  return takes;
}

/** Exact (unrounded) cost of what was taken. */
export function takesCost(takes: readonly LotTake[]): number {
  return takes.reduce((total, take) => total + take.qty * take.unitCost, 0);
}

/** HPP booked for a sale or return: the cost of the eggs taken, in whole rupiah. */
export function costOfTakes(takes: readonly LotTake[]): Rupiah {
  return roundRupiah(takesCost(takes));
}

export interface BatchResult {
  goodQty: number;
  lostQty: number;
  /** Cost of the input eggs plus batch costs (LPG, etc.), unrounded. */
  totalCost: number;
  /** HPP per good egg. Lost eggs cost 0 because their cost is carried by the good ones. */
  goodUnitCost: number;
}

/** Boiling 60 eggs at Rp 2.243,9024 with Rp 1.000 LPG, 58 good: Rp 2.338,5197 per good egg. */
export function produceBatch(input: {
  inputs: readonly LotTake[];
  goodQty: number;
  batchCost?: Rupiah;
}): BatchResult {
  const inputQty = input.inputs.reduce((total, take) => total + take.qty, 0);
  const goodQty = assertQuantity(input.goodQty);
  if (goodQty < 0 || goodQty > inputQty) {
    throw new RangeError(`Good eggs must be between 0 and ${inputQty}, got ${goodQty}`);
  }
  const totalCost = takesCost(input.inputs) + assertRupiah(input.batchCost ?? 0);
  return {
    goodQty,
    lostQty: inputQty - goodQty,
    totalCost,
    goodUnitCost: goodQty === 0 ? 0 : roundUnitCost(totalCost / goodQty),
  };
}

export interface OrderProfit {
  revenue: Rupiah;
  cogs: Rupiah;
  /** Costs allocated to this order, such as its delivery. */
  directCosts: Rupiah;
  profit: Rupiah;
}

/** Profit of one order: revenue - HPP of the eggs sold - costs allocated to it. */
export function orderProfit(input: {
  lines: readonly { unitPrice: Rupiah; qty: number }[];
  cogs: Rupiah;
  directCosts?: readonly Rupiah[];
}): OrderProfit {
  const revenue = sumRupiah(input.lines.map((line) => lineTotal(line.unitPrice, line.qty)));
  const cogs = assertRupiah(input.cogs);
  const directCosts = sumRupiah(input.directCosts ?? []);
  return { revenue, cogs, directCosts, profit: revenue - cogs - directCosts };
}
