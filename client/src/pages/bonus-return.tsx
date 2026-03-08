import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Layout } from '@/components/layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Printer, ArrowLeft, Users, Building2, Gift, Download, Save, Loader2, FileText } from 'lucide-react';
import { useClientNames } from '@/hooks/use-reports';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';
import type { Employee, BonusReturn } from '@shared/schema';
import { LETTERHEAD_HTML, getCoverLetterPrintStyles } from '@/lib/letterhead';

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
  const { toast } = useToast();
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
  const [savedId, setSavedId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('formc');
  const [formDNatureOfIndustry, setFormDNatureOfIndustry] = useState('Catering & Facility Management');
  const [formDEmployerName, setFormDEmployerName] = useState('DJ Hospitality & Facility Management Pvt Ltd');
  const [formDSettlement, setFormDSettlement] = useState('');
  const [formDPercentage, setFormDPercentage] = useState('8.33');
  const [formDPaidToAll, setFormDPaidToAll] = useState('Yes');
  const [formDRemarks, setFormDRemarks] = useState('');
  const [formDPaymentDate, setFormDPaymentDate] = useState('');

  const fyStart = Number(fyStartYear);

  const { data: savedReturn } = useQuery<BonusReturn | null>({
    queryKey: ['/api/bonus-returns/lookup', selectedClient, fyStartYear],
    queryFn: async () => {
      const res = await fetch(`/api/bonus-returns/lookup?clientName=${encodeURIComponent(selectedClient)}&fyStartYear=${fyStartYear}`, { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!selectedClient,
  });

  useEffect(() => {
    if (savedReturn) {
      setBonusDate(savedReturn.bonusDate || '');
      setWorkingDays(savedReturn.workingDays || '');
      setRefNumber(savedReturn.refNumber || '');
      setLetterDate(savedReturn.letterDate || '');
      setSavedId(savedReturn.id);
      setFormDNatureOfIndustry(savedReturn.formDNatureOfIndustry || 'Catering & Facility Management');
      setFormDEmployerName(savedReturn.formDEmployerName || 'DJ Hospitality & Facility Management Pvt Ltd');
      setFormDSettlement(savedReturn.formDSettlement || '');
      setFormDPercentage(savedReturn.formDPercentage || '8.33');
      setFormDPaidToAll(savedReturn.formDPaidToAll || 'Yes');
      setFormDRemarks(savedReturn.formDRemarks || '');
      setFormDPaymentDate(savedReturn.formDPaymentDate || '');
    } else {
      setBonusDate('');
      setWorkingDays('');
      setRefNumber('');
      setLetterDate('');
      setSavedId(null);
      setFormDNatureOfIndustry('Catering & Facility Management');
      setFormDEmployerName('DJ Hospitality & Facility Management Pvt Ltd');
      setFormDSettlement('');
      setFormDPercentage('8.33');
      setFormDPaidToAll('Yes');
      setFormDRemarks('');
      setFormDPaymentDate('');
    }
  }, [savedReturn]);

  const saveMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/bonus-returns', {
      clientName: selectedClient,
      fyStartYear: fyStart,
      bonusDate,
      workingDays,
      refNumber,
      letterDate,
      formDNatureOfIndustry,
      formDEmployerName,
      formDSettlement,
      formDPercentage,
      formDPaidToAll,
      formDRemarks,
      formDPaymentDate,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bonus-returns/lookup', selectedClient, fyStartYear] });
      toast({ title: savedId ? 'Updated successfully' : 'Saved successfully' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
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

  const fyEmployees = employees.filter(e => {
    if (!e.leavingDate) return true;
    const leaveDate = new Date(e.leavingDate);
    const fyStartDate = new Date(fyStart, 3, 1);
    return leaveDate >= fyStartDate;
  });

  const bonusRows = fyEmployees.map((emp, idx) => {
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

  const handlePrintCover = () => {
    const coverArea = document.getElementById('bonus-cover-print');
    if (!coverArea) return;
    const title = `Cover Letter - Bonus Return - ${selectedClient} - FY ${fyStart}-${fyEnd}`;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
      <style>${getCoverLetterPrintStyles()}</style>
    </head><body>${coverArea.innerHTML}</body></html>`);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
      printWindow.onafterprint = () => printWindow.close();
    };
  };

  const handlePrintFormC = () => {
    const formArea = document.getElementById('bonus-formc-print');
    if (!formArea) return;
    const title = `Form C - Bonus Return - ${selectedClient} - FY ${fyStart}-${fyEnd}`;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
      <style>
        @page { size: A4 landscape; margin: 6mm; }
        body { margin: 0; padding: 0; font-family: Arial, sans-serif; font-size: 8px; }
        table { width: 100%; table-layout: fixed; font-size: 7px; border-collapse: collapse; }
        table th, table td { padding: 1px 2px; line-height: 1.2; overflow: hidden; word-wrap: break-word; }
        table thead { display: table-header-group; }
        p { margin: 2px 0; }
      </style>
    </head><body>${formArea.innerHTML}</body></html>`);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
      printWindow.onafterprint = () => printWindow.close();
    };
  };

  const handlePrintFormD = () => {
    const formArea = document.getElementById('bonus-formd-print');
    if (!formArea) return;
    const title = `Form D - Annual Return - ${selectedClient} - FY ${fyStart}-${fyEnd}`;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
      <style>
        @page { size: A4 portrait; margin: 20mm; }
        body { margin: 0; padding: 0; font-family: Georgia, 'Times New Roman', serif; font-size: 12px; line-height: 1.6; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #333; padding: 8px; vertical-align: top; }
        th { font-weight: 700; font-size: 9px; text-align: left; }
        p { margin: 4px 0; }
        b { font-weight: 700; }
      </style>
    </head><body>${formArea.innerHTML}</body></html>`);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
      printWindow.onafterprint = () => printWindow.close();
    };
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
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link href="/">
              <Button variant="ghost" size="icon" className="shrink-0" data-testid="button-back">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div className="min-w-0">
              <h1 className="text-base sm:text-2xl font-bold tracking-tight flex items-center gap-2 truncate" data-testid="text-title">
                <Gift className="w-5 h-5 text-amber-600 shrink-0" />
                Bonus Return
              </h1>
              <p className="text-[10px] sm:text-sm text-muted-foreground truncate">Payment of Bonus Act, 1965 — Form C & Form D</p>
            </div>
          </div>
          {selectedClient && (
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                size="sm"
                className="gap-2"
                data-testid="button-save"
              >
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {savedId ? 'Update' : 'Save'}
              </Button>
              {bonusRows.length > 0 && (
                <>
                  <Button onClick={handleExportExcel} variant="outline" size="sm" className="gap-2" data-testid="button-export-excel">
                    <Download className="w-4 h-4" /> Excel
                  </Button>
                  <Button onClick={handlePrintCover} variant="outline" size="sm" className="gap-2" data-testid="button-print-cover">
                    <Printer className="w-4 h-4" /> Cover Letter
                  </Button>
                  <Button onClick={handlePrintFormC} variant="outline" size="sm" className="gap-2" data-testid="button-print-formc">
                    <Printer className="w-4 h-4" /> Form C
                  </Button>
                  <Button onClick={handlePrintFormD} variant="outline" size="sm" className="gap-2" data-testid="button-print-formd">
                    <Printer className="w-4 h-4" /> Form D
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        <Card className="no-print border-amber-200 shadow-sm">
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
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
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-amber-700 dark:text-amber-300">Accounting Year</Label>
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
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-amber-700 dark:text-amber-300">Working Days</Label>
                  <Input
                    type="number"
                    value={workingDays}
                    onChange={e => setWorkingDays(e.target.value)}
                    placeholder="e.g. 3532"
                    data-testid="input-working-days"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-amber-700 dark:text-amber-300">Bonus Date</Label>
                  <Input
                    type="date"
                    value={bonusDate}
                    onChange={e => setBonusDate(e.target.value)}
                    data-testid="input-bonus-date"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-amber-700 dark:text-amber-300">Ref. Number</Label>
                  <Input
                    type="text"
                    value={refNumber}
                    onChange={e => setRefNumber(e.target.value)}
                    placeholder="DJ/KOL/25/0261"
                    data-testid="input-ref-number"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-amber-700 dark:text-amber-300">Letter Date</Label>
                  <Input
                    type="date"
                    value={letterDate}
                    onChange={e => setLetterDate(e.target.value)}
                    data-testid="input-letter-date"
                  />
                </div>
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
              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList className="no-print">
                  <TabsTrigger value="formc" className="gap-2" data-testid="tab-formc"><FileText className="w-4 h-4" /> Form C</TabsTrigger>
                  <TabsTrigger value="formd" className="gap-2" data-testid="tab-formd"><FileText className="w-4 h-4" /> Form D</TabsTrigger>
                </TabsList>
              <TabsContent value="formc" className="space-y-4">
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

                <div id="bonus-cover-print" className="hidden">
                  <div dangerouslySetInnerHTML={{ __html: LETTERHEAD_HTML }} />
                  <div className="ref-line">
                    <span>Ref. {refNumber || '___________'}</span>
                    <span>Date: {letterDate ? letterDate.split('-').reverse().join('-') : '___/___/______'}</span>
                  </div>
                  <div style={{ marginBottom: "16px" }}>
                    <p>To</p>
                    <p><strong>The Labour Commissioner</strong></p>
                    <p>Office of the Labour Commissioner,</p>
                    <p>6, Church Lane 3rd floor</p>
                    <p>Kolkata - 700001</p>
                  </div>
                  <div className="subject">
                    <p>Sub: Annual Bonus Return for the year ending 31st March {fyEnd}</p>
                  </div>
                  <div style={{ marginBottom: "16px" }}>
                    <p>Dear Sir,</p>
                    <p>Please find enclosed the following return pertaining to our establishment <strong>DJ Hospitality & Facility Management Pvt Ltd</strong>, 7 Crematorium Street, Kolkata- 700014</p>
                    <p style={{ marginTop: "10px", fontWeight: "bold" }}>Form - D Under the Payment of Bonus Act.</p>
                  </div>
                  <div style={{ marginTop: "50px" }}>
                    <p>Thanking you.</p>
                    <p>Yours faithfully,</p>
                    <p style={{ marginTop: "25px", fontWeight: "bold" }}>Wahid Ahmad</p>
                    <p>Zonal Manager & Partner</p>
                    <p style={{ fontWeight: "bold" }}>DJ Hospitality & Facility Management Pvt Ltd</p>
                  </div>
                </div>

                <div id="bonus-formc-print" className="hidden">
                  <div style={{ textAlign: "center", marginBottom: "4px" }}>
                    <div style={{ fontSize: "12px", fontWeight: "bold", color: "#1a237e" }}>FORM C</div>
                    <div style={{ fontSize: "8px" }}>[See rule 4 (c)]</div>
                    <div style={{ fontSize: "8px", fontWeight: 600, marginTop: "1px" }}>BONUS PAID TO EMPLOYEES FOR THE ACCOUNTING YEAR ENDING ON THE {fyLabel}</div>
                    <div style={{ fontSize: "8px", fontWeight: 600 }}>Name of the establishment: DJ Hospitality & Facility Management Pvt Ltd, 7 Crematorium Street, Kolkata-700014</div>
                    <div style={{ fontSize: "8px" }}>Client: {selectedClient} | No. of working days: <u>{workingDays || '____'}</u></div>
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "7px", fontFamily: "Arial, sans-serif" }}>
                    <thead>
                      <tr>
                        <th colSpan={5} style={{ background: "#fff3e0", color: "#e65100", fontWeight: 700, border: "1px solid #999", padding: "2px", fontSize: "7px" }}>Employee Details</th>
                        <th colSpan={3} style={{ background: "#e8f5e9", color: "#1b5e20", fontWeight: 700, border: "1px solid #999", padding: "2px", fontSize: "7px" }}>Salary & Bonus</th>
                        <th colSpan={5} style={{ background: "#fce4ec", color: "#b71c1c", fontWeight: 700, border: "1px solid #999", padding: "2px", fontSize: "7px" }}>Deductions</th>
                        <th colSpan={3} style={{ background: "#e8eaf6", color: "#1a237e", fontWeight: 700, border: "1px solid #999", padding: "2px", fontSize: "7px" }}>Payment</th>
                      </tr>
                      <tr>
                        {["Sl.No", "Name", "Father's Name", "15yr", "Designation", "Days", "Total Salary", "Bonus 8.33%", "Puja", "Interim", "[10A]", "Misc.", "Total Ded.", "Net Payable", "Amt Paid", "Date Paid"].map((h, i) => (
                          <th key={i} style={{ border: "1px solid #999", padding: "1px 2px", fontWeight: 600, fontSize: "7px", background: i < 5 ? "#ffe0b2" : i < 8 ? "#c8e6c9" : i < 13 ? "#f8bbd0" : "#c5cae9", textAlign: "left" }}>{h}</th>
                        ))}
                      </tr>
                      <tr>
                        {Array.from({ length: 16 }, (_, i) => (
                          <th key={i} style={{ border: "1px solid #999", padding: "1px", fontSize: "6px", background: "#f5f5f5", textAlign: "left" }}>{i + 1}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {bonusRows.map((row, idx) => (
                        <tr key={row.slNo} style={{ background: idx % 2 === 0 ? "#fff" : "#f5f7ff" }}>
                          <td style={{ border: "1px solid #bbb", padding: "1px 2px", textAlign: "left", fontWeight: 600, color: "#e65100" }}>{row.slNo}</td>
                          <td style={{ border: "1px solid #bbb", padding: "1px 2px", textAlign: "left", fontWeight: 700 }}>{row.name}</td>
                          <td style={{ border: "1px solid #bbb", padding: "1px 2px", textAlign: "left", color: "#555" }}>{row.fatherName}</td>
                          <td style={{ border: "1px solid #bbb", padding: "1px 2px", textAlign: "left" }}>No</td>
                          <td style={{ border: "1px solid #bbb", padding: "1px 2px", textAlign: "left" }}>{row.designation}</td>
                          <td style={{ border: "1px solid #bbb", padding: "1px 2px", textAlign: "left", fontWeight: 600 }}>{row.daysWorked}</td>
                          <td style={{ border: "1px solid #bbb", padding: "1px 2px", textAlign: "left" }}>{row.totalSalary.toLocaleString('en-IN')}</td>
                          <td style={{ border: "1px solid #bbb", padding: "1px 2px", textAlign: "left", fontWeight: 700, color: "#2e7d32" }}>{row.bonusPayable.toLocaleString('en-IN')}</td>
                          <td style={{ border: "1px solid #bbb", padding: "1px 2px", textAlign: "left", color: "#999" }}>No</td>
                          <td style={{ border: "1px solid #bbb", padding: "1px 2px", textAlign: "left", color: "#999" }}>No</td>
                          <td style={{ border: "1px solid #bbb", padding: "1px 2px", textAlign: "left", color: "#999" }}>No</td>
                          <td style={{ border: "1px solid #bbb", padding: "1px 2px", textAlign: "left", color: "#999" }}>No</td>
                          <td style={{ border: "1px solid #bbb", padding: "1px 2px", textAlign: "left", color: "#999" }}>No</td>
                          <td style={{ border: "1px solid #bbb", padding: "1px 2px", textAlign: "left", fontWeight: 700, color: "#1a237e" }}>{row.netAmount.toLocaleString('en-IN')}</td>
                          <td style={{ border: "1px solid #bbb", padding: "1px 2px", textAlign: "left", fontWeight: 700, color: "#1a237e" }}>{row.actualPaid.toLocaleString('en-IN')}</td>
                          <td style={{ border: "1px solid #bbb", padding: "1px 2px", textAlign: "left" }}>{row.datePaid}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: "#e0e0e0", fontWeight: "bold" }}>
                        <td colSpan={6} style={{ border: "1px solid #999", padding: "1px 2px", textAlign: "left", color: "#e65100" }}>Total ({bonusRows.length} employees)</td>
                        <td style={{ border: "1px solid #999", padding: "1px 2px", textAlign: "left" }}>{bonusRows.reduce((s, r) => s + r.totalSalary, 0).toLocaleString('en-IN')}</td>
                        <td style={{ border: "1px solid #999", padding: "1px 2px", textAlign: "left", color: "#2e7d32" }}>{totalBonus.toLocaleString('en-IN')}</td>
                        <td colSpan={5} style={{ border: "1px solid #999", padding: "1px" }}></td>
                        <td style={{ border: "1px solid #999", padding: "1px 2px", textAlign: "left", color: "#1a237e" }}>{totalBonus.toLocaleString('en-IN')}</td>
                        <td style={{ border: "1px solid #999", padding: "1px 2px", textAlign: "left", color: "#1a237e" }}>{totalBonus.toLocaleString('en-IN')}</td>
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
              </TabsContent>

              <TabsContent value="formd" className="space-y-4">
                <Card className="no-print border-2 border-teal-200 shadow-lg">
                  <CardContent className="p-5 space-y-4">
                    <h3 className="text-sm font-bold text-teal-800 dark:text-teal-300">Form D Settings</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-teal-700 dark:text-teal-300">Nature of Industry</Label>
                        <Input value={formDNatureOfIndustry} onChange={e => setFormDNatureOfIndustry(e.target.value)} data-testid="input-formd-industry" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-teal-700 dark:text-teal-300">Name of the Employer</Label>
                        <Input value={formDEmployerName} onChange={e => setFormDEmployerName(e.target.value)} data-testid="input-formd-employer" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-teal-700 dark:text-teal-300">Settlement (Section 18/12)</Label>
                        <Input value={formDSettlement} onChange={e => setFormDSettlement(e.target.value)} placeholder="e.g. NIL" data-testid="input-formd-settlement" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-teal-700 dark:text-teal-300">Percentage of Bonus Declared</Label>
                        <Input value={formDPercentage} onChange={e => setFormDPercentage(e.target.value)} data-testid="input-formd-percentage" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-teal-700 dark:text-teal-300">Date on which payment made</Label>
                        <Input type="date" value={formDPaymentDate} onChange={e => setFormDPaymentDate(e.target.value)} data-testid="input-formd-payment-date" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-teal-700 dark:text-teal-300">Bonus paid to all employees?</Label>
                        <Select value={formDPaidToAll} onValueChange={setFormDPaidToAll}>
                          <SelectTrigger data-testid="select-formd-paidtoall"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Yes">Yes</SelectItem>
                            <SelectItem value="No">No</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1 sm:col-span-2 lg:col-span-3">
                        <Label className="text-xs font-semibold text-teal-700 dark:text-teal-300">Remarks</Label>
                        <Textarea value={formDRemarks} onChange={e => setFormDRemarks(e.target.value)} placeholder="Any remarks..." rows={2} data-testid="input-formd-remarks" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="no-print border-2 border-teal-100 shadow-sm">
                  <CardContent className="p-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-teal-50 dark:bg-teal-950/30 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground">Total Employees</p>
                        <p className="text-lg font-bold text-teal-700 dark:text-teal-300" data-testid="text-formd-total-emp">{bonusRows.length}</p>
                      </div>
                      <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground">Employees Benefited</p>
                        <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300" data-testid="text-formd-benefited">{bonusRows.length}</p>
                      </div>
                      <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground">Total Bonus Payable</p>
                        <p className="text-lg font-bold text-amber-700 dark:text-amber-300" data-testid="text-formd-total-payable">₹{totalBonus.toLocaleString('en-IN')}</p>
                      </div>
                      <div className="bg-indigo-50 dark:bg-indigo-950/30 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground">Total Bonus Paid</p>
                        <p className="text-lg font-bold text-indigo-700 dark:text-indigo-300" data-testid="text-formd-total-paid">₹{totalBonus.toLocaleString('en-IN')}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="hidden sm:block no-print">
                  <div className="border-2 border-teal-200 rounded-xl overflow-hidden shadow-lg">
                    <div className="bg-gradient-to-r from-teal-600 via-emerald-600 to-green-600 text-white text-center py-2.5 font-bold text-sm tracking-wide">
                      FORM D &mdash; Annual Return &mdash; {selectedClient} &mdash; FY {fyStart}-{fyEnd}
                    </div>
                    <div className="p-6" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
                      <div className="text-center mb-4">
                        <p className="font-bold text-base">Payment of Bonus Act</p>
                        <p className="font-bold text-lg">FORM D</p>
                        <p className="text-xs text-muted-foreground">[See rule 5]</p>
                        <p className="text-sm font-semibold mt-1">ANNUAL RETURN — BONUS PAID TO EMPLOYEES FOR THE ACCOUNTING YEAR</p>
                        <p className="text-sm font-semibold">ENDING ON THE 31st March, {fyEnd}</p>
                      </div>
                      <div className="space-y-2 text-sm mb-6">
                        <p><span className="font-semibold">1. Name of the establishment and its complete postal address:</span> {formDEmployerName}, 7 Crematorium Street, Kolkata - 700014 (Client: {selectedClient})</p>
                        <p><span className="font-semibold">2. Nature of industry:</span> {formDNatureOfIndustry}</p>
                        <p><span className="font-semibold">3. Name of the employer:</span> {formDEmployerName}</p>
                        <p><span className="font-semibold">4. Total number of employees:</span> {bonusRows.length}</p>
                        <p><span className="font-semibold">5. Number of employees benefited by bonus payments:</span> {bonusRows.length}</p>
                      </div>
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr>
                            <th className="border border-slate-400 p-2 bg-teal-50 dark:bg-teal-950 text-left text-xs font-bold" style={{ width: '20%' }}>Total amount payable as bonus under section 10 or 11 of the Payment of Bonus Act, 1965 as the case may be<br/><span className="text-muted-foreground">(1)</span></th>
                            <th className="border border-slate-400 p-2 bg-teal-50 dark:bg-teal-950 text-left text-xs font-bold" style={{ width: '16%' }}>Settlement, if any reached under section 18(1) or 12(3) of the Industrial Disputes Act. 1947 with date<br/><span className="text-muted-foreground">(2)</span></th>
                            <th className="border border-slate-400 p-2 bg-teal-50 dark:bg-teal-950 text-left text-xs font-bold" style={{ width: '10%' }}>Percentage of bonus declared to be paid<br/><span className="text-muted-foreground">(3)</span></th>
                            <th className="border border-slate-400 p-2 bg-teal-50 dark:bg-teal-950 text-left text-xs font-bold" style={{ width: '14%' }}>Total amount of bonus actually paid<br/><span className="text-muted-foreground">(4)</span></th>
                            <th className="border border-slate-400 p-2 bg-teal-50 dark:bg-teal-950 text-left text-xs font-bold" style={{ width: '12%' }}>Date on which payment made<br/><span className="text-muted-foreground">(5)</span></th>
                            <th className="border border-slate-400 p-2 bg-teal-50 dark:bg-teal-950 text-left text-xs font-bold" style={{ width: '14%' }}>Whether bonus has been paid to all the employees, if not, reasons for non-payment<br/><span className="text-muted-foreground">(6)</span></th>
                            <th className="border border-slate-400 p-2 bg-teal-50 dark:bg-teal-950 text-left text-xs font-bold" style={{ width: '14%' }}>Remark<br/><span className="text-muted-foreground">(7)</span></th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="border border-slate-400 p-3 text-center font-bold text-lg text-emerald-700 dark:text-emerald-400">₹{totalBonus.toLocaleString('en-IN')}/-</td>
                            <td className="border border-slate-400 p-3 text-center">{formDSettlement || 'NIL'}</td>
                            <td className="border border-slate-400 p-3 text-center font-semibold">{formDPercentage}%</td>
                            <td className="border border-slate-400 p-3 text-center font-bold text-lg text-indigo-700 dark:text-indigo-400">₹{totalBonus.toLocaleString('en-IN')}/-</td>
                            <td className="border border-slate-400 p-3 text-center">{formDPaymentDate ? formDPaymentDate.split('-').reverse().join('-') : (bonusDate ? bonusDate.split('-').reverse().join('-') : '____________')}</td>
                            <td className="border border-slate-400 p-3 text-center">{formDPaidToAll}</td>
                            <td className="border border-slate-400 p-3 text-center">{formDRemarks || '-'}</td>
                          </tr>
                        </tbody>
                      </table>
                      <div className="mt-10 text-right text-sm">
                        <p className="font-semibold">Signature of the employer or his agent</p>
                        <p className="mt-6 font-bold">Wahid Ahmad</p>
                        <p>Zonal Manager & Partner</p>
                        <p className="font-semibold">{formDEmployerName}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="sm:hidden no-print">
                  <Card className="border-l-4 border-l-teal-500">
                    <CardContent className="p-4 space-y-3" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
                      <p className="text-center font-bold text-base">FORM D</p>
                      <p className="text-center text-xs text-muted-foreground">[See rule 5] — Annual Return</p>
                      <div className="space-y-2 text-xs">
                        <p><span className="font-semibold">Establishment:</span> {formDEmployerName}</p>
                        <p><span className="font-semibold">Industry:</span> {formDNatureOfIndustry}</p>
                        <p><span className="font-semibold">Total Employees:</span> {bonusRows.length}</p>
                        <p><span className="font-semibold">Bonus Payable:</span> ₹{totalBonus.toLocaleString('en-IN')}</p>
                        <p><span className="font-semibold">Bonus Paid:</span> ₹{totalBonus.toLocaleString('en-IN')}</p>
                        <p><span className="font-semibold">Percentage:</span> {formDPercentage}%</p>
                        <p><span className="font-semibold">Payment Date:</span> {formDPaymentDate ? formDPaymentDate.split('-').reverse().join('-') : (bonusDate ? bonusDate.split('-').reverse().join('-') : '-')}</p>
                        <p><span className="font-semibold">Paid to All:</span> {formDPaidToAll}</p>
                        <p><span className="font-semibold">Settlement:</span> {formDSettlement || 'NIL'}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div id="bonus-formd-print" className="hidden">
                  <div style={{ textAlign: "center", marginBottom: "12px", fontFamily: "Georgia, 'Times New Roman', serif" }}>
                    <p style={{ fontWeight: 700, fontSize: "14px" }}>Payment of Bonus Act</p>
                    <p style={{ fontWeight: 700, fontSize: "18px" }}>FORM D</p>
                    <p style={{ fontSize: "10px", color: "#666" }}>[See rule 5]</p>
                    <p style={{ fontWeight: 600, fontSize: "12px", marginTop: "4px" }}>ANNUAL RETURN — BONUS PAID TO EMPLOYEES FOR THE ACCOUNTING YEAR</p>
                    <p style={{ fontWeight: 600, fontSize: "12px" }}>ENDING ON THE 31st March, {fyEnd}</p>
                  </div>
                  <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "12px", marginBottom: "16px", lineHeight: "1.8" }}>
                    <p><b>1. Name of the establishment and its complete postal address:</b> {formDEmployerName}, 7 Crematorium Street, Kolkata - 700014 (Client: {selectedClient})</p>
                    <p><b>2. Nature of industry:</b> {formDNatureOfIndustry}</p>
                    <p><b>3. Name of the employer:</b> {formDEmployerName}</p>
                    <p><b>4. Total number of employees:</b> {bonusRows.length}</p>
                    <p><b>5. Number of employees benefited by bonus payments:</b> {bonusRows.length}</p>
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Arial, sans-serif", fontSize: "10px" }}>
                    <thead>
                      <tr>
                        <th style={{ border: "1px solid #333", padding: "6px", fontWeight: 700, fontSize: "9px", verticalAlign: "top", width: "20%", textAlign: "left" }}>Total amount payable as bonus under section 10 or 11 of the Payment of Bonus Act, 1965 as the case may be<br/>(1)</th>
                        <th style={{ border: "1px solid #333", padding: "6px", fontWeight: 700, fontSize: "9px", verticalAlign: "top", width: "16%", textAlign: "left" }}>Settlement, if any reached under section 18(1) or 12(3) of the Industrial Disputes Act. 1947 with date<br/>(2)</th>
                        <th style={{ border: "1px solid #333", padding: "6px", fontWeight: 700, fontSize: "9px", verticalAlign: "top", width: "10%", textAlign: "left" }}>Percentage of bonus declared to be paid<br/>(3)</th>
                        <th style={{ border: "1px solid #333", padding: "6px", fontWeight: 700, fontSize: "9px", verticalAlign: "top", width: "14%", textAlign: "left" }}>Total amount of bonus actually paid<br/>(4)</th>
                        <th style={{ border: "1px solid #333", padding: "6px", fontWeight: 700, fontSize: "9px", verticalAlign: "top", width: "12%", textAlign: "left" }}>Date on which payment made<br/>(5)</th>
                        <th style={{ border: "1px solid #333", padding: "6px", fontWeight: 700, fontSize: "9px", verticalAlign: "top", width: "14%", textAlign: "left" }}>Whether bonus has been paid to all the employees, if not, reasons for non-payment<br/>(6)</th>
                        <th style={{ border: "1px solid #333", padding: "6px", fontWeight: 700, fontSize: "9px", verticalAlign: "top", width: "14%", textAlign: "left" }}>Remark<br/>(7)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ border: "1px solid #333", padding: "8px", textAlign: "center", fontWeight: 700, fontSize: "14px" }}>₹{totalBonus.toLocaleString('en-IN')}/-</td>
                        <td style={{ border: "1px solid #333", padding: "8px", textAlign: "center" }}>{formDSettlement || 'NIL'}</td>
                        <td style={{ border: "1px solid #333", padding: "8px", textAlign: "center", fontWeight: 600 }}>{formDPercentage}%</td>
                        <td style={{ border: "1px solid #333", padding: "8px", textAlign: "center", fontWeight: 700, fontSize: "14px" }}>₹{totalBonus.toLocaleString('en-IN')}/-</td>
                        <td style={{ border: "1px solid #333", padding: "8px", textAlign: "center" }}>{formDPaymentDate ? formDPaymentDate.split('-').reverse().join('-') : (bonusDate ? bonusDate.split('-').reverse().join('-') : '____________')}</td>
                        <td style={{ border: "1px solid #333", padding: "8px", textAlign: "center" }}>{formDPaidToAll}</td>
                        <td style={{ border: "1px solid #333", padding: "8px", textAlign: "center" }}>{formDRemarks || '-'}</td>
                      </tr>
                    </tbody>
                  </table>
                  <div style={{ marginTop: "40px", textAlign: "right", fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "12px" }}>
                    <p style={{ fontWeight: 600 }}>Signature of the employer or his agent</p>
                    <p style={{ marginTop: "30px", fontWeight: 700 }}>Wahid Ahmad</p>
                    <p>Zonal Manager & Partner</p>
                    <p style={{ fontWeight: 600 }}>{formDEmployerName}</p>
                  </div>
                </div>
              </TabsContent>
              </Tabs>
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
