import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Printer, FileText, Users, IndianRupee, TrendingDown, Wallet, ArrowRight, Download, ImageDown, FileSpreadsheet } from "lucide-react";
import { PrintSettingsDialog } from "@/components/print-settings-dialog";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useClientNames, useCurrentUser } from "@/hooks/use-reports";
import { apiRequest, queryClient as qc } from "@/lib/queryClient";
import html2canvas from "html2canvas";
import JSZip from "jszip";
import logoPath from "@assets/logo1_1771660912341.png";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const fmt = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtR = (n: number) => "\u20B9" + fmt(n);
const fmtDec = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function getSkillLevel(designation?: string): string {
  if (!designation) return "";
  const d = designation.toLowerCase();
  if (d.includes("supervisor") || d.includes("incharge") || d.includes("manager")) return "Highly Skilled";
  if (d.includes("head cook")) return "Skilled";
  if (d.includes("cook")) return "Skilled";
  if (d.includes("helper")) return "Unskilled";
  if (d.includes("semi")) return "Semi skilled";
  return "Unskilled";
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
  while (remaining > 0) { groups.push(remaining % 100); remaining = Math.floor(remaining / 100); }
  function twoDigit(n: number): string { if (n < 20) return ones[n]; return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : ""); }
  function threeDigit(n: number): string { if (n === 0) return ""; if (n < 100) return twoDigit(n); return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + twoDigit(n % 100) : ""); }
  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) { const g = groups[i]; if (g === 0) continue; const word = i === 0 ? threeDigit(g) : twoDigit(g); parts.push(word + (scales[i] ? " " + scales[i] : "")); }
  return "Rupees " + parts.join(" ") + " Only";
}

