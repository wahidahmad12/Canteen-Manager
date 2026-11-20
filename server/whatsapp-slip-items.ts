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
