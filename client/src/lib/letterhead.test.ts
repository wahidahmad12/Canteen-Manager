import { strict as assert } from "node:assert";
import { test } from "node:test";
import { letterheadForOffice } from "./letterhead";

test("state-specific letterhead uses only the selected office address", () => {
  const html = letterheadForOffice("1 Rangpo Rohatang Road, Kumrek Sikkim - 737132");
  assert.match(html, /1 Rangpo Rohatang Road, Kumrek Sikkim - 737132/);
  assert.doesNotMatch(html, /Tin Made|Crematorium Street/);
  const missing = letterheadForOffice(null);
  assert.doesNotMatch(missing, /Tin Made|Crematorium Street/);
});
