import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { User, CalendarDays, LogOut, Download, Building2, Phone, MapPin, Briefcase, IdCard, Smartphone, X, Share } from 'lucide-react';
import { useCurrentUser, useLogout } from '@/hooks/use-reports';
import { useState, useEffect, useRef } from 'react';
import logoImg from '@assets/logo1_1771660912341.png';

interface EmployeeInfo {
  id: number;
  employeeCode: string;
  name: string;
  fatherName: string;
  designation: string;
  department: string;
  clientName: string;
  esicNo: string;
  pfNo: string;
  uanNo: string;
  aadhaarNo: string;
  panNo: string;
  bankName: string;
  accountNo: string;
  ifscCode: string;
  dailyRate: string;
  gender: string;
  dob: string;
  permanentAddress: string;
  localAddress: string;
  skills: string;
  mobile: string;
  joiningDate: string;
  isActive: boolean;
}

interface AttendanceRecord {
  id: number;
  month: number;
  year: number;
  [key: string]: any;
}

interface SalaryRecord {
  id: number;
  month: number;
  year: number;
  daysWorked: string;
  basicWage: string;
  da: string;
  hra: string;
  grossWage: string;
  pfDeduction: string;
  esicDeduction: string;
  professionalTax: string;
  totalDeduction: string;
  netPay: string;
  overtimeHours: string;
  overtimeAmount: string;
}

const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function fmtDate(d: string | null) {
  if (!d) return '—';
  return d.split('-').reverse().join('-');
}

function fmtAmt(n: string | number) {
  const v = Number(n || 0);
  return '₹' + v.toLocaleString('en-IN');
}

function numberToWords(num: number): string {
  if (num === 0) return "Zero Only";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const scales = ["", "Thousand", "Lakh", "Crore"];
  const n2 = Math.floor(Math.abs(num));
  if (n2 === 0) return "Zero Only";
  const groups: number[] = [];
  let remaining = n2;
  groups.push(remaining % 1000);
  remaining = Math.floor(remaining / 1000);
  while (remaining > 0) { groups.push(remaining % 100); remaining = Math.floor(remaining / 100); }
  function twoDigit(x: number): string { if (x < 20) return ones[x]; return tens[Math.floor(x / 10)] + (x % 10 ? " " + ones[x % 10] : ""); }
  function threeDigit(x: number): string { if (x === 0) return ""; if (x < 100) return twoDigit(x); return ones[Math.floor(x / 100)] + " Hundred" + (x % 100 ? " " + twoDigit(x % 100) : ""); }
  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) { const g = groups[i]; if (g === 0) continue; const word = i === 0 ? threeDigit(g) : twoDigit(g); parts.push(word + (scales[i] ? " " + scales[i] : "")); }
  return "Rupees " + parts.join(" ") + " Only";
}

