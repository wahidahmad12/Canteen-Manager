import { strict as assert } from "node:assert";
import { test } from "node:test";
import { requestGeminiSlip } from "./gemini-slip";

test("retries a 503 with the alternate Gemini model and the same image", async () => {
  const requests: { url: string; body: string }[] = [];
  const fetchStub: typeof fetch = async (input, init) => {
    requests.push({ url: String(input), body: String(init?.body) });
    if (requests.length === 1) return new Response("busy", { status: 503 });
    return Response.json({ candidates: [{ content: { parts: [{ text: '{"date":"2026-11-19"}' }] } }] });
  };
  const result = await requestGeminiSlip(Buffer.from("photo"), "image/jpeg", "test-key", "prompt", fetchStub);
  assert.deepEqual(result, { date: "2026-11-19" });
  assert.match(requests[0].url, /gemini-3\.8-flash/);
  assert.match(requests[1].url, /gemini-3\.1-flash-lite/);
  assert.equal(requests[0].body, requests[1].body);
});

test("does not retry unrelated Gemini errors", async () => {
  let calls = 0;
  const fetchStub: typeof fetch = async () => {
    calls++;
    return new Response("invalid key", { status: 401 });
  };
  await assert.rejects(requestGeminiSlip(Buffer.from("photo"), "image/jpeg", "test-key", "prompt", fetchStub), /Gemini error 401/);
  assert.equal(calls, 1);
});

test("reports the fallback error if both models are unavailable", async () => {
  let calls = 0;
  const fetchStub: typeof fetch = async () => {
    calls++;
    return new Response("busy", { status: 503 });
  };
  await assert.rejects(requestGeminiSlip(Buffer.from("photo"), "image/jpeg", "test-key", "prompt", fetchStub), /503.*after gemini-3\.8-flash returned 503/);
  assert.equal(calls, 2);
});
