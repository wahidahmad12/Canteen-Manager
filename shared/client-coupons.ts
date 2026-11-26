export const CLIENT_COUPON_TYPES = [
  { value: "65", label: "65", amount: 65 },
  { value: "25", label: "25", amount: 25 },
  { value: "20", label: "20", amount: 20 },
  { value: "17", label: "17", amount: 17 },
  { value: "10", label: "10", amount: 10 },
  { value: "5", label: "5", amount: 5 },
  { value: "2", label: "2", amount: 2 },
  { value: "tea", label: "Tea", amount: 12 },
] as const;

export type CouponFormData = {
  fields: { id: number; label: string }[];
  entries: { fieldId: number; entryDate: string; qty: number }[];
};

export function couponTypeForLabel(label: string): string | undefined {
  const normalized = label.trim().replace(/\s+/g, " ");
  if (/^tea$/i.test(normalized)) return "tea";
  const match = normalized.match(/^(?:coupon\s*amount\s*)?(?:₹|rs\.?)?\s*(65|25|20|17|10|5|2)$/i);
  return match?.[1];
}

export function summarizeCouponForm(form: CouponFormData) {
  const fieldTypes = new Map<number, string>();
  const labels = new Map(form.fields.map(field => [field.id, field.label]));
  for (const field of form.fields) {
    const type = couponTypeForLabel(field.label);
    if (type) fieldTypes.set(field.id, type);
  }
  const missing = CLIENT_COUPON_TYPES.filter(type => !Array.from(fieldTypes.values()).includes(type.value)).map(type => type.label);
  const unrecognized = new Set<string>();
  const counts: Record<string, number> = {};
  for (const entry of form.entries) {
    const type = fieldTypes.get(entry.fieldId);
    if (!type) {
      if (entry.qty !== 0) unrecognized.add(labels.get(entry.fieldId) ?? `Field ${entry.fieldId}`);
      continue;
    }
    const key = `${entry.entryDate}|${type}`;
    counts[key] = (counts[key] ?? 0) + Number(entry.qty);
  }
  return { counts, missing, unrecognized: Array.from(unrecognized) };
}

export function couponMonthlySummary(employeeCounts: Record<string, number>, contractorCounts: Record<string, number>, dates: string[]) {
  return CLIENT_COUPON_TYPES.map(type => {
    const employeeCount = dates.reduce((total, date) => total + (employeeCounts[`${date}|${type.value}`] ?? 0), 0);
    const contractorCount = dates.reduce((total, date) => total + (contractorCounts[`${date}|${type.value}`] ?? 0), 0);
    const totalCoupon = employeeCount + contractorCount;
    return { ...type, employeeCount, contractorCount, totalCoupon, totalAmount: totalCoupon * type.amount };
  });
}
