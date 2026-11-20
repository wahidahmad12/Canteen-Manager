import { normalizeExpenseItemAlias } from "@shared/expense-item-alias";

export type ExpenseCategory = "fixed" | "vegetable" | "other";

export interface VoiceExpenseItem {
  description: string;
  category: ExpenseCategory;
  uom: string;
  qty: number;
  amount: number;
  rate: number;
  heard?: string;
  unitWasSpoken?: boolean;
}

export interface VoiceExpenseCatalogItem {
  id?: number;
  name: string;
  category: ExpenseCategory;
  uom: string;
}

export interface VoiceItemPhrase {
  phrase: string;
  itemId: number;
}

export function parseVoiceExpenseWithMatches(
  transcript: string,
  catalog: VoiceExpenseCatalogItem[],
  category: ExpenseCategory,
  matches: VoiceItemPhrase[],
): VoiceExpenseItem[] {
  const scoped = catalog.filter(item => item.category === category);
  const signatures = new Map<string, { phrase: string; item: VoiceExpenseCatalogItem }[]>();
  const signature = (value: string) => itemTokens(value).sort().join(" ");
  for (const match of matches) {
    const item = scoped.find(candidate => candidate.id === match.itemId);
    const key = signature(match.phrase);
    if (!item || !key) continue;
    const group = signatures.get(key) ?? [];
    group.push({ phrase: match.phrase, item });
    signatures.set(key, group);
  }
  const variants: VoiceExpenseCatalogItem[] = [];
  const resolved = new Map<string, VoiceExpenseCatalogItem>();
  for (const [key, group] of Array.from(signatures)) {
    if (new Set(group.map(entry => entry.item.id)).size !== 1) continue;
    const { phrase, item } = group[0];
    if (!scoped.some(candidate => candidate.name === phrase && candidate.id === item.id)) {
      variants.push({ ...item, name: phrase });
      resolved.set(phrase, item);
    }
  }
  const variantKeys = new Set(variants.map(item => signature(item.name)));
  const parsingCatalog = [...scoped.filter(item => !variantKeys.has(signature(item.name))), ...variants];
  return parseVoiceExpenseTranscript(transcript, parsingCatalog, category, true, { matches, catalog: scoped, variants: new Set(variants) }).map(item => {
    const heardKey = normalizeExpenseItemAlias(item.heard ?? "");
    const exactIds = new Set(matches.filter(match => heardKey && normalizeExpenseItemAlias(match.phrase) === heardKey).map(match => match.itemId));
    const exactId = exactIds.size === 1 ? Array.from(exactIds)[0] : undefined;
    const variant = heardKey === normalizeExpenseItemAlias(item.description) ? resolved.get(item.description) : undefined;
    const master = scoped.find(candidate => candidate.id === exactId) ?? variant;
    return master ? { ...item, description: master.name, uom: item.unitWasSpoken ? item.uom : master.uom } : item;
  });
}

