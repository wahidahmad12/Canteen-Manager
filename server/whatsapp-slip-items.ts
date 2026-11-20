import { createHash } from "node:crypto";
import { normalizeExpenseItemAlias } from "../shared/expense-item-alias";

export const normalizeWhatsAppAlias = normalizeExpenseItemAlias;

export function whatsAppAliasKey(description: string, category: string): string {
  return createHash("sha256").update(`${category}:${normalizeWhatsAppAlias(description)}`).digest("hex");
}

export interface WhatsAppMasterItem {
  id: number;
  itemName: string;
  itemCategory: string;
}

export function matchSavedFixedItem(
  description: string,
  master: WhatsAppMasterItem[],
  aliases: Map<string, number>,
): WhatsAppMasterItem | undefined {
  const id = aliases.get(whatsAppAliasKey(description, "fixed"));
  return master.find(item => item.id === id);
}

export function matchWhatsAppMasterItem(
  description: string,
  category: string,
  master: WhatsAppMasterItem[],
  aliases: Map<string, number>,
): WhatsAppMasterItem | undefined {
  return createWhatsAppMasterMatcher(category, master, aliases)(description);
}

export function createWhatsAppMasterMatcher(
  category: string,
  master: WhatsAppMasterItem[],
  aliases: Map<string, number>,
): (description: string) => WhatsAppMasterItem | undefined {
  const eligible = master.filter(item => (item.itemCategory === "Vegetable" ? "vegetable" : "other") === category);
  const byId = new Map(eligible.map(item => [item.id, item]));
  const exact = new Map<string, WhatsAppMasterItem[]>();
  const brackets = new Map<string, WhatsAppMasterItem[]>();
  const add = (index: Map<string, WhatsAppMasterItem[]>, key: string, item: WhatsAppMasterItem) => {
    const matches = index.get(key) ?? [];
    if (!matches.some(match => match.id === item.id)) matches.push(item);
    index.set(key, matches);
  };
  for (const item of eligible) {
    add(exact, normalizeWhatsAppAlias(item.itemName), item);
    const bracketNames = item.itemName.match(/\([^()]+\)/g) ?? [];
    for (const name of bracketNames) add(brackets, normalizeWhatsAppAlias(name.slice(1, -1)), item);
  }
  return description => {
    const saved = byId.get(aliases.get(whatsAppAliasKey(description, category)) ?? -1);
    if (saved) return saved;
    const normalized = normalizeWhatsAppAlias(description);
    if (!normalized) return undefined;
    const exactMatches = exact.get(normalized);
    if (exactMatches?.length === 1) return exactMatches[0];
    const bracketMatches = brackets.get(normalized === "karala" ? "karela" : normalized);
    if (bracketMatches?.length === 1) return bracketMatches[0];
    const fallbackMatches = exact.get(normalizeWhatsAppAlias(normalizeWhatsAppItemDescription(description, category)));
    return fallbackMatches?.length === 1 ? fallbackMatches[0] : undefined;
  };
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
