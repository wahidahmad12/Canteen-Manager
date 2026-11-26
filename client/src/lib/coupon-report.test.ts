import { strict as assert } from "node:assert";
import { test } from "node:test";
import ExcelJS from "exceljs";
import { CLIENT_COUPON_TYPES } from "../../../shared/client-coupons";
import { addCouponReportSheet, couponReportHtml, makeCouponReport } from "./coupon-report";

test("print and Excel contain matching daily entries, denominations and monthly totals", async () => {
  const date = "2026-10-01";
  const employeeQty = [2470, 1383, 923, 972, 2752, 1104, 444, 3651];
  const contractorQty = [68, 80, 24, 27, 70, 39, 18, 3126];
  const counts = (quantities: number[]) => Object.fromEntries(
    CLIENT_COUPON_TYPES.map((type, index) => [`${date}|${type.value}`, quantities[index]]),
  );
  const report = makeCouponReport("3B <Client>", "October", 2026, [date, "2026-10-02"], counts(employeeQty), counts(contractorQty));
  const html = couponReportHtml(report);
  assert.match(html, /3B &lt;Client&gt; — Coupon Report — October 2026/);
  assert.equal((html.match(/01-10-2026/g) ?? []).length, 1);
  assert.match(html, /Denominations Qty - Employee/);
  assert.match(html, /Denominations Qty - Contractors/);
  assert.match(html, /Tea ₹12/);
  assert.match(html, /17,151/);
  assert.match(html, /3,53,651/);

  const workbook = new ExcelJS.Workbook();
  addCouponReportSheet(workbook, report);
  const buffer = await workbook.xlsx.writeBuffer();
  const roundTrip = new ExcelJS.Workbook();
  await roundTrip.xlsx.load(buffer);
  const sheet = roundTrip.getWorksheet("Coupon Report");
  assert.ok(sheet);
  assert.equal(sheet.getCell("A1").value, report.title);
  assert.equal(sheet.getCell("A4").value, "01-10-2026");
  assert.equal(sheet.getCell("B4").value, 2470);
  assert.equal(sheet.getCell("J4").value, 68);
  assert.equal(sheet.getCell("A5").value, "02-10-2026");
  assert.equal(sheet.getCell("B5").value, 0);
  assert.equal(sheet.getCell("B6").value, 2470);
  assert.equal(sheet.getCell("J6").value, 68);
  assert.equal(sheet.getCell("E8").value, "Monthly Summary");
  assert.equal(sheet.getCell("E17").value, "Tea ₹12");
  assert.equal(sheet.getCell("M17").value, 81324);
  assert.equal(sheet.getCell("K18").value, 17151);
  assert.equal(sheet.getCell("M18").value, 353651);
  assert.equal(sheet.pageSetup.printArea, "A1:Q18");
});