export function updateVoiceExpenseItem(item: VoiceExpenseItem, patch: Partial<VoiceExpenseItem>): VoiceExpenseItem {
  const updated = { ...item, ...patch };
  if (patch.amount !== undefined) {
    updated.rate = updated.qty > 0 ? updated.amount / updated.qty : 0;
  } else if (patch.rate !== undefined) {
    updated.amount = updated.qty * updated.rate;
  } else if (patch.qty !== undefined) {
    if (item.qty === 0 && item.rate === 0 && item.amount > 0 && updated.qty > 0) {
      updated.rate = item.amount / updated.qty;
    } else {
      updated.amount = updated.qty * updated.rate;
    }
  }
  return updated;
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
  ग्यारह: "11",
  बारह: "12",
  तेरह: "13",
  चौदह: "14",
  पंद्रह: "15",
  पन्द्रह: "15",
  सोलह: "16",
  सत्रह: "17",
  अठारह: "18",
  उन्नीस: "19",
  बीस: "20",
  इक्कीस: "21",
  बाईस: "22",
  तेईस: "23",
  चौबीस: "24",
  पच्चीस: "25",
  तीस: "30",
  चालीस: "40",
  पचास: "50",
  साठ: "60",
  सत्तर: "70",
  अस्सी: "80",
  नब्बे: "90",
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
    .replace(/\b(?:one|two|three|four|five|six|seven|eight|nine|ten|ek|do|teen|char|paanch|chhe|saat|aath|nau|das)\b/gi, word => numberWords[word.toLowerCase()] ?? word)
    .replace(/(^|[^\u0900-\u097f])(एक|दो|तीन|चार|पांच|पाँच|छे|छह|सात|आठ|नौ|दस|ग्यारह|बारह|तेरह|चौदह|पंद्रह|पन्द्रह|सोलह|सत्रह|अठारह|उन्नीस|बीस|इक्कीस|बाईस|तेईस|चौबीस|पच्चीस|तीस|चालीस|पचास|साठ|सत्तर|अस्सी|नब्बे)(?=$|[^\u0900-\u097f])/g,
      (match, prefix: string, word: string) => prefix + numberWords[word])
    .replace(/(\d+(?:\.\d+)?)\s*(hundred|thousand|सौ|हज़ार|हजार)(?=$|[\s,.;])/gi,
      (match, count: string, scale: string) => String(Number(count) * (/^(hundred|सौ)$/i.test(scale) ? 100 : 1000)))
    .replace(/(^|[^\u0900-\u097f])(सौ|हज़ार|हजार)(?=$|[^\u0900-\u097f])/g,
      (match, prefix: string, scale: string) => prefix + (scale === "सौ" ? "100" : "1000"));
}

function normalizeText(value: string) {
  return value.toLocaleLowerCase().replace(/[^\w\u0900-\u097F\u0980-\u09FF]+/g, " ").trim();
}

const itemAliases: Record<string, string> = {
  दही: "dahi", दहि: "dahi", दই: "dahi", curd: "dahi", yogurt: "dahi",
  खट्टा: "khatta", खट्टे: "khatta", khata: "khatta", khatta: "khatta", sour: "khatta",
  मीठा: "sweet", मीठी: "sweet", sweet: "sweet",
};

function itemTokens(value: string) {
  return normalizeText(value).split(/\s+/)
    .map(token => itemAliases[token] ?? token)
    .filter(token => token && !/^\d+(?:g|gm|kg|ml|l)?$/.test(token));
}

function findCatalogMatch(line: string, catalog: VoiceExpenseCatalogItem[]) {
  const lineTokens = itemTokens(line);
  const matches = catalog.filter(item => {
    const tokens = itemTokens(item.name);
    return tokens.length > 0 && tokens.every(token => lineTokens.includes(token));
  });
  if (!matches.length) return undefined;
  const maxTokens = Math.max(...matches.map(item => itemTokens(item.name).length));
  const best = matches.filter(item => itemTokens(item.name).length === maxTokens);
  return best.length === 1 ? best[0] : undefined;
}

function findCatalogMentions(line: string, catalog: VoiceExpenseCatalogItem[]) {
  const tokenMatches: Array<{ token: string; start: number }> = [];
  line.replace(/[\w\u0900-\u097F\u0980-\u09FF]+/g, (token, offset: number) => {
    tokenMatches.push({ token, start: offset });
    return token;
  });
  const tokens = tokenMatches
    .map(match => ({
      value: itemTokens(match.token)[0],
      start: match.start,
      end: match.start + match.token.length,
    }))
    .filter(token => token.value);
  const mentions: Array<{ start: number; end: number; item: VoiceExpenseCatalogItem }> = [];

  for (let start = 0; start < tokens.length;) {
    const matches = catalog.filter(item => {
      const nameTokens = itemTokens(item.name);
      const candidateTokens = tokens.slice(start, start + nameTokens.length).map(token => token.value);
      return candidateTokens.length === nameTokens.length &&
        nameTokens.every(token => candidateTokens.includes(token));
    });
    if (!matches.length) {
      start += 1;
      continue;
    }

    const maxLength = Math.max(...matches.map(item => itemTokens(item.name).length));
    const best = matches.filter(item => itemTokens(item.name).length === maxLength);
    if (best.length !== 1) {
      start += 1;
      continue;
    }
    mentions.push({
      start: tokens[start].start,
      end: tokens[start + maxLength - 1].end,
      item: best[0],
    });
    start += maxLength;
  }
  return mentions;
}

