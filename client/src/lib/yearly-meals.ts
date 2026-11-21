import { MONTHS, hulMealTable, numberValue, totalColumns, type Cell, type HulMealRow, type Period, type ReportTable } from "./yearly-report";
import { CIPLA_MEAL_RATES, PEC_DEFAULT_RATES, UBL_YEARLY_RATES, UNICHEM_MEAL_RATES } from "./client-summary-rates";

type DataRow = Record<string, unknown>;

async function getRows(url: string): Promise<DataRow[]> {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) throw new Error(`Could not load ${url.split("?")[0]} (${response.status}).`);
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new Error(`Invalid response from ${url.split("?")[0]}.`);
  return data as DataRow[];
}

function value(row: DataRow | undefined, field: string): number {
  return numberValue(row?.[field] ?? 0);
}

function makeTable(name: string, title: string, headers: string[], rows: Cell[][], color: string): ReportTable {
  return {
    name, title, headers, rows, color,
    total: rows.length ? totalColumns(rows, 1, ["GRAND TOTAL"]) : ["GRAND TOTAL", ...Array(headers.length - 1).fill(0)],
  };
}

function monthLabel({ month, year }: Period, billing = false): string {
  if (!billing) return `${MONTHS[month - 1]} ${year}`;
  const next = month === 12 ? 1 : month + 1;
  return `21 ${MONTHS[month - 1].slice(0, 3)} ${year} – 20 ${MONTHS[next - 1].slice(0, 3)} ${year + (month === 12 ? 1 : 0)}`;
}

function fromMonth(data: Map<number, DataRow[]>, period: Period): DataRow | undefined {
  return data.get(period.year)?.find(row => numberValue(row.month) === period.month);
}

async function yearsData(years: number[], path: string, extra = ""): Promise<Map<number, DataRow[]>> {
  return new Map(await Promise.all(years.map(async year =>
    [year, await getRows(`${path}?year=${year}${extra}`)] as const)));
}

export type ClientKind = "hul" | "ubl" | "cipla" | "unichem" | "pec" | "custom" | "unsupported";

export function clientKind(name: string): ClientKind {
  const clean = name.trim().replace(/\s+/g, " ");
  if (/^(?:hul|hindustan unilever(?: limited| ltd)?(?: \(hul\))?)(?:\s*[-–]\s*(?:kpf|tec))?$/i.test(clean)) return "hul";
  if (/^(?:ubl|united breweries(?: limited| ltd)?(?: \(ubl\))?)$/i.test(clean)) return "ubl";
  if (/^unichem(?: laboratories)?(?: limited| ltd)?(?:\s*[-–]\s*(?:main plant|unit-2|coe))?$/i.test(clean)) return "unichem";
  if (/^cipla(?: limited| ltd)?$/i.test(clean)) return "cipla";
  if (/^pec ventures(?: private limited| pvt\.? ltd\.?)?$/i.test(clean)) return "pec";
  if (/hindustan unilever|\bhul\b|united breweries|\bubl\b|unichem|cipla|pec ventures/i.test(clean)) return "unsupported";
  return "custom";
}

