import { strict as assert } from "node:assert";
import { test } from "node:test";
import { normalizeWhatsAppItemDescription } from "./whatsapp-slip-items";

test("maps WhatsApp vegetable G.Chilli spelling variants to the green chilli item", () => {
  for (const name of ["G.Chilli", "g. chilli", "G Chilli", "G.Chili"]) {
    assert.equal(normalizeWhatsAppItemDescription(name, "vegetable"), "Green Chilli (Haree Mirch)");
  }
});

test("does not rename other chilli items or non-vegetable entries", () => {
  assert.equal(normalizeWhatsAppItemDescription("Red Chilli", "vegetable"), "Red Chilli");
  assert.equal(normalizeWhatsAppItemDescription("G.Chilli Powder", "vegetable"), "G.Chilli Powder");
  assert.equal(normalizeWhatsAppItemDescription("G.Chilli", "other"), "G.Chilli");
  assert.equal(normalizeWhatsAppItemDescription("  Tomato  ", "vegetable"), "Tomato");
});
