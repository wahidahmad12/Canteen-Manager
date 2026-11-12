const HRA_CLIENTS = new Set([
  "hindustan unilever",
  "hindustan unilever limited",
  "hul - kpf",
  "hul - tec",
  "united breweries limited",
  "ubl",
]);

export function usesLegacyHra(clientName: string, stateName: string | null | undefined): boolean {
  const normalizedClient = clientName.trim().replace(/\s+/g, " ").toLowerCase();
  const normalizedState = stateName?.trim().replace(/\s+/g, " ").toLowerCase();
  return HRA_CLIENTS.has(normalizedClient) && normalizedState === "west bengal";
}

export function showDaOnWageSlip(clientName: string, stateName: string | null | undefined): boolean {
  return !usesLegacyHra(clientName, stateName);
}

export function calculateLegacyHra(basicWage: number, monthlyFixedHra: number, paidDays: number) {
  return {
    hra5: Math.round(basicWage * 0.05 * 100) / 100,
    fixedHra: Math.round((monthlyFixedHra / 26) * paidDays * 100) / 100,
  };
}
