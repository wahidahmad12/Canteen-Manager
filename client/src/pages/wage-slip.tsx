import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Printer, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoPath from "@assets/logo1_1771660912341.png";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function numberToWords(num: number): string {
  if (num === 0) return "Zero Only";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const scales = ["", "Thousand", "Lakh", "Crore"];

  const n = Math.floor(Math.abs(num));
  if (n === 0) return "Zero Only";

  const groups: number[] = [];
  let remaining = n;
  groups.push(remaining % 1000);
  remaining = Math.floor(remaining / 1000);
  while (remaining > 0) {
    groups.push(remaining % 100);
    remaining = Math.floor(remaining / 100);
  }

  function twoDigit(n: number): string {
    if (n < 20) return ones[n];
    return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
  }

  function threeDigit(n: number): string {
    if (n === 0) return "";
    if (n < 100) return twoDigit(n);
    return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + twoDigit(n % 100) : "");
  }

  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (g === 0) continue;
    const word = i === 0 ? threeDigit(g) : twoDigit(g);
    parts.push(word + (scales[i] ? " " + scales[i] : ""));
  }

  return "Rupees " + parts.join(" ") + " Only";
}

interface SalaryRecord {
  id: number;
  employeeId: number;
  clientName: string;
  month: number;
  year: number;
  daysWorked: string;
  basicWage: string;
  da: string;
  hra: string;
  otherAllowance: string;
  grossWage: string;
  pfDeduction: string;
  esicDeduction: string;
  professionalTax: string;
  advanceDeduction: string;
  fineDeduction: string;
  otherDeduction: string;
  totalDeduction: string;
  netPay: string;
  overtimeHours: string;
  overtimeRate: string;
  overtimeAmount: string;
  paymentMode: string;
  paidOn: string | null;
}

interface Employee {
  id: number;
  name: string;
  employeeCode?: string;
  fatherName?: string;
  designation?: string;
  department?: string;
  pfNo?: string;
  esicNo?: string;
  uanNo?: string;
  aadhaarNo?: string;
  panNo?: string;
  accountNo?: string;
  bankName?: string;
  ifscCode?: string;
  dailyRate?: string;
  gender?: string;
  dob?: string;
  address?: string;
  joiningDate?: string;
  leavingDate?: string;
  mobile?: string;
}

interface AttendanceRecord {
  id: number;
  employeeId: number;
  month: number;
  year: number;
  totalPresent: string;
  totalAbsent: string;
  overtimeHours: string;
  [key: string]: any;
}

