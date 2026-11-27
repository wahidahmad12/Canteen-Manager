export const MEAL_TYPES = ["BF", "Lunch", "Both"] as const;
export type MealType = typeof MEAL_TYPES[number];

export const TP_MEAL_CATALOG = {
  TP_BF: { code: "TP_BF", label: "TP Breakfast", shortLabel: "Breakfast", category: "BF", price: 20, days: [0, 1, 2, 3, 4, 5, 6], dayNote: "Daily", colorClass: "emerald" },
  TP_VEG: { code: "TP_VEG", label: "Veg Lunch", shortLabel: "Veg", category: "LUNCH", price: 35, days: [0, 1, 2, 3, 4, 5, 6], dayNote: "Every Day", colorClass: "green" },
  TP_EGG: { code: "TP_EGG", label: "Egg Lunch", shortLabel: "Egg", category: "LUNCH", price: 45, days: [0, 1, 2, 3, 4, 5, 6], dayNote: "Every Day", colorClass: "amber" },
  TP_FISH: { code: "TP_FISH", label: "Fish Lunch", shortLabel: "Fish", category: "LUNCH", price: 55, days: [1, 4], dayNote: "Mon & Thu Only", colorClass: "sky" },
  TP_CHICKEN: { code: "TP_CHICKEN", label: "Chicken Lunch", shortLabel: "Chicken", category: "LUNCH", price: 65, days: [0, 3, 5], dayNote: "Wed, Fri & Sun Only", colorClass: "rose" },
  TP_OUTSIDE: { code: "TP_OUTSIDE", label: "Outside Lunch", shortLabel: "Outside", category: "LUNCH", price: 80, days: [0, 1, 2, 3, 4, 5, 6], dayNote: "Outside Special", colorClass: "purple" },
} as const;

export type TpMealCode = keyof typeof TP_MEAL_CATALOG;
export type MealEntry = {
  dinerCode: string;
  dinerName: string;
  mealType: MealType;
  morningCash: number;
  lunchCash: number;
  originalDue: number;
  originalReturn: number;
  dueSettled: boolean;
  returnSettled: boolean;
};

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function getMealCost(mealType: MealType): number {
  if (mealType === "BF") return 5;
  if (mealType === "Lunch") return 20;
  return 25;
}

export function createCalculatedEntry(
  dinerCode: string,
  dinerName: string,
  mealType: MealType,
  cash: number,
): MealEntry {
  const amount = money(cash);
  const morningCash = mealType === "Lunch" ? 0 : amount;
  const lunchCash = mealType === "Lunch" ? amount : 0;
  const totalCash = morningCash + lunchCash;
  const cost = getMealCost(mealType);

  return {
    dinerCode,
    dinerName,
    mealType,
    morningCash,
    lunchCash,
    originalDue: money(Math.max(0, cost - totalCash)),
    originalReturn: money(Math.max(0, totalCash - cost)),
    dueSettled: false,
    returnSettled: false,
  };
}

export function evaluateEntry(item: MealEntry) {
  const activeDue = item.dueSettled ? 0 : Number(item.originalDue);
  const activeReturn = item.returnSettled ? 0 : Number(item.originalReturn);
  const returnedCash = item.returnSettled ? Number(item.originalReturn) : 0;
  const netPaid = money(Number(item.morningCash) + Number(item.lunchCash) - returnedCash);
  let bfPaidAmt = 0;
  let lunchPaidAmt = 0;

  if (item.mealType === "BF") {
    bfPaidAmt = Math.min(5, netPaid);
  } else if (item.mealType === "Lunch") {
    lunchPaidAmt = Math.min(20, netPaid);
  } else {
    bfPaidAmt = Math.min(5, netPaid);
    lunchPaidAmt = Math.max(0, Math.min(20, netPaid - bfPaidAmt));
  }

  let statusLabel = "Paid";
  let statusType: "paid" | "due" | "return" | "settled" = "paid";
  if (activeDue > 0) {
    statusLabel = item.mealType === "BF" ? `Due ₹${activeDue} (L ₹${activeDue + 20})` : `Due ₹${activeDue}`;
    statusType = "due";
  } else if (activeReturn > 0) {
    statusLabel = `Ret ₹${activeReturn}`;
    statusType = "return";
  } else if (item.dueSettled || item.returnSettled) {
    statusLabel = "Settled ✓";
    statusType = "settled";
  }

  return { activeDue, activeReturn, netPaid, bfPaidAmt, lunchPaidAmt, statusLabel, statusType };
}

export function settleEntry<T extends MealEntry>(item: T): T {
  const next = { ...item };
  if (!next.dueSettled && next.originalDue > 0) {
    if (next.mealType === "BF") {
      next.mealType = "Both";
      next.lunchCash = money(next.lunchCash + next.originalDue + 20);
    } else {
      next.lunchCash = money(next.lunchCash + next.originalDue);
    }
    next.dueSettled = true;
  } else if (!next.returnSettled && next.originalReturn > 0) {
    next.returnSettled = true;
  } else if (next.mealType === "BF" && next.originalDue === 0) {
    next.mealType = "Both";
    next.lunchCash = money(next.lunchCash + 20);
  }
  return next;
}

export function addLunch20<T extends MealEntry>(item: T): T {
  return { ...item, mealType: "Both", lunchCash: money(item.lunchCash + 20) };
}

export function addLunchDue<T extends MealEntry>(item: T): T {
  return {
    ...item,
    mealType: "Both",
    originalDue: money(item.originalDue + 20),
    dueSettled: false,
  };
}

export function normalizeDinerCode(value: string): string {
  const trimmed = value.trim().toUpperCase();
  return /^\d+$/.test(trimmed) ? `EMP-${trimmed.padStart(3, "0")}` : trimmed;
}
