import type { ReportTable } from "./yearly-report";

export async function buildYearlyWorkbook(tables: ReportTable[], note: string) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const border = { top: { style: "thin" as const }, bottom: { style: "thin" as const }, left: { style: "thin" as const }, right: { style: "thin" as const } };
  tables.forEach(table => {
    const ws = workbook.addWorksheet(table.name.slice(0, 31));
    const title = ws.getCell(1, 1);
    title.value = table.title;
    if (table.subtitle) {
      title.font = { bold: true, size: 13 };
      const subtitle = ws.addRow([table.subtitle]);
      subtitle.font = { size: 10, color: { argb: "FF555555" } };
      ws.addRow([]);
    } else {
      ws.mergeCells(1, 1, 1, table.headers.length);
      title.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
      title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${table.color}` } };
      title.alignment = { horizontal: "center" };
    }
    const header = ws.addRow(table.headers);
    if (table.subtitle) header.height = 24;
    header.eachCell(cell => {
      cell.font = { bold: true, size: table.subtitle ? 9 : 11, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${table.color}` } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = border;
    });
    for (const [index, row] of Array.from([...table.rows, table.total].entries())) {
      const excelRow = ws.addRow(row);
      excelRow.eachCell({ includeEmpty: true }, cell => {
        cell.border = border;
        if (table.subtitle) cell.font = { size: 9 };
        if (typeof cell.value === "number") cell.numFmt = "#,##0.##";
      });
      if (table.periods && index < table.rows.length) {
        const period = table.periods[index];
        excelRow.getCell(1).value = new Date(Date.UTC(period.year, period.month - 1, 1));
        excelRow.getCell(1).numFmt = "mmm-yy";
      }
      if (table.subtitle && index < table.rows.length && index % 2 === 1) {
        excelRow.eachCell({ includeEmpty: true }, cell => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F5F5" } };
        });
      }
    }
    const total = ws.lastRow;
    if (total) total.eachCell({ includeEmpty: true }, cell => {
      cell.font = { bold: true, size: table.subtitle ? 9 : 11 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: table.subtitle ? "FFE8EAF6" : "FFFFF2CC" } };
    });
    table.headers.forEach((headerText, index) => {
      ws.getColumn(index + 1).width = table.periods ? 14 : table.subtitle ? [6, 10, 26, 14][index] ?? 11 : Math.min(28, Math.max(14, headerText.length + 2));
    });
    ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  });
  if (note || !tables.length) {
    const ws = workbook.addWorksheet("Report Notes");
    ws.addRow([note || "No meal or salary data available for the selected months."]);
    ws.getColumn(1).width = 80;
  }
  return workbook;
}
