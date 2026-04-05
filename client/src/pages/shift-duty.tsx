import { useState, useMemo } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, Download, CalendarDays, Users, RefreshCw, LayoutGrid, Table2, ChevronDown, ChevronUp, Printer } from "lucide-react";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WEEKDAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const WEEK_OFF_SHORT: Record<string, string> = {
  Sunday: "Sun", Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed",
  Thursday: "Thu", Friday: "Fri", Saturday: "Sat",
};

const SHIFTS: { code: string; label: string; bg: string; textColor: string; border: string }[] = [
  { code: "",   label: "—",              bg: "#f3f4f6", textColor: "#9ca3af", border: "#e5e7eb" },
  { code: "A",  label: "Morning 6 Am",  bg: "#dbeafe", textColor: "#1d4ed8", border: "#93c5fd" },
  { code: "AA", label: "Morning 7 Am",  bg: "#bfdbfe", textColor: "#1e40af", border: "#60a5fa" },
  { code: "B",  label: "Evening 11 Am", bg: "#ffedd5", textColor: "#c2410c", border: "#fdba74" },
  { code: "BB", label: "Evening 2 Pm",  bg: "#fef3c7", textColor: "#b45309", border: "#fcd34d" },
  { code: "C",  label: "Night 10 Pm",   bg: "#f3e8ff", textColor: "#7e22ce", border: "#c4b5fd" },
  { code: "G",  label: "General 9 Am",  bg: "#dcfce7", textColor: "#15803d", border: "#86efac" },
  { code: "O",  label: "Off",            bg: "#e2e8f0", textColor: "#475569", border: "#cbd5e1" },
];

const shiftStyle = (code: string) => SHIFTS.find(s => s.code === code) ?? SHIFTS[0];

function getDaysInMonth(month: number, year: number) { return new Date(year, month, 0).getDate(); }
function getDayOfWeek(year: number, month: number, day: number) { return WEEKDAYS[new Date(year, month - 1, day).getDay()]; }

function buildCalendarGrid(month: number, year: number, daysInMonth: number): (number | null)[][] {
  const startDow = new Date(year, month - 1, 1).getDay();
  const grid: (number | null)[][] = [];
  let week: (number | null)[] = Array(startDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d);
    if (week.length === 7) { grid.push(week); week = []; }
  }
  if (week.length > 0) { while (week.length < 7) week.push(null); grid.push(week); }
  return grid;
}

interface Employee {
  id: number; name: string; employeeCode: string; department: string;
  designation: string; clientName: string; isActive: boolean;
  weeklyOffDay?: string | null;
}
interface ShiftRow {
  id?: number; employeeId: number; month: number; year: number;
  [key: string]: any;
}

