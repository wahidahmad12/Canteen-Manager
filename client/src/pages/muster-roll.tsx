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
import { PrintSettingsDialog } from "@/components/print-settings-dialog";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const STATUS_CODES = ["P", "A", "H", "P/HL", "HD", "WO", "CL", "SL", "EL", ""] as const;
type StatusCode = (typeof STATUS_CODES)[number];

const STATUS_COLORS: Record<string, string> = {
  P: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  A: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  H: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  "P/HL": "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
  HD: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  WO: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
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

  const { data: allEmployees, isLoading: employeesLoading, refetch: refetchEmployees } = useQuery({
    queryKey: ["/api/employees", clientName],
    queryFn: async () => {
      const res = await fetch(`/api/employees?clientName=${encodeURIComponent(clientName)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch employees");
      return res.json() as Promise<any[]>;
    },
    enabled: false,
  });

  const employees = useMemo(() => {
    if (!allEmployees) return undefined;
    const lastDayOfMonth = new Date(yearNum, monthNum, 0);
    const firstDayOfMonth = new Date(yearNum, monthNum - 1, 1);
    return allEmployees.filter((emp: any) => {
      if (emp.joiningDate) {
        const joinDate = new Date(emp.joiningDate);
        if (joinDate > lastDayOfMonth) return false;
      }
      if (emp.leavingDate) {
        const leaveDate = new Date(emp.leavingDate);
        if (leaveDate < firstDayOfMonth) return false;
      }
      return true;
    });
  }, [allEmployees, monthNum, yearNum]);

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
    const rawEmps = empResult.data || [];
    const records = attResult.data || [];

    const lastDayOfMonth = new Date(yearNum, monthNum, 0);
    const firstDayOfMonth = new Date(yearNum, monthNum - 1, 1);
    const emps = rawEmps.filter((emp: any) => {
      if (emp.joiningDate) {
        const joinDate = new Date(emp.joiningDate);
        if (joinDate > lastDayOfMonth) return false;
      }
      if (emp.leavingDate) {
        const leaveDate = new Date(emp.leavingDate);
        if (leaveDate < firstDayOfMonth) return false;
      }
      return true;
    });

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

    // Auto-fill WO for employee's fixed weekly off day (only for empty cells)
    const WEEK_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    emps.forEach((emp: any) => {
      if (!emp.weeklyOffDay) return;
      const woDayIndex = WEEK_DAYS.indexOf(emp.weeklyOffDay);
      if (woDayIndex === -1) return;
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(yearNum, monthNum - 1, d);
        if (date.getDay() === woDayIndex) {
          const key = `day${d}`;
          if (!map[emp.id][key]) {
            map[emp.id][key] = "WO" as StatusCode;
          }
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
    let rawPresent = 0;
    let holidays = 0;
    let holidayPresent = 0;
    let halfDay = 0;
    let absent = 0;
    let weeklyOff = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const val = empData[`day${d}`];
      if (val === "P") rawPresent += 1;
      else if (val === "H") holidays += 1;
      else if (val === "P/HL") holidayPresent += 1;
      else if (val === "HD") halfDay += 1;
      else if (val === "A") absent += 1;
      else if (val === "WO") weeklyOff += 1;
    }
    const present = rawPresent + holidayPresent;
    const totalPaidDays = rawPresent + holidays + holidayPresent;
    return { present, holidays, holidayPresent, halfDay, totalPaidDays, absent, weeklyOff };
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

  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [printSelectedIds, setPrintSelectedIds] = useState<Set<number>>(new Set());

  const openPrintDialog = () => {
    if (employees) setPrintSelectedIds(new Set(employees.map((e: any) => e.id)));
    setPrintDialogOpen(true);
  };

  const printEmployeeList = useMemo(() => {
    return (employees || []).map((e: any) => ({ id: e.id, name: e.name, employeeCode: e.employeeCode }));
  }, [employees]);

  const executeGovPrint = () => {
    if (!employees || employees.length === 0) return;
    const selectedEmps = employees.filter((e: any) => printSelectedIds.has(e.id));
    if (selectedEmps.length === 0) return;
    const clientObj = clients?.find((c: any) => c.name === clientName);
    const clientAddr = clientObj?.address || "";
    const printWin = window.open("", "_blank");
    if (!printWin) return;

    const rows = selectedEmps.map((emp: any, idx: number) => {
      const empData = attendanceData[emp.id] || {};
      const totals = calcTotals(empData);
      const dayCells = Array.from({ length: daysInMonth }, (_, i) => {
        const val = empData[`day${i + 1}`] || "";
        return `<td>${val}</td>`;
      }).join("");
      const sex = emp.gender === "Female" ? "F" : "M";
      return `<tr>
        <td>${idx + 1}</td>
        <td style="text-align:left;white-space:nowrap">${emp.name || ""}</td>
        <td style="text-align:left;white-space:nowrap">${emp.fatherName || ""}</td>
        <td>${sex}</td>
        ${dayCells}
        <td style="font-weight:bold">${totals.totalPaidDays}</td>
        <td></td>
      </tr>`;
    }).join("");

    printWin.document.write(`<html><head><title>Form XVI - Muster Roll</title>
    <style>
      @page { size: landscape; margin: 8mm; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: Arial, sans-serif; font-size: 10px; padding: 8px; }
      .header-title { text-align: left; font-size: 11px; font-weight: bold; margin-bottom: 2px; }
      .header-main { text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 4px; }
      .header-rule { text-align: center; font-size: 9px; margin-bottom: 8px; }
      .info-table { width: 100%; border-collapse: collapse; margin-bottom: 6px; font-size: 10px; }
      .info-table td { padding: 2px 6px; vertical-align: top; }
      .info-label { font-weight: bold; white-space: nowrap; }
      table.main { width: 100%; border-collapse: collapse; font-size: 8px; }
      table.main th, table.main td { border: 1px solid #000; padding: 2px 3px; text-align: center; vertical-align: middle; }
      table.main th { background: #f0f0f0; font-weight: bold; font-size: 7px; }
      table.main td { font-size: 8px; }
      .period-label { font-size: 14px; font-weight: bold; }
    </style></head><body>
      <div class="header-title">Form XVI</div>
      <div class="header-main">MUSTER ROLL</div>
      <div class="header-rule">[Prescribed Under Rule 78 (2)(a)/78(a)(i) of the West Bengal / Central Contract Labour ( Regulation &amp; Abolition) Rules, 1972/1971]</div>

      <table class="info-table">
        <tr>
          <td class="info-label" style="width:22%">Name and Address of the Contractor</td>
          <td style="width:28%">DJ HOSPITALITY &amp; FACILITY MANAGEMENT PVT LTD</td>
          <td class="info-label" style="width:22%">Name and address of the establishment in /</td>
          <td style="width:28%">${clientName}${clientAddr ? '<br/>' + clientAddr : ''}</td>
        </tr>
        <tr>
          <td></td>
          <td>7 Crimatorium Street, Kolkata- 700014</td>
          <td class="info-label">Under which contract is carried on</td>
          <td></td>
        </tr>
        <tr>
          <td class="info-label">Nature and location of Work</td>
          <td>Canteen</td>
          <td class="info-label">Name and address of the Principal Employer</td>
          <td>${clientName}${clientAddr ? '<br/>' + clientAddr : ''}</td>
        </tr>
        <tr>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
        </tr>
        <tr>
          <td></td>
          <td></td>
          <td class="info-label">For the Month of</td>
          <td class="period-label">${MONTHS[monthNum - 1]} ${yearNum}</td>
        </tr>
      </table>

      <table class="main">
        <thead>
          <tr>
            <th rowspan="2" style="width:30px">Serial<br/>No</th>
            <th rowspan="2" style="min-width:100px">Name of the Workman</th>
            <th rowspan="2" style="min-width:100px">Father's /Husband's Name</th>
            <th rowspan="2" style="width:25px">Sex</th>
            <th colspan="${daysInMonth}">DATE</th>
            <th rowspan="2" style="width:30px">Total</th>
            <th rowspan="2" style="width:40px">Remarks</th>
          </tr>
          <tr>
            ${Array.from({ length: daysInMonth }, (_, i) => `<th style="min-width:18px">${i + 1}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="' + (daysInMonth + 6) + '" style="padding:20px;text-align:center">No records found</td></tr>'}
        </tbody>
      </table>
    </body></html>`);
    printWin.document.close();
    printWin.print();
  };

  const handleDownloadFormat = async () => {
    if (!employees || employees.length === 0) {
      toast({ title: "No data", description: "Load employees first before downloading format.", variant: "destructive" });
      return;
    }
    const ExcelJS = (await import("exceljs")).default;
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
    instrWs.addRow(["P/HL = Holiday Present"]);
    instrWs.addRow(["HD = Half Day (counts as 0.5)"]);
    instrWs.addRow(["WO = Weekly Off"]);
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
      const ExcelJS = (await import("exceljs")).default;
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
      const validCodes = ["P", "A", "H", "P/HL", "HD", "WO", "CL", "SL", "EL"];

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
    const ExcelJS = (await import("exceljs")).default;
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
    headers.push("Present", "Holidays", "Hol. Present", "Half Day", "Total Paid", "Absent", "Weekly Off", "OT Hrs");
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
      rowData.push(totals.present, totals.holidays + totals.holidayPresent, totals.holidayPresent, totals.halfDay, totals.totalPaidDays, totals.absent, totals.weeklyOff, overtimeData[emp.id] || 0);
      const r = ws.addRow(rowData);
      r.eachCell((cell, colNumber) => {
        cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
        cell.font = { size: 9 };
        if (colNumber > 3 && colNumber <= 3 + daysInMonth) {
          cell.alignment = { horizontal: "center" };
          const val = String(cell.value);
          if (val === "P") cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD1FAE5" } };
          else if (val === "A") cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } };
          else if (val === "H" || val === "WO") cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
          else if (val === "P/HL") cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFCCFBF1" } };
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
          @page { size: landscape; margin: 6mm; }
          body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          nav, aside, header, .no-print, .print-hide, [data-sidebar], .sidebar-wrapper { display: none !important; }
          main { padding: 0 !important; margin: 0 !important; max-width: 100% !important; }
          .print-full { overflow: visible !important; max-height: none !important; }
          .print-title-block { display: block !important; }

          .print-table { font-size: 7.5pt !important; border-collapse: collapse !important; width: 100% !important; border: 2px solid #333 !important; }
          .print-table th, .print-table td { 
            padding: 2px 2px !important; 
            border: 1px solid #555 !important;
            text-align: center !important;
          }
          .print-table thead tr:first-child th:first-child { border-left: 2px solid #333 !important; }
          .print-table thead tr:first-child th:last-child { border-right: 2px solid #333 !important; }
          .print-table thead tr:first-child th { border-top: 2px solid #333 !important; }
          .print-table tbody tr:last-child td { border-bottom: 2px solid #333 !important; }
          .print-table tbody tr td:first-child { border-left: 2px solid #333 !important; }
          .print-table tbody tr td:last-child { border-right: 2px solid #333 !important; }
          .print-table thead tr { background: #1565c0 !important; }
          .print-table th { 
            background: #1565c0 !important; 
            color: #fff !important;
            font-weight: bold !important; 
            font-size: 7pt !important;
            border-color: #0d47a1 !important;
          }
          .print-table td.emp-name { 
            text-align: left !important; 
            font-weight: 700 !important; 
            white-space: nowrap !important;
            font-size: 7pt !important;
            padding-left: 4px !important;
            background: #e3f2fd !important;
          }
          .print-table .day-cell { min-width: 18px !important; width: 18px !important; font-size: 7pt !important; font-weight: bold !important; }

          .print-table th.summary-present { background: #2e7d32 !important; color: #fff !important; }
          .print-table th.summary-holiday { background: #f9a825 !important; color: #fff !important; }
          .print-table th.summary-hp { background: #00897b !important; color: #fff !important; }
          .print-table th.summary-hd { background: #ef6c00 !important; color: #fff !important; }
          .print-table th.summary-paid { background: #283593 !important; color: #fff !important; }
          .print-table th.summary-absent { background: #c62828 !important; color: #fff !important; }
          .print-table th.summary-wo { background: #1565c0 !important; color: #fff !important; }
          .print-table th.summary-ot { background: #00838f !important; color: #fff !important; }

          .print-table td.summary-present { background: #a5d6a7 !important; color: #1b5e20 !important; font-weight: bold !important; }
          .print-table td.summary-holiday { background: #fff176 !important; color: #f57f17 !important; font-weight: bold !important; }
          .print-table td.summary-hp { background: #80cbc4 !important; color: #004d40 !important; font-weight: bold !important; }
          .print-table td.summary-hd { background: #ffcc80 !important; color: #e65100 !important; font-weight: bold !important; }
          .print-table td.summary-paid { background: #9fa8da !important; color: #1a237e !important; font-weight: bold !important; }
          .print-table td.summary-absent { background: #ef9a9a !important; color: #b71c1c !important; font-weight: bold !important; }
          .print-table td.summary-wo { background: #bbdefb !important; color: #0d47a1 !important; font-weight: bold !important; }
          .print-table td.summary-ot { background: #80deea !important; color: #006064 !important; font-weight: bold !important; }

          .print-table .cell-P { background: #c8e6c9 !important; color: #1b5e20 !important; }
          .print-table .cell-A { background: #ffcdd2 !important; color: #b71c1c !important; }
          .print-table .cell-H { background: #fff9c4 !important; color: #f57f17 !important; }
          .print-table .cell-PHL { background: #b2dfdb !important; color: #004d40 !important; }
          .print-table .cell-HD { background: #ffe0b2 !important; color: #e65100 !important; }
          .print-table .cell-WO { background: #bbdefb !important; color: #0d47a1 !important; }
          .print-table .cell-CL, .print-table .cell-SL, .print-table .cell-EL { background: #ffccbc !important; color: #bf360c !important; }

          .print-table td:first-child { background: #e8eaf6 !important; font-weight: bold !important; color: #283593 !important; }

          .print-table button { 
            all: unset !important;
            font-size: 7pt !important;
            font-weight: bold !important;
            text-align: center !important;
            display: block !important;
            width: 100% !important;
            color: inherit !important;
          }
          .print-table td { vertical-align: middle !important; }
          .print-table tr:nth-child(even) td:not(.emp-name):not(.summary-present):not(.summary-holiday):not(.summary-hp):not(.summary-hd):not(.summary-paid):not(.summary-absent):not(.summary-wo):not(.summary-ot):not(:first-child):not([class*="cell-"]) { background: #f5f5f5 !important; }

          .print-legend { 
            margin-top: 8px !important; 
            font-size: 7.5pt !important; 
            border: 2px solid #1565c0 !important;
            padding: 5px 10px !important;
            display: flex !important;
            flex-wrap: wrap !important;
            gap: 6px 14px !important;
            background: #e3f2fd !important;
            border-radius: 0 !important;
          }
          .print-legend strong { font-weight: bold !important; }
          .sticky { position: static !important; }
          [class*="Card"], [class*="card"] { border: none !important; box-shadow: none !important; border-radius: 0 !important; }

          .print-sign-block { 
            display: flex !important; 
            justify-content: space-between !important;
            margin-top: 24px !important;
            font-size: 9pt !important;
            font-weight: 600 !important;
          }
        }
      `}</style>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print-hide">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight" data-testid="text-muster-roll-title">
              Muster Roll (Form XVI)
            </h1>
            <p className="text-muted-foreground mt-1 text-xs sm:text-sm">Monthly Attendance Register</p>
          </div>
          {loaded && (
            <div className="flex flex-wrap gap-2 no-print w-full sm:w-auto">
              <Button variant="outline" size="sm" onClick={handleDownloadFormat} data-testid="button-download-format">
                <Download className="w-4 h-4 mr-1" />
                Format
              </Button>
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} data-testid="button-import-excel">
                <Upload className="w-4 h-4 mr-1" />
                Import
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleImportExcel}
                data-testid="input-import-file"
              />
              <Button variant="outline" size="sm" onClick={handleExportExcel} data-testid="button-export-excel-muster">
                <FileSpreadsheet className="w-4 h-4 mr-1" />
                Export
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint} data-testid="button-print">
                <Printer className="w-4 h-4 mr-1" />
                Print
              </Button>
              <Button variant="outline" size="sm" onClick={openPrintDialog} data-testid="button-gov-print">
                <Printer className="w-4 h-4 mr-1" />
                Form XVI
              </Button>
              <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-save-all">
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 items-end">
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
          <Card className="print-full">
            <CardHeader className="pb-3 pt-4 print-hide">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users className="w-4 h-4" />
                Attendance - {MONTHS[monthNum - 1]} {yearNum}
                <Badge variant="secondary" className="ml-auto">{employees.length} Employees</Badge>
              </CardTitle>
            </CardHeader>
            <div className="hidden print-title-block" style={{ marginBottom: '8px' }}>
              <div style={{ textAlign: 'center', background: '#1565c0', color: '#fff', padding: '8px 12px', borderRadius: '4px', marginBottom: '6px' }}>
                <h2 style={{ fontSize: '14pt', fontWeight: 'bold', margin: '0', letterSpacing: '1px' }}>MUSTER ROLL (Form XVI)</h2>
                <p style={{ fontSize: '10pt', margin: '3px 0 0 0', color: '#bbdefb' }}>
                  <strong style={{ color: '#fff' }}>{clientName}</strong> &mdash; {MONTHS[monthNum - 1]} {yearNum}
                </p>
              </div>
            </div>
            <CardContent className="p-0 print-full">
              {employees.length === 0 ? (
                <div className="text-center py-16">
                  <ClipboardList className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-1">No employees found</h3>
                  <p className="text-muted-foreground text-sm">No employees are registered for this client.</p>
                </div>
              ) : (
                <div className="overflow-x-auto print-full">
                  <table className="w-full text-xs print-table" data-testid="table-attendance">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="sticky left-0 z-10 bg-muted/90 backdrop-blur-sm px-2 py-2 text-center font-semibold min-w-[30px]">
                          Sl.
                        </th>
                        <th className="sticky left-[30px] z-10 bg-muted/90 backdrop-blur-sm px-3 py-2 text-left font-semibold min-w-[140px]">
                          Employee Name
                        </th>
                        {Array.from({ length: daysInMonth }, (_, i) => (
                          <th key={i} className="px-1 py-2 text-center font-semibold min-w-[36px] day-cell">
                            {i + 1}
                          </th>
                        ))}
                        <th className="px-2 py-2 text-center font-semibold min-w-[40px] bg-emerald-50 dark:bg-emerald-950/20 summary-present">
                          P
                        </th>
                        <th className="px-2 py-2 text-center font-semibold min-w-[40px] bg-yellow-50 dark:bg-yellow-950/20 summary-holiday">
                          H
                        </th>
                        <th className="px-2 py-2 text-center font-semibold min-w-[40px] bg-teal-50 dark:bg-teal-950/20 summary-hp">
                          P/HL
                        </th>
                        <th className="px-2 py-2 text-center font-semibold min-w-[40px] bg-amber-50 dark:bg-amber-950/20 summary-hd">
                          HD
                        </th>
                        <th className="px-2 py-2 text-center font-semibold min-w-[45px] bg-indigo-50 dark:bg-indigo-950/20 summary-paid">
                          Paid
                        </th>
                        <th className="px-2 py-2 text-center font-semibold min-w-[40px] bg-red-50 dark:bg-red-950/20 summary-absent">
                          A
                        </th>
                        <th className="px-2 py-2 text-center font-semibold min-w-[40px] bg-blue-50 dark:bg-blue-950/20 summary-wo">
                          WO
                        </th>
                        <th className="px-2 py-2 text-center font-semibold min-w-[45px] bg-cyan-50 dark:bg-cyan-950/20 summary-ot">
                          OT
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map((emp, empIdx) => {
                        const empData = attendanceData[emp.id] || {};
                        const totals = calcTotals(empData);
                        return (
                          <tr key={emp.id} className={`border-b last:border-0 ${empIdx % 2 === 0 ? "" : "bg-muted/20"}`} data-testid={`row-employee-${emp.id}`}>
                            <td className="sticky left-0 z-10 bg-card px-2 py-1.5 text-center font-medium border-r text-[10px]">
                              {empIdx + 1}
                            </td>
                            <td className="sticky left-[30px] z-10 bg-card px-3 py-1.5 font-medium whitespace-nowrap border-r emp-name">
                              <div className="flex flex-col">
                                <span className="truncate max-w-[130px]">{emp.name}</span>
                                {emp.designation && <span className="text-[10px] text-muted-foreground">{emp.designation}</span>}
                              </div>
                            </td>
                            {Array.from({ length: daysInMonth }, (_, i) => {
                              const dayKey = `day${i + 1}`;
                              const status = (empData[dayKey] || "") as StatusCode;
                              const colorClass = status ? STATUS_COLORS[status] || "" : "";
                              const printClass = status ? `cell-${status.replace('/', '')}` : '';
                              return (
                                <td key={i} className={`px-0.5 py-1 text-center day-cell ${printClass}`}>
                                  <button
                                    type="button"
                                    onClick={() => handleCellClick(emp.id, dayKey)}
                                    className={`w-9 h-7 rounded text-[9px] font-bold cursor-pointer transition-colors ${colorClass || "bg-muted/30 text-muted-foreground"}`}
                                    data-testid={`cell-${emp.id}-day${i + 1}`}
                                    title={`Day ${i + 1}: ${status || "Not set"} - Click to change`}
                                  >
                                    {status || "-"}
                                  </button>
                                </td>
                              );
                            })}
                            <td className="px-2 py-1.5 text-center font-bold bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 summary-present" data-testid={`total-present-${emp.id}`}>
                              {totals.present}
                            </td>
                            <td className="px-2 py-1.5 text-center font-bold bg-yellow-50 dark:bg-yellow-950/20 text-yellow-700 dark:text-yellow-300 summary-holiday">
                              {totals.holidays + totals.holidayPresent}
                            </td>
                            <td className="px-2 py-1.5 text-center font-bold bg-teal-50 dark:bg-teal-950/20 text-teal-700 dark:text-teal-300 summary-hp">
                              {totals.holidayPresent}
                            </td>
                            <td className="px-2 py-1.5 text-center font-bold bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 summary-hd">
                              {totals.halfDay}
                            </td>
                            <td className="px-2 py-1.5 text-center font-bold bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300 summary-paid" data-testid={`total-paid-${emp.id}`}>
                              {totals.totalPaidDays}
                            </td>
                            <td className="px-2 py-1.5 text-center font-bold bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300 summary-absent" data-testid={`total-absent-${emp.id}`}>
                              {totals.absent}
                            </td>
                            <td className="px-2 py-1.5 text-center font-bold bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 summary-wo" data-testid={`total-wo-${emp.id}`}>
                              {totals.weeklyOff}
                            </td>
                            <td className="px-2 py-1.5 text-center font-bold bg-cyan-50 dark:bg-cyan-950/20 text-cyan-700 dark:text-cyan-300 summary-ot" data-testid={`ot-hours-${emp.id}`}>
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
          <>
            <div className="flex flex-wrap gap-3 px-4 py-3 bg-muted/30 rounded-lg border text-[11px] print-legend" data-testid="legend-codes">
              <span className="font-semibold mr-1">Codes:</span>
              <span><strong className="text-emerald-700 dark:text-emerald-400">P</strong> = Present</span>
              <span><strong className="text-yellow-700 dark:text-yellow-400">H</strong> = Holiday</span>
              <span><strong className="text-teal-700 dark:text-teal-400">P/HL</strong> = Holiday Present</span>
              <span><strong className="text-amber-700 dark:text-amber-400">HD</strong> = Half Day</span>
              <span><strong className="text-red-700 dark:text-red-400">A</strong> = Absent</span>
              <span><strong className="text-blue-700 dark:text-blue-400">WO</strong> = Weekly Off</span>
              <span><strong className="text-orange-700 dark:text-orange-400">CL</strong> = Casual Leave</span>
              <span><strong className="text-orange-700 dark:text-orange-400">SL</strong> = Sick Leave</span>
              <span><strong className="text-orange-700 dark:text-orange-400">EL</strong> = Earned Leave</span>
            </div>
            <div className="hidden print-sign-block">
              <div><p>_________________________</p><p style={{ marginTop: '4px' }}>Prepared By</p></div>
              <div><p>_________________________</p><p style={{ marginTop: '4px' }}>Checked By</p></div>
              <div><p>_________________________</p><p style={{ marginTop: '4px' }}>Authorized Signatory</p></div>
            </div>
            <div className="flex justify-end no-print">
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-save-bottom">
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save All
              </Button>
            </div>
          </>
        )}
      </div>
      <PrintSettingsDialog
        open={printDialogOpen}
        onOpenChange={setPrintDialogOpen}
        employees={printEmployeeList}
        selectedEmployeeIds={printSelectedIds}
        onSelectedEmployeeIdsChange={setPrintSelectedIds}
        onPrint={executeGovPrint}
        title="Print Form XVI - Select Employees"
      />
    </Layout>
  );
}
