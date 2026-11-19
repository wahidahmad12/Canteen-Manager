import type { Express, Request, Response } from "express";
import type { WAMessage, WASocket } from "@whiskeysockets/baileys";
import { randomUUID } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import pino from "pino";
import QRCode from "qrcode";
import { storage } from "./storage";
import { isAllowedSlipMessage, isNewerMessage } from "./whatsapp-message-selection";
import { requestGeminiSlip } from "./gemini-slip";

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
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T00:00:00Z`);
    return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : s;
  }
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
  return requestGeminiSlip<ExtractedSlip>(image, mime, key, SYSTEM_PROMPT);
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

class ReportExistsError extends Error {}

async function saveSlip(slip: ExtractedSlip, allowReplace = true) {
  const date = normalizeDate(slip.date);
  if (!date) throw new Error(`Could not read a valid date from the slip (got "${slip.date}")`);

  const existing = await storage.getReportByDate(date);
  if (existing && !allowReplace) throw new ReportExistsError("A report already exists for this date. Confirm before replacing it.");

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
  let activeSocket: WASocket | undefined;
  let latestImage: WAMessage | undefined;
  let recordQueue = Promise.resolve();
  const pending = new Map<string, { token: string; slip: ExtractedSlip; createdAt: number; saving: boolean }>();
  const cachePath = join("whatsapp_auth_session", "latest-slip.bin");

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

  app.post("/api/whatsapp/fetch", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });
    if (req.session.role !== "admin") return res.status(403).json({ message: "Admin access required" });
    if (!connected || !activeSocket) return res.status(503).json({ message: "WhatsApp is not connected." });
    const allowed = process.env.WHATSAPP_REPORT_SENDER;
    if (!allowed) return res.status(503).json({ message: "WHATSAPP_REPORT_SENDER is not configured." });
    if (pending.get(req.sessionID)?.saving) return res.status(409).json({ message: "A slip is already being saved." });
    try {
      await recordQueue;
      if (!latestImage || !isAllowedSlipMessage(latestImage, allowed)) {
        return res.status(404).json({ message: "No slip is available in WhatsApp history. Please send the photo again." });
      }
      const { downloadMediaMessage, extractMessageContent } = await import("@whiskeysockets/baileys");
      const image = extractMessageContent(latestImage.message)?.imageMessage;
      if (!image) throw new Error("The saved WhatsApp message does not contain an image.");
      const buffer = await downloadMediaMessage(latestImage, "buffer", {}, {
        logger: pino({ level: "silent" }),
        reuploadRequest: activeSocket.updateMediaMessage,
      });
      const slip = await extractSlip(buffer, image.mimetype || "image/jpeg");
      const date = normalizeDate(slip.date);
      if (!date) throw new Error("Could not read a valid date from the slip.");
      const existing = await storage.getReportByDate(date);
      const token = randomUUID();
      pending.forEach((entry, sessionId) => {
        if (!entry.saving && Date.now() - entry.createdAt > 10 * 60_000) pending.delete(sessionId);
      });
      pending.set(req.sessionID, { token, slip, createdAt: Date.now(), saving: false });
      return res.json({ token, date, exists: !!existing });
    } catch (error) {
      console.error("[whatsapp] failed to fetch slip:", error);
      return res.status(500).json({ message: error instanceof Error ? error.message : "Could not fetch the slip." });
    }
  });

  app.post("/api/whatsapp/fetch/save", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });
    if (req.session.role !== "admin") return res.status(403).json({ message: "Admin access required" });
    const entry = pending.get(req.sessionID);
    if (!entry || entry.token !== req.body?.token || Date.now() - entry.createdAt > 10 * 60_000) {
      return res.status(400).json({ message: "Slip preview expired. Fetch it again." });
    }
    if (entry.saving) return res.status(409).json({ message: "This slip is already being saved." });
    entry.saving = true;
    try {
      const result = await saveSlip(entry.slip, req.body?.confirmReplace === true);
      pending.delete(req.sessionID);
      return res.json({ id: result.report.id, date: result.date, updated: result.updated });
    } catch (error) {
      if (error instanceof ReportExistsError) return res.status(409).json({ code: "REPORT_EXISTS", message: error.message });
      console.error("[whatsapp] failed to save fetched slip:", error);
      return res.status(500).json({ message: error instanceof Error ? error.message : "Could not save the slip." });
    } finally {
      entry.saving = false;
    }
  });

  // Baileys is ESM-only; keep this import dynamic in the production CommonJS bundle.
  const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage, fetchLatestBaileysVersion, extractMessageContent, proto } =
    await import("@whiskeysockets/baileys");
  const logger = pino({ level: "silent" });
  const { state, saveCreds } = await useMultiFileAuthState("whatsapp_auth_session");
  try {
    const cached: { message: string; remoteJidAlt?: string } = JSON.parse(await readFile(cachePath, "utf8"));
    const message = proto.WebMessageInfo.decode(Buffer.from(cached.message, "base64"));
    if (!message.key?.remoteJid) throw new Error("Cached WhatsApp message has no sender.");
    latestImage = { ...message, key: { ...message.key, remoteJidAlt: cached.remoteJidAlt } };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") console.error("[whatsapp] failed to read cached slip:", error);
  }
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined as any }));

  const connect = () => {
    const sock: WASocket = makeWASocket({ auth: state, logger, ...(version ? { version } : {}) });

    const isAllowed = async (msg: WAMessage, allowed: string) => {
      if (msg.key.fromMe) return false;
      if (!msg.key.remoteJidAlt && msg.key.remoteJid?.endsWith("@lid")) {
        msg.key.remoteJidAlt = await sock.signalRepository.lidMapping.getPNForLID(msg.key.remoteJid) || undefined;
      }
      return isAllowedSlipMessage(msg, allowed);
    };

    const remember = (messages: WAMessage[]) => {
      recordQueue = recordQueue.then(async () => {
        const allowed = process.env.WHATSAPP_REPORT_SENDER;
        if (!allowed) return;
        if (latestImage && !isAllowedSlipMessage(latestImage, allowed)) latestImage = undefined;
        for (const msg of messages) {
          if (!extractMessageContent(msg.message)?.imageMessage || !await isAllowed(msg, allowed)) continue;
          if (!isNewerMessage(msg, latestImage)) continue;
          latestImage = msg;
          const tempPath = `${cachePath}.tmp`;
          await writeFile(tempPath, JSON.stringify({
            message: Buffer.from(proto.WebMessageInfo.encode(msg).finish()).toString("base64"),
            remoteJidAlt: msg.key.remoteJidAlt,
          }));
          await rename(tempPath, cachePath);
        }
      }).catch((error) => console.error("[whatsapp] failed to cache slip:", error));
    };

    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("messaging-history.set", ({ messages }) => remember(messages));

    sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
      if (qr) currentQr = qr;
      if (connection === "open") {
        activeSocket = sock;
        connected = true;
        currentQr = null;
        console.log("[whatsapp] connected");
      } else if (connection === "close") {
        connected = false;
        if (activeSocket === sock) activeSocket = undefined;
        const code = (lastDisconnect?.error as any)?.output?.statusCode;
        if (code === DisconnectReason.loggedOut) {
          console.log("[whatsapp] logged out; delete whatsapp_auth_session/ and restart to re-link");
        } else {
          setTimeout(connect, 3000);
        }
      }
    });

    sock.ev.on("messages.upsert", async ({ messages, type }) => {
      remember(messages);
      if (type !== "notify") return;
      const allowed = process.env.WHATSAPP_REPORT_SENDER;
      if (!allowed) return;
      for (const msg of messages) {
        const jid = msg.key.remoteJid;
        if (!jid) continue;
        try {
          if (!await isAllowed(msg, allowed)) continue;
        } catch (error) {
          console.error("[whatsapp] failed to verify sender:", error);
          continue;
        }
        try {
          const image = extractMessageContent(msg.message)?.imageMessage;
          if (!image) continue;
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
