import { useState, useCallback, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useClientNames } from "@/hooks/use-reports";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Download, Printer, Save, ClipboardList, Calendar, Users, FileSpreadsheet, Upload } from "lucide-react";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const STATUS_CODES = ["P", "A", "H", "HP", "HD", "WO", "PH", "CL", "SL", "EL", ""] as const;
type StatusCode = (typeof STATUS_CODES)[number];

const STATUS_COLORS: Record<string, string> = {
  P: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  A: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  H: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  HP: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
  HD: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  WO: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  PH: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  CL: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  SL: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  EL: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
};

function getDaysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

function cycleStatus(current: StatusCode): StatusCode {
  const idx = STATUS_CODES.indexOf(current);
  return STATUS_CODES[(idx + 1) % STATUS_CODES.length];
}

type AttendanceMap = Record<number, Record<string, StatusCode>>;

export default function MusterRoll() {
  const { toast } = useToast();
  const { data: clients, isLoading: clientsLoading } = useClientNames();

  const [clientName, setClientName] = useState("");
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [loaded, setLoaded] = useState(false);
  const [attendanceData, setAttendanceData] = useState<AttendanceMap>({});
  const [overtimeData, setOvertimeData] = useState<Record<number, number>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const monthNum = parseInt(month);
  const yearNum = parseInt(year);
  const daysInMonth = getDaysInMonth(monthNum, yearNum);

  const { data: employees, isLoading: employeesLoading, refetch: refetchEmployees } = useQuery({
    queryKey: ["/api/employees", clientName],
    queryFn: async () => {
      const res = await fetch(`/api/employees?clientName=${encodeURIComponent(clientName)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch employees");
      return res.json() as Promise<{ id: number; name: string; employeeId?: string; designation?: string }[]>;
    },
    enabled: false,
  });

  const { data: attendanceRecords, isLoading: attendanceLoading, refetch: refetchAttendance } = useQuery({
    queryKey: ["/api/attendance", clientName, month, year],
    queryFn: async () => {
      const res = await fetch(`/api/attendance?clientName=${encodeURIComponent(clientName)}&month=${monthNum}&year=${yearNum}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch attendance");
      return res.json() as Promise<any[]>;
    },
    enabled: false,
  });

  const handleLoad = useCallback(async () => {
    if (!clientName) {
      toast({ title: "Select a client", description: "Please select a client name first.", variant: "destructive" });
      return;
    }
    const [empResult, attResult] = await Promise.all([refetchEmployees(), refetchAttendance()]);
    const emps = empResult.data || [];
    const records = attResult.data || [];

    const map: AttendanceMap = {};
    emps.forEach((emp: any) => {
      map[emp.id] = {};
      for (let d = 1; d <= 31; d++) {
        map[emp.id][`day${d}`] = "" as StatusCode;
      }
    });

    records.forEach((rec: any) => {
      if (map[rec.employeeId]) {
        for (let d = 1; d <= 31; d++) {
          const val = rec[`day${d}`] || "";
          map[rec.employeeId][`day${d}`] = val as StatusCode;
        }
      }
    });

    setAttendanceData(map);

    try {
      const otRes = await fetch(`/api/overtime?clientName=${encodeURIComponent(clientName)}`, { credentials: 'include' });
      const otRecords = await otRes.json();
      const otMap: Record<number, number> = {};
      (otRecords || []).forEach((ot: any) => {
        const d = new Date(ot.date);
        if (d.getMonth() + 1 === monthNum && d.getFullYear() === yearNum) {
          otMap[ot.employeeId] = (otMap[ot.employeeId] || 0) + (Number(ot.overtimeHours) || 0);
        }
      });
      setOvertimeData(otMap);
    } catch {
      setOvertimeData({});
    }

    setLoaded(true);
  }, [clientName, monthNum, yearNum, refetchEmployees, refetchAttendance, toast]);

  const handleCellClick = useCallback((employeeId: number, dayKey: string) => {
    setAttendanceData(prev => {
      const empData = { ...prev[employeeId] };
      empData[dayKey] = cycleStatus((empData[dayKey] || "") as StatusCode);
      return { ...prev, [employeeId]: empData };
    });
  }, []);

  const calcTotals = useCallback((empData: Record<string, StatusCode>) => {
    let present = 0;
    let holidays = 0;
    let holidayPresent = 0;
    let halfDay = 0;
    let absent = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const val = empData[`day${d}`];
      if (val === "P") present += 1;
      else if (val === "H") holidays += 1;
      else if (val === "HP") holidayPresent += 1;
      else if (val === "HD") halfDay += 1;
      else if (val === "A") absent += 1;
    }
    const totalPaidDays = present + holidays + holidayPresent + (halfDay * 0.5);
    return { present, holidays, holidayPresent, halfDay, totalPaidDays, absent };
  }, [daysInMonth]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const emps = employees || [];
      const promises = emps.map((emp) => {
        const empData = attendanceData[emp.id] || {};
        const totals = calcTotals(empData);
        const payload: any = {
          employeeId: emp.id,
          clientName,
          month: monthNum,
          year: yearNum,
          totalPresent: totals.totalPaidDays,
          totalAbsent: totals.absent,
          overtimeHours: overtimeData[emp.id] || 0,
          remarks: "",
        };
        for (let d = 1; d <= 31; d++) {
          payload[`day${d}`] = empData[`day${d}`] || "";
        }
        return apiRequest("POST", "/api/attendance", payload);
      });
      await Promise.all(promises);
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "Attendance records saved successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance", clientName, month, year] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handlePrint = () => window.print();

  const handleDownloadFormat = async () => {
    if (!employees || employees.length === 0) {
      toast({ title: "No data", description: "Load employees first before downloading format.", variant: "destructive" });
      return;
    }
    const ExcelJS = await import("exceljs");
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Attendance Format");

    const headerRow = ["Sl. No.", "Employee Name"];
    for (let d = 1; d <= daysInMonth; d++) headerRow.push(String(d));
    const hr = ws.addRow(headerRow);
    hr.font = { bold: true, size: 11 };
    hr.alignment = { horizontal: "center", vertical: "middle" };
    hr.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } };
      cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    });

    ws.getColumn(1).width = 8;
    ws.getColumn(2).width = 28;
    for (let d = 1; d <= daysInMonth; d++) ws.getColumn(d + 2).width = 5;

    employees.forEach((emp, idx) => {
      const row = ws.addRow([idx + 1, emp.name]);
      row.getCell(1).alignment = { horizontal: "center" };
      row.getCell(2).font = { size: 10 };
      row.eachCell((cell) => {
        cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
      });
      for (let d = 1; d <= daysInMonth; d++) {
        const c = row.getCell(d + 2);
        c.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
        c.alignment = { horizontal: "center" };
      }
    });

    const instrWs = wb.addWorksheet("Instructions");
    instrWs.getColumn(1).width = 60;
    instrWs.addRow(["MUSTER ROLL - ATTENDANCE FORMAT INSTRUCTIONS"]).font = { bold: true, size: 14 };
    instrWs.addRow([""]);
    instrWs.addRow(["Fill attendance codes in the day columns (1, 2, 3... etc.) for each employee."]);
    instrWs.addRow([""]);
    instrWs.addRow(["Valid Codes:"]).font = { bold: true };
    instrWs.addRow(["P  = Present (Full Day)"]);
    instrWs.addRow(["A  = Absent"]);
    instrWs.addRow(["H  = Holiday"]);
    instrWs.addRow(["HP = Holiday Present"]);
    instrWs.addRow(["HD = Half Day (counts as 0.5)"]);
    instrWs.addRow(["WO = Weekly Off"]);
    instrWs.addRow(["PH = Public Holiday"]);
    instrWs.addRow(["CL = Casual Leave"]);
    instrWs.addRow(["SL = Sick Leave"]);
    instrWs.addRow(["EL = Earned Leave"]);
    instrWs.addRow([""]);
    instrWs.addRow(["IMPORTANT: Do NOT change employee names or row order."]).font = { bold: true, color: { argb: "FFFF0000" } };
    instrWs.addRow(["Leave cells empty for future days."]);

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Muster_Roll_Format_${clientName}_${MONTHS[monthNum - 1]}_${year}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Downloaded", description: "Fill in attendance codes and import back." });
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = "";

    if (!employees || employees.length === 0) {
      toast({ title: "No data", description: "Load employees first before importing.", variant: "destructive" });
      return;
    }

    try {
      const ExcelJS = await import("exceljs");
      const wb = new ExcelJS.Workbook();
      const arrayBuf = await file.arrayBuffer();
      await wb.xlsx.load(arrayBuf);

      const ws = wb.getWorksheet("Attendance Format") || wb.getWorksheet(1);
      if (!ws) {
        toast({ title: "Error", description: "No worksheet found in file.", variant: "destructive" });
        return;
      }

      const empNameMap: Record<string, number> = {};
      employees.forEach((emp) => {
        empNameMap[emp.name.trim().toUpperCase()] = emp.id;
      });

      const newData: AttendanceMap = { ...attendanceData };
      let imported = 0;
      const validCodes = ["P", "A", "H", "HP", "HD", "WO", "PH", "CL", "SL", "EL"];

      ws.eachRow((row, rowNum) => {
        if (rowNum === 1) return;
        const nameCell = row.getCell(2).value;
        if (!nameCell) return;
        const name = String(nameCell).trim().toUpperCase();
        const empId = empNameMap[name];
        if (empId === undefined) return;

        if (!newData[empId]) newData[empId] = {};
        for (let d = 1; d <= daysInMonth; d++) {
          const cellVal = row.getCell(d + 2).value;
          const code = cellVal ? String(cellVal).trim().toUpperCase() : "";
          if (code && validCodes.includes(code)) {
            newData[empId][`day${d}`] = code as StatusCode;
          } else if (code === "") {
            newData[empId][`day${d}`] = "" as StatusCode;
          }
        }
        imported++;
      });

      setAttendanceData(newData);
      toast({
        title: "Imported",
        description: `${imported} employee attendance records imported. Click "Save All" to save.`,
      });
    } catch (err: any) {
      toast({ title: "Import Error", description: err.message || "Failed to read Excel file.", variant: "destructive" });
    }
  };

  const handleExportExcel = async () => {
    if (!employees || employees.length === 0) return;
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet("Muster Roll");

    const monthName = MONTHS[monthNum - 1];
    const totalCols = 3 + daysInMonth + 7;
    const titleRow = ws.addRow(["Muster Roll (Form XVI)"]);
    titleRow.getCell(1).font = { bold: true, size: 16 };
    ws.mergeCells(1, 1, 1, totalCols);
    titleRow.alignment = { horizontal: "center" };

    const sub1 = ws.addRow([`${clientName} - ${monthName} ${year}`]);
    sub1.getCell(1).font = { bold: true, size: 12 };
    ws.mergeCells(2, 1, 2, totalCols);
    sub1.alignment = { horizontal: "center" };

    ws.addRow([]);

    const headers = ["Sl.No", "Emp Name", "Designation"];
    for (let d = 1; d <= daysInMonth; d++) headers.push(String(d));
    headers.push("Present", "Holidays", "Hol. Present", "Half Day", "Total Paid", "Absent", "OT Hrs");
    const headerRow = ws.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, size: 9 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF10B981" } };
      cell.font = { bold: true, size: 9, color: { argb: "FFFFFFFF" } };
      cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
      cell.alignment = { horizontal: "center" };
    });

    employees.forEach((emp: any, idx: number) => {
      const empData = attendanceData[emp.id] || {};
      const totals = calcTotals(empData);
      const rowData: (string | number)[] = [idx + 1, emp.name, emp.designation || "-"];
      for (let d = 1; d <= daysInMonth; d++) {
        rowData.push(empData[`day${d}`] || "");
      }
      rowData.push(totals.present, totals.holidays, totals.holidayPresent, totals.halfDay, totals.totalPaidDays, totals.absent, overtimeData[emp.id] || 0);
      const r = ws.addRow(rowData);
      r.eachCell((cell, colNumber) => {
        cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
        cell.font = { size: 9 };
        if (colNumber > 3 && colNumber <= 3 + daysInMonth) {
          cell.alignment = { horizontal: "center" };
          const val = String(cell.value);
          if (val === "P") cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD1FAE5" } };
          else if (val === "A") cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } };
          else if (val === "H" || val === "WO" || val === "PH") cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
          else if (val === "HP") cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFCCFBF1" } };
          else if (val === "HD") cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
        }
      });
    });

    ws.getColumn(1).width = 6;
    ws.getColumn(2).width = 22;
    ws.getColumn(3).width = 16;
    for (let i = 4; i <= 3 + daysInMonth; i++) ws.getColumn(i).width = 5;
    const summaryStart = 4 + daysInMonth;
    for (let i = summaryStart; i < summaryStart + 7; i++) ws.getColumn(i).width = 10;

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const link = document.createElement("a");
    link.download = `MusterRoll_${clientName.replace(/\s+/g, "_")}_${monthName}_${year}.xlsx`;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
    toast({ title: "Excel Downloaded", description: "Muster Roll exported to Excel." });
  };

  const isLoadingData = employeesLoading || attendanceLoading;

  return (
    <Layout>
      <style>{`
        @media print {
          nav, aside, header, .no-print { display: none !important; }
          main { padding: 0 !important; }
          .print-table { font-size: 9px !important; }
          .print-table th, .print-table td { padding: 2px 3px !important; }
        }
      `}</style>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight" data-testid="text-muster-roll-title">
              Muster Roll (Form XVI)
            </h1>
            <p className="text-muted-foreground mt-1 text-xs sm:text-sm">Monthly Attendance Register</p>
          </div>
          {loaded && (
            <div className="flex gap-2 no-print flex-wrap">
              <Button variant="outline" onClick={handleDownloadFormat} data-testid="button-download-format">
                <Download className="w-4 h-4 mr-2" />
                Download Format
              </Button>
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} data-testid="button-import-excel">
                <Upload className="w-4 h-4 mr-2" />
                Import Excel
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleImportExcel}
                data-testid="input-import-file"
              />
              <Button variant="outline" onClick={handleExportExcel} data-testid="button-export-excel-muster">
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Export Excel
              </Button>
              <Button variant="outline" onClick={handlePrint} data-testid="button-print">
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-save-all">
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save All
              </Button>
            </div>
          )}
        </div>

        <Card className="no-print">
          <CardHeader className="pb-3 pt-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Select Period
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
              <div className="space-y-2">
                <Label htmlFor="client-select">Client Name</Label>
                <Select value={clientName} onValueChange={setClientName} data-testid="select-client">
                  <SelectTrigger id="client-select" data-testid="select-trigger-client">
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientsLoading ? (
                      <div className="p-2 text-sm text-muted-foreground">Loading...</div>
                    ) : (
                      (clients || []).map((c: any) => (
                        <SelectItem key={c.id || c.name || c} value={typeof c === "string" ? c : c.name} data-testid={`select-item-client-${typeof c === "string" ? c : c.name}`}>
                          {typeof c === "string" ? c : c.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="month-select">Month</Label>
                <Select value={month} onValueChange={setMonth} data-testid="select-month">
                  <SelectTrigger id="month-select" data-testid="select-trigger-month">
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => (
                      <SelectItem key={i} value={String(i + 1)} data-testid={`select-item-month-${i + 1}`}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="year-input">Year</Label>
                <Input
                  id="year-input"
                  type="number"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  min={2020}
                  max={2099}
                  data-testid="input-year"
                />
              </div>
              <Button onClick={handleLoad} disabled={isLoadingData} data-testid="button-load">
                {isLoadingData ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                Load
              </Button>
            </div>
          </CardContent>
        </Card>

        {isLoadingData && (
          <Card>
            <CardContent className="p-6">
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {loaded && !isLoadingData && employees && (
          <Card>
            <CardHeader className="pb-3 pt-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users className="w-4 h-4" />
                Attendance - {MONTHS[monthNum - 1]} {yearNum}
                <Badge variant="secondary" className="ml-auto">{employees.length} Employees</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {employees.length === 0 ? (
                <div className="text-center py-16">
                  <ClipboardList className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-1">No employees found</h3>
                  <p className="text-muted-foreground text-sm">No employees are registered for this client.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs print-table" data-testid="table-attendance">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="sticky left-0 z-10 bg-muted/90 backdrop-blur-sm px-3 py-2 text-left font-semibold min-w-[140px]">
                          Employee
                        </th>
                        {Array.from({ length: daysInMonth }, (_, i) => (
                          <th key={i} className="px-1 py-2 text-center font-semibold min-w-[36px]">
                            {i + 1}
                          </th>
                        ))}
                        <th className="px-2 py-2 text-center font-semibold min-w-[50px] bg-emerald-50 dark:bg-emerald-950/20">
                          Present
                        </th>
                        <th className="px-2 py-2 text-center font-semibold min-w-[50px] bg-yellow-50 dark:bg-yellow-950/20">
                          Holidays
                        </th>
                        <th className="px-2 py-2 text-center font-semibold min-w-[50px] bg-teal-50 dark:bg-teal-950/20">
                          Hol. Present
                        </th>
                        <th className="px-2 py-2 text-center font-semibold min-w-[50px] bg-amber-50 dark:bg-amber-950/20">
                          Half Day
                        </th>
                        <th className="px-2 py-2 text-center font-semibold min-w-[55px] bg-indigo-50 dark:bg-indigo-950/20">
                          Total Paid
                        </th>
                        <th className="px-2 py-2 text-center font-semibold min-w-[50px] bg-red-50 dark:bg-red-950/20">
                          Absent
                        </th>
                        <th className="px-2 py-2 text-center font-semibold min-w-[60px] bg-cyan-50 dark:bg-cyan-950/20">
                          OT Hrs
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map((emp, empIdx) => {
                        const empData = attendanceData[emp.id] || {};
                        const totals = calcTotals(empData);
                        return (
                          <tr key={emp.id} className={`border-b last:border-0 ${empIdx % 2 === 0 ? "" : "bg-muted/20"}`} data-testid={`row-employee-${emp.id}`}>
                            <td className="sticky left-0 z-10 bg-card px-3 py-1.5 font-medium whitespace-nowrap border-r">
                              <div className="flex flex-col">
                                <span className="truncate max-w-[130px]">{emp.name}</span>
                                {emp.designation && <span className="text-[10px] text-muted-foreground">{emp.designation}</span>}
                              </div>
                            </td>
                            {Array.from({ length: daysInMonth }, (_, i) => {
                              const dayKey = `day${i + 1}`;
                              const status = (empData[dayKey] || "") as StatusCode;
                              const colorClass = status ? STATUS_COLORS[status] || "" : "";
                              return (
                                <td key={i} className="px-0.5 py-1 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleCellClick(emp.id, dayKey)}
                                    className={`w-8 h-7 rounded text-[10px] font-bold cursor-pointer transition-colors ${colorClass || "bg-muted/30 text-muted-foreground"}`}
                                    data-testid={`cell-${emp.id}-day${i + 1}`}
                                    title={`Day ${i + 1}: ${status || "Not set"} - Click to change`}
                                  >
                                    {status || "-"}
                                  </button>
                                </td>
                              );
                            })}
                            <td className="px-2 py-1.5 text-center font-bold bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300" data-testid={`total-present-${emp.id}`}>
                              {totals.present}
                            </td>
                            <td className="px-2 py-1.5 text-center font-bold bg-yellow-50 dark:bg-yellow-950/20 text-yellow-700 dark:text-yellow-300">
                              {totals.holidays}
                            </td>
                            <td className="px-2 py-1.5 text-center font-bold bg-teal-50 dark:bg-teal-950/20 text-teal-700 dark:text-teal-300">
                              {totals.holidayPresent}
                            </td>
                            <td className="px-2 py-1.5 text-center font-bold bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300">
                              {totals.halfDay}
                            </td>
                            <td className="px-2 py-1.5 text-center font-bold bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300" data-testid={`total-paid-${emp.id}`}>
                              {totals.totalPaidDays}
                            </td>
                            <td className="px-2 py-1.5 text-center font-bold bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300" data-testid={`total-absent-${emp.id}`}>
                              {totals.absent}
                            </td>
                            <td className="px-2 py-1.5 text-center font-bold bg-cyan-50 dark:bg-cyan-950/20 text-cyan-700 dark:text-cyan-300" data-testid={`ot-hours-${emp.id}`}>
                              {overtimeData[emp.id] || 0}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {loaded && !isLoadingData && employees && employees.length > 0 && (
          <div className="flex justify-between items-center gap-4 no-print flex-wrap">
            <div className="flex gap-2 flex-wrap">
              {Object.entries(STATUS_COLORS).map(([code, cls]) => (
                <div key={code} className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold ${cls}`}>
                  {code}
                </div>
              ))}
            </div>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-save-bottom">
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save All
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}
