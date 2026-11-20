import { strict as assert } from "node:assert";
import { test } from "node:test";
import { parseVoiceExpenseTranscript, updateVoiceExpenseItem } from "./voice-expense";

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
    qty: 0,
    amount: 250,
    rate: 0,
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

test("matches reversed Hindi and Roman Hindi names without guessing ambiguous dahi", () => {
  const fixedItems = [
    { name: "Dahi 100g Khatta", category: "fixed" as const, uom: "Pcs" },
    { name: "Dahi 100g Sweet", category: "fixed" as const, uom: "Pcs" },
    { name: "Cup Dahi 85g", category: "fixed" as const, uom: "Kg" },
  ];
  for (const spoken of ["khatta dahi 10 pcs rate 21", "खट्टा दही १० पीस रेट २१", "खट्टा दही दस पीस रेट इक्कीस"]) {
    const [item] = parseVoiceExpenseTranscript(spoken, fixedItems, "fixed");
    assert.deepEqual(item, {
      description: "Dahi 100g Khatta", category: "fixed", uom: "Pcs",
      qty: 10, rate: 21, amount: 210,
    });
  }
  const [ambiguous] = parseVoiceExpenseTranscript("dahi 10 pcs rate 21", fixedItems, "fixed");
  assert.notEqual(ambiguous.description, "Dahi 100g Khatta");
  assert.notEqual(ambiguous.description, "Dahi 100g Sweet");
});

test("ignores product size when extracting quantity and distinguishes rate from total", () => {
  const fixedItems = [{ name: "Dahi 100g Khatta", category: "fixed" as const, uom: "Pcs" }];
  const [rate] = parseVoiceExpenseTranscript("Dahi 100g Khatta 10 pcs rate 21", fixedItems, "fixed");
  assert.deepEqual([rate.qty, rate.rate, rate.amount], [10, 21, 210]);
  const [total] = parseVoiceExpenseTranscript("Dahi 100g Khatta 10 pcs total 210", fixedItems, "fixed");
  assert.deepEqual([total.qty, total.rate, total.amount], [10, 21, 210]);
  const [missingQty] = parseVoiceExpenseTranscript("khatta dahi rate 21", fixedItems, "fixed");
  assert.deepEqual([missingQty.qty, missingQty.rate, missingQty.amount], [0, 21, 0]);
  const [spokenTotal] = parseVoiceExpenseTranscript("खट्टा दही दस पीस कुल दो सौ रुपये", fixedItems, "fixed");
  assert.deepEqual([spokenTotal.qty, spokenTotal.rate, spokenTotal.amount], [10, 20, 200]);
  const [unlabeledQty] = parseVoiceExpenseTranscript("खट्टा दही दस रेट इक्कीस", fixedItems, "fixed");
  assert.deepEqual([unlabeledQty.qty, unlabeledQty.rate, unlabeledQty.amount], [10, 21, 210]);
});

test("review calculations keep quantity, rate and total consistent", () => {
  const [unpriced] = parseVoiceExpenseTranscript("Aloo कुल 200 रुपये", catalog, "vegetable");
  const withQty = updateVoiceExpenseItem(unpriced, { qty: 4 });
  assert.deepEqual([withQty.qty, withQty.rate, withQty.amount], [4, 50, 200]);
  const withRate = updateVoiceExpenseItem(withQty, { rate: 60 });
  assert.deepEqual([withRate.qty, withRate.rate, withRate.amount], [4, 60, 240]);
  const withAmount = updateVoiceExpenseItem(withRate, { amount: 120 });
  assert.deepEqual([withAmount.qty, withAmount.rate, withAmount.amount], [4, 30, 120]);
});

test("starts the next catalog item after rate or total in one continuous phrase", () => {
  const items = [
    { name: "Dahi 100g Khatta", category: "fixed" as const, uom: "Pcs" },
    { name: "Dahi 100g Sweet", category: "fixed" as const, uom: "Pcs" },
    { name: "Egg", category: "fixed" as const, uom: "Box" },
  ];

  const rateEntries = parseVoiceExpenseTranscript(
    "khatta dahi 10 pieces rate 21 sweet dahi 5 pieces rate 22 egg 2 box rate 1150",
    items,
    "fixed",
  );
  assert.deepEqual(rateEntries.map(item => [item.description, item.qty, item.rate, item.amount]), [
    ["Dahi 100g Khatta", 10, 21, 210],
    ["Dahi 100g Sweet", 5, 22, 110],
    ["Egg", 2, 1150, 2300],
  ]);
});

test("combines speech recognition fragments and calculates unit rate from total", () => {
  const items = [{ name: "Aloo", category: "vegetable" as const, uom: "Kg" }];
  const [entry] = parseVoiceExpenseTranscript("Aloo\n10 kilo\nकुल 750 रुपये", items, "vegetable");
  assert.deepEqual([entry.description, entry.qty, entry.amount, entry.rate], ["Aloo", 10, 750, 75]);
  const [totalAmount] = parseVoiceExpenseTranscript("Aloo 10 kilo total amount 750", items, "vegetable");
  assert.deepEqual([totalAmount.qty, totalAmount.amount, totalAmount.rate], [10, 750, 75]);
});

test("does not mistake fixed product pack size for purchase quantity", () => {
  const items = [{ name: "Dahi 100g Khatta", category: "fixed" as const, uom: "Pcs" }];
  const [entry] = parseVoiceExpenseTranscript("खट्टा दही १०० ग्राम १० पीस रेट २१", items, "fixed");
  assert.deepEqual([entry.qty, entry.rate, entry.amount], [10, 21, 210]);
});
