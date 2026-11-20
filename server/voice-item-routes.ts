import type { Express, RequestHandler } from "express";
import { z } from "zod";
import { eligibleVoiceItem, findVoiceItemPhrases } from "./voice-item-matching";
import { normalizeWhatsAppAlias, whatsAppAliasKey, type WhatsAppMasterItem } from "./whatsapp-slip-items";

interface VoiceItemStore {
  getItems(): Promise<WhatsAppMasterItem[]>;
  getAliases(): Promise<Map<string, number>>;
  saveAlias(key: string, itemId: number): Promise<void>;
}

export function registerVoiceItemRoutes(app: Express, requireExpense: RequestHandler, store: VoiceItemStore): void {
  app.post("/api/voice-expense/matches", requireExpense, async (req, res) => {
    const input = z.object({
      transcript: z.string().min(1).max(8000),
      category: z.enum(["fixed", "vegetable", "other"]),
    }).safeParse(req.body);
    if (!input.success || (input.data.transcript.match(/[\w\u0900-\u097f\u0980-\u09ff]+/g)?.length ?? 0) > 400) {
      return res.status(400).json({ message: "Transcript is invalid or too long." });
    }
    try {
      const [master, aliases] = await Promise.all([store.getItems(), store.getAliases()]);
      return res.json(findVoiceItemPhrases(input.data.transcript, input.data.category, master, aliases));
    } catch (error) {
      console.error("[voice] failed to load item mappings:", error);
      return res.status(500).json({ message: "Could not load item mappings. Please try again." });
    }
  });

  app.post("/api/voice-expense/map-item", requireExpense, async (req, res) => {
    const input = z.object({
      description: z.string().trim().min(1).max(255),
      category: z.enum(["fixed", "vegetable", "other"]),
      itemId: z.number().int().positive().safe(),
    }).safeParse(req.body);
    if (!input.success || !normalizeWhatsAppAlias(input.data.description) ||
      (input.data.description.match(/[\w\u0900-\u097f\u0980-\u09ff]+/g)?.length ?? 0) > 16) {
      return res.status(400).json({ message: "Choose an item and a valid spoken name of at most 16 words." });
    }
    try {
      const item = (await store.getItems()).find(candidate => candidate.id === input.data.itemId);
      if (!item || !eligibleVoiceItem(item, input.data.category)) {
        return res.status(400).json({ message: "Choose an Item Master item from the same section." });
      }
      await store.saveAlias(whatsAppAliasKey(input.data.description, input.data.category), item.id);
      return res.json({ itemName: item.itemName });
    } catch (error) {
      console.error("[voice] failed to save item mapping:", error);
      return res.status(500).json({ message: "Could not save this item mapping. Please try again." });
    }
  });
}
