export function normalizeExpenseItemAlias(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/[^a-z0-9\u0900-\u097f\u0980-\u09ff]/g, "");
}
