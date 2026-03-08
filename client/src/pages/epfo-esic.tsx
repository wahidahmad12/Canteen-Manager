import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useClientNames, useCurrentUser } from "@/hooks/use-reports";
import { ArrowLeft, Download, Building2, Loader2, FileSpreadsheet } from "lucide-react";
import { Link } from "wouter";
import type { Employee, SalaryRecord } from "@shared/schema";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function getDaysInMonth(month: number, year: number) {
  return new Date(year, month, 0).getDate();
}

export default function EpfoEsicPage() {
  const { toast } = useToast();
  const { data: user } = useCurrentUser();
  const { data: clientNames = [] } = useClientNames();
  const [selectedClient, setSelectedClient] = useState("__all__");
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  const clientsToFetch = useMemo(() => {
    if (selectedClient === "__all__") return clientNames.map(c => c.name);
    return [selectedClient];
  }, [selectedClient, clientNames]);

  const salaryQueries = useQueries({
    queries: clientsToFetch.map(cn => ({
      queryKey: ["/api/salary", { clientName: cn, month, year }] as const,
      queryFn: async () => {
        const res = await fetch(`/api/salary?clientName=${encodeURIComponent(cn)}&month=${month}&year=${year}`, { credentials: "include" });
        if (!res.ok) return [];
        return res.json() as Promise<SalaryRecord[]>;
      },
      enabled: !!cn && !!month && !!year,
    })),
  });

  const salaryMap = useMemo(() => {
    const map = new Map<number, SalaryRecord>();
    for (const q of salaryQueries) {
      if (q.data) {
        for (const sr of q.data) {
          map.set(sr.employeeId, sr);
        }
      }
    }
    return map;
  }, [salaryQueries]);

  const filteredEmployees = (selectedClient === "__all__"
    ? employees
    : employees.filter(e => e.clientName === selectedClient)
  ).filter(e => e.isActive !== false);

  const totalDays = getDaysInMonth(month, year);

  const epfoData = filteredEmployees
    .filter(e => e.uanNo && e.uanNo.trim() !== "")
    .map(emp => {
      const sal = salaryMap.get(emp.id);
      const grossWages = sal ? Math.round(Number(sal.grossWage)) : 0;
      const basicWage = sal ? Math.round(Number(sal.basicWage)) : 0;
      const da = sal ? Math.round(Number(sal.da)) : 0;
      const epfWages = basicWage + da;
      const daysWorked = sal ? Number(sal.daysWorked) : 0;
      const ncpDays = grossWages > 0 ? Math.max(0, totalDays - Math.round(daysWorked)) : totalDays;
      const epsWages = epfWages > 15000 ? 15000 : epfWages;
      const edliWages = epsWages > 15000 ? 15000 : epsWages;
      const epfContri = Math.round(epfWages * 0.12);
      const epsContri = Math.round(epsWages * 0.0833);
      const epfEpsDiff = epfContri - epsContri;

      return {
        uan: emp.uanNo || "",
        memberName: emp.name,
        clientName: emp.clientName,
        grossWages,
        epfWages,
        epsWages,
        edliWages,
        epfContri,
        epsContri,
        epfEpsDiff,
        ncpDays,
        refundOfAdvances: 0,
      };
    });

  const esicData = filteredEmployees
    .filter(e => e.esicNo && e.esicNo.trim() !== "")
    .map(emp => {
      const sal = salaryMap.get(emp.id);
      const totalMonthlyWages = sal ? Math.round(Number(sal.grossWage)) : 0;
      const daysWorked = sal ? Math.round(Number(sal.daysWorked)) : 0;

      return {
        ipNumber: emp.esicNo || "",
        ipName: emp.name,
        clientName: emp.clientName,
        noOfDays: daysWorked,
        totalMonthlyWages,
        reasonCode: 0,
        lastWorkingDay: emp.leavingDate && new Date(emp.leavingDate) <= new Date()
          ? new Date(emp.leavingDate).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })
          : "",
      };
    });

  const exportEpfoExcel = async () => {
    if (epfoData.length === 0) {
      toast({ title: "No EPFO data to export", variant: "destructive" });
      return;
    }

    const ExcelJS = (await import("exceljs")).default;

    if (selectedClient === "__all__") {
      const clientGroups = new Map<string, typeof epfoData>();
      for (const row of epfoData) {
        if (!clientGroups.has(row.clientName)) clientGroups.set(row.clientName, []);
        clientGroups.get(row.clientName)!.push(row);
      }

      for (const [clientName, rows] of clientGroups) {
        const wb = new ExcelJS.Workbook();
        buildEpfoSheet(wb, rows, clientName);
        const buf = await wb.xlsx.writeBuffer();
        downloadBuffer(buf, `EPFO_${clientName.replace(/\s+/g, '_')}_${MONTHS[month - 1]}_${year}.xlsx`);
      }
    } else {
      const wb = new ExcelJS.Workbook();
      buildEpfoSheet(wb, epfoData, selectedClient);
      const buf = await wb.xlsx.writeBuffer();
      downloadBuffer(buf, `EPFO_${selectedClient.replace(/\s+/g, '_')}_${MONTHS[month - 1]}_${year}.xlsx`);
    }
    toast({ title: "EPFO Excel exported" });
  };

  const buildEpfoSheet = (wb: any, rows: typeof epfoData, clientName: string) => {
    const ws = wb.addWorksheet("EPFO");

    const monthDate = new Date(year, month - 1, 1);
    ws.addRow([monthDate, null, null, null, null, null, null, null, null, null, null]);
    const dateCell = ws.getCell("A1");
    dateCell.numFmt = "yyyy-mm-dd";

    const headers = [
      "UAN", "MEMBER NAME", "GROSS WAGES", "EPF WAGES", "EPS WAGES",
      "EDLI WAGES", "EPF CONTRI REMITTED", "EPS CONTRI REMITTED",
      "EPF EPS DIFF REMITTED", "NCP DAYS", "REFUND OF ADVANCES"
    ];
    const headerRow = ws.addRow(headers);
    headerRow.eachCell((cell: any) => {
      cell.font = { bold: true, size: 11 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } };
      cell.border = {
        top: { style: "thin" }, bottom: { style: "thin" },
        left: { style: "thin" }, right: { style: "thin" },
      };
      cell.alignment = { horizontal: "center", wrapText: true };
    });

    for (const row of rows) {
      const dataRow = ws.addRow([
        row.uan, row.memberName, row.grossWages, row.epfWages, row.epsWages,
        row.edliWages, row.epfContri, row.epsContri, row.epfEpsDiff,
        row.ncpDays, row.refundOfAdvances,
      ]);
      dataRow.eachCell((cell: any, colNumber: number) => {
        cell.border = {
          top: { style: "thin" }, bottom: { style: "thin" },
          left: { style: "thin" }, right: { style: "thin" },
        };
        if (colNumber >= 3) {
          cell.numFmt = "#,##0";
          cell.alignment = { horizontal: "right" };
        }
      });
    }

    ws.columns = [
      { width: 16 }, { width: 25 }, { width: 14 }, { width: 14 }, { width: 14 },
      { width: 14 }, { width: 18 }, { width: 18 }, { width: 20 }, { width: 12 }, { width: 18 },
    ];
  };

  const exportEsicExcel = async () => {
    if (esicData.length === 0) {
      toast({ title: "No ESIC data to export", variant: "destructive" });
      return;
    }

    const ExcelJS = (await import("exceljs")).default;

    if (selectedClient === "__all__") {
      const clientGroups = new Map<string, typeof esicData>();
      for (const row of esicData) {
        if (!clientGroups.has(row.clientName)) clientGroups.set(row.clientName, []);
        clientGroups.get(row.clientName)!.push(row);
      }

      for (const [clientName, rows] of clientGroups) {
        const wb = new ExcelJS.Workbook();
        buildEsicSheet(wb, rows, clientName);
        const buf = await wb.xlsx.writeBuffer();
        downloadBuffer(buf, `ESIC_${clientName.replace(/\s+/g, '_')}_${MONTHS[month - 1]}_${year}.xlsx`);
      }
    } else {
      const wb = new ExcelJS.Workbook();
      buildEsicSheet(wb, esicData, selectedClient);
      const buf = await wb.xlsx.writeBuffer();
      downloadBuffer(buf, `ESIC_${selectedClient.replace(/\s+/g, '_')}_${MONTHS[month - 1]}_${year}.xlsx`);
    }
    toast({ title: "ESIC Excel exported" });
  };

  const buildEsicSheet = (wb: any, rows: typeof esicData, clientName: string) => {
    const ws = wb.addWorksheet("Sheet1");

    const headers = [
      "IP Number \n(10 Digits)",
      "IP Name\n( Only alphabets and space )",
      "No of Days for which wages paid/payable during the month",
      "Total Monthly Wages",
      " Reason Code for Zero workings days(numeric only; provide 0 for all other reasons- Click on the link for reference)",
      " Last Working Day\n( Format DD/MM/YYYY  or DD-MM-YYYY)",
    ];
    const headerRow = ws.addRow(headers);
    headerRow.eachCell((cell: any) => {
      cell.font = { bold: true, size: 10 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } };
      cell.border = {
        top: { style: "thin" }, bottom: { style: "thin" },
        left: { style: "thin" }, right: { style: "thin" },
      };
      cell.alignment = { horizontal: "center", wrapText: true, vertical: "middle" };
    });
    headerRow.height = 50;

    for (const row of rows) {
      const dataRow = ws.addRow([
        row.ipNumber, row.ipName, row.noOfDays, row.totalMonthlyWages,
        row.reasonCode, row.lastWorkingDay,
      ]);
      dataRow.eachCell((cell: any, colNumber: number) => {
        cell.border = {
          top: { style: "thin" }, bottom: { style: "thin" },
          left: { style: "thin" }, right: { style: "thin" },
        };
        if (colNumber === 3 || colNumber === 4) {
          cell.numFmt = "#,##0";
          cell.alignment = { horizontal: "right" };
        }
      });
    }

    ws.columns = [
      { width: 16 }, { width: 28 }, { width: 20 }, { width: 18 }, { width: 22 }, { width: 20 },
    ];

    const ws2 = wb.addWorksheet("Instructions & Reason Codes");
    ws2.addRow(["Reason", "Code", "Note"]);
    ws2.addRow(["Without Reason", 0, "Leave last working day as blank"]);
    ws2.addRow(["On Leave", 1, "Leave last working day as blank"]);
    ws2.addRow(["Left Service", 2, "Please provide last working day (dd/mm/yyyy). IP will not appear from next wage period"]);
    ws2.addRow(["Retired", 3, "Please provide last working day (dd/mm/yyyy). IP will not appear from next wage period"]);
    ws2.addRow(["Out of Coverage", 4, "Please provide last working day (dd/mm/yyyy). IP will not appear from next contribution period."]);
    ws2.addRow(["Expired", 5, "Please provide last working day (dd/mm/yyyy). IP will not appear from next wage period"]);
    ws2.addRow(["Non Implemented area", 6, "Please provide last working day (dd/mm/yyyy)."]);

    const hdrRow = ws2.getRow(1);
    hdrRow.eachCell((cell: any) => {
      cell.font = { bold: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } };
    });
    ws2.columns = [{ width: 22 }, { width: 8 }, { width: 80 }];
  };

  const downloadBuffer = (buffer: any, filename: string) => {
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const years = Array.from({ length: 5 }, (_, i) => year - 2 + i);

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
                <FileSpreadsheet className="w-6 h-6" /> EPFO & ESIC Export
              </h1>
              <p className="text-sm text-muted-foreground">Export monthly EPFO and ESIC data in government format</p>
            </div>
          </div>
        </div>

        <Card className="no-print">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-3 items-end">
              <div className="space-y-2 col-span-2 sm:col-span-1 sm:min-w-[200px]">
                <Label className="text-xs font-semibold flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5" /> Company / Client
                </Label>
                <Select value={selectedClient} onValueChange={setSelectedClient}>
                  <SelectTrigger data-testid="select-client"><SelectValue placeholder="Select Company" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Clients</SelectItem>
                    {clientNames.map(c => (
                      <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Month</Label>
                <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                  <SelectTrigger className="w-[140px]" data-testid="select-month"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => (
                      <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Year</Label>
                <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                  <SelectTrigger className="w-[100px]" data-testid="select-year"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {years.map(y => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="epfo">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="epfo" data-testid="tab-epfo" className="flex-1 sm:flex-none gap-1">
              EPFO <span className="text-xs text-muted-foreground">({epfoData.length})</span>
            </TabsTrigger>
            <TabsTrigger value="esic" data-testid="tab-esic" className="flex-1 sm:flex-none gap-1">
              ESIC <span className="text-xs text-muted-foreground">({esicData.length})</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="epfo" className="space-y-3">
            <div className="flex justify-end">
              <Button onClick={exportEpfoExcel} className="gap-2" data-testid="button-export-epfo">
                <Download className="w-4 h-4" /> Export EPFO Excel
                {selectedClient === "__all__" ? " (Separate Files)" : ""}
              </Button>
            </div>
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">UAN</TableHead>
                        <TableHead className="text-xs">Member Name</TableHead>
                        {selectedClient === "__all__" && <TableHead className="text-xs">Client</TableHead>}
                        <TableHead className="text-xs text-right">Gross Wages</TableHead>
                        <TableHead className="text-xs text-right">EPF Wages</TableHead>
                        <TableHead className="text-xs text-right">EPS Wages</TableHead>
                        <TableHead className="text-xs text-right">EDLI Wages</TableHead>
                        <TableHead className="text-xs text-right">EPF Contri</TableHead>
                        <TableHead className="text-xs text-right">EPS Contri</TableHead>
                        <TableHead className="text-xs text-right">EPF-EPS Diff</TableHead>
                        <TableHead className="text-xs text-right">NCP Days</TableHead>
                        <TableHead className="text-xs text-right">Refund</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {epfoData.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={selectedClient === "__all__" ? 12 : 11} className="text-center text-muted-foreground py-8">
                            No employees with UAN number found for the selected filter
                          </TableCell>
                        </TableRow>
                      ) : (
                        epfoData.map((row, i) => (
                          <TableRow key={i} data-testid={`row-epfo-${i}`}>
                            <TableCell className="text-xs font-mono">{row.uan}</TableCell>
                            <TableCell className="text-xs font-medium">{row.memberName}</TableCell>
                            {selectedClient === "__all__" && <TableCell className="text-xs">{row.clientName}</TableCell>}
                            <TableCell className="text-xs text-right">{row.grossWages.toLocaleString()}</TableCell>
                            <TableCell className="text-xs text-right">{row.epfWages.toLocaleString()}</TableCell>
                            <TableCell className="text-xs text-right">{row.epsWages.toLocaleString()}</TableCell>
                            <TableCell className="text-xs text-right">{row.edliWages.toLocaleString()}</TableCell>
                            <TableCell className="text-xs text-right">{row.epfContri.toLocaleString()}</TableCell>
                            <TableCell className="text-xs text-right">{row.epsContri.toLocaleString()}</TableCell>
                            <TableCell className="text-xs text-right">{row.epfEpsDiff.toLocaleString()}</TableCell>
                            <TableCell className="text-xs text-right">{row.ncpDays}</TableCell>
                            <TableCell className="text-xs text-right">{row.refundOfAdvances}</TableCell>
                          </TableRow>
                        ))
                      )}
                      {epfoData.length > 0 && (
                        <TableRow className="bg-muted/50 font-bold">
                          <TableCell className="text-xs" colSpan={selectedClient === "__all__" ? 3 : 2}>TOTAL</TableCell>
                          <TableCell className="text-xs text-right">{epfoData.reduce((s, r) => s + r.grossWages, 0).toLocaleString()}</TableCell>
                          <TableCell className="text-xs text-right">{epfoData.reduce((s, r) => s + r.epfWages, 0).toLocaleString()}</TableCell>
                          <TableCell className="text-xs text-right">{epfoData.reduce((s, r) => s + r.epsWages, 0).toLocaleString()}</TableCell>
                          <TableCell className="text-xs text-right">{epfoData.reduce((s, r) => s + r.edliWages, 0).toLocaleString()}</TableCell>
                          <TableCell className="text-xs text-right">{epfoData.reduce((s, r) => s + r.epfContri, 0).toLocaleString()}</TableCell>
                          <TableCell className="text-xs text-right">{epfoData.reduce((s, r) => s + r.epsContri, 0).toLocaleString()}</TableCell>
                          <TableCell className="text-xs text-right">{epfoData.reduce((s, r) => s + r.epfEpsDiff, 0).toLocaleString()}</TableCell>
                          <TableCell className="text-xs text-right">{epfoData.reduce((s, r) => s + r.ncpDays, 0)}</TableCell>
                          <TableCell className="text-xs text-right">0</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="esic" className="space-y-3">
            <div className="flex justify-end">
              <Button onClick={exportEsicExcel} className="gap-2" data-testid="button-export-esic">
                <Download className="w-4 h-4" /> Export ESIC Excel
                {selectedClient === "__all__" ? " (Separate Files)" : ""}
              </Button>
            </div>
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">IP Number</TableHead>
                        <TableHead className="text-xs">IP Name</TableHead>
                        {selectedClient === "__all__" && <TableHead className="text-xs">Client</TableHead>}
                        <TableHead className="text-xs text-right">Days Paid</TableHead>
                        <TableHead className="text-xs text-right">Total Monthly Wages</TableHead>
                        <TableHead className="text-xs text-center">Reason Code</TableHead>
                        <TableHead className="text-xs">Last Working Day</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {esicData.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={selectedClient === "__all__" ? 7 : 6} className="text-center text-muted-foreground py-8">
                            No employees with ESIC number found for the selected filter
                          </TableCell>
                        </TableRow>
                      ) : (
                        esicData.map((row, i) => (
                          <TableRow key={i} data-testid={`row-esic-${i}`}>
                            <TableCell className="text-xs font-mono">{row.ipNumber}</TableCell>
                            <TableCell className="text-xs font-medium">{row.ipName}</TableCell>
                            {selectedClient === "__all__" && <TableCell className="text-xs">{row.clientName}</TableCell>}
                            <TableCell className="text-xs text-right">{row.noOfDays}</TableCell>
                            <TableCell className="text-xs text-right">{row.totalMonthlyWages.toLocaleString()}</TableCell>
                            <TableCell className="text-xs text-center">{row.reasonCode}</TableCell>
                            <TableCell className="text-xs">{row.lastWorkingDay}</TableCell>
                          </TableRow>
                        ))
                      )}
                      {esicData.length > 0 && (
                        <TableRow className="bg-muted/50 font-bold">
                          <TableCell className="text-xs" colSpan={selectedClient === "__all__" ? 4 : 3}>TOTAL</TableCell>
                          <TableCell className="text-xs text-right">{esicData.reduce((s, r) => s + r.totalMonthlyWages, 0).toLocaleString()}</TableCell>
                          <TableCell colSpan={2}></TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
