import type { Express, Request, Response } from "express";
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
  type WASocket,
} from "@whiskeysockets/baileys";
import pino from "pino";
import QRCode from "qrcode";
import { storage } from "./storage";

const FIXED_ITEMS: { description: string; uom: string; defaultRate: number }[] = [
  { description: "Cup Dahi 85g", uom: "Kg", defaultRate: 15 },
  { description: "Dahi 100g Khatta", uom: "Pcs", defaultRate: 14 },
  { description: "Dahi 100g Sweet", uom: "Pcs", defaultRate: 22 },
  { description: "Pkt Dahi 1Kg", uom: "Pkt", defaultRate: 77 },
  { description: "Rasgulla", uom: "Pcs", defaultRate: 7 },
  { description: "Egg", uom: "Box", defaultRate: 1150 },
  { description: "Paneer", uom: "Kg", defaultRate: 250 },
  { description: "Petrol", uom: "Ltr", defaultRate: 105 },
  { description: "Transport/Parking", uom: "Trip", defaultRate: 10 },
];

interface ExtractedItem {
  description: string;
  qty?: number | string | null;
  rate?: number | string | null;
  amount?: number | string | null;
  uom?: string | null;
  category?: string;
}

interface ExtractedSlip {
  date: string;
  giveByWahid?: number | string | null;
  akbarAmount?: number | string | null;
  madamOrCashSeal?: number | string | null;
  totalCashReceived?: number | string | null;
  totalExpense?: number | string | null;
  fixedItems?: ExtractedItem[];
  items?: ExtractedItem[];
}

let currentQr: string | null = null;
let connected = false;

const round2 = (n: number) => Math.round(n * 100) / 100;

// Handles numbers, "2 1/2", "1/2", "6.5 kg", "-" (-> null)
export function parseNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const s = v.replace(/,/g, "").trim();
  const mixed = s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)/);
  if (mixed && Number(mixed[3])) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = s.match(/^(\d+)\s*\/\s*(\d+)/);
  if (frac && Number(frac[2])) return Number(frac[1]) / Number(frac[2]);
  const num = s.match(/^-?\d+(\.\d+)?/);
  return num ? Number(num[0]) : null;
}