function esc(s: string | undefined | null): string {
  if (!s) return "-";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatDateStr(d: string | undefined | null): string {
  if (!d) return "-";
  try { const dt = new Date(d); const dd = String(dt.getDate()).padStart(2, "0"); const mm = String(dt.getMonth() + 1).padStart(2, "0"); return `${dd}-${mm}-${dt.getFullYear()}`; } catch { return d; }
}

function buildSlipHTML(salary: SalaryRecord, employee: Employee | undefined, attendance: AttendanceRecord | undefined, logoSrc: string, skillBasicRate?: number): string {
  const n = (v: string | undefined | null) => Number(v) || 0;
  const basicRate = skillBasicRate !== undefined ? skillBasicRate : n(employee?.dailyRate);
  const basic = n(salary.basicWage);
  const hra5 = Math.round(basic * 0.05);
  const fixedHRA = n(salary.hra);
  const totalGross = n(salary.grossWage);
  const pfDed = n(salary.pfDeduction);
  const esicDed = n(salary.esicDeduction);
  const pTax = n(salary.professionalTax);
  const lwf = n(salary.lwf);
  const totalDedu = n(salary.totalDeduction);
  const netSalary = n(salary.netPay);
  const otHrs = n(salary.overtimeHours);
  const prsDays = n(attendance?.totalPresent) || n(salary.daysWorked);
  const leave = n(attendance?.totalAbsent);
  let holidays = 0;
  if (attendance) { for (let i = 1; i <= 31; i++) { const val = attendance[`day${i}`]; if (val === "H" || val === "WO" || val === "PH") holidays++; } }
  const paidDays = n(salary.daysWorked);

  const C = {
    headerGrad: "linear-gradient(135deg, #1a237e 0%, #283593 30%, #3949ab 60%, #5c6bc0 100%)",
    periodGrad: "linear-gradient(135deg, #0d47a1 0%, #1565c0 50%, #1976d2 100%)",
    infoLabelBg: "#e8eaf6", infoLabelColor: "#283593",
    attLabelBg: "#e3f2fd", attLabelColor: "#0d47a1", attValColor: "#1565c0",
    earnLabelBg: "#e8f5e9", earnLabelColor: "#1b5e20", earnValColor: "#2e7d32",
    dedLabelBg: "#fce4ec", dedLabelColor: "#b71c1c", dedValColor: "#c62828",
    netBg: "linear-gradient(135deg, #1b5e20 0%, #2e7d32 50%, #43a047 100%)",
    wordsBg: "#f3e5f5", wordsColor: "#4a148c",
  };
  const b = "1px solid #90a4ae";
  const cp = "padding:5px 8px";

  return `<div style="width:800px;background:white;padding:0;font-family:'Inter','Segoe UI',Arial,sans-serif;">
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <tbody>
        <tr><td colspan="8" style="background:${C.headerGrad};color:#fff;text-align:center;padding:14px 8px 10px;border:none;">
          <div style="display:flex;align-items:center;justify-content:center;gap:14px;">
            <img src="${logoSrc}" crossorigin="anonymous" style="width:54px;height:54px;border-radius:8px;border:2px solid rgba(255,255,255,0.4);background:#fff;padding:2px;" />
            <div>
              <div style="font-size:17px;font-weight:800;letter-spacing:0.5px;text-shadow:1px 1px 2px rgba(0,0,0,0.3);">DJ HOSPITALITY &amp; FACILITY MANAGEMENT PVT LTD</div>
              <div style="font-size:10px;opacity:0.85;margin-top:2px;">Regd. &amp; Head Office: 730, Tin Made, Sodiem Siolim, Mapusa Bardez, North Goa-403502, India</div>
              <div style="font-size:10px;opacity:0.85;">Branch Office: 7 Crimatorium Street, Kolkata- 700014</div>
            </div>
          </div>
          <div style="margin-top:8px;font-size:15px;font-weight:700;letter-spacing:1px;background:rgba(255,255,255,0.15);display:inline-block;padding:3px 20px;border-radius:4px;">Form - XIX Wages Slip</div>
          <div style="font-size:10px;opacity:0.7;margin-top:2px;">[See rule 78(1)(b)]</div>
        </td></tr>

        <tr><td colspan="8" style="background:${C.periodGrad};color:#fff;text-align:center;padding:10px;font-size:20px;font-weight:800;letter-spacing:2px;border:none;text-shadow:1px 1px 3px rgba(0,0,0,0.3);">${MONTHS[salary.month - 1].toUpperCase()} - ${salary.year}</td></tr>

        <tr><td colspan="2" style="background:${C.infoLabelBg};color:${C.infoLabelColor};font-weight:700;border:${b};${cp}">Company Name</td><td colspan="6" style="font-weight:700;font-size:14px;color:#1a237e;border:${b};${cp}">${esc(salary.clientName)}</td></tr>
        <tr><td colspan="2" style="background:${C.infoLabelBg};color:${C.infoLabelColor};font-weight:600;border:${b};${cp}">Location of work</td><td colspan="6" style="font-size:12px;border:${b};${cp}">Khidirpur Factory, 1, Transport depot Rd, Goragacha Rood, Kolkata - 700110</td></tr>
        <tr><td colspan="2" style="background:${C.infoLabelBg};color:${C.infoLabelColor};font-weight:700;border:${b};${cp}">Name:</td><td colspan="6" style="font-size:16px;font-weight:800;color:#1a237e;border:${b};${cp}">${esc(employee?.name)}</td></tr>

        <tr>
          <td colspan="2" style="background:${C.infoLabelBg};color:${C.infoLabelColor};font-weight:600;white-space:nowrap;border:${b};${cp}">Father's / Husband's :</td>
          <td colspan="3" style="border:${b};${cp}">${esc(employee?.fatherName)}</td>
          <td style="background:${C.infoLabelBg};color:${C.infoLabelColor};font-weight:600;white-space:nowrap;border:${b};${cp}">Skills:</td>
          <td colspan="2" style="border:${b};${cp}">${esc(employee?.designation) || "Unskilled"}</td>
        </tr>
        <tr>
          <td colspan="2" style="background:${C.infoLabelBg};color:${C.infoLabelColor};font-weight:600;white-space:nowrap;border:${b};${cp}">Date Of Birth</td>
          <td colspan="3" style="border:${b};${cp}">${formatDateStr(employee?.dob)}</td>
          <td style="background:${C.infoLabelBg};color:${C.infoLabelColor};font-weight:600;white-space:nowrap;border:${b};${cp}">Joining Date :</td>
          <td colspan="2" style="border:${b};${cp}">${formatDateStr(employee?.joiningDate)}</td>
        </tr>
        <tr>
          <td colspan="2" style="background:#ede7f6;color:#4a148c;font-weight:600;white-space:nowrap;border:${b};${cp}">ESIC No.:</td>
          <td colspan="3" style="font-family:monospace;font-size:12px;color:#4a148c;border:${b};${cp}">${esc(employee?.esicNo)}</td>
          <td style="background:#ede7f6;color:#4a148c;font-weight:600;white-space:nowrap;border:${b};${cp}">UAN:</td>
          <td colspan="2" style="font-family:monospace;font-size:12px;color:#4a148c;border:${b};${cp}">${esc(employee?.uanNo)}</td>
        </tr>
        <tr>
          <td colspan="2" style="background:#ede7f6;color:#4a148c;font-weight:600;white-space:nowrap;border:${b};${cp}">PF No.:</td>
          <td colspan="3" style="font-family:monospace;font-size:12px;color:#4a148c;border:${b};${cp}">${esc(employee?.pfNo)}</td>
          <td style="background:#ede7f6;color:#4a148c;font-weight:600;white-space:nowrap;border:${b};${cp}">Mobile No:</td>
          <td colspan="2" style="border:${b};${cp}">${esc(employee?.mobile)}</td>
        </tr>
        <tr>
          <td colspan="2" style="background:#e0f2f1;color:#004d40;font-weight:600;white-space:nowrap;border:${b};${cp}">Bank Name:</td>
          <td colspan="3" style="color:#00695c;border:${b};${cp}">${esc(employee?.bankName)}</td>
          <td style="background:#e0f2f1;color:#004d40;font-weight:600;white-space:nowrap;border:${b};${cp}">IFSC Code :</td>
          <td colspan="2" style="font-family:monospace;font-size:12px;color:#00695c;border:${b};${cp}">${esc(employee?.ifscCode)}</td>
        </tr>
        <tr>
          <td colspan="2" style="background:#e0f2f1;color:#004d40;font-weight:600;white-space:nowrap;border:${b};${cp}">Bank Account No.:</td>
          <td colspan="3" style="font-family:monospace;font-size:12px;color:#00695c;border:${b};${cp}">${esc(employee?.accountNo)}</td>
          <td style="background:#e0f2f1;color:#004d40;font-weight:600;white-space:nowrap;border:${b};${cp}">Pay. Date:</td>
          <td colspan="2" style="border:${b};${cp}">${salary.paidOn ? formatDateStr(salary.paidOn) : "-"}</td>
        </tr>

        <tr>
          <td colspan="2" style="background:${C.attLabelBg};color:${C.attLabelColor};font-weight:800;text-align:center;font-size:12px;letter-spacing:1px;border:${b};${cp}">ATTENDANCE</td>
          <td colspan="3" style="background:${C.earnLabelBg};color:${C.earnLabelColor};font-weight:800;text-align:center;font-size:12px;letter-spacing:1px;border:${b};${cp}">EARNINGS (₹)</td>
          <td colspan="3" style="background:${C.dedLabelBg};color:${C.dedLabelColor};font-weight:800;text-align:center;font-size:12px;letter-spacing:1px;border:${b};${cp}">DEDUCTIONS (₹)</td>
        </tr>

        <tr>
          <td style="background:${C.attLabelBg};color:${C.attLabelColor};font-weight:600;border:${b};${cp}">PRS DAYS</td>
          <td style="text-align:right;font-weight:700;color:${C.attValColor};border:${b};${cp}">${prsDays}</td>
          <td style="background:${C.earnLabelBg};color:${C.earnLabelColor};font-weight:600;border:${b};${cp}" colspan="2">Basic Rate</td>
          <td style="text-align:right;font-weight:700;color:${C.earnValColor};border:${b};${cp}">${basicRate}</td>
          <td style="background:${C.dedLabelBg};color:${C.dedLabelColor};font-weight:600;border:${b};${cp}" colspan="2">ESIC @ 0.75%</td>
          <td style="text-align:right;font-weight:700;color:${C.dedValColor};border:${b};${cp}">${esicDed}</td>
        </tr>
        <tr>
          <td style="background:${C.attLabelBg};color:${C.attLabelColor};font-weight:600;border:${b};${cp}">Half Day</td>
          <td style="text-align:right;font-weight:700;color:${C.attValColor};border:${b};${cp}">0</td>
          <td style="background:${C.earnLabelBg};color:${C.earnLabelColor};font-weight:600;border:${b};${cp}" colspan="2">Basic</td>
          <td style="text-align:right;font-weight:700;color:${C.earnValColor};border:${b};${cp}">${basic}</td>
          <td style="background:${C.dedLabelBg};color:${C.dedLabelColor};font-weight:600;border:${b};${cp}" colspan="2">P-TAX</td>
          <td style="text-align:right;font-weight:700;color:${C.dedValColor};border:${b};${cp}">${pTax}</td>
        </tr>
        <tr>
          <td style="background:${C.attLabelBg};color:${C.attLabelColor};font-weight:600;border:${b};${cp}">Extra Work</td>
          <td style="text-align:right;font-weight:700;color:${C.attValColor};border:${b};${cp}">0</td>
          <td style="background:${C.earnLabelBg};color:${C.earnLabelColor};font-weight:600;border:${b};${cp}" colspan="2">DA</td>
          <td style="text-align:right;font-weight:700;color:${C.earnValColor};border:${b};${cp}">${n(salary.da)}</td>
          <td style="background:${C.dedLabelBg};color:${C.dedLabelColor};font-weight:600;border:${b};${cp}" colspan="2">PF @12%</td>
          <td style="text-align:right;font-weight:700;color:${C.dedValColor};border:${b};${cp}">${pfDed}</td>
        </tr>
        <tr>
          <td style="background:${C.attLabelBg};color:${C.attLabelColor};font-weight:600;border:${b};${cp}">LEAVE</td>
          <td style="text-align:right;font-weight:700;color:${C.attValColor};border:${b};${cp}">${leave}</td>
          <td style="background:${C.earnLabelBg};color:${C.earnLabelColor};font-weight:600;border:${b};${cp}" colspan="2">HRA 5%</td>
          <td style="text-align:right;font-weight:700;color:${C.earnValColor};border:${b};${cp}">${hra5}</td>
          <td style="background:${C.dedLabelBg};color:${C.dedLabelColor};font-weight:600;border:${b};${cp}" colspan="2">LWF</td>
          <td style="text-align:right;font-weight:700;color:${C.dedValColor};border:${b};${cp}">${lwf}</td>
        </tr>
        <tr>
          <td style="background:${C.attLabelBg};color:${C.attLabelColor};font-weight:600;border:${b};${cp}">HOLIDAYS</td>
          <td style="text-align:right;font-weight:700;color:${C.attValColor};border:${b};${cp}">${holidays}</td>
          <td style="background:${C.earnLabelBg};color:${C.earnLabelColor};font-weight:600;border:${b};${cp}" colspan="2">Fixed HRA</td>
          <td style="text-align:right;font-weight:700;color:${C.earnValColor};border:${b};${cp}">${fixedHRA}</td>
          <td style="background:${C.dedLabelBg};color:${C.dedLabelColor};font-weight:600;font-size:11px;border:${b};${cp}" colspan="2">Total Dedu</td>
          <td style="text-align:right;font-weight:800;color:#fff;background:#c62828;font-size:14px;border:${b};${cp}">${totalDedu}</td>
        </tr>
        <tr>
          <td style="background:${C.attLabelBg};color:${C.attLabelColor};font-weight:700;border:${b};${cp}">Paid Days</td>
          <td style="text-align:right;font-weight:800;color:#fff;background:#0d47a1;font-size:14px;border:${b};${cp}">${paidDays}</td>
          <td style="background:${C.earnLabelBg};color:${C.earnLabelColor};font-weight:600;border:${b};${cp}" colspan="2">OT Allow</td>
          <td style="text-align:right;font-weight:700;color:${C.earnValColor};border:${b};${cp}">${n(salary.overtimeAmount)}</td>
          <td style="background:#fff8e1;color:#e65100;font-weight:600;font-size:11px;border:${b};${cp}" colspan="2">Leave Balance ${salary.year}</td>
          <td style="text-align:right;font-weight:700;color:#e65100;border:${b};${cp}">0</td>
        </tr>
        <tr>
          <td style="background:${C.attLabelBg};color:${C.attLabelColor};font-weight:600;border:${b};${cp}">OT HRS</td>
          <td style="text-align:right;font-weight:700;color:${C.attValColor};border:${b};${cp}">${otHrs}</td>
          <td style="background:${C.earnLabelBg};color:${C.earnLabelColor};font-weight:700;border:${b};${cp}" colspan="2">Total Gross</td>
          <td style="text-align:right;font-weight:800;color:#fff;background:#2e7d32;font-size:14px;border:${b};${cp}">${totalGross}</td>
          <td style="background:#fff8e1;color:#e65100;font-weight:600;font-size:10px;border:${b};${cp}" colspan="2">Leave Encashment Amt. ${salary.year}</td>
          <td style="text-align:right;font-weight:700;color:#e65100;border:${b};${cp}">0</td>
        </tr>
        <tr>
          <td style="background:${C.attLabelBg};border:${b};${cp}"></td>
          <td style="border:${b};${cp}"></td>
          <td style="background:${C.earnLabelBg};border:${b};${cp}" colspan="2"></td>
          <td style="border:${b};${cp}"></td>
          <td style="background:${C.netBg};color:#fff;font-weight:800;font-size:13px;letter-spacing:1px;border:${b};${cp}" colspan="2">NET SALARY</td>
          <td style="background:${C.netBg};color:#fff;text-align:right;font-weight:900;font-size:18px;letter-spacing:0.5px;text-shadow:1px 1px 2px rgba(0,0,0,0.3);border:${b};${cp}">₹${netSalary.toLocaleString("en-IN")}</td>
        </tr>

        <tr>
          <td colspan="2" style="background:${C.wordsBg};color:${C.wordsColor};font-weight:700;border:${b};${cp}">Net Salary in Words</td>
          <td colspan="6" style="background:${C.wordsBg};color:${C.wordsColor};font-weight:700;font-style:italic;font-size:13px;border:${b};${cp}">${numberToWords(netSalary)}</td>
        </tr>
        <tr>
          <td colspan="8" style="height:70px;vertical-align:bottom;padding:10px 16px;background:#fafafa;border:${b};">
            <div style="display:flex;justify-content:space-between;">
              <div style="text-align:center;"><div style="border-top:2px solid #283593;padding-top:6px;min-width:180px;font-size:11px;font-weight:600;color:#283593;">Prepared By Signature</div></div>
              <div style="text-align:center;"><div style="border-top:2px solid #283593;padding-top:6px;min-width:180px;font-size:11px;font-weight:600;color:#283593;">Approved By Signature and Stamp</div></div>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>`;
}

export default function SalaryRegister() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUser();
  const { data: clients } = useClientNames();
  const isAdmin = user?.role === "admin";

  const now = new Date();
  const [clientName, setClientName] = useState("");
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [loaded, setLoaded] = useState(false);
  const [salaryPaidDate, setSalaryPaidDate] = useState("");

  const queryKey = ["/api/salary", clientName, month, year];

  const { data: salaries, isLoading } = useQuery<SalaryRecord[]>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/salary?clientName=${encodeURIComponent(clientName)}&month=${month}&year=${year}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch salary records");
      return res.json();
    },
    enabled: loaded && !!clientName,
  });

  const { data: employees } = useQuery<Employee[]>({
    queryKey: ["/api/employees", clientName],
    queryFn: async () => {
      const res = await fetch(`/api/employees?clientName=${encodeURIComponent(clientName)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch employees");
      return res.json();
    },
    enabled: !!clientName,
  });

  const { data: attendanceList } = useQuery<AttendanceRecord[]>({
    queryKey: ["/api/attendance", clientName, month, year],
    queryFn: async () => {
      const res = await fetch(`/api/attendance?clientName=${encodeURIComponent(clientName)}&month=${month}&year=${year}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch attendance");
      return res.json();
    },
    enabled: loaded && !!clientName,
  });

  const { data: skillWageRates = [] } = useQuery<{ id: number; skillCategory: string; month: number; year: number; dailyRate: string }[]>({
    queryKey: ["/api/skill-wage-rates", year],
    queryFn: async () => {
      const res = await fetch(`/api/skill-wage-rates?year=${year}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!year,
  });

  const skillRateMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of skillWageRates) {
      map.set(`${r.skillCategory}_${r.month}_${r.year}`, Number(r.dailyRate));
    }
    return map;
  }, [skillWageRates]);

  const employeeMap = useMemo(() => {
    const map = new Map<number, Employee>();
    employees?.forEach((e) => map.set(e.id, e));
    return map;
  }, [employees]);

  const [downloading, setDownloading] = useState(false);
  const [salaryPrintDialogOpen, setSalaryPrintDialogOpen] = useState(false);
  const [salaryPrintSelectedIds, setSalaryPrintSelectedIds] = useState<Set<number>>(new Set());

  const salaryPrintEmployeeList = useMemo(() => {
    return (salaries || []).filter(s => employeeMap.has(s.employeeId)).map(s => {
      const emp = employeeMap.get(s.employeeId);
      return { id: s.employeeId, name: emp?.name || `Employee #${s.employeeId}`, employeeCode: emp?.employeeCode };
    });
  }, [salaries, employeeMap]);

  const openSalaryPrintDialog = () => {
    setSalaryPrintSelectedIds(new Set(salaryPrintEmployeeList.map(e => e.id)));
    setSalaryPrintDialogOpen(true);
  };
  const renderRef = useRef<HTMLDivElement>(null);

  const handleDownloadAllJpeg = useCallback(async () => {
    if (!salaries || salaries.length === 0 || !employees) return;
    setDownloading(true);
    toast({ title: "Generating JPEG files...", description: `Creating ${salaries.length} pay slips. Please wait.` });

    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "-9999px";
    container.style.top = "0";
    container.style.zIndex = "-1";
    document.body.appendChild(container);

    const zip = new JSZip();
    const monthName = MONTHS[Number(month) - 1];

    try {
      for (let i = 0; i < salaries.length; i++) {
        const s = salaries[i];
        const emp = employeeMap.get(s.employeeId);
        const att = attendanceList?.find((a) => a.employeeId === s.employeeId);
        const empSkill = emp?.skills || "";
        const sRate = skillRateMap.get(`${empSkill}_${month}_${year}`);
        const html = buildSlipHTML(s, emp, att, logoPath, sRate);

        container.innerHTML = html;

        const imgs = container.querySelectorAll("img");
        await Promise.all(Array.from(imgs).map((img) =>
          img.complete ? Promise.resolve() : new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          })
        ));
        await new Promise((r) => setTimeout(r, 100));

        const canvas = await html2canvas(container.firstElementChild as HTMLElement, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
        });

        const blob = await new Promise<Blob>((resolve) =>
          canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.95)
        );

        const empName = (emp?.name || `Employee_${s.employeeId}`).replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_");
        zip.file(`${empName}_${monthName}_${year}.jpg`, blob);
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.download = `PaySlips_${monthName}_${year}.zip`;
      link.href = URL.createObjectURL(zipBlob);
      link.click();
      URL.revokeObjectURL(link.href);

      toast({ title: "Download Complete", description: `${salaries.length} pay slips packaged in ZIP file.` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to generate JPEG files", variant: "destructive" });
    } finally {
      document.body.removeChild(container);
      setDownloading(false);
    }
  }, [salaries, employees, employeeMap, attendanceList, toast, month, year]);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/salary/generate", { clientName, month: Number(month), year: Number(year), paidOn: salaryPaidDate || undefined });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: "Salary Generated", description: "Salary records have been generated from attendance data." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updatePaidDateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", "/api/salary/paid-date", { clientName, month: Number(month), year: Number(year), paidOn: salaryPaidDate || null });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: "Paid Date Updated", description: "Salary paid date has been updated for all records." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const computeRow = useCallback((s: SalaryRecord) => {
    const n = (v: string | undefined | null) => Number(v) || 0;
    const emp = employeeMap.get(s.employeeId);
    const att = attendanceList?.find((a) => a.employeeId === s.employeeId);
    let prsDays = 0, halfDay = 0, holidayWorking = 0, leave = 0, holidays = 0;
    if (att) {
      for (let i = 1; i <= 31; i++) {
        const val = (att as any)[`day${i}`] as string;
        if (!val) continue;
        if (val === "P") prsDays++;
        else if (val === "HD") halfDay++;
        else if (val === "A") leave++;
        else if (val === "H" || val === "WO" || val === "PH") holidays++;
        else if (val === "CL" || val === "SL" || val === "EL") leave++;
        else if (val === "HW") holidayWorking++;
      }
    }
    if (prsDays === 0) prsDays = n(att?.totalPresent) || n(s.daysWorked);
    const paidDays = n(s.daysWorked);
    const otHrs = n(s.overtimeHours);
    const skillCategory = emp?.skills || "";
    const skillBasedRate = skillRateMap.get(`${skillCategory}_${month}_${year}`);
    const basicRate = skillBasedRate !== undefined ? skillBasedRate : n(emp?.dailyRate);
    const basicWage = n(s.basicWage);
    const hra5 = Math.round(basicWage * 0.05);
    const fixedHRA = n(s.hra);
    const otAllow = n(s.overtimeAmount);
    const totalGross = n(s.grossWage);
    const pfDed = n(s.pfDeduction);
    const esicDed = n(s.esicDeduction);
    const pTax = n(s.professionalTax);
    const lwf = n(s.lwf);
    const totalDedu = n(s.totalDeduction);
    const netSalary = n(s.netPay);
    const advance = n(s.advanceDeduction);
    const payInAccount = netSalary - advance;
    const pfEmployer = Math.round(basicWage * 0.13);
    const esicEmployer = Math.round(totalGross * 0.0325);
    const bonus = Math.round(basicWage * 0.0833);
    const employerTotal = pfEmployer + esicEmployer + bonus;
    const serviceBase = totalGross + employerTotal;
    const serviceCharge = Math.round(serviceBase * 0.12);
    const afterService = serviceBase + serviceCharge;
    const gst = Math.round(serviceCharge * 0.18);
    const finalTotal = afterService + gst;
    const skills = getSkillLevel(emp?.designation);
    return {
      emp, skills, prsDays, halfDay, holidayWorking, leave, holidays, paidDays, otHrs,
      basicRate, basicWage, hra5, fixedHRA, otAllow, totalGross,
      pfDed, esicDed, pTax, lwf, totalDedu, netSalary,
      leaveBalance: 0, leaveEncash: 0, advance, payInAccount,
      pfEmployer, esicEmployer, bonus, employerTotal,
      serviceCharge, afterService, gst, finalTotal,
    };
  }, [employeeMap, attendanceList, skillRateMap, month, year]);

  const { rows, totals } = useMemo(() => {
    if (!salaries || salaries.length === 0) return { rows: [] as ReturnType<typeof computeRow>[], totals: null };
    const validSalaries = salaries.filter(s => employeeMap.has(s.employeeId));
    const rs = validSalaries.map(computeRow);
    const sum = (fn: (r: ReturnType<typeof computeRow>) => number) => rs.reduce((a, r) => a + fn(r), 0);
    return {
      rows: rs,
      totals: {
        count: rs.length,
        prsDays: sum(r => r.prsDays), halfDay: sum(r => r.halfDay), holidayWorking: sum(r => r.holidayWorking),
        leave: sum(r => r.leave), holidays: sum(r => r.holidays), paidDays: sum(r => r.paidDays), otHrs: sum(r => r.otHrs),
        basicRate: sum(r => r.basicRate), basicWage: sum(r => r.basicWage), hra5: sum(r => r.hra5), fixedHRA: sum(r => r.fixedHRA),
        otAllow: sum(r => r.otAllow), totalGross: sum(r => r.totalGross),
        pfDed: sum(r => r.pfDed), esicDed: sum(r => r.esicDed), pTax: sum(r => r.pTax), lwf: sum(r => r.lwf),
        totalDedu: sum(r => r.totalDedu), netSalary: sum(r => r.netSalary),
        leaveBalance: 0, leaveEncash: 0, advance: sum(r => r.advance), payInAccount: sum(r => r.payInAccount),
        pfEmployer: sum(r => r.pfEmployer), esicEmployer: sum(r => r.esicEmployer), bonus: sum(r => r.bonus),
        employerTotal: sum(r => r.employerTotal), serviceCharge: sum(r => r.serviceCharge),
        afterService: sum(r => r.afterService), gst: sum(r => r.gst), finalTotal: sum(r => r.finalTotal),
      },
    };
  }, [salaries, computeRow]);

  const handleGovPrint = useCallback(() => {
    if (!salaries || salaries.length === 0 || rows.length === 0) return;
    const clientObj = clients?.find((c: any) => c.name === clientName);
    const clientAddr = clientObj?.address || "";
    const printWin = window.open("", "_blank");
    if (!printWin) return;

    const f = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    const fDec = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const filteredIndices = salaries.map((s, idx) => ({ s, idx })).filter(({ s }) => salaryPrintSelectedIds.size === 0 || salaryPrintSelectedIds.has(s.employeeId));

    const dataRows = filteredIndices.map(({ s, idx }, newIdx) => {
      const r = rows[idx];
      if (!r) return "";
      const emp = r.emp;
      return `<tr>
        <td>${newIdx + 1}</td>
        <td style="text-align:left;white-space:nowrap">${emp?.name || ""}</td>
        <td>${emp?.employeeCode || ""}</td>
        <td style="text-align:left;white-space:nowrap">${emp?.designation || ""}</td>
        <td>${r.paidDays}</td>
        <td>${r.otHrs || ""}</td>
        <td></td>
        <td style="text-align:right">${fDec(r.basicRate)}</td>
        <td style="text-align:right">${f(r.basicWage)}</td>
        <td style="text-align:right">${f(0)}</td>
        <td style="text-align:right">${f(r.otAllow)}</td>
        <td style="text-align:right">${f(r.fixedHRA)}</td>
        <td style="text-align:right">${f(r.hra5)}</td>
        <td style="text-align:right;font-weight:bold">${f(r.totalGross)}</td>
        <td style="text-align:right">${f(r.pfDed)}</td>
        <td style="text-align:right">${f(r.esicDed)}</td>
        <td style="text-align:right">${f(r.pTax)}</td>
        <td style="text-align:right;font-weight:bold">${f(r.totalDedu)}</td>
        <td style="text-align:right;font-weight:bold">${f(r.netSalary)}</td>
        <td></td>
        <td></td>
        <td></td>
      </tr>`;
    }).join("");

    const filteredRows = filteredIndices.map(({ idx }) => rows[idx]).filter(Boolean);
    const filteredTotals = filteredRows.reduce((acc, r) => ({
      paidDays: acc.paidDays + (r?.paidDays || 0),
      otHrs: acc.otHrs + (r?.otHrs || 0),
      basicWage: acc.basicWage + (r?.basicWage || 0),
      otAllow: acc.otAllow + (r?.otAllow || 0),
      fixedHRA: acc.fixedHRA + (r?.fixedHRA || 0),
      hra5: acc.hra5 + (r?.hra5 || 0),
      totalGross: acc.totalGross + (r?.totalGross || 0),
      pfDed: acc.pfDed + (r?.pfDed || 0),
      esicDed: acc.esicDed + (r?.esicDed || 0),
      pTax: acc.pTax + (r?.pTax || 0),
      totalDedu: acc.totalDedu + (r?.totalDedu || 0),
      netSalary: acc.netSalary + (r?.netSalary || 0),
    }), { paidDays: 0, otHrs: 0, basicWage: 0, otAllow: 0, fixedHRA: 0, hra5: 0, totalGross: 0, pfDed: 0, esicDed: 0, pTax: 0, totalDedu: 0, netSalary: 0 });

    const totalRow = filteredRows.length > 0 ? `<tr style="font-weight:bold;background:#f0f0f0">
      <td colspan="4" style="text-align:right;font-weight:bold">TOTAL</td>
      <td>${filteredTotals.paidDays}</td>
      <td>${filteredTotals.otHrs || ""}</td>
      <td></td>
      <td></td>
      <td style="text-align:right">${f(filteredTotals.basicWage)}</td>
      <td style="text-align:right">${f(0)}</td>
      <td style="text-align:right">${f(filteredTotals.otAllow)}</td>
      <td style="text-align:right">${f(filteredTotals.fixedHRA)}</td>
      <td style="text-align:right">${f(filteredTotals.hra5)}</td>
      <td style="text-align:right">${f(filteredTotals.totalGross)}</td>
      <td style="text-align:right">${f(filteredTotals.pfDed)}</td>
      <td style="text-align:right">${f(filteredTotals.esicDed)}</td>
      <td style="text-align:right">${f(filteredTotals.pTax)}</td>
      <td style="text-align:right">${f(filteredTotals.totalDedu)}</td>
      <td style="text-align:right">${f(filteredTotals.netSalary)}</td>
      <td></td>
      <td></td>
      <td></td>
    </tr>` : "";

    printWin.document.write(`<html><head><title>Form XVII - Register of Wages</title>
    <style>
      @page { size: A3 landscape; margin: 8mm; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: Arial, sans-serif; font-size: 12px; padding: 8px; }
      .header-title { text-align: left; font-size: 13px; font-weight: bold; margin-bottom: 2px; }
      .header-main { text-align: center; font-size: 20px; font-weight: bold; margin-bottom: 4px; }
      .header-rule { text-align: center; font-size: 11px; margin-bottom: 8px; }
      .info-table { width: 100%; border-collapse: collapse; margin-bottom: 6px; font-size: 12px; }
      .info-table td { padding: 3px 6px; vertical-align: top; }
      .info-label { font-weight: bold; white-space: nowrap; }
      .period-label { font-size: 18px; font-weight: bold; }
      table.main { width: 100%; border-collapse: collapse; font-size: 11px; table-layout: auto; }
      table.main th, table.main td { border: 1px solid #000; padding: 4px 5px; text-align: center; vertical-align: middle; height: 30px; white-space: nowrap; }
      table.main th { background: #f0f0f0; font-weight: bold; font-size: 10px; white-space: normal; }
      table.main td { font-size: 11px; }
      table.main td.wrap { white-space: normal; }
    </style></head><body>
      <div class="header-title">FORM XVII</div>
      <div class="header-main">REGISTER OF WAGES</div>
      <div class="header-rule">[Prescribed Under Rule 78 (2)(a)/78(a)(i) of the West Bengal / Central Contract Labour ( Regulation &amp; Abolition) Rules, 1972/1971]</div>

      <table class="info-table">
        <tr>
          <td class="info-label" style="width:22%">Name and Address of the Contractor</td>
          <td style="width:28%">DJ HOSPITALITY &amp; FACILITY MANAGEMENT PVT LTD</td>
          <td class="info-label" style="width:22%">Name and address of the establishment in /</td>
          <td style="width:28%">${clientName}${clientAddr ? '<br/>' + clientAddr : ''}</td>
        </tr>
        <tr>
          <td></td>
          <td>7 Crimatorium Street, Kolkata- 700014</td>
          <td class="info-label">Under which contract is carried on</td>
          <td></td>
        </tr>
        <tr>
          <td class="info-label">Nature and location of Work</td>
          <td>Canteen</td>
          <td class="info-label">Name and address of the Principal Employer</td>
          <td>${clientName}${clientAddr ? '<br/>' + clientAddr : ''}</td>
        </tr>
        <tr>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
        </tr>
        <tr>
          <td></td>
          <td></td>
          <td class="info-label">For The Month of</td>
          <td class="period-label">${MONTHS[Number(month) - 1]} ${year}</td>
        </tr>
      </table>

      <table class="main">
        <thead>
          <tr>
            <th rowspan="3">Serial<br/>No</th>
            <th rowspan="3">Name of the<br/>Workman</th>
            <th rowspan="3">Serial No<br/>in the<br/>register of<br/>workman</th>
            <th rowspan="3">Designation /<br/>Nature of<br/>Work Done</th>
            <th colspan="2">No. of Days<br/>Worked</th>
            <th rowspan="3">Units Of<br/>Work<br/>Down</th>
            <th rowspan="3">Daily rate<br/>of wages /<br/>Piece rate</th>
            <th colspan="5">AMOUNT OF WAGES EARNED</th>
            <th rowspan="2">Total</th>
            <th colspan="4">DEDUCTIONS</th>
            <th rowspan="2">Net<br/>Amount<br/>Paid</th>
            <th rowspan="3">Signature /<br/>Thumb-impression<br/>of Workman</th>
            <th rowspan="3">Initials of<br/>contractor or<br/>his representative</th>
            <th rowspan="3">E.P.F.<br/>Diff.<br/>12%</th>
          </tr>
          <tr>
            <th>Paid<br/>Days</th>
            <th>OT<br/>HRS</th>
            <th>Basic<br/>Wages</th>
            <th>Dearness<br/>allowance<br/>es</th>
            <th>Overtime</th>
            <th>Other<br/>Cash<br/>Payment<br/>(Nature<br/>of<br/>payment<br/>to be<br/>indicat<br/>ed)</th>
            <th>House<br/>Rent<br/>Allowan<br/>ce</th>
            <th>Provident<br/>Fund</th>
            <th>Employee<br/>'s Share of<br/>the<br/>Contributi<br/>on (E.S.I.)</th>
            <th>Professio<br/>nal Tax</th>
            <th>Total<br/>Deducti<br/>on</th>
          </tr>
          <tr>
            <th>Rs.</th>
            <th>Rs.</th>
            <th>Rs.</th>
            <th>Rs.</th>
            <th>Rs.</th>
            <th>Rs.</th>
            <th>Rs.</th>
            <th>Rs.</th>
            <th>Rs.</th>
            <th>Rs.</th>
            <th>Rs.</th>
          </tr>
          <tr style="font-size:9px;font-style:italic">
            <th>1</th><th>2</th><th>3</th><th>4</th><th>5(a)</th><th>5(b)</th><th>6</th><th>7</th>
            <th>8</th><th>9</th><th>10</th><th>11</th><th>12</th><th>13</th>
            <th>14(a)</th><th>14(b)</th><th>14(c)</th><th>14(d)</th><th>15</th>
            <th>16</th><th>17</th><th>18</th>
          </tr>
        </thead>
        <tbody>
          ${dataRows}
          ${totalRow}
        </tbody>
      </table>
    </body></html>`);
    printWin.document.close();
    printWin.print();
  }, [salaries, rows, totals, clientName, month, year, salaryPrintSelectedIds]);

  const handleExportExcel = useCallback(async () => {
    if (!salaries || salaries.length === 0 || rows.length === 0) return;
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet("Salary Register");

    const monthName = MONTHS[Number(month) - 1];
    const title = ws.addRow(["Salary Register (Form XVII)"]);
    title.getCell(1).font = { bold: true, size: 16 };
    ws.mergeCells("A1:AI1");
    title.alignment = { horizontal: "center" };

    const sub1 = ws.addRow([clientName]);
    sub1.getCell(1).font = { bold: true, size: 13 };
    ws.mergeCells("A2:AI2");
    sub1.alignment = { horizontal: "center" };

    const sub2 = ws.addRow([`${monthName} ${year}`]);
    sub2.getCell(1).font = { bold: true, size: 12 };
    ws.mergeCells("A3:AI3");
    sub2.alignment = { horizontal: "center" };

    ws.addRow([]);

    const headers = [
      "Sl. No.", "Emp ID", "Emp Name", "Skills", "PRS DAYS", "Half Day",
      "Holiday Working", "LEAVE", "HOLIDAYS", "Paid Days", "OT HRS",
      "Basic Rate", "Basic Wages", "HRA 5%", "Fixed HRA", "OT Allow",
      "Total Gross", "PF Deduction @12%", "ESIC @.75%", "P-TAX", "LWF",
      "Total Dedu", "Net Salary", "Leave Balance", "Leave Encash Amt.",
      "Advance", "Pay In Account", "PF @13%", "ESIC @3.25%", "Bonus @8.33%",
      "Total", "Service Charges @12%", "Total", "GST 18%", "Total"
    ];
    const headerRow = ws.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, size: 9 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E2F3" } };
      cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    });

    rows.forEach((r, idx) => {
      const row = ws.addRow([
        idx + 1, r.emp?.employeeCode || "-", r.emp?.name || "-", r.skills,
        r.prsDays, r.halfDay, r.holidayWorking, r.leave, r.holidays,
        r.paidDays, r.otHrs, r.basicRate, r.basicWage, r.hra5, r.fixedHRA,
        r.otAllow || 0, r.totalGross, r.pfDed, r.esicDed, r.pTax, r.lwf || 0,
        r.totalDedu, r.netSalary, r.leaveBalance, r.leaveEncash,
        r.advance, r.payInAccount, r.pfEmployer, r.esicEmployer, r.bonus,
        r.employerTotal, r.serviceCharge, r.afterService, r.gst, r.finalTotal
      ]);
      row.eachCell((cell) => {
        cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
        cell.font = { size: 9 };
      });
      if (idx % 2 === 1) {
        row.eachCell((cell) => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F8F0" } };
        });
      }
    });

    if (totals) {
      const tr = ws.addRow([
        "", "", "Total", "",
        totals.prsDays, totals.halfDay, totals.holidayWorking, totals.leave,
        totals.holidays, totals.paidDays, totals.otHrs, totals.basicRate,
        totals.basicWage, totals.hra5, totals.fixedHRA, totals.otAllow,
        totals.totalGross, totals.pfDed, totals.esicDed, totals.pTax, totals.lwf,
        totals.totalDedu, totals.netSalary, totals.leaveBalance, totals.leaveEncash,
        totals.advance, totals.payInAccount, totals.pfEmployer, totals.esicEmployer,
        totals.bonus, totals.employerTotal, totals.serviceCharge, totals.afterService,
        totals.gst, totals.finalTotal
      ]);
      tr.eachCell((cell) => {
        cell.font = { bold: true, size: 9 };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8E8E8" } };
        cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
      });
    }

    ws.getColumn(1).width = 6;
    ws.getColumn(2).width = 12;
    ws.getColumn(3).width = 22;
    ws.getColumn(4).width = 14;
    for (let i = 5; i <= 35; i++) ws.getColumn(i).width = 13;

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const link = document.createElement("a");
    link.download = `SalaryRegister_${clientName.replace(/\s+/g, "_")}_${monthName}_${year}.xlsx`;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
    toast({ title: "Excel Downloaded", description: `Salary Register exported to Excel.` });
  }, [salaries, rows, totals, clientName, month, year, toast]);

  useEffect(() => {
    if (salaries && salaries.length > 0 && !salaryPaidDate) {
      const existing = salaries.find(s => s.paidOn);
      if (existing?.paidOn) setSalaryPaidDate(existing.paidOn);
    }
  }, [salaries]);

  const handleLoad = () => {
    if (!clientName) {
      toast({ title: "Select Client", description: "Please select a client name first.", variant: "destructive" });
      return;
    }
    setLoaded(true);
    if (salaryPaidDate) {
      updatePaidDateMutation.mutate();
    }
  };

  const years = Array.from({ length: 5 }, (_, i) => String(now.getFullYear() - 2 + i));

  const clientOptions = clients?.map((c: any) => (typeof c === "string" ? c : c.name)) || [];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight" data-testid="text-salary-title">Salary Register (Form XVII)</h1>
            <p className="text-muted-foreground mt-1 text-xs sm:text-sm">Monthly salary register for all employees</p>
          </div>
          {loaded && salaries && salaries.length > 0 && (
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                data-testid="button-export-excel-salary"
              >
                <FileSpreadsheet className="w-4 h-4 mr-1" />
                Export<span className="hidden sm:inline"> Excel</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadAllJpeg}
                disabled={downloading}
                data-testid="button-download-all-jpeg"
              >
                {downloading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <ImageDown className="w-4 h-4 mr-1" />}
                {downloading ? "Wait..." : <><span className="hidden sm:inline">Download All </span>JPEG</>}
              </Button>
              <Button variant="outline" size="sm" onClick={() => {
                const style = document.createElement("style");
                style.id = "salary-print-override";
                style.textContent = "@page { size: A3 landscape; margin: 0.4cm; }";
                document.head.appendChild(style);
                const prevTitle = document.title;
                document.title = `Salary Register (Form XVII) ${MONTHS[Number(month) - 1]} ${year}`;
                window.print();
                setTimeout(() => { style.remove(); document.title = prevTitle; }, 1000);
              }} data-testid="button-print-salary">
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
              <Button variant="outline" size="sm" onClick={openSalaryPrintDialog} data-testid="button-gov-print-salary">
                <Printer className="w-4 h-4 mr-1" />
                Form XVII
              </Button>
            </div>
          )}
        </div>

        <Card data-testid="card-salary-filters">
          <CardContent className="p-4 sm:p-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
              <div className="space-y-2">
                <Label>Client Name</Label>
                <Select value={clientName} onValueChange={(v) => { setClientName(v); setLoaded(false); }}>
                  <SelectTrigger data-testid="select-client-name">
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientOptions.map((name: string) => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Month</Label>
                <Select value={month} onValueChange={(v) => { setMonth(v); setLoaded(false); }}>
                  <SelectTrigger data-testid="select-month">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Year</Label>
                <Select value={year} onValueChange={(v) => { setYear(v); setLoaded(false); }}>
                  <SelectTrigger data-testid="select-year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={y}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Salary Paid Date</Label>
                <Input
                  type="date"
                  value={salaryPaidDate}
                  onChange={(e) => { setSalaryPaidDate(e.target.value); setLoaded(false); }}
                  data-testid="input-salary-paid-date"
                />
              </div>
              <Button onClick={handleLoad} data-testid="button-load-salary">
                <Download className="w-4 h-4 mr-2" />
                Load
              </Button>
              {isAdmin && (
                <Button
                  variant="outline"
                  onClick={() => generateMutation.mutate()}
                  disabled={!clientName || generateMutation.isPending}
                  data-testid="button-generate-salary"
                >
                  {generateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                  Generate Salary
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {isLoading && loaded && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {loaded && salaries && salaries.length > 0 && totals && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 print:hidden">
              <Card data-testid="card-total-employees">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Employees</p>
                      <p className="text-lg font-bold" data-testid="text-total-employees">{totals.count}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card data-testid="card-total-gross">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                      <Wallet className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Gross</p>
                      <p className="text-lg font-bold" data-testid="text-total-gross">{fmtR(totals.totalGross)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card data-testid="card-total-deductions">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                      <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Deductions</p>
                      <p className="text-lg font-bold" data-testid="text-total-deductions">{fmtR(totals.totalDedu)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card data-testid="card-total-net-pay">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                      <IndianRupee className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Net Pay</p>
                      <p className="text-lg font-bold" data-testid="text-total-net-pay">{fmtR(totals.netSalary)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card data-testid="card-final-total">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                      <IndianRupee className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Final Total</p>
                      <p className="text-lg font-bold" data-testid="text-final-total">{fmtR(totals.finalTotal)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="print:hidden border-2 border-indigo-200 rounded-xl overflow-hidden shadow-lg">
              <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 text-white text-center py-2.5 font-bold text-sm tracking-wide">
                {clientName} &mdash; Salary Register &mdash; {MONTHS[Number(month) - 1]} {year}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] whitespace-nowrap border-collapse" data-testid="table-salary-register" style={{ minWidth: "2600px" }}>
                  <thead>
                    <tr>
                      <th colSpan={4} className="px-2 py-1.5 text-center font-bold border border-indigo-200 bg-indigo-50 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-200 text-xs sticky left-0 z-20">Employee Details</th>
                      <th colSpan={7} className="px-2 py-1.5 text-center font-bold border border-sky-200 bg-sky-50 dark:bg-sky-950 text-sky-800 dark:text-sky-200 text-xs">Attendance & Days</th>
                      <th colSpan={6} className="px-2 py-1.5 text-center font-bold border border-emerald-200 bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 text-xs">Earnings</th>
                      <th colSpan={6} className="px-2 py-1.5 text-center font-bold border border-rose-200 bg-rose-50 dark:bg-rose-950 text-rose-800 dark:text-rose-200 text-xs">Deductions</th>
                      <th colSpan={4} className="px-2 py-1.5 text-center font-bold border border-amber-200 bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-200 text-xs">Leave & Net Pay</th>
                      <th colSpan={4} className="px-2 py-1.5 text-center font-bold border border-violet-200 bg-violet-50 dark:bg-violet-950 text-violet-800 dark:text-violet-200 text-xs">Employer Contributions</th>
                      <th colSpan={4} className="px-2 py-1.5 text-center font-bold border border-teal-200 bg-teal-50 dark:bg-teal-950 text-teal-800 dark:text-teal-200 text-xs">Service & GST</th>
                      <th className="px-2 py-1.5 text-center font-bold border border-slate-200 bg-slate-50 dark:bg-slate-800 text-xs"></th>
                    </tr>
                    <tr className="bg-slate-100 dark:bg-slate-800 border-b-2 border-indigo-300">
                      <th className="px-2 py-2 text-center font-bold border border-indigo-200 sticky left-0 bg-indigo-100 dark:bg-indigo-900 z-10 w-[36px] text-indigo-700 dark:text-indigo-300">Sl.</th>
                      <th className="px-2 py-2 text-left font-bold border border-indigo-200 sticky left-[36px] bg-indigo-100 dark:bg-indigo-900 z-10 w-[80px] text-indigo-700 dark:text-indigo-300">Emp ID</th>
                      <th className="px-2 py-2 text-left font-bold border border-indigo-200 sticky left-[116px] bg-indigo-100 dark:bg-indigo-900 z-10 min-w-[150px] text-indigo-700 dark:text-indigo-300">Emp Name</th>
                      <th className="px-2 py-2 text-left font-bold border border-indigo-200 bg-indigo-100 dark:bg-indigo-900 min-w-[80px] text-indigo-700 dark:text-indigo-300">Skills</th>
                      <th className="px-2 py-2 text-center font-bold border border-sky-200 bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300">PRS DAYS</th>
                      <th className="px-2 py-2 text-center font-bold border border-sky-200 bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300">Half Day</th>
                      <th className="px-2 py-2 text-center font-bold border border-sky-200 bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300">Holiday Wrk</th>
                      <th className="px-2 py-2 text-center font-bold border border-sky-200 bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300">LEAVE</th>
                      <th className="px-2 py-2 text-center font-bold border border-sky-200 bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300">HOLIDAYS</th>
                      <th className="px-2 py-2 text-center font-bold border border-sky-200 bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300">Paid Days</th>
                      <th className="px-2 py-2 text-center font-bold border border-sky-200 bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300">OT HRS</th>
                      <th className="px-2 py-2 text-right font-bold border border-emerald-200 bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300">Basic Rate</th>
                      <th className="px-2 py-2 text-right font-bold border border-emerald-200 bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300">Basic Wages</th>
                      <th className="px-2 py-2 text-right font-bold border border-emerald-200 bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300">HRA 5%</th>
                      <th className="px-2 py-2 text-right font-bold border border-emerald-200 bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300">Fixed HRA</th>
                      <th className="px-2 py-2 text-right font-bold border border-emerald-200 bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300">OT Allow</th>
                      <th className="px-2 py-2 text-right font-bold border border-emerald-200 bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300">Total Gross</th>
                      <th className="px-2 py-2 text-right font-bold border border-rose-200 bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300">PF @12%</th>
                      <th className="px-2 py-2 text-right font-bold border border-rose-200 bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300">ESIC @.75%</th>
                      <th className="px-2 py-2 text-right font-bold border border-rose-200 bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300">P-TAX</th>
                      <th className="px-2 py-2 text-right font-bold border border-rose-200 bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300">LWF</th>
                      <th className="px-2 py-2 text-right font-bold border border-rose-200 bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300">Total Dedu</th>
                      <th className="px-2 py-2 text-right font-bold border border-rose-200 bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300">Net Salary</th>
                      <th className="px-2 py-2 text-center font-bold border border-amber-200 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300">Leave Bal</th>
                      <th className="px-2 py-2 text-right font-bold border border-amber-200 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300">Leave Encash</th>
                      <th className="px-2 py-2 text-right font-bold border border-amber-200 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300">Advance</th>
                      <th className="px-2 py-2 text-right font-bold border border-amber-200 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300">Pay In A/c</th>
                      <th className="px-2 py-2 text-right font-bold border border-violet-200 bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300">PF @13%</th>
                      <th className="px-2 py-2 text-right font-bold border border-violet-200 bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300">ESIC @3.25%</th>
                      <th className="px-2 py-2 text-right font-bold border border-violet-200 bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300">Bonus @8.33%</th>
                      <th className="px-2 py-2 text-right font-bold border border-violet-200 bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300">Total</th>
                      <th className="px-2 py-2 text-right font-bold border border-teal-200 bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300">Service @12%</th>
                      <th className="px-2 py-2 text-right font-bold border border-teal-200 bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300">Total</th>
                      <th className="px-2 py-2 text-right font-bold border border-teal-200 bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300">GST 18%</th>
                      <th className="px-2 py-2 text-right font-bold border border-teal-200 bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300">Grand Total</th>
                      <th className="px-2 py-2 text-center font-bold border border-slate-200 bg-slate-100 dark:bg-slate-800 w-[40px]">Slip</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salaries.map((s, idx) => {
                      const r = rows[idx];
                      const evenBg = "bg-white dark:bg-slate-900";
                      const oddBg = "bg-blue-50/40 dark:bg-slate-800/40";
                      const bgClass = idx % 2 === 0 ? evenBg : oddBg;
                      return (
                        <tr key={s.id} className={`${bgClass} hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors`} data-testid={`row-salary-${s.id}`}>
                          <td className={`px-2 py-1.5 text-center border border-slate-200 sticky left-0 ${bgClass} z-10 font-semibold text-indigo-600 dark:text-indigo-400`}>{idx + 1}</td>
                          <td className={`px-2 py-1.5 text-left border border-slate-200 sticky left-[36px] ${bgClass} z-10 font-mono text-[10px] text-slate-600 dark:text-slate-400`}>{r.emp?.employeeCode || "-"}</td>
                          <td className={`px-2 py-1.5 text-left border border-slate-200 sticky left-[116px] ${bgClass} z-10 font-semibold text-slate-800 dark:text-slate-200`}>{r.emp?.name || `#${s.employeeId}`}</td>
                          <td className="px-2 py-1.5 text-left border border-slate-200 text-[10px] text-slate-500 dark:text-slate-400">{r.skills}</td>
                          <td className="px-2 py-1.5 text-center border border-slate-200">{r.prsDays}</td>
                          <td className="px-2 py-1.5 text-center border border-slate-200">{r.halfDay}</td>
                          <td className="px-2 py-1.5 text-center border border-slate-200">{r.holidayWorking}</td>
                          <td className="px-2 py-1.5 text-center border border-slate-200">{r.leave}</td>
                          <td className="px-2 py-1.5 text-center border border-slate-200">{r.holidays}</td>
                          <td className="px-2 py-1.5 text-right border border-slate-200 font-medium text-sky-700 dark:text-sky-300">{fmtDec(r.paidDays)}</td>
                          <td className="px-2 py-1.5 text-center border border-slate-200">{r.otHrs}</td>
                          <td className="px-2 py-1.5 text-right border border-slate-200 font-semibold">{fmtDec(r.basicRate)}</td>
                          <td className="px-2 py-1.5 text-right border border-slate-200 text-emerald-700 dark:text-emerald-400">{fmt(r.basicWage)}</td>
                          <td className="px-2 py-1.5 text-right border border-slate-200">{fmt(r.hra5)}</td>
                          <td className="px-2 py-1.5 text-right border border-slate-200">{fmtDec(r.fixedHRA)}</td>
                          <td className="px-2 py-1.5 text-right border border-slate-200">{r.otAllow ? fmt(r.otAllow) : "-"}</td>
                          <td className="px-2 py-1.5 text-right border border-slate-200 font-bold text-emerald-700 dark:text-emerald-400">{fmt(r.totalGross)}</td>
                          <td className="px-2 py-1.5 text-right border border-slate-200 text-rose-600 dark:text-rose-400">{fmt(r.pfDed)}</td>
                          <td className="px-2 py-1.5 text-right border border-slate-200 text-rose-600 dark:text-rose-400">{fmtDec(r.esicDed)}</td>
                          <td className="px-2 py-1.5 text-right border border-slate-200 text-rose-600 dark:text-rose-400">{r.pTax ? fmt(r.pTax) : "-"}</td>
                          <td className="px-2 py-1.5 text-right border border-slate-200 text-rose-600 dark:text-rose-400">{r.lwf ? fmt(r.lwf) : ""}</td>
                          <td className="px-2 py-1.5 text-right border border-slate-200 font-bold text-rose-700 dark:text-rose-400">{fmt(r.totalDedu)}</td>
                          <td className="px-2 py-1.5 text-right border border-slate-200 font-bold text-blue-700 dark:text-blue-300">{fmt(r.netSalary)}</td>
                          <td className="px-2 py-1.5 text-center border border-slate-200">{r.leaveBalance}</td>
                          <td className="px-2 py-1.5 text-right border border-slate-200">{fmt(r.leaveEncash)}</td>
                          <td className="px-2 py-1.5 text-right border border-slate-200">{fmt(r.advance)}</td>
                          <td className="px-2 py-1.5 text-right border border-slate-200 font-semibold text-amber-700 dark:text-amber-300">{fmt(r.payInAccount)}</td>
                          <td className="px-2 py-1.5 text-right border border-slate-200 text-violet-600 dark:text-violet-400">{fmt(r.pfEmployer)}</td>
                          <td className="px-2 py-1.5 text-right border border-slate-200 text-violet-600 dark:text-violet-400">{fmt(r.esicEmployer)}</td>
                          <td className="px-2 py-1.5 text-right border border-slate-200 text-violet-600 dark:text-violet-400">{fmt(r.bonus)}</td>
                          <td className="px-2 py-1.5 text-right border border-slate-200 font-bold text-violet-700 dark:text-violet-300">{fmt(r.employerTotal)}</td>
                          <td className="px-2 py-1.5 text-right border border-slate-200 text-teal-600 dark:text-teal-400">{fmt(r.serviceCharge)}</td>
                          <td className="px-2 py-1.5 text-right border border-slate-200 font-semibold text-teal-700 dark:text-teal-300">{fmt(r.afterService)}</td>
                          <td className="px-2 py-1.5 text-right border border-slate-200 text-teal-600 dark:text-teal-400">{fmt(r.gst)}</td>
                          <td className="px-2 py-1.5 text-right border border-slate-200 font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50/50 dark:bg-indigo-900/20">{fmt(r.finalTotal)}</td>
                          <td className="px-2 py-1.5 text-center border border-slate-200">
                            <Link href={`/salary/${s.id}/slip`}>
                              <Button variant="ghost" size="icon" className="h-5 w-5 text-indigo-600 hover:text-indigo-800" data-testid={`button-view-slip-${s.id}`}>
                                <ArrowRight className="w-3 h-3" />
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 font-bold border-t-2 border-indigo-400">
                      <td className="px-2 py-2 border border-slate-300 sticky left-0 bg-slate-200 dark:bg-slate-700 z-10 text-center text-indigo-700 dark:text-indigo-300">Total</td>
                      <td className="px-2 py-2 border border-slate-300 sticky left-[36px] bg-slate-200 dark:bg-slate-700 z-10"></td>
                      <td className="px-2 py-2 border border-slate-300 sticky left-[116px] bg-slate-200 dark:bg-slate-700 z-10"></td>
                      <td className="px-2 py-2 border border-slate-300"></td>
                      <td className="px-2 py-2 text-center border border-slate-300">{totals.prsDays}</td>
                      <td className="px-2 py-2 text-center border border-slate-300">{totals.halfDay}</td>
                      <td className="px-2 py-2 text-center border border-slate-300">{totals.holidayWorking}</td>
                      <td className="px-2 py-2 text-center border border-slate-300">{totals.leave}</td>
                      <td className="px-2 py-2 text-center border border-slate-300">{totals.holidays}</td>
                      <td className="px-2 py-2 text-right border border-slate-300 text-sky-700 dark:text-sky-300">{fmtDec(totals.paidDays)}</td>
                      <td className="px-2 py-2 text-center border border-slate-300">{totals.otHrs}</td>
                      <td className="px-2 py-2 text-right border border-slate-300">{fmt(totals.basicRate)}</td>
                      <td className="px-2 py-2 text-right border border-slate-300 text-emerald-700 dark:text-emerald-400">{fmt(totals.basicWage)}</td>
                      <td className="px-2 py-2 text-right border border-slate-300">{fmt(totals.hra5)}</td>
                      <td className="px-2 py-2 text-right border border-slate-300">{fmtDec(totals.fixedHRA)}</td>
                      <td className="px-2 py-2 text-right border border-slate-300">{fmt(totals.otAllow)}</td>
                      <td className="px-2 py-2 text-right border border-slate-300 text-emerald-700 dark:text-emerald-400">{fmt(totals.totalGross)}</td>
                      <td className="px-2 py-2 text-right border border-slate-300 text-rose-700 dark:text-rose-400">{fmt(totals.pfDed)}</td>
                      <td className="px-2 py-2 text-right border border-slate-300 text-rose-700 dark:text-rose-400">{fmt(totals.esicDed)}</td>
                      <td className="px-2 py-2 text-right border border-slate-300 text-rose-700 dark:text-rose-400">{fmt(totals.pTax)}</td>
                      <td className="px-2 py-2 text-right border border-slate-300">{fmt(totals.lwf)}</td>
                      <td className="px-2 py-2 text-right border border-slate-300 text-rose-700 dark:text-rose-400">{fmt(totals.totalDedu)}</td>
                      <td className="px-2 py-2 text-right border border-slate-300 text-blue-700 dark:text-blue-300">{fmt(totals.netSalary)}</td>
                      <td className="px-2 py-2 text-center border border-slate-300">{totals.leaveBalance}</td>
                      <td className="px-2 py-2 text-right border border-slate-300">{fmt(totals.leaveEncash)}</td>
                      <td className="px-2 py-2 text-right border border-slate-300">{fmt(totals.advance)}</td>
                      <td className="px-2 py-2 text-right border border-slate-300 text-amber-700 dark:text-amber-300">{fmt(totals.payInAccount)}</td>
                      <td className="px-2 py-2 text-right border border-slate-300 text-violet-700 dark:text-violet-300">{fmt(totals.pfEmployer)}</td>
                      <td className="px-2 py-2 text-right border border-slate-300 text-violet-700 dark:text-violet-300">{fmt(totals.esicEmployer)}</td>
                      <td className="px-2 py-2 text-right border border-slate-300 text-violet-700 dark:text-violet-300">{fmt(totals.bonus)}</td>
                      <td className="px-2 py-2 text-right border border-slate-300 text-violet-700 dark:text-violet-300">{fmt(totals.employerTotal)}</td>
                      <td className="px-2 py-2 text-right border border-slate-300 text-teal-700 dark:text-teal-300">{fmt(totals.serviceCharge)}</td>
                      <td className="px-2 py-2 text-right border border-slate-300 text-teal-700 dark:text-teal-300">{fmt(totals.afterService)}</td>
                      <td className="px-2 py-2 text-right border border-slate-300 text-teal-700 dark:text-teal-300">{fmt(totals.gst)}</td>
                      <td className="px-2 py-2 text-right border border-slate-300 text-indigo-700 dark:text-indigo-300 bg-indigo-100/50 dark:bg-indigo-900/30">{fmt(totals.finalTotal)}</td>
                      <td className="px-2 py-2 border border-slate-300"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div id="salary-print-area" className="hidden print:block">
              <div style={{ textAlign: "center", marginBottom: "8px" }}>
                <div style={{ fontSize: "13px" }}>{clientName}</div>
                <div style={{ fontSize: "16px", fontWeight: "bold" }}>{MONTHS[Number(month) - 1]} {year}</div>
              </div>
              <table className="salary-print-table">
                <thead>
                  <tr>
                    <th colSpan={4} style={{ background: "#e8eaf6", color: "#283593", fontSize: "8px", fontWeight: 700 }}>Employee Details</th>
                    <th colSpan={7} style={{ background: "#e1f5fe", color: "#0277bd", fontSize: "8px", fontWeight: 700 }}>Attendance & Days</th>
                    <th colSpan={6} style={{ background: "#e8f5e9", color: "#2e7d32", fontSize: "8px", fontWeight: 700 }}>Earnings</th>
                    <th colSpan={6} style={{ background: "#fce4ec", color: "#c62828", fontSize: "8px", fontWeight: 700 }}>Deductions</th>
                  </tr>
                  <tr>
                    <th style={{ background: "#c5cae9" }}>Sl.</th>
                    <th style={{ background: "#c5cae9" }}>Emp ID</th>
                    <th className="text-left" style={{ background: "#c5cae9" }}>Emp Name</th>
                    <th className="text-left" style={{ background: "#c5cae9" }}>Skills</th>
                    <th style={{ background: "#b3e5fc" }}>PRS DAYS</th>
                    <th style={{ background: "#b3e5fc" }}>Half Day</th>
                    <th style={{ background: "#b3e5fc" }}>Holiday Wrk</th>
                    <th style={{ background: "#b3e5fc" }}>LEAVE</th>
                    <th style={{ background: "#b3e5fc" }}>HOLIDAYS</th>
                    <th style={{ background: "#b3e5fc" }}>Paid Days</th>
                    <th style={{ background: "#b3e5fc" }}>OT HRS</th>
                    <th style={{ background: "#c8e6c9" }}>Basic Rate</th>
                    <th style={{ background: "#c8e6c9" }}>Basic Wages</th>
                    <th style={{ background: "#c8e6c9" }}>HRA 5%</th>
                    <th style={{ background: "#c8e6c9" }}>Fixed HRA</th>
                    <th style={{ background: "#c8e6c9" }}>OT Allow</th>
                    <th style={{ background: "#c8e6c9" }}>Total Gross</th>
                    <th style={{ background: "#f8bbd0" }}>PF @12%</th>
                    <th style={{ background: "#f8bbd0" }}>ESIC @.75%</th>
                    <th style={{ background: "#f8bbd0" }}>P-TAX</th>
                    <th style={{ background: "#f8bbd0" }}>LWF</th>
                    <th style={{ background: "#f8bbd0" }}>Total Dedu</th>
                    <th style={{ background: "#f8bbd0" }}>Net Salary</th>
                  </tr>
                </thead>
                <tbody>
                  {salaries.map((s, idx) => {
                    const r = rows[idx];
                    const even = idx % 2 === 0;
                    return (
                      <tr key={s.id} style={{ background: even ? "#ffffff" : "#f5f7ff" }}>
                        <td className="text-center" style={{ fontWeight: 600, color: "#3949ab" }}>{idx + 1}</td>
                        <td className="text-left" style={{ fontSize: "7px", color: "#546e7a" }}>{r.emp?.employeeCode || "-"}</td>
                        <td className="text-left" style={{ fontWeight: 600 }}>{r.emp?.name || "-"}</td>
                        <td className="text-left" style={{ fontSize: "7px", color: "#78909c" }}>{r.skills}</td>
                        <td className="text-center">{r.prsDays}</td>
                        <td className="text-center">{r.halfDay}</td>
                        <td className="text-center">{r.holidayWorking}</td>
                        <td className="text-center">{r.leave}</td>
                        <td className="text-center">{r.holidays}</td>
                        <td className="text-right" style={{ color: "#0277bd", fontWeight: 600 }}>{fmtDec(r.paidDays)}</td>
                        <td className="text-center">{r.otHrs}</td>
                        <td className="text-right" style={{ fontWeight: "bold" }}>{fmtDec(r.basicRate)}</td>
                        <td className="text-right" style={{ color: "#2e7d32" }}>{fmt(r.basicWage)}</td>
                        <td className="text-right">{fmt(r.hra5)}</td>
                        <td className="text-right">{fmtDec(r.fixedHRA)}</td>
                        <td className="text-right">{r.otAllow ? fmt(r.otAllow) : "-"}</td>
                        <td className="text-right" style={{ fontWeight: "bold", color: "#2e7d32" }}>{fmt(r.totalGross)}</td>
                        <td className="text-right" style={{ color: "#c62828" }}>{fmt(r.pfDed)}</td>
                        <td className="text-right" style={{ color: "#c62828" }}>{fmtDec(r.esicDed)}</td>
                        <td className="text-right" style={{ color: "#c62828" }}>{r.pTax ? fmt(r.pTax) : "-"}</td>
                        <td className="text-right" style={{ color: "#c62828" }}>{r.lwf ? fmt(r.lwf) : "-"}</td>
                        <td className="text-right" style={{ fontWeight: "bold", color: "#c62828" }}>{fmt(r.totalDedu)}</td>
                        <td className="text-right" style={{ fontWeight: "bold", color: "#1565c0" }}>{fmt(r.netSalary)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: "bold", background: "#e0e0e0" }}>
                    <td className="text-center" style={{ color: "#3949ab" }}>Total</td>
                    <td colSpan={3}></td>
                    <td className="text-center">{totals.prsDays}</td>
                    <td className="text-center">{totals.halfDay}</td>
                    <td className="text-center">{totals.holidayWorking}</td>
                    <td className="text-center">{totals.leave}</td>
                    <td className="text-center">{totals.holidays}</td>
                    <td className="text-right" style={{ color: "#0277bd" }}>{fmtDec(totals.paidDays)}</td>
                    <td className="text-center">{totals.otHrs}</td>
                    <td className="text-right">{fmt(totals.basicRate || 0)}</td>
                    <td className="text-right" style={{ color: "#2e7d32" }}>{fmt(totals.basicWage)}</td>
                    <td className="text-right">{fmt(totals.hra5)}</td>
                    <td className="text-right">{fmtDec(totals.fixedHRA)}</td>
                    <td className="text-right">{fmt(totals.otAllow)}</td>
                    <td className="text-right" style={{ color: "#2e7d32" }}>{fmt(totals.totalGross)}</td>
                    <td className="text-right" style={{ color: "#c62828" }}>{fmt(totals.pfDed)}</td>
                    <td className="text-right" style={{ color: "#c62828" }}>{fmt(totals.esicDed)}</td>
                    <td className="text-right" style={{ color: "#c62828" }}>{fmt(totals.pTax)}</td>
                    <td className="text-right">{fmt(totals.lwf)}</td>
                    <td className="text-right" style={{ color: "#c62828" }}>{fmt(totals.totalDedu)}</td>
                    <td className="text-right" style={{ color: "#1565c0" }}>{fmt(totals.netSalary)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="md:hidden print:hidden space-y-3">
              {salaries.map((s, idx) => {
                const r = rows[idx];
                return (
                  <Link key={s.id} href={`/salary/${s.id}/slip`}>
                    <Card className="hover-elevate" data-testid={`card-salary-mobile-${s.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">{idx + 1}</Badge>
                            <span className="font-medium text-sm">{r.emp?.name || `#${s.employeeId}`}</span>
                          </div>
                          <ArrowRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-xs">
                          <div>
                            <p className="text-muted-foreground">Days</p>
                            <p className="font-medium">{r.paidDays}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Gross</p>
                            <p className="font-medium">{fmt(r.totalGross)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Net Pay</p>
                            <p className="font-bold text-emerald-600 dark:text-emerald-400">{fmt(r.netSalary)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Final</p>
                            <p className="font-bold">{fmt(r.finalTotal)}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </>
        )}

        {loaded && !isLoading && salaries && salaries.length === 0 && (
          <Card>
            <CardContent className="text-center py-16">
              <div className="w-14 h-14 bg-muted rounded-xl flex items-center justify-center mx-auto mb-4">
                <FileText className="w-7 h-7 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-1">No Salary Records</h3>
              <p className="text-sm text-muted-foreground mb-4">
                No salary records found for {MONTHS[Number(month) - 1]} {year}.
              </p>
              {isAdmin && (
                <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending} data-testid="button-generate-empty">
                  {generateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                  Generate Salary
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
      <PrintSettingsDialog
        open={salaryPrintDialogOpen}
        onOpenChange={setSalaryPrintDialogOpen}
        employees={salaryPrintEmployeeList}
        selectedEmployeeIds={salaryPrintSelectedIds}
        onSelectedEmployeeIdsChange={setSalaryPrintSelectedIds}
        onPrint={handleGovPrint}
        title="Print Form XVII - Select Employees"
      />
    </Layout>
  );
}