export async function loadMealTables(clientName: string, clientId: number, periods: Period[], location: string): Promise<ReportTable[]> {
  const kind = clientKind(clientName);
  const years = Array.from(new Set(periods.map(period => period.year)));
  if (!periods.length) return [];
  if (kind === "unsupported") throw new Error("Meal data cannot be safely matched to this client or location. Check the client name and existing date-entry records.");
  if (kind === "hul") {
    const locations = location === "all" ? ["KPF", "TEC"] : [location];
    return Promise.all(locations.map(async loc => {
      const data = await yearsData(years, "/api/hul-date-entries/yearly-summary", `&location=${encodeURIComponent(loc)}`);
      const meals = new Map<number, HulMealRow[]>(Array.from(data, ([year, rows]) => [year, rows.map(row => ({
        month: value(row, "month"), breakfast: value(row, "breakfast"), lunch: value(row, "lunch"),
        eveningSnacks: value(row, "eveningSnacks"), nightSnacks: value(row, "nightSnacks"),
        guestBreakfast: value(row, "guestBreakfast"), guestLunch: value(row, "guestLunch"),
        guestEveningSnacks: value(row, "guestEveningSnacks"), guestNightSnacks: value(row, "guestNightSnacks"),
      }))]));
      return hulMealTable(loc, periods, meals);
    }));
  }
  if (kind === "ubl") {
    const [food, lunch] = await Promise.all([
      yearsData(years, "/api/ubl-date-entries/yearly-summary"),
      yearsData(years, "/api/ubl-lunch-entries/yearly-summary"),
    ]);
    const rates = UBL_YEARLY_RATES;
    const foodRows = periods.map(period => {
      const row = fromMonth(food, period);
      const quantities = rates.map(({ field }) => value(row, field));
      return [monthLabel(period, true), ...quantities.flatMap((qty, index) => [qty, qty * rates[index].rate]), quantities.reduce((sum, qty, index) => sum + qty * rates[index].rate, 0)];
    });
    const lunchRows = periods.map(period => {
      const row = fromMonth(lunch, period);
      const amounts = ["perment", "casual", "contractual", "canteen"].map(field => value(row, field));
      return [monthLabel(period, true), ...amounts, amounts.reduce((sum, amount) => sum + amount, 0)];
    });
    return [
      makeTable("UBL Rate Summary", `${clientName} — Rate Wise Yearly Summary`, ["Billing Period", ...rates.flatMap(({ name }) => [`${name} Qty`, `${name} Amt (₹)`]), "Grand Total (₹)"], foodRows, "B45309"),
      makeTable("UBL Lunch", `${clientName} — Lunch Per Day`, ["Billing Period", "Permanent", "Casual", "Contractual", "Canteen", "Total"], lunchRows, "1A3A8A"),
    ];
  }
  if (kind === "cipla") {
    const [meals, invoices] = await Promise.all([
      yearsData(years, "/api/cipla-date-entries/yearly-summary"),
      yearsData(years, "/api/date-entry/contractor-invoices/yearly-summary", `&clientName=${encodeURIComponent("Cipla Limited")}`),
    ]);
    const rows = periods.map(period => {
      const row = fromMonth(meals, period);
      const bf = value(row, "breakfast"), lunch = value(row, "lunch"), dinner = value(row, "dinner");
      const meal = bf * CIPLA_MEAL_RATES.breakfast + lunch * CIPLA_MEAL_RATES.lunch + dinner * CIPLA_MEAL_RATES.dinner;
      const invoice = value(fromMonth(invoices, period), "invoiceTotal");
      return [monthLabel(period, true), bf, lunch, dinner, meal, invoice, meal + invoice];
    });
    return [makeTable("Cipla", `${clientName} — Yearly Summary`, ["Billing Period", "Breakfast", "Lunch", "Dinner", "Meal Data Entry Total", "Non-GST Invoice Total Bill", "Grand Total"], rows, "4338CA")];
  }
  if (kind === "unichem") {
    const locations = location === "all" ? ["Main Plant", "Unit-2", "COE"] : [location];
    return Promise.all(locations.map(async loc => {
      const rows = await Promise.all(periods.map(async period => {
        const params = `month=${period.month}&year=${period.year}&location=${encodeURIComponent(loc)}`;
        const [snacks, lunches] = await Promise.all([
          getRows(`/api/unichem-snack-entries?${params}`),
          getRows(`/api/unichem-lunch-entries?${params}`),
        ]);
        const sum = (data: DataRow[], field: string) => data.reduce((total, row) => total + value(row, field), 0);
        const breakfast = sum(snacks, "breakfast"), evening = sum(snacks, "eveningSnacks"), night = sum(snacks, "nightSnacks");
        const lunch = sum(lunches.filter(row => row.mealType === "lunch"), "billQty");
        const dinner = sum(lunches.filter(row => row.mealType === "dinner"), "billQty");
        const sunday = sum(lunches.filter(row => row.mealType === "lunch" && new Date(`${String(row.entryDate).slice(0, 10)}T00:00:00Z`).getUTCDay() === 0), "billQty");
        const rates = UNICHEM_MEAL_RATES;
        return [monthLabel(period), breakfast, evening, night, sunday, lunch, dinner, breakfast * rates.breakfast + evening * rates.evening + night * rates.night + sunday * rates.sunday + lunch * rates.lunch + dinner * rates.dinner];
      }));
      return makeTable(`Unichem ${loc}`, `${clientName} — ${loc} — Yearly Summary`, ["Month", "Breakfast", "Ev. Snacks", "Night Snacks", "Sun Extra", "Lunch", "Dinner", "Grand Total (₹)"], rows, "0F766E");
    }));
  }
  if (kind === "custom") {
    const data = await yearsData(years, "/api/client-forms/yearly", `&clientId=${clientId}`);
    const forms = Array.from(new Map(Array.from(data.values()).flat().map(row => [numberValue(row.formId), String(row.formName)])).entries());
    if (!forms.length) return [];
    const rows = periods.map(period => {
      const items = data.get(period.year) ?? [];
      const amounts = forms.map(([id]) => value(items.find(row => numberValue(row.formId) === id && numberValue(row.month) === period.month), "amount"));
      return [monthLabel(period), ...amounts, amounts.reduce((a, b) => a + b, 0)];
    });
    return [makeTable("Client Forms", `${clientName} — All Forms — Yearly Summary`, ["Month", ...forms.map(([, name]) => `${name} ₹`), "All Forms Total ₹"], rows, "0F766E")];
  }

  const [items, lunch, custom] = await Promise.all([
    yearsData(years, "/api/pec-ventures-entries/yearly-summary"),
    yearsData(years, "/api/pec-ventures-entries/lunch-yearly-summary"),
    yearsData(years, "/api/pec-custom-items/yearly"),
  ]);
  const ratesResponses = await Promise.all(years.map(async year => {
    const response = await fetch(`/api/pec-ventures-rates?year=${year}`, { credentials: "include" });
    if (!response.ok) throw new Error(`Could not load PEC rates (${response.status}).`);
    const data: { monthly: DataRow[]; default: DataRow | null } = await response.json();
    return [year, data] as const;
  }));
  const ratesByYear = new Map(ratesResponses);
  const fields = [
    ["redLabel", "Red Label Tea"], ["tataTea", "Tata Tea"], ["coffee", "Coffee"],
    ["sugar", "Sugar"], ["ginger", "Ginger"], ["biscuit", "Biscuit"],
    ["teaCup", "Tea Cup"], ["greenElaychi", "Green Elaychi"], ["greenTea", "Green Tea"],
    ["blackSalt", "Black Salt"], ["milk", "Milk"],
  ] as const;
  const extras = Array.from(new Map(Array.from(custom.values()).flat().map(row => [numberValue(row.itemId), String(row.name)])).entries());
  const rows = periods.map(period => {
    const item = fromMonth(items, period), meal = fromMonth(lunch, period);
    const rates = ratesByYear.get(period.year);
    const rate = rates?.monthly.find(row => numberValue(row.month) === period.month) ?? rates?.default;
    const qty = fields.map(([field]) => field === "milk" ? value(item, "milkMorning") + value(item, "milkEvening") : value(item, field));
    const amounts = fields.map(([field], i) => qty[i] * (rate ? value(rate, field) : PEC_DEFAULT_RATES[field]));
    const additional = extras.flatMap(([id]) => {
      const entry = custom.get(period.year)?.find(row => numberValue(row.itemId) === id && numberValue(row.month) === period.month);
      return [value(entry, "qty"), value(entry, "amount")];
    });
    const lunchQty = value(meal, "lunchBill"), dinnerQty = value(meal, "dinnerBill");
    const total = amounts.reduce((a, b) => a + b, 0) + additional.reduce((a, amount, i) => a + (i % 2 ? amount : 0), 0);
    return [monthLabel(period), lunchQty, lunchQty * 70, dinnerQty, dinnerQty * 70, ...qty, ...amounts, ...additional, total];
  });
  return [makeTable("PEC Ventures", `${clientName} — Yearly Summary`, [
    "Month", "Lunch Bill Qty", "Lunch Amount (₹)", "Dinner Bill Qty", "Dinner Amount (₹)",
    ...fields.map(([, label]) => `${label} Qty`), ...fields.map(([, label]) => `${label} Amt (₹)`),
    ...extras.flatMap(([, name]) => [`${name} Qty`, `${name} Amt (₹)`]), "Grand Total (Items ₹)",
  ], rows, "4F2B91")];
}