export default function EmployeeDashboard() {
  const { data: user } = useCurrentUser();
  const logoutMutation = useLogout();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [selectedMonth, setSelectedMonth] = useState(String(currentMonth));

  const deferredPrompt = useRef<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    if (!user) return;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    if (isStandalone) return;

    const dismissKey = `pwa-install-dismissed:${user.id}`;
    const dismissed = localStorage.getItem(dismissKey);
    if (dismissed) return;

    const ua = navigator.userAgent;
    const isiOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    if (isiOS) {
      setIsIos(true);
      setShowInstallBanner(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e;
      setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [user]);

  const handleInstall = async () => {
    if (deferredPrompt.current) {
      deferredPrompt.current.prompt();
      const result = await deferredPrompt.current.userChoice;
      if (result.outcome === 'accepted') {
        setShowInstallBanner(false);
      }
      deferredPrompt.current = null;
    }
  };

  const dismissInstallBanner = () => {
    setShowInstallBanner(false);
    if (user) {
      localStorage.setItem(`pwa-install-dismissed:${user.id}`, 'true');
    }
  };

  const { data: empInfo } = useQuery<EmployeeInfo>({
    queryKey: ['/api/employee/me'],
    enabled: !!user?.employeeId,
  });

  const { data: attendance } = useQuery<AttendanceRecord>({
    queryKey: ['/api/employee/me/attendance', selectedMonth, selectedYear],
    queryFn: async () => {
      const res = await fetch(`/api/employee/me/attendance?month=${selectedMonth}&year=${selectedYear}`, { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user?.employeeId,
  });

  const { data: salary } = useQuery<SalaryRecord>({
    queryKey: ['/api/employee/me/salary', selectedMonth, selectedYear],
    queryFn: async () => {
      const res = await fetch(`/api/employee/me/salary?month=${selectedMonth}&year=${selectedYear}`, { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user?.employeeId,
  });

  const attendanceSummary = attendance ? (() => {
    let p = 0, a = 0, h = 0, wo = 0, leave = 0;
    for (let i = 1; i <= 31; i++) {
      const val = attendance[`day${i}`];
      if (!val) continue;
      if (val === 'P') p++;
      else if (val === 'A') a++;
      else if (val === 'H') h++;
      else if (val === 'WO') wo++;
      else if (['CL', 'SL', 'EL', 'PH'].includes(val)) leave++;
    }
    return { present: p, absent: a, holidays: h, weekOff: wo, leave };
  })() : null;

  const handleDownloadSlip = async () => {
    if (!salary || !empInfo) return;
    const html2pdf = (await import('html2pdf.js')).default;

    const nv = (v: string | number | null | undefined) => Number(v) || 0;
    const basicRate = nv(empInfo.dailyRate);
    const basic = nv(salary.basicWage);
    const fixedHRA = nv(salary.hra);
    const otAllow = nv(salary.overtimeAmount);
    const totalGross = nv(salary.grossWage);
    const esicDed = nv(salary.esicDeduction);
    const pTax = nv(salary.professionalTax);
    const pfDed = nv(salary.pfDeduction);
    const totalDedu = nv(salary.totalDeduction);
    const netSalary = nv(salary.netPay);
    const otHrs = nv(salary.overtimeHours);
    const paidDays = nv(salary.daysWorked);

    let prsDays = paidDays, holidays = 0, leave = 0;
    if (attendance) {
      prsDays = nv(attendance.totalPresent) || paidDays;
      leave = nv(attendance.totalAbsent);
      for (let i = 1; i <= 31; i++) {
        const val = attendance[`day${i}`];
        if (val === "H" || val === "WO" || val === "PH") holidays++;
      }
    }

    const formatDt = (d: string | null | undefined) => {
      if (!d) return "-";
      try { const dt = new Date(d); const dd = String(dt.getDate()).padStart(2, "0"); const mm = String(dt.getMonth() + 1).padStart(2, "0"); return `${dd}-${mm}-${dt.getFullYear()}`; } catch { return d; }
    };

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
    const cp = "padding:5px 8px;";

    const container = document.createElement('div');
    container.innerHTML = `
      <table style="width:100%;border-collapse:collapse;font-size:13px;font-family:Inter,Segoe UI,Arial,sans-serif;">
        <tbody>
          <tr>
            <td colspan="8" style="background:${C.headerGrad};color:#fff;text-align:center;padding:14px 8px 10px;border:none;">
              <div style="font-size:17px;font-weight:800;letter-spacing:0.5px;">DJ HOSPITALITY & FACILITY MANAGEMENT PVT LTD</div>
              <div style="font-size:10px;opacity:0.85;margin-top:2px;">Regd. & Head Office: 730, Tin Made, Sodiem Siolim, Mapusa Bardez, North Goa-403502, India</div>
              <div style="font-size:10px;opacity:0.85;">Branch Office: 7 Crimatorium Street, Kolkata- 700014</div>
              <div style="margin-top:8px;font-size:15px;font-weight:700;letter-spacing:1px;background:rgba(255,255,255,0.15);display:inline-block;padding:3px 20px;border-radius:4px;">Form - XIX Wages Slip</div>
              <div style="font-size:10px;opacity:0.7;margin-top:2px;">[See rule 78(1)(b)]</div>
            </td>
          </tr>
          <tr>
            <td colspan="8" style="background:${C.periodGrad};color:#fff;text-align:center;padding:10px;font-size:20px;font-weight:800;letter-spacing:2px;border:none;">
              ${monthNames[Number(selectedMonth)].toUpperCase()} - ${selectedYear}
            </td>
          </tr>
          <tr>
            <td style="background:${C.infoLabelBg};color:${C.infoLabelColor};font-weight:700;border:${b};${cp}" colspan="2">Company Name</td>
            <td style="font-weight:700;font-size:14px;color:#1a237e;border:${b};${cp}" colspan="6">${empInfo.clientName}</td>
          </tr>
          <tr>
            <td style="background:${C.infoLabelBg};color:${C.infoLabelColor};font-weight:600;border:${b};${cp}" colspan="2">Location of work</td>
            <td colspan="6" style="font-size:12px;border:${b};${cp}">Khidirpur Factory, 1, Transport depot Rd, Goragacha Rood, Kolkata - 700110</td>
          </tr>
          <tr>
            <td style="background:${C.infoLabelBg};color:${C.infoLabelColor};font-weight:700;border:${b};${cp}" colspan="2">Name:</td>
            <td colspan="6" style="font-size:16px;font-weight:800;color:#1a237e;border:${b};${cp}">${empInfo.name}</td>
          </tr>
          <tr>
            <td style="background:${C.infoLabelBg};color:${C.infoLabelColor};font-weight:600;white-space:nowrap;border:${b};${cp}" colspan="2">Father's / Husband's :</td>
            <td colspan="3" style="border:${b};${cp}">${empInfo.fatherName || "-"}</td>
            <td style="background:${C.infoLabelBg};color:${C.infoLabelColor};font-weight:600;white-space:nowrap;border:${b};${cp}">Skills:</td>
            <td colspan="2" style="border:${b};${cp}">${empInfo.designation || "Unskilled"}</td>
          </tr>
          <tr>
            <td style="background:${C.infoLabelBg};color:${C.infoLabelColor};font-weight:600;white-space:nowrap;border:${b};${cp}" colspan="2">Date Of Birth</td>
            <td colspan="3" style="border:${b};${cp}">${formatDt(empInfo.dob)}</td>
            <td style="background:${C.infoLabelBg};color:${C.infoLabelColor};font-weight:600;white-space:nowrap;border:${b};${cp}">Joining Date :</td>
            <td colspan="2" style="border:${b};${cp}">${formatDt(empInfo.joiningDate)}</td>
          </tr>
          <tr>
            <td style="background:#ede7f6;color:#4a148c;font-weight:600;white-space:nowrap;border:${b};${cp}" colspan="2">ESIC No.:</td>
            <td colspan="3" style="font-family:monospace;font-size:12px;color:#4a148c;border:${b};${cp}">${empInfo.esicNo || "-"}</td>
            <td style="background:#ede7f6;color:#4a148c;font-weight:600;white-space:nowrap;border:${b};${cp}">UAN:</td>
            <td colspan="2" style="font-family:monospace;font-size:12px;color:#4a148c;border:${b};${cp}">${empInfo.uanNo || "-"}</td>
          </tr>
          <tr>
            <td style="background:#ede7f6;color:#4a148c;font-weight:600;white-space:nowrap;border:${b};${cp}" colspan="2">PF No.:</td>
            <td colspan="3" style="font-family:monospace;font-size:12px;color:#4a148c;border:${b};${cp}">${empInfo.pfNo || "-"}</td>
            <td style="background:#ede7f6;color:#4a148c;font-weight:600;white-space:nowrap;border:${b};${cp}">Mobile No:</td>
            <td colspan="2" style="border:${b};${cp}">${empInfo.mobile || "-"}</td>
          </tr>
          <tr>
            <td style="background:#e0f2f1;color:#004d40;font-weight:600;white-space:nowrap;border:${b};${cp}" colspan="2">Bank Name:</td>
            <td colspan="3" style="color:#00695c;border:${b};${cp}">${empInfo.bankName || "-"}</td>
            <td style="background:#e0f2f1;color:#004d40;font-weight:600;white-space:nowrap;border:${b};${cp}">IFSC Code :</td>
            <td colspan="2" style="font-family:monospace;font-size:12px;color:#00695c;border:${b};${cp}">${empInfo.ifscCode || "-"}</td>
          </tr>
          <tr>
            <td style="background:#e0f2f1;color:#004d40;font-weight:600;white-space:nowrap;border:${b};${cp}" colspan="2">Bank Account No.:</td>
            <td colspan="3" style="font-family:monospace;font-size:12px;color:#00695c;border:${b};${cp}">${empInfo.accountNo || "-"}</td>
            <td style="background:#e0f2f1;color:#004d40;font-weight:600;white-space:nowrap;border:${b};${cp}">Pay. Date:</td>
            <td colspan="2" style="border:${b};${cp}">-</td>
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
            <td style="text-align:right;font-weight:700;color:${C.earnValColor};border:${b};${cp}">${nv(salary.da)}</td>
            <td style="background:${C.dedLabelBg};color:${C.dedLabelColor};font-weight:600;border:${b};${cp}" colspan="2">PF @12%</td>
            <td style="text-align:right;font-weight:700;color:${C.dedValColor};border:${b};${cp}">${pfDed}</td>
          </tr>
          <tr>
            <td style="background:${C.attLabelBg};color:${C.attLabelColor};font-weight:600;border:${b};${cp}">LEAVE</td>
            <td style="text-align:right;font-weight:700;color:${C.attValColor};border:${b};${cp}">${leave}</td>
            <td style="background:${C.earnLabelBg};color:${C.earnLabelColor};font-weight:600;border:${b};${cp}" colspan="2">HRA 5%</td>
            <td style="text-align:right;font-weight:700;color:${C.earnValColor};border:${b};${cp}">${Math.round(basic * 0.05)}</td>
            <td style="background:${C.dedLabelBg};color:${C.dedLabelColor};font-weight:600;border:${b};${cp}" colspan="2">LWF</td>
            <td style="text-align:right;font-weight:700;color:${C.dedValColor};border:${b};${cp}">${nv(salary.lwf)}</td>
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
            <td style="text-align:right;font-weight:700;color:${C.earnValColor};border:${b};${cp}">${otAllow}</td>
            <td style="background:#fff8e1;color:#e65100;font-weight:600;font-size:11px;border:${b};${cp}" colspan="2">Leave Balance ${selectedYear}</td>
            <td style="text-align:right;font-weight:700;color:#e65100;border:${b};${cp}">0</td>
          </tr>
          <tr>
            <td style="background:${C.attLabelBg};color:${C.attLabelColor};font-weight:600;border:${b};${cp}">OT HRS</td>
            <td style="text-align:right;font-weight:700;color:${C.attValColor};border:${b};${cp}">${otHrs}</td>
            <td style="background:${C.earnLabelBg};color:${C.earnLabelColor};font-weight:700;border:${b};${cp}" colspan="2">Total Gross</td>
            <td style="text-align:right;font-weight:800;color:#fff;background:#2e7d32;font-size:14px;border:${b};${cp}">${totalGross}</td>
            <td style="background:#fff8e1;color:#e65100;font-weight:600;font-size:10px;border:${b};${cp}" colspan="2">Leave Encashment Amt. ${selectedYear}</td>
            <td style="text-align:right;font-weight:700;color:#e65100;border:${b};${cp}">0</td>
          </tr>
          <tr>
            <td style="background:${C.attLabelBg};color:${C.attLabelColor};font-weight:600;border:${b};${cp}"></td>
            <td style="border:${b};${cp}"></td>
            <td style="background:${C.earnLabelBg};border:${b};${cp}" colspan="2"></td>
            <td style="border:${b};${cp}"></td>
            <td style="background:${C.netBg};color:#fff;font-weight:800;font-size:13px;letter-spacing:1px;border:${b};${cp}" colspan="2">NET SALARY</td>
            <td style="background:${C.netBg};color:#fff;text-align:right;font-weight:900;font-size:18px;letter-spacing:0.5px;border:${b};${cp}">₹${netSalary.toLocaleString("en-IN")}</td>
          </tr>

          <tr>
            <td style="background:${C.wordsBg};color:${C.wordsColor};font-weight:700;border:${b};${cp}" colspan="2">Net Salary in Words</td>
            <td style="background:${C.wordsBg};color:${C.wordsColor};font-weight:700;font-style:italic;font-size:13px;border:${b};${cp}" colspan="6">${numberToWords(netSalary)}</td>
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
      </table>`;

    const opt = {
      margin: 10,
      filename: `WageSlip_${empInfo.name.replace(/\s+/g, '_')}_${monthNames[Number(selectedMonth)]}_${selectedYear}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    };
    await html2pdf().set(opt).from(container).save();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <header className="bg-white dark:bg-slate-900 shadow-sm border-b border-blue-100 dark:border-slate-700 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoImg} alt="DJ" className="w-10 h-10 rounded-xl object-cover shadow" />
            <div>
              <h1 className="text-lg font-bold text-slate-800 dark:text-slate-200" data-testid="text-emp-name">{user?.displayName}</h1>
              <p className="text-xs text-muted-foreground">{empInfo?.designation || 'Employee'} • {empInfo?.clientName}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => logoutMutation.mutate()} className="gap-2" data-testid="button-logout">
            <LogOut className="w-4 h-4" /> Logout
          </Button>
        </div>
      </header>

      {showInstallBanner && (
        <div className="max-w-5xl mx-auto px-4 pt-4">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-4 shadow-lg text-white relative" data-testid="banner-install-app">
            <button onClick={dismissInstallBanner} className="absolute top-2 right-2 p-1 rounded-full hover:bg-white/20 transition" data-testid="button-dismiss-install">
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Smartphone className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm">Install DJ Hospitality App</h3>
                <p className="text-xs text-blue-100 mt-0.5">
                  {isIos
                    ? 'Tap the Share button below, then "Add to Home Screen"'
                    : 'Install this app on your phone for quick access'}
                </p>
              </div>
            </div>
            {isIos ? (
              <div className="mt-3 flex items-center justify-center gap-2 bg-white/10 rounded-lg p-2 text-xs">
                <span>Tap</span>
                <Share className="w-4 h-4" />
                <span>then "Add to Home Screen"</span>
              </div>
            ) : (
              <Button
                onClick={handleInstall}
                className="mt-3 w-full bg-white text-blue-700 hover:bg-blue-50 font-bold shadow"
                size="sm"
                data-testid="button-install-app"
              >
                <Download className="w-4 h-4 mr-2" /> Install App
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {empInfo && (
          <Card className="border-blue-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><User className="w-4 h-4 text-blue-600" /> Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                <div className="flex items-start gap-2">
                  <IdCard className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Employee Code</p>
                    <p className="font-semibold" data-testid="text-emp-code">{empInfo.employeeCode}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <User className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Father's Name</p>
                    <p className="font-semibold">{empInfo.fatherName || '—'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Building2 className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Company</p>
                    <p className="font-semibold">{empInfo.clientName}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Briefcase className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Designation</p>
                    <p className="font-semibold">{empInfo.designation || '—'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Phone className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Mobile</p>
                    <p className="font-semibold">{empInfo.mobile || '—'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CalendarDays className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Joining Date</p>
                    <p className="font-semibold">{fmtDate(empInfo.joiningDate)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Permanent Address</p>
                    <p className="font-semibold text-xs">{empInfo.permanentAddress || '—'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Local Address</p>
                    <p className="font-semibold text-xs">{empInfo.localAddress || '—'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Briefcase className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Skills</p>
                    <p className="font-semibold">{empInfo.skills || '—'}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
                <p className="text-xs text-muted-foreground mb-2 font-semibold">Government IDs & Bank</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
                  <div><span className="text-muted-foreground">PF No:</span> <span className="font-medium">{empInfo.pfNo || '—'}</span></div>
                  <div><span className="text-muted-foreground">ESIC:</span> <span className="font-medium">{empInfo.esicNo || '—'}</span></div>
                  <div><span className="text-muted-foreground">UAN:</span> <span className="font-medium">{empInfo.uanNo || '—'}</span></div>
                  <div><span className="text-muted-foreground">Aadhaar:</span> <span className="font-medium">{empInfo.aadhaarNo || '—'}</span></div>
                  <div><span className="text-muted-foreground">PAN:</span> <span className="font-medium">{empInfo.panNo || '—'}</span></div>
                  <div><span className="text-muted-foreground">Bank:</span> <span className="font-medium">{empInfo.bankName || '—'}</span></div>
                  <div><span className="text-muted-foreground">A/C:</span> <span className="font-medium">{empInfo.accountNo || '—'}</span></div>
                  <div><span className="text-muted-foreground">IFSC:</span> <span className="font-medium">{empInfo.ifscCode || '—'}</span></div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-blue-200 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-blue-600" /> Attendance
              </CardTitle>
              <div className="flex gap-2 items-end">
                <div className="space-y-1">
                  <Label className="text-xs">Month</Label>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="w-[130px] h-8 text-xs" data-testid="select-month"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {monthNames.slice(1).map((m, i) => (
                        <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Year</Label>
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger className="w-[90px] h-8 text-xs" data-testid="select-year"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 5 }, (_, i) => currentYear - 2 + i).map(y => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {attendanceSummary ? (
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-4">
                <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-700 dark:text-green-400" data-testid="text-present">{attendanceSummary.present}</p>
                  <p className="text-xs text-green-600">Present</p>
                </div>
                <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-red-700 dark:text-red-400" data-testid="text-absent">{attendanceSummary.absent}</p>
                  <p className="text-xs text-red-600">Absent</p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{attendanceSummary.holidays}</p>
                  <p className="text-xs text-amber-600">Holidays</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{attendanceSummary.weekOff}</p>
                  <p className="text-xs text-blue-600">Week Off</p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">{attendanceSummary.leave}</p>
                  <p className="text-xs text-purple-600">Leave</p>
                </div>
                <div className="bg-cyan-50 dark:bg-cyan-950/30 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-cyan-700 dark:text-cyan-400" data-testid="text-attendance-ot">{salary ? (salary.overtimeHours || '0') : '0'}h</p>
                  <p className="text-xs text-cyan-600">Overtime</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No attendance record for {monthNames[Number(selectedMonth)]} {selectedYear}</p>
            )}

            {attendance && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse" data-testid="table-attendance">
                  <thead>
                    <tr>
                      {Array.from({ length: 31 }, (_, i) => (
                        <th key={i} className="border border-slate-200 px-1.5 py-1 text-center bg-slate-50 dark:bg-slate-800 min-w-[28px]">{i + 1}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {Array.from({ length: 31 }, (_, i) => {
                        const val = attendance[`day${i + 1}`] || '';
                        let bg = '';
                        if (val === 'P') bg = 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
                        else if (val === 'A') bg = 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
                        else if (val === 'H' || val === 'WO') bg = 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300';
                        else if (val) bg = 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300';
                        return <td key={i} className={`border border-slate-200 px-1 py-1 text-center font-medium ${bg}`}>{val}</td>;
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {salary && (
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">{monthNames[Number(selectedMonth)]} {selectedYear} — Salary Summary</h4>
                <div className="grid grid-cols-3 sm:grid-cols-3 gap-2 mb-3 text-xs">
                  <div className="bg-slate-50 dark:bg-slate-800/40 rounded-lg p-2 text-center">
                    <p className="font-bold text-slate-700 dark:text-slate-300" data-testid="text-basic-wage">{fmtAmt(salary.basicWage)}</p>
                    <p className="text-[10px] text-slate-500">Basic Wage</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/40 rounded-lg p-2 text-center">
                    <p className="font-bold text-slate-700 dark:text-slate-300" data-testid="text-hra">{fmtAmt(salary.hra)}</p>
                    <p className="text-[10px] text-slate-500">HRA</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/40 rounded-lg p-2 text-center">
                    <p className="font-bold text-slate-700 dark:text-slate-300">{salary.daysWorked} days</p>
                    <p className="text-[10px] text-slate-500">Days Worked</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-3">
                  <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400" data-testid="text-total-salary">{fmtAmt(salary.grossWage)}</p>
                    <p className="text-xs text-emerald-600">Gross Salary</p>
                  </div>
                  <div className="bg-cyan-50 dark:bg-cyan-950/30 rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-cyan-700 dark:text-cyan-400" data-testid="text-overtime">{salary.overtimeHours || '0'}h = {fmtAmt(salary.overtimeAmount)}</p>
                    <p className="text-xs text-cyan-600">Overtime</p>
                  </div>
                  <div className="bg-rose-50 dark:bg-rose-950/30 rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-rose-700 dark:text-rose-400" data-testid="text-pf">{fmtAmt(salary.pfDeduction)}</p>
                    <p className="text-xs text-rose-600">PF Deduction</p>
                  </div>
                  <div className="bg-orange-50 dark:bg-orange-950/30 rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-orange-700 dark:text-orange-400" data-testid="text-esic">{fmtAmt(salary.esicDeduction)}</p>
                    <p className="text-xs text-orange-600">ESIC Deduction</p>
                  </div>
                  <div className="bg-violet-50 dark:bg-violet-950/30 rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-violet-700 dark:text-violet-400" data-testid="text-ptax">{fmtAmt(salary.professionalTax)}</p>
                    <p className="text-xs text-violet-600">P.Tax Deduction</p>
                  </div>
                </div>
                <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3">
                  <div>
                    <p className="text-xs text-blue-600">Net Pay (after deductions)</p>
                    <p className="text-xl font-bold text-blue-700 dark:text-blue-400" data-testid="text-net-pay">{fmtAmt(salary.netPay)}</p>
                  </div>
                  <Button onClick={handleDownloadSlip} className="gap-2" data-testid="button-download-slip">
                    <Download className="w-4 h-4" /> Download Pay Slip
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
