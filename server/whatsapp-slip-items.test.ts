import { strict as assert } from "node:assert";
import { test } from "node:test";
import { matchSavedFixedItem, matchWhatsAppMasterItem, normalizeWhatsAppItemDescription, whatsAppAliasKey } from "./whatsapp-slip-items";

test("maps WhatsApp vegetable G.Chilli spelling variants to the green chilli item", () => {
  for (const name of ["G.Chilli", "g. chilli", "G Chilli", "G.Chili"]) {
    assert.equal(normalizeWhatsAppItemDescription(name, "vegetable"), "Green Chilli (Haree Mirch)");
  }
});

test("maps Phoolgobi vegetable spelling variants to the cauliflower item", () => {
  for (const name of ["Phoolgobi", "phool gobi", "Phool Gobhi", "Phool Gobhee"]) {
    assert.equal(normalizeWhatsAppItemDescription(name, "vegetable"), "Cauliflower (Phool Gobhee)");
  }
});

test("does not rename other chilli items or non-vegetable entries", () => {
  assert.equal(normalizeWhatsAppItemDescription("Red Chilli", "vegetable"), "Red Chilli");
  assert.equal(normalizeWhatsAppItemDescription("G.Chilli Powder", "vegetable"), "G.Chilli Powder");
  assert.equal(normalizeWhatsAppItemDescription("G.Chilli", "other"), "G.Chilli");
  assert.equal(normalizeWhatsAppItemDescription("Phoolgobi", "other"), "Phoolgobi");
  assert.equal(normalizeWhatsAppItemDescription("Phoolgobi pickle", "vegetable"), "Phoolgobi pickle");
  assert.equal(normalizeWhatsAppItemDescription("  Tomato  ", "vegetable"), "Tomato");
});

test("matches unambiguous Item Master bracket names and known slip variants", () => {
  const master = [
    { id: 1, itemName: "Bitter Gourd (Karela)", itemCategory: "Vegetable" },
    { id: 2, itemName: "Green Chilli (Haree Mirch)", itemCategory: "Vegetable" },
    { id: 3, itemName: "Cauliflower (Phool Gobhee)", itemCategory: "Vegetable" },
  ];
  assert.equal(matchWhatsAppMasterItem("karala", "vegetable", master, new Map())?.id, 1);
  assert.equal(matchWhatsAppMasterItem("Karela", "vegetable", master, new Map())?.id, 1);
  assert.equal(matchWhatsAppMasterItem("G.Chilli", "vegetable", master, new Map())?.id, 2);
  assert.equal(matchWhatsAppMasterItem("Phoolgobi", "vegetable", master, new Map())?.id, 3);
  assert.equal(matchWhatsAppMasterItem("Karela", "other", master, new Map()), undefined);
});

test("remembers a user-selected master id across case and punctuation, without guessing ambiguous names", () => {
  const master = [
    { id: 1, itemName: "Bitter Gourd (Karela)", itemCategory: "Vegetable" },
    { id: 2, itemName: "Other Gourd (Karela)", itemCategory: "Vegetable" },
  ];
  assert.equal(matchWhatsAppMasterItem("Karela", "vegetable", master, new Map()), undefined);
  const aliases = new Map([[whatsAppAliasKey("G. Chilli", "vegetable"), 1]]);
  assert.equal(matchWhatsAppMasterItem("g chilli", "vegetable", master, aliases)?.id, 1);
  assert.equal(matchWhatsAppMasterItem("g chilli", "other", master, aliases), undefined);
  assert.equal(matchWhatsAppMasterItem("g chilli", "vegetable", master.filter(item => item.id !== 1), aliases), undefined);
});

test("fixed voice mappings resolve to current Item Master items for WhatsApp", () => {
  const master = [{ id: 1, itemName: "Rice", itemCategory: "General" }];
  const aliases = new Map([[whatsAppAliasKey("chawal", "fixed"), 1]]);
  assert.equal(matchSavedFixedItem("Chawal", master, aliases)?.itemName, "Rice");
  assert.equal(matchSavedFixedItem("Chawal", [], aliases), undefined);
  assert.equal(matchWhatsAppMasterItem("Chawal", "other", master, aliases), undefined);
});
