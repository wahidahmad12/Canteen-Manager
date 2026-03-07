import { useState, useMemo, useRef, useCallback } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Printer, FileText, Users, IndianRupee, TrendingDown, Wallet, ArrowRight, Download, ImageDown } from "lucide-react";
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

const fmt = (n: number) => "\u20B9" + n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

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

  const totals = useMemo(() => {
    if (!salaries || salaries.length === 0) return { basic: 0, gross: 0, deductions: 0, netPay: 0, count: 0 };
    let basic = 0, gross = 0, deductions = 0, netPay = 0;
    salaries.forEach((s) => {
      basic += Number(s.basicWage) || 0;
      gross += Number(s.grossWage) || 0;
      deductions += Number(s.totalDeduction) || 0;
      netPay += Number(s.netPay) || 0;
    });
    return { basic, gross, deductions, netPay, count: salaries.length };
  }, [salaries]);

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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight" data-testid="text-salary-title">Salary Register (Form XVII)</h1>
            <p className="text-muted-foreground mt-1 text-xs sm:text-sm">Monthly salary register for all employees</p>
          </div>
          {loaded && salaries && salaries.length > 0 && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleDownloadAllJpeg}
                disabled={downloading}
                data-testid="button-download-all-jpeg"
              >
                {downloading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ImageDown className="w-4 h-4 mr-2" />}
                {downloading ? "Downloading..." : "Download All JPEG"}
              </Button>
              <Button variant="outline" onClick={() => window.print()} data-testid="button-print-salary">
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

        {loaded && salaries && salaries.length > 0 && (
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
              <Card data-testid="card-total-basic">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                      <IndianRupee className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Basic</p>
                      <p className="text-lg font-bold" data-testid="text-total-basic">{fmt(totals.basic)}</p>
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
                      <p className="text-lg font-bold" data-testid="text-total-gross">{fmt(totals.gross)}</p>
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
                      <p className="text-lg font-bold" data-testid="text-total-deductions">{fmt(totals.deductions)}</p>
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
                      <p className="text-xs text-muted-foreground">Total Net Pay</p>
                      <p className="text-lg font-bold" data-testid="text-total-net-pay">{fmt(totals.netPay)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="hidden md:block print:block">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Salary Register - {clientName} - {MONTHS[Number(month) - 1]} {year}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" data-testid="table-salary-register">
                      <thead>
                        <tr className="bg-muted/50 border-b">
                          <th className="px-3 py-2.5 text-left text-xs font-semibold">S.No</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold">Employee Name</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold">Days</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold">Basic</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold">DA</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold">HRA</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold">Gross</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold">PF</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold">ESIC</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold">PT</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold">Other Ded</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold">Total Ded</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold">Net Pay</th>
                          <th className="px-3 py-2.5 text-center text-xs font-semibold print:hidden">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {salaries.map((s, idx) => {
                          const emp = employeeMap.get(s.employeeId);
                          const otherDed = (Number(s.advanceDeduction) || 0) + (Number(s.fineDeduction) || 0) + (Number(s.otherDeduction) || 0);
                          return (
                            <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors" data-testid={`row-salary-${s.id}`}>
                              <td className="px-3 py-2.5 text-muted-foreground">{idx + 1}</td>
                              <td className="px-3 py-2.5 font-medium">{emp?.name || `Employee #${s.employeeId}`}</td>
                              <td className="px-3 py-2.5 text-right">{Number(s.daysWorked) || 0}</td>
                              <td className="px-3 py-2.5 text-right">{fmt(Number(s.basicWage) || 0)}</td>
                              <td className="px-3 py-2.5 text-right">{fmt(Number(s.da) || 0)}</td>
                              <td className="px-3 py-2.5 text-right">{fmt(Number(s.hra) || 0)}</td>
                              <td className="px-3 py-2.5 text-right font-medium">{fmt(Number(s.grossWage) || 0)}</td>
                              <td className="px-3 py-2.5 text-right">{fmt(Number(s.pfDeduction) || 0)}</td>
                              <td className="px-3 py-2.5 text-right">{fmt(Number(s.esicDeduction) || 0)}</td>
                              <td className="px-3 py-2.5 text-right">{fmt(Number(s.professionalTax) || 0)}</td>
                              <td className="px-3 py-2.5 text-right">{fmt(otherDed)}</td>
                              <td className="px-3 py-2.5 text-right text-red-600 dark:text-red-400">{fmt(Number(s.totalDeduction) || 0)}</td>
                              <td className="px-3 py-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">{fmt(Number(s.netPay) || 0)}</td>
                              <td className="px-3 py-2.5 text-center print:hidden">
                                <Link href={`/salary/${s.id}/slip`}>
                                  <Button variant="ghost" size="icon" data-testid={`button-view-slip-${s.id}`}>
                                    <ArrowRight className="w-4 h-4" />
                                  </Button>
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-muted/50 font-bold border-t-2">
                          <td className="px-3 py-2.5" colSpan={2}>Total</td>
                          <td className="px-3 py-2.5 text-right">{salaries.reduce((sum, s) => sum + (Number(s.daysWorked) || 0), 0)}</td>
                          <td className="px-3 py-2.5 text-right">{fmt(totals.basic)}</td>
                          <td className="px-3 py-2.5 text-right">{fmt(salaries.reduce((sum, s) => sum + (Number(s.da) || 0), 0))}</td>
                          <td className="px-3 py-2.5 text-right">{fmt(salaries.reduce((sum, s) => sum + (Number(s.hra) || 0), 0))}</td>
                          <td className="px-3 py-2.5 text-right">{fmt(totals.gross)}</td>
                          <td className="px-3 py-2.5 text-right">{fmt(salaries.reduce((sum, s) => sum + (Number(s.pfDeduction) || 0), 0))}</td>
                          <td className="px-3 py-2.5 text-right">{fmt(salaries.reduce((sum, s) => sum + (Number(s.esicDeduction) || 0), 0))}</td>
                          <td className="px-3 py-2.5 text-right">{fmt(salaries.reduce((sum, s) => sum + (Number(s.professionalTax) || 0), 0))}</td>
                          <td className="px-3 py-2.5 text-right">{fmt(salaries.reduce((sum, s) => sum + (Number(s.advanceDeduction) || 0) + (Number(s.fineDeduction) || 0) + (Number(s.otherDeduction) || 0), 0))}</td>
                          <td className="px-3 py-2.5 text-right text-red-600 dark:text-red-400">{fmt(totals.deductions)}</td>
                          <td className="px-3 py-2.5 text-right text-emerald-600 dark:text-emerald-400">{fmt(totals.netPay)}</td>
                          <td className="px-3 py-2.5 print:hidden"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="md:hidden print:hidden space-y-3">
              {salaries.map((s, idx) => {
                const emp = employeeMap.get(s.employeeId);
                return (
                  <Link key={s.id} href={`/salary/${s.id}/slip`}>
                    <Card className="hover-elevate" data-testid={`card-salary-mobile-${s.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">{idx + 1}</Badge>
                            <span className="font-medium text-sm">{emp?.name || `Employee #${s.employeeId}`}</span>
                          </div>
                          <ArrowRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <p className="text-muted-foreground">Days</p>
                            <p className="font-medium">{Number(s.daysWorked) || 0}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Gross</p>
                            <p className="font-medium">{fmt(Number(s.grossWage) || 0)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Net Pay</p>
                            <p className="font-bold text-emerald-600 dark:text-emerald-400">{fmt(Number(s.netPay) || 0)}</p>
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
