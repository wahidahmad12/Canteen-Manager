const MODELS = ["gemini-3.8-flash", "gemini-3.1-flash-lite"] as const;

export async function requestGeminiSlip<T>(
  image: Buffer,
  mime: string,
  key: string,
  prompt: string,
  fetchImpl: typeof fetch = fetch,
): Promise<T> {
  const body = JSON.stringify({
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: mime, data: image.toString("base64") } },
      ],
    }],
    generationConfig: { response_mime_type: "application/json", temperature: 0 },
  });

  for (let index = 0; index < MODELS.length; index++) {
    const model = MODELS[index];
    const res = await fetchImpl(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body },
    );
    if (res.status === 503 && index === 0) {
      console.warn(`[whatsapp] Gemini model ${model} is unavailable; trying ${MODELS[1]}`);
      continue;
    }
    if (!res.ok) {
      const previous = index > 0 ? ` (after ${MODELS[0]} returned 503)` : "";
      throw new Error(`Gemini error ${res.status}${previous}: ${(await res.text()).slice(0, 200)}`);
    }
    const json: any = await res.json();
    const text = json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";
    return JSON.parse(text);
  }
  throw new Error("No Gemini model was available.");
}
