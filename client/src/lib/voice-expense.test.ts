import { strict as assert } from "node:assert";
import { test } from "node:test";
import { parseVoiceExpenseTranscript, parseVoiceExpenseWithMatches, updateVoiceExpenseItem } from "./voice-expense";

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

test("reviews saved and bracket matches in consecutive voice entries", () => {
  const items = [
    { id: 1, name: "Green Chilli (Haree Mirch)", category: "vegetable" as const, uom: "Kg" },
    { id: 2, name: "Bitter Gourd (Karela)", category: "vegetable" as const, uom: "Kg" },
  ];
  const parsed = parseVoiceExpenseWithMatches("G. Chilli 10 kilo total 750 karala 2 kilo rate 50", items, "vegetable", [
    { phrase: "G. Chilli", itemId: 1 }, { phrase: "karala", itemId: 2 },
  ]);
  assert.deepEqual(parsed.map(item => [item.heard, item.description, item.qty, item.rate, item.amount]), [
    ["G. Chilli", "Green Chilli (Haree Mirch)", 10, 75, 750],
    ["karala", "Bitter Gourd (Karela)", 2, 50, 100],
  ]);
});

test("does not apply saved matches from another section or removed master", () => {
  const parsed = parseVoiceExpenseWithMatches("chawal 2 kilo rate 50", [
    { id: 3, name: "Rice", category: "other", uom: "Kg" },
  ], "vegetable", [{ phrase: "chawal", itemId: 3 }, { phrase: "chawal", itemId: 99 }]);
  assert.equal(parsed[0].description, "chawal");
  assert.equal(parsed[0].heard, "chawal");
});

test("keeps unfamiliar consecutive items after a rate or total for manual mapping", () => {
  const parsed = parseVoiceExpenseWithMatches(
    "lauki 10 kilo total 750 tinda 2 kilo rate 50",
    [], "vegetable", [],
  );
  assert.deepEqual(parsed.map(item => [item.heard, item.qty, item.rate, item.amount]), [
    ["lauki", 10, 75, 750], ["tinda", 2, 50, 100],
  ]);
});

test("explicit saved mapping wins over a different exact master name", () => {
  const parsed = parseVoiceExpenseWithMatches("karela 2 kilo rate 50", [
    { id: 1, name: "Karela", category: "vegetable", uom: "Kg" },
    { id: 2, name: "Bitter Gourd (Karela)", category: "vegetable", uom: "Kg" },
  ], "vegetable", [{ phrase: "karela", itemId: 2 }]);
  assert.equal(parsed[0].description, "Bitter Gourd (Karela)");
});

test("heard names retain product sizes and words so the saved alias reflects what was said", () => {
  const items = [
    { id: 1, name: "Dahi 100g Khatta", category: "fixed" as const, uom: "Pcs" },
    { id: 2, name: "Pkt Dahi 1Kg", category: "fixed" as const, uom: "Pkt" },
  ];
  const first = parseVoiceExpenseWithMatches("Dahi 100g Khatta 10 pcs rate 21", items, "fixed", []);
  assert.equal(first[0].heard, "Dahi 100g Khatta");
  const second = parseVoiceExpenseWithMatches("Pkt Dahi 1 kilo total 75", items, "fixed", []);
  assert.equal(second[0].heard, "Pkt Dahi 1 kilo");
  const unknown = parseVoiceExpenseWithMatches("Salt and Pepper 250g 10 packets rate 21", [], "other", []);
  assert.equal(unknown[0].heard, "Salt and Pepper 250g");
});

test("resolves distinct saved product sizes independently in one transcript", () => {
  const items = [
    { id: 1, name: "Dahi 100g Khatta", category: "fixed" as const, uom: "Pcs" },
    { id: 2, name: "Dahi 200g Khatta", category: "fixed" as const, uom: "Pcs" },
  ];
  const parsed = parseVoiceExpenseWithMatches("Dahi 100g Khatta 10 pcs rate 21 Dahi 200g Khatta 5 pcs rate 30", items, "fixed", [
    { phrase: "Dahi 100g Khatta", itemId: 1 },
    { phrase: "Dahi 200g Khatta", itemId: 2 },
  ]);
  assert.deepEqual(parsed.map(item => [item.description, item.qty, item.rate]), [
    ["Dahi 100g Khatta", 10, 21], ["Dahi 200g Khatta", 5, 30],
  ]);
});

test("does not apply a saved alias to a different product size", () => {
  const items = [{ id: 1, name: "Rock Salt", category: "other" as const, uom: "Pkt" }];
  const parsed = parseVoiceExpenseWithMatches("salt 100g 10 pcs rate 10 salt 250g 5 pcs rate 20", items, "other", [
    { phrase: "salt 250g", itemId: 1 },
  ]);
  assert.notEqual(parsed[0].description, "Rock Salt");
  assert.equal(parsed[1].description, "Rock Salt");
  assert.equal(parsed[1].qty, 5);
});
