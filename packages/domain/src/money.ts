// Money is always a whole number of rupiah. Unit costs (HPP per egg) may carry fractions and are
// rounded only when they become money, e.g. HPP of a sale = qty x unit cost, rounded once.

export type Rupiah = number;

export function assertRupiah(amount: number): Rupiah {
  if (!Number.isSafeInteger(amount)) {
    throw new RangeError(`Rupiah must be a whole number, got ${amount}`);
  }
  return amount;
}

/** Rounds half away from zero, so 0.5 -> 1 and -0.5 -> -1, the way people round by hand. */
export function roundRupiah(amount: number): Rupiah {
  if (!Number.isFinite(amount)) {
    throw new RangeError(`Cannot round ${amount} to rupiah`);
  }
  const rounded = Math.sign(amount) * Math.round(Math.abs(amount));
  return assertRupiah(rounded === 0 ? 0 : rounded);
}

/** Price x quantity for an order line, e.g. 20 x Rp 3.500 = Rp 70.000. */
export function lineTotal(unitPrice: Rupiah, qty: number): Rupiah {
  return assertRupiah(assertRupiah(unitPrice) * qty);
}

export function sumRupiah(amounts: readonly Rupiah[]): Rupiah {
  return assertRupiah(amounts.reduce((total, amount) => total + assertRupiah(amount), 0));
}

const wholeRupiah = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const unitCostRupiah = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "Rp 3.500", "-Rp 46.770". */
export function formatRupiah(amount: Rupiah): string {
  const sign = amount < 0 ? "-" : "";
  return `${sign}Rp ${wholeRupiah.format(Math.abs(assertRupiah(amount)))}`;
}

/** Unit cost with two decimals, e.g. "Rp 2.243,90" per egg. */
export function formatUnitCost(cost: number): string {
  const sign = cost < 0 ? "-" : "";
  return `${sign}Rp ${unitCostRupiah.format(Math.abs(cost))}`;
}
