import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { User, CalendarDays, LogOut, Download, Building2, Phone, MapPin, Briefcase, IdCard } from 'lucide-react';
import { useCurrentUser, useLogout } from '@/hooks/use-reports';
import { useState } from 'react';
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

export default function EmployeeDashboard() {
  const { data: user } = useCurrentUser();
  const logoutMutation = useLogout();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [selectedMonth, setSelectedMonth] = useState(String(currentMonth));

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

  const handleDownloadSlip = () => {
    if (!salary || !empInfo) return;
    const pw = window.open('', '_blank');
    if (!pw) return;
    pw.document.write(`<!DOCTYPE html><html><head><title>Wage Slip - ${empInfo.name} - ${monthNames[Number(selectedMonth)]} ${selectedYear}</title>
      <style>
        @page { size: A4 portrait; margin: 15mm; }
        body { margin: 0; padding: 20px; font-family: Arial, sans-serif; font-size: 12px; color: #000; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
        td, th { border: 1px solid #333; padding: 5px 8px; text-align: left; }
        th { background: #f0f0f0; }
        .header { text-align: center; margin-bottom: 15px; }
        .header h3 { margin: 4px 0; }
        .amount { text-align: right; }
        .net-pay { text-align: right; font-size: 16px; padding: 10px; }
        .sig { display: flex; justify-content: space-between; margin-top: 40px; font-size: 11px; }
      </style>
    </head><body>
      <div class="header">
        <h3>DJ HOSPITALITY & FACILITY MANAGEMENT PVT LTD</h3>
        <p>7 Crematorium Street, Kolkata - 700014</p>
        <p style="font-weight:bold;margin-top:10px;font-size:14px">WAGE SLIP - ${monthNames[Number(selectedMonth)].toUpperCase()} ${selectedYear}</p>
      </div>
      <table>
        <tr><td><b>Employee Code</b></td><td>${empInfo.employeeCode}</td><td><b>Name</b></td><td>${empInfo.name}</td></tr>
        <tr><td><b>Designation</b></td><td>${empInfo.designation}</td><td><b>Company</b></td><td>${empInfo.clientName}</td></tr>
        <tr><td><b>Days Worked</b></td><td>${salary.daysWorked}</td><td><b>Daily Rate</b></td><td>${fmtAmt(empInfo.dailyRate)}</td></tr>
      </table>
      <table>
        <thead><tr><th colspan="2">Earnings</th><th colspan="2">Deductions</th></tr></thead>
        <tbody>
          <tr><td>Basic Wage</td><td class="amount">${fmtAmt(salary.basicWage)}</td><td>PF</td><td class="amount">${fmtAmt(salary.pfDeduction)}</td></tr>
          <tr><td>DA</td><td class="amount">${fmtAmt(salary.da)}</td><td>ESIC</td><td class="amount">${fmtAmt(salary.esicDeduction)}</td></tr>
          <tr><td>HRA</td><td class="amount">${fmtAmt(salary.hra)}</td><td>P. Tax</td><td class="amount">${fmtAmt(salary.professionalTax)}</td></tr>
          <tr><td>Overtime (${salary.overtimeHours}h)</td><td class="amount">${fmtAmt(salary.overtimeAmount)}</td><td><b>Total Deduction</b></td><td class="amount"><b>${fmtAmt(salary.totalDeduction)}</b></td></tr>
          <tr><td><b>Gross Wage</b></td><td class="amount"><b>${fmtAmt(salary.grossWage)}</b></td><td></td><td></td></tr>
        </tbody>
      </table>
      <table><tr><td class="net-pay"><b>NET PAY: ${fmtAmt(salary.netPay)}</b></td></tr></table>
      <div class="sig"><div><p>Employee Signature</p></div><div><p>Authorized Signature</p></div></div>
    </body></html>`);
    pw.document.close();
    pw.onload = () => { pw.print(); pw.onafterprint = () => pw.close(); };
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
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
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
