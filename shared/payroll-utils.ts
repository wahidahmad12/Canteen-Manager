const HRA_CLIENTS = new Set(["hindustan unilever", "united breweries limited"]);

export function usesLegacyHra(clientName: string, stateName: string | null | undefined): boolean {
  const normalizedClient = clientName.trim().replace(/\s+/g, " ").toLowerCase();
  const normalizedState = stateName?.trim().replace(/\s+/g, " ").toLowerCase();
  return HRA_CLIENTS.has(normalizedClient) && normalizedState === "west bengal";
}
