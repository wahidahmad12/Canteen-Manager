// Centralized meal windows (hours in 24h decimal). Edit here to change timings.
export const CANTEEN_MEALS = [
  { name: "Breakfast", time: "7:00 AM - 9:30 AM", start: 7, end: 9.5, variants: ["N/A"] },
  { name: "Lunch", time: "11:30 AM - 3:30 PM", start: 11.5, end: 15.5, variants: ["Veg", "Non-Veg"] },
  { name: "Evening Snacks", time: "5:00 PM - 7:00 PM", start: 17, end: 19, variants: ["N/A"] },
  { name: "Night Snacks", time: "10:00 PM - 3:00 AM", start: 22, end: 3, variants: ["N/A"] },
] as const;

export type CanteenMeal = (typeof CANTEEN_MEALS)[number];

export function isMealActive(meal: { start: number; end: number }, now: Date) {
  const t = now.getHours() + now.getMinutes() / 60;
  // start > end means the window crosses midnight
  return meal.start > meal.end ? t >= meal.start || t <= meal.end : t >= meal.start && t <= meal.end;
}

type CouponLike = { mealCategory: string; date: string; variant?: string };

// Running total: only coupons of the active meal on the given date.
// Once the window ends, no meal is active, so the running total resets to 0
// and a different meal never inherits the previous meal's count.
export function runningSlotTotal(coupons: CouponLike[], date: string, now: Date) {
  const active = CANTEEN_MEALS.find((m) => isMealActive(m, now));
  if (!active) return { meal: null as string | null, total: 0 };
  return { meal: active.name as string, total: coupons.filter((c) => c.date === date && c.mealCategory === active.name).length };
}

// Report/dashboard totals grouped by date + meal type (historical totals preserved).
export function mealWiseTotals(coupons: CouponLike[]) {
  const map = new Map<string, { date: string; meal: string; total: number; veg: number; nonVeg: number }>();
  for (const c of coupons) {
    const key = `${c.date}|${c.mealCategory}`;
    const row = map.get(key) ?? { date: c.date, meal: c.mealCategory, total: 0, veg: 0, nonVeg: 0 };
    row.total++;
    if (c.variant === "Veg") row.veg++;
    if (c.variant === "Non-Veg") row.nonVeg++;
    map.set(key, row);
  }
  const order = CANTEEN_MEALS.map((m) => m.name as string);
  return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date) || order.indexOf(a.meal) - order.indexOf(b.meal));
}
