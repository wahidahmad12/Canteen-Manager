import { strict as assert } from "node:assert";
import { test } from "node:test";
import { branchGstNo, clientBranchSchema, clientBranchesSchema, djOfficeAddress } from "./client-offices";
import { api } from "./routes";

test("branch GST falls back to the head office only when blank", () => {
  const branch = { id: "1", name: "Kolkata", address: "Street", gstNo: "  " };
  assert.equal(branchGstNo(branch, " HEAD "), "HEAD");
  assert.equal(branchGstNo({ ...branch, gstNo: " BRANCH " }, "HEAD"), "BRANCH");
  assert.equal(branchGstNo(branch, null), "");
});

test("branches require a name and address", () => {
  assert.equal(clientBranchSchema.safeParse({ id: "1", name: " ", address: "Street", gstNo: "" }).success, false);
  assert.equal(clientBranchSchema.safeParse({ id: "1", name: "Branch", address: "", gstNo: "" }).success, false);
  assert.equal(clientBranchSchema.safeParse({ id: "1", name: "Branch", address: "Street", gstNo: "" }).success, true);
  const branch = { id: "1", name: "Branch", address: "Street", gstNo: "" };
  assert.equal(clientBranchesSchema.safeParse([branch, branch]).success, false);
  assert.equal(clientBranchSchema.safeParse({ ...branch, id: "head" }).success, false);
});

test("DJ office addresses are selected from the client state", () => {
  assert.equal(djOfficeAddress("  WEST  BENGAL "), "7 Crimatorium Street, Kolkata- 700014");
  assert.equal(djOfficeAddress("Goa"), "730, Tinmade, Sodiem Siolim, Mapusa Bardez, North Goa - 403502");
  assert.equal(djOfficeAddress("Sikkim"), "1 Rangpo Rohatang Road, Kumrek Sikkim - 737132");
  assert.equal(djOfficeAddress("Maharashtra"), null);
  assert.equal(djOfficeAddress(undefined), null);
});

test("client create and update accept branch offices and retain omitted branches", () => {
  const branch = { id: "branch-1", name: "Kolkata", address: "Street", gstNo: "" };
  assert.deepEqual(api.clients.create.input.parse({ name: "Client", branches: [branch] }).branches, [branch]);
  assert.deepEqual(api.clients.update.input.parse({ name: "Client", branches: [branch] }).branches, [branch]);
  assert.equal(api.clients.update.input.parse({ name: "Client" }).branches, undefined);
  assert.equal(api.clients.update.input.safeParse({ name: "Client", branches: [branch, branch] }).success, false);
});
