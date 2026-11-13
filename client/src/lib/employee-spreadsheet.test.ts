import { strict as assert } from "node:assert";
import { test } from "node:test";
import ExcelJS from "exceljs";
import { employeeColumns } from "@shared/employee-spreadsheet";
import { employeeToSpreadsheetRow, readEmployeeWorksheet } from "./employee-spreadsheet";

test("Excel round trip preserves identifiers, status and all columns", async () => {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Employees");
  sheet.addRow(employeeColumns.map(([, label]) => label));
  const employee = employeeToSpreadsheetRow({ employeeCode: "0001", name: "Person", clientName: "Client", accountNo: "000007", aadhaarNo: "012345678901", isActive: false, dob: "2000-01-02" });
  sheet.addRow(employeeColumns.map(([field]) => employee[field]));
  const loaded = new ExcelJS.Workbook();
  await loaded.xlsx.load(await wb.xlsx.writeBuffer());
  assert.deepEqual(readEmployeeWorksheet(loaded.getWorksheet("Employees")!), [employee]);
});

test("rejects missing columns, numeric identifiers and formulas", () => {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Employees");
  sheet.addRow(employeeColumns.map(([, label]) => label));
  const employee = employeeToSpreadsheetRow({ employeeCode: "001", name: "Person", clientName: "Client", isActive: true });
  sheet.addRow(employeeColumns.map(([field]) => employee[field]));
  sheet.getRow(2).getCell(1).value = 1;
  assert.throws(() => readEmployeeWorksheet(sheet), /Employee Code/);
  sheet.getRow(2).getCell(1).value = { formula: '"001"' };
  assert.throws(() => readEmployeeWorksheet(sheet), /Employee Code/);
  sheet.getRow(1).getCell(1).value = "Unknown";
  assert.throws(() => readEmployeeWorksheet(sheet), /Missing column/);
});
