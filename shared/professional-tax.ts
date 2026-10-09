export interface ProfessionalTaxSlab {
  label: string;
  max: number | null;
  rate: number;
}

const LEGACY_SLABS: ProfessionalTaxSlab[] = [
  { label: "Does not exceed INR 10,000/-", max: 10000, rate: 0 },
  { label: "Exceeds INR 10,000/- but does not exceed INR 15,000/-", max: 15000, rate: 110 },
  { label: "Exceeds INR 15,000/- but does not exceed INR 25,000/-", max: 25000, rate: 130 },
  { label: "Exceeds INR 25,000/- but does not exceed INR 40,000/-", max: 40000, rate: 150 },
  { label: "Exceeds INR 40,000/-", max: null, rate: 200 },
];

const UPDATED_SLABS: ProfessionalTaxSlab[] = [
  { label: "Does not exceed INR 20,000/-", max: 20000, rate: 0 },
  { label: "Exceeds INR 20,000/- but does not exceed INR 30,000/-", max: 30000, rate: 100 },
  { label: "Exceeds INR 30,000/- but does not exceed INR 50,000/-", max: 50000, rate: 140 },
  { label: "Exceeds INR 50,000/- but does not exceed INR 100,000/-", max: 100000, rate: 170 },
  { label: "Exceeds INR 100,000/-", max: null, rate: 208 },
];

export function getProfessionalTaxSlabs(month: number, year: number): ProfessionalTaxSlab[] {
  const isUpdatedSlabPeriod = year > 2026 || (year === 2026 && month >= 10);
  return isUpdatedSlabPeriod ? UPDATED_SLABS : LEGACY_SLABS;
}

export function calculateProfessionalTax(grossWage: number, month: number, year: number): number {
  const slab = getProfessionalTaxSlabs(month, year).find(s => s.max === null || grossWage <= s.max);
  return slab?.rate ?? 0;
}
