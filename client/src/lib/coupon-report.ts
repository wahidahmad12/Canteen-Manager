import type ExcelJS from "exceljs";
import { CLIENT_COUPON_TYPES, couponMonthlySummary } from "@shared/client-coupons";

export function makeCouponReport(clientName: string, monthName: string, year: number, dates: string[], employee: Record<string, number>, contractor: Record<string, number>) {
  const daily = dates.map(date => ({
    date: date.split("-").reverse().join("-"),
    employee: CLIENT_COUPON_TYPES.map(type => employee[`${date}|${type.value}`] ?? 0),
    contractor: CLIENT_COUPON_TYPES.map(type => contractor[`${date}|${type.value}`] ?? 0),
  }));
  const summary = couponMonthlySummary(employee, contractor, dates);
  return {
    title: `${clientName} — Coupon Report — ${monthName} ${year}`,
    daily,
    summary,
    totalCoupons: summary.reduce((sum, row) => sum + row.totalCoupon, 0),
    totalAmount: summary.reduce((sum, row) => sum + row.totalAmount, 0),
  };
}

export type CouponReport = ReturnType<typeof makeCouponReport>;

const headers = ["Coupon Amount", "Employee Coupon", "Contractor Coupon", "Total Coupon", "Total Amount (₹)"];
const denominationLabel = (label: string, amount: number) => label === "Tea" ? `Tea ₹${amount}` : `₹ ${label}`;
const fmt = (value: number) => value.toLocaleString("en-IN", { maximumFractionDigits: 2 });
const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function couponReportHtml(report: CouponReport): string {
  const labels = CLIENT_COUPON_TYPES.map(type => `<th>${escapeHtml(type.label.toUpperCase())}</th>`).join("");
  const dailyRows = report.daily.map(row =>
    `<tr><td>${escapeHtml(row.date)}</td>${[...row.employee, ...row.contractor].map(value => `<td>${fmt(value)}</td>`).join("")}</tr>`,
  ).join("");
  const employeeTotals = report.summary.map(row => `<th>${fmt(row.employeeCount)}</th>`).join("");
  const contractorTotals = report.summary.map(row => `<th>${fmt(row.contractorCount)}</th>`).join("");
  const summaryRows = report.summary.map(row =>
    `<tr><th>${escapeHtml(denominationLabel(row.label, row.amount))}</th><td>${fmt(row.employeeCount)}</td><td>${fmt(row.contractorCount)}</td><td>${fmt(row.totalCoupon)}</td><td>${fmt(row.totalAmount)}</td></tr>`,
  ).join("");
  return `<!doctype html><html><head><title>${escapeHtml(report.title)}</title><style>
    @page{size:A4 landscape;margin:5mm}
    *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    body{font-family:Arial,sans-serif;font-size:8px;margin:0;color:#101827}
    h1{text-align:center;font-size:12px;margin:0 0 4px}
    table{border-collapse:collapse;table-layout:fixed}
    th,td{border:1px solid #aeb9c8;text-align:center;padding:2px;white-space:nowrap}
    .daily{width:auto;margin:0 auto}
    .date{width:76px}.qty{width:40px}
    thead th{background:#334155;color:#fff}
    thead .group,.summary .title{background:#1e293b;color:#fff}
    .daily tbody tr:nth-child(even){background:#f1f5f9}
    tfoot{background:#e2e8f0;font-weight:bold}
    .summary{width:390px;max-width:100%;margin:12px auto 0}
    .summary th,.summary td{border-color:#111;padding:3px}
    .summary thead th{white-space:normal}
    .summary .title{font-size:10px;padding:5px}
    .summary tbody th{background:#fff}
    @media print{tr{break-inside:avoid} .summary{break-inside:avoid}}
  </style></head><body><h1>${escapeHtml(report.title)}</h1>
    <table class="daily"><colgroup><col class="date">${CLIENT_COUPON_TYPES.map(() => '<col class="qty">').join("")}${CLIENT_COUPON_TYPES.map(() => '<col class="qty">').join("")}</colgroup>
      <thead><tr><th rowspan="2">Date</th><th class="group" colspan="8">Denominations Qty - Employee</th><th class="group" colspan="8">Denominations Qty - Contractors</th></tr>
      <tr>${labels}${labels}</tr></thead><tbody>${dailyRows}</tbody>
      <tfoot><tr><th>TOTAL</th>${employeeTotals}${contractorTotals}</tr></tfoot>
    </table>
    <table class="summary"><thead><tr><th colspan="5" class="title">Monthly Summary</th></tr><tr>${headers.map(header => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
      <tbody>${summaryRows}</tbody><tfoot><tr><th colspan="3">TOTAL</th><th>${fmt(report.totalCoupons)}</th><th>${fmt(report.totalAmount)}</th></tr></tfoot>
    </table>
  </body></html>`;
}

