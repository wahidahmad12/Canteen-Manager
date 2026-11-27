type EditableEntry = {
  id?: number;
  entryDate: string;
  location?: string;
  mealType?: string;
  _dirty?: boolean;
};

export async function readSavedEntry(response: Response): Promise<Record<string, unknown> & { id: number }> {
  const result: unknown = await response.json();
  const data = result && typeof result === "object" ? result as Record<string, unknown> : {};
  if (!response.ok) throw new Error(typeof data.message === "string" ? data.message : `Save failed (${response.status})`);
  if (typeof data.id !== "number" || !Number.isSafeInteger(data.id) || data.id <= 0) {
    throw new Error("Save response did not include an entry ID");
  }
  return { ...data, id: data.id };
}

export function reconcileSavedEntry<T extends EditableEntry>(
  previous: T[], fallback: T[], row: T, id: number, savedValues?: Partial<T>,
): T[] {
  const source = previous.length ? previous : fallback;
  const sameKey = (entry: T) =>
    entry.entryDate === row.entryDate && entry.location === row.location && entry.mealType === row.mealType;
  let index = source.findIndex(entry => entry === row || (row.id !== undefined && entry.id === row.id && sameKey(entry)));
  if (index < 0 && row.id === undefined) {
    const matches = source.map((entry, i) => ({ entry, i })).filter(({ entry }) => !entry.id && sameKey(entry));
    if (matches.length === 1) index = matches[0].i;
  }
  if (index < 0) return source;
  return source.flatMap((current, i) => {
    if (i === index) return [{ ...current, ...(current === row ? savedValues : undefined), id, _dirty: current === row ? false : current._dirty }];
    return sameKey(current) && !current._dirty ? [] : [current];
  });
}
