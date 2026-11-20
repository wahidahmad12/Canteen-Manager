import { createWhatsAppMasterMatcher, normalizeWhatsAppAlias, whatsAppAliasKey, type WhatsAppMasterItem } from "./whatsapp-slip-items";

export type VoiceCategory = "fixed" | "vegetable" | "other";

export function eligibleVoiceItem(item: WhatsAppMasterItem, category: VoiceCategory): boolean {
  return category === "fixed" || (item.itemCategory === "Vegetable" ? "vegetable" : "other") === category;
}

export function findVoiceItemPhrases(
  transcript: string,
  category: VoiceCategory,
  master: WhatsAppMasterItem[],
  aliases: Map<string, number>,
): { phrase: string; itemId: number }[] {
  const words = Array.from(transcript.matchAll(/[\w\u0900-\u097f\u0980-\u09ff]+/g));
  const eligible = master.filter(item => eligibleVoiceItem(item, category));
  const byId = new Map(eligible.map(item => [item.id, item]));
  const fixedItems = eligible.map(item => ({ ...item, itemCategory: "General" }));
  const matchMaster = createWhatsAppMasterMatcher(category === "fixed" ? "other" : category, category === "fixed" ? fixedItems : eligible, new Map());
  const found = new Map<string, { phrase: string; itemId: number }>();
  for (let start = 0; start < words.length; start++) {
    for (let end = start; end < Math.min(words.length, start + 16); end++) {
      const phrase = transcript.slice(words[start].index!, words[end].index! + words[end][0].length);
      if (phrase.length > 255 || /[;!?]/.test(phrase)) break;
      const key = normalizeWhatsAppAlias(phrase);
      if (!key || found.has(key)) continue;
      const saved = byId.get(aliases.get(whatsAppAliasKey(phrase, category)) ?? -1);
      const match = saved ?? matchMaster(phrase);
      if (match) found.set(key, { phrase, itemId: match.id });
    }
  }
  return Array.from(found.values());
}
