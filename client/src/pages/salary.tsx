import { useState, useMemo, useRef, useCallback } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Printer, FileText, Users, IndianRupee, TrendingDown, Wallet, ArrowRight, Download, ImageDown, FileSpreadsheet } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  try { const dt = new Date(d); return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" }); } catch { return d; }
}

function buildSlipHTML(salary: SalaryRecord, employee: Employee | undefined, attendance: AttendanceRecord | undefined, logoSrc: string): string {
  const n = (v: string | undefined | null) => Number(v) || 0;
  const basicRate = n(employee?.dailyRate);
  const basic = n(salary.basicWage);
  const hra5 = Math.round(basic * 0.05);
  const fixedHRA = n(salary.hra);
  const totalGross = n(salary.grossWage);
  const pfDed = n(salary.pfDeduction);
  const esicDed = n(salary.esicDeduction);
  const pTax = n(salary.professionalTax);
  const lwf = n(salary.otherDeduction);
  const totalDedu = n(salary.totalDeduction);
  const netSalary = n(salary.netPay);
  const otHrs = n(salary.overtimeHours);
  const prsDays = n(attendance?.totalPresent) || n(salary.daysWorked);
  const leave = n(attendance?.totalAbsent);
  let holidays = 0;
  if (attendance) { for (let i = 1; i <= 31; i++) { const val = attendance[`day${i}`]; if (val === "H" || val === "WO" || val === "PH") holidays++; } }
  const paidDays = n(salary.daysWorked);

  return `<div style="width:800px;background:white;padding:0;font-family:Arial,sans-serif;">
    <table style="width:100%;border-collapse:collapse;font-size:13px;color:#000;">
      <tbody>
        <tr><td colspan="8" style="border:1px solid #333;text-align:center;padding:8px;">
          <div style="display:flex;align-items:center;justify-content:center;gap:12px;">
            <img src="${logoSrc}" crossorigin="anonymous" style="width:50px;height:50px;" />
            <div>
              <div style="font-size:16px;font-weight:bold;">DJ HOSPITALITY &amp; FACILITY MANAGEMENT PVT LTD</div>
              <div style="font-size:10px;">Regd. &amp; Head Office: 730, Tin Made, Sodiem Siolim, Mapusa Bardez, North Goa-403502, India</div>
              <div style="font-size:10px;">Branch Office: 7 Crimatorium Street, Kolkata- 700014</div>
            </div>
          </div>
          <div style="font-weight:bold;font-size:14px;margin-top:4px;">Form - XIX Wages Slip</div>
          <div style="font-size:11px;">[See rule 78(1)(b)]</div>
        </td></tr>
        <tr><td colspan="8" style="border:1px solid #333;text-align:center;padding:10px;font-size:20px;font-weight:bold;">${MONTHS[salary.month - 1]}-${salary.year}</td></tr>
        <tr><td colspan="2" style="border:1px solid #333;padding:4px 8px;font-weight:600;background:#f9f9f9;">Company Name</td><td colspan="6" style="border:1px solid #333;padding:4px 8px;font-weight:bold;">${esc(salary.clientName)}</td></tr>
        <tr><td colspan="2" style="border:1px solid #333;padding:4px 8px;font-weight:600;background:#f9f9f9;">Location of work</td><td colspan="6" style="border:1px solid #333;padding:4px 8px;">Khidirpur Factory, 1, Transport depot Rd, Goragacha Rood, Kolkata - 700110</td></tr>
        <tr><td colspan="2" style="border:1px solid #333;padding:4px 8px;font-weight:600;background:#f9f9f9;">Name:</td><td colspan="6" style="border:1px solid #333;padding:4px 8px;font-size:15px;font-weight:bold;">${esc(employee?.name)}</td></tr>
        <tr>
          <td colspan="2" style="border:1px solid #333;padding:4px 8px;font-weight:600;background:#f9f9f9;">Father's / Husband's :</td>
          <td colspan="2" style="border:1px solid #333;padding:4px 8px;">${esc(employee?.fatherName)}</td>
          <td style="border:1px solid #333;padding:4px 8px;font-weight:600;background:#f9f9f9;">Skills:</td>
          <td colspan="3" style="border:1px solid #333;padding:4px 8px;">${esc(employee?.designation) || "Unskilled"}</td>
        </tr>
        <tr>
          <td colspan="2" style="border:1px solid #333;padding:4px 8px;font-weight:600;background:#f9f9f9;">Date Of Birth</td>
          <td colspan="2" style="border:1px solid #333;padding:4px 8px;">${formatDateStr(employee?.dob)}</td>
          <td style="border:1px solid #333;padding:4px 8px;font-weight:600;background:#f9f9f9;">Joining Date :</td>
          <td colspan="3" style="border:1px solid #333;padding:4px 8px;">${formatDateStr(employee?.joiningDate)}</td>
        </tr>
        <tr>
          <td colspan="2" style="border:1px solid #333;padding:4px 8px;font-weight:600;background:#f9f9f9;">ESIC No.:</td>
          <td colspan="2" style="border:1px solid #333;padding:4px 8px;">${esc(employee?.esicNo)}</td>
          <td style="border:1px solid #333;padding:4px 8px;font-weight:600;background:#f9f9f9;">UAN:</td>
          <td colspan="3" style="border:1px solid #333;padding:4px 8px;">${esc(employee?.uanNo)}</td>
        </tr>
        <tr>
          <td colspan="2" style="border:1px solid #333;padding:4px 8px;font-weight:600;background:#f9f9f9;">PF No.:</td>
          <td colspan="2" style="border:1px solid #333;padding:4px 8px;">${esc(employee?.pfNo)}</td>
          <td style="border:1px solid #333;padding:4px 8px;font-weight:600;background:#f9f9f9;">Mobile No:</td>
          <td colspan="3" style="border:1px solid #333;padding:4px 8px;">${esc(employee?.mobile)}</td>
        </tr>
        <tr>
          <td style="border:1px solid #333;padding:4px 8px;font-weight:600;background:#f9f9f9;">Bank Name:</td>
          <td colspan="3" style="border:1px solid #333;padding:4px 8px;">${esc(employee?.bankName)}</td>
          <td style="border:1px solid #333;padding:4px 8px;font-weight:600;background:#f9f9f9;">IFSC Code :</td>
          <td colspan="3" style="border:1px solid #333;padding:4px 8px;">${esc(employee?.ifscCode)}</td>
        </tr>
        <tr>
          <td style="border:1px solid #333;padding:4px 8px;font-weight:600;background:#f9f9f9;">Bank Account No.:</td>
          <td colspan="3" style="border:1px solid #333;padding:4px 8px;">${esc(employee?.accountNo)}</td>
          <td style="border:1px solid #333;padding:4px 8px;font-weight:600;background:#f9f9f9;">Pay. Date:</td>
          <td colspan="3" style="border:1px solid #333;padding:4px 8px;">${salary.paidOn ? formatDateStr(salary.paidOn) : "-"}</td>
        </tr>
        <tr>
          <td style="border:1px solid #333;padding:4px 8px;font-weight:600;background:#f9f9f9;">PRS DAYS</td>
          <td style="border:1px solid #333;padding:4px 8px;text-align:right;">${prsDays}</td>
          <td colspan="2" style="border:1px solid #333;padding:4px 8px;font-weight:600;background:#f9f9f9;">Basic Rate</td>
          <td style="border:1px solid #333;padding:4px 8px;text-align:right;">${basicRate}</td>
          <td colspan="2" style="border:1px solid #333;padding:4px 8px;font-weight:600;background:#f9f9f9;">ESIC @ 0.75%</td>
          <td style="border:1px solid #333;padding:4px 8px;text-align:right;">${esicDed}</td>
        </tr>
        <tr>
          <td style="border:1px solid #333;padding:4px 8px;font-weight:600;background:#f9f9f9;">Half Day</td>
          <td style="border:1px solid #333;padding:4px 8px;text-align:right;">0</td>
          <td colspan="2" style="border:1px solid #333;padding:4px 8px;font-weight:600;background:#f9f9f9;">Basic</td>
          <td style="border:1px solid #333;padding:4px 8px;text-align:right;">${basic}</td>
          <td colspan="2" style="border:1px solid #333;padding:4px 8px;font-weight:600;background:#f9f9f9;">P-TAX</td>
          <td style="border:1px solid #333;padding:4px 8px;text-align:right;">${pTax}</td>
        </tr>
        <tr>
          <td style="border:1px solid #333;padding:4px 8px;font-weight:600;background:#f9f9f9;">Extra Work</td>
          <td style="border:1px solid #333;padding:4px 8px;text-align:right;">0</td>
          <td colspan="2" style="border:1px solid #333;padding:4px 8px;font-weight:600;background:#f9f9f9;">HRA 5%</td>
          <td style="border:1px solid #333;padding:4px 8px;text-align:right;">${hra5}</td>
          <td colspan="2" style="border:1px solid #333;padding:4px 8px;font-weight:600;background:#f9f9f9;">LWF</td>
          <td style="border:1px solid #333;padding:4px 8px;text-align:right;">${lwf}</td>
        </tr>
        <tr>
          <td style="border:1px solid #333;padding:4px 8px;font-weight:600;background:#f9f9f9;">LEAVE</td>
          <td style="border:1px solid #333;padding:4px 8px;text-align:right;">${leave}</td>
          <td colspan="2" style="border:1px solid #333;padding:4px 8px;font-weight:600;background:#f9f9f9;">Fixed HRA</td>
          <td style="border:1px solid #333;padding:4px 8px;text-align:right;">${fixedHRA}</td>
          <td colspan="2" style="border:1px solid #333;padding:4px 8px;font-weight:600;background:#f9f9f9;">Total Dedu</td>
          <td style="border:1px solid #333;padding:4px 8px;text-align:right;font-weight:bold;">${totalDedu}</td>
        </tr>
        <tr>
          <td style="border:1px solid #333;padding:4px 8px;font-weight:600;background:#f9f9f9;">HOLIDAYS</td>
          <td style="border:1px solid #333;padding:4px 8px;text-align:right;">${holidays}</td>
          <td colspan="2" style="border:1px solid #333;padding:4px 8px;font-weight:600;background:#f9f9f9;">OT Allow</td>
          <td style="border:1px solid #333;padding:4px 8px;text-align:right;">${n(salary.overtimeAmount)}</td>
          <td colspan="2" style="border:1px solid #333;padding:4px 8px;font-weight:600;background:#f9f9f9;font-size:11px;">Leave Balance ${salary.year}</td>
          <td style="border:1px solid #333;padding:4px 8px;text-align:right;">0</td>
        </tr>
        <tr>
          <td style="border:1px solid #333;padding:4px 8px;font-weight:600;background:#f9f9f9;">Paid Days</td>
          <td style="border:1px solid #333;padding:4px 8px;text-align:right;font-weight:bold;">${paidDays}</td>
          <td colspan="2" style="border:1px solid #333;padding:4px 8px;font-weight:600;background:#f9f9f9;">Total Gross</td>
          <td style="border:1px solid #333;padding:4px 8px;text-align:right;font-weight:bold;">${totalGross}</td>
          <td colspan="2" style="border:1px solid #333;padding:4px 8px;font-weight:600;background:#f9f9f9;font-size:10px;">Leave Encashment Amt. ${salary.year}</td>
          <td style="border:1px solid #333;padding:4px 8px;text-align:right;">0</td>
        </tr>
        <tr>
          <td style="border:1px solid #333;padding:4px 8px;font-weight:600;background:#f9f9f9;">OT HRS</td>
          <td style="border:1px solid #333;padding:4px 8px;text-align:right;">${otHrs}</td>
          <td colspan="2" style="border:1px solid #333;padding:4px 8px;font-weight:600;background:#f9f9f9;">PF Deduction @12%</td>
          <td style="border:1px solid #333;padding:4px 8px;text-align:right;">${pfDed}</td>
          <td colspan="2" style="border:1px solid #333;padding:4px 8px;font-weight:bold;background:#f9f9f9;">Net Salary</td>
          <td style="border:1px solid #333;padding:4px 8px;text-align:right;font-weight:bold;font-size:15px;">${netSalary}</td>
        </tr>
        <tr>
          <td colspan="2" style="border:1px solid #333;padding:4px 8px;font-weight:bold;background:#f9f9f9;">Net Salary in Word</td>
          <td colspan="6" style="border:1px solid #333;padding:4px 8px;font-weight:bold;">${numberToWords(netSalary)}</td>
        </tr>
        <tr>
          <td colspan="8" style="border:1px solid #333;height:60px;vertical-align:bottom;padding:8px;">
            <div style="display:flex;justify-content:space-between;">
              <div style="text-align:center;"><div style="border-top:1px solid #333;padding-top:4px;min-width:180px;">Prepared By Signature</div></div>
              <div style="text-align:center;"><div style="border-top:1px solid #333;padding-top:4px;min-width:180px;">Approved By Signature and Stamp</div></div>
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

  const employeeMap = useMemo(() => {
    const map = new Map<number, Employee>();
    employees?.forEach((e) => map.set(e.id, e));
    return map;
  }, [employees]);

  const [downloading, setDownloading] = useState(false);
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
        const html = buildSlipHTML(s, emp, att, logoPath);

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
      const res = await apiRequest("POST", "/api/salary/generate", { clientName, month: Number(month), year: Number(year) });
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
    const basicRate = n(emp?.dailyRate);
    const basicWage = n(s.basicWage);
    const hra5 = Math.round(basicWage * 0.05);
    const fixedHRA = n(s.hra);
    const otAllow = n(s.overtimeAmount);
    const totalGross = n(s.grossWage);
    const pfDed = n(s.pfDeduction);
    const esicDed = n(s.esicDeduction);
    const pTax = n(s.professionalTax);
    const lwf = n(s.otherDeduction);
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
  }, [employeeMap, attendanceList]);

  const { rows, totals } = useMemo(() => {
    if (!salaries || salaries.length === 0) return { rows: [] as ReturnType<typeof computeRow>[], totals: null };
    const rs = salaries.map(computeRow);
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

  const handleExportExcel = useCallback(async () => {
    if (!salaries || salaries.length === 0 || rows.length === 0) return;
    const ExcelJS = await import("exceljs");
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

  const handleLoad = () => {
    if (!clientName) {
      toast({ title: "Select Client", description: "Please select a client name first.", variant: "destructive" });
      return;
    }
    setLoaded(true);
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
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                data-testid="button-export-excel-salary"
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Export Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadAllJpeg}
                disabled={downloading}
                data-testid="button-download-all-jpeg"
              >
                {downloading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ImageDown className="w-4 h-4 mr-2" />}
                {downloading ? "Downloading..." : "Download All JPEG"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => {
                const style = document.createElement("style");
                style.id = "salary-print-override";
                style.textContent = "@page { size: A3 landscape; margin: 0.4cm; }";
                document.head.appendChild(style);
                window.print();
                setTimeout(() => style.remove(), 1000);
              }} data-testid="button-print-salary">
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
            </div>
          )}
        </div>

        <Card data-testid="card-salary-filters">
          <CardContent className="p-4 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
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

            <div className="print:hidden border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] whitespace-nowrap border-collapse salary-screen-table" data-testid="table-salary-register" style={{ minWidth: "2600px" }}>
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 border-b-2 border-slate-300">
                      <th className="px-2 py-2 text-center font-bold border border-slate-300 sticky left-0 bg-slate-100 dark:bg-slate-800 z-10 w-[36px]">Sl. No.</th>
                      <th className="px-2 py-2 text-left font-bold border border-slate-300 sticky left-[36px] bg-slate-100 dark:bg-slate-800 z-10 w-[80px]">Emp ID</th>
                      <th className="px-2 py-2 text-left font-bold border border-slate-300 sticky left-[116px] bg-slate-100 dark:bg-slate-800 z-10 min-w-[150px]">Emp Name</th>
                      <th className="px-2 py-2 text-left font-bold border border-slate-300 min-w-[80px]">Skills</th>
                      <th className="px-2 py-2 text-center font-bold border border-slate-300">PRS DAYS</th>
                      <th className="px-2 py-2 text-center font-bold border border-slate-300">Half Day</th>
                      <th className="px-2 py-2 text-center font-bold border border-slate-300">Holiday Working</th>
                      <th className="px-2 py-2 text-center font-bold border border-slate-300">LEAVE</th>
                      <th className="px-2 py-2 text-center font-bold border border-slate-300">HOLIDAYS</th>
                      <th className="px-2 py-2 text-center font-bold border border-slate-300">Paid Days</th>
                      <th className="px-2 py-2 text-center font-bold border border-slate-300">OT HRS</th>
                      <th className="px-2 py-2 text-right font-bold border border-slate-300">Basic Rate</th>
                      <th className="px-2 py-2 text-right font-bold border border-slate-300">Basic wages</th>
                      <th className="px-2 py-2 text-right font-bold border border-slate-300">HRA 5%</th>
                      <th className="px-2 py-2 text-right font-bold border border-slate-300">Fixed HRA</th>
                      <th className="px-2 py-2 text-right font-bold border border-slate-300">OT Allow</th>
                      <th className="px-2 py-2 text-right font-bold border border-slate-300">Total Gross</th>
                      <th className="px-2 py-2 text-right font-bold border border-slate-300">PF Deduction @12%</th>
                      <th className="px-2 py-2 text-right font-bold border border-slate-300">ESIC @.75%</th>
                      <th className="px-2 py-2 text-right font-bold border border-slate-300">P-TAX</th>
                      <th className="px-2 py-2 text-right font-bold border border-slate-300">LWF</th>
                      <th className="px-2 py-2 text-right font-bold border border-slate-300">Total Dedu</th>
                      <th className="px-2 py-2 text-right font-bold border border-slate-300">Net Salary</th>
                      <th className="px-2 py-2 text-center font-bold border border-slate-300">Leave Balance</th>
                      <th className="px-2 py-2 text-right font-bold border border-slate-300">Leave Encash Amt.</th>
                      <th className="px-2 py-2 text-right font-bold border border-slate-300">Advance</th>
                      <th className="px-2 py-2 text-right font-bold border border-slate-300">Pay In Account</th>
                      <th className="px-2 py-2 text-right font-bold border border-slate-300">PF @13%</th>
                      <th className="px-2 py-2 text-right font-bold border border-slate-300">ESIC @3.25%</th>
                      <th className="px-2 py-2 text-right font-bold border border-slate-300">Bonus @8.33%</th>
                      <th className="px-2 py-2 text-right font-bold border border-slate-300">Total</th>
                      <th className="px-2 py-2 text-right font-bold border border-slate-300">Service Charges @12%</th>
                      <th className="px-2 py-2 text-right font-bold border border-slate-300">Total</th>
                      <th className="px-2 py-2 text-right font-bold border border-slate-300">GST 18%</th>
                      <th className="px-2 py-2 text-right font-bold border border-slate-300">Total</th>
                      <th className="px-2 py-2 text-center font-bold border border-slate-300 w-[40px]">Slip</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salaries.map((s, idx) => {
                      const r = rows[idx];
                      const bgClass = idx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50 dark:bg-slate-800/50";
                      return (
                        <tr key={s.id} className={`${bgClass} hover:bg-blue-50/50 dark:hover:bg-blue-900/20`} data-testid={`row-salary-${s.id}`}>
                          <td className={`px-2 py-1.5 text-center border border-slate-200 sticky left-0 ${bgClass} z-10`}>{idx + 1}</td>
                          <td className={`px-2 py-1.5 text-left border border-slate-200 sticky left-[36px] ${bgClass} z-10 font-mono text-[10px]`}>{r.emp?.employeeCode || "-"}</td>
                          <td className={`px-2 py-1.5 text-left border border-slate-200 sticky left-[116px] ${bgClass} z-10 font-medium`}>{r.emp?.name || `#${s.employeeId}`}</td>
                          <td className="px-2 py-1.5 text-left border border-slate-200 text-[10px]">{r.skills}</td>
                          <td className="px-2 py-1.5 text-center border border-slate-200">{r.prsDays}</td>
                          <td className="px-2 py-1.5 text-center border border-slate-200">{r.halfDay}</td>
                          <td className="px-2 py-1.5 text-center border border-slate-200">{r.holidayWorking}</td>
                          <td className="px-2 py-1.5 text-center border border-slate-200">{r.leave}</td>
                          <td className="px-2 py-1.5 text-center border border-slate-200">{r.holidays}</td>
                          <td className="px-2 py-1.5 text-right border border-slate-200">{fmtDec(r.paidDays)}</td>
                          <td className="px-2 py-1.5 text-center border border-slate-200">{r.otHrs}</td>
                          <td className="px-2 py-1.5 text-right border border-slate-200 font-semibold">{fmtDec(r.basicRate)}</td>
                          <td className="px-2 py-1.5 text-right border border-slate-200">{fmt(r.basicWage)}</td>
                          <td className="px-2 py-1.5 text-right border border-slate-200">{fmt(r.hra5)}</td>
                          <td className="px-2 py-1.5 text-right border border-slate-200">{fmtDec(r.fixedHRA)}</td>
                          <td className="px-2 py-1.5 text-right border border-slate-200">{r.otAllow ? fmt(r.otAllow) : "-"}</td>
                          <td className="px-2 py-1.5 text-right border border-slate-200 font-semibold">{fmt(r.totalGross)}</td>
                          <td className="px-2 py-1.5 text-right border border-slate-200">{fmt(r.pfDed)}</td>
                          <td className="px-2 py-1.5 text-right border border-slate-200">{fmtDec(r.esicDed)}</td>
                          <td className="px-2 py-1.5 text-right border border-slate-200">{r.pTax ? fmt(r.pTax) : "-"}</td>
                          <td className="px-2 py-1.5 text-right border border-slate-200">{r.lwf ? fmt(r.lwf) : ""}</td>
                          <td className="px-2 py-1.5 text-right border border-slate-200 font-semibold">{fmt(r.totalDedu)}</td>
                          <td className="px-2 py-1.5 text-right border border-slate-200 font-bold">{fmt(r.netSalary)}</td>
                          <td className="px-2 py-1.5 text-center border border-slate-200">{r.leaveBalance}</td>
                          <td className="px-2 py-1.5 text-right border border-slate-200">{fmt(r.leaveEncash)}</td>
                          <td className="px-2 py-1.5 text-right border border-slate-200">{fmt(r.advance)}</td>
                          <td className="px-2 py-1.5 text-right border border-slate-200 font-semibold">{fmt(r.payInAccount)}</td>
                          <td className="px-2 py-1.5 text-right border border-slate-200">{fmt(r.pfEmployer)}</td>
                          <td className="px-2 py-1.5 text-right border border-slate-200">{fmt(r.esicEmployer)}</td>
                          <td className="px-2 py-1.5 text-right border border-slate-200">{fmt(r.bonus)}</td>
                          <td className="px-2 py-1.5 text-right border border-slate-200 font-semibold">{fmt(r.employerTotal)}</td>
                          <td className="px-2 py-1.5 text-right border border-slate-200">{fmt(r.serviceCharge)}</td>
                          <td className="px-2 py-1.5 text-right border border-slate-200 font-semibold">{fmt(r.afterService)}</td>
                          <td className="px-2 py-1.5 text-right border border-slate-200">{fmt(r.gst)}</td>
                          <td className="px-2 py-1.5 text-right border border-slate-200 font-bold">{fmt(r.finalTotal)}</td>
                          <td className="px-2 py-1.5 text-center border border-slate-200">
                            <Link href={`/salary/${s.id}/slip`}>
                              <Button variant="ghost" size="icon" className="h-5 w-5" data-testid={`button-view-slip-${s.id}`}>
                                <ArrowRight className="w-3 h-3" />
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-200 dark:bg-slate-700 font-bold border-t-2 border-slate-400">
                      <td className="px-2 py-2 border border-slate-300 sticky left-0 bg-slate-200 dark:bg-slate-700 z-10"></td>
                      <td className="px-2 py-2 border border-slate-300 sticky left-[36px] bg-slate-200 dark:bg-slate-700 z-10"></td>
                      <td className="px-2 py-2 border border-slate-300 sticky left-[116px] bg-slate-200 dark:bg-slate-700 z-10"></td>
                      <td className="px-2 py-2 border border-slate-300"></td>
                      <td className="px-2 py-2 text-center border border-slate-300">{totals.prsDays}</td>
                      <td className="px-2 py-2 text-center border border-slate-300">{totals.halfDay}</td>
                      <td className="px-2 py-2 text-center border border-slate-300">{totals.holidayWorking}</td>
                      <td className="px-2 py-2 text-center border border-slate-300">{totals.leave}</td>
                      <td className="px-2 py-2 text-center border border-slate-300">{totals.holidays}</td>
                      <td className="px-2 py-2 text-right border border-slate-300">{fmtDec(totals.paidDays)}</td>
                      <td className="px-2 py-2 text-center border border-slate-300">{totals.otHrs}</td>
                      <td className="px-2 py-2 text-right border border-slate-300">{fmt(totals.basicRate)}</td>
                      <td className="px-2 py-2 text-right border border-slate-300">{fmt(totals.basicWage)}</td>
                      <td className="px-2 py-2 text-right border border-slate-300">{fmt(totals.hra5)}</td>
                      <td className="px-2 py-2 text-right border border-slate-300">{fmtDec(totals.fixedHRA)}</td>
                      <td className="px-2 py-2 text-right border border-slate-300">{fmt(totals.otAllow)}</td>
                      <td className="px-2 py-2 text-right border border-slate-300">{fmt(totals.totalGross)}</td>
                      <td className="px-2 py-2 text-right border border-slate-300">{fmt(totals.pfDed)}</td>
                      <td className="px-2 py-2 text-right border border-slate-300">{fmt(totals.esicDed)}</td>
                      <td className="px-2 py-2 text-right border border-slate-300">{fmt(totals.pTax)}</td>
                      <td className="px-2 py-2 text-right border border-slate-300">{fmt(totals.lwf)}</td>
                      <td className="px-2 py-2 text-right border border-slate-300">{fmt(totals.totalDedu)}</td>
                      <td className="px-2 py-2 text-right border border-slate-300">{fmt(totals.netSalary)}</td>
                      <td className="px-2 py-2 text-center border border-slate-300">{totals.leaveBalance}</td>
                      <td className="px-2 py-2 text-right border border-slate-300">{fmt(totals.leaveEncash)}</td>
                      <td className="px-2 py-2 text-right border border-slate-300">{fmt(totals.advance)}</td>
                      <td className="px-2 py-2 text-right border border-slate-300">{fmt(totals.payInAccount)}</td>
                      <td className="px-2 py-2 text-right border border-slate-300">{fmt(totals.pfEmployer)}</td>
                      <td className="px-2 py-2 text-right border border-slate-300">{fmt(totals.esicEmployer)}</td>
                      <td className="px-2 py-2 text-right border border-slate-300">{fmt(totals.bonus)}</td>
                      <td className="px-2 py-2 text-right border border-slate-300">{fmt(totals.employerTotal)}</td>
                      <td className="px-2 py-2 text-right border border-slate-300">{fmt(totals.serviceCharge)}</td>
                      <td className="px-2 py-2 text-right border border-slate-300">{fmt(totals.afterService)}</td>
                      <td className="px-2 py-2 text-right border border-slate-300">{fmt(totals.gst)}</td>
                      <td className="px-2 py-2 text-right border border-slate-300">{fmt(totals.finalTotal)}</td>
                      <td className="px-2 py-2 border border-slate-300"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div id="salary-print-area" className="hidden print:block">
              <div style={{ textAlign: "center", marginBottom: "8px" }}>
                <div style={{ fontSize: "18px", fontWeight: "bold" }}>Salary</div>
                <div style={{ fontSize: "13px" }}>{clientName}</div>
                <div style={{ fontSize: "16px", fontWeight: "bold" }}>{MONTHS[Number(month) - 1]} {year}</div>
              </div>
              <table className="salary-print-table">
                <thead>
                  <tr>
                    <th>Sl. No.</th>
                    <th>Emp ID</th>
                    <th className="text-left">Emp Name</th>
                    <th className="text-left">Skills</th>
                    <th>PRS DAYS</th>
                    <th>Half Day</th>
                    <th>Holiday Working</th>
                    <th>LEAVE</th>
                    <th>HOLIDAYS</th>
                    <th>Paid Days</th>
                    <th>OT HRS</th>
                    <th>Basic Rate</th>
                    <th>Basic wages</th>
                    <th>HRA 5%</th>
                    <th>Fixed HRA</th>
                    <th>OT Allow</th>
                    <th>Total Gross</th>
                    <th>PF Deduction @12%</th>
                    <th>ESIC @.75%</th>
                    <th>P-TAX</th>
                    <th>LWF</th>
                    <th>Total Dedu</th>
                    <th>Net Salary</th>
                  </tr>
                </thead>
                <tbody>
                  {salaries.map((s, idx) => {
                    const r = rows[idx];
                    const even = idx % 2 === 0;
                    return (
                      <tr key={s.id} style={{ background: even ? "#ffffff" : "#f0f8f0" }}>
                        <td className="text-center">{idx + 1}</td>
                        <td className="text-left" style={{ fontSize: "7px" }}>{r.emp?.employeeCode || "-"}</td>
                        <td className="text-left" style={{ fontWeight: 500 }}>{r.emp?.name || "-"}</td>
                        <td className="text-left">{r.skills}</td>
                        <td className="text-center">{r.prsDays}</td>
                        <td className="text-center">{r.halfDay}</td>
                        <td className="text-center">{r.holidayWorking}</td>
                        <td className="text-center">{r.leave}</td>
                        <td className="text-center">{r.holidays}</td>
                        <td className="text-right">{fmtDec(r.paidDays)}</td>
                        <td className="text-center">{r.otHrs}</td>
                        <td className="text-right" style={{ fontWeight: "bold" }}>{fmtDec(r.basicRate)}</td>
                        <td className="text-right">{fmt(r.basicWage)}</td>
                        <td className="text-right">{fmt(r.hra5)}</td>
                        <td className="text-right">{fmtDec(r.fixedHRA)}</td>
                        <td className="text-right">{r.otAllow ? fmt(r.otAllow) : "-"}</td>
                        <td className="text-right" style={{ fontWeight: "bold" }}>{fmt(r.totalGross)}</td>
                        <td className="text-right">{fmt(r.pfDed)}</td>
                        <td className="text-right">{fmtDec(r.esicDed)}</td>
                        <td className="text-right">{r.pTax ? fmt(r.pTax) : "-"}</td>
                        <td className="text-right">{r.lwf ? fmt(r.lwf) : "-"}</td>
                        <td className="text-right">{fmt(r.totalDedu)}</td>
                        <td className="text-right" style={{ fontWeight: "bold" }}>{fmt(r.netSalary)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: "bold", background: "#e8e8e8" }}>
                    <td colSpan={4}></td>
                    <td className="text-center">{totals.prsDays}</td>
                    <td className="text-center">{totals.halfDay}</td>
                    <td className="text-center">{totals.holidayWorking}</td>
                    <td className="text-center">{totals.leave}</td>
                    <td className="text-center">{totals.holidays}</td>
                    <td className="text-right">{fmtDec(totals.paidDays)}</td>
                    <td className="text-center">{totals.otHrs}</td>
                    <td className="text-right">{fmt(totals.basicRate || 0)}</td>
                    <td className="text-right">{fmt(totals.basicWage)}</td>
                    <td className="text-right">{fmt(totals.hra5)}</td>
                    <td className="text-right">{fmtDec(totals.fixedHRA)}</td>
                    <td className="text-right">{fmt(totals.otAllow)}</td>
                    <td className="text-right">{fmt(totals.totalGross)}</td>
                    <td className="text-right">{fmt(totals.pfDed)}</td>
                    <td className="text-right">{fmt(totals.esicDed)}</td>
                    <td className="text-right">{fmt(totals.pTax)}</td>
                    <td className="text-right">{fmt(totals.lwf)}</td>
                    <td className="text-right">{fmt(totals.totalDedu)}</td>
                    <td className="text-right">{fmt(totals.netSalary)}</td>
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
    </Layout>
  );
}