function splitLineAtCatalogItems(line: string, catalog: VoiceExpenseCatalogItem[]) {
  const mentions = findCatalogMentions(line, catalog);
  if (mentions.length < 2) return [line];
  const prefix = line.slice(0, mentions[0].start).trim();
  return [...(prefix && isCompleteVoiceEntry(prefix) ? [prefix] : []), ...mentions.map((mention, index) => {
    const end = mentions[index + 1]?.start ?? line.length;
    return line.slice(mention.start, end).trim();
  })].filter(Boolean);
}

function splitAfterExplicitPrice(line: string): string[] {
  const price = /(?:\brate\b|\btotal(?:\s+amount)?\b|\bamount\b|रेट|दर|कुल|टोटल)\s*[:=]?\s*(?:₹|rs\.?)?\s*\d+(?:\.\d+)?(?:\s*(?:₹|rs\.?|rupees?|रुपये|रुपया|रु))?/gi;
  const segments: string[] = [];
  let start = 0;
  for (const match of Array.from(line.matchAll(price))) {
    const end = match.index! + match[0].length;
    const rest = line.slice(end).trimStart();
    if (!rest || /^(?:total|amount|per|कुल|टोटल|प्रति)\b/i.test(rest)) continue;
    segments.push(line.slice(start, end).trim());
    start = end;
  }
  segments.push(line.slice(start).trim());
  return segments.filter(Boolean);
}

function isCompleteVoiceEntry(value: string) {
  return /(?:rate|रेट|दर|प्रति|amount|total|कुल|टोटल)\s*[:=]?\s*[\d०-९০-৯]+|(?:₹|rs\.?|rupees?|रुपये|रुपया|रु)\s*[\d०-९০-৯]+|[\d०-९০-৯]+\s*(?:₹|rs\.?|rupees?|रुपये|रुपया|रु)/i.test(value);
}

function heardItemName(line: string, catalogMatch?: VoiceExpenseCatalogItem): string {
  const priceStart = line.search(/(?:\b(?:rate|total|amount)\b|रेट|दर|कुल|टोटल)|(?:₹|rs\.?|rupees?|रुपये|रुपया|रु)\s*\d|\d+(?:\.\d+)?\s*(?:₹|rs\.?|rupees?|रुपये|रुपया|रु)/i);
  let name = (priceStart < 0 ? line : line.slice(0, priceStart)).trim();
  if (priceStart < 0) name = name.replace(/\s+\d+(?:\.\d+)?\s*$/, "");
  const quantity = name.match(/\s+\d+(?:\.\d+)?\s*(?:kilograms?|kilos?|kgs?|kg|किलोग्राम|किलो|কিলোগ্রাম|কেজি|কিলো|grams?|gm|g|ग्राम|গ্রাম|litres?|liters?|ltr|l|लीटर|লিটার|pieces?|pcs?|पीस|পিস|packets?|pkts?|pkt|पैकेट|প্যাকেট|boxes?|box|बॉक्स|trips?|trip|bags?|bag)\s*$/i);
  const productSize = catalogMatch?.name.match(/\d+(?:\.\d+)?\s*(?:kg|gm|g|ml|ltr|l)\s*$/i)?.[0];
  const sameSize = quantity && productSize &&
    quantity[0].match(/\d+(?:\.\d+)?/)?.[0] === productSize.match(/\d+(?:\.\d+)?/)?.[0] &&
    unitPatterns.find(unit => unit.pattern.test(quantity[0]))?.uom === unitPatterns.find(unit => unit.pattern.test(productSize))?.uom;
  if (quantity && !sameSize) {
    name = name.slice(0, quantity.index);
  } else if (!quantity) {
    name = name.replace(/\s+\d+(?:\.\d+)?\s*$/, "");
  }
  return name
    .replace(/^\s*(?:and|और|फिर)\s+/i, "")
    .replace(/\s+(?:quantity|qty|मात्रा|संख्या|ka|ke|ki|का|के|की)\s*$/i, "")
    .replace(/^[\s,.:;]+|[\s,.:;]+$/g, "")
    .trim();
}

