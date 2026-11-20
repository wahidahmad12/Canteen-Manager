export function normalizeWhatsAppItemDescription(description: string, category: string): string {
  const trimmed = description.trim();
  if (category === "vegetable" && /^g\s*\.?\s*chill?i$/i.test(trimmed)) {
    return "Green Chilli (Haree Mirch)";
  }
  return trimmed;
}
