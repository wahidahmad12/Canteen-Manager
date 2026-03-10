import { useState, useMemo } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useClientNames } from "@/hooks/use-reports";
import { Link } from "wouter";
import {
  BarChart3, TrendingUp, TrendingDown, IndianRupee, Building2, CalendarDays,
  ArrowLeft, FileText, CheckCircle2, XCircle, Loader2, PieChart, Receipt
} from "lucide-react";

interface SalesInvoice {
  id: number;
  slNo: number;
  clientName: string;
  billDate: string;
  billNumber: string;
  billAmount: string;
  gstPercent: string;
  gstAmount: string;
  totalBillAmount: string;
  tdsPercent: string;
  tdsAmount: string;
  paymentReceivedDate: string | null;
  paymentReceivedAmount: string;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function fmtCurrency(v: number) {
  return "₹" + v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function BarChartSimple({ data, label, color }: { data: { name: string; value: number }[]; label: string; color: string }) {
  const maxVal = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{label}</p>
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-[10px] w-8 text-right text-muted-foreground font-medium shrink-0">{d.name}</span>
          <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-5 overflow-hidden">
            <div
              className={`h-full rounded-full ${color} transition-all duration-700 ease-out flex items-center justify-end pr-2`}
              style={{ width: `${Math.max((d.value / maxVal) * 100, d.value > 0 ? 8 : 0)}%` }}
            >
              {d.value > 0 && <span className="text-[9px] text-white font-bold whitespace-nowrap">{fmtCurrency(d.value)}</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ paid, pending }: { paid: number; pending: number }) {
  const total = paid + pending;
  const paidPct = total > 0 ? (paid / total) * 100 : 0;
  const pendingPct = total > 0 ? (pending / total) * 100 : 0;
  const paidDeg = (paidPct / 100) * 360;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-32 h-32">
        <div
          className="w-full h-full rounded-full"
          style={{
            background: total > 0
              ? `conic-gradient(#10b981 0deg ${paidDeg}deg, #f59e0b ${paidDeg}deg 360deg)`
              : '#e5e7eb',
          }}
        />
        <div className="absolute inset-3 bg-white dark:bg-gray-950 rounded-full flex flex-col items-center justify-center">
          <span className="text-[10px] text-muted-foreground">Total</span>
          <span className="text-xs font-bold">{fmtCurrency(total)}</span>
        </div>
      </div>
      <div className="flex gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
          <span>Paid ({Math.round(paidPct)}%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span>Pending ({Math.round(pendingPct)}%)</span>
        </div>
      </div>
    </div>
  );
}

export default function SalesDashboard() {
  const { data: clients = [] } = useClientNames();
  const { data: invoices = [], isLoading } = useQuery<SalesInvoice[]>({
    queryKey: ["/api/sales-invoices"],
  });

  const [filterClient, setFilterClient] = useState("all");
  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()));

  const years = useMemo(() => {
    const yrs = Array.from(new Set(invoices.map(i => {
      try { return new Date(i.billDate).getFullYear(); } catch { return new Date().getFullYear(); }
    }))).sort((a, b) => b - a);
    if (!yrs.includes(new Date().getFullYear())) yrs.unshift(new Date().getFullYear());
    return yrs;
  }, [invoices]);

  const filtered = useMemo(() => {
    return invoices.filter(inv => {
      if (filterClient !== "all" && inv.clientName !== filterClient) return false;
      if (filterYear !== "all") {
        try {
          if (new Date(inv.billDate).getFullYear() !== Number(filterYear)) return false;
        } catch { return false; }
      }
      return true;
    });
  }, [invoices, filterClient, filterYear]);

  const totalBilled = filtered.reduce((s, i) => s + Number(i.totalBillAmount), 0);
  const totalReceived = filtered.reduce((s, i) => s + Number(i.paymentReceivedAmount), 0);
  const totalGst = filtered.reduce((s, i) => s + Number(i.gstAmount), 0);
  const totalTds = filtered.reduce((s, i) => s + Number(i.tdsAmount), 0);
  const totalOutstanding = totalBilled - totalReceived;
  const paidCount = filtered.filter(i => Number(i.paymentReceivedAmount) >= Number(i.totalBillAmount) && Number(i.totalBillAmount) > 0).length;
  const pendingCount = filtered.length - paidCount;