function parseLine(
  line: string,
  catalog: VoiceExpenseCatalogItem[],
  includeHeard: boolean,
  matchContext?: { matches: VoiceItemPhrase[]; catalog: VoiceExpenseCatalogItem[]; variants: Set<VoiceExpenseCatalogItem> },
): VoiceExpenseItem | null {
  const normalizedLine = normalizeDigits(line).trim();
  if (!normalizedLine) return null;

  const heardKey = normalizeExpenseItemAlias(heardItemName(normalizedLine));
  const exactMatches = matchContext?.matches.filter(match => heardKey && normalizeExpenseItemAlias(match.phrase) === heardKey) ?? [];
  const exactIds = new Set(exactMatches.map(match => match.itemId));
  const exactId = exactIds.size === 1 ? Array.from(exactIds)[0] : undefined;
  const found = findCatalogMatch(normalizedLine, catalog);
  const safeFound = found && matchContext?.variants.has(found) &&
    normalizeExpenseItemAlias(found.name) !== heardKey
    ? findCatalogMatch(normalizedLine, matchContext.catalog)
    : found;
  const catalogMatch = matchContext?.catalog.find(item => item.id === exactId) ?? safeFound;
  let valuesLine = normalizedLine;
  if (catalogMatch) {
    const nameTokens = new Set(itemTokens(catalogMatch.name));
    const catalogSizes = Array.from(new Map(
      [catalogMatch.name, ...(exactIds.size === 1 ? exactMatches.map(match => match.phrase) : [])]
        .flatMap(name => name.match(/\d+(?:\.\d+)?\s*(?:gm|kg|ml|ltr|g|l)\b/gi) ?? [])
        .map(size => [size.toLowerCase().replace(/\s+/g, ""), size] as const),
    ).values());
    for (const size of catalogSizes) {
      const [, sizeValue, sizeUnit] = size.match(/(\d+(?:\.\d+)?)\s*(g|gm|kg|ml|ltr|l)\b/i) ?? [];
      const spokenUnits: Record<string, string> = {
        g: "g|gm|grams?|ग्राम|গ্রাম",
        gm: "g|gm|grams?|ग्राम|গ্রাম",
        kg: "kg|kgs?|kilos?|kilograms?|किलो|किलोग्राम|কেজি|কিলো",
        ml: "ml|millilitres?|milliliters?",
        ltr: "ltr|litres?|liters?|लीटर|লিটার",
        l: "l|litres?|liters?|लीटर|লিটার",
      };
      if (sizeValue && sizeUnit) {
        const unit = spokenUnits[sizeUnit.toLowerCase()];
        valuesLine = valuesLine.replace(new RegExp(`\\b${sizeValue}\\s*(?:${unit})(?![\\w\\u0900-\\u097F\\u0980-\\u09FF])`, "i"), " ");
      }
    }
    valuesLine = valuesLine.replace(/[\w\u0900-\u097F\u0980-\u09FF]+/g, token =>
      nameTokens.has(itemTokens(token)[0]) ? " " : token
    );
  }
  const quantityMatch = valuesLine.match(
    /(\d+(?:\.\d+)?)\s*(kilograms?|kilos?|kgs?|kg|किलोग्राम|किलो|কিলোগ্রাম|কেজি|কিলো|grams?|g|ग्राम|গ্রাম|litres?|liters?|ltr|l|लीटर|লিটার|pieces?|pcs?|पीस|পিস|packets?|pkts?|pkt|पैकेट|প্যাকেট|boxes?|box|बॉक्स|trips?|trip|bags?|bag)/i,
  );
  const explicitQty = valuesLine.match(/(?:quantity|qty|मात्रा|संख्या)\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
  const explicitRate = valuesLine.match(/(?:rate|रेट|दर|प्रति)\s*[:=]?\s*(?:₹|rs\.?)?\s*(\d+(?:\.\d+)?)/i);
  const explicitAmount = valuesLine.match(/(?:amount|total(?:\s+amount)?|कुल(?:\s+रकम)?|टोटल)\s*[:=]?\s*(?:₹|rs\.?)?\s*(\d+(?:\.\d+)?)/i);
  const currencyMatch = valuesLine.match(
    /(?:₹|rs\.?|rupees?|rup(?:ay|aye|iya)|रुपये|रुपया|रु)\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(?:₹|rs\.?|rupees?|rup(?:ay|aye|iya)|रुपये|रुपया|रु)/i,
  );
  let remainingValues = valuesLine;
  for (const match of [explicitRate, explicitAmount, currencyMatch]) {
    if (match) remainingValues = remainingValues.replace(match[0], " ");
  }
  const remainingNumbers = remainingValues.match(/\d+(?:\.\d+)?/g) ?? [];
  const unlabeledQty = (explicitRate || explicitAmount || currencyMatch) && remainingNumbers.length === 1
    ? Number(remainingNumbers[0])
    : 0;
  const unit = quantityMatch
    ? unitPatterns.find(candidate => candidate.pattern.test(quantityMatch[2]))?.uom
    : undefined;
  const qty = explicitQty ? Number(explicitQty[1]) : quantityMatch ? Number(quantityMatch[1]) : unlabeledQty;

  const numbers: number[] = [];
  valuesLine.replace(/\d+(?:\.\d+)?/g, match => {
    numbers.push(Number(match));
    return match;
  });
  const amount = explicitAmount ? Number(explicitAmount[1]) : explicitRate ? qty * Number(explicitRate[1]) : currencyMatch
    ? Number(currencyMatch[1] ?? currencyMatch[2])
    : numbers.length > (quantityMatch || explicitQty ? 1 : 0)
      ? numbers[numbers.length - 1]
      : quantityMatch || explicitQty
        ? 0
        : numbers[0] ?? 0;

  const strippedDescription = normalizedLine
    .replace(/(?:₹|rs\.?|rupees?|rup(?:ay|aye|iya)|रुपये|रुपया|रु)\s*\d+(?:\.\d+)?|\d+(?:\.\d+)?\s*(?:₹|rs\.?|rupees?|rup(?:ay|aye|iya)|रुपये|रुपया|रु)/gi, " ")
    .replace(/(\d+(?:\.\d+)?)\s*(kilograms?|kilos?|kgs?|kg|किलोग्राम|किलो|কিলোগ্রাম|কেজি|কিলো|grams?|g|ग्राम|গ্রাম|litres?|liters?|ltr|l|लीटर|লিটার|pieces?|pcs?|पीস|পিস|packets?|pkts?|pkt|पैकेट|প্যাকেট|boxes?|box|बॉक्स|trips?|trip|bags?|bag)/gi, " ")
    .replace(/\d+(?:\.\d+)?/g, " ")
    .replace(/\b(?:quantity|qty|amount|rate|total|rupees?|rs|and|for|is|ka|ke|ki|rupaye|rupya|mein)\b|मात्रा|संख्या|रेट|दर|प्रति|कुल|टोटल|का|की|के|रुपये|रुपया|रु/gi, " ");
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
    rate: explicitRate ? Number(explicitRate[1]) : qty > 0 ? amount / qty : 0,
    ...(includeHeard ? { heard: heardItemName(normalizedLine, catalogMatch), unitWasSpoken: !!unit } : {}),
  };
}

