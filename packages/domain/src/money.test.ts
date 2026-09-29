import { describe, expect, it } from "vitest";
import { formatRupiah, formatUnitCost, lineTotal, roundRupiah, sumRupiah } from "./money";

describe("money", () => {
  it("rounds half away from zero", () => {
    expect(roundRupiah(2338.5)).toBe(2339);
    expect(roundRupiah(2338.49)).toBe(2338);
    expect(roundRupiah(-0.5)).toBe(-1);
    expect(roundRupiah(-0.4)).toBe(0);
  });

  it("totals order lines in whole rupiah", () => {
    expect(lineTotal(3500, 20)).toBe(70_000);
    expect(sumRupiah([70_000, -46_770, -5_000])).toBe(18_230);
  });

  it("rejects fractional rupiah", () => {
    expect(() => lineTotal(3500.5, 2)).toThrow(RangeError);
    expect(() => sumRupiah([1, 0.5])).toThrow(RangeError);
  });

  it("formats in Indonesian style", () => {
    expect(formatRupiah(460_000)).toBe("Rp 460.000");
    expect(formatRupiah(-46_770)).toBe("-Rp 46.770");
    expect(formatUnitCost(460_000 / 205)).toBe("Rp 2.243,90");
  });
});