export function normalizeDate(raw: string): string | null {
  const s = String(raw || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/(\d{1,2})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{2,4})/);
  if (!m) return null;
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const iso = `${year}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso ? null : iso;
}

function matchFixedItem(name: string) {
  const n = name.toLowerCase().replace(/\s+/g, " ").trim();
  const exact = FIXED_ITEMS.find((f) => f.description.toLowerCase() === n);
  if (exact) return exact;
  if (/parking|transport/.test(n)) return FIXED_ITEMS[8];
  if (/petrol/.test(n)) return FIXED_ITEMS[7];
  if (/paneer/.test(n)) return FIXED_ITEMS[6];
  if (/^egg|\begg\b/.test(n)) return FIXED_ITEMS[5];
  if (/rasgulla|rasogolla/.test(n)) return FIXED_ITEMS[4];
  if (/pkt|packet|1\s*kg/.test(n) && /dahi|curd/.test(n)) return FIXED_ITEMS[3];
  if (/dahi|curd/.test(n) && /khatta|sour/.test(n)) return FIXED_ITEMS[1];
  if (/dahi|curd/.test(n) && /sweet|meetha|mitha/.test(n)) return FIXED_ITEMS[2];
  if (/cup/.test(n) && /dahi|curd/.test(n)) return FIXED_ITEMS[0];
  return undefined;
}

const SYSTEM_PROMPT = `You read photos of handwritten daily canteen expense & cash balance slips (Indian, may mix English/Hindi).
Return ONLY JSON with this shape:
{
  "date": "YYYY-MM-DD",              // top right, e.g. "Dt: 18.11.26" is 18 Nov 2026 -> "2026-11-18"
  "giveByWahid": number,             // top-left cash "Give by Wahid", 0 if not mentioned
  "akbarAmount": number|null,        // top-left Akbar / opening cash, null if not written
  "madamOrCashSeal": number,         // Madam / cash seal cash received, 0 if none
  "totalCashReceived": number,       // total cash written on the slip
  "totalExpense": number|null,       // total expense written on the slip, null if absent
  "fixedItems": [{"description": string, "qty": number|string, "amount": number}],
  "items": [{"description": string, "category": "vegetable"|"other", "uom": string, "qty": number|string, "rate": number|null, "amount": number}]
}
fixedItems may only use these names: "Cup Dahi 85g","Dahi 100g Khatta","Dahi 100g Sweet","Pkt Dahi 1Kg","Rasgulla","Egg","Paneer","Petrol","Transport/Parking" ("Parking" -> "Transport/Parking"). If qty is not written use "-".
All other lines go in items: category "vegetable" for fresh vegetables, saag/greens, lemon, chilli, ginger, garlic, potato, onion etc.; "other" for groceries, mithai, besan, roll paper, packaging etc.
Keep qty as written when it is a mixed fraction such as "2 1/2" (do not drop the fraction). uom is usually "Kg" for vegetables, "Pcs" otherwise. Do not invent lines.`;

async function extractWithGemini(image: Buffer, mime: string, key: string): Promise<ExtractedSlip> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: SYSTEM_PROMPT },
            { inline_data: { mime_type: mime, data: image.toString("base64") } },
          ],
        }],
        generationConfig: { response_mime_type: "application/json", temperature: 0 },
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json: any = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";
  return JSON.parse(text);
}

async function extractWithOpenAI(image: Buffer, mime: string, key: string): Promise<ExtractedSlip> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract this slip as JSON." },
            { type: "image_url", image_url: { url: `data:${mime};base64,${image.toString("base64")}` } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json: any = await res.json();
  return JSON.parse(json?.choices?.[0]?.message?.content ?? "{}");
}

async function extractSlip(image: Buffer, mime: string): Promise<ExtractedSlip> {
  if (process.env.GEMINI_API_KEY) return extractWithGemini(image, mime, process.env.GEMINI_API_KEY);
  if (process.env.OPENAI_API_KEY) return extractWithOpenAI(image, mime, process.env.OPENAI_API_KEY);
  throw new Error("Neither GEMINI_API_KEY nor OPENAI_API_KEY is configured");
}

function resolveItem(it: ExtractedItem, fallbackRate = 0) {
  const qtyNum = parseNumber(it.qty);
  const amountNum = parseNumber(it.amount);
  const rateNum = parseNumber(it.rate);
  let qty: number, rate: number, amount: number;
  if (qtyNum && qtyNum > 0) {
    qty = qtyNum;
    if (amountNum !== null) {
      amount = amountNum;
      rate = amount / qty;
    } else {
      rate = rateNum ?? fallbackRate;
      amount = qty * rate;
    }
  } else if (amountNum !== null && amountNum > 0) {
    qty = 1; rate = amountNum; amount = amountNum;
  } else {
    qty = 0; rate = rateNum ?? fallbackRate; amount = 0;
  }
  return { qty: round2(qty), rate: round2(rate), amount: round2(amount) };
}

async function saveSlip(slip: ExtractedSlip) {
  const date = normalizeDate(slip.date);
  if (!date) throw new Error(`Could not read a valid date from the slip (got "${slip.date}")`);

  const stored = await storage.getLatestFixedItemRates();
  const prevRates: Record<string, number> = {};
  for (const f of FIXED_ITEMS) prevRates[f.description] = stored[f.description] ?? f.defaultRate;

  const fixedFromSlip = new Map<string, ExtractedItem>();
  const dynamicFromSlip: ExtractedItem[] = [];
  for (const it of [...(slip.fixedItems ?? []), ...(slip.items ?? [])]) {
    if (!it?.description) continue;
    const fixed = matchFixedItem(it.description);
    if (fixed) fixedFromSlip.set(fixed.description, it);
    else dynamicFromSlip.push(it);
  }

  const rateChanges: string[] = [];
  const items = FIXED_ITEMS.map((f) => {
    const src = fixedFromSlip.get(f.description);
    const r = src ? resolveItem(src, prevRates[f.description]) : { qty: 0, rate: prevRates[f.description], amount: 0 };
    if (src && r.qty > 0 && Math.abs(r.rate - prevRates[f.description]) > 0.01) {
      rateChanges.push(`${f.description}: ${prevRates[f.description]} → ${r.rate}`);
    }
    const rate = src && r.qty > 0 ? r.rate : prevRates[f.description];
    return { category: "fixed", description: f.description, uom: f.uom, ...r, rate };
  });

  const vegNames: string[] = [];
  for (const it of dynamicFromSlip) {
    const category = it.category === "vegetable" ? "vegetable" : "other";
    const description = String(it.description).trim();
    const r = resolveItem(it);
    if (category === "vegetable") vegNames.push(description);
    items.push({ category, description, uom: it.uom?.trim() || (category === "vegetable" ? "Kg" : "Pcs"), ...r });
  }
  if (vegNames.length) await storage.seedVegetableItems(Array.from(new Set(vegNames)));

  const giveByWahid = parseNumber(slip.giveByWahid) ?? 0;
  const receivedAmount = parseNumber(slip.madamOrCashSeal) ?? 0;
  const akbar = parseNumber(slip.akbarAmount);
  const openingBalance = akbar ?? (await storage.getPreviousDayBalance(date));

  const existing = await storage.getReportByDate(date);
  const payload = { date, openingBalance, receivedAmount, giveByWahid, items };
  const report = existing
    ? await storage.updateReport(existing.id, payload)
    : await storage.createReport(payload);

  const total = round2(items.reduce((s, i) => s + i.amount, 0));
  const written = parseNumber(slip.totalExpense);
  return { report, date, total, written, rateChanges, updated: !!existing, count: report.items.length };
}

function formatReply(r: Awaited<ReturnType<typeof saveSlip>>) {
  const lines = [
    `✅ Expense report ${r.updated ? "updated" : "saved"}`,
    `📅 Date: ${r.date}`,
    `🧾 Items: ${r.count}`,
    `💰 Total: ₹${r.total}`,
  ];
  if (r.written !== null && Math.abs(r.written - r.total) > 0.5) {
    lines.push(`⚠️ Warning: items sum ₹${r.total} differs from slip total ₹${r.written}. Please verify.`);
  }
  if (r.rateChanges.length) lines.push("", "📈 Fixed item rates changed:", ...r.rateChanges.map((c) => `• ${c}`));
  return lines.join("\n");
}

export async function startWhatsAppBot(app: Express): Promise<void> {
  app.get("/api/whatsapp/qr", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });
    if (req.session.role !== "admin") return res.status(403).json({ message: "Admin access required" });
    let body: string;
    if (connected) {
      body = `<h2 style="color:#16a34a">Connected</h2>`;
    } else if (currentQr) {
      const img = await QRCode.toDataURL(currentQr);
      body = `<h2>Scan with WhatsApp (Linked Devices)</h2><img src="${img}" width="300" height="300" alt="WhatsApp QR"/>