export function parseVoiceExpenseTranscript(
  transcript: string,
  catalog: VoiceExpenseCatalogItem[],
  category?: ExpenseCategory,
  includeHeard = false,
  matchContext?: { matches: VoiceItemPhrase[]; catalog: VoiceExpenseCatalogItem[]; variants: Set<VoiceExpenseCatalogItem> },
): VoiceExpenseItem[] {
  const scopedCatalog = category ? catalog.filter(item => item.category === category) : catalog;
  const segments = normalizeDigits(transcript).split(/[\n;]+|(?<!\b[A-Za-z])[.!?]\s+/)
    .flatMap(splitAfterExplicitPrice)
    .flatMap(line => splitLineAtCatalogItems(line, scopedCatalog));
  const groupedSegments: string[] = [];
  let current = "";
  for (const segment of segments) {
    const hasCatalogItem = findCatalogMatch(segment, scopedCatalog) !== undefined;
    if (current && (hasCatalogItem || isCompleteVoiceEntry(current))) {
      groupedSegments.push(current);
      current = segment;
    } else {
      current = [current, segment].filter(Boolean).join(" ");
    }
  }
  if (current) groupedSegments.push(current);

  return groupedSegments
    .map(line => parseLine(line, scopedCatalog, includeHeard, matchContext))
    .filter((item): item is VoiceExpenseItem => item !== null)
    .map(item => category ? { ...item, category } : item);
}
