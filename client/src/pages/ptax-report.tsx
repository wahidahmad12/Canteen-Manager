import { useState, useMemo } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useClientNames } from "@/hooks/use-reports";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Printer, FileSpreadsheet, IndianRupee, FileText } from "lucide-react";
import { Link } from "wouter";
import type { Employee, SalaryRecord } from "@shared/schema";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export default function PtaxReport() {
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

  const allSalaryRecords = useMemo(() => {
    const records: SalaryRecord[] = [];
    for (const q of salaryQueries) {
      if (q.data) records.push(...q.data);
    }
    return records;
  }, [salaryQueries.map(q => q.data)]);

  const empMap = useMemo(() => {
    const m = new Map<number, Employee>();
    for (const emp of employees) m.set(emp.id, emp);
    return m;
  }, [employees]);

  const clientWiseData = useMemo(() => {
    const grouped = new Map<string, { employees: { name: string; designation: string; grossWage: number; ptax: number }[]; totalPtax: number; totalGross: number }>();

    for (const sal of allSalaryRecords) {
      const emp = empMap.get(sal.employeeId);
      if (!emp) continue;
      const ptax = Math.round(Number(sal.professionalTax) || 0);
      const gross = Math.round(Number(sal.grossWage) || 0);
      const client = sal.clientName || "Unknown";

      if (!grouped.has(client)) {
        grouped.set(client, { employees: [], totalPtax: 0, totalGross: 0 });
      }
      const group = grouped.get(client)!;
      group.employees.push({
        name: emp.name,
        designation: emp.designation || "",
        grossWage: gross,
        ptax,
      });
      group.totalPtax += ptax;
      group.totalGross += gross;
    }

    return grouped;
  }, [allSalaryRecords, empMap]);

  const grandTotalPtax = useMemo(() => {
    let total = 0;
    for (const [, group] of clientWiseData) total += group.totalPtax;
    return total;
  }, [clientWiseData]);

  const grandTotalGross = useMemo(() => {
    let total = 0;
    for (const [, group] of clientWiseData) total += group.totalGross;
    return total;
  }, [clientWiseData]);

  const handlePrint = () => {
    const pw = window.open('', '_blank');
    if (!pw) return;

    let tableRows = '';
    let serial = 1;
    for (const [clientName, group] of clientWiseData) {
      tableRows += `<tr style="background:#f0f4ff"><td colspan="5" style="font-weight:bold;padding:6px 8px;border:1px solid #ccc">${clientName}</td></tr>`;
      for (const emp of group.employees) {
        tableRows += `<tr>
          <td style="border:1px solid #ccc;padding:4px 8px;text-align:center">${serial++}</td>
          <td style="border:1px solid #ccc;padding:4px 8px">${emp.name}</td>
          <td style="border:1px solid #ccc;padding:4px 8px">${emp.designation}</td>
          <td style="border:1px solid #ccc;padding:4px 8px;text-align:right">${emp.grossWage.toLocaleString()}</td>
          <td style="border:1px solid #ccc;padding:4px 8px;text-align:right">${emp.ptax.toLocaleString()}</td>
        </tr>`;
      }
      tableRows += `<tr style="background:#e8f5e9"><td colspan="3" style="font-weight:bold;padding:4px 8px;border:1px solid #ccc;text-align:right">${clientName} Total</td>
        <td style="font-weight:bold;padding:4px 8px;border:1px solid #ccc;text-align:right">${group.totalGross.toLocaleString()}</td>
        <td style="font-weight:bold;padding:4px 8px;border:1px solid #ccc;text-align:right">${group.totalPtax.toLocaleString()}</td>
      </tr>`;
    }
    tableRows += `<tr style="background:#fff3e0"><td colspan="3" style="font-weight:bold;padding:6px 8px;border:1px solid #ccc;text-align:right;font-size:13px">Grand Total</td>
      <td style="font-weight:bold;padding:6px 8px;border:1px solid #ccc;text-align:right;font-size:13px">${grandTotalGross.toLocaleString()}</td>
      <td style="font-weight:bold;padding:6px 8px;border:1px solid #ccc;text-align:right;font-size:13px">${grandTotalPtax.toLocaleString()}</td>
    </tr>`;

    pw.document.write(`<!DOCTYPE html><html><head><title>PTax Report - ${MONTHS[month-1]} ${year}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; }
      h2 { text-align: center; margin-bottom: 4px; }
      h4 { text-align: center; color: #555; margin-top: 0; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 11px; }
      th { background: #1a237e; color: white; padding: 6px 8px; border: 1px solid #ccc; }
      @media print { body { padding: 0; } }
    </style>
    </head><body>
      <h2>Professional Tax Report</h2>
      <h4>${MONTHS[month-1]} ${year}${selectedClient !== "__all__" ? " — " + selectedClient : ""}</h4>
      <table>
        <thead><tr><th>#</th><th>Employee Name</th><th>Designation</th><th style="text-align:right">Gross Wage</th><th style="text-align:right">P.Tax</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </body></html>`);
    pw.document.close();
    pw.onload = () => { pw.print(); pw.onafterprint = () => pw.close(); };
  };

  const handleExportExcel = async () => {
    if (clientWiseData.size === 0) return;
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("PTax Report");

    const title = ws.addRow([`Professional Tax Report - ${MONTHS[month-1]} ${year}`]);
    title.getCell(1).font = { bold: true, size: 14 };
    ws.mergeCells(1, 1, 1, 5);
    ws.addRow([]);

    const headers = ["#", "Employee Name", "Designation", "Gross Wage", "P.Tax"];
    const headerRow = ws.addRow(headers);
    headerRow.eachCell((cell: any) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A237E" } };
      cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
      cell.alignment = { horizontal: "center" };
    });

    let serial = 1;
    for (const [clientName, group] of clientWiseData) {
      const clientRow = ws.addRow([clientName]);
      clientRow.getCell(1).font = { bold: true, size: 11 };
      clientRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EAF6" } };
      ws.mergeCells(clientRow.number, 1, clientRow.number, 5);

      for (const emp of group.employees) {
        const r = ws.addRow([serial++, emp.name, emp.designation, emp.grossWage, emp.ptax]);
        r.eachCell((cell: any) => {
          cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
        });
        r.getCell(4).numFmt = "#,##0";
        r.getCell(5).numFmt = "#,##0";
        r.getCell(4).alignment = { horizontal: "right" };
        r.getCell(5).alignment = { horizontal: "right" };
      }

      const totalRow = ws.addRow(["", "", `${clientName} Total`, group.totalGross, group.totalPtax]);
      totalRow.getCell(3).font = { bold: true };
      totalRow.getCell(3).alignment = { horizontal: "right" };
      totalRow.getCell(4).font = { bold: true };
      totalRow.getCell(4).numFmt = "#,##0";
      totalRow.getCell(4).alignment = { horizontal: "right" };
      totalRow.getCell(5).font = { bold: true };
      totalRow.getCell(5).numFmt = "#,##0";
      totalRow.getCell(5).alignment = { horizontal: "right" };
      totalRow.eachCell((cell: any) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F5E9" } };
        cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
      });
    }

    const grandRow = ws.addRow(["", "", "Grand Total", grandTotalGross, grandTotalPtax]);
    grandRow.getCell(3).font = { bold: true, size: 12 };
    grandRow.getCell(3).alignment = { horizontal: "right" };
    grandRow.getCell(4).font = { bold: true, size: 12 };
    grandRow.getCell(4).numFmt = "#,##0";
    grandRow.getCell(4).alignment = { horizontal: "right" };
    grandRow.getCell(5).font = { bold: true, size: 12 };
    grandRow.getCell(5).numFmt = "#,##0";
    grandRow.getCell(5).alignment = { horizontal: "right" };
    grandRow.eachCell((cell: any) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF3E0" } };
      cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    });

    ws.columns = [{ width: 6 }, { width: 28 }, { width: 20 }, { width: 14 }, { width: 12 }];

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `PTax_Report_${MONTHS[month-1]}_${year}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const PTAX_SLABS = [
    { label: "Do Not Exceed INR 10000/-", min: 0, max: 10000, rate: 0 },
    { label: "Exceeds INR 10001/- but does not exceed INR 15000/-", min: 10001, max: 15000, rate: 110 },
    { label: "Exceeds INR 15001/- but does not exceed INR 25000/-", min: 15001, max: 25000, rate: 130 },
    { label: "Exceeds INR 25001/- but does not exceed INR 40000/-", min: 25001, max: 40000, rate: 150 },
    { label: "Exceeds INR 40001/- but does not exceed INR 100000/-", min: 40001, max: 100000, rate: 200 },
  ];

  const slabData = useMemo(() => {
    return PTAX_SLABS.map(slab => {
      let count = 0;
      for (const sal of allSalaryRecords) {
        const gross = Math.round(Number(sal.grossWage) || 0);
        if (gross >= slab.min && gross <= slab.max) count++;
      }
      return { ...slab, count, tax: count * slab.rate };
    });
  }, [allSalaryRecords]);

  const slabTotal = useMemo(() => {
    return slabData.reduce((s, d) => ({ count: s.count + d.count, tax: s.tax + d.tax }), { count: 0, tax: 0 });
  }, [slabData]);

  const [showForm5, setShowForm5] = useState(false);
  const [challanNo, setChallanNo] = useState("");
  const [chequeNo, setChequeNo] = useState("");
  const [challanDate, setChallanDate] = useState("");
  const [bankName, setBankName] = useState("");
  const [signatoryName, setSignatoryName] = useState("");

  const handlePrintForm5 = () => {
    const pw = window.open('', '_blank');
    if (!pw) return;

    let slabRows = '';
    for (const s of slabData) {
      slabRows += `<tr>
        <td style="border:1px solid #000;padding:6px 8px;text-align:left">${s.label}</td>
        <td style="border:1px solid #000;padding:6px 8px;text-align:center">${s.rate.toFixed(2)}</td>
        <td style="border:1px solid #000;padding:6px 8px;text-align:center">${s.count}</td>
        <td style="border:1px solid #000;padding:6px 8px;text-align:center">${s.count > 0 && s.rate > 0 ? s.tax.toFixed(2) : ''}</td>
      </tr>`;
    }
    slabRows += `<tr style="font-weight:bold;background:#fff3e0">
      <td style="border:1px solid #000;padding:6px 8px;font-weight:bold">Total (in INR)</td>
      <td style="border:1px solid #000;padding:6px 8px"></td>
      <td style="border:1px solid #000;padding:6px 8px;text-align:center;font-weight:bold">${slabTotal.count}</td>
      <td style="border:1px solid #000;padding:6px 8px;text-align:center;font-weight:bold">${slabTotal.tax > 0 ? slabTotal.tax.toFixed(2) : ''}</td>
    </tr>`;

    pw.document.write(`<!DOCTYPE html><html><head><title>Form 5 - PTax Return - ${MONTHS[month-1]} ${year}</title>
    <style>
      body { font-family: 'Times New Roman', serif; padding: 30px 40px; font-size: 13px; line-height: 1.6; color: #000; }
      h2 { text-align: center; margin-bottom: 2px; font-size: 18px; }
      .subtitle { text-align: center; font-size: 12px; margin-bottom: 4px; }
      .month-line { text-align: center; font-weight: bold; font-size: 14px; margin: 16px 0; }
      table { width: 100%; border-collapse: collapse; margin: 12px 0; }
      th { background: #f5deb3; border: 1px solid #000; padding: 8px; font-weight: bold; font-size: 12px; }
      td { font-size: 12px; }
      .cert { margin-top: 24px; text-align: justify; }
      .sig-area { margin-top: 50px; display: flex; justify-content: space-between; }
      @media print { body { padding: 15mm 20mm; } @page { size: A4 portrait; margin: 15mm; } }
    </style></head><body>
      <h2>FORM 5</h2>
      <p class="subtitle">Return of tax payable by employer under Sub-section(1) of Section 6 of the Gujarat state Tax on Professions,<br/>Traders, Callings and Employments Act, 1976</p>
      <p class="month-line">For the month of ${MONTHS[month-1]} - ${year}</p>
      <table>
        <thead>
          <tr>
            <th style="text-align:left;width:45%">Monthly Salaries or Wages</th>
            <th style="width:15%">Rate</th>
            <th style="width:20%">No. of Employees</th>
            <th style="width:20%">Tax (in INR)</th>
          </tr>
        </thead>
        <tbody>${slabRows}</tbody>
      </table>
      <div style="margin-top:20px">
        <p>Amount paid under challan No. <b>${challanNo || '...................'}</b> Cheque No. <b>${chequeNo || '...................'}</b> &nbsp;&nbsp;&nbsp;&nbsp; Dated <b>${challanDate || '...................'}</b></p>
        <p>Name of the Bank <b>${bankName || '...................'}</b></p>
      </div>
      <div class="cert">
        <p style="text-indent:40px">I certify that all employees who are liable to pay the tax in my employ during the period of return have been covered by the foregoing particulars. I also certify that the necessary revision in the amount of tax deductible from the salary or wages of the employees on account of variation in the salary or wages earned by them has been made where necessary.</p>
      </div>
      <div style="margin-top:20px">
        <p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;I , Shri <b>${signatoryName || '.........................................'}</b></p>
        <p>solemnly declare that above statements are true to the best of my knowledge and belief.</p>
      </div>
      <div class="sig-area">
        <div>Place : Kolkata</div>
        <div>Signature of Employer</div>
      </div>
    </body></html>`);
    pw.document.close();
    pw.onload = () => { pw.print(); pw.onafterprint = () => pw.close(); };
  };

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" className="shrink-0" data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold flex items-center gap-2 truncate" data-testid="text-page-title">
              <IndianRupee className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" /> P.Tax Report
            </h1>
            <p className="text-[10px] sm:text-sm text-muted-foreground truncate">Professional Tax — Client-wise summary</p>
          </div>
        </div>

        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5 min-w-[140px]">
                <Label className="text-xs font-semibold">Client</Label>
                <Select value={selectedClient} onValueChange={setSelectedClient}>
                  <SelectTrigger data-testid="select-client"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Clients</SelectItem>
                    {clientNames.map(c => (
                      <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 min-w-[120px]">
                <Label className="text-xs font-semibold">Month</Label>
                <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
                  <SelectTrigger data-testid="select-month"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => (
                      <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 min-w-[90px]">
                <Label className="text-xs font-semibold">Year</Label>
                <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
                  <SelectTrigger data-testid="select-year"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 ml-auto">
                <Button size="sm" variant="outline" onClick={handlePrint} className="gap-1.5 text-xs sm:text-sm" data-testid="button-print-ptax">
                  <Printer className="w-4 h-4" /> Print
                </Button>
                <Button size="sm" variant="outline" onClick={handleExportExcel} className="gap-1.5 text-xs sm:text-sm" data-testid="button-export-ptax">
                  <FileSpreadsheet className="w-4 h-4" /> Excel
                </Button>
                <Button size="sm" variant={showForm5 ? "default" : "outline"} onClick={() => setShowForm5(!showForm5)} className="gap-1.5 text-xs sm:text-sm" data-testid="button-toggle-form5">
                  <FileText className="w-4 h-4" /> Form 5
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {Array.from(clientWiseData).map(([clientName, group]) => (
          <Card key={clientName}>
            <CardContent className="p-0">
              <div className="bg-muted/50 px-3 py-2 flex justify-between items-center border-b">
                <span className="font-semibold text-sm" data-testid={`text-client-name-${clientName}`}>{clientName}</span>
                <span className="text-xs font-semibold text-primary" data-testid={`text-client-ptax-${clientName}`}>
                  P.Tax Total: ₹{group.totalPtax.toLocaleString()}
                </span>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs w-[40px]">#</TableHead>
                      <TableHead className="text-xs">Employee Name</TableHead>
                      <TableHead className="text-xs">Designation</TableHead>
                      <TableHead className="text-xs text-right">Gross Wage</TableHead>
                      <TableHead className="text-xs text-right">P.Tax</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.employees.map((emp, i) => (
                      <TableRow key={i} data-testid={`row-ptax-${clientName}-${i}`}>
                        <TableCell className="text-xs">{i + 1}</TableCell>
                        <TableCell className="text-xs">{emp.name}</TableCell>
                        <TableCell className="text-xs">{emp.designation}</TableCell>
                        <TableCell className="text-xs text-right">₹{emp.grossWage.toLocaleString()}</TableCell>
                        <TableCell className="text-xs text-right font-semibold">₹{emp.ptax.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={3} className="text-xs text-right font-bold">Client Total</TableCell>
                      <TableCell className="text-xs text-right font-bold">₹{group.totalGross.toLocaleString()}</TableCell>
                      <TableCell className="text-xs text-right font-bold">₹{group.totalPtax.toLocaleString()}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ))}

        {clientWiseData.size > 1 && (
          <Card className="border-2 border-primary/20">
            <CardContent className="p-3 flex justify-between items-center">
              <span className="font-bold text-sm" data-testid="text-grand-total-label">Grand Total</span>
              <div className="flex gap-6">
                <span className="text-sm">Gross: <strong>₹{grandTotalGross.toLocaleString()}</strong></span>
                <span className="text-sm text-primary font-bold" data-testid="text-grand-total-ptax">P.Tax: ₹{grandTotalPtax.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {clientWiseData.size === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground text-sm">
              No salary records found for {MONTHS[month - 1]} {year}
            </CardContent>
          </Card>
        )}

        {showForm5 && (
          <Card className="border-2 border-amber-300 dark:border-amber-700">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Form 5 — Professional Tax Return (Govt. Format)
                </h3>
                <Button size="sm" onClick={handlePrintForm5} className="gap-1.5" data-testid="button-print-form5">
                  <Printer className="w-4 h-4" /> Print Form 5
                </Button>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-amber-100 dark:bg-amber-900/30">
                      <TableHead className="text-xs font-bold">Monthly Salaries or Wages</TableHead>
                      <TableHead className="text-xs font-bold text-center">Rate</TableHead>
                      <TableHead className="text-xs font-bold text-center">No. of Employees</TableHead>
                      <TableHead className="text-xs font-bold text-center">Tax (in INR)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {slabData.map((s, i) => (
                      <TableRow key={i} data-testid={`row-slab-${i}`}>
                        <TableCell className="text-xs">{s.label}</TableCell>
                        <TableCell className="text-xs text-center">{s.rate.toFixed(2)}</TableCell>
                        <TableCell className="text-xs text-center font-semibold">{s.count}</TableCell>
                        <TableCell className="text-xs text-center">{s.count > 0 && s.rate > 0 ? s.tax.toFixed(2) : ''}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-amber-50 dark:bg-amber-900/20 font-bold">
                      <TableCell className="text-xs font-bold">Total (in INR)</TableCell>
                      <TableCell className="text-xs"></TableCell>
                      <TableCell className="text-xs text-center font-bold">{slabTotal.count}</TableCell>
                      <TableCell className="text-xs text-center font-bold">{slabTotal.tax > 0 ? slabTotal.tax.toFixed(2) : ''}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                <div className="space-y-1">
                  <Label className="text-xs">Challan No.</Label>
                  <Input value={challanNo} onChange={e => setChallanNo(e.target.value)} placeholder="Challan No." data-testid="input-challan-no" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Cheque No.</Label>
                  <Input value={chequeNo} onChange={e => setChequeNo(e.target.value)} placeholder="Cheque No." data-testid="input-cheque-no" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Dated</Label>
                  <Input type="date" value={challanDate} onChange={e => setChallanDate(e.target.value)} data-testid="input-challan-date" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Name of the Bank</Label>
                  <Input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="Bank Name" data-testid="input-bank-name" />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Signatory Name (I, Shri ...)</Label>
                  <Input value={signatoryName} onChange={e => setSignatoryName(e.target.value)} placeholder="Signatory Name" data-testid="input-signatory-name" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
