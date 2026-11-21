import { strict as assert } from "node:assert";
import { test } from "node:test";
import { hulMealTable, salaryTable, type SalaryRecord } from "./yearly-report";
import { buildYearlyWorkbook } from "./yearly-report-excel";
import ExcelJS from "exceljs";

test("HUL report totals every selected month across years, including guest meals", () => {
  const meal = (month: number, breakfast: number, guestLunch: number) => ({
    month, breakfast, lunch: 0, eveningSnacks: 0, nightSnacks: 0,
    guestBreakfast: 0, guestLunch, guestEveningSnacks: 0, guestNightSnacks: 0,
  });
  const table = hulMealTable("KPF", [{ year: 2025, month: 11 }, { year: 2026, month: 1 }],
    new Map([[2025, [meal(11, 2, 1)]], [2026, [meal(1, 3, 2), meal(2, 100, 100)]]]));
  assert.deepEqual(table.rows[0], ["November 2025", 2, 0, 0, 0, 70, 0, 1, 0, 0, 70, 140]);
  assert.equal(table.total[1], 5);
  assert.equal(table.total[10], 210);
  assert.equal(table.total[11], 385);
});

test("annual salary sums HRA and calculates employer total per month", () => {
  const record = (basic: string, gross: string, hra: string, fixedHra: string): SalaryRecord => ({
    employeeId: 1, daysWorked: "20", overtimeHours: "1.5", basicWage: basic, da: "0",
    otherAllowance: hra, hra: fixedHra, overtimeAmount: "0", grossWage: gross,
    pfDeduction: "12", esicDeduction: "1.5", professionalTax: "0", lwf: "0",
    totalDeduction: "13.5", netPay: "100",
  });
  const table = salaryTable("Example", 2026, [1, 3], [record("101", "110", "5.05", "1.25"), record("101", "120", "5.05", "2.75")],
    [{ id: 1, name: "Example", employeeCode: "E1", skills: "Skilled", designation: "" }]);
  assert.equal(table.rows[0].length, table.headers.length);
  assert.equal(table.rows[0][7], 10.1);
  assert.equal(table.rows[0][8], 4);
  assert.equal(table.rows[0][17], 26);
  assert.equal(table.rows[0][20], 280);
  assert.deepEqual(table.total.slice(4), table.rows[0].slice(4));
  assert.match(table.subtitle || "", /January, March/);
});

test("salary report with no records has a correctly aligned total", () => {
  const table = salaryTable("Example", 2026, [1], [], []);
  assert.equal(table.total.length, table.headers.length);
  assert.equal(table.total[2], "Total");
});

test("salary includes DA only when it is present", () => {
  const record: SalaryRecord = {
    employeeId: 1, daysWorked: "1", overtimeHours: "0", basicWage: "100", da: "20",
    otherAllowance: "5", hra: "10", overtimeAmount: "0", grossWage: "135", pfDeduction: "0",
    esicDeduction: "0", professionalTax: "0", lwf: "0", totalDeduction: "0", netPay: "135",
  };
  const table = salaryTable("Example", 2026, [1], [record], []);
  assert.equal(table.headers[7], "DA");
  assert.equal(table.rows[0][7], 20);
  assert.equal(table.rows[0][8], 5);
  assert.equal(table.total.length, table.headers.length);
});

test("Excel keeps the workbook columns, selected months and totals aligned", async () => {
  const meal = hulMealTable("TEC", [{ year: 2025, month: 11 }, { year: 2026, month: 2 }],
    new Map([[2025, [{ month: 11, breakfast: 2, lunch: 0, eveningSnacks: 0, nightSnacks: 0, guestBreakfast: 0, guestLunch: 1, guestEveningSnacks: 0, guestNightSnacks: 0 }]]]));
  const salary = salaryTable("Example", 2026, [2], [], []);
  const workbook = await buildYearlyWorkbook([meal, salary], "Location-wise salary unavailable");
  const bytes = await workbook.xlsx.writeBuffer();
  const reread = new ExcelJS.Workbook();
  await reread.xlsx.load(bytes);
  const sheet = reread.getWorksheet("TEC");
  assert.ok(sheet);
  assert.equal(sheet.getCell("H2").value, "G.Lunch");
  assert.deepEqual(sheet.getCell("A3").value, new Date("2025-11-01T00:00:00.000Z"));
  assert.deepEqual(sheet.getCell("A4").value, new Date("2026-02-01T00:00:00.000Z"));
  assert.equal(sheet.getCell("L5").value, 140);
  assert.equal(reread.getWorksheet("Annual Salary 2026")?.getCell("H4").value, "HRA 5%");
  assert.equal(reread.getWorksheet("Report Notes")?.getCell("A1").value, "Location-wise salary unavailable");
});
