import { strict as assert } from "node:assert";
import { test } from "node:test";
import { calculateLegacyHra, usesLegacyHra } from "./payroll-utils";

test("West Bengal HUL and UBL client names retain HRA", () => {
  for (const client of ["Hindustan Unilever Limited", "Hindustan Unilever", "HUL - KPF", "HUL - TEC", "United Breweries Limited", "UBL"]) {
    assert.equal(usesLegacyHra(client, "West Bengal"), true, client);
  }
  assert.equal(usesLegacyHra("  HINDUSTAN  UNILEVER LIMITED  ", " west  bengal "), true);
});

test("Goa, Sikkim, unknown states, and other clients do not use legacy HRA", () => {
  for (const state of ["Goa", "Sikkim", "", null, undefined]) {
    assert.equal(usesLegacyHra("Hindustan Unilever Limited", state), false);
    assert.equal(usesLegacyHra("United Breweries Limited", state), false);
  }
  assert.equal(usesLegacyHra("Another Company", "West Bengal"), false);
  assert.equal(usesLegacyHra("Hindustan Unilever Foods Limited", "West Bengal"), false);
});

test("legacy HRA uses 5% of basic wages and prorates monthly fixed HRA by present days", () => {
  assert.deepEqual(calculateLegacyHra(15221, 2600, 20), { hra5: 761.05, fixedHra: 2000 });
  assert.deepEqual(calculateLegacyHra(0, 2600, 0), { hra5: 0, fixedHra: 0 });
  assert.deepEqual(calculateLegacyHra(1000, 1000, 13), { hra5: 50, fixedHra: 500 });
});
