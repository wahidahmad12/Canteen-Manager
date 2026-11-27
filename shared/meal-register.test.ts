import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  addLunchDue,
  createCalculatedEntry,
  evaluateEntry,
  getMealCost,
  normalizeDinerCode,
  settleEntry,
} from "./meal-register";

test("calculates breakfast and lunch due, clean, and change entries", () => {
  const breakfastDue = createCalculatedEntry("EMP-001", "", "BF", 0);
  assert.equal(getMealCost("BF"), 5);
  assert.equal(breakfastDue.originalDue, 5);
  assert.equal(evaluateEntry(createCalculatedEntry("EMP-002", "", "BF", 5)).statusType, "paid");
  assert.equal(createCalculatedEntry("EMP-003", "", "Lunch", 50).originalReturn, 30);
  assert.equal(createCalculatedEntry("EMP-004", "", "Both", 100).originalReturn, 75);
});

test("settling a breakfast due adds the lunch collection and records both meals", () => {
  const entry = createCalculatedEntry("EMP-001", "", "BF", 0);
  const settled = settleEntry(entry);
  const result = evaluateEntry(settled);
  assert.equal(settled.mealType, "Both");
  assert.equal(settled.lunchCash, 25);
  assert.equal(result.netPaid, 25);
  assert.equal(result.bfPaidAmt, 5);
  assert.equal(result.lunchPaidAmt, 20);
  assert.equal(result.activeDue, 0);
});

test("adding lunch due to a clean breakfast creates a twenty-rupee due", () => {
  const updated = addLunchDue(createCalculatedEntry("EMP-001", "", "BF", 5));
  assert.equal(updated.mealType, "Both");
  assert.equal(updated.originalDue, 20);
  assert.equal(evaluateEntry(updated).activeDue, 20);
});

test("settled returns no longer count as pending", () => {
  const entry = createCalculatedEntry("EMP-001", "", "Both", 100);
  const settled = settleEntry(entry);
  assert.equal(evaluateEntry(settled).activeReturn, 0);
  assert.equal(evaluateEntry(settled).netPaid, 25);
});

test("normalizes numeric diner codes like the legacy register", () => {
  assert.equal(normalizeDinerCode("5"), "EMP-005");
  assert.equal(normalizeDinerCode(" emp-012 "), "EMP-012");
});