export default function WageSlip() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const { data: salary, isLoading: salaryLoading } = useQuery<SalaryRecord>({
    queryKey: ["/api/salary", id],
    queryFn: async () => {
      const res = await fetch(`/api/salary/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch salary record");
      return res.json();
    },
    enabled: !!id,
  });

  const { data: employees } = useQuery<Employee[]>({
    queryKey: ["/api/employees", salary?.clientName],
    queryFn: async () => {
      const res = await fetch(`/api/employees?clientName=${encodeURIComponent(salary!.clientName)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch employees");
      return res.json();
    },
    enabled: !!salary?.clientName,
  });

  const { data: attendanceList } = useQuery<AttendanceRecord[]>({
    queryKey: ["/api/attendance", salary?.clientName, salary?.month, salary?.year],
    queryFn: async () => {
      const res = await fetch(`/api/attendance?clientName=${encodeURIComponent(salary!.clientName)}&month=${salary!.month}&year=${salary!.year}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch attendance");
      return res.json();
    },
    enabled: !!salary?.clientName && !!salary?.month && !!salary?.year,
  });

  const employee = employees?.find((e) => e.id === salary?.employeeId);
  const attendance = attendanceList?.find((a) => a.employeeId === salary?.employeeId);

  if (salaryLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!salary) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-lg text-muted-foreground">Salary record not found</p>
        <Link href="/salary">
          <Button variant="outline" data-testid="button-back-not-found">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Salary Register
          </Button>
        </Link>
      </div>
    );
  }

  const n = (v: string | undefined | null) => Number(v) || 0;
  const basicRate = n(employee?.dailyRate);
  const basic = n(salary.basicWage);
  const hra5 = Math.round(basic * 0.05);
  const fixedHRA = n(salary.hra);
  const otAllow = n(salary.otherAllowance);
  const totalGross = n(salary.grossWage);
  const pfDed = n(salary.pfDeduction);
  const esicDed = n(salary.esicDeduction);
  const pTax = n(salary.professionalTax);
  const lwf = n(salary.otherDeduction);
  const totalDedu = n(salary.totalDeduction);
  const netSalary = n(salary.netPay);
  const otHrs = n(salary.overtimeHours);

  const prsDays = n(attendance?.totalPresent) || n(salary.daysWorked);
  const halfDay = 0;
  const extraWork = 0;
  const leave = n(attendance?.totalAbsent);

  let holidays = 0;
  if (attendance) {
    for (let i = 1; i <= 31; i++) {
      const val = attendance[`day${i}`];
      if (val === "H" || val === "WO" || val === "PH") holidays++;
    }
  }

  const paidDays = n(salary.daysWorked);

  const formatDate = (d: string | undefined | null) => {
    if (!d) return "-";
    try {
      const dt = new Date(d);
      return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
    } catch { return d; }
  };

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; -webkit-print-color-adjust: exact; margin: 0; padding: 0; }
          .wage-slip-container { box-shadow: none !important; max-width: 100% !important; margin: 0 !important; }
          .wage-slip-container * { color: black !important; }
        }
        .slip-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .slip-table td, .slip-table th { border: 1px solid #333; padding: 4px 8px; }
        .slip-label { font-weight: 600; background: #f9f9f9; white-space: nowrap; }
        @media (prefers-color-scheme: dark) {
          .slip-label { background: transparent; }
        }
        .dark .slip-label { background: transparent; }
        .slip-val { font-weight: 500; }
      `}</style>

      <div className="min-h-screen bg-muted/20 p-4 sm:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6 no-print">
            <Link href="/salary">
              <Button variant="outline" data-testid="button-back-salary">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Salary Register
              </Button>
            </Link>
            <Button onClick={() => window.print()} data-testid="button-print-slip">
              <Printer className="w-4 h-4 mr-2" />
              Print Wage Slip
            </Button>
          </div>

          <div className="wage-slip-container bg-white dark:bg-card border-2 border-black dark:border-border shadow-lg">
            <table className="slip-table">
              <tbody>
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px" }}>
                      <img src={logoPath} alt="DJ Logo" style={{ width: "50px", height: "50px" }} />
                      <div>
                        <div style={{ fontSize: "16px", fontWeight: "bold" }} data-testid="text-company-header">DJ HOSPITALITY & FACILITY MANAGEMENT PVT LTD</div>
                        <div style={{ fontSize: "10px" }}>Regd. & Head Office: 730, Tin Made, Sodiem Siolim, Mapusa Bardez, North Goa-403502, India</div>
                        <div style={{ fontSize: "10px" }}>Branch Office: 7 Crimatorium Street, Kolkata- 700014</div>
                      </div>
                    </div>
                    <div style={{ fontWeight: "bold", fontSize: "14px", marginTop: "4px" }}>Form - XIX Wages Slip</div>
                    <div style={{ fontSize: "11px" }}>[See rule 78(1)(b)]</div>
                  </td>
                </tr>

                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "10px", fontSize: "20px", fontWeight: "bold" }} data-testid="text-slip-period">
                    {MONTHS[salary.month - 1]}-{salary.year}
                  </td>
                </tr>

                <tr>
                  <td className="slip-label" colSpan={2}>Company Name</td>
                  <td className="slip-val" colSpan={6} data-testid="text-company-name"><strong>{salary.clientName}</strong></td>
                </tr>
                <tr>
                  <td className="slip-label" colSpan={2}>Location of work</td>
                  <td className="slip-val" colSpan={6}>Khidirpur Factory, 1, Transport depot Rd, Goragacha Rood, Kolkata - 700110</td>
                </tr>
                <tr>
                  <td className="slip-label" colSpan={2}>Name:</td>
                  <td className="slip-val" colSpan={6} style={{ fontSize: "15px", fontWeight: "bold" }} data-testid="text-employee-name">{employee?.name || "-"}</td>
                </tr>

                <tr>
                  <td className="slip-label" colSpan={2}>Father's / Husband's :</td>
                  <td className="slip-val" colSpan={2} data-testid="text-father-name">{employee?.fatherName || "-"}</td>
                  <td className="slip-label">Skills:</td>
                  <td className="slip-val" colSpan={3}>{employee?.designation || "Unskilled"}</td>
                </tr>
                <tr>
                  <td className="slip-label" colSpan={2}>Date Of Birth</td>
                  <td className="slip-val" colSpan={2} data-testid="text-dob">{formatDate(employee?.dob)}</td>
                  <td className="slip-label">Joining Date :</td>
                  <td className="slip-val" colSpan={3} data-testid="text-joining-date">{formatDate(employee?.joiningDate)}</td>
                </tr>
                <tr>
                  <td className="slip-label" colSpan={2}>ESIC No.:</td>
                  <td className="slip-val" colSpan={2} data-testid="text-esic-no">{employee?.esicNo || "-"}</td>
                  <td className="slip-label">UAN:</td>
                  <td className="slip-val" colSpan={3} data-testid="text-uan-no">{employee?.uanNo || "-"}</td>
                </tr>
                <tr>
                  <td className="slip-label" colSpan={2}>PF No.:</td>
                  <td className="slip-val" colSpan={2} data-testid="text-pf-no">{employee?.pfNo || "-"}</td>
                  <td className="slip-label">Mobile No:</td>
                  <td className="slip-val" colSpan={3} data-testid="text-mobile">{employee?.mobile || "-"}</td>
                </tr>

                <tr>
                  <td className="slip-label">Bank Name:</td>
                  <td className="slip-val" colSpan={3} data-testid="text-bank-name">{employee?.bankName || "-"}</td>
                  <td className="slip-label">IFSC Code :</td>
                  <td className="slip-val" colSpan={3} data-testid="text-ifsc">{employee?.ifscCode || "-"}</td>
                </tr>
                <tr>
                  <td className="slip-label">Bank Account No.:</td>
                  <td className="slip-val" colSpan={3} data-testid="text-account-no">{employee?.accountNo || "-"}</td>
                  <td className="slip-label">Pay. Date:</td>
                  <td className="slip-val" colSpan={3} data-testid="text-paid-on">{salary.paidOn ? formatDate(salary.paidOn) : "-"}</td>
                </tr>

                <tr>
                  <td className="slip-label">PRS DAYS</td>
                  <td className="slip-val" style={{ textAlign: "right" }} data-testid="text-prs-days">{prsDays}</td>
                  <td className="slip-label" colSpan={2}>Basic Rate</td>
                  <td className="slip-val" style={{ textAlign: "right" }} data-testid="text-basic-rate">{basicRate}</td>
                  <td className="slip-label" colSpan={2}>ESIC @ 0.75%</td>
                  <td className="slip-val" style={{ textAlign: "right" }} data-testid="text-esic-ded">{esicDed}</td>
                </tr>
                <tr>
                  <td className="slip-label">Half Day</td>
                  <td className="slip-val" style={{ textAlign: "right" }}>{halfDay}</td>
                  <td className="slip-label" colSpan={2}>Basic</td>
                  <td className="slip-val" style={{ textAlign: "right" }} data-testid="text-basic">{basic}</td>
                  <td className="slip-label" colSpan={2}>P-TAX</td>
                  <td className="slip-val" style={{ textAlign: "right" }} data-testid="text-ptax">{pTax}</td>
                </tr>
                <tr>
                  <td className="slip-label">Extra Work</td>
                  <td className="slip-val" style={{ textAlign: "right" }}>{extraWork}</td>
                  <td className="slip-label" colSpan={2}>HRA 5%</td>
                  <td className="slip-val" style={{ textAlign: "right" }}>{hra5}</td>
                  <td className="slip-label" colSpan={2}>LWF</td>
                  <td className="slip-val" style={{ textAlign: "right" }}>{lwf}</td>
                </tr>
                <tr>
                  <td className="slip-label">LEAVE</td>
                  <td className="slip-val" style={{ textAlign: "right" }}>{leave}</td>
                  <td className="slip-label" colSpan={2}>Fixed HRA</td>
                  <td className="slip-val" style={{ textAlign: "right" }}>{fixedHRA}</td>
                  <td className="slip-label" colSpan={2}>Total Dedu</td>
                  <td className="slip-val" style={{ textAlign: "right", fontWeight: "bold" }} data-testid="text-total-deductions">{totalDedu}</td>
                </tr>
                <tr>
                  <td className="slip-label">HOLIDAYS</td>
                  <td className="slip-val" style={{ textAlign: "right" }}>{holidays}</td>
                  <td className="slip-label" colSpan={2}>OT Allow</td>
                  <td className="slip-val" style={{ textAlign: "right" }}>{n(salary.overtimeAmount)}</td>
                  <td className="slip-label" colSpan={2} style={{ fontSize: "11px" }}>Leave Balance {salary.year}</td>
                  <td className="slip-val" style={{ textAlign: "right" }}>0</td>
                </tr>
                <tr>
                  <td className="slip-label">Paid Days</td>
                  <td className="slip-val" style={{ textAlign: "right", fontWeight: "bold" }} data-testid="text-paid-days">{paidDays}</td>
                  <td className="slip-label" colSpan={2}>Total Gross</td>
                  <td className="slip-val" style={{ textAlign: "right", fontWeight: "bold" }} data-testid="text-total-gross">{totalGross}</td>
                  <td className="slip-label" colSpan={2} style={{ fontSize: "10px" }}>Leave Encashment Amt. {salary.year}</td>
                  <td className="slip-val" style={{ textAlign: "right" }}>0</td>
                </tr>
                <tr>
                  <td className="slip-label">OT HRS</td>
                  <td className="slip-val" style={{ textAlign: "right" }}>{otHrs}</td>
                  <td className="slip-label" colSpan={2}>PF Deduction @12%</td>
                  <td className="slip-val" style={{ textAlign: "right" }} data-testid="text-pf-ded">{pfDed}</td>
                  <td className="slip-label" colSpan={2} style={{ fontWeight: "bold" }}>Net Salary</td>
                  <td className="slip-val" style={{ textAlign: "right", fontWeight: "bold", fontSize: "15px" }} data-testid="text-net-pay">{netSalary}</td>
                </tr>

                <tr>
                  <td className="slip-label" colSpan={2} style={{ fontWeight: "bold" }}>Net Salary in Word</td>
                  <td className="slip-val" colSpan={6} style={{ fontWeight: "bold" }} data-testid="text-net-pay-words">
                    {numberToWords(netSalary)}
                  </td>
                </tr>

                <tr>
                  <td colSpan={8} style={{ height: "60px", verticalAlign: "bottom", padding: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ borderTop: "1px solid #333", paddingTop: "4px", minWidth: "180px" }}>Prepared By Signature</div>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ borderTop: "1px solid #333", paddingTop: "4px", minWidth: "180px" }}>Approved By Signature and Stamp</div>
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