export default function ShiftDuty() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [deptFilter, setDeptFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [expandedCards, setExpandedCards] = useState<Record<number, boolean>>({});

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 1 + i);
  const daysInMonth = getDaysInMonth(month, year);
  const calendarGrid = useMemo(() => buildCalendarGrid(month, year, daysInMonth), [month, year, daysInMonth]);

  const { data: employees = [], isLoading: empLoading } = useQuery<Employee[]>({
    queryKey: ['/api/employees'],
    queryFn: async () => { const r = await fetch('/api/employees', { credentials: 'include' }); return r.json(); },
  });

  const { data: shiftRows = [], isLoading: shiftLoading, refetch } = useQuery<ShiftRow[]>({
    queryKey: ['/api/shift-duties', month, year],
    queryFn: async () => { const r = await fetch(`/api/shift-duties?month=${month}&year=${year}`, { credentials: 'include' }); return r.json(); },
  });

  const activeEmployees = useMemo(() => employees.filter(e => e.isActive !== false), [employees]);
  const departments = useMemo(() => [...new Set(activeEmployees.map(e => e.department).filter(Boolean))].sort(), [activeEmployees]);
  const clients = useMemo(() => [...new Set(activeEmployees.map(e => e.clientName).filter(Boolean))].sort(), [activeEmployees]);

  const filteredEmployees = useMemo(() => activeEmployees.filter(e => {
    if (deptFilter !== "all" && e.department !== deptFilter) return false;
    if (clientFilter !== "all" && e.clientName !== clientFilter) return false;
    return true;
  }), [activeEmployees, deptFilter, clientFilter]);

  // Show Client column only when there are employees from more than one client
  const multiClient = useMemo(() =>
    new Set(filteredEmployees.map(e => e.clientName).filter(Boolean)).size > 1,
  [filteredEmployees]);

  const shiftMap = useMemo(() => {
    const m: Record<number, ShiftRow> = {};
    shiftRows.forEach(r => { m[r.employeeId] = r; });
    return m;
  }, [shiftRows]);

  const empMap = useMemo(() => {
    const m: Record<number, Employee> = {};
    activeEmployees.forEach(e => { m[e.id] = e; });
    return m;
  }, [activeEmployees]);

  const [localChanges, setLocalChanges] = useState<Record<string, string>>({});

  const isAutoWeekOff = (empId: number, day: number): boolean => {
    const emp = empMap[empId];
    if (!emp?.weeklyOffDay) return false;
    const shortDay = WEEK_OFF_SHORT[emp.weeklyOffDay];
    return !!shortDay && getDayOfWeek(year, month, day) === shortDay;
  };

  const getCell = (empId: number, day: number): string => {
    const key = `${empId}-${day}`;
    if (key in localChanges) return localChanges[key];
    const row = shiftMap[empId];
    const saved = row ? (row[`day${day}`] ?? "") : "";
    if (saved) return saved;
    if (isAutoWeekOff(empId, day)) return "O";
    return "";
  };

  const cycleShift = (empId: number, day: number) => {
    const cur = getCell(empId, day);
    const idx = SHIFTS.findIndex(s => s.code === cur);
    const next = SHIFTS[(idx + 1) % SHIFTS.length];
    setLocalChanges(prev => ({ ...prev, [`${empId}-${day}`]: next.code }));
  };

  const fillRow = (empId: number, shift: string) => {
    const changes: Record<string, string> = {};
    for (let d = 1; d <= daysInMonth; d++) {
      // Never overwrite a weekly-off day with a work shift
      if (isAutoWeekOff(empId, d) && !shiftMap[empId]?.[`day${d}`]) continue;
      changes[`${empId}-${d}`] = shift;
    }
    setLocalChanges(prev => ({ ...prev, ...changes }));
  };

  const handleSaveAll = async () => {
    const grouped: Record<number, Record<string, string>> = {};
    Object.entries(localChanges).forEach(([key, val]) => {
      const [empId, day] = key.split('-').map(Number);
      if (!grouped[empId]) grouped[empId] = {};
      grouped[empId][`day${day}`] = val;
    });
    if (Object.keys(grouped).length === 0) { toast({ title: "No changes", description: "Make some changes first." }); return; }
    setSaving(true);
    try {
      await Promise.all(Object.entries(grouped).map(([empId, days]) => {
        const existing = shiftMap[Number(empId)] || {};
        const payload: any = { employeeId: Number(empId), month, year };
        for (let d = 1; d <= 31; d++) {
          const key2 = `day${d}`;
          payload[key2] = days[key2] !== undefined ? days[key2] : (existing[key2] ?? "");
        }
        return fetch('/api/shift-duties', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), credentials: 'include' });
      }));
      setLocalChanges({});
      qc.invalidateQueries({ queryKey: ['/api/shift-duties', month, year] });
      toast({ title: "Saved", description: "Shift duty chart saved successfully." });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleExportExcel = async () => {
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(`Shift Duty ${MONTHS[month-1]} ${year}`);
      const thin = { top:{style:'thin' as const}, bottom:{style:'thin' as const}, left:{style:'thin' as const}, right:{style:'thin' as const} };
      const mkFill = (argb: string) => ({ type:'pattern' as const, pattern:'solid' as const, fgColor:{argb} });
      const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
      const hdrRow = ws.addRow(['#', 'Emp Code', 'Name', 'Dept', ...(multiClient ? ['Client'] : []), ...days.map(d => `${d}\n${getDayOfWeek(year, month, d).slice(0,2)}`)]);
      ws.getRow(1).height = 32;
      hdrRow.eachCell((c: any) => {
        c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
        c.fill = mkFill('FF1e3a5f'); c.border = thin; c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      });
      ws.columns = [{ width: 4 }, { width: 12 }, { width: 22 }, { width: 14 }, ...(multiClient ? [{ width: 18 }] : []), ...days.map(() => ({ width: 5 }))];
      filteredEmployees.forEach((emp, idx) => {
        const cellVals: any[] = [idx + 1, emp.employeeCode || '', emp.name, emp.department || '', ...(multiClient ? [emp.clientName || ''] : [])];
        days.forEach(d => { cellVals.push(getCell(emp.id, d) || ''); });
        const dr = ws.addRow(cellVals);
        dr.eachCell((c: any, ci: number) => {
          c.border = thin; c.alignment = { horizontal: 'center', vertical: 'middle' };
          if (ci > 5) { const code = cellVals[ci - 1]; const st = shiftStyle(code); if (code) c.fill = mkFill(st.bg.replace('#','FF')); }
        });
        [2,3,4,5].forEach(i => { (dr.getCell(i) as any).alignment = { horizontal: 'left', vertical: 'middle' }; });
      });
      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `ShiftDuty_${MONTHS[month-1]}_${year}.xlsx`; a.click();
    } catch (err: any) { toast({ title: 'Export failed', description: err.message, variant: 'destructive' }); }
  };

  const handlePrint = () => {
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    const shiftBg: Record<string, string> = {
      A: '#dbeafe', AA: '#bfdbfe', B: '#ffedd5', BB: '#fef3c7', C: '#f3e8ff', G: '#dcfce7', O: '#e2e8f0',
    };
    const shiftColor: Record<string, string> = {
      A: '#1d4ed8', AA: '#1e40af', B: '#c2410c', BB: '#b45309', C: '#7e22ce', G: '#15803d', O: '#475569',
    };

    const headerRow = `<tr style="background:#1e3a5f;color:#fff;">
      <th style="border:1px solid #475569;padding:4px 3px;font-size:9px;text-align:center;">#</th>
      <th style="border:1px solid #475569;padding:4px 6px;font-size:9px;text-align:left;">Emp Code</th>
      <th style="border:1px solid #475569;padding:4px 6px;font-size:9px;text-align:left;min-width:120px;">Name</th>
      <th style="border:1px solid #475569;padding:4px 6px;font-size:9px;text-align:left;">Dept</th>
      ${multiClient ? `<th style="border:1px solid #475569;padding:4px 6px;font-size:9px;text-align:left;">Client</th>` : ''}
      ${days.map(d => {
        const dow = getDayOfWeek(year, month, d);
        const bg = dow === 'Sun' ? '#991b1b' : dow === 'Sat' ? '#9a3412' : '#1e3a5f';
        return `<th style="border:1px solid #475569;padding:2px 1px;font-size:8px;text-align:center;background:${bg};min-width:20px;">${d}<br/><span style="font-weight:normal;font-size:7px;">${dow.slice(0,2)}</span></th>`;
      }).join('')}
      <th style="border:1px solid #475569;padding:4px 3px;font-size:9px;text-align:center;min-width:50px;">Summ.</th>
    </tr>`;

    const bodyRows = filteredEmployees.map((emp, idx) => {
      const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      const cells = days.map(d => {
        const val = getCell(emp.id, d);
        const isWO = !(`${emp.id}-${d}` in localChanges) && val === 'O' && isAutoWeekOff(emp.id, d);
        const bg = val ? shiftBg[val] || '#f3f4f6' : '';
        const color = val ? shiftColor[val] || '#374151' : '#94a3b8';
        return `<td style="border:1px solid #e2e8f0;padding:2px 0;text-align:center;font-size:9px;font-weight:bold;background:${bg || rowBg};color:${color};">
          ${val || ''}${isWO ? '<br/><span style="font-size:6px;font-weight:normal;color:#94a3b8;">WO</span>' : ''}
        </td>`;
      }).join('');
      const counts: Record<string, number> = { A:0, AA:0, B:0, BB:0, C:0, G:0, O:0 };
      days.forEach(d => { const v = getCell(emp.id, d); if (v && counts[v] !== undefined) counts[v]++; });
      const summParts = Object.entries(counts).filter(([,v]) => v > 0)
        .map(([k, v]) => `<span style="background:${shiftBg[k]};color:${shiftColor[k]};padding:0 3px;border-radius:2px;font-size:7px;">${k}:${v}</span>`).join(' ');
      return `<tr style="background:${rowBg};">
        <td style="border:1px solid #e2e8f0;padding:3px;text-align:center;font-size:9px;color:#94a3b8;">${idx + 1}</td>
        <td style="border:1px solid #e2e8f0;padding:3px 5px;font-size:9px;font-family:monospace;">${emp.employeeCode || ''}</td>
        <td style="border:1px solid #e2e8f0;padding:3px 5px;font-size:9px;font-weight:600;">${emp.name}${emp.weeklyOffDay ? `<br/><span style="font-size:7px;color:#94a3b8;font-weight:normal;">${emp.weeklyOffDay.slice(0,3)} off</span>` : ''}</td>
        <td style="border:1px solid #e2e8f0;padding:3px 5px;font-size:8px;color:#64748b;">${emp.department || ''}</td>
        ${multiClient ? `<td style="border:1px solid #e2e8f0;padding:3px 5px;font-size:8px;color:#64748b;">${emp.clientName || ''}</td>` : ''}
        ${cells}
        <td style="border:1px solid #e2e8f0;padding:3px;text-align:center;white-space:nowrap;">${summParts}</td>
      </tr>`;
    }).join('');

    const filterNote = [
      deptFilter !== 'all' ? `Dept: ${deptFilter}` : '',
      clientFilter !== 'all' ? `Client: ${clientFilter}` : '',
    ].filter(Boolean).join(' | ');

    const legend = SHIFTS.filter(s => s.code).map(s =>
      `<span style="display:inline-block;margin-right:8px;padding:2px 8px;border-radius:10px;font-size:9px;font-weight:600;background:${s.bg};color:${s.textColor};border:1px solid ${s.border};">
        ${s.code} = ${s.label}
      </span>`
    ).join('');

    const html = `<!DOCTYPE html><html><head>
      <title>Shift Duty Chart — ${MONTHS[month-1]} ${year}</title>
      <style>
        @page { size: landscape; margin: 10mm 8mm; }
        * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
        .header { text-align: center; margin-bottom: 10px; }
        .header h1 { font-size: 14px; color: #1e3a5f; margin: 0 0 2px; }
        .header h2 { font-size: 11px; color: #475569; margin: 0 0 4px; font-weight: normal; }
        .header .meta { font-size: 9px; color: #94a3b8; }
        table { border-collapse: collapse; width: 100%; }
        .legend { margin-top: 8px; }
        .footer { margin-top: 6px; font-size: 8px; color: #94a3b8; display: flex; justify-content: space-between; }
        @media print { button { display: none; } }
      </style>
    </head><body>
      <div class="header">
        <h1>DJ Hospitality &amp; Facility Management</h1>
        <h2>Monthly Shift Duty Chart — ${MONTHS[month-1]} ${year}</h2>
        ${filterNote ? `<div class="meta">${filterNote}</div>` : ''}
      </div>
      <table>
        <thead>${headerRow}</thead>
        <tbody>${bodyRows}</tbody>
      </table>
      <div class="legend">${legend}</div>
      <div class="footer">
        <span>Total Employees: ${filteredEmployees.length}</span>
        <span>Printed: ${new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}</span>
      </div>
      <script>window.onload = function() { window.print(); window.onafterprint = function() { window.close(); }; }</script>
    </body></html>`;

    const w = window.open('', '_blank', 'width=1200,height=700');
    if (w) { w.document.write(html); w.document.close(); }
  };

  const dirtyCount = Object.keys(localChanges).length;
  const isLoading = empLoading || shiftLoading;

  const shiftCounts = useMemo(() => {
    const cnt: Record<string, number> = { A: 0, B: 0, C: 0, G: 0, O: 0 };
    filteredEmployees.forEach(emp => {
      for (let d = 1; d <= daysInMonth; d++) {
        const v = getCell(emp.id, d);
        if (v && cnt[v] !== undefined) cnt[v]++;
      }
    });
    return cnt;
  }, [filteredEmployees, daysInMonth, localChanges, shiftMap]);

  const toggleCard = (empId: number) => setExpandedCards(prev => ({ ...prev, [empId]: !prev[empId] }));

  return (
    <Layout>
      <div className="space-y-3 p-3 sm:p-4">

        {/* ── Controls bar ── */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-blue-600 shrink-0" />
            <h1 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">Shift Duty Chart</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 ml-auto">
            <Select value={String(month)} onValueChange={v => { setMonth(Number(v)); setLocalChanges({}); }}>
              <SelectTrigger className="w-28 sm:w-32 text-xs sm:text-sm" data-testid="select-month"><SelectValue /></SelectTrigger>
              <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={String(year)} onValueChange={v => { setYear(Number(v)); setLocalChanges({}); }}>
              <SelectTrigger className="w-20 sm:w-24 text-xs sm:text-sm" data-testid="select-year"><SelectValue /></SelectTrigger>
              <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="w-32 sm:w-36 text-xs sm:text-sm" data-testid="select-dept"><SelectValue placeholder="All Depts" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="w-36 sm:w-40 text-xs sm:text-sm" data-testid="select-client"><SelectValue placeholder="All Clients" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                {clients.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── Action bar ── */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <button
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors ${viewMode === "table" ? "bg-slate-700 text-white" : "bg-white dark:bg-gray-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50"}`}
              data-testid="button-view-table"
            >
              <Table2 className="w-3.5 h-3.5" /> Table
            </button>
            <button
              onClick={() => setViewMode("cards")}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors ${viewMode === "cards" ? "bg-slate-700 text-white" : "bg-white dark:bg-gray-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50"}`}
              data-testid="button-view-cards"
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Cards
            </button>
          </div>

          <Button variant="outline" size="sm" onClick={() => { setLocalChanges({}); refetch(); }} data-testid="button-refresh">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} data-testid="button-print">
            <Printer className="w-3.5 h-3.5 mr-1" /> Print
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel} data-testid="button-export">
            <Download className="w-3.5 h-3.5 mr-1" /> Excel
          </Button>
          <Button size="sm" onClick={handleSaveAll} disabled={saving || dirtyCount === 0} data-testid="button-save-all">
            {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
            Save {dirtyCount > 0 ? `(${dirtyCount})` : ''}
          </Button>
          <span className="text-xs text-muted-foreground ml-auto">
            <Users className="w-3.5 h-3.5 inline mr-1" />{filteredEmployees.length}
          </span>
        </div>

        {/* ── Legend ── */}
        <div className="flex flex-wrap gap-1.5 items-center">
          {SHIFTS.filter(s => s.code).map(s => (
            <span key={s.code} className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: s.bg, color: s.textColor, border: `1px solid ${s.border}` }}>
              {s.code} = {s.label}
            </span>
          ))}
          <span className="text-[10px] text-muted-foreground hidden sm:inline ml-1">Tap/click cell to cycle</span>
        </div>

        {/* ── Summary totals ── */}
        <div className="flex flex-wrap gap-1.5">
          {SHIFTS.filter(s => s.code).map(s => (
            <span key={s.code} className="text-xs px-2 py-0.5 rounded" style={{ background: s.bg, color: s.textColor }}>
              {s.label}: <strong>{shiftCounts[s.code] ?? 0}</strong>
            </span>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
        ) : filteredEmployees.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">No employees found</div>
        ) : viewMode === "cards" ? (

          /* ══════════════════════════════════════════
             MOBILE / CARD VIEW
          ══════════════════════════════════════════ */
          <div className="space-y-3">
            {filteredEmployees.map((emp, idx) => {
              const isOpen = expandedCards[emp.id] !== false; // default open
              const counts: Record<string, number> = { A: 0, AA: 0, B: 0, BB: 0, C: 0, G: 0, O: 0 };
              for (let d = 1; d <= daysInMonth; d++) {
                const v = getCell(emp.id, d);
                if (v && counts[v] !== undefined) counts[v]++;
              }
              const empDirty = Object.keys(localChanges).some(k => k.startsWith(`${emp.id}-`));
              return (
                <Card key={emp.id} className={`overflow-hidden border ${empDirty ? 'border-yellow-400 dark:border-yellow-600' : 'border-slate-200 dark:border-slate-700'}`} data-testid={`card-emp-${emp.id}`}>
                  {/* Card header — tap to collapse */}
                  <button
                    className="w-full text-left"
                    onClick={() => toggleCard(emp.id)}
                    data-testid={`button-toggle-card-${emp.id}`}
                  >
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
                      <span className="text-xs text-slate-400 w-5 text-center shrink-0">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate">{emp.name}</span>
                          {emp.employeeCode && <span className="text-[10px] text-slate-400 font-mono">{emp.employeeCode}</span>}
                          {emp.weeklyOffDay && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                              {emp.weeklyOffDay.slice(0,3)} off
                            </span>
                          )}
                          {empDirty && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400">unsaved</span>}
                        </div>
                        <div className="flex gap-2 mt-0.5 flex-wrap">
                          {emp.department && <span className="text-[10px] text-slate-400">{emp.department}</span>}
                          {multiClient && emp.clientName && <span className="text-[10px] text-slate-400">• {emp.clientName}</span>}
                        </div>
                      </div>
                      {/* Mini shift counts */}
                      <div className="flex gap-1 shrink-0">
                        {Object.entries(counts).filter(([,v]) => v > 0).map(([k, v]) => (
                          <span key={k} className="text-[10px] px-1 rounded font-semibold" style={{ background: shiftStyle(k).bg, color: shiftStyle(k).textColor }}>{k}:{v}</span>
                        ))}
                      </div>
                      {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
                    </div>
                  </button>

                  {isOpen && (
                    <CardContent className="p-3 space-y-3">
                      {/* Quick fill buttons */}
                      <div className="flex flex-wrap gap-1.5 items-center">
                        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Fill all:</span>
                        {SHIFTS.filter(s => s.code).map(s => (
                          <button
                            key={s.code}
                            onClick={() => fillRow(emp.id, s.code)}
                            className="text-xs px-2.5 py-1 rounded-full font-semibold transition-opacity hover:opacity-80 active:scale-95"
                            style={{ background: s.bg, color: s.textColor, border: `1px solid ${s.border}` }}
                            data-testid={`button-fill-${emp.id}-${s.code}`}
                          >
                            {s.code} {s.label}
                          </button>
                        ))}
                        <button
                          onClick={() => {
                            const changes: Record<string, string> = {};
                            for (let d = 1; d <= daysInMonth; d++) changes[`${emp.id}-${d}`] = "";
                            setLocalChanges(prev => ({ ...prev, ...changes }));
                          }}
                          className="text-xs px-2.5 py-1 rounded-full font-medium bg-red-50 text-red-500 border border-red-200 hover:opacity-80"
                          data-testid={`button-clear-${emp.id}`}
                        >
                          Clear
                        </button>
                      </div>

                      {/* Calendar grid */}
                      <div className="overflow-x-auto -mx-1">
                        <table className="border-collapse w-full min-w-[280px]">
                          <thead>
                            <tr>
                              {WEEKDAYS.map((wd, i) => (
                                <th key={wd} className={`text-[10px] font-semibold py-1 text-center w-[14.28%] ${i === 0 ? 'text-red-500' : i === 6 ? 'text-orange-500' : 'text-slate-500'}`}>
                                  {wd}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {calendarGrid.map((week, wi) => (
                              <tr key={wi}>
                                {week.map((day, di) => {
                                  if (day === null) {
                                    return <td key={di} className="p-0.5" />;
                                  }
                                  const val = getCell(emp.id, day);
                                  const st = shiftStyle(val);
                                  const isDirty = `${emp.id}-${day}` in localChanges;
                                  const isWO = !isDirty && val === "O" && isAutoWeekOff(emp.id, day);
                                  const dow = getDayOfWeek(year, month, day);
                                  const isSun = dow === "Sun";
                                  const isSat = dow === "Sat";
                                  return (
                                    <td key={di} className="p-0.5">
                                      <button
                                        onClick={() => cycleShift(emp.id, day)}
                                        className={`w-full rounded flex flex-col items-center justify-center py-1 px-0.5 transition-all active:scale-90 ${isDirty ? 'ring-2 ring-yellow-400 ring-inset' : ''}`}
                                        style={{
                                          background: val ? st.bg : isSun ? '#fee2e2' : isSat ? '#fff7ed' : '#f8fafc',
                                          color: val ? st.textColor : isSun ? '#dc2626' : isSat ? '#ea580c' : '#94a3b8',
                                          border: `1px solid ${val ? st.border : isSun ? '#fca5a5' : isSat ? '#fdba74' : '#e2e8f0'}`,
                                          minHeight: '40px',
                                        }}
                                        title={`Day ${day}: ${st.label}${isWO ? ' (Weekly Off)' : ''}`}
                                        data-testid={`cell-card-${emp.id}-${day}`}
                                      >
                                        <span className="text-[9px] font-medium opacity-60 leading-none">{day}</span>
                                        <span className="text-sm font-bold leading-tight">{val || ''}</span>
                                        {isWO && <span className="text-[8px] opacity-60 leading-none">WO</span>}
                                      </button>
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>

        ) : (

          /* ══════════════════════════════════════════
             DESKTOP / TABLE VIEW
          ══════════════════════════════════════════ */
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="border-collapse text-[11px] min-w-full">
                <thead>
                  <tr>
                    <th className="border border-slate-300 bg-slate-700 text-white px-2 py-1.5 text-left sticky left-0 z-20 min-w-[28px]">#</th>
                    <th className="border border-slate-300 bg-slate-700 text-white px-2 py-1.5 text-left sticky left-8 z-20 min-w-[80px]">Code</th>
                    <th className="border border-slate-300 bg-slate-700 text-white px-2 py-1.5 text-left sticky left-[112px] z-20 min-w-[140px]">Name</th>
                    <th className="border border-slate-300 bg-slate-700 text-white px-2 py-1.5 text-left min-w-[90px]">Dept</th>
                    {multiClient && <th className="border border-slate-300 bg-slate-700 text-white px-2 py-1.5 text-left min-w-[100px]">Client</th>}
                    <th className="border border-slate-300 bg-slate-700 text-white px-1.5 py-1 text-center min-w-[40px]">Fill</th>
                    {Array.from({ length: daysInMonth }, (_, i) => {
                      const d = i + 1;
                      const dow = getDayOfWeek(year, month, d);
                      const isSun = dow === "Sun"; const isSat = dow === "Sat";
                      return (
                        <th key={d} className={`border border-slate-300 px-1 py-0.5 text-center min-w-[28px] ${isSun ? 'bg-red-700 text-white' : isSat ? 'bg-orange-600 text-white' : 'bg-slate-700 text-white'}`}>
                          <div>{d}</div>
                          <div className="font-normal text-[9px] opacity-80">{dow.slice(0,2)}</div>
                        </th>
                      );
                    })}
                    <th className="border border-slate-300 bg-slate-700 text-white px-2 py-1.5 text-center min-w-[50px]">Summ.</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((emp, idx) => {
                    const counts: Record<string, number> = { A: 0, AA: 0, B: 0, BB: 0, C: 0, G: 0, O: 0 };
                    for (let d = 1; d <= daysInMonth; d++) {
                      const v = getCell(emp.id, d);
                      if (v && counts[v] !== undefined) counts[v]++;
                    }
                    return (
                      <tr key={emp.id} className={idx % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-slate-50 dark:bg-gray-800/50"}>
                        <td className="border border-slate-200 px-1 py-1 text-center text-slate-500 sticky left-0 z-10 bg-inherit">{idx + 1}</td>
                        <td className="border border-slate-200 px-1.5 py-1 font-mono sticky left-8 z-10 bg-inherit">{emp.employeeCode || '—'}</td>
                        <td className="border border-slate-200 px-1.5 py-1 font-medium sticky left-[112px] z-10 bg-inherit whitespace-nowrap">
                          <span>{emp.name}</span>
                          {emp.weeklyOffDay && <span className="ml-1 text-[9px] text-slate-400 font-normal">({emp.weeklyOffDay.slice(0,3)} off)</span>}
                        </td>
                        <td className="border border-slate-200 px-1.5 py-1 text-slate-600 dark:text-slate-400 whitespace-nowrap">{emp.department || '—'}</td>
                        {multiClient && <td className="border border-slate-200 px-1.5 py-1 text-slate-600 dark:text-slate-400 whitespace-nowrap text-[10px]">{emp.clientName || '—'}</td>}
                        <td className="border border-slate-200 px-1 py-1">
                          <select
                            className="text-[10px] border border-slate-300 rounded px-0.5 py-0 w-full bg-white dark:bg-gray-800"
                            value="" onChange={e => { if (e.target.value) fillRow(emp.id, e.target.value); }}
                            data-testid={`select-fill-${emp.id}`}
                          >
                            <option value="">Fill</option>
                            {SHIFTS.map(s => <option key={s.code} value={s.code}>{s.code || '—'} {s.label}</option>)}
                          </select>
                        </td>
                        {Array.from({ length: daysInMonth }, (_, i) => {
                          const d = i + 1;
                          const val = getCell(emp.id, d);
                          const st = shiftStyle(val);
                          const isDirty = `${emp.id}-${d}` in localChanges;
                          const isWO = !isDirty && val === "O" && isAutoWeekOff(emp.id, d);
                          return (
                            <td
                              key={d}
                              className="border border-slate-200 px-0 py-0 text-center cursor-pointer select-none"
                              style={{ background: val ? st.bg : undefined, color: val ? st.textColor : undefined }}
                              onClick={() => cycleShift(emp.id, d)}
                              title={`${emp.name} — Day ${d}: ${st.label}${isWO ? ' (Weekly Off)' : ''}`}
                              data-testid={`cell-shift-${emp.id}-${d}`}
                            >
                              <span className={`block w-full h-full py-0.5 font-semibold leading-none ${isDirty ? 'ring-1 ring-inset ring-yellow-400' : ''}`}>
                                <span className="block">{val || ''}</span>
                                {isWO && <span className="block text-[8px] font-normal opacity-70 leading-none">WO</span>}
                              </span>
                            </td>
                          );
                        })}
                        <td className="border border-slate-200 px-1 py-1 text-[9px] text-center">
                          {Object.entries(counts).filter(([,v]) => v > 0).map(([k, v]) => (
                            <span key={k} style={{ background: shiftStyle(k).bg, color: shiftStyle(k).textColor }} className="rounded px-0.5 mr-0.5">{k}:{v}</span>
                          ))}
                        </td>
                      </tr>
                    );
                  })}
                  {/* ── Daily summary footer row ── */}
                  {filteredEmployees.length > 0 && (() => {
                    const SHIFT_CODES = ["A","AA","B","BB","C","G","O"];
                    return (
                      <tr className="bg-slate-800 text-white sticky bottom-0 z-10">
                        <td className="border border-slate-600 px-1 py-1 text-center text-[9px] font-bold sticky left-0 bg-slate-800 z-20" colSpan={3 + (multiClient ? 1 : 0) + 1}>Daily Total</td>
                        <td className="border border-slate-600 px-1 py-1 text-[9px] text-slate-300"></td>
                        {Array.from({ length: daysInMonth }, (_, i) => {
                          const d = i + 1;
                          const dayCounts: Record<string, number> = {};
                          filteredEmployees.forEach(emp => {
                            const v = getCell(emp.id, d);
                            if (v) dayCounts[v] = (dayCounts[v] || 0) + 1;
                          });
                          return (
                            <td key={d} className="border border-slate-600 px-0 py-0.5 text-center align-top">
                              {SHIFT_CODES.filter(c => dayCounts[c]).map(c => (
                                <span key={c} className="block text-[7px] font-bold leading-tight mx-0.5 rounded"
                                  style={{ background: shiftStyle(c).bg, color: shiftStyle(c).textColor }}>
                                  {c}:{dayCounts[c]}
                                </span>
                              ))}
                            </td>
                          );
                        })}
                        <td className="border border-slate-600 px-1 py-1 text-[9px]">
                          {(() => {
                            const total: Record<string, number> = {};
                            filteredEmployees.forEach(emp => {
                              for (let d = 1; d <= daysInMonth; d++) {
                                const v = getCell(emp.id, d);
                                if (v) total[v] = (total[v] || 0) + 1;
                              }
                            });
                            return SHIFT_CODES.filter(c => total[c]).map(c => (
                              <span key={c} className="block text-[7px] font-bold leading-tight rounded"
                                style={{ background: shiftStyle(c).bg, color: shiftStyle(c).textColor }}>
                                {c}:{total[c]}
                              </span>
                            ));
                          })()}
                        </td>
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
