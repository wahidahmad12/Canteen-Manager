import { HUL_MEAL_RATES } from "./client-summary-rates";

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export type Period = { year: number; month: number };
export type Cell = string | number;
export type ReportTable = {
  name: string;
  title: string;
  subtitle?: string;
  headers: string[];
  rows: Cell[][];
  total: Cell[];
  color: string;
  periods?: Period[];
};

export interface SalaryRecord {
  employeeId: number;
  daysWorked: string | null;
  overtimeHours: string | null;
  basicWage: string | null;
  da: string | null;
  otherAllowance: string | null;
  hra: string | null;
  overtimeAmount: string | null;
  grossWage: string | null;
  pfDeduction: string | null;
  esicDeduction: string | null;
  professionalTax: string | null;
  lwf: string | null;
  totalDeduction: string | null;
  netPay: string | null;
}

export interface ReportEmployee {
  id: number;
  name: string;
  employeeCode: string | null;
  skills: string | null;
  designation: string | null;
}

export function numberValue(value: unknown): number {
  const result = Number(value);
  if (!Number.isFinite(result)) throw new Error("Report data contains an invalid number.");
  return result;
}

export function totalColumns(rows: Cell[][], start: number, label: Cell[]): Cell[] {
  const width = rows[0]?.length ?? start;
  return [...label, ...Array.from({ length: width - start }, (_, i) =>
    rows.reduce((sum, row) => sum + numberValue(row[start + i]), 0))];
}

function skillLevel(designation: string | null): string {
  const value = (designation || "").toLowerCase();
  if (value.includes("supervisor") || value.includes("incharge") || value.includes("manager")) return "Highly Skilled";
  if (value.includes("cook")) return "Skilled";
  if (value.includes("helper")) return "Unskilled";
  if (value.includes("semi")) return "Semi skilled";
  return "Unskilled";
}

const salaryHeaders = [
  "Sl. No.", "Emp ID", "Emp Name", "Skills", "Paid Days", "OT Hrs",
  "Basic Wages", "HRA 5%", "Fixed HRA", "OT Allow", "Total Gross",
  "PF @12%", "ESIC @.75%", "P-TAX", "LWF", "Total Dedu", "Net Salary",
  "PF @13%", "ESIC @3.25%", "Bonus @8.33%", "Employer Total",
];

export function salaryTable(
  client: string,
  year: number,
  months: number[],
  records: SalaryRecord[],
  employees: ReportEmployee[],
): ReportTable {
  const employeeMap = new Map(employees.map(employee => [employee.id, employee]));
  const grouped = new Map<number, number[]>();
  const includeDA = records.some(record => numberValue(record.da) !== 0);
  for (const record of records) {
    const n = numberValue;
    const basic = n(record.basicWage);
    const gross = n(record.grossWage);
    const pfEmployer = Math.round(basic * 0.13);
    const esicEmployer = Math.round(gross * 0.0325);
    const bonus = Math.round(basic * 0.0833);
    const values = [
      n(record.daysWorked), n(record.overtimeHours), basic, ...(includeDA ? [n(record.da)] : []), n(record.otherAllowance),
      n(record.hra), n(record.overtimeAmount), gross, n(record.pfDeduction),
      n(record.esicDeduction), n(record.professionalTax), n(record.lwf),
      n(record.totalDeduction), n(record.netPay), pfEmployer, esicEmployer, bonus,
      gross + pfEmployer + esicEmployer + bonus,
    ];
    const totals = grouped.get(record.employeeId) ?? values.map(() => 0);
    values.forEach((value, i) => { totals[i] += value; });
    grouped.set(record.employeeId, totals);
  }
  const rows = Array.from(grouped).map(([id, values]) => {
    const employee = employeeMap.get(id);
    return {
      name: employee?.name || `Employee #${id}`,
      code: employee?.employeeCode || "",
      skills: employee?.skills || skillLevel(employee?.designation || null),
      values,
    };
  }).sort((a, b) => a.name.localeCompare(b.name)).map((r, i) => [i + 1, r.code, r.name, r.skills, ...r.values]);
  return {
    name: `Annual Salary ${year}`,
    title: `${client} — Annual Salary Report — ${year}`,
    subtitle: `Months: ${months.map(month => MONTHS[month - 1]).join(", ")} (Salary Register Format)`,
    headers: includeDA ? [...salaryHeaders.slice(0, 7), "DA", ...salaryHeaders.slice(7)] : salaryHeaders,
    rows,
    total: rows.length ? totalColumns(rows, 4, ["", "", "Total", ""]) : ["", "", "Total", "", ...Array(includeDA ? 18 : 17).fill(0)],
    color: "1A237E",
  };
}

export interface HulMealRow {
  month: number;
  breakfast: number;
  lunch: number;
  eveningSnacks: number;
  nightSnacks: number;
  guestBreakfast: number;
  guestLunch: number;
  guestEveningSnacks: number;
  guestNightSnacks: number;
}

export function hulMealTable(location: string, periods: Period[], data: Map<number, HulMealRow[]>): ReportTable {
  const rows = periods.map(({ year, month }) => {
    const record = data.get(year)?.find(row => row.month === month);
    const value = (key: keyof HulMealRow) => numberValue(record?.[key] ?? 0);
    const bf = value("breakfast"), lunch = value("lunch"), evening = value("eveningSnacks"), night = value("nightSnacks");
    const guestBf = value("guestBreakfast"), guestLunch = value("guestLunch");
    const guestEvening = value("guestEveningSnacks"), guestNight = value("guestNightSnacks");
    const rates = HUL_MEAL_RATES;
    const meal = bf * rates.breakfast + lunch * rates.lunch + evening * rates.evening + night * rates.night;
    const guest = guestBf * rates.guestBreakfast + guestLunch * rates.guestLunch + guestEvening * rates.guestEvening + guestNight * rates.guestNight;
    return [`${MONTHS[month - 1]} ${year}`, bf, lunch, evening, night, meal, guestBf, guestLunch, guestEvening, guestNight, guest, meal + guest];
  });
  const years = Array.from(new Set(periods.map(period => period.year)));
  return {
    name: location,
    title: `HUL ${location} — Rate Wise Yearly Summary — ${years.join(" to ")}`,
    headers: ["Month", "Breakfast", "Lunch", "Evng Snacks", "Night Snacks", "Meal Sub (₹)", "G.Breakfast", "G.Lunch", "G.Evng Snacks", "G.Night Snacks", "Guest Sub (₹)", "Grand Total (₹)"],
    rows,
    total: rows.length ? totalColumns(rows, 1, ["GRAND TOTAL"]) : ["GRAND TOTAL", ...Array(11).fill(0)],
    color: location === "KPF" ? "1A6B2E" : "1A3A8A",
    periods,
  };
}

