import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { User, Wallet, CalendarDays, LogOut, Printer, Building2, Phone, MapPin, Briefcase, IdCard } from 'lucide-react';
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
    let p = 0, a = 0, h = 0, wo = 0, ot = 0;
    for (let i = 1; i <= 31; i++) {
      const val = attendance[`day${i}`];
      if (!val) continue;
      if (val === 'P') p++;
      else if (val === 'A') a++;
      else if (val === 'H') h++;
      else if (val === 'WO') wo++;
      else if (['CL', 'SL', 'EL', 'PH'].includes(val)) ot++;
    }
    return { present: p, absent: a, holidays: h, weekOff: wo, leave: ot };
  })() : null;

  const handlePrintSlip = () => {
    if (!salary || !empInfo) return;
    const el = document.getElementById('emp-wage-slip');
    if (!el) return;
    const pw = window.open('', '_blank');
    if (!pw) return;
    pw.document.write(`<!DOCTYPE html><html><head><title>Wage Slip - ${empInfo.name}</title>
      <style>
        @page { size: A4 portrait; margin: 15mm; }
        body { margin: 0; padding: 20px; font-family: Arial, sans-serif; font-size: 12px; color: #000; }
        table { width: 100%; border-collapse: collapse; }
        td, th { border: 1px solid #333; padding: 5px 8px; text-align: left; }
        th { background: #f0f0f0; }
        .header { text-align: center; margin-bottom: 15px; }
        .header h3 { margin: 4px 0; }
        .amount { text-align: right; }
      </style>
    </head><body>${el.innerHTML}</body></html>`);
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
              <CardTitle className="text-base flex items-center gap-2"><User className="w-4 h-4 text-blue-600" /> Personal Details</CardTitle>
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
                <CalendarDays className="w-4 h-4 text-blue-600" /> Attendance & Salary
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
              <div className="overflow-x-auto mb-4">
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

            {salary ? (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-green-600" /> Salary - {monthNames[Number(selectedMonth)]} {selectedYear}
                  </h4>
                  <Button variant="outline" size="sm" onClick={handlePrintSlip} className="gap-2 text-xs" data-testid="button-print-slip">
                    <Printer className="w-3.5 h-3.5" /> Print Slip
                  </Button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Days Worked</p>
                    <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400" data-testid="text-days-worked">{salary.daysWorked}</p>
                  </div>
                  <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Gross Wage</p>
                    <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400" data-testid="text-gross">{fmtAmt(salary.grossWage)}</p>
                  </div>
                  <div className="bg-rose-50 dark:bg-rose-950/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Total Deduction</p>
                    <p className="text-lg font-bold text-rose-700 dark:text-rose-400" data-testid="text-deduction">{fmtAmt(salary.totalDeduction)}</p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Net Pay</p>
                    <p className="text-lg font-bold text-blue-700 dark:text-blue-400" data-testid="text-net-pay">{fmtAmt(salary.netPay)}</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2 bg-slate-50 dark:bg-slate-800/30 rounded"><span className="text-muted-foreground">Basic:</span> <span className="font-semibold">{fmtAmt(salary.basicWage)}</span></div>
                  <div className="p-2 bg-slate-50 dark:bg-slate-800/30 rounded"><span className="text-muted-foreground">DA:</span> <span className="font-semibold">{fmtAmt(salary.da)}</span></div>
                  <div className="p-2 bg-slate-50 dark:bg-slate-800/30 rounded"><span className="text-muted-foreground">HRA:</span> <span className="font-semibold">{fmtAmt(salary.hra)}</span></div>
                  <div className="p-2 bg-slate-50 dark:bg-slate-800/30 rounded"><span className="text-muted-foreground">OT:</span> <span className="font-semibold">{salary.overtimeHours}h = {fmtAmt(salary.overtimeAmount)}</span></div>
                  <div className="p-2 bg-slate-50 dark:bg-slate-800/30 rounded"><span className="text-muted-foreground">PF:</span> <span className="font-semibold">{fmtAmt(salary.pfDeduction)}</span></div>
                  <div className="p-2 bg-slate-50 dark:bg-slate-800/30 rounded"><span className="text-muted-foreground">ESIC:</span> <span className="font-semibold">{fmtAmt(salary.esicDeduction)}</span></div>
                  <div className="p-2 bg-slate-50 dark:bg-slate-800/30 rounded"><span className="text-muted-foreground">P.Tax:</span> <span className="font-semibold">{fmtAmt(salary.professionalTax)}</span></div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No salary record for {monthNames[Number(selectedMonth)]} {selectedYear}</p>
            )}
          </CardContent>
        </Card>

        {salary && empInfo && (
          <div id="emp-wage-slip" className="hidden">
            <div className="header">
              <h3>DJ HOSPITALITY & FACILITY MANAGEMENT PVT LTD</h3>
              <p>7 Crematorium Street, Kolkata - 700014</p>
              <p style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '14px' }}>WAGE SLIP - {monthNames[Number(selectedMonth)].toUpperCase()} {selectedYear}</p>
            </div>
            <table>
              <tbody>
                <tr><td><strong>Employee Code</strong></td><td>{empInfo.employeeCode}</td><td><strong>Name</strong></td><td>{empInfo.name}</td></tr>
                <tr><td><strong>Designation</strong></td><td>{empInfo.designation}</td><td><strong>Company</strong></td><td>{empInfo.clientName}</td></tr>
                <tr><td><strong>Days Worked</strong></td><td>{salary.daysWorked}</td><td><strong>Daily Rate</strong></td><td>{fmtAmt(empInfo.dailyRate)}</td></tr>
              </tbody>
            </table>
            <table style={{ marginTop: '10px' }}>
              <thead>
                <tr><th colSpan={2}>Earnings</th><th colSpan={2}>Deductions</th></tr>
              </thead>
              <tbody>
                <tr><td>Basic Wage</td><td className="amount">{fmtAmt(salary.basicWage)}</td><td>PF</td><td className="amount">{fmtAmt(salary.pfDeduction)}</td></tr>
                <tr><td>DA</td><td className="amount">{fmtAmt(salary.da)}</td><td>ESIC</td><td className="amount">{fmtAmt(salary.esicDeduction)}</td></tr>
                <tr><td>HRA</td><td className="amount">{fmtAmt(salary.hra)}</td><td>P. Tax</td><td className="amount">{fmtAmt(salary.professionalTax)}</td></tr>
                <tr><td>Overtime ({salary.overtimeHours}h)</td><td className="amount">{fmtAmt(salary.overtimeAmount)}</td><td><strong>Total Deduction</strong></td><td className="amount"><strong>{fmtAmt(salary.totalDeduction)}</strong></td></tr>
                <tr><td><strong>Gross Wage</strong></td><td className="amount"><strong>{fmtAmt(salary.grossWage)}</strong></td><td></td><td></td></tr>
              </tbody>
            </table>
            <table style={{ marginTop: '10px' }}>
              <tbody>
                <tr><td style={{ textAlign: 'right', fontSize: '16px' }}><strong>NET PAY: {fmtAmt(salary.netPay)}</strong></td></tr>
              </tbody>
            </table>
            <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
              <div><p>Employee Signature</p></div>
              <div><p>Authorized Signature</p></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
