import { strict as assert } from "node:assert";
import { test } from "node:test";
import { findVoiceItemPhrases } from "./voice-item-matching";
import { whatsAppAliasKey } from "./whatsapp-slip-items";

const master = [
  { id: 1, itemName: "Bitter Gourd (Karela)", itemCategory: "Vegetable" },
  { id: 2, itemName: "Green Chilli (Haree Mirch)", itemCategory: "Vegetable" },
  { id: 3, itemName: "Rice", itemCategory: "General" },
];

test("finds saved WhatsApp mappings and bracket variants in continuous speech", () => {
  const aliases = new Map([[whatsAppAliasKey("G. Chilli", "vegetable"), 2]]);
  const found = findVoiceItemPhrases("G chilli 10 kg rate 75 karala 2 kg total 100", "vegetable", master, aliases);
  assert.ok(found.some(item => item.phrase === "G chilli" && item.itemId === 2));
  assert.ok(found.some(item => item.phrase === "karala" && item.itemId === 1));
  assert.ok(findVoiceItemPhrases("G.\nChilli 10 kg rate 75", "vegetable", master, aliases)
    .some(item => item.phrase === "G.\nChilli" && item.itemId === 2));
});

test("respects sections, invalidated master items and ambiguous bracket names", () => {
  const aliases = new Map([
    [whatsAppAliasKey("chawal", "other"), 3],
    [whatsAppAliasKey("gone", "vegetable"), 99],
    [whatsAppAliasKey("special rice", "fixed"), 3],
  ]);
  assert.equal(findVoiceItemPhrases("chawal", "vegetable", master, aliases).length, 0);
  assert.equal(findVoiceItemPhrases("gone", "vegetable", master, aliases).length, 0);
  assert.equal(findVoiceItemPhrases("special rice", "fixed", master, aliases).find(m => m.phrase === "special rice")?.itemId, 3);
  const ambiguous = [...master, { id: 4, itemName: "Other Gourd (Karela)", itemCategory: "Vegetable" }];
  assert.equal(findVoiceItemPhrases("karela", "vegetable", ambiguous, aliases).length, 0);
});
