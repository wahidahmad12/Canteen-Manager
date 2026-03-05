import { useState, useMemo } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { usePurchaseInvoices, useVendors, useClientNames } from "@/hooks/use-reports";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear } from "date-fns";
import { Loader2, FileDown, ArrowLeft, BarChart3, Filter } from "lucide-react";
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

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center gap-3 print:hidden">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <BarChart3 className="w-6 h-6 text-primary" />
          <h1 className="text-xl sm:text-2xl font-bold">Vendor Payment Report</h1>
        </div>

        <Card className="print:hidden">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="w-4 h-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Date Range</Label>
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
                    <Label className="text-xs">From Date</Label>
                    <DatePicker date={fromDate} setDate={(d) => setFromDate(d)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">To Date</Label>
                    <DatePicker date={toDate} setDate={(d) => setToDate(d)} />
                  </div>
                </>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs">Vendor</Label>
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
                <Label className="text-xs">Client</Label>
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
                <Label className="text-xs">Group By</Label>
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
                ? `${format(fromDate, "dd/MM/yyyy")} to ${format(toDate, "dd/MM/yyyy")}`
                : "All Dates"}
              {vendorFilter !== "all" && ` | Vendor: ${vendorFilter}`}
              {clientFilter !== "all" && ` | Client: ${clientFilter}`}
              {` | Grouped by: ${groupBy === "vendor" ? "Vendor" : "Client"}`}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between print:hidden">
          <p className="text-sm text-muted-foreground">
            {filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? "s" : ""} found
          </p>
          <Button onClick={handlePrint} variant="outline" size="sm" data-testid="button-print-pdf">
            <FileDown className="w-4 h-4 mr-2" />
            Convert to PDF
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:grid-cols-4">
          <Card className="print:border print:shadow-none">
            <CardContent className="p-3 sm:p-4">
              <p className="text-xs text-muted-foreground print:text-gray-500">Total Bill Amount</p>
              <p className="text-lg sm:text-xl font-bold mt-1 print:text-black" data-testid="text-total-bill">₹{fmt(grandTotals.totalBillAmount)}</p>
            </CardContent>
          </Card>
          <Card className="print:border print:shadow-none">
            <CardContent className="p-3 sm:p-4">
              <p className="text-xs text-muted-foreground print:text-gray-500">Payment Given</p>
              <p className="text-lg sm:text-xl font-bold mt-1 text-green-600 print:text-green-700" data-testid="text-total-paid">₹{fmt(grandTotals.totalPaid)}</p>
            </CardContent>
          </Card>
          <Card className="print:border print:shadow-none">
            <CardContent className="p-3 sm:p-4">
              <p className="text-xs text-muted-foreground print:text-gray-500">Balance to Pay</p>
              <p className="text-lg sm:text-xl font-bold mt-1 text-red-600 print:text-red-700" data-testid="text-total-balance">₹{fmt(grandTotals.totalBalance)}</p>
            </CardContent>
          </Card>
          <Card className="print:border print:shadow-none">
            <CardContent className="p-3 sm:p-4">
              <p className="text-xs text-muted-foreground print:text-gray-500">Invoices</p>
              <p className="text-lg sm:text-xl font-bold mt-1 print:text-black" data-testid="text-invoice-count">
                {grandTotals.invoiceCount}
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  ({grandTotals.paidCount} paid, {grandTotals.unpaidCount} unpaid)
                </span>
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="print:border print:shadow-none">
          <CardContent className="p-0">
            <div className="hidden md:block print:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 print:bg-gray-100">
                    <th className="text-left py-2.5 px-3 font-medium">#</th>
                    <th className="text-left py-2.5 px-3 font-medium">{groupBy === "vendor" ? "Vendor Name" : "Client Name"}</th>
                    <th className="text-right py-2.5 px-3 font-medium">Invoices</th>
                    <th className="text-right py-2.5 px-3 font-medium">Bill Amount</th>
                    <th className="text-right py-2.5 px-3 font-medium">GST</th>
                    <th className="text-right py-2.5 px-3 font-medium">Grand Total</th>
                    <th className="text-right py-2.5 px-3 font-medium">Paid</th>
                    <th className="text-right py-2.5 px-3 font-medium">Balance</th>
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
                        <tr key={i} className="border-b last:border-b-0 hover:bg-muted/30 print:hover:bg-transparent">
                          <td className="py-2 px-3 text-muted-foreground">{i + 1}</td>
                          <td className="py-2 px-3 font-medium" data-testid={`text-primary-name-${i}`}>
                            {groupBy === "vendor" ? row.vendorName : row.clientName}
                          </td>
                          <td className="py-2 px-3 text-right">{row.invoiceCount}</td>
                          <td className="py-2 px-3 text-right">₹{fmt(row.totalBillAmount)}</td>
                          <td className="py-2 px-3 text-right">₹{fmt(row.totalGst)}</td>
                          <td className="py-2 px-3 text-right font-medium">₹{fmt(row.grandTotal)}</td>
                          <td className="py-2 px-3 text-right text-green-600 print:text-green-700">₹{fmt(row.totalPaid)}</td>
                          <td className="py-2 px-3 text-right text-red-600 print:text-red-700 font-medium">₹{fmt(row.totalBalance)}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 bg-muted/50 print:bg-gray-100 font-bold">
                        <td className="py-2.5 px-3" colSpan={2}>Total</td>
                        <td className="py-2.5 px-3 text-right">{grandTotals.invoiceCount}</td>
                        <td className="py-2.5 px-3 text-right">₹{fmt(grandTotals.totalBillAmount)}</td>
                        <td className="py-2.5 px-3 text-right">₹{fmt(grandTotals.totalGst)}</td>
                        <td className="py-2.5 px-3 text-right">₹{fmt(grandTotals.grandTotal)}</td>
                        <td className="py-2.5 px-3 text-right text-green-600 print:text-green-700">₹{fmt(grandTotals.totalPaid)}</td>
                        <td className="py-2.5 px-3 text-right text-red-600 print:text-red-700">₹{fmt(grandTotals.totalBalance)}</td>
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
                    <Card key={i} className="border">
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm" data-testid={`text-mobile-name-${i}`}>
                            {groupBy === "vendor" ? row.vendorName : row.clientName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {row.invoiceCount} invoice{row.invoiceCount !== 1 ? "s" : ""}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2 pt-1 border-t">
                          <div>
                            <p className="text-[10px] text-muted-foreground">Grand Total</p>
                            <p className="text-sm font-bold">₹{fmt(row.grandTotal)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">Paid</p>
                            <p className="text-sm font-bold text-green-600">₹{fmt(row.totalPaid)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">Balance</p>
                            <p className="text-sm font-bold text-red-600">₹{fmt(row.totalBalance)}</p>
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

        <Card className="print:border print:shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Invoice Details</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="hidden md:block print:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 print:bg-gray-100">
                    <th className="text-left py-2 px-3 font-medium text-xs">#</th>
                    <th className="text-left py-2 px-3 font-medium text-xs">Date</th>
                    <th className="text-left py-2 px-3 font-medium text-xs">Invoice No</th>
                    <th className="text-left py-2 px-3 font-medium text-xs">Vendor</th>
                    <th className="text-left py-2 px-3 font-medium text-xs">Client</th>
                    <th className="text-right py-2 px-3 font-medium text-xs">Amount</th>
                    <th className="text-right py-2 px-3 font-medium text-xs">GST</th>
                    <th className="text-right py-2 px-3 font-medium text-xs">Grand Total</th>
                    <th className="text-center py-2 px-3 font-medium text-xs">Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-6 text-muted-foreground text-xs">No invoices found</td>
                    </tr>
                  ) : (
                    filteredInvoices.map((inv: any, i: number) => (
                      <tr key={inv.id} className="border-b last:border-b-0 hover:bg-muted/30 print:hover:bg-transparent text-xs">
                        <td className="py-1.5 px-3 text-muted-foreground">{i + 1}</td>
                        <td className="py-1.5 px-3">{format(new Date(inv.date), "dd/MM/yyyy")}</td>
                        <td className="py-1.5 px-3">{inv.vendorInvoiceNo || `PI-${inv.serialNumber}`}</td>
                        <td className="py-1.5 px-3">{inv.vendorName}</td>
                        <td className="py-1.5 px-3">{inv.clientName}</td>
                        <td className="py-1.5 px-3 text-right">₹{fmt(Number(inv.totalAmount) || 0)}</td>
                        <td className="py-1.5 px-3 text-right">₹{fmt(Number(inv.totalGst) || 0)}</td>
                        <td className="py-1.5 px-3 text-right font-medium">₹{fmt(Number(inv.grandTotal) || 0)}</td>
                        <td className="py-1.5 px-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${inv.paymentGiven ? "bg-green-100 text-green-700 print:border print:border-green-600" : "bg-red-100 text-red-700 print:border print:border-red-600"}`}>
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
                  <div key={inv.id} className="border rounded-lg p-2.5 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{inv.vendorName}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${inv.paymentGiven ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {inv.paymentGiven ? "Paid" : "Unpaid"}
                      </span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>{format(new Date(inv.date), "dd/MM/yyyy")}</span>
                      <span>{inv.vendorInvoiceNo || `PI-${inv.serialNumber}`}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Client: {inv.clientName}</span>
                      <span className="font-bold">₹{fmt(Number(inv.grandTotal) || 0)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-[10px] text-muted-foreground print:text-gray-400 pb-4">
          Generated on {format(new Date(), "dd/MM/yyyy hh:mm a")}
        </p>
      </div>
    </Layout>
  );
}
