import { strict as assert } from "node:assert";
import { test } from "node:test";
import { restoreShare, withEffectiveShares } from "./nomination-shares";

test("automatic shares are recalculated after saving and reloading nominees", () => {
  const saved = withEffectiveShares([{ name: "First", sharePercentage: "" }]);
  assert.equal(saved[0].sharePercentage, 100);
  const reloaded = saved.map(restoreShare);
  const updated = withEffectiveShares([...reloaded, { name: "Second", sharePercentage: "", shareIsAuto: true }]);
  assert.deepEqual(updated.map(n => [n.sharePercentage, n.shareIsAuto]), [[50, true], [50, true]]);
});

test("fixed shares stay fixed and the remainder is distributed exactly", () => {
  const saved = withEffectiveShares([
    { sharePercentage: 20 },
    { sharePercentage: "" },
    { sharePercentage: "" },
    { sharePercentage: "" },
  ]);
  const reloaded = saved.map(restoreShare);
  assert.deepEqual(reloaded.map(n => n.sharePercentage), [20, "", "", ""]);
  assert.deepEqual(saved.map(n => n.sharePercentage), [20, 26.66, 26.66, 26.68]);
});