export function addCouponReportSheet(workbook: ExcelJS.Workbook, report: CouponReport) {
  const sheet = workbook.addWorksheet("Coupon Report", {
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 1, margins: { left: 0.2, right: 0.2, top: 0.2, bottom: 0.2, header: 0, footer: 0 } },
  });
  sheet.getColumn(1).width = 13;
  for (let column = 2; column <= 17; column++) sheet.getColumn(column).width = 8;
  const border: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FF94A3B8" } }, bottom: { style: "thin", color: { argb: "FF94A3B8" } },
    left: { style: "thin", color: { argb: "FF94A3B8" } }, right: { style: "thin", color: { argb: "FF94A3B8" } },
  };
  const style = (row: number, start: number, end: number, background: string, white = false) => {
    for (let col = start; col <= end; col++) {
      const cell = sheet.getCell(row, col);
      cell.border = border;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: background } };
      cell.font = { name: "Arial", size: 9, bold: white || background === "FFE2E8F0", color: { argb: white ? "FFFFFFFF" : "FF101827" } };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    }
  };
  sheet.mergeCells(1, 1, 1, 17);
  sheet.getCell(1, 1).value = report.title;
  sheet.getCell(1, 1).font = { name: "Arial", size: 12, bold: true };
  sheet.getCell(1, 1).alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 20;
  style(2, 1, 17, "FF1E293B", true);
  style(3, 1, 17, "FF334155", true);
  sheet.mergeCells(2, 1, 3, 1);
  sheet.mergeCells(2, 2, 2, 9);
  sheet.mergeCells(2, 10, 2, 17);
  sheet.getCell(2, 1).value = "Date";
  sheet.getCell(2, 2).value = "Denominations Qty - Employee";
  sheet.getCell(2, 10).value = "Denominations Qty - Contractors";
  for (let i = 0; i < CLIENT_COUPON_TYPES.length; i++) {
    sheet.getCell(3, i + 2).value = CLIENT_COUPON_TYPES[i].label.toUpperCase();
    sheet.getCell(3, i + 10).value = CLIENT_COUPON_TYPES[i].label.toUpperCase();
  }
  report.daily.forEach((row, index) => {
    const rowNo = index + 4;
    style(rowNo, 1, 17, index % 2 ? "FFF1F5F9" : "FFFFFFFF");
    sheet.getRow(rowNo).values = [row.date, ...row.employee, ...row.contractor];
  });
  const totalRow = report.daily.length + 4;
  style(totalRow, 1, 17, "FFE2E8F0");
  sheet.getRow(totalRow).values = ["TOTAL", ...report.summary.map(row => row.employeeCount), ...report.summary.map(row => row.contractorCount)];
  const summaryTitle = totalRow + 2;
  style(summaryTitle, 5, 14, "FF1E293B", true);
  sheet.mergeCells(summaryTitle, 5, summaryTitle, 14);
  sheet.getCell(summaryTitle, 5).value = "Monthly Summary";
  sheet.getRow(summaryTitle).height = 20;
  const summaryHeader = summaryTitle + 1;
  style(summaryHeader, 5, 14, "FF334155", true);
  sheet.getRow(summaryHeader).height = 30;
  headers.forEach((header, index) => {
    const col = 5 + index * 2;
    sheet.mergeCells(summaryHeader, col, summaryHeader, col + 1);
    sheet.getCell(summaryHeader, col).value = header;
  });
  report.summary.forEach((row, index) => {
    const rowNo = summaryHeader + index + 1;
    style(rowNo, 5, 14, "FFFFFFFF");
    const values = [denominationLabel(row.label, row.amount), row.employeeCount, row.contractorCount, row.totalCoupon, row.totalAmount];
    values.forEach((value, colIndex) => {
      const col = 5 + colIndex * 2;
      sheet.mergeCells(rowNo, col, rowNo, col + 1);
      sheet.getCell(rowNo, col).value = value;
      if (colIndex > 0) sheet.getCell(rowNo, col).numFmt = "#,##0.##";
    });
  });
  const finalRow = summaryHeader + report.summary.length + 1;
  style(finalRow, 5, 14, "FFE2E8F0");
  sheet.mergeCells(finalRow, 5, finalRow, 10);
  sheet.getCell(finalRow, 5).value = "TOTAL";
  sheet.mergeCells(finalRow, 11, finalRow, 12);
  sheet.getCell(finalRow, 11).value = report.totalCoupons;
  sheet.mergeCells(finalRow, 13, finalRow, 14);
  sheet.getCell(finalRow, 13).value = report.totalAmount;
  sheet.getCell(finalRow, 11).numFmt = sheet.getCell(finalRow, 13).numFmt = "#,##0.##";
  sheet.pageSetup.printArea = `A1:Q${finalRow}`;
  return sheet;
}
