import { requestGeminiSlip } from "./gemini-slip";

const prompt = `This is a photo of a handwritten grocery list/receipt (may be in Hindi, Marathi or English). Extract every item with its quantity and price. Respond ONLY with JSON: {"items":[{"itemName":string,"quantity":string,"cost":number}]}. Use the item name as written (transliterate to Latin letters if needed). quantity like "1 kg", "2 pc", or "" if not written. cost is the price number, 0 if unreadable.`;

export async function scanGroceryImage(
  image: string,
  mime: string,
  base64: string,
  keys: { gemini?: string; openai?: string },
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  const geminiKey = keys.gemini || (keys.openai?.startsWith("AIza") ? keys.openai : undefined);
  if (geminiKey) {
    return requestGeminiSlip(Buffer.from(base64, "base64"), mime, geminiKey, prompt, fetchImpl);
  }
  if (!keys.openai) {
    throw new Error("Neither GEMINI_API_KEY nor OPENAI_API_KEY is configured");
  }
  const response = await fetchImpl("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${keys.openai}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 1500,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: image } },
      ] }],
    }),
  });
  if (!response.ok) {
    throw new Error(`OpenAI error ${response.status}: ${(await response.text()).slice(0, 200)}`);
  }
  const json = await response.json() as { choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned an empty answer");
  return JSON.parse(content);
}
