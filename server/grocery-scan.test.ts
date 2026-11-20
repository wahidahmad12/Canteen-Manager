import { strict as assert } from "node:assert";
import { test } from "node:test";
import { scanGroceryImage } from "./grocery-scan";

const image = "data:image/jpeg;base64,cGhvdG8=";
const items = { items: [{ itemName: "Rice", quantity: "1 kg", cost: 50 }] };

test("uses the configured Gemini key and retries an unavailable model", async () => {
  const requests: { url: string; body: any }[] = [];
  const fetchStub: typeof fetch = async (input, init) => {
    requests.push({ url: String(input), body: JSON.parse(String(init?.body)) });
    return requests.length === 1
      ? new Response("busy", { status: 503 })
      : Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(items) }] } }] });
  };
  assert.deepEqual(await scanGroceryImage(image, "image/jpeg", "cGhvdG8=", { gemini: "gemini-key", openai: "openai-key" }, fetchStub), items);
  assert.match(requests[0].url, /gemini-3\.8-flash.*key=gemini-key/);
  assert.match(requests[1].url, /gemini-3\.1-flash-lite/);
  assert.equal(requests[1].body.contents[0].parts[1].inline_data.data, "cGhvdG8=");
});

test("supports a legacy Gemini key in OPENAI_API_KEY", async () => {
  const fetchStub: typeof fetch = async (input) => {
    assert.match(String(input), /generativelanguage\.googleapis\.com.*key=AIza-legacy/);
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(items) }] } }] });
  };
  assert.deepEqual(await scanGroceryImage(image, "image/jpeg", "cGhvdG8=", { openai: "AIza-legacy" }, fetchStub), items);
});

test("uses OpenAI when only an OpenAI key is configured", async () => {
  const fetchStub: typeof fetch = async (input, init) => {
    assert.equal(String(input), "https://api.openai.com/v1/chat/completions");
    assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer openai-key");
    assert.equal(JSON.parse(String(init?.body)).messages[0].content[1].image_url.url, image);
    return Response.json({ choices: [{ message: { content: JSON.stringify(items) } }] });
  };
  assert.deepEqual(await scanGroceryImage(image, "image/jpeg", "cGhvdG8=", { openai: "openai-key" }, fetchStub), items);
});

test("reports provider errors and malformed answers", async () => {
  await assert.rejects(scanGroceryImage(image, "image/jpeg", "cGhvdG8=", { openai: "key" }, async () => new Response("invalid key", { status: 401 })), /OpenAI error 401/);
  await assert.rejects(scanGroceryImage(image, "image/jpeg", "cGhvdG8=", { openai: "key" }, async () => Response.json({ choices: [] })), /empty answer/);
  await assert.rejects(scanGroceryImage(image, "image/jpeg", "cGhvdG8=", {}), /Neither GEMINI_API_KEY nor OPENAI_API_KEY/);
});
