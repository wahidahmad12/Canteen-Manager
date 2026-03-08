import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Layout } from '@/components/layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Printer, ArrowLeft, Building2, RefreshCw, Save, Loader2 } from 'lucide-react';
import { useClientNames } from '@/hooks/use-reports';
import { Link } from 'wouter';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { Employee } from '@shared/schema';

interface SalaryRecord {
  id: number;
  employeeId: number;
  month: number;
  year: number;
  daysWorked: string;
  grossWage: string;
  basicWage: string;
  pfDeduction: string;
  esicDeduction: string;
  professionalTax: string;
  overtimeHours: string;
  lwf: string;
}

export default function HalfYearlyReturn() {
  const { data: clientNames = [] } = useClientNames();
  const { toast } = useToast();
  const [selectedClient, setSelectedClient] = useState('');
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const defaultHalf = currentMonth <= 6 ? 'H2' : 'H1';
  const defaultYear = defaultHalf === 'H2' ? currentYear - 1 : currentYear;

  const [halfYear, setHalfYear] = useState(defaultHalf);
  const [selectedYear, setSelectedYear] = useState(String(defaultYear));

  const [refNumber, setRefNumber] = useState('');
  const [letterDate, setLetterDate] = useState('');
  const [formDate, setFormDate] = useState('');

  const [contractFrom, setContractFrom] = useState('');
  const [contractTo, setContractTo] = useState('');
  const [principalDays, setPrincipalDays] = useState('');
  const [contractorDays, setContractorDays] = useState('');
  const [dailyHours, setDailyHours] = useState('8hrs. And 2Hrs spread over-time.');
  const [weeklyHoliday, setWeeklyHoliday] = useState('Yes. On Sunday.');
  const [holidayPaid, setHolidayPaid] = useState('Yes.');
  const [lwfMen, setLwfMen] = useState('');
  const [lwfWomen, setLwfWomen] = useState('');
  const [canteen, setCanteen] = useState('Provided');
  const [restRoom, setRestRoom] = useState('Provided');
  const [drinkingWater, setDrinkingWater] = useState('Provided');
  const [creches, setCreches] = useState('N/A');
  const [firstAid, setFirstAid] = useState('Provided');
  const [licenceNo, setLicenceNo] = useState('KOL01/CLL/001435, DT-27.11.2020, P.S-TARATALA, Ward-79');
  const [principalAddress, setPrincipalAddress] = useState('');
  const [savedId, setSavedId] = useState<number | null>(null);

  const year = Number(selectedYear);

  const { data: savedReturn } = useQuery({
    queryKey: ['/api/half-yearly-returns/lookup', selectedClient, halfYear, year],
    queryFn: async () => {
      const res = await fetch(`/api/half-yearly-returns/lookup?clientName=${encodeURIComponent(selectedClient)}&halfYear=${halfYear}&year=${year}`, { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!selectedClient,
  });

  useEffect(() => {
    if (savedReturn) {
      setRefNumber(savedReturn.refNumber || '');
      setLetterDate(savedReturn.letterDate || '');
      setFormDate(savedReturn.formDate || '');
      setContractFrom(savedReturn.contractFrom || '');
      setContractTo(savedReturn.contractTo || '');
      setPrincipalDays(savedReturn.principalDays || '');
      setContractorDays(savedReturn.contractorDays || '');
      setDailyHours(savedReturn.dailyHours || '8hrs. And 2Hrs spread over-time.');
      setWeeklyHoliday(savedReturn.weeklyHoliday || 'Yes. On Sunday.');
      setHolidayPaid(savedReturn.holidayPaid || 'Yes.');
      setLwfMen(savedReturn.lwfMen || '');
      setLwfWomen(savedReturn.lwfWomen || '');
      setCanteen(savedReturn.canteen || 'Provided');
      setRestRoom(savedReturn.restRoom || 'Provided');
      setDrinkingWater(savedReturn.drinkingWater || 'Provided');
      setCreches(savedReturn.creches || 'N/A');
      setFirstAid(savedReturn.firstAid || 'Provided');
      setLicenceNo(savedReturn.licenceNo || 'KOL01/CLL/001435, DT-27.11.2020, P.S-TARATALA, Ward-79');
      setPrincipalAddress(savedReturn.principalAddress || '');
      setSavedId(savedReturn.id);
    } else {
      setRefNumber('');
      setLetterDate('');
      setFormDate('');
      setContractFrom('');
      setContractTo('');
      setPrincipalDays('');
      setContractorDays('');
      setDailyHours('8hrs. And 2Hrs spread over-time.');
      setWeeklyHoliday('Yes. On Sunday.');
      setHolidayPaid('Yes.');
      setLwfMen('');
      setLwfWomen('');
      setCanteen('Provided');
      setRestRoom('Provided');
      setDrinkingWater('Provided');
      setCreches('N/A');
      setFirstAid('Provided');
      setLicenceNo('KOL01/CLL/001435, DT-27.11.2020, P.S-TARATALA, Ward-79');
      const c = clientNames.find((cl: any) => cl.name === selectedClient);
      setPrincipalAddress(c?.address || '');
      setSavedId(null);
    }
  }, [savedReturn]);

  const handleClientChange = (val: string) => {
    setSelectedClient(val);
    const c = clientNames.find((cl: any) => cl.name === val);
    if (!savedReturn) setPrincipalAddress(c?.address || "");
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/half-yearly-returns', {
        clientName: selectedClient, halfYear, year,
        refNumber, letterDate, formDate, contractFrom, contractTo,
        principalDays, contractorDays, dailyHours, weeklyHoliday, holidayPaid,
        lwfMen, lwfWomen, canteen, restRoom, drinkingWater, creches, firstAid,
        licenceNo, principalAddress,
      });
    },
    onSuccess: () => {
      toast({ title: 'Saved', description: 'Half-Yearly Return saved successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/half-yearly-returns/lookup', selectedClient, halfYear, year] });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to save', variant: 'destructive' });
    },
  });
  const months = halfYear === 'H1' ? [1, 2, 3, 4, 5, 6] : [7, 8, 9, 10, 11, 12];
  const halfLabel = halfYear === 'H1' ? `30th June- ${year}` : `31st December- ${year}`;

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ['/api/employees', selectedClient],
    queryFn: async () => {
      const res = await fetch(`/api/employees?clientName=${encodeURIComponent(selectedClient)}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    enabled: !!selectedClient,
  });

  const { data: salaryRecords = [] } = useQuery<SalaryRecord[]>({
    queryKey: ['/api/salary/half-yearly', selectedClient, year, halfYear],
    queryFn: async () => {
      const res = await fetch(`/api/salary?clientName=${encodeURIComponent(selectedClient)}&year=${year}&months=${months.join(',')}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    enabled: !!selectedClient,
  });

  const computed = useMemo(() => {
    const periodStart = new Date(Number(year), halfYear === 'H1' ? 0 : 6, 1);
    const relevantEmps = employees.filter(e => {
      if (!e.leavingDate) return true;
      return new Date(e.leavingDate) >= periodStart;
    });
    const menEmps = relevantEmps.filter(e => (e.gender || 'Male') !== 'Female');
    const womenEmps = relevantEmps.filter(e => (e.gender || 'Male') === 'Female');
    const menIds = new Set(menEmps.map(e => e.id));
    const womenIds = new Set(womenEmps.map(e => e.id));

    const menRecords = salaryRecords.filter(r => menIds.has(r.employeeId));
    const womenRecords = salaryRecords.filter(r => womenIds.has(r.employeeId));

    const menDays = menRecords.reduce((s, r) => s + Number(r.daysWorked || 0), 0);
    const womenDays = womenRecords.reduce((s, r) => s + Number(r.daysWorked || 0), 0);
    const totalDays = menDays + womenDays;

    const menWages = menRecords.reduce((s, r) => s + Math.round(Number(r.grossWage || 0)), 0);
    const womenWages = womenRecords.reduce((s, r) => s + Math.round(Number(r.grossWage || 0)), 0);
    const totalWages = menWages + womenWages;

    const menPF = menRecords.reduce((s, r) => s + Math.round(Number(r.pfDeduction || 0)), 0);
    const womenPF = womenRecords.reduce((s, r) => s + Math.round(Number(r.pfDeduction || 0)), 0);
    const menESI = menRecords.reduce((s, r) => s + Math.round(Number(r.esicDeduction || 0)), 0);
    const womenESI = womenRecords.reduce((s, r) => s + Math.round(Number(r.esicDeduction || 0)), 0);
    const menPT = menRecords.reduce((s, r) => s + Math.round(Number(r.professionalTax || 0)), 0);
    const womenPT = womenRecords.reduce((s, r) => s + Math.round(Number(r.professionalTax || 0)), 0);

    const menOT = menRecords.reduce((s, r) => s + Number(r.overtimeHours || 0), 0);
    const womenOT = womenRecords.reduce((s, r) => s + Number(r.overtimeHours || 0), 0);
    const totalOT = menOT + womenOT;

    let contractorWorkingDays = 0;
    for (const m of months) {
      const monthRecs = salaryRecords.filter(r => Number(r.month) === m && Number(r.year) === year);
      if (monthRecs.length > 0) {
        const maxDays = Math.max(...monthRecs.map(r => Number(r.daysWorked || 0)));
        contractorWorkingDays += Math.round(maxDays);
      }
    }

    return {
      menCount: menEmps.length, womenCount: womenEmps.length, totalCount: relevantEmps.length,
      menDays: Math.round(menDays), womenDays: Math.round(womenDays), totalDays: Math.round(totalDays),
      menWages, womenWages, totalWages,
      menPF, womenPF, totalPF: menPF + womenPF,
      menESI, womenESI, totalESI: menESI + womenESI,
      menPT, womenPT, totalPT: menPT + womenPT,
      totalOT: Math.round(totalOT),
      contractorWorkingDays,
    };
  }, [employees, salaryRecords, months, year]);

  const fmtDate = (d: string) => d ? d.split('-').reverse().join('-') : '____________';
  const fmtAmt = (n: number) => n ? `${n.toLocaleString('en-IN')}/-` : 'NIL';

  const handleRecalculate = () => {
    if (!contractFrom || !contractTo) return;
    const fromDate = new Date(contractFrom);
    const toDate = new Date(contractTo);
    let workingDays = 0;
    const relevantEmps = employees.filter((e: Employee) => {
      if (!e.leavingDate) return true;
      return new Date(e.leavingDate) >= fromDate;
    });
    const menIds = new Set(relevantEmps.filter((e: Employee) => (e.gender || 'Male') !== 'Female').map((e: Employee) => e.id));
    const womenIds = new Set(relevantEmps.filter((e: Employee) => (e.gender || 'Male') === 'Female').map((e: Employee) => e.id));
    let totalLwfMen = 0;
    let totalLwfWomen = 0;
    for (const m of months) {
      const monthStart = new Date(year, m - 1, 1);
      const monthEnd = new Date(year, m, 0);
      if (monthEnd < fromDate || monthStart > toDate) continue;
      const monthRecs = salaryRecords.filter(r => Number(r.month) === m && Number(r.year) === year);
      if (monthRecs.length > 0) {
        const maxDays = Math.max(...monthRecs.map(r => Number(r.daysWorked || 0)));
        workingDays += Math.round(maxDays);
      }
      for (const r of monthRecs) {
        const lwfVal = Math.round(Number(r.lwf || 0));
        if (menIds.has(r.employeeId)) totalLwfMen += lwfVal;
        else if (womenIds.has(r.employeeId)) totalLwfWomen += lwfVal;
      }
    }
    setContractorDays(String(workingDays));
    setPrincipalDays(String(workingDays));
    setLwfMen(String(totalLwfMen));
    setLwfWomen(String(totalLwfWomen));
  };

  const handlePrintCover = () => {
    const el = document.getElementById('hy-cover-print');
    if (!el) return;
    const pw = window.open('', '_blank');
    if (!pw) return;
    pw.document.write(`<!DOCTYPE html><html><head><title>Half-Yearly Return Cover - ${selectedClient}</title>
      <style>
        @page { size: A4 portrait; margin: 20mm; }
        body { margin: 0; padding: 0; font-family: 'Times New Roman', Georgia, serif; font-size: 13px; line-height: 1.7; color: #000; }
        .header { text-align: center; margin-bottom: 20px; }
        .header h2 { font-size: 16px; font-weight: bold; margin: 0; }
        .header p { font-size: 10px; margin: 2px 0; }
        .ref-line { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 13px; }
        p { margin: 3px 0; }
        .subject { text-align: center; font-weight: bold; margin: 15px 0; }
        .footer-note { text-align: center; font-size: 10px; margin-top: 40px; color: #666; }
      </style>
    </head><body>${el.innerHTML}</body></html>`);
    pw.document.close();
    pw.onload = () => { pw.print(); pw.onafterprint = () => pw.close(); };
  };

  const handlePrintForm = () => {
    const el = document.getElementById('hy-form-print');
    if (!el) return;
    const pw = window.open('', '_blank');
    if (!pw) return;
    pw.document.write(`<!DOCTYPE html><html><head><title>Form XXIV - ${selectedClient} - ${halfLabel}</title>
      <style>
        @page { size: A4 portrait; margin: 12mm 15mm; }
        body { margin: 0; padding: 0; font-family: 'Times New Roman', Georgia, serif; font-size: 11px; line-height: 1.3; color: #000; }
        .form-title { text-align: center; margin-bottom: 4px; }
        .form-title h3 { font-size: 13px; font-weight: bold; margin: 2px 0; }
        .form-title p { font-size: 10px; margin: 1px 0; }
        .licence { text-align: center; font-size: 9px; margin-bottom: 4px; }
        table.fields { width: 100%; border-collapse: collapse; font-size: 10.5px; }
        table.fields td { padding: 1.5px 4px; vertical-align: top; }
        table.fields td.label { width: 45%; }
        table.fields td.value { width: 55%; }
        .sub-table { border-collapse: collapse; font-size: 10.5px; }
        .sub-table td, .sub-table th { padding: 1px 5px; text-align: left; }
        .signature { display: flex; justify-content: space-between; margin-top: 20px; font-size: 10.5px; }
        p { margin: 1px 0; }
        .spacer td { height: 2px !important; }
      </style>
    </head><body>${el.innerHTML}</body></html>`);
    pw.document.close();
    pw.onload = () => { pw.print(); pw.onafterprint = () => pw.close(); };
  };

  return (
    <Layout>
      <div className="space-y-4 max-w-7xl mx-auto px-2 sm:px-4 pb-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link href="/registers">
              <Button variant="ghost" size="icon" className="shrink-0" data-testid="button-back">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold text-slate-800 dark:text-slate-200 truncate" data-testid="text-title">Half-Yearly Return (Form XXIV)</h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Rule 82(1) - Contractor to Licensing Officer</p>
            </div>
          </div>
          {selectedClient && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} size="sm" className="gap-2" data-testid="button-save">
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {savedId ? 'Update' : 'Save'}
              </Button>
              <Button onClick={handlePrintCover} variant="outline" size="sm" className="gap-2" data-testid="button-print-cover">
                <Printer className="w-4 h-4" /> Cover Letter
              </Button>
              <Button onClick={handlePrintForm} variant="outline" size="sm" className="gap-2" data-testid="button-print-form">
                <Printer className="w-4 h-4" /> Form XXIV
              </Button>
            </div>
          )}
        </div>

        <Card className="no-print border-blue-200 shadow-sm">
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5" /> Company / Client
                  </Label>
                  <Select value={selectedClient} onValueChange={handleClientChange}>
                    <SelectTrigger data-testid="select-client"><SelectValue placeholder="Select Company" /></SelectTrigger>
                    <SelectContent>
                      {clientNames.map(c => (
                        <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-blue-700 dark:text-blue-300">Year</Label>
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger data-testid="select-year"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 5 }, (_, i) => currentYear - 2 + i).map(y => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-blue-700 dark:text-blue-300">Half Year</Label>
                  <Select value={halfYear} onValueChange={setHalfYear}>
                    <SelectTrigger data-testid="select-half"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="H1">Jan - Jun (30th June)</SelectItem>
                      <SelectItem value="H2">Jul - Dec (31st Dec)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-blue-700 dark:text-blue-300">Ref. Number</Label>
                  <Input value={refNumber} onChange={e => setRefNumber(e.target.value)} placeholder="DJ/KOL/25/00030" data-testid="input-ref" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-blue-700 dark:text-blue-300">Letter Date</Label>
                  <Input type="date" value={letterDate} onChange={e => setLetterDate(e.target.value)} data-testid="input-letter-date" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {selectedClient && (
          <>
            <Card className="no-print border-blue-200 shadow-sm">
              <CardContent className="p-4">
                <h3 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-3">Form XXIV Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Licence No.</Label>
                    <Input value={licenceNo} onChange={e => setLicenceNo(e.target.value)} data-testid="input-licence" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Principal Employer Address</Label>
                    <Input value={principalAddress} onChange={e => setPrincipalAddress(e.target.value)} placeholder="Ward.79, PS - Taratala, Kolkata- 700088" data-testid="input-principal-addr" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Contract From</Label>
                    <Input type="date" value={contractFrom} onChange={e => setContractFrom(e.target.value)} data-testid="input-contract-from" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Contract To</Label>
                    <Input type="date" value={contractTo} onChange={e => setContractTo(e.target.value)} data-testid="input-contract-to" />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={handleRecalculate} disabled={!contractFrom || !contractTo || !selectedClient} className="w-full" data-testid="button-recalculate">
                      <RefreshCw className="h-4 w-4 mr-2" /> Recalculate Days
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Principal Employer Days Worked</Label>
                    <Input value={principalDays} onChange={e => setPrincipalDays(e.target.value)} placeholder="Auto after Recalculate" className={principalDays ? "bg-green-50 dark:bg-green-950/20 font-semibold" : ""} data-testid="input-principal-days" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Contractor Days Worked</Label>
                    <Input value={contractorDays} onChange={e => setContractorDays(e.target.value)} placeholder="Auto after Recalculate" className={contractorDays ? "bg-green-50 dark:bg-green-950/20 font-semibold" : ""} data-testid="input-contractor-days" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Daily Hours & Spread Over</Label>
                    <Input value={dailyHours} onChange={e => setDailyHours(e.target.value)} data-testid="input-daily-hours" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Weekly Holiday</Label>
                    <Input value={weeklyHoliday} onChange={e => setWeeklyHoliday(e.target.value)} data-testid="input-weekly-holiday" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Holiday Paid?</Label>
                    <Input value={holidayPaid} onChange={e => setHolidayPaid(e.target.value)} data-testid="input-holiday-paid" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">LWF Men (auto from salary)</Label>
                    <Input value={lwfMen} onChange={e => setLwfMen(e.target.value)} placeholder="Auto after Recalculate" className={lwfMen ? "bg-green-50 dark:bg-green-950/20 font-semibold" : ""} data-testid="input-lwf-men" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">LWF Women (auto from salary)</Label>
                    <Input value={lwfWomen} onChange={e => setLwfWomen(e.target.value)} placeholder="Auto after Recalculate" className={lwfWomen ? "bg-green-50 dark:bg-green-950/20 font-semibold" : ""} data-testid="input-lwf-women" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Form Date</Label>
                    <Input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} data-testid="input-form-date" />
                  </div>
                </div>
                <h4 className="text-xs font-bold text-blue-800 dark:text-blue-300 mt-4 mb-2">Facilities Provided</h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Canteen</Label>
                    <Input value={canteen} onChange={e => setCanteen(e.target.value)} data-testid="input-canteen" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Rest Room</Label>
                    <Input value={restRoom} onChange={e => setRestRoom(e.target.value)} data-testid="input-restroom" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Drinking Water</Label>
                    <Input value={drinkingWater} onChange={e => setDrinkingWater(e.target.value)} data-testid="input-water" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Crèches</Label>
                    <Input value={creches} onChange={e => setCreches(e.target.value)} data-testid="input-creches" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">First-aid</Label>
                    <Input value={firstAid} onChange={e => setFirstAid(e.target.value)} data-testid="input-firstaid" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="no-print border-blue-200 shadow-sm">
              <CardContent className="p-4">
                <h3 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-3">Auto-Calculated Summary (from Salary Records)</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse" data-testid="table-summary">
                    <thead>
                      <tr className="bg-blue-50 dark:bg-blue-950">
                        <th className="border border-blue-200 px-3 py-2 text-left font-bold text-blue-800 dark:text-blue-200"></th>
                        <th className="border border-blue-200 px-3 py-2 text-left font-bold text-blue-800 dark:text-blue-200">Men</th>
                        <th className="border border-blue-200 px-3 py-2 text-left font-bold text-blue-800 dark:text-blue-200">Women</th>
                        <th className="border border-blue-200 px-3 py-2 text-left font-bold text-blue-800 dark:text-blue-200">Children</th>
                        <th className="border border-blue-200 px-3 py-2 text-left font-bold text-blue-800 dark:text-blue-200">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-slate-200 px-3 py-1.5 font-semibold">Max Labour Any Day</td>
                        <td className="border border-slate-200 px-3 py-1.5">{computed.menCount}</td>
                        <td className="border border-slate-200 px-3 py-1.5">{computed.womenCount}</td>
                        <td className="border border-slate-200 px-3 py-1.5">NIL</td>
                        <td className="border border-slate-200 px-3 py-1.5 font-bold">{computed.totalCount}</td>
                      </tr>
                      <tr className="bg-slate-50 dark:bg-slate-800/30">
                        <td className="border border-slate-200 px-3 py-1.5 font-semibold">Man-Days Worked</td>
                        <td className="border border-slate-200 px-3 py-1.5">{computed.menDays}</td>
                        <td className="border border-slate-200 px-3 py-1.5">{computed.womenDays}</td>
                        <td className="border border-slate-200 px-3 py-1.5">NIL</td>
                        <td className="border border-slate-200 px-3 py-1.5 font-bold">{computed.totalDays}</td>
                      </tr>
                      <tr>
                        <td className="border border-slate-200 px-3 py-1.5 font-semibold">Wages Paid</td>
                        <td className="border border-slate-200 px-3 py-1.5">{computed.menWages.toLocaleString('en-IN')}/-</td>
                        <td className="border border-slate-200 px-3 py-1.5">{computed.womenWages.toLocaleString('en-IN')}/-</td>
                        <td className="border border-slate-200 px-3 py-1.5">NIL</td>
                        <td className="border border-slate-200 px-3 py-1.5 font-bold">{computed.totalWages.toLocaleString('en-IN')}/-</td>
                      </tr>
                      <tr className="bg-slate-50 dark:bg-slate-800/30">
                        <td className="border border-slate-200 px-3 py-1.5 font-semibold">PF Deduction</td>
                        <td className="border border-slate-200 px-3 py-1.5">{fmtAmt(computed.menPF)}</td>
                        <td className="border border-slate-200 px-3 py-1.5">{fmtAmt(computed.womenPF)}</td>
                        <td className="border border-slate-200 px-3 py-1.5">NIL</td>
                        <td className="border border-slate-200 px-3 py-1.5 font-bold">{fmtAmt(computed.totalPF)}</td>
                      </tr>
                      <tr>
                        <td className="border border-slate-200 px-3 py-1.5 font-semibold">ESI Deduction</td>
                        <td className="border border-slate-200 px-3 py-1.5">{fmtAmt(computed.menESI)}</td>
                        <td className="border border-slate-200 px-3 py-1.5">{fmtAmt(computed.womenESI)}</td>
                        <td className="border border-slate-200 px-3 py-1.5">NIL</td>
                        <td className="border border-slate-200 px-3 py-1.5 font-bold">{fmtAmt(computed.totalESI)}</td>
                      </tr>
                      <tr className="bg-slate-50 dark:bg-slate-800/30">
                        <td className="border border-slate-200 px-3 py-1.5 font-semibold">P.Tax Deduction</td>
                        <td className="border border-slate-200 px-3 py-1.5">{fmtAmt(computed.menPT)}</td>
                        <td className="border border-slate-200 px-3 py-1.5">{fmtAmt(computed.womenPT)}</td>
                        <td className="border border-slate-200 px-3 py-1.5">NIL</td>
                        <td className="border border-slate-200 px-3 py-1.5 font-bold">{fmtAmt(computed.totalPT)}</td>
                      </tr>
                      <tr>
                        <td className="border border-slate-200 px-3 py-1.5 font-semibold">LWF</td>
                        <td className="border border-slate-200 px-3 py-1.5">{lwfMen ? `${lwfMen}/-` : 'NIL'}</td>
                        <td className="border border-slate-200 px-3 py-1.5">{lwfWomen ? `${lwfWomen}/-` : 'NIL'}</td>
                        <td className="border border-slate-200 px-3 py-1.5">NIL</td>
                        <td className="border border-slate-200 px-3 py-1.5 font-bold">{(Number(lwfMen || 0) + Number(lwfWomen || 0)) ? `${Number(lwfMen || 0) + Number(lwfWomen || 0)}/-` : 'NIL'}</td>
                      </tr>
                      <tr className="bg-slate-50 dark:bg-slate-800/30">
                        <td className="border border-slate-200 px-3 py-1.5 font-semibold">Overtime Hours</td>
                        <td className="border border-slate-200 px-3 py-1.5" colSpan={3}></td>
                        <td className="border border-slate-200 px-3 py-1.5 font-bold">{computed.totalOT} Hrs.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <div id="hy-cover-print" className="hidden">
              <div className="header">
                <h2>DJ HOSPITALITY & FACILITY MANAGEMENT PRIVATE LIMITED</h2>
                <p>Ph.: +91 8668673870 | Email: djfoods15@yahoo.in | Sales@djfoods.in | Web: www.djfoods.in</p>
                <p>Regd. & Head Office: 730, Tin Made, Sodiem Siolim, Mapusa Bardez, North Goa-403502, India</p>
                <p>Branch Office: 7 Crematorium Street, Kolkata- 700014</p>
                <p style={{ fontSize: '9px' }}>CIN: U74910GA2020PTC014271</p>
              </div>
              <div className="ref-line">
                <span>Ref. {refNumber || '___________'}</span>
                <span>Date: {fmtDate(letterDate)}</span>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <p>To</p>
                <p><strong>The Labour Commissioner</strong></p>
                <p>Officer of the Labour Commissioner</p>
                <p>6 Church Lane, 3rd Floor</p>
                <p>Kolkata – 700001</p>
              </div>
              <div className="subject">
                <p>Subject: Half-Yearly Return to be sent by the</p>
                <p>Contractor to the Licensing Officer – {halfLabel}</p>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <p>Dear Sir,</p>
                <p>Please find enclosed the following return pertaining to our establishment, DJ Hospitality & Facility Management Pvt Ltd, 7 Crematorium Street, Kolkata – 700014</p>
                <p style={{ marginTop: '10px', fontWeight: 'bold' }}>Form – FORM XXIV Rule 82(1)</p>
                <p style={{ marginTop: '10px' }}>We kindly request you to acknowledge receipt of this submission.</p>
              </div>
              <div style={{ marginTop: '50px' }}>
                <p>Thanking you.</p>
                <p>Yours faithfully,</p>
                <p style={{ marginTop: '25px', fontWeight: 'bold' }}>Wahid Ahmad</p>
                <p>Zonal Manager & Partner</p>
                <p style={{ fontWeight: 'bold' }}>DJ Hospitality & Facility Management Pvt Ltd</p>
              </div>
              <div className="footer-note">Page 1 of 1</div>
            </div>

            <div id="hy-form-print" className="hidden">
              <div className="licence">Licence No. {licenceNo}</div>
              <div className="form-title">
                <h3>FORM XXIV</h3>
                <p>[See Rule 82(1)]</p>
                <p>Return to be sent by the Contractor to the Licencing Officer</p>
                <p style={{ textAlign: 'right', fontSize: '12px', fontWeight: 'bold' }}>Half-yearly ending {halfLabel}</p>
              </div>
              <table className="fields">
                <tbody>
                  <tr>
                    <td className="label">1. Name and Address of contractor</td>
                    <td className="value">: M/s DJ HOSPITALITY & FACILITY MANAGEMENT PRIVATE LIMITED<br />Ward.60, PS - Beniapukur, Kolkata-700014</td>
                  </tr>
                  <tr className="spacer"><td colSpan={2}></td></tr>
                  <tr>
                    <td className="label">2. Name and Address of the establishment</td>
                    <td className="value">: M/s DJ HOSPITALITY & FACILITY MANAGEMENT PRIVATE LIMITED<br />Ward.60, PS - Beniapukur, Kolkata-700014</td>
                  </tr>
                  <tr className="spacer"><td colSpan={2}></td></tr>
                  <tr>
                    <td className="label">3. Name and Address of the principal Employer</td>
                    <td className="value">: {selectedClient.toUpperCase()}<br />{principalAddress || '________________________________'}</td>
                  </tr>
                  <tr className="spacer"><td colSpan={2}></td></tr>
                  <tr>
                    <td className="label">4. Duration of contract</td>
                    <td className="value">: From <u>{fmtDate(contractFrom)}</u> to <u>{fmtDate(contractTo)}</u></td>
                  </tr>
                  <tr className="spacer"><td colSpan={2}></td></tr>
                  <tr>
                    <td className="label">5. Number of days during the half years on which<br />(a) The establishment of the principal Employer had worked</td>
                    <td className="value">: {principalDays || '____'} Days.</td>
                  </tr>
                  <tr>
                    <td className="label" style={{ paddingLeft: '20px' }}>(b) The contractor's establishment had worked</td>
                    <td className="value">: {contractorDays || '____'} Days.</td>
                  </tr>
                  <tr className="spacer"><td colSpan={2}></td></tr>
                  <tr>
                    <td className="label">6. Maximum number of contract labour any day during the half year</td>
                    <td className="value">
                      <table className="sub-table">
                        <thead><tr><th>Men</th><th>Women</th><th>Children</th><th>Total</th></tr></thead>
                        <tbody><tr><td>{computed.menCount}</td><td>{computed.womenCount}</td><td>NIL</td><td>{computed.totalCount}</td></tr></tbody>
                      </table>
                    </td>
                  </tr>
                  <tr className="spacer"><td colSpan={2}></td></tr>
                  <tr>
                    <td className="label">7. (i) Daily hours of work and spread over-</td>
                    <td className="value">: {dailyHours}</td>
                  </tr>
                  <tr>
                    <td className="label" style={{ paddingLeft: '20px' }}>(ii) (a) Whether weekly holiday observed and on what day?</td>
                    <td className="value">: {weeklyHoliday}</td>
                  </tr>
                  <tr>
                    <td className="label" style={{ paddingLeft: '34px' }}>(b) If so, whether it was paid for?</td>
                    <td className="value">: {holidayPaid}</td>
                  </tr>
                  <tr>
                    <td className="label" style={{ paddingLeft: '20px' }}>(iii) Number of man-hours of over-time Worked</td>
                    <td className="value">: {computed.totalOT} Hrs.</td>
                  </tr>
                  <tr className="spacer"><td colSpan={2}></td></tr>
                  <tr>
                    <td className="label">8. Number of man-days worked by</td>
                    <td className="value">
                      <table className="sub-table">
                        <thead><tr><th>Men</th><th>Women</th><th>Children</th><th>Total</th></tr></thead>
                        <tbody><tr><td>{computed.menDays}</td><td>{computed.womenDays}</td><td>NIL</td><td>{computed.totalDays}</td></tr></tbody>
                      </table>
                    </td>
                  </tr>
                  <tr className="spacer"><td colSpan={2}></td></tr>
                  <tr>
                    <td className="label">9. Amount of Wages paid</td>
                    <td className="value">
                      <table className="sub-table">
                        <thead><tr><th>Men</th><th>Women</th><th>Children</th><th>Total</th></tr></thead>
                        <tbody><tr><td>{fmtAmt(computed.menWages)}</td><td>{fmtAmt(computed.womenWages)}</td><td>NIL</td><td>{fmtAmt(computed.totalWages)}</td></tr></tbody>
                      </table>
                    </td>
                  </tr>
                  <tr className="spacer"><td colSpan={2}></td></tr>
                  <tr>
                    <td className="label">10. Amount of deduction from wages, if any</td>
                    <td className="value">
                      <table className="sub-table">
                        <thead><tr><th></th><th>Men</th><th>Women</th><th>Children</th><th>Total</th></tr></thead>
                        <tbody>
                          <tr><td style={{ fontWeight: 'bold' }}>PF</td><td>{fmtAmt(computed.menPF)}</td><td>{fmtAmt(computed.womenPF)}</td><td>NIL</td><td>{fmtAmt(computed.totalPF)}</td></tr>
                          <tr><td style={{ fontWeight: 'bold' }}>ESI</td><td>{fmtAmt(computed.menESI)}</td><td>{fmtAmt(computed.womenESI)}</td><td>NIL</td><td>{fmtAmt(computed.totalESI)}</td></tr>
                          <tr><td style={{ fontWeight: 'bold' }}>P.Tax</td><td>{fmtAmt(computed.menPT)}</td><td>{fmtAmt(computed.womenPT)}</td><td>NIL</td><td>{fmtAmt(computed.totalPT)}</td></tr>
                          <tr><td style={{ fontWeight: 'bold' }}>LWF</td><td>{lwfMen ? `${lwfMen}/-` : 'NIL'}</td><td>{lwfWomen ? `${lwfWomen}/-` : 'NIL'}</td><td>NIL</td><td>{(Number(lwfMen || 0) + Number(lwfWomen || 0)) ? `${Number(lwfMen || 0) + Number(lwfWomen || 0)}/-` : 'NIL'}</td></tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>
                  <tr className="spacer"><td colSpan={2}></td></tr>
                  <tr>
                    <td className="label">11. Whether the following have been provided</td>
                    <td className="value"></td>
                  </tr>
                  <tr>
                    <td className="label" style={{ paddingLeft: '20px' }}>(i) Canteen</td>
                    <td className="value">: {canteen}</td>
                  </tr>
                  <tr>
                    <td className="label" style={{ paddingLeft: '20px' }}>(ii) Rest room</td>
                    <td className="value">: {restRoom}</td>
                  </tr>
                  <tr>
                    <td className="label" style={{ paddingLeft: '20px' }}>(iii) Drinking water</td>
                    <td className="value">: {drinkingWater}</td>
                  </tr>
                  <tr>
                    <td className="label" style={{ paddingLeft: '20px' }}>(iv) Crèches</td>
                    <td className="value">: {creches}</td>
                  </tr>
                  <tr>
                    <td className="label" style={{ paddingLeft: '20px' }}>(v) First-aid</td>
                    <td className="value">: {firstAid}</td>
                  </tr>
                </tbody>
              </table>
              <p style={{ fontSize: '9px', fontStyle: 'italic', marginTop: '4px' }}>(If the Answer is "yes" state briefly standards provided)</p>
              <div className="signature">
                <div>
                  <p>Place : Kolkata</p>
                  <p>Date : {fmtDate(formDate)}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p>Signature of Contractor.</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