<script>setTimeout(()=>location.reload(),15000)</script>`;
    } else {
      body = `<h2>Waiting for QR code…</h2><script>setTimeout(()=>location.reload(),3000)</script>`;
    }
    res.type("html").send(`<!doctype html><html><head><meta charset="utf-8"><title>WhatsApp Bot</title></head>
<body style="font-family:sans-serif;text-align:center;padding:2rem">${body}</body></html>`);
  });

  const logger = pino({ level: "silent" });
  const { state, saveCreds } = await useMultiFileAuthState("whatsapp_auth_session");
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined as any }));

  const connect = () => {
    const sock: WASocket = makeWASocket({ auth: state, logger, ...(version ? { version } : {}) });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
      if (qr) currentQr = qr;
      if (connection === "open") {
        connected = true;
        currentQr = null;
        console.log("[whatsapp] connected");
      } else if (connection === "close") {
        connected = false;
        const code = (lastDisconnect?.error as any)?.output?.statusCode;
        if (code === DisconnectReason.loggedOut) {
          console.log("[whatsapp] logged out; delete whatsapp_auth_session/ and restart to re-link");
        } else {
          setTimeout(connect, 3000);
        }
      }
    });

    sock.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type !== "notify") return;
      const allowed = process.env.WHATSAPP_REPORT_SENDER;
      if (!allowed) return;
      for (const msg of messages) {
        const jid = msg.key.remoteJid;
        if (!jid || msg.key.fromMe || jid.endsWith("@g.us") || jid !== allowed) continue;
        const image = msg.message?.imageMessage;
        if (!image) continue;
        try {
          const buffer = (await downloadMediaMessage(msg, "buffer", {}, {
            logger,
            reuploadRequest: sock.updateMediaMessage,
          })) as Buffer;
          const slip = await extractSlip(buffer, image.mimetype || "image/jpeg");
          const result = await saveSlip(slip);
          await sock.sendMessage(jid, { text: formatReply(result) });
        } catch (err: any) {
          console.error("[whatsapp] failed to process slip:", err);
          await sock.sendMessage(jid, { text: `❌ Could not process the slip: ${err?.message ?? "unknown error"}` }).catch(() => {});
        }
      }
    });
  };

  connect();
}
