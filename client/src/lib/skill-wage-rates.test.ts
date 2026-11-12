import { strict as assert } from "node:assert";
import { test } from "node:test";
import { DEFAULT_WAGE_STATE, fetchSkillWageRates, initialWageState } from "./skill-wage-rates";

test("initial state makes legacy rates visible when the client has no state rates", () => {
  assert.equal(initialWageState([{ stateName: "West Bengal" }], [{ stateName: "" }]), DEFAULT_WAGE_STATE);
  assert.equal(initialWageState([{ stateName: "West Bengal" }], [{ stateName: "" }, { stateName: " west bengal " }]), "West Bengal");
  assert.equal(initialWageState([{ stateName: "Maharashtra" }], []), "Maharashtra");
  assert.equal(initialWageState([], [{ stateName: "Assam" }]), "Assam");
  assert.equal(initialWageState([], []), DEFAULT_WAGE_STATE);
});

test("wage rate fetch accepts arrays and reports HTTP or invalid response errors", async () => {
  let url = "";
  const fetcher: typeof fetch = async (input, init) => {
    url = String(input);
    assert.equal(init?.credentials, "include");
    return Response.json([{ stateName: "Assam", dailyRate: "500" }]);
  };
  assert.equal((await fetchSkillWageRates(2026, fetcher))[0].dailyRate, "500");
  assert.equal(url, "/api/skill-wage-rates?year=2026");
  await assert.rejects(fetchSkillWageRates(2026, async () => new Response("Database unavailable", { status: 500 })), /500.*Database unavailable/);
  await assert.rejects(fetchSkillWageRates(2026, async () => Response.json({ message: "Invalid" })), /invalid response/);
});
