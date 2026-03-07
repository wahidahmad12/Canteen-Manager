import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '@/components/layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Printer, ArrowLeft, Users, Building2, Gift, Download } from 'lucide-react';
import { useClientNames } from '@/hooks/use-reports';
import { Link } from 'wouter';
import type { Employee } from '@shared/schema';

interface SalaryRecord {
  id: number;
  employeeId: number;
  month: number;
  year: number;
  daysWorked: string;
  grossWage: string;
  basicWage: string;
}

const BONUS_RATE = 8.33;

export default function BonusReturn() {
  const { data: clientNames = [] } = useClientNames();
  const [selectedClient, setSelectedClient] = useState('');
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const defaultFYStart = currentMonth >= 4 ? currentYear : currentYear - 1;
  const [fyStartYear, setFyStartYear] = useState(String(defaultFYStart));
  const [bonusDate, setBonusDate] = useState('');
  const [workingDays, setWorkingDays] = useState('');
  const [refNumber, setRefNumber] = useState('');
  const [letterDate, setLetterDate] = useState('');

  const fyStart = Number(fyStartYear);
  const fyEnd = fyStart + 1;
  const fyLabel = `1st April, ${fyStart} to 31st March, ${fyEnd}`;

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ['/api/employees', selectedClient],
    queryFn: async () => {
      const res = await fetch(`/api/employees?clientName=${encodeURIComponent(selectedClient)}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    enabled: !!selectedClient,
  });

  const { data: annualSalary = [], isLoading } = useQuery<SalaryRecord[]>({
    queryKey: ['/api/salary/annual', selectedClient, fyStart],
    queryFn: async () => {
      const res = await fetch(`/api/salary/annual?clientName=${encodeURIComponent(selectedClient)}&fyStart=${fyStart}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    enabled: !!selectedClient && !!fyStart,
  });

  const activeEmployees = employees.filter(e => e.isActive);

  const bonusRows = activeEmployees.map((emp, idx) => {
    const empSalaries = annualSalary.filter(s => s.employeeId === emp.id);
    const totalDaysWorked = empSalaries.reduce((sum, s) => sum + Number(s.daysWorked || 0), 0);
    const totalSalary = empSalaries.reduce((sum, s) => sum + Number(s.grossWage || 0), 0);
    const bonusAmount = Math.round(totalSalary * BONUS_RATE / 100);
    const skillLevel = getSkillLevel(emp.designation || '');

    return {
      slNo: idx + 1,
      name: emp.name,
      fatherName: emp.fatherName || '-',
      under15: 'No',
      designation: skillLevel,
      daysWorked: Math.round(totalDaysWorked),
      totalSalary: Math.round(totalSalary),
      bonusPayable: bonusAmount,
      pujaBonus: 'No',
      interimBonus: 'No',
      incomeTax: 'No',
      misconduct: 'No',
      totalDeductions: 'No',
      netAmount: bonusAmount,
      actualPaid: bonusAmount,
      datePaid: bonusDate ? bonusDate.split('-').reverse().join('-') : '-',
    };
  }).filter(r => r.totalSalary > 0);

  const totalBonus = bonusRows.reduce((s, r) => s + r.netAmount, 0);

  const handlePrint = () => {
    const printArea = document.getElementById('bonus-print-area');
    if (!printArea) return;
    const prevTitle = document.title;
    document.title = `Form C - Bonus Return - ${selectedClient} - FY ${fyStart}-${fyEnd}`;

    const printWindow = window.open('', '_blank');
    if (!printWindow) { document.title = prevTitle; return; }

    printWindow.document.write(`<!DOCTYPE html><html><head><title>${document.title}</title>
      <style>
        @page portrait-page { size: A4 portrait; margin: 20mm; }
        @page landscape-page { size: A4 landscape; margin: 8mm; }
        body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
        .cover-letter-page { page: portrait-page; break-after: page; }
        .form-c-page { page: landscape-page; break-before: page; }
        .form-c-page table { width: 100%; table-layout: auto; font-size: 8px; border-collapse: collapse; }
        .form-c-page table th, .form-c-page table td { padding: 2px 3px !important; }
        .form-c-page { font-size: 9px; }
        p { margin: 4px 0; }
      </style>
    </head><body>${printArea.innerHTML}</body></html>`);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
      printWindow.onafterprint = () => printWindow.close();
    };
    document.title = prevTitle;
  };

  const handleExportExcel = async () => {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Bonus Return Form C");

    const headerFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF1A237E" } };
    const headerFont = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
    const subHeaderFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFE8EAF6" } };
    const subHeaderFont = { bold: true, color: { argb: "FF1A237E" }, size: 10 };
    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" },
    };

    const totalCols = 16;

    ws.mergeCells(1, 1, 1, totalCols);
    const r1 = ws.getRow(1);
    r1.getCell(1).value = "FORM C";
    r1.getCell(1).font = { bold: true, size: 16, color: { argb: "FF1A237E" } };
    r1.getCell(1).alignment = { horizontal: "center" };
    r1.height = 28;

    ws.mergeCells(2, 1, 2, totalCols);
    ws.getRow(2).getCell(1).value = "[See rule 4 (c)]";
    ws.getRow(2).getCell(1).font = { size: 11 };
    ws.getRow(2).getCell(1).alignment = { horizontal: "center" };

    ws.mergeCells(3, 1, 3, totalCols);
    ws.getRow(3).getCell(1).value = `BONUS PAID TO EMPLOYEES FOR THE ACCOUNTING YEAR ENDING ON THE ${fyLabel}`;
    ws.getRow(3).getCell(1).font = { bold: true, size: 11 };
    ws.getRow(3).getCell(1).alignment = { horizontal: "center" };

    ws.mergeCells(4, 1, 4, totalCols);
    ws.getRow(4).getCell(1).value = `Name of the establishment: DJ Hospitality & Facility Management Pvt Ltd — ${selectedClient}`;
    ws.getRow(4).getCell(1).font = { bold: true, size: 10 };
    ws.getRow(4).getCell(1).alignment = { horizontal: "center" };

    ws.mergeCells(5, 1, 5, totalCols);
    ws.getRow(5).getCell(1).value = `No. of working days in the year: ${workingDays || '-'}`;
    ws.getRow(5).getCell(1).alignment = { horizontal: "center" };

    const colHeaders = [
      "Sl. No.", "Name of the employee", "Father's name",
      "Whether completed 15 yrs", "Designation", "No. of days worked",
      "Total salary/wage", "Bonus payable (8.33%)",
      "Puja bonus", "Interim bonus", "[10A] Income tax", "Misconduct deduction",
      "Total deductions", "Net Amount Payable", "Amount actually paid",
      "Date on which paid"
    ];

    const headerRow = ws.getRow(7);
    colHeaders.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.border = thinBorder;
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    });
    headerRow.height = 50;

    const colNumRow = ws.getRow(8);
    for (let i = 1; i <= 16; i++) {
      const cell = colNumRow.getCell(i);
      cell.value = i;
      cell.fill = subHeaderFill;
      cell.font = subHeaderFont;
      cell.border = thinBorder;
      cell.alignment = { horizontal: "center" };
    }

    bonusRows.forEach((row, idx) => {
      const r = ws.getRow(9 + idx);
      const vals = [
        row.slNo, row.name, row.fatherName, row.under15, row.designation,
        row.daysWorked, row.totalSalary, row.bonusPayable,
        row.pujaBonus, row.interimBonus, row.incomeTax, row.misconduct,
        row.totalDeductions, row.netAmount, row.actualPaid, row.datePaid,
      ];
      vals.forEach((v, i) => {
        const cell = r.getCell(i + 1);
        cell.value = v;
        cell.border = thinBorder;
        cell.alignment = { horizontal: typeof v === "number" ? "right" : "left", vertical: "middle" };
        if (idx % 2 === 0) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F7FF" } };
        }
      });
    });

    ws.columns = [
      { width: 8 }, { width: 25 }, { width: 25 }, { width: 12 }, { width: 14 },
      { width: 12 }, { width: 14 }, { width: 14 }, { width: 10 }, { width: 10 },
      { width: 10 }, { width: 10 }, { width: 10 }, { width: 14 }, { width: 14 }, { width: 14 },
    ];

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Form_C_Bonus_${selectedClient}_${fyStart}-${fyEnd}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2" data-testid="text-title">
                <Gift className="w-5 h-5 text-amber-600" />
                Bonus Return (Form C)
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">[See rule 4 (c)] — Payment of Bonus Act, 1965</p>
            </div>
          </div>
          {selectedClient && bonusRows.length > 0 && (
            <div className="flex gap-2">
              <Button onClick={handleExportExcel} variant="outline" size="sm" className="gap-2" data-testid="button-export-excel">
                <Download className="w-4 h-4" /> Excel
              </Button>
              <Button onClick={handlePrint} variant="outline" size="sm" className="gap-2" data-testid="button-print">
                <Printer className="w-4 h-4" /> Print / PDF
              </Button>
            </div>
          )}
        </div>

        <Card className="no-print border-amber-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-end flex-wrap">
              <div className="space-y-2 min-w-[200px]">
                <Label className="text-xs font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5" /> Company / Client
                </Label>
                <Select value={selectedClient} onValueChange={setSelectedClient}>
                  <SelectTrigger data-testid="select-client">
                    <SelectValue placeholder="Select Company" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientNames.map(c => (
                      <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 min-w-[140px]">
                <Label className="text-xs font-semibold text-amber-700 dark:text-amber-300">Accounting Year (Start)</Label>
                <Select value={fyStartYear} onValueChange={setFyStartYear}>
                  <SelectTrigger data-testid="select-fy">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 5 }, (_, i) => currentYear - 2 + i).map(y => (
                      <SelectItem key={y} value={String(y)}>{`Apr ${y} – Mar ${y + 1}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 min-w-[120px]">
                <Label className="text-xs font-semibold text-amber-700 dark:text-amber-300">Working Days</Label>
                <Input
                  type="number"
                  value={workingDays}
                  onChange={e => setWorkingDays(e.target.value)}
                  placeholder="e.g. 3532"
                  data-testid="input-working-days"
                />
              </div>
              <div className="space-y-2 min-w-[140px]">
                <Label className="text-xs font-semibold text-amber-700 dark:text-amber-300">Bonus Payment Date</Label>
                <Input
                  type="date"
                  value={bonusDate}
                  onChange={e => setBonusDate(e.target.value)}
                  data-testid="input-bonus-date"
                />
              </div>
              <div className="space-y-2 min-w-[180px]">
                <Label className="text-xs font-semibold text-amber-700 dark:text-amber-300">Ref. Number</Label>
                <Input
                  type="text"
                  value={refNumber}
                  onChange={e => setRefNumber(e.target.value)}
                  placeholder="e.g. DJ/KOL/25/0261"
                  data-testid="input-ref-number"
                />
              </div>
              <div className="space-y-2 min-w-[140px]">
                <Label className="text-xs font-semibold text-amber-700 dark:text-amber-300">Letter Date</Label>
                <Input
                  type="date"
                  value={letterDate}
                  onChange={e => setLetterDate(e.target.value)}
                  data-testid="input-letter-date"
                />
              </div>
              {selectedClient && bonusRows.length > 0 && (
                <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 h-8">
                  <Users className="w-3 h-3 mr-1" /> {bonusRows.length} Employees &bull; Total Bonus: ₹{totalBonus.toLocaleString('en-IN')}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {selectedClient && (
          <>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full" />
              </div>
            ) : bonusRows.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No salary data found for this accounting year</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card className="no-print border-2 border-indigo-200 shadow-lg">
                  <CardContent className="p-6 space-y-4" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
                    <div className="flex justify-between items-start text-sm">
                      <div className="font-semibold text-indigo-800 dark:text-indigo-300">Ref. {refNumber || '___________'}</div>
                      <div className="text-right text-slate-700 dark:text-slate-300">Date: {letterDate ? letterDate.split('-').reverse().join('-') : '___/___/______'}</div>
                    </div>
                    <div className="space-y-1 text-sm text-slate-800 dark:text-slate-200">
                      <p>To</p>
                      <p className="font-semibold">The Labour Commissioner</p>
                      <p>Office of the Labour Commissioner,</p>
                      <p>6, Church Lane 3rd floor</p>
                      <p>Kolkata - 700001</p>
                    </div>
                    <div className="text-sm text-slate-800 dark:text-slate-200">
                      <p><span className="font-semibold">Sub:</span> Annual Bonus Return for the year ending 31st March {fyEnd}</p>
                    </div>
                    <div className="text-sm text-slate-800 dark:text-slate-200 space-y-2">
                      <p>Dear Sir,</p>
                      <p>Please find enclosed the following return pertaining to our establishment <span className="font-semibold">DJ Hospitality & Facility Management Pvt Ltd</span>, 7 Crematorium Street, Kolkata- 700014</p>
                      <p className="font-semibold mt-2">Form - D Under the payment of Bonus Act.</p>
                    </div>
                    <div className="text-sm text-slate-800 dark:text-slate-200 mt-8 space-y-1">
                      <p>Your Faithfully</p>
                      <p className="font-semibold mt-4">Wahid Ahmad</p>
                      <p>Zonal Manager & Partner</p>
                      <p className="font-semibold">DJ Hospitality & Facility Management Pvt Ltd.</p>
                    </div>
                  </CardContent>
                </Card>

                <div className="sm:hidden no-print space-y-3">
                  {bonusRows.map(row => (
                    <Card key={row.slNo} className="border-l-4 border-l-amber-500">
                      <CardContent className="p-4 space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-bold text-sm text-amber-800 dark:text-amber-300">{row.slNo}. {row.name}</p>
                            <p className="text-xs text-muted-foreground">{row.fatherName}</p>
                          </div>
                          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">{row.designation}</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 text-xs">
                          <span className="text-muted-foreground">Days Worked:</span>
                          <span className="font-medium">{row.daysWorked}</span>
                          <span className="text-muted-foreground">Total Salary:</span>
                          <span className="font-medium">₹{row.totalSalary.toLocaleString('en-IN')}</span>
                          <span className="text-muted-foreground">Bonus (8.33%):</span>
                          <span className="font-bold text-emerald-700 dark:text-emerald-400">₹{row.bonusPayable.toLocaleString('en-IN')}</span>
                          <span className="text-muted-foreground">Date Paid:</span>
                          <span>{row.datePaid}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="hidden sm:block no-print">
                  <div className="border-2 border-amber-200 rounded-xl overflow-hidden shadow-lg">
                    <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 text-white text-center py-2.5 font-bold text-sm tracking-wide">
                      FORM C &mdash; Bonus Return &mdash; {selectedClient} &mdash; FY {fyStart}-{fyEnd}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse" data-testid="table-bonus">
                        <thead>
                          <tr>
                            <th colSpan={5} className="px-2 py-1.5 text-center font-bold border border-amber-200 bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-200">Employee Details</th>
                            <th colSpan={3} className="px-2 py-1.5 text-center font-bold border border-emerald-200 bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200">Salary & Bonus</th>
                            <th colSpan={5} className="px-2 py-1.5 text-center font-bold border border-rose-200 bg-rose-50 dark:bg-rose-950 text-rose-800 dark:text-rose-200">Deductions</th>
                            <th colSpan={3} className="px-2 py-1.5 text-center font-bold border border-indigo-200 bg-indigo-50 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-200">Payment</th>
                          </tr>
                          <tr className="border-b-2 border-amber-300">
                            <th className="px-2 py-2 text-left font-bold border border-amber-200 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 w-[40px]">S.No</th>
                            <th className="px-2 py-2 text-left font-bold border border-amber-200 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 min-w-[140px]">Name</th>
                            <th className="px-2 py-2 text-left font-bold border border-amber-200 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 min-w-[140px]">Father's Name</th>
                            <th className="px-2 py-2 text-left font-bold border border-amber-200 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300">15yr</th>
                            <th className="px-2 py-2 text-left font-bold border border-amber-200 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300">Designation</th>
                            <th className="px-2 py-2 text-left font-bold border border-emerald-200 bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300">Days</th>
                            <th className="px-2 py-2 text-left font-bold border border-emerald-200 bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300">Total Salary</th>
                            <th className="px-2 py-2 text-left font-bold border border-emerald-200 bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300">Bonus 8.33%</th>
                            <th className="px-2 py-2 text-left font-bold border border-rose-200 bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300">Puja</th>
                            <th className="px-2 py-2 text-left font-bold border border-rose-200 bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300">Interim</th>
                            <th className="px-2 py-2 text-left font-bold border border-rose-200 bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300">Tax</th>
                            <th className="px-2 py-2 text-left font-bold border border-rose-200 bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300">Misc.</th>
                            <th className="px-2 py-2 text-left font-bold border border-rose-200 bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300">Total</th>
                            <th className="px-2 py-2 text-left font-bold border border-indigo-200 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300">Net Payable</th>
                            <th className="px-2 py-2 text-left font-bold border border-indigo-200 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300">Paid</th>
                            <th className="px-2 py-2 text-left font-bold border border-indigo-200 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300">Date Paid</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bonusRows.map((row, idx) => {
                            const bgClass = idx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-amber-50/30 dark:bg-slate-800/40";
                            return (
                              <tr key={row.slNo} className={`${bgClass} hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors`} data-testid={`row-bonus-${row.slNo}`}>
                                <td className="px-2 py-2 text-left border border-slate-200 font-semibold text-amber-600">{row.slNo}</td>
                                <td className="px-2 py-2 text-left border border-slate-200 font-bold text-slate-800 dark:text-slate-200">{row.name}</td>
                                <td className="px-2 py-2 text-left border border-slate-200 text-slate-600 dark:text-slate-400">{row.fatherName}</td>
                                <td className="px-2 py-2 text-left border border-slate-200">{row.under15}</td>
                                <td className="px-2 py-2 text-left border border-slate-200">{row.designation}</td>
                                <td className="px-2 py-2 text-left border border-slate-200 font-semibold text-sky-700 dark:text-sky-400">{row.daysWorked}</td>
                                <td className="px-2 py-2 text-left border border-slate-200 font-semibold">{row.totalSalary.toLocaleString('en-IN')}</td>
                                <td className="px-2 py-2 text-left border border-slate-200 font-bold text-emerald-700 dark:text-emerald-400">{row.bonusPayable.toLocaleString('en-IN')}</td>
                                <td className="px-2 py-2 text-left border border-slate-200 text-slate-400">No</td>
                                <td className="px-2 py-2 text-left border border-slate-200 text-slate-400">No</td>
                                <td className="px-2 py-2 text-left border border-slate-200 text-slate-400">No</td>
                                <td className="px-2 py-2 text-left border border-slate-200 text-slate-400">No</td>
                                <td className="px-2 py-2 text-left border border-slate-200 text-slate-400">No</td>
                                <td className="px-2 py-2 text-left border border-slate-200 font-bold text-indigo-700 dark:text-indigo-400">{row.netAmount.toLocaleString('en-IN')}</td>
                                <td className="px-2 py-2 text-left border border-slate-200 font-bold text-indigo-700 dark:text-indigo-400">{row.actualPaid.toLocaleString('en-IN')}</td>
                                <td className="px-2 py-2 text-left border border-slate-200">{row.datePaid}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 font-bold border-t-2 border-amber-400">
                            <td colSpan={6} className="px-3 py-2 border border-slate-300 text-left text-amber-700 dark:text-amber-300">Total ({bonusRows.length} employees)</td>
                            <td className="px-2 py-2 text-left border border-slate-300">{bonusRows.reduce((s, r) => s + r.totalSalary, 0).toLocaleString('en-IN')}</td>
                            <td className="px-2 py-2 text-left border border-slate-300 text-emerald-700 dark:text-emerald-400">{totalBonus.toLocaleString('en-IN')}</td>
                            <td colSpan={5} className="px-2 py-2 border border-slate-300"></td>
                            <td className="px-2 py-2 text-left border border-slate-300 text-indigo-700 dark:text-indigo-400">{totalBonus.toLocaleString('en-IN')}</td>
                            <td className="px-2 py-2 text-left border border-slate-300 text-indigo-700 dark:text-indigo-400">{totalBonus.toLocaleString('en-IN')}</td>
                            <td className="px-2 py-2 border border-slate-300"></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>

                <div id="bonus-print-area" className="hidden print:block">
                  <div className="cover-letter-page" style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "14px", lineHeight: 1.8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
                      <div style={{ fontWeight: 600 }}>Ref. {refNumber || '___________'}</div>
                      <div>Date: {letterDate ? letterDate.split('-').reverse().join('-') : '___/___/______'}</div>
                    </div>
                    <div style={{ marginBottom: "16px" }}>
                      <p style={{ margin: "2px 0" }}>To</p>
                      <p style={{ margin: "2px 0", fontWeight: 600 }}>The Labour Commissioner</p>
                      <p style={{ margin: "2px 0" }}>Office of the Labour Commissioner,</p>
                      <p style={{ margin: "2px 0" }}>6, Church Lane 3rd floor</p>
                      <p style={{ margin: "2px 0" }}>Kolkata - 700001</p>
                    </div>
                    <div style={{ marginBottom: "16px" }}>
                      <p><span style={{ fontWeight: 600 }}>Sub:</span> Annual Bonus Return for the year ending 31st March {fyEnd}</p>
                    </div>
                    <div style={{ marginBottom: "16px" }}>
                      <p style={{ margin: "4px 0" }}>Dear Sir,</p>
                      <p style={{ margin: "4px 0" }}>Please find enclosed the following return pertaining to our establishment <span style={{ fontWeight: 600 }}>DJ Hospitality & Facility Management Pvt Ltd</span>, 7 Crematorium Street, Kolkata- 700014</p>
                      <p style={{ margin: "8px 0", fontWeight: 600 }}>Form - D Under the payment of Bonus Act.</p>
                    </div>
                    <div style={{ marginTop: "60px" }}>
                      <p style={{ margin: "2px 0" }}>Your Faithfully</p>
                      <p style={{ margin: "30px 0 2px 0", fontWeight: 600 }}>Wahid Ahmad</p>
                      <p style={{ margin: "2px 0" }}>Zonal Manager & Partner</p>
                      <p style={{ margin: "2px 0", fontWeight: 600 }}>DJ Hospitality & Facility Management Pvt Ltd.</p>
                    </div>
                  </div>

                  <div className="form-c-page">
                  <div style={{ textAlign: "center", marginBottom: "6px" }}>
                    <div style={{ fontSize: "14px", fontWeight: "bold", color: "#1a237e" }}>FORM C</div>
                    <div style={{ fontSize: "9px" }}>[See rule 4 (c)]</div>
                    <div style={{ fontSize: "9px", fontWeight: 600, marginTop: "2px" }}>BONUS PAID TO EMPLOYEES FOR THE ACCOUNTING YEAR ENDING ON THE {fyLabel}</div>
                    <div style={{ fontSize: "9px", fontWeight: 600 }}>Name of the establishment: DJ Hospitality & Facility Management Pvt Ltd, 7 Crematorium Street, Kolkata-700014</div>
                    <div style={{ fontSize: "9px" }}>Client: {selectedClient}</div>
                    <div style={{ fontSize: "9px" }}>No. of working days in the year: <u>{workingDays || '____'}</u></div>
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9px", fontFamily: "Arial, sans-serif" }}>
                    <thead>
                      <tr>
                        <th colSpan={5} style={{ background: "#fff3e0", color: "#e65100", fontWeight: 700, border: "1px solid #999", padding: "3px", fontSize: "9px" }}>Employee Details</th>
                        <th colSpan={3} style={{ background: "#e8f5e9", color: "#1b5e20", fontWeight: 700, border: "1px solid #999", padding: "3px", fontSize: "9px" }}>Salary & Bonus</th>
                        <th colSpan={5} style={{ background: "#fce4ec", color: "#b71c1c", fontWeight: 700, border: "1px solid #999", padding: "3px", fontSize: "9px" }}>Deductions</th>
                        <th colSpan={3} style={{ background: "#e8eaf6", color: "#1a237e", fontWeight: 700, border: "1px solid #999", padding: "3px", fontSize: "9px" }}>Payment</th>
                      </tr>
                      <tr>
                        {["Sl.No", "Name", "Father's Name", "15yr", "Designation", "Days", "Total Salary", "Bonus 8.33%", "Puja", "Interim", "[10A]", "Misc.", "Total Ded.", "Net Payable", "Amt Paid", "Date Paid"].map((h, i) => (
                          <th key={i} style={{ border: "1px solid #999", padding: "3px 4px", fontWeight: 600, fontSize: "8px", background: i < 5 ? "#ffe0b2" : i < 8 ? "#c8e6c9" : i < 13 ? "#f8bbd0" : "#c5cae9", textAlign: "left" }}>{h}</th>
                        ))}
                      </tr>
                      <tr>
                        {Array.from({ length: 16 }, (_, i) => (
                          <th key={i} style={{ border: "1px solid #999", padding: "2px", fontSize: "7px", background: "#f5f5f5", textAlign: "left" }}>{i + 1}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {bonusRows.map((row, idx) => (
                        <tr key={row.slNo} style={{ background: idx % 2 === 0 ? "#fff" : "#f5f7ff" }}>
                          <td style={{ border: "1px solid #bbb", padding: "3px 4px", textAlign: "left", fontWeight: 600, color: "#e65100" }}>{row.slNo}</td>
                          <td style={{ border: "1px solid #bbb", padding: "3px 4px", textAlign: "left", fontWeight: 700 }}>{row.name}</td>
                          <td style={{ border: "1px solid #bbb", padding: "3px 4px", textAlign: "left", color: "#555" }}>{row.fatherName}</td>
                          <td style={{ border: "1px solid #bbb", padding: "3px 4px", textAlign: "left" }}>No</td>
                          <td style={{ border: "1px solid #bbb", padding: "3px 4px", textAlign: "left" }}>{row.designation}</td>
                          <td style={{ border: "1px solid #bbb", padding: "3px 4px", textAlign: "left", fontWeight: 600 }}>{row.daysWorked}</td>
                          <td style={{ border: "1px solid #bbb", padding: "3px 4px", textAlign: "left" }}>{row.totalSalary.toLocaleString('en-IN')}</td>
                          <td style={{ border: "1px solid #bbb", padding: "3px 4px", textAlign: "left", fontWeight: 700, color: "#2e7d32" }}>{row.bonusPayable.toLocaleString('en-IN')}</td>
                          <td style={{ border: "1px solid #bbb", padding: "3px 4px", textAlign: "left", color: "#999" }}>No</td>
                          <td style={{ border: "1px solid #bbb", padding: "3px 4px", textAlign: "left", color: "#999" }}>No</td>
                          <td style={{ border: "1px solid #bbb", padding: "3px 4px", textAlign: "left", color: "#999" }}>No</td>
                          <td style={{ border: "1px solid #bbb", padding: "3px 4px", textAlign: "left", color: "#999" }}>No</td>
                          <td style={{ border: "1px solid #bbb", padding: "3px 4px", textAlign: "left", color: "#999" }}>No</td>
                          <td style={{ border: "1px solid #bbb", padding: "3px 4px", textAlign: "left", fontWeight: 700, color: "#1a237e" }}>{row.netAmount.toLocaleString('en-IN')}</td>
                          <td style={{ border: "1px solid #bbb", padding: "3px 4px", textAlign: "left", fontWeight: 700, color: "#1a237e" }}>{row.actualPaid.toLocaleString('en-IN')}</td>
                          <td style={{ border: "1px solid #bbb", padding: "3px 4px", textAlign: "left" }}>{row.datePaid}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: "#e0e0e0", fontWeight: "bold" }}>
                        <td colSpan={6} style={{ border: "1px solid #999", padding: "3px 6px", textAlign: "left", color: "#e65100" }}>Total ({bonusRows.length} employees)</td>
                        <td style={{ border: "1px solid #999", padding: "3px 6px", textAlign: "left" }}>{bonusRows.reduce((s, r) => s + r.totalSalary, 0).toLocaleString('en-IN')}</td>
                        <td style={{ border: "1px solid #999", padding: "3px 6px", textAlign: "left", color: "#2e7d32" }}>{totalBonus.toLocaleString('en-IN')}</td>
                        <td colSpan={5} style={{ border: "1px solid #999", padding: "3px" }}></td>
                        <td style={{ border: "1px solid #999", padding: "3px 6px", textAlign: "left", color: "#1a237e" }}>{totalBonus.toLocaleString('en-IN')}</td>
                        <td style={{ border: "1px solid #999", padding: "3px 6px", textAlign: "left", color: "#1a237e" }}>{totalBonus.toLocaleString('en-IN')}</td>
                        <td style={{ border: "1px solid #999" }}></td>
                      </tr>
                    </tfoot>
                  </table>
                  <div style={{ marginTop: "6px", fontSize: "7px", color: "#666" }}>
                    <p>[1] Ins. by G.S.R. 1147, dated 23rd August, 1979 (w.e.f. 8-9.1979).</p>
                    <p>[2] Ins. by G.S.R. 1147, dated 23rd August, 1979 (w.e.f. 8-9.1979).</p>
                  </div>
                  <div style={{ marginTop: "20px", display: "flex", justifyContent: "space-between", fontSize: "9px" }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ borderTop: "1px solid #333", width: "160px", paddingTop: "4px" }}>Signature of Contractor</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ borderTop: "1px solid #333", width: "160px", paddingTop: "4px" }}>Principal Employer</div>
                    </div>
                  </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}

function getSkillLevel(designation: string): string {
  const d = designation.toUpperCase();
  if (d.includes('HEAD COOK') || d.includes('COOK') || d.includes('INCHARGE') || d.includes('SUPERVISOR')) return 'Skilled';
  if (d.includes('SEMI')) return 'Semi skilled';
  return 'Unskilled';
}
