import { strict as assert } from "node:assert";
import { test } from "node:test";
import { parseVoiceExpenseTranscript } from "./voice-expense";

const catalog = [
  { name: "Aloo", category: "vegetable" as const, uom: "Kg" },
  { name: "Petrol", category: "fixed" as const, uom: "Ltr" },
];

test("parses Hindi and English expense lines with quantities and amounts", () => {
  const items = parseVoiceExpenseTranscript("Aloo, 2 kilo, 100 rupees. Petrol, 2 litre, ₹200", catalog);

  assert.deepEqual(items, [
    { description: "Aloo", category: "vegetable", uom: "Kg", qty: 2, amount: 100, rate: 50 },
    { description: "Petrol", category: "fixed", uom: "Ltr", qty: 2, amount: 200, rate: 100 },
  ]);
});

test("normalizes Hindi and Bengali digits and units", () => {
  const items = parseVoiceExpenseTranscript("Aloo २ किलो १५० रुपये; Aloo ২ কিলো ২০০", catalog);

  assert.deepEqual(items[0], {
    description: "Aloo",
    category: "vegetable",
    uom: "Kg",
    qty: 2,
    amount: 150,
    rate: 75,
  });
  assert.equal(items[1].amount, 200);
  assert.equal(items[1].qty, 2);
});

test("keeps unrecognized descriptions as editable other expenses", () => {
  const [item] = parseVoiceExpenseTranscript("Cleaning supplies ₹250", catalog);

  assert.deepEqual(item, {
    description: "Cleaning supplies",
    category: "other",
    uom: "Pcs",
    qty: 1,
    amount: 250,
    rate: 250,
  });
});
