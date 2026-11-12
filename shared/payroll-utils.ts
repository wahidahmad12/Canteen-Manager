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

export function calculateLegacyHra(basicWage: number, monthlyFixedHra: number, daysWorked: number) {
  return {
    hra5: Math.round(basicWage * 0.05 * 100) / 100,
    fixedHra: Math.round((monthlyFixedHra / 26) * daysWorked * 100) / 100,
  };
}
