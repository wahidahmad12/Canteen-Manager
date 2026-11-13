import { employeeColumns, employeeImportSchema, type EmployeeField, type EmployeeSpreadsheetRow } from "@shared/employee-spreadsheet";
import type ExcelJS from "exceljs";

const numericFields = new Set<EmployeeField>(["dailyRate", "fixedHra", "daAmount"]);
const dateFields = new Set<EmployeeField>(["dob", "joiningDate", "leavingDate"]);

export function employeeToSpreadsheetRow(employee: Record<string, unknown>): EmployeeSpreadsheetRow {
  return Object.fromEntries(employeeColumns.map(([field]) => {
    const value = employee[field];
    if (field === "isActive") return [field, value ? "Active" : "Inactive"];
    if (value == null) return [field, ""];
    if (value instanceof Date) return [field, value.toISOString().slice(0, 10)];
    return [field, dateFields.has(field) ? String(value).split("T")[0].split(" ")[0] : String(value)];
  })) as EmployeeSpreadsheetRow;
}

export function readEmployeeWorksheet(worksheet: ExcelJS.Worksheet): EmployeeSpreadsheetRow[] {
  const headers = new Map<string, number>();
  worksheet.getRow(1).eachCell((cell, index) => {
    if (typeof cell.value !== "string") throw new Error(`Column ${index}: header must be text.`);
    const header = cell.value.trim();
    if (headers.has(header)) throw new Error(`Duplicate column: ${header}`);
    headers.set(header, index);
  });
  for (const [, label] of employeeColumns) {
    if (!headers.has(label)) throw new Error(`Missing column: ${label}. Use the Employee Master template.`);
  }
  const rows: EmployeeSpreadsheetRow[] = [];
  for (let index = 2; index <= worksheet.rowCount; index++) {
    const sheetRow = worksheet.getRow(index);
    if (!sheetRow.hasValues) continue;
    const data: Partial<EmployeeSpreadsheetRow> = {};
    for (const [field, label] of employeeColumns) {
      const value = sheetRow.getCell(headers.get(label)!).value;
      if (value == null) data[field] = "";
      else if (typeof value === "string") data[field] = value;
      else if (typeof value === "number" && numericFields.has(field)) data[field] = String(value);
      else if (value instanceof Date && dateFields.has(field)) data[field] = value.toISOString().slice(0, 10);
      else throw new Error(`Row ${index}, ${label}: use plain text${numericFields.has(field) ? " or a number" : ""}; identifiers must be text to preserve leading zeroes.`);
    }
    const result = employeeImportSchema.shape.employees.element.safeParse(data);
    if (!result.success) throw new Error(`Row ${index}: ${result.error.issues[0].message}`);
    rows.push(result.data);
  }
  const parsed = employeeImportSchema.safeParse({ employees: rows });
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);
  return parsed.data.employees;
}
