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

  const handlePrint = () => {
    const prevTitle = document.title;
    document.title = `Wage Slip - ${employee?.name || "Employee"} - ${MONTHS[salary.month - 1]} ${salary.year}`;
    window.print();
    setTimeout(() => { document.title = prevTitle; }, 500);
  };

  const C = {
    headerGrad: "linear-gradient(135deg, #1a237e 0%, #283593 30%, #3949ab 60%, #5c6bc0 100%)",
    periodGrad: "linear-gradient(135deg, #0d47a1 0%, #1565c0 50%, #1976d2 100%)",
    infoLabelBg: "#e8eaf6",
    infoLabelColor: "#283593",
    attLabelBg: "#e3f2fd",
    attLabelColor: "#0d47a1",
    attValColor: "#1565c0",
    earnLabelBg: "#e8f5e9",
    earnLabelColor: "#1b5e20",
    earnValColor: "#2e7d32",
    dedLabelBg: "#fce4ec",
    dedLabelColor: "#b71c1c",
    dedValColor: "#c62828",
    totalBg: "#fff3e0",
    totalColor: "#e65100",
    netBg: "linear-gradient(135deg, #1b5e20 0%, #2e7d32 50%, #43a047 100%)",
    netColor: "#ffffff",
    wordsBg: "#f3e5f5",
    wordsColor: "#4a148c",
    sigBg: "#fafafa",
  };

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; margin: 0; padding: 0; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
          .wage-slip-container { box-shadow: none !important; max-width: 100% !important; margin: 0 !important; border-radius: 0 !important; }
        }
        .ws-table { width: 100%; border-collapse: collapse; font-size: 13px; font-family: 'Inter', 'Segoe UI', Arial, sans-serif; }
        .ws-table td, .ws-table th { border: 1px solid #90a4ae; padding: 5px 8px; }
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
            <Button onClick={handlePrint} data-testid="button-print-slip">
              <Printer className="w-4 h-4 mr-2" />
              Print Wage Slip
            </Button>
          </div>

          <div className="wage-slip-container bg-white dark:bg-card border-2 border-indigo-400 dark:border-indigo-700 shadow-2xl rounded-xl overflow-hidden">
            <table className="ws-table">
              <tbody>
                <tr>
                  <td colSpan={8} style={{ background: C.headerGrad, color: "#fff", textAlign: "center", padding: "14px 8px 10px", border: "none" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "14px" }}>
                      <img src={logoPath} alt="DJ Logo" style={{ width: "54px", height: "54px", borderRadius: "8px", border: "2px solid rgba(255,255,255,0.4)", background: "#fff", padding: "2px" }} />
                      <div>
                        <div style={{ fontSize: "17px", fontWeight: 800, letterSpacing: "0.5px", textShadow: "1px 1px 2px rgba(0,0,0,0.3)" }} data-testid="text-company-header">DJ HOSPITALITY & FACILITY MANAGEMENT PVT LTD</div>
                        <div style={{ fontSize: "10px", opacity: 0.85, marginTop: "2px" }}>Regd. & Head Office: 730, Tin Made, Sodiem Siolim, Mapusa Bardez, North Goa-403502, India</div>
                        <div style={{ fontSize: "10px", opacity: 0.85 }}>Branch Office: 7 Crimatorium Street, Kolkata- 700014</div>
                      </div>
                    </div>
                    <div style={{ marginTop: "8px", fontSize: "15px", fontWeight: 700, letterSpacing: "1px", background: "rgba(255,255,255,0.15)", display: "inline-block", padding: "3px 20px", borderRadius: "4px" }}>
                      Form - XIX Wages Slip
                    </div>
                    <div style={{ fontSize: "10px", opacity: 0.7, marginTop: "2px" }}>[See rule 78(1)(b)]</div>
                  </td>
                </tr>

                <tr>
                  <td colSpan={8} style={{ background: C.periodGrad, color: "#fff", textAlign: "center", padding: "10px", fontSize: "20px", fontWeight: 800, letterSpacing: "2px", border: "none", textShadow: "1px 1px 3px rgba(0,0,0,0.3)" }} data-testid="text-slip-period">
                    {MONTHS[salary.month - 1].toUpperCase()} - {salary.year}
                  </td>
                </tr>

                <tr>
                  <td style={{ background: C.infoLabelBg, color: C.infoLabelColor, fontWeight: 700 }} colSpan={2}>Company Name</td>
                  <td style={{ fontWeight: 700, fontSize: "14px", color: "#1a237e" }} colSpan={6} data-testid="text-company-name">{salary.clientName}</td>
                </tr>
                <tr>
                  <td style={{ background: C.infoLabelBg, color: C.infoLabelColor, fontWeight: 600 }} colSpan={2}>Location of work</td>
                  <td colSpan={6} style={{ fontSize: "12px" }}>Khidirpur Factory, 1, Transport depot Rd, Goragacha Rood, Kolkata - 700110</td>
                </tr>
                <tr>
                  <td style={{ background: C.infoLabelBg, color: C.infoLabelColor, fontWeight: 700 }} colSpan={2}>Name:</td>
                  <td colSpan={6} style={{ fontSize: "16px", fontWeight: 800, color: "#1a237e" }} data-testid="text-employee-name">{employee?.name || "-"}</td>
                </tr>

                <tr>
                  <td style={{ background: C.infoLabelBg, color: C.infoLabelColor, fontWeight: 600, textAlign: "right" }} colSpan={2}>Father's / Husband's :</td>
                  <td colSpan={2} data-testid="text-father-name">{employee?.fatherName || "-"}</td>
                  <td style={{ background: C.infoLabelBg, color: C.infoLabelColor, fontWeight: 600, textAlign: "right" }} colSpan={2}>Skills:</td>
                  <td colSpan={2}>{employee?.designation || "Unskilled"}</td>
                </tr>
                <tr>
                  <td style={{ background: C.infoLabelBg, color: C.infoLabelColor, fontWeight: 600, textAlign: "right" }} colSpan={2}>Date Of Birth</td>
                  <td colSpan={2} data-testid="text-dob">{formatDate(employee?.dob)}</td>
                  <td style={{ background: C.infoLabelBg, color: C.infoLabelColor, fontWeight: 600, textAlign: "right" }} colSpan={2}>Joining Date :</td>
                  <td colSpan={2} data-testid="text-joining-date">{formatDate(employee?.joiningDate)}</td>
                </tr>
                <tr>
                  <td style={{ background: "#ede7f6", color: "#4a148c", fontWeight: 600, textAlign: "right" }} colSpan={2}>ESIC No.:</td>
                  <td colSpan={2} style={{ fontFamily: "monospace", fontSize: "12px", color: "#4a148c" }} data-testid="text-esic-no">{employee?.esicNo || "-"}</td>
                  <td style={{ background: "#ede7f6", color: "#4a148c", fontWeight: 600, textAlign: "right" }} colSpan={2}>UAN:</td>
                  <td colSpan={2} style={{ fontFamily: "monospace", fontSize: "12px", color: "#4a148c" }} data-testid="text-uan-no">{employee?.uanNo || "-"}</td>
                </tr>
                <tr>
                  <td style={{ background: "#ede7f6", color: "#4a148c", fontWeight: 600, textAlign: "right" }} colSpan={2}>PF No.:</td>
                  <td colSpan={2} style={{ fontFamily: "monospace", fontSize: "12px", color: "#4a148c" }} data-testid="text-pf-no">{employee?.pfNo || "-"}</td>
                  <td style={{ background: "#ede7f6", color: "#4a148c", fontWeight: 600, textAlign: "right" }} colSpan={2}>Mobile No:</td>
                  <td colSpan={2} data-testid="text-mobile">{employee?.mobile || "-"}</td>
                </tr>

                <tr>
                  <td style={{ background: "#e0f2f1", color: "#004d40", fontWeight: 600, textAlign: "right" }} colSpan={2}>Bank Name:</td>
                  <td colSpan={2} style={{ color: "#00695c" }} data-testid="text-bank-name">{employee?.bankName || "-"}</td>
                  <td style={{ background: "#e0f2f1", color: "#004d40", fontWeight: 600, textAlign: "right" }} colSpan={2}>IFSC Code :</td>
                  <td colSpan={2} style={{ fontFamily: "monospace", fontSize: "12px", color: "#00695c" }} data-testid="text-ifsc">{employee?.ifscCode || "-"}</td>
                </tr>
                <tr>
                  <td style={{ background: "#e0f2f1", color: "#004d40", fontWeight: 600, textAlign: "right" }} colSpan={2}>Bank Account No.:</td>
                  <td colSpan={2} style={{ fontFamily: "monospace", fontSize: "12px", color: "#00695c" }} data-testid="text-account-no">{employee?.accountNo || "-"}</td>
                  <td style={{ background: "#e0f2f1", color: "#004d40", fontWeight: 600, textAlign: "right" }} colSpan={2}>Pay. Date:</td>
                  <td colSpan={2} data-testid="text-paid-on">{salary.paidOn ? formatDate(salary.paidOn) : "-"}</td>
                </tr>

                <tr>
                  <td colSpan={2} style={{ background: C.attLabelBg, color: C.attLabelColor, fontWeight: 800, textAlign: "center", fontSize: "12px", letterSpacing: "1px" }}>ATTENDANCE</td>
                  <td colSpan={3} style={{ background: C.earnLabelBg, color: C.earnLabelColor, fontWeight: 800, textAlign: "center", fontSize: "12px", letterSpacing: "1px" }}>EARNINGS (₹)</td>
                  <td colSpan={3} style={{ background: C.dedLabelBg, color: C.dedLabelColor, fontWeight: 800, textAlign: "center", fontSize: "12px", letterSpacing: "1px" }}>DEDUCTIONS (₹)</td>
                </tr>

                <tr>
                  <td style={{ background: C.attLabelBg, color: C.attLabelColor, fontWeight: 600 }}>PRS DAYS</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: C.attValColor }} data-testid="text-prs-days">{prsDays}</td>
                  <td style={{ background: C.earnLabelBg, color: C.earnLabelColor, fontWeight: 600 }} colSpan={2}>Basic Rate</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: C.earnValColor }} data-testid="text-basic-rate">{basicRate}</td>
                  <td style={{ background: C.dedLabelBg, color: C.dedLabelColor, fontWeight: 600 }} colSpan={2}>ESIC @ 0.75%</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: C.dedValColor }} data-testid="text-esic-ded">{esicDed}</td>
                </tr>
                <tr>
                  <td style={{ background: C.attLabelBg, color: C.attLabelColor, fontWeight: 600 }}>Half Day</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: C.attValColor }}>{halfDay}</td>
                  <td style={{ background: C.earnLabelBg, color: C.earnLabelColor, fontWeight: 600 }} colSpan={2}>Basic</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: C.earnValColor }} data-testid="text-basic">{basic}</td>
                  <td style={{ background: C.dedLabelBg, color: C.dedLabelColor, fontWeight: 600 }} colSpan={2}>P-TAX</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: C.dedValColor }} data-testid="text-ptax">{pTax}</td>
                </tr>
                <tr>
                  <td style={{ background: C.attLabelBg, color: C.attLabelColor, fontWeight: 600 }}>Extra Work</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: C.attValColor }}>{extraWork}</td>
                  <td style={{ background: C.earnLabelBg, color: C.earnLabelColor, fontWeight: 600 }} colSpan={2}>HRA 5%</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: C.earnValColor }}>{hra5}</td>
                  <td style={{ background: C.dedLabelBg, color: C.dedLabelColor, fontWeight: 600 }} colSpan={2}>LWF</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: C.dedValColor }}>{lwf}</td>
                </tr>
                <tr>
                  <td style={{ background: C.attLabelBg, color: C.attLabelColor, fontWeight: 600 }}>LEAVE</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: C.attValColor }}>{leave}</td>
                  <td style={{ background: C.earnLabelBg, color: C.earnLabelColor, fontWeight: 600 }} colSpan={2}>Fixed HRA</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: C.earnValColor }}>{fixedHRA}</td>
                  <td style={{ background: C.dedLabelBg, color: C.dedLabelColor, fontWeight: 600, fontSize: "11px" }} colSpan={2}>Total Dedu</td>
                  <td style={{ textAlign: "right", fontWeight: 800, color: "#fff", background: "#c62828", fontSize: "14px" }} data-testid="text-total-deductions">{totalDedu}</td>
                </tr>
                <tr>
                  <td style={{ background: C.attLabelBg, color: C.attLabelColor, fontWeight: 600 }}>HOLIDAYS</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: C.attValColor }}>{holidays}</td>
                  <td style={{ background: C.earnLabelBg, color: C.earnLabelColor, fontWeight: 600 }} colSpan={2}>OT Allow</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: C.earnValColor }}>{n(salary.overtimeAmount)}</td>
                  <td style={{ background: "#fff8e1", color: "#e65100", fontWeight: 600, fontSize: "11px" }} colSpan={2}>Leave Balance {salary.year}</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: "#e65100" }}>0</td>
                </tr>
                <tr>
                  <td style={{ background: C.attLabelBg, color: C.attLabelColor, fontWeight: 700 }}>Paid Days</td>
                  <td style={{ textAlign: "right", fontWeight: 800, color: "#fff", background: "#0d47a1", fontSize: "14px" }} data-testid="text-paid-days">{paidDays}</td>
                  <td style={{ background: C.earnLabelBg, color: C.earnLabelColor, fontWeight: 700 }} colSpan={2}>Total Gross</td>
                  <td style={{ textAlign: "right", fontWeight: 800, color: "#fff", background: "#2e7d32", fontSize: "14px" }} data-testid="text-total-gross">{totalGross}</td>
                  <td style={{ background: "#fff8e1", color: "#e65100", fontWeight: 600, fontSize: "10px" }} colSpan={2}>Leave Encashment Amt. {salary.year}</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: "#e65100" }}>0</td>
                </tr>
                <tr>
                  <td style={{ background: C.attLabelBg, color: C.attLabelColor, fontWeight: 600 }}>OT HRS</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: C.attValColor }}>{otHrs}</td>
                  <td style={{ background: C.earnLabelBg, color: C.earnLabelColor, fontWeight: 600 }} colSpan={2}>PF Deduction @12%</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: C.dedValColor }} data-testid="text-pf-ded">{pfDed}</td>
                  <td style={{ background: C.netBg, color: C.netColor, fontWeight: 800, fontSize: "13px", letterSpacing: "1px" }} colSpan={2}>NET SALARY</td>
                  <td style={{ background: C.netBg, color: C.netColor, textAlign: "right", fontWeight: 900, fontSize: "18px", letterSpacing: "0.5px", textShadow: "1px 1px 2px rgba(0,0,0,0.3)" }} data-testid="text-net-pay">₹{netSalary.toLocaleString("en-IN")}</td>
                </tr>

                <tr>
                  <td style={{ background: C.wordsBg, color: C.wordsColor, fontWeight: 700 }} colSpan={2}>Net Salary in Words</td>
                  <td style={{ background: C.wordsBg, color: C.wordsColor, fontWeight: 700, fontStyle: "italic", fontSize: "13px" }} colSpan={6} data-testid="text-net-pay-words">
                    {numberToWords(netSalary)}
                  </td>
                </tr>

                <tr>
                  <td colSpan={8} style={{ height: "70px", verticalAlign: "bottom", padding: "10px 16px", background: C.sigBg }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ borderTop: "2px solid #283593", paddingTop: "6px", minWidth: "180px", fontSize: "11px", fontWeight: 600, color: "#283593" }}>Prepared By Signature</div>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ borderTop: "2px solid #283593", paddingTop: "6px", minWidth: "180px", fontSize: "11px", fontWeight: 600, color: "#283593" }}>Approved By Signature and Stamp</div>
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
