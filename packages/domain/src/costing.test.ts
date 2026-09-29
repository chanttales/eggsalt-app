import { describe, expect, it } from "vitest";
import {
  consumeFifo,
  costOfTakes,
  InsufficientStockError,
  orderProfit,
  produceBatch,
  purchaseLot,
  roundUnitCost,
  type LotBalance,
} from "./costing.ts";

// Owner-confirmed numbers for Bisnis Telur Asin (docs/design/01-prd.md, "Worked HPP example").
const PRICE_MENTAH_BUY = 2300;
const PRICE_MATANG_SELL = 3500;
const SUPPLIER_BONUS = 5;
const LPG_60_EGG_BATCH = 1000;

const purchase = purchaseLot({
  paidQty: 200,
  unitPrice: PRICE_MENTAH_BUY,
  bonusQty: SUPPLIER_BONUS,
});
const mentahLot: LotBalance = {
  lotId: "mentah-1",
  qtyRemaining: purchase.qty,
  unitCost: purchase.unitCost,
};

describe("purchase with supplier bonus", () => {
  it("spreads the price over paid and bonus eggs", () => {
    expect(purchase).toEqual({ qty: 205, total: 460_000, unitCost: 2243.9024 });
  });

  it("costs the full price when there is no bonus", () => {
    expect(purchaseLot({ paidQty: 100, unitPrice: 2500 })).toEqual({
      qty: 100,
      total: 250_000,
      unitCost: 2500,
    });
  });

  it("rejects an empty purchase", () => {
    expect(() => purchaseLot({ paidQty: 0, unitPrice: PRICE_MENTAH_BUY })).toThrow(RangeError);
  });
});

describe("FIFO", () => {
  const lots: LotBalance[] = [
    { lotId: "old", qtyRemaining: 30, unitCost: 2243.9024 },
    { lotId: "empty", qtyRemaining: 0, unitCost: 2000 },
    { lotId: "new", qtyRemaining: 100, unitCost: 2300 },
  ];

  it("takes from the oldest lot first and skips empty lots", () => {
    expect(consumeFifo(lots, 45)).toEqual([
      { lotId: "old", qty: 30, unitCost: 2243.9024 },
      { lotId: "new", qty: 15, unitCost: 2300 },
    ]);
  });

  it("refuses to go below zero and says how many are missing", () => {
    const attempt = () =>
      consumeFifo([{ lotId: "matang", qtyRemaining: 38, unitCost: 2338.5197 }], 100);
    expect(attempt).toThrow(InsufficientStockError);
    expect(attempt).toThrow("insufficient stock: short by 62");
  });
});

describe("boiling batch HPP (2 eggs lost per batch)", () => {
  // PRD table "HPP per boiled egg by batch size", rounded to whole rupiah.
  it.each([
    { size: 10, lpg: 250, good: 8, hpp: 2836 },
    { size: 20, lpg: 500, good: 18, hpp: 2521 },
    { size: 30, lpg: 500, good: 28, hpp: 2422 },
    { size: 60, lpg: 1000, good: 58, hpp: 2339 },
  ])("$size eggs with Rp $lpg LPG gives about Rp $hpp per good egg", ({ size, lpg, good, hpp }) => {
    const batch = produceBatch({
      inputs: consumeFifo([mentahLot], size),
      goodQty: good,
      batchCost: lpg,
    });
    expect(batch.lostQty).toBe(2);
    expect(Math.round(batch.goodUnitCost)).toBe(hpp);
  });

  it("keeps 4 decimals like the database", () => {
    const batch = produceBatch({
      inputs: consumeFifo([mentahLot], 60),
      goodQty: 58,
      batchCost: LPG_60_EGG_BATCH,
    });
    expect(batch.totalCost).toBeCloseTo(135_634.144, 6);
    expect(batch.goodUnitCost).toBe(2338.5197);
  });

  it("costs nothing per egg when the whole batch is lost", () => {
    const batch = produceBatch({
      inputs: consumeFifo([mentahLot], 10),
      goodQty: 0,
      batchCost: 250,
    });
    expect(batch).toMatchObject({ goodQty: 0, lostQty: 10, goodUnitCost: 0 });
  });

  it("rejects more good eggs than went into the pot", () => {
    expect(() => produceBatch({ inputs: consumeFifo([mentahLot], 10), goodQty: 11 })).toThrow(
      RangeError,
    );
  });
});

describe("order profit", () => {
  const matangLot: LotBalance = { lotId: "matang-1", qtyRemaining: 58, unitCost: 2338.5197 };

  it("warung order of 20 matang with Rp 5.000 delivery", () => {
    const cogs = costOfTakes(consumeFifo([matangLot], 20));
    expect(cogs).toBe(46_770);
    expect(
      orderProfit({
        lines: [{ unitPrice: PRICE_MATANG_SELL, qty: 20 }],
        cogs,
        directCosts: [5000],
      }),
    ).toEqual({ revenue: 70_000, cogs: 46_770, directCosts: 5000, profit: 18_230 });
  });

  it("can be a loss", () => {
    expect(
      orderProfit({ lines: [{ unitPrice: 3300, qty: 1 }], cogs: 2244, directCosts: [5000] }).profit,
    ).toBe(-3944);
  });
});

describe("unit cost rounding", () => {
  it("rounds half away from zero at 4 decimals", () => {
    expect(roundUnitCost(1.00005)).toBe(1.0001);
    expect(roundUnitCost(1.00004)).toBe(1);
    expect(roundUnitCost(-2.00005)).toBe(-2.0001);
  });
});
