import { strict as assert } from "node:assert";
import { test } from "node:test";
import { employeeColumns, employeeImportSchema, employeeRowToInsert, employeeSpreadsheetRowSchema } from "./employee-spreadsheet";

function row() {
  return {
    ...Object.fromEntries(employeeColumns.map(([field]) => [field, ""])),
    employeeCode: "00123", name: "Test Employee", clientName: "Client", isActive: "Active",
  };
}

test("employee import validates required values, dates, amounts and status", () => {
  const valid = row();
  assert.equal(employeeSpreadsheetRowSchema.safeParse({ ...valid, dob: "2024-02-29", fixedHra: "200.00" }).success, true);
  for (const invalid of [
    { ...valid, name: "  " }, { ...valid, dob: "2023-02-29" }, { ...valid, joiningDate: "31-12-2026" },
    { ...valid, daAmount: "-1" }, { ...valid, dailyRate: "1.999" }, { ...valid, isActive: "" },
    { ...valid, faceDescriptor: "secret" },
  ]) assert.equal(employeeSpreadsheetRowSchema.safeParse(invalid).success, false);
  assert.equal(employeeImportSchema.safeParse({ employees: [] }).success, false);
});

test("conversion keeps leading zeroes, explicit status and blank dates", () => {
  const parsed = employeeSpreadsheetRowSchema.parse({ ...row(), isActive: "Inactive", accountNo: "0000123", dob: "" });
  const result = employeeRowToInsert(parsed);
  assert.equal(result.employeeCode, "00123");
  assert.equal(result.accountNo, "0000123");
  assert.equal(result.isActive, false);
  assert.equal(result.dob, null);
});
