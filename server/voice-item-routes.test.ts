import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { AddressInfo } from "node:net";
import express from "express";
import { registerVoiceItemRoutes } from "./voice-item-routes";
import { matchSavedFixedItem, matchWhatsAppMasterItem, whatsAppAliasKey } from "./whatsapp-slip-items";

test("voice selections persist shared, category-scoped mappings and enforce permission", async () => {
  const app = express();
  app.use(express.json());
  const items = [
    { id: 1, itemName: "Bitter Gourd (Karela)", itemCategory: "Vegetable" },
    { id: 2, itemName: "Rice", itemCategory: "General" },
  ];
  const aliases = new Map<string, number>();
  registerVoiceItemRoutes(app, (req, res, next) => {
    if (req.header("expense-access") !== "yes") return res.sendStatus(403);
    next();
  }, {
    getItems: async () => items,
    getAliases: async () => aliases,
    saveAlias: async (key, id) => { aliases.set(key, id); },
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const post = (path: string, data: unknown, allowed = true) => fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "expense-access": allowed ? "yes" : "no" },
    body: JSON.stringify(data),
  });
  try {
    const body = { description: "local sabzi", category: "vegetable", itemId: 1 };
    assert.equal((await post("/api/voice-expense/map-item", body, false)).status, 403);
    assert.equal(aliases.size, 0);
    assert.equal((await post("/api/voice-expense/map-item", { ...body, itemId: 2 })).status, 400);
    assert.equal((await post("/api/voice-expense/map-item", body)).status, 200);
    assert.equal(matchWhatsAppMasterItem("LOCAL SABZI", "vegetable", items, aliases)?.id, 1);
    const response = await post("/api/voice-expense/matches", { transcript: "local sabzi 10 kg total 750", category: "vegetable" });
    const matches: { phrase: string; itemId: number }[] = await response.json();
    assert.ok(matches.some(match => match.phrase === "local sabzi" && match.itemId === 1));
    aliases.set(whatsAppAliasKey("chawal", "other"), 2);
    const fromWhatsApp = await post("/api/voice-expense/matches", { transcript: "chawal 2 kilo rate 50", category: "other" });
    const matched: { phrase: string; itemId: number }[] = await fromWhatsApp.json();
    assert.ok(matched.some(match => match.phrase === "chawal" && match.itemId === 2));
    assert.equal((await post("/api/voice-expense/map-item", { description: "fixed chawal", category: "fixed", itemId: 2 })).status, 200);
    assert.equal(matchSavedFixedItem("fixed chawal", items, aliases)?.id, 2);
    assert.equal((await post("/api/voice-expense/map-item", { ...body, description: "!!!" })).status, 400);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
