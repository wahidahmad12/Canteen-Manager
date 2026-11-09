import { strict as assert } from "node:assert";
import { test } from "node:test";
import { contractorInvoiceItems, contractorMealRate } from "./contractor-meals";

const rates = { Breakfast: "4.6", Lunch: "11.6", Dinner: "11.6", Special: "26" };

test("special meal is the fourth invoice item with its own rate", () => {
  const items = contractorInvoiceItems({ breakfast: "2", lunch: "", dinner: "", special: "10" }, rates);
  assert.deepEqual(items.map(({ number, meal, total }) => ({ number, meal, total })), [
    { number: 1, meal: "Breakfast", total: 9.2 },
    { number: 4, meal: "Special Lunch & Dinner", total: 260 },
  ]);
});

test("zero and blank special quantities do not appear on an invoice", () => {
  for (const special of ["0", ""]) {
    const items = contractorInvoiceItems({ breakfast: "", lunch: "1", dinner: "", special }, rates);
    assert.deepEqual(items.map((item) => item.meal), ["Lunch"]);
  }
});

test("special meal uses its saved rate or the default rate", () => {
  assert.equal(contractorMealRate("Special", 0), 26);
  assert.equal(contractorMealRate("Special", "16.25"), 16.25);
  assert.equal(contractorMealRate("Breakfast", 0), 4.6);
  assert.equal(contractorMealRate("Dinner", 0), 11.6);
});
