// Stock is counted in whole units (eggs). Movements can be negative; stock on hand never is.

export function assertQuantity(qty: number): number {
  if (!Number.isSafeInteger(qty)) {
    throw new RangeError(`Quantity must be a whole number, got ${qty}`);
  }
  return qty;
}

export function assertPositiveQuantity(qty: number): number {
  if (assertQuantity(qty) <= 0) {
    throw new RangeError(`Quantity must be more than 0, got ${qty}`);
  }
  return qty;
}

const quantityFormat = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

/** "1.205". */
export function formatQuantity(qty: number): string {
  return quantityFormat.format(assertQuantity(qty));
}
