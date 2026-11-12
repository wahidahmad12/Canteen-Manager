import type { SkillWageRate } from "@shared/schema";

export const DEFAULT_WAGE_STATE = "__default__";

export function initialWageState(
  clients: { stateName?: string | null }[],
  rates: Pick<SkillWageRate, "stateName">[],
): string {
  const firstClientState = clients.find(client => client.stateName?.trim())?.stateName?.trim();
  const firstSavedState = rates.find(rate => rate.stateName?.trim())?.stateName?.trim();
  const hasDefaultRates = rates.some(rate => !rate.stateName?.trim());
  const hasClientStateRates = firstClientState && rates.some(rate =>
    rate.stateName?.trim().toLowerCase() === firstClientState.toLowerCase()
  );
  return hasClientStateRates ? firstClientState : hasDefaultRates ? DEFAULT_WAGE_STATE : firstClientState || firstSavedState || DEFAULT_WAGE_STATE;
}

export async function fetchSkillWageRates(year: number, fetcher: typeof fetch = fetch): Promise<SkillWageRate[]> {
  const response = await fetcher(`/api/skill-wage-rates?year=${year}`, { credentials: "include" });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Could not load wage rates (${response.status}): ${detail || response.statusText}`);
  }
  const data: unknown = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("Could not load wage rates: the server returned an invalid response.");
  }
  return data;
}
