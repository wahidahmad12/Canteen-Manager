import { test } from "node:test";
import assert from "node:assert/strict";
import { readSavedEntry, reconcileSavedEntry } from "./date-entry-save";

test("saving a row keeps later edits and removes only clean duplicates", () => {
  const saved = { entryDate: "2026-10-21", id: 1, breakfast: 10, _dirty: true };
  const edited = { ...saved, breakfast: 20 };
  const duplicate = { entryDate: saved.entryDate, id: 2, breakfast: 5, _dirty: false };
  const other = { entryDate: "2026-10-22", id: 3, breakfast: 7, _dirty: true };
  assert.deepEqual(reconcileSavedEntry([edited, duplicate, other], [], saved, 1), [edited, other]);
});

test("a newly saved row receives its ID without discarding changes made during save", () => {
  const saved = { entryDate: "2026-10-21", location: "A", breakfast: 1, _dirty: true };
  const edited = { ...saved, breakfast: 2 };
  assert.deepEqual(reconcileSavedEntry([edited], [], saved, 42), [{ ...edited, id: 42 }]);
  assert.deepEqual(reconcileSavedEntry([saved], [], saved, 42), [{ ...saved, id: 42, _dirty: false }]);
});

test("saving one duplicate does not discard unsaved changes in another", () => {
  const saved = { entryDate: "2026-10-21", id: 1, _dirty: true };
  const other = { entryDate: saved.entryDate, id: 2, _dirty: true };
  assert.deepEqual(reconcileSavedEntry([saved, other], [], saved, 1), [{ ...saved, _dirty: false }, other]);
});

test("server-calculated values update a saved row without overwriting later edits", () => {
  const row = { entryDate: "2026-10-21", id: 1, contractorBreakfast: 0, _dirty: true };
  assert.deepEqual(reconcileSavedEntry([row], [], row, 1, { contractorBreakfast: 12 }), [
    { ...row, contractorBreakfast: 12, _dirty: false },
  ]);
  const edited = { ...row, contractorBreakfast: 4 };
  assert.deepEqual(reconcileSavedEntry([edited], [], row, 1, { contractorBreakfast: 12 }), [edited]);
});

test("failed saves do not appear successful", async () => {
  await assert.rejects(readSavedEntry(new Response(JSON.stringify({ message: "Save rejected" }), { status: 409 })), /Save rejected/);
  await assert.rejects(readSavedEntry(new Response("{}")), /entry ID/);
});
