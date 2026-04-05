import { useState, useMemo } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, Download, CalendarDays, Users, RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WEEKDAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const SHIFTS: { code: string; label: string; color: string; bg: string; textColor: string }[] = [
  { code: "",  label: "—",       color: "bg-gray-100",   bg: "#f3f4f6", textColor: "#6b7280" },
  { code: "A", label: "Morning", color: "bg-blue-100",   bg: "#dbeafe", textColor: "#1d4ed8" },
  { code: "B", label: "Evening", color: "bg-orange-100", bg: "#ffedd5", textColor: "#c2410c" },
  { code: "C", label: "Night",   color: "bg-purple-100", bg: "#f3e8ff", textColor: "#7e22ce" },
  { code: "G", label: "General", color: "bg-green-100",  bg: "#dcfce7", textColor: "#15803d" },
  { code: "O", label: "Off",     color: "bg-slate-200",  bg: "#e2e8f0", textColor: "#475569" },
];

const shiftStyle = (code: string) => SHIFTS.find(s => s.code === code) ?? SHIFTS[0];

function getDaysInMonth(month: number, year: number) {
  return new Date(year, month, 0).getDate();
}
function getDayOfWeek(year: number, month: number, day: number) {
  return WEEKDAYS[new Date(year, month - 1, day).getDay()];
}

