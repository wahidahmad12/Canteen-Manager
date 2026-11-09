export const CONTRACTOR_MEALS = [
  { type: "Breakfast", key: "breakfast", label: "Breakfast", defaultRate: 4.6 },
  { type: "Lunch", key: "lunch", label: "Lunch", defaultRate: 11.6 },
  { type: "Dinner", key: "dinner", label: "Dinner", defaultRate: 11.6 },
  { type: "Special", key: "special", label: "Special Lunch & Dinner", defaultRate: 26 },
] as const;

export type ContractorMealType = (typeof CONTRACTOR_MEALS)[number]["type"];
export type ContractorMealKey = (typeof CONTRACTOR_MEALS)[number]["key"];

export function contractorInvoiceFileName(billNo: string, vendorCode: string, month: number, year: number): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const safeName = (value: string) => value.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, "-").replace(/[. ]+$/g, "");
  const bill = safeName(billNo);
  if (!bill) {
    return `Invoice-${safeName(vendorCode)}-${String(month).padStart(2, "0")}-${year}.jpg`;
  }
  return `${bill}-${months[month - 1]}${String(year).slice(-2)}.jpg`;
}

export function contractorMealRate(type: string, rate: number | string | null | undefined): number {
  const saved = Number(rate);
  if (saved > 0) return saved;
  return CONTRACTOR_MEALS.find((meal) => meal.type === type)?.defaultRate ?? 11.6;
}

export function contractorInvoiceItems(
  quantities: Record<ContractorMealKey, string>,
  rates: Record<ContractorMealType, string>,
) {
  return CONTRACTOR_MEALS.map((meal, index) => {
    const qty = Number(quantities[meal.key]) || 0;
    const rate = Number(rates[meal.type]) || 0;
    return { meal: meal.label, number: index + 1, qty, rate, total: Math.round(qty * rate * 100) / 100 };
  }).filter((item) => item.qty > 0);
}
