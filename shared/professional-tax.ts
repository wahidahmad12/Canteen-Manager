export function calculateProfessionalTax(grossWage: number, month: number, year: number): number {
  const isUpdatedSlabPeriod = year > 2026 || (year === 2026 && month >= 10);

  if (isUpdatedSlabPeriod) {
    if (grossWage <= 20000) return 0;
    if (grossWage <= 30000) return 100;
    if (grossWage <= 50000) return 140;
    if (grossWage <= 100000) return 170;
    return 208;
  }

  return grossWage > 40000 ? 200 : grossWage > 25000 ? 150 : grossWage > 15000 ? 130 : grossWage > 10000 ? 110 : 0;
}
