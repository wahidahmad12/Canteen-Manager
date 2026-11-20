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

test("section voice entries stay in the selected category, even for known or unmatched items", () => {
  const [vegetable] = parseVoiceExpenseTranscript("Petrol 2 litre 200 rupees", catalog, "vegetable");
  assert.equal(vegetable.category, "vegetable");
  const [other] = parseVoiceExpenseTranscript("Aloo 2 kilo 100 rupees", catalog, "other");
  assert.equal(other.category, "other");
  const [fixed] = parseVoiceExpenseTranscript("Unknown 100 rupees", catalog, "fixed");
  assert.equal(fixed.category, "fixed");
});

test("section matching ignores items from other categories", () => {
  const duplicateNames = [
    { name: "Rice", category: "other" as const, uom: "Bag" },
    { name: "Rice", category: "vegetable" as const, uom: "Kg" },
  ];
  const [item] = parseVoiceExpenseTranscript("Rice 100 rupees", duplicateNames, "vegetable");
  assert.equal(item.category, "vegetable");
  assert.equal(item.uom, "Kg");
});
