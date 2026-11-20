export type ExpenseCategory = "fixed" | "vegetable" | "other";

export interface VoiceExpenseItem {
  description: string;
  category: ExpenseCategory;
  uom: string;
  qty: number;
  amount: number;
  rate: number;
}

export interface VoiceExpenseCatalogItem {
  name: string;
  category: ExpenseCategory;
  uom: string;
}

const numberWords: Record<string, string> = {
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  ten: "10",
  ek: "1",
  एक: "1",
  do: "2",
  दो: "2",
  teen: "3",
  तीन: "3",
  char: "4",
  चार: "4",
  paanch: "5",
  पांच: "5",
  पाँच: "5",
  chhe: "6",
  छे: "6",
  छह: "6",
  saat: "7",
  सात: "7",
  aath: "8",
  आठ: "8",
  nau: "9",
  नौ: "9",
  das: "10",
  दस: "10",
};

const unitPatterns = [
  { pattern: /(?:kilograms?|kilos?|kgs?|kg|किलोग्राम|किलो|কিলোগ্রাম|কেজি|কিলো)/i, uom: "Kg" },
  { pattern: /(?:grams?|g|ग्राम|গ্রাম)/i, uom: "G" },
  { pattern: /(?:litres?|liters?|ltr|l|लीटर|লিটার)/i, uom: "Ltr" },
  { pattern: /(?:pieces?|pcs?|पीस|পিস)/i, uom: "Pcs" },
  { pattern: /(?:packets?|pkts?|pkt|पैकेट|প্যাকেট)/i, uom: "Pkt" },
  { pattern: /(?:boxes?|box|बॉक्स)/i, uom: "Box" },
  { pattern: /(?:trips?|trip)/i, uom: "Trip" },
  { pattern: /(?:bags?|bag)/i, uom: "Bag" },
];

const vegetableHints = [
  "aloo", "potato", "आलू", "pyaaz", "pyaz", "onion", "प्याज", "प्याज़",
  "tamatar", "tomato", "टमाटर", "gobhi", "cauliflower", "गोभी", "lemon",
  "नींबू", "nimbu", "chilli", "chili", "मिर्च", "ginger", "अदरक",
];

function normalizeDigits(value: string) {
  return value
    .replace(/[०-९]/g, digit => String("०१२३४५६७८९".indexOf(digit)))
    .replace(/[০-৯]/g, digit => String("০১২৩৪৫৬৭৮৯".indexOf(digit)))
    .replace(/\b(?:one|two|three|four|five|six|seven|eight|nine|ten|ek|do|teen|char|paanch|chhe|saat|aath|nau|das)\b|एक|दो|तीन|चार|पांच|पाँच|छे|छह|सात|आठ|नौ|दस/gi, word => numberWords[word.toLowerCase()] ?? word);
}

function normalizeText(value: string) {
  return value.toLocaleLowerCase().replace(/[^\w\u0900-\u097F\u0980-\u09FF]+/g, " ").trim();
}

function parseLine(line: string, catalog: VoiceExpenseCatalogItem[]): VoiceExpenseItem | null {
  const normalizedLine = normalizeDigits(line).trim();
  if (!normalizedLine) return null;

  const catalogMatch = catalog.find(item =>
    normalizeText(normalizedLine).includes(normalizeText(item.name))
  );
  const quantityMatch = normalizedLine.match(
    /(\d+(?:\.\d+)?)\s*(kilograms?|kilos?|kgs?|kg|किलोग्राम|किलो|কিলোগ্রাম|কেজি|কিলো|grams?|g|ग्राम|গ্রাম|litres?|liters?|ltr|l|लीटर|লিটার|pieces?|pcs?|पीस|পিস|packets?|pkts?|pkt|पैकेट|প্যাকেট|boxes?|box|बॉक्स|trips?|trip|bags?|bag)/i,
  );
  const unit = quantityMatch
    ? unitPatterns.find(candidate => candidate.pattern.test(quantityMatch[2]))?.uom
    : undefined;
  const qty = quantityMatch ? Number(quantityMatch[1]) : 1;

  const currencyMatch = normalizedLine.match(
    /(?:₹|rs\.?|rupees?|rup(?:ay|aye|iya)|रुपये|रुपया|रु)\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(?:₹|rs\.?|rupees?|rup(?:ay|aye|iya)|रुपये|रुपया|रु)/i,
  );
  const numbers: number[] = [];
  normalizedLine.replace(/\d+(?:\.\d+)?/g, match => {
    numbers.push(Number(match));
    return match;
  });
  const amount = currencyMatch
    ? Number(currencyMatch[1] ?? currencyMatch[2])
    : numbers.length > (quantityMatch ? 1 : 0)
      ? numbers[numbers.length - 1]
      : quantityMatch
        ? 0
        : numbers[0] ?? 0;

  const strippedDescription = normalizedLine
    .replace(/(?:₹|rs\.?|rupees?|rup(?:ay|aye|iya)|रुपये|रुपया|रु)\s*\d+(?:\.\d+)?|\d+(?:\.\d+)?\s*(?:₹|rs\.?|rupees?|rup(?:ay|aye|iya)|रुपये|रुपया|रु)/gi, " ")
    .replace(/(\d+(?:\.\d+)?)\s*(kilograms?|kilos?|kgs?|kg|किलोग्राम|किलो|কিলোগ্রাম|কেজি|কিলো|grams?|g|ग्राम|গ্রাম|litres?|liters?|ltr|l|लीटर|লিটার|pieces?|pcs?|पीস|পিস|packets?|pkts?|pkt|पैकेट|প্যাকেট|boxes?|box|बॉक्स|trips?|trip|bags?|bag)/gi, " ")
    .replace(/\d+(?:\.\d+)?/g, " ")
    .replace(/\b(?:quantity|qty|amount|rupees?|rs|and|for|is|ka|ke|ki|rupaye|rupya|rupaye|mein|ka|का|की|के|रुपये|रुपया|रु)\b/gi, " ");
  const description = catalogMatch?.name || strippedDescription.replace(/\s+/g, " ").trim();
  if (!description) return null;

  const category: ExpenseCategory = catalogMatch?.category ??
    (vegetableHints.some(hint => normalizeText(description).includes(normalizeText(hint))) ? "vegetable" : "other");

  return {
    description,
    category,
    uom: unit ?? catalogMatch?.uom ?? "Pcs",
    qty,
    amount: Math.round(amount * 100) / 100,
    rate: qty > 0 ? amount / qty : 0,
  };
}

export function parseVoiceExpenseTranscript(
  transcript: string,
  catalog: VoiceExpenseCatalogItem[],
): VoiceExpenseItem[] {
  return transcript
    .split(/[\n;]+|[.!?]\s+/)
    .map(line => parseLine(line, catalog))
    .filter((item): item is VoiceExpenseItem => item !== null);
}
