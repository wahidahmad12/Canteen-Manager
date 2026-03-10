import { useState, useMemo } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { usePurchaseInvoices, useVendors, useClientNames } from "@/hooks/use-reports";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear } from "date-fns";
import { Loader2, FileDown, ArrowLeft, BarChart3, Filter, Receipt, IndianRupee, Check, CreditCard, TrendingUp, TrendingDown, Wallet, Store, Building2, FileSpreadsheet } from "lucide-react";
import { useLocation } from "wouter";
import { Label } from "@/components/ui/label";

type DatePreset = "custom" | "current-month" | "previous-month" | "current-year" | "financial-year" | "all";

function getFinancialYearStart(): Date {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return new Date(year, 3, 1);
}

function getFinancialYearEnd(): Date {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() + 1 : now.getFullYear();
  return new Date(year, 2, 31);
}

interface VendorSummary {
  vendorName: string;
  clientName: string;
  totalBillAmount: number;
  totalGst: number;
  grandTotal: number;
  totalPaid: number;
  totalBalance: number;
  invoiceCount: number;
  paidCount: number;
  unpaidCount: number;
}

export default function VendorReport() {
  const [, navigate] = useLocation();
  const { data: invoices, isLoading } = usePurchaseInvoices();
  const { data: vendors } = useVendors();
  const { data: clients } = useClientNames();

  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [fromDate, setFromDate] = useState<Date | undefined>(undefined);
  const [toDate, setToDate] = useState<Date | undefined>(undefined);
  const [vendorFilter, setVendorFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [groupBy, setGroupBy] = useState<"vendor" | "client">("vendor");

  const handlePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    const now = new Date();
    switch (preset) {
      case "current-month":
        setFromDate(startOfMonth(now));
        setToDate(endOfMonth(now));
        break;
      case "previous-month":
        setFromDate(startOfMonth(subMonths(now, 1)));
        setToDate(endOfMonth(subMonths(now, 1)));
        break;
      case "current-year":
        setFromDate(startOfYear(now));
        setToDate(new Date(now.getFullYear(), 11, 31));
        break;
      case "financial-year":
        setFromDate(getFinancialYearStart());
        setToDate(getFinancialYearEnd());
        break;
      case "all":
        setFromDate(undefined);
        setToDate(undefined);
        break;
      case "custom":
        break;
    }
  };

  const filteredInvoices = useMemo(() => {
    if (!invoices) return [];
    return invoices.filter((inv: any) => {
      const invDate = new Date(inv.date);
      if (fromDate && invDate < fromDate) return false;
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        if (invDate > end) return false;
      }
      if (vendorFilter !== "all" && inv.vendorName !== vendorFilter) return false;
      if (clientFilter !== "all" && inv.clientName !== clientFilter) return false;
      return true;
    });
  }, [invoices, fromDate, toDate, vendorFilter, clientFilter]);

  const summaryData = useMemo(() => {
    const map = new Map<string, VendorSummary>();

    filteredInvoices.forEach((inv: any) => {
      const key = groupBy === "vendor" ? inv.vendorName : inv.clientName;

      const existing = map.get(key) || {
        vendorName: groupBy === "vendor" ? inv.vendorName : "",
        clientName: groupBy === "client" ? inv.clientName : "",
        totalBillAmount: 0,
        totalGst: 0,
        grandTotal: 0,
        totalPaid: 0,
        totalBalance: 0,
        invoiceCount: 0,
        paidCount: 0,
        unpaidCount: 0,
      };

      const grand = Number(inv.grandTotal) || 0;
      existing.totalBillAmount += Number(inv.totalAmount) || 0;
      existing.totalGst += Number(inv.totalGst) || 0;
      existing.grandTotal += grand;
      if (inv.paymentGiven) {
        existing.totalPaid += grand;
        existing.paidCount++;
      } else {
        existing.totalBalance += grand;
        existing.unpaidCount++;
      }
      existing.invoiceCount++;

      map.set(key, existing);
    });

    return Array.from(map.values()).sort((a, b) =>
      groupBy === "vendor"
        ? a.vendorName.localeCompare(b.vendorName)
        : a.clientName.localeCompare(b.clientName)
    );
  }, [filteredInvoices, groupBy]);

  const grandTotals = useMemo(() => {
    return summaryData.reduce(
      (acc, row) => ({
        totalBillAmount: acc.totalBillAmount + row.totalBillAmount,
        totalGst: acc.totalGst + row.totalGst,
        grandTotal: acc.grandTotal + row.grandTotal,
        totalPaid: acc.totalPaid + row.totalPaid,
        totalBalance: acc.totalBalance + row.totalBalance,
        invoiceCount: acc.invoiceCount + row.invoiceCount,
        paidCount: acc.paidCount + row.paidCount,
        unpaidCount: acc.unpaidCount + row.unpaidCount,
      }),
      { totalBillAmount: 0, totalGst: 0, grandTotal: 0, totalPaid: 0, totalBalance: 0, invoiceCount: 0, paidCount: 0, unpaidCount: 0 }
    );
  }, [summaryData]);

  const handlePrint = () => {
    const originalTitle = document.title;
    const dateRange = fromDate && toDate
      ? `${format(fromDate, "dd-MM-yyyy")} to ${format(toDate, "dd-MM-yyyy")}`
      : "All Dates";
    document.title = `Vendor Report - ${dateRange}`;
    window.print();
    document.title = originalTitle;
  };

  const handleExportExcel = async () => {
    if (summaryData.length === 0) return;
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet("Vendor Report");

    const dateRange = fromDate && toDate
      ? `${format(fromDate, "dd-MM-yyyy")} to ${format(toDate, "dd-MM-yyyy")}`
      : "All Dates";

    const titleRow = ws.addRow(["Vendor Payment Report"]);
    titleRow.getCell(1).font = { bold: true, size: 16 };
    ws.mergeCells("A1:I1");
    titleRow.alignment = { horizontal: "center" };

    const dateRow = ws.addRow([`Period: ${dateRange}`]);
    dateRow.getCell(1).font = { size: 11 };
    ws.mergeCells("A2:I2");
    dateRow.alignment = { horizontal: "center" };

    ws.addRow([]);

    const groupLabel = groupBy === "vendor" ? "Vendor Name" : "Client Name";
    const headers = [groupLabel, "Invoices", "Total Bill", "GST", "Grand Total", "Paid", "Balance", "Paid Count", "Unpaid Count"];
    const headerRow = ws.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, size: 10 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF6366F1" } };
      cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
      cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
      cell.alignment = { horizontal: "center" };
    });

    summaryData.forEach((row, idx) => {
      const name = groupBy === "vendor" ? row.vendorName : row.clientName;
      const r = ws.addRow([
        name, row.invoiceCount, row.totalBillAmount, row.totalGst,
        row.grandTotal, row.totalPaid, row.totalBalance, row.paidCount, row.unpaidCount
      ]);
      r.eachCell((cell) => {
        cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
        cell.font = { size: 10 };
      });
      if (idx % 2 === 1) {
        r.eachCell((cell) => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F3FF" } };
        });
      }
    });

    const totRow = ws.addRow([
      "Total", grandTotals.invoiceCount, grandTotals.totalBillAmount, grandTotals.totalGst,
      grandTotals.grandTotal, grandTotals.totalPaid, grandTotals.totalBalance,
      grandTotals.paidCount, grandTotals.unpaidCount
    ]);
    totRow.eachCell((cell) => {
      cell.font = { bold: true, size: 10 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8E8E8" } };
      cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    });

    ws.getColumn(1).width = 30;
    ws.getColumn(2).width = 10;
    for (let i = 3; i <= 9; i++) ws.getColumn(i).width = 16;

    [3, 4, 5, 6, 7].forEach(col => {
      ws.getColumn(col).numFmt = '#,##0.00';
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const link = document.createElement("a");
    link.download = `VendorReport_${dateRange.replace(/\s+/g, "_")}.xlsx`;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const uniqueVendors = useMemo(() => {
    if (!invoices) return [];
    const names = new Set(invoices.map((inv: any) => inv.vendorName));
    return Array.from(names).sort();
  }, [invoices]);

  const uniqueClients = useMemo(() => {
    if (!invoices) return [];
    const names = new Set(invoices.map((inv: any) => inv.clientName));
    return Array.from(names).sort();
  }, [invoices]);

  const fmt = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" data-testid="loader" />
        </div>
      </Layout>
    );
  }

  const ROW_COLORS = [
    "from-indigo-500 to-violet-500",
    "from-emerald-500 to-teal-500",
    "from-orange-500 to-amber-500",
    "from-rose-500 to-pink-500",
    "from-cyan-500 to-blue-500",
    "from-fuchsia-500 to-purple-500",
  ];

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-5">
        <div className="flex items-center gap-3 print:hidden">
          <Button variant="outline" size="icon" onClick={() => navigate("/")} className="rounded-xl border-violet-200 hover:bg-violet-50 dark:border-violet-800 dark:hover:bg-violet-900/30" data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-500 bg-clip-text text-transparent" data-testid="text-report-title">Vendor Payment Report</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Payment summary & invoice tracking</p>
          </div>
        </div>

        <Card className="print:hidden border-0 shadow-lg overflow-hidden" data-testid="card-filters">
          <CardHeader className="bg-gradient-to-r from-slate-600 to-slate-700 text-white pb-3 pt-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="w-4 h-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 bg-gradient-to-b from-slate-50/80 to-transparent dark:from-slate-900/30">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Date Range</Label>
                <Select value={datePreset} onValueChange={(val) => handlePresetChange(val as DatePreset)}>
                  <SelectTrigger data-testid="select-date-preset">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current-month">Current Month</SelectItem>
                    <SelectItem value="previous-month">Previous Month</SelectItem>
                    <SelectItem value="current-year">Current Year</SelectItem>
                    <SelectItem value="financial-year">Financial Year</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                    <SelectItem value="all">All Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {datePreset === "custom" && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">From Date</Label>
                    <DatePicker date={fromDate} setDate={(d) => setFromDate(d)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">To Date</Label>
                    <DatePicker date={toDate} setDate={(d) => setToDate(d)} />
                  </div>
                </>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-violet-600 dark:text-violet-400">Vendor</Label>
                <Select value={vendorFilter} onValueChange={setVendorFilter}>
                  <SelectTrigger data-testid="select-vendor-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Vendors</SelectItem>
                    {uniqueVendors.map((v) => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-blue-600 dark:text-blue-400">Client</Label>
                <Select value={clientFilter} onValueChange={setClientFilter}>
                  <SelectTrigger data-testid="select-client-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clients</SelectItem>
                    {uniqueClients.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-amber-600 dark:text-amber-400">Group By</Label>
                <Select value={groupBy} onValueChange={(val) => setGroupBy(val as "vendor" | "client")}>
                  <SelectTrigger data-testid="select-group-by">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vendor">Vendor Wise</SelectItem>
                    <SelectItem value="client">Client Wise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="hidden print:block mb-4">
          <div className="text-center border-b pb-3 mb-4">
            <h1 className="text-xl font-bold">DJ Hospitality & Facility Management Pvt Ltd</h1>
            <h2 className="text-lg font-semibold mt-1">Vendor Payment Report</h2>
            <p className="text-sm text-gray-600 mt-1">
              {fromDate && toDate
                ? `${format(fromDate, "dd-MM-yyyy")} to ${format(toDate, "dd-MM-yyyy")}`
                : "All Dates"}
              {vendorFilter !== "all" && ` | Vendor: ${vendorFilter}`}
              {clientFilter !== "all" && ` | Client: ${clientFilter}`}
              {` | Grouped by: ${groupBy === "vendor" ? "Vendor" : "Client"}`}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between print:hidden">
          <p className="text-sm text-muted-foreground font-medium">
            <span className="inline-flex items-center gap-1.5 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 px-2.5 py-1 rounded-full text-xs font-semibold">
              <Receipt className="w-3 h-3" />
              {filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? "s" : ""} found
            </span>
          </p>
          <div className="flex gap-2">
            <Button onClick={handleExportExcel} variant="outline" size="sm" className="rounded-xl border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-400" data-testid="button-export-excel-vendor">
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Export Excel
            </Button>
            <Button onClick={handlePrint} variant="outline" size="sm" className="rounded-xl border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-400" data-testid="button-print-pdf">
              <FileDown className="w-4 h-4 mr-2" />
              Convert to PDF
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 print:grid-cols-4" data-testid="summary-cards">
          <Card className="relative overflow-hidden bg-gradient-to-br from-indigo-500 to-violet-600 text-white border-0 shadow-lg print:bg-white print:text-black print:border print:shadow-none">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] sm:text-xs font-medium text-white/80 print:text-gray-500">Total Bill Amount</p>
                  <p className="text-base sm:text-xl font-bold mt-1 print:text-black" data-testid="text-total-bill">₹{fmt(grandTotals.totalBillAmount)}</p>
                  <p className="text-[10px] text-white/60 mt-0.5">{grandTotals.invoiceCount} invoices</p>
                </div>
                <div className="p-2 bg-white/20 rounded-xl print:hidden">
                  <IndianRupee className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              </div>
              <div className="absolute -bottom-3 -right-3 w-16 h-16 bg-white/10 rounded-full print:hidden" />
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden bg-gradient-to-br from-emerald-500 to-green-600 text-white border-0 shadow-lg print:bg-white print:text-black print:border print:shadow-none">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] sm:text-xs font-medium text-white/80 print:text-gray-500">Payment Given</p>
                  <p className="text-base sm:text-xl font-bold mt-1 print:text-green-700" data-testid="text-total-paid">₹{fmt(grandTotals.totalPaid)}</p>
                  <p className="text-[10px] text-white/60 mt-0.5">{grandTotals.paidCount} paid</p>
                </div>
                <div className="p-2 bg-white/20 rounded-xl print:hidden">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              </div>
              <div className="absolute -bottom-3 -right-3 w-16 h-16 bg-white/10 rounded-full print:hidden" />
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden bg-gradient-to-br from-rose-500 to-red-600 text-white border-0 shadow-lg print:bg-white print:text-black print:border print:shadow-none">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] sm:text-xs font-medium text-white/80 print:text-gray-500">Balance to Pay</p>
                  <p className="text-base sm:text-xl font-bold mt-1 print:text-red-700" data-testid="text-total-balance">₹{fmt(grandTotals.totalBalance)}</p>
                  <p className="text-[10px] text-white/60 mt-0.5">{grandTotals.unpaidCount} unpaid</p>
                </div>
                <div className="p-2 bg-white/20 rounded-xl print:hidden">
                  <CreditCard className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              </div>
              <div className="absolute -bottom-3 -right-3 w-16 h-16 bg-white/10 rounded-full print:hidden" />
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden bg-gradient-to-br from-amber-500 to-orange-600 text-white border-0 shadow-lg print:bg-white print:text-black print:border print:shadow-none">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] sm:text-xs font-medium text-white/80 print:text-gray-500">GST Amount</p>
                  <p className="text-base sm:text-xl font-bold mt-1 print:text-black" data-testid="text-total-gst">₹{fmt(grandTotals.totalGst)}</p>
                  <p className="text-[10px] text-white/60 mt-0.5">Tax collected</p>
                </div>
                <div className="p-2 bg-white/20 rounded-xl print:hidden">
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              </div>
              <div className="absolute -bottom-3 -right-3 w-16 h-16 bg-white/10 rounded-full print:hidden" />
            </CardContent>
          </Card>
        </div>

        <Card className="border-0 shadow-lg overflow-hidden print:border print:shadow-none" data-testid="card-summary-table">
          <CardHeader className="bg-gradient-to-r from-violet-500 to-purple-600 text-white pb-3 pt-4 print:bg-gray-100 print:text-black">
            <CardTitle className="flex items-center gap-2 text-base">
              {groupBy === "vendor" ? <Store className="w-5 h-5 print:hidden" /> : <Building2 className="w-5 h-5 print:hidden" />}
              {groupBy === "vendor" ? "Vendor" : "Client"} Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="hidden md:block print:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-violet-50 dark:bg-violet-950/20 print:bg-gray-100">
                    <th className="text-left py-2.5 px-3 font-semibold text-violet-700 dark:text-violet-400 print:text-black">#</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-violet-700 dark:text-violet-400 print:text-black">{groupBy === "vendor" ? "Vendor Name" : "Client Name"}</th>
                    <th className="text-right py-2.5 px-3 font-semibold text-violet-700 dark:text-violet-400 print:text-black">Invoices</th>
                    <th className="text-right py-2.5 px-3 font-semibold text-violet-700 dark:text-violet-400 print:text-black">Bill Amount</th>
                    <th className="text-right py-2.5 px-3 font-semibold text-violet-700 dark:text-violet-400 print:text-black">GST</th>
                    <th className="text-right py-2.5 px-3 font-semibold text-violet-700 dark:text-violet-400 print:text-black">Grand Total</th>
                    <th className="text-right py-2.5 px-3 font-semibold text-violet-700 dark:text-violet-400 print:text-black">Paid</th>
                    <th className="text-right py-2.5 px-3 font-semibold text-violet-700 dark:text-violet-400 print:text-black">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryData.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-muted-foreground">No data found for the selected filters</td>
                    </tr>
                  ) : (
                    <>
                      {summaryData.map((row, i) => (
                        <tr key={i} className="border-b last:border-b-0 hover:bg-violet-50/50 dark:hover:bg-violet-950/10 print:hover:bg-transparent">
                          <td className="py-2.5 px-3">
                            <span className={`w-6 h-6 rounded-full bg-gradient-to-br ${ROW_COLORS[i % ROW_COLORS.length]} text-white text-[10px] inline-flex items-center justify-center font-bold print:bg-gray-200 print:text-black`}>{i + 1}</span>
                          </td>
                          <td className="py-2.5 px-3 font-semibold" data-testid={`text-primary-name-${i}`}>
                            {groupBy === "vendor" ? row.vendorName : row.clientName}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <span className="bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 px-2 py-0.5 rounded-full text-xs font-semibold print:bg-transparent print:text-black">{row.invoiceCount}</span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">₹{fmt(row.totalBillAmount)}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-amber-600 dark:text-amber-400">₹{fmt(row.totalGst)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">₹{fmt(row.grandTotal)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400 print:text-green-700">₹{fmt(row.totalPaid)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400 print:text-red-700">₹{fmt(row.totalBalance)}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-violet-200 dark:border-violet-800 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 print:bg-gray-100">
                        <td className="py-3 px-3 font-bold" colSpan={2}>
                          <span className="flex items-center gap-1.5 text-violet-700 dark:text-violet-400 print:text-black">
                            <Wallet className="w-4 h-4 print:hidden" /> Grand Total
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-violet-700 dark:text-violet-400">{grandTotals.invoiceCount}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold">₹{fmt(grandTotals.totalBillAmount)}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-amber-600">₹{fmt(grandTotals.totalGst)}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-indigo-700 dark:text-indigo-400">₹{fmt(grandTotals.grandTotal)}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600 print:text-green-700">₹{fmt(grandTotals.totalPaid)}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-rose-600 print:text-red-700">₹{fmt(grandTotals.totalBalance)}</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>

            <div className="md:hidden print:hidden space-y-3 p-3">
              {summaryData.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No data found for the selected filters</p>
              ) : (
                <>
                  {summaryData.map((row, i) => (
                    <Card key={i} className="border-0 shadow-md overflow-hidden">
                      <div className={`h-1.5 bg-gradient-to-r ${ROW_COLORS[i % ROW_COLORS.length]}`} />
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm flex items-center gap-2" data-testid={`text-mobile-name-${i}`}>
                            <span className={`w-6 h-6 rounded-full bg-gradient-to-br ${ROW_COLORS[i % ROW_COLORS.length]} text-white text-[10px] flex items-center justify-center font-bold shrink-0`}>{i + 1}</span>
                            {groupBy === "vendor" ? row.vendorName : row.clientName}
                          </span>
                          <span className="bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                            {row.invoiceCount} invoice{row.invoiceCount !== 1 ? "s" : ""}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                          <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-2 text-center">
                            <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">Grand Total</p>
                            <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300">₹{fmt(row.grandTotal)}</p>
                          </div>
                          <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-2 text-center">
                            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Paid</p>
                            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">₹{fmt(row.totalPaid)}</p>
                          </div>
                          <div className="bg-rose-50 dark:bg-rose-900/20 rounded-lg p-2 text-center">
                            <p className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold">Balance</p>
                            <p className="text-sm font-bold text-rose-700 dark:text-rose-300">₹{fmt(row.totalBalance)}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg overflow-hidden print:border print:shadow-none" data-testid="card-invoice-details">
          <CardHeader className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white pb-3 pt-4 print:bg-gray-100 print:text-black">
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="w-5 h-5 print:hidden" />
              Invoice Details
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="hidden md:block print:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-blue-50 dark:bg-blue-950/20 print:bg-gray-100">
                    <th className="text-left py-2 px-3 font-semibold text-blue-700 dark:text-blue-400 text-xs print:text-black">#</th>
                    <th className="text-left py-2 px-3 font-semibold text-blue-700 dark:text-blue-400 text-xs print:text-black">Date</th>
                    <th className="text-left py-2 px-3 font-semibold text-blue-700 dark:text-blue-400 text-xs print:text-black">Invoice No</th>
                    <th className="text-left py-2 px-3 font-semibold text-blue-700 dark:text-blue-400 text-xs print:text-black">Vendor</th>
                    <th className="text-left py-2 px-3 font-semibold text-blue-700 dark:text-blue-400 text-xs print:text-black">Client</th>
                    <th className="text-right py-2 px-3 font-semibold text-blue-700 dark:text-blue-400 text-xs print:text-black">Amount</th>
                    <th className="text-right py-2 px-3 font-semibold text-blue-700 dark:text-blue-400 text-xs print:text-black">GST</th>
                    <th className="text-right py-2 px-3 font-semibold text-blue-700 dark:text-blue-400 text-xs print:text-black">Grand Total</th>
                    <th className="text-center py-2 px-3 font-semibold text-blue-700 dark:text-blue-400 text-xs print:text-black">Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-6 text-muted-foreground text-xs">No invoices found</td>
                    </tr>
                  ) : (
                    filteredInvoices.map((inv: any, i: number) => (
                      <tr key={inv.id} className="border-b last:border-b-0 hover:bg-blue-50/50 dark:hover:bg-blue-950/10 print:hover:bg-transparent text-xs">
                        <td className="py-2 px-3">
                          <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-cyan-500 text-white text-[9px] inline-flex items-center justify-center font-bold print:bg-gray-200 print:text-black">{i + 1}</span>
                        </td>
                        <td className="py-2 px-3 font-medium">{format(new Date(inv.date), "dd-MM-yyyy")}</td>
                        <td className="py-2 px-3 font-mono text-muted-foreground">{inv.vendorInvoiceNo || `PI-${inv.serialNumber}`}</td>
                        <td className="py-2 px-3 font-medium">{inv.vendorName}</td>
                        <td className="py-2 px-3 text-muted-foreground">{inv.clientName}</td>
                        <td className="py-2 px-3 text-right font-mono">₹{fmt(Number(inv.totalAmount) || 0)}</td>
                        <td className="py-2 px-3 text-right font-mono text-amber-600">₹{fmt(Number(inv.totalGst) || 0)}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-indigo-600">₹{fmt(Number(inv.grandTotal) || 0)}</td>
                        <td className="py-2 px-3 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold shadow-sm ${inv.paymentGiven ? "bg-gradient-to-r from-emerald-400 to-green-500 text-white print:bg-green-100 print:text-green-700 print:border print:border-green-600" : "bg-gradient-to-r from-rose-400 to-red-500 text-white print:bg-red-100 print:text-red-700 print:border print:border-red-600"}`}>
                            {inv.paymentGiven ? "Paid" : "Unpaid"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="md:hidden print:hidden space-y-2 p-3">
              {filteredInvoices.length === 0 ? (
                <p className="text-center py-6 text-muted-foreground text-xs">No invoices found</p>
              ) : (
                filteredInvoices.map((inv: any, i: number) => (
                  <div key={inv.id} className="border-0 shadow-sm rounded-xl p-3 text-xs space-y-1.5 bg-gradient-to-r from-blue-50/50 to-cyan-50/50 dark:from-blue-950/10 dark:to-cyan-950/10">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-cyan-500 text-white text-[9px] flex items-center justify-center font-bold shrink-0">{i + 1}</span>
                        {inv.vendorName}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold shadow-sm ${inv.paymentGiven ? "bg-gradient-to-r from-emerald-400 to-green-500 text-white" : "bg-gradient-to-r from-rose-400 to-red-500 text-white"}`}>
                        {inv.paymentGiven ? "Paid" : "Unpaid"}
                      </span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>{format(new Date(inv.date), "dd-MM-yyyy")}</span>
                      <span className="font-mono">{inv.vendorInvoiceNo || `PI-${inv.serialNumber}`}</span>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-blue-100 dark:border-blue-800/30">
                      <span className="text-muted-foreground">{inv.clientName}</span>
                      <span className="font-bold text-sm text-indigo-600 dark:text-indigo-400">₹{fmt(Number(inv.grandTotal) || 0)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <div className="print:hidden">
          <Card className="border-0 shadow-xl overflow-hidden" data-testid="card-bottom-summary">
            <CardContent className="p-0">
              <div className="grid grid-cols-2 md:grid-cols-4">
                <div className="p-3 sm:p-4 bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
                  <p className="text-[10px] sm:text-xs uppercase tracking-wider font-semibold text-white/80 flex items-center gap-1">
                    <IndianRupee className="w-3 h-3" /> Total Bill
                  </p>
                  <p className="text-base sm:text-xl font-bold font-mono">₹{fmt(grandTotals.grandTotal)}</p>
                </div>
                <div className="p-3 sm:p-4 bg-gradient-to-br from-emerald-500 to-green-600 text-white">
                  <p className="text-[10px] sm:text-xs uppercase tracking-wider font-semibold text-white/80 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> Total Paid
                  </p>
                  <p className="text-base sm:text-xl font-bold font-mono">₹{fmt(grandTotals.totalPaid)}</p>
                </div>
                <div className="p-3 sm:p-4 bg-gradient-to-br from-rose-500 to-red-600 text-white">
                  <p className="text-[10px] sm:text-xs uppercase tracking-wider font-semibold text-white/80 flex items-center gap-1">
                    <TrendingDown className="w-3 h-3" /> Balance Due
                  </p>
                  <p className="text-base sm:text-xl font-bold font-mono">₹{fmt(grandTotals.totalBalance)}</p>
                </div>
                <div className="p-3 sm:p-4 bg-gradient-to-br from-amber-500 to-orange-600 text-white">
                  <p className="text-[10px] sm:text-xs uppercase tracking-wider font-semibold text-white/80 flex items-center gap-1">
                    <Receipt className="w-3 h-3" /> Invoices
                  </p>
                  <p className="text-base sm:text-xl font-bold font-mono">{grandTotals.paidCount} <span className="text-xs font-normal">paid</span> / {grandTotals.unpaidCount} <span className="text-xs font-normal">unpaid</span></p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <p className="text-center text-[10px] text-muted-foreground print:text-gray-400 pb-4">
          Generated on {format(new Date(), "dd-MM-yyyy hh:mm a")}
        </p>
      </div>
    </Layout>
  );
}
