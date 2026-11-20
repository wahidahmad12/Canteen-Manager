import { createHash } from "node:crypto";

export function normalizeWhatsAppAlias(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/[^a-z0-9\u0900-\u097f\u0980-\u09ff]/g, "");
}

export function whatsAppAliasKey(description: string, category: string): string {
  return createHash("sha256").update(`${category}:${normalizeWhatsAppAlias(description)}`).digest("hex");
}

export interface WhatsAppMasterItem {
  id: number;
  itemName: string;
  itemCategory: string;
}

export function matchWhatsAppMasterItem(
  description: string,
  category: string,
  master: WhatsAppMasterItem[],
  aliases: Map<string, number>,
): WhatsAppMasterItem | undefined {
  const eligible = master.filter(item => (item.itemCategory === "Vegetable" ? "vegetable" : "other") === category);
  const savedId = aliases.get(whatsAppAliasKey(description, category));
  const saved = eligible.find(item => item.id === savedId);
  if (saved) return saved;
  const normalized = normalizeWhatsAppAlias(description);
  if (!normalized) return undefined;
  const exact = eligible.filter(item => normalizeWhatsAppAlias(item.itemName) === normalized);
  if (exact.length === 1) return exact[0];
  const bracketKey = normalized === "karala" ? "karela" : normalized;
  const bracketMatches = eligible.filter(item => {
    const bracketNames = item.itemName.match(/\([^()]+\)/g) ?? [];
    return bracketNames.some(name => normalizeWhatsAppAlias(name.slice(1, -1)) === bracketKey);
  });
  if (bracketMatches.length === 1) return bracketMatches[0];
  const fallback = normalizeWhatsAppItemDescription(description, category);
  const fallbackMatches = eligible.filter(item => normalizeWhatsAppAlias(item.itemName) === normalizeWhatsAppAlias(fallback));
  return fallbackMatches.length === 1 ? fallbackMatches[0] : undefined;
}

export function normalizeWhatsAppItemDescription(description: string, category: string): string {
  const trimmed = description.trim();
  if (category === "vegetable" && /^g\s*\.?\s*chill?i$/i.test(trimmed)) {
    return "Green Chilli (Haree Mirch)";
  }
  if (category === "vegetable" && /^phool\s*go+b(?:i|hi|hee)$/i.test(trimmed)) {
    return "Cauliflower (Phool Gobhee)";
  }
  return trimmed;
}