interface Employee {
  id: number; name: string; employeeCode: string; department: string;
  designation: string; clientName: string; isActive: boolean;
}
interface ShiftRow {
  id?: number; employeeId: number; month: number; year: number;
  employeeName?: string; employeeCode?: string; department?: string;
  designation?: string; clientName?: string;
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

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 1 + i);
  const daysInMonth = getDaysInMonth(month, year);

  const { data: employees = [], isLoading: empLoading } = useQuery<Employee[]>({
    queryKey: ['/api/employees'],
    queryFn: async () => {
      const res = await fetch('/api/employees', { credentials: 'include' });
      return res.json();
    },
  });

  const { data: shiftRows = [], isLoading: shiftLoading, refetch } = useQuery<ShiftRow[]>({
    queryKey: ['/api/shift-duties', month, year],
    queryFn: async () => {
      const res = await fetch(`/api/shift-duties?month=${month}&year=${year}`, { credentials: 'include' });
      return res.json();
    },
  });

  const activeEmployees = useMemo(() => employees.filter(e => e.isActive !== false), [employees]);
  const departments = useMemo(() => [...new Set(activeEmployees.map(e => e.department).filter(Boolean))].sort(), [activeEmployees]);
  const clients = useMemo(() => [...new Set(activeEmployees.map(e => e.clientName).filter(Boolean))].sort(), [activeEmployees]);

  const filteredEmployees = useMemo(() => activeEmployees.filter(e => {
    if (deptFilter !== "all" && e.department !== deptFilter) return false;
    if (clientFilter !== "all" && e.clientName !== clientFilter) return false;
    return true;
  }), [activeEmployees, deptFilter, clientFilter]);

  const shiftMap = useMemo(() => {
    const m: Record<number, ShiftRow> = {};
    shiftRows.forEach(r => { m[r.employeeId] = r; });
    return m;
  }, [shiftRows]);

  const [localChanges, setLocalChanges] = useState<Record<string, string>>({});

  const getCell = (empId: number, day: number): string => {
    const key = `${empId}-${day}`;
    if (key in localChanges) return localChanges[key];
    const row = shiftMap[empId];
    return row ? (row[`day${day}`] ?? "") : "";
  };

  const setCell = (empId: number, day: number, val: string) => {
    setLocalChanges(prev => ({ ...prev, [`${empId}-${day}`]: val }));
  };

  const cycleShift = (empId: number, day: number) => {
    const cur = getCell(empId, day);
    const idx = SHIFTS.findIndex(s => s.code === cur);
    const next = SHIFTS[(idx + 1) % SHIFTS.length];
    setCell(empId, day, next.code);
  };

  const fillRow = (empId: number, shift: string) => {
    const changes: Record<string, string> = {};
    for (let d = 1; d <= daysInMonth; d++) changes[`${empId}-${d}`] = shift;
    setLocalChanges(prev => ({ ...prev, ...changes }));
  };

  const handleSaveAll = async () => {
    const grouped: Record<number, Record<string, string>> = {};
    Object.entries(localChanges).forEach(([key, val]) => {
      const [empId, day] = key.split('-').map(Number);
      if (!grouped[empId]) grouped[empId] = {};
      grouped[empId][`day${day}`] = val;
    });

    if (Object.keys(grouped).length === 0) {
      toast({ title: "No changes", description: "Make some changes first." });
      return;
    }

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
      const hdrRow = ws.addRow(['#', 'Emp Code', 'Name', 'Dept', 'Client', ...days.map(d => `${d}\n${getDayOfWeek(year, month, d).slice(0,2)}`)]);
      ws.getRow(1).height = 32;
      hdrRow.eachCell((c: any, ci: number) => {
        c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
        c.fill = mkFill('FF1e3a5f'); c.border = thin; c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      });
      ws.columns = [
        { width: 4 }, { width: 12 }, { width: 22 }, { width: 14 }, { width: 18 },
        ...days.map(() => ({ width: 5 })),
      ];

      filteredEmployees.forEach((emp, idx) => {
        const cellVals: any[] = [idx + 1, emp.employeeCode || '', emp.name, emp.department || '', emp.clientName || ''];
        days.forEach(d => { cellVals.push(getCell(emp.id, d) || ''); });
        const dr = ws.addRow(cellVals);
        dr.eachCell((c: any, ci: number) => {
          c.border = thin; c.alignment = { horizontal: 'center', vertical: 'middle' };
          if (ci > 5) {
            const code = cellVals[ci - 1];
            const st = shiftStyle(code);
            if (code) c.fill = mkFill(st.bg.replace('#','FF'));
          }
        });
        (dr.getCell(2) as any).alignment = { horizontal: 'left', vertical: 'middle' };
        (dr.getCell(3) as any).alignment = { horizontal: 'left', vertical: 'middle' };
        (dr.getCell(4) as any).alignment = { horizontal: 'left', vertical: 'middle' };
        (dr.getCell(5) as any).alignment = { horizontal: 'left', vertical: 'middle' };
      });

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `ShiftDuty_${MONTHS[month-1]}_${year}.xlsx`; a.click();
    } catch (err: any) { toast({ title: 'Export failed', description: err.message, variant: 'destructive' }); }
  };

  const dirtyCount = Object.keys(localChanges).length;
  const isLoading = empLoading || shiftLoading;

  const shiftCounts = useMemo(() => {
    const cnt: Record<string, number> = { M: 0, E: 0, N: 0, G: 0, O: 0 };
    filteredEmployees.forEach(emp => {
      for (let d = 1; d <= daysInMonth; d++) {
        const v = getCell(emp.id, d);
        if (v && cnt[v] !== undefined) cnt[v]++;
      }
    });
    return cnt;
  }, [filteredEmployees, daysInMonth, localChanges, shiftMap]);

  return (
    <Layout>
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-200">Monthly Shift Duty Chart</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 ml-auto">
            <Select value={String(month)} onValueChange={v => { setMonth(Number(v)); setLocalChanges({}); }}>
              <SelectTrigger className="w-32" data-testid="select-month"><SelectValue /></SelectTrigger>
              <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={String(year)} onValueChange={v => { setYear(Number(v)); setLocalChanges({}); }}>
              <SelectTrigger className="w-24" data-testid="select-year"><SelectValue /></SelectTrigger>
              <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="w-36" data-testid="select-dept"><SelectValue placeholder="All Depts" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="w-40" data-testid="select-client"><SelectValue placeholder="All Clients" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                {clients.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => { setLocalChanges({}); refetch(); }} data-testid="button-refresh">
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportExcel} data-testid="button-export">
              <Download className="w-4 h-4 mr-1" /> Excel
            </Button>
            <Button size="sm" onClick={handleSaveAll} disabled={saving || dirtyCount === 0} data-testid="button-save-all">
              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
              Save {dirtyCount > 0 ? `(${dirtyCount})` : ''}
            </Button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-muted-foreground font-medium">Shifts:</span>
          {SHIFTS.filter(s => s.code).map(s => (
            <Badge key={s.code} style={{ background: s.bg, color: s.textColor, border: `1px solid ${s.bg}` }} className="text-xs font-semibold px-2">
              {s.code} = {s.label}
            </Badge>
          ))}
          <span className="text-xs text-muted-foreground ml-2">Click any cell to cycle shifts</span>
          <span className="text-xs text-muted-foreground ml-auto">
            <Users className="w-3.5 h-3.5 inline mr-1" />{filteredEmployees.length} employees
          </span>
        </div>

        {/* Summary badges */}
        <div className="flex flex-wrap gap-2">
          {SHIFTS.filter(s => s.code).map(s => (
            <span key={s.code} className="text-xs px-2 py-1 rounded" style={{ background: s.bg, color: s.textColor }}>
              {s.label}: <strong>{shiftCounts[s.code] ?? 0}</strong>
            </span>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
        ) : (
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="border-collapse text-[11px] min-w-full">
                <thead>
                  <tr>
                    <th className="border border-slate-300 bg-slate-700 text-white px-2 py-1.5 text-left sticky left-0 z-20 min-w-[28px]">#</th>
                    <th className="border border-slate-300 bg-slate-700 text-white px-2 py-1.5 text-left sticky left-8 z-20 min-w-[80px]">Code</th>
                    <th className="border border-slate-300 bg-slate-700 text-white px-2 py-1.5 text-left sticky left-[112px] z-20 min-w-[140px]">Name</th>
                    <th className="border border-slate-300 bg-slate-700 text-white px-2 py-1.5 text-left min-w-[90px]">Dept</th>
                    <th className="border border-slate-300 bg-slate-700 text-white px-2 py-1.5 text-left min-w-[100px]">Client</th>
                    <th className="border border-slate-300 bg-slate-700 text-white px-1.5 py-1 text-center min-w-[40px]">Fill</th>
                    {Array.from({ length: daysInMonth }, (_, i) => {
                      const d = i + 1;
                      const dow = getDayOfWeek(year, month, d);
                      const isSun = dow === "Sun";
                      const isSat = dow === "Sat";
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
                  {filteredEmployees.length === 0 ? (
                    <tr><td colSpan={6 + daysInMonth + 1} className="text-center py-10 text-muted-foreground">No employees found</td></tr>
                  ) : filteredEmployees.map((emp, idx) => {
                    const counts: Record<string, number> = { M: 0, E: 0, N: 0, G: 0, O: 0 };
                    for (let d = 1; d <= daysInMonth; d++) {
                      const v = getCell(emp.id, d);
                      if (v && counts[v] !== undefined) counts[v]++;
                    }
                    return (
                      <tr key={emp.id} className={idx % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-slate-50 dark:bg-gray-800/50"}>
                        <td className="border border-slate-200 px-1 py-1 text-center text-slate-500 sticky left-0 z-10 bg-inherit">{idx + 1}</td>
                        <td className="border border-slate-200 px-1.5 py-1 font-mono sticky left-8 z-10 bg-inherit">{emp.employeeCode || '—'}</td>
                        <td className="border border-slate-200 px-1.5 py-1 font-medium sticky left-[112px] z-10 bg-inherit whitespace-nowrap">{emp.name}</td>
                        <td className="border border-slate-200 px-1.5 py-1 text-slate-600 dark:text-slate-400 whitespace-nowrap">{emp.department || '—'}</td>
                        <td className="border border-slate-200 px-1.5 py-1 text-slate-600 dark:text-slate-400 whitespace-nowrap text-[10px]">{emp.clientName || '—'}</td>
                        <td className="border border-slate-200 px-1 py-1">
                          <select
                            className="text-[10px] border border-slate-300 rounded px-0.5 py-0 w-full bg-white dark:bg-gray-800"
                            value=""
                            onChange={e => { if (e.target.value) fillRow(emp.id, e.target.value); }}
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
                          return (
                            <td
                              key={d}
                              className="border border-slate-200 px-0 py-0 text-center cursor-pointer select-none"
                              style={{ background: val ? st.bg : undefined, color: val ? st.textColor : undefined }}
                              onClick={() => cycleShift(emp.id, d)}
                              title={`${emp.name} — Day ${d}: ${st.label}`}
                              data-testid={`cell-shift-${emp.id}-${d}`}
                            >
                              <span className={`block w-full h-full py-1 font-semibold ${isDirty ? 'ring-1 ring-inset ring-yellow-400' : ''}`}>{val || ''}</span>
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
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