  const monthlyData = useMemo(() => {
    const data = MONTHS.map((m, i) => ({ name: m, billed: 0, received: 0 }));
    filtered.forEach(inv => {
      try {
        const month = new Date(inv.billDate).getMonth();
        data[month].billed += Number(inv.totalBillAmount);
        data[month].received += Number(inv.paymentReceivedAmount);
      } catch {}
    });
    return data;
  }, [filtered]);

  const clientData = useMemo(() => {
    const map: Record<string, { billed: number; received: number; count: number }> = {};
    filtered.forEach(inv => {
      if (!map[inv.clientName]) map[inv.clientName] = { billed: 0, received: 0, count: 0 };
      map[inv.clientName].billed += Number(inv.totalBillAmount);
      map[inv.clientName].received += Number(inv.paymentReceivedAmount);
      map[inv.clientName].count += 1;
    });
    return Object.entries(map).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.billed - a.billed);
  }, [filtered]);

  const topPending = useMemo(() => {
    return filtered
      .filter(i => Number(i.paymentReceivedAmount) < Number(i.totalBillAmount))
      .sort((a, b) => (Number(b.totalBillAmount) - Number(b.paymentReceivedAmount)) - (Number(a.totalBillAmount) - Number(a.paymentReceivedAmount)))
      .slice(0, 5);
  }, [filtered]);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-violet-500" /></div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-2 sm:px-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-violet-200 dark:shadow-violet-900/30">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold" data-testid="text-sales-dashboard-title">Sales Dashboard</h2>
              <p className="text-xs sm:text-sm text-muted-foreground">Analytics & insights for your sales invoices</p>
            </div>
          </div>
          <Link href="/sales-invoice">
            <Button variant="outline" className="border-violet-300 text-violet-700" data-testid="button-back-to-ledger">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Ledger
            </Button>
          </Link>
        </div>

        <Card className="border-0 shadow-md mb-5" data-testid="card-dashboard-filters">
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mb-1">
                  <Building2 className="w-3 h-3" /> Client
                </Label>
                <Select value={filterClient} onValueChange={setFilterClient}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clients</SelectItem>
                    {clients.map((c: any) => (
                      <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full sm:w-32">
                <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mb-1">
                  <CalendarDays className="w-3 h-3" /> Year
                </Label>
                <Select value={filterYear} onValueChange={setFilterYear}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Years</SelectItem>
                    {years.map(y => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
          <Card className="border-0 shadow-md bg-gradient-to-br from-blue-500 to-indigo-600 text-white" data-testid="card-stat-invoices">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1"><FileText className="w-3.5 h-3.5 opacity-80" /><span className="text-[10px] opacity-80">Invoices</span></div>
              <p className="text-xl font-bold">{filtered.length}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md bg-gradient-to-br from-violet-500 to-purple-600 text-white" data-testid="card-stat-billed">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1"><IndianRupee className="w-3.5 h-3.5 opacity-80" /><span className="text-[10px] opacity-80">Billed</span></div>
              <p className="text-sm sm:text-lg font-bold">{fmtCurrency(totalBilled)}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md bg-gradient-to-br from-emerald-500 to-teal-600 text-white" data-testid="card-stat-received">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1"><TrendingUp className="w-3.5 h-3.5 opacity-80" /><span className="text-[10px] opacity-80">Received</span></div>
              <p className="text-sm sm:text-lg font-bold">{fmtCurrency(totalReceived)}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md bg-gradient-to-br from-orange-500 to-red-500 text-white" data-testid="card-stat-outstanding">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1"><TrendingDown className="w-3.5 h-3.5 opacity-80" /><span className="text-[10px] opacity-80">Outstanding</span></div>
              <p className="text-sm sm:text-lg font-bold">{fmtCurrency(totalOutstanding)}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md bg-gradient-to-br from-amber-500 to-orange-500 text-white" data-testid="card-stat-gst">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1"><Receipt className="w-3.5 h-3.5 opacity-80" /><span className="text-[10px] opacity-80">Total GST</span></div>
              <p className="text-sm sm:text-lg font-bold">{fmtCurrency(totalGst)}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md bg-gradient-to-br from-red-500 to-pink-600 text-white" data-testid="card-stat-tds">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1"><IndianRupee className="w-3.5 h-3.5 opacity-80" /><span className="text-[10px] opacity-80">Total TDS</span></div>
              <p className="text-sm sm:text-lg font-bold">{fmtCurrency(totalTds)}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
          <Card className="border-0 shadow-lg lg:col-span-2" data-testid="card-monthly-chart">
            <CardHeader className="bg-gradient-to-r from-violet-500 to-purple-600 text-white pb-3 pt-4">
              <CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Monthly Billing</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <BarChartSimple
                data={monthlyData.map(d => ({ name: d.name, value: d.billed }))}
                label="Billed Amount by Month"
                color="bg-gradient-to-r from-violet-500 to-purple-500"
              />
              <div className="mt-4 pt-3 border-t">
                <BarChartSimple
                  data={monthlyData.map(d => ({ name: d.name, value: d.received }))}
                  label="Received Amount by Month"
                  color="bg-gradient-to-r from-emerald-500 to-teal-500"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg" data-testid="card-payment-status">
            <CardHeader className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white pb-3 pt-4">
              <CardTitle className="text-sm flex items-center gap-2"><PieChart className="w-4 h-4" /> Payment Status</CardTitle>
            </CardHeader>
            <CardContent className="p-4 flex flex-col items-center">
              <DonutChart paid={totalReceived} pending={totalOutstanding} />
              <div className="grid grid-cols-2 gap-3 w-full mt-4">
                <div className="bg-green-50 dark:bg-green-950/20 rounded-xl p-3 text-center">
                  <CheckCircle2 className="w-5 h-5 text-green-500 mx-auto mb-1" />
                  <p className="text-xl font-bold text-green-700 dark:text-green-400">{paidCount}</p>
                  <p className="text-[10px] text-green-600 dark:text-green-400">Paid</p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl p-3 text-center">
                  <XCircle className="w-5 h-5 text-amber-500 mx-auto mb-1" />
                  <p className="text-xl font-bold text-amber-700 dark:text-amber-400">{pendingCount}</p>
                  <p className="text-[10px] text-amber-600 dark:text-amber-400">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card className="border-0 shadow-lg" data-testid="card-client-breakdown">
            <CardHeader className="bg-gradient-to-r from-indigo-500 to-blue-500 text-white pb-3 pt-4">
              <CardTitle className="text-sm flex items-center gap-2"><Building2 className="w-4 h-4" /> Client-wise Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {clientData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No data</p>
              ) : (
                <div className="space-y-3">
                  {clientData.map((c, i) => {
                    const pct = c.billed > 0 ? Math.round((c.received / c.billed) * 100) : 0;
                    return (
                      <div key={i} className="border border-gray-100 dark:border-gray-800 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs font-bold">{i + 1}</span>
                            <span className="text-sm font-semibold">{c.name}</span>
                          </div>
                          <Badge variant="secondary" className="text-[10px]">{c.count} inv</Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <p className="text-[10px] text-muted-foreground">Billed</p>
                            <p className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{fmtCurrency(c.billed)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">Received</p>
                            <p className="font-mono font-bold text-green-600 dark:text-green-400">{fmtCurrency(c.received)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">Outstanding</p>
                            <p className="font-mono font-bold text-orange-600 dark:text-orange-400">{fmtCurrency(c.billed - c.received)}</p>
                          </div>
                        </div>
                        <div className="mt-2 bg-gray-100 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-400 to-green-500 rounded-full transition-all duration-700"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-right text-muted-foreground mt-0.5">{pct}% collected</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg" data-testid="card-top-pending">
            <CardHeader className="bg-gradient-to-r from-orange-500 to-red-500 text-white pb-3 pt-4">
              <CardTitle className="text-sm flex items-center gap-2"><XCircle className="w-4 h-4" /> Top Pending Payments</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {topPending.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">All payments received!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {topPending.map((inv, i) => {
                    const outstanding = Number(inv.totalBillAmount) - Number(inv.paymentReceivedAmount);
                    return (
                      <div key={inv.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-orange-100 dark:border-orange-900 bg-orange-50/50 dark:bg-orange-950/10">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-orange-200 dark:bg-orange-800 text-orange-700 dark:text-orange-300 text-xs font-bold shrink-0">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate">{inv.clientName}</p>
                          <p className="text-[10px] text-muted-foreground">{inv.billNumber} • {inv.billDate ? new Date(inv.billDate).toLocaleDateString("en-IN") : ""}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-bold text-orange-600 dark:text-orange-400 font-mono">{fmtCurrency(outstanding)}</p>
                          <p className="text-[10px] text-muted-foreground">of {fmtCurrency(Number(inv.totalBillAmount))}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
