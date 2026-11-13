import { z } from "zod";

export const employeeColumns = [
  ["employeeCode", "Employee Code"], ["name", "Name"], ["fatherName", "Father's / Husband's Name"],
  ["designation", "Designation"], ["department", "Department"], ["clientName", "Client Name"],
  ["esicNo", "ESIC No"], ["pfNo", "PF No"], ["uanNo", "UAN No"], ["aadhaarNo", "Aadhaar No"],
  ["panNo", "PAN No"], ["bankName", "Bank Name"], ["accountNo", "Account No"], ["ifscCode", "IFSC Code"],
  ["dailyRate", "Daily Rate"], ["fixedHra", "Fixed HRA"], ["daAmount", "DA Amount"], ["gender", "Gender"],
  ["maritalStatus", "Marital Status"], ["religion", "Religion"], ["email", "Email"], ["dob", "Date of Birth"],
  ["address", "Address"], ["permanentAddress", "Permanent Address"], ["localAddress", "Local Address"],
  ["skills", "Skills"], ["joiningDate", "Joining Date"], ["leavingDate", "Leaving Date"],
  ["leavingReason", "Leaving Reason"], ["mobile", "Mobile"], ["weeklyOffDay", "Weekly Off Day"],
  ["identificationMarks", "Identification Marks"], ["isActive", "Status"],
] as const;

export type EmployeeField = typeof employeeColumns[number][0];
export type EmployeeSpreadsheetRow = Record<EmployeeField, string>;

const dateFields = new Set<EmployeeField>(["dob", "joiningDate", "leavingDate"]);
const amountFields = new Set<EmployeeField>(["dailyRate", "fixedHra", "daAmount"]);

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  if (Number(value.slice(0, 4)) < 1000) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export const employeeSpreadsheetRowSchema = z.object(
  Object.fromEntries(employeeColumns.map(([key]) => [key, z.string()])) as Record<EmployeeField, z.ZodString>,
).strict().superRefine((row, ctx) => {
  for (const [field, label] of employeeColumns) {
    const value = row[field].trim();
    const limit = field === "employeeCode" || field === "email" ? 255 : field === "maritalStatus" || field === "weeklyOffDay" ? 50 : field === "religion" ? 100 : 500;
    if (value.length > limit) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: `${label} exceeds ${limit} characters` });
    if (["employeeCode", "name", "clientName"].includes(field) && !value) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: `${label} is required` });
    if (dateFields.has(field) && value && !isValidDate(value)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: `${label} must be a valid YYYY-MM-DD date` });
    if (amountFields.has(field) && value && !/^\d{1,8}(?:\.\d{1,2})?$/.test(value)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: `${label} must be a non-negative amount with at most 2 decimal places` });
  }
  if (!["active", "inactive"].includes(row.isActive.trim().toLowerCase())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["isActive"], message: "Status must be Active or Inactive" });
  }
});

export const employeeImportSchema = z.object({
  employees: z.array(employeeSpreadsheetRowSchema).min(1).max(5000),
}).strict();

export function employeeRowToInsert(row: EmployeeSpreadsheetRow) {
  return {
    ...Object.fromEntries(employeeColumns.map(([field]) => [field, row[field].trim()])),
    dob: row.dob.trim() || null,
    joiningDate: row.joiningDate.trim() || null,
    leavingDate: row.leavingDate.trim() || null,
    dailyRate: row.dailyRate.trim() || "0",
    fixedHra: row.fixedHra.trim() || "0",
    daAmount: row.daAmount.trim() || "0",
    isActive: row.isActive.trim().toLowerCase() === "active",
  };
}
