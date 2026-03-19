import { Link } from "wouter";
import { useMemo } from "react";
import { Plus, Loader2, FileText, ArrowRight, Calculator, ClipboardList, UtensilsCrossed, ShoppingCart, Trash2, Check, CheckCircle2, FileDown, Pencil, Receipt, BarChart3, IndianRupee, TrendingUp, TrendingDown, Wallet, CreditCard, DollarSign, Store, FileSpreadsheet } from "lucide-react";
import { useReports, useDeleteReport, useInventories, useCashSeals, useSavedMenus, useDeleteSavedMenu, usePurchaseRequests, useDeletePurchaseRequest, useUpdatePurchaseRequest, useCurrentUser, usePurchaseInvoices, useDeletePurchaseInvoice } from "@/hooks/use-reports";
import { format } from "date-fns";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts";

const CHART_COLORS = ["#6366f1", "#f43f5e", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4", "#ec4899", "#14b8a6"];

function SummaryCard({ title, value, icon: Icon, color, subtitle }: { title: string; value: string; icon: any; color: string; subtitle?: string }) {
  const colorMap: Record<string, string> = {
    blue: "from-blue-500 to-blue-600 shadow-blue-500/25",
    green: "from-emerald-500 to-emerald-600 shadow-emerald-500/25",
    red: "from-rose-500 to-rose-600 shadow-rose-500/25",
    orange: "from-orange-500 to-orange-600 shadow-orange-500/25",
    purple: "from-violet-500 to-violet-600 shadow-violet-500/25",
    indigo: "from-indigo-500 to-indigo-600 shadow-indigo-500/25",
    amber: "from-amber-500 to-amber-600 shadow-amber-500/25",
    cyan: "from-cyan-500 to-cyan-600 shadow-cyan-500/25",
    teal: "from-teal-500 to-teal-600 shadow-teal-500/25",
  };
  return (
    <Card className={`relative overflow-hidden bg-gradient-to-br ${colorMap[color] || colorMap.blue} text-white border-0 shadow-lg`} data-testid={`card-summary-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-[10px] sm:text-xs font-semibold text-white/80 uppercase tracking-wider">{title}</p>
            <p className="text-xl sm:text-2xl font-bold tracking-tight font-mono">{value}</p>
            {subtitle && <p className="text-[10px] sm:text-xs text-white/60">{subtitle}</p>}
          </div>
          <div className="p-2 sm:p-2.5 bg-white/20 rounded-xl backdrop-blur-sm">
            <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>
        <div className="absolute -bottom-4 -right-4 w-20 h-20 sm:w-24 sm:h-24 bg-white/10 rounded-full" />
      </CardContent>
    </Card>
  );
}

const fmt = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default function Dashboard() {
  const { data: user } = useCurrentUser();
  const perms = user?.role === 'admin' ? ['expense', 'cashseal', 'inventory', 'menu', 'purchase'] : (user?.permissions || []);

  const hasExpense = perms.includes('expense');
  const hasCashSeal = perms.includes('cashseal');
  const hasInventory = perms.includes('inventory');
  const hasMenu = perms.includes('menu');
  const hasPurchase = perms.includes('purchase');

  const { data: reports, isLoading } = useReports({ enabled: hasExpense });
  const { data: inventories, isLoading: invLoading } = useInventories({ enabled: hasInventory });
  const { data: cashSeals, isLoading: csLoading } = useCashSeals({ enabled: hasCashSeal });
  const { data: savedMenus, isLoading: menusLoading } = useSavedMenus({ enabled: hasMenu });
  const { data: purchaseRequests, isLoading: prLoading } = usePurchaseRequests({ enabled: hasPurchase });
  const { data: purchaseInvoices, isLoading: piLoading } = usePurchaseInvoices({ enabled: hasPurchase });
  const isAdmin = user?.role === 'admin';
  const deleteMutation = useDeleteReport();
  const deleteMenuMutation = useDeleteSavedMenu();
  const deletePurchaseMutation = useDeletePurchaseRequest();
  const updatePurchaseMutation = useUpdatePurchaseRequest();
  const deleteInvoiceMutation = useDeletePurchaseInvoice();

  const tabItems = [
    { value: 'reports', label: 'Reports', icon: FileText, perm: 'expense' },
    { value: 'cashseal', label: 'Daily Cash Seal', icon: Calculator, perm: 'cashseal' },
    { value: 'inventory', label: 'Inventory', icon: ClipboardList, perm: 'inventory' },
    { value: 'menus', label: 'Menus', icon: UtensilsCrossed, perm: 'menu' },
    { value: 'purchase', label: 'Purchase', icon: ShoppingCart, perm: 'purchase' },
    { value: 'invoices', label: 'Invoices', icon: Receipt, perm: 'purchase' },
  ].filter(item => perms.includes(item.perm));

  const defaultTab = tabItems.length > 0 ? tabItems[0].value : 'reports';

  const anyLoading = (hasExpense && isLoading) || (hasInventory && invLoading) || (hasCashSeal && csLoading) || (hasMenu && menusLoading) || (hasPurchase && prLoading) || (hasPurchase && piLoading);

  const expenseStats = useMemo(() => {
    if (!reports || reports.length === 0) return { totalCash: 0, totalExpense: 0, totalReceived: 0, totalOpening: 0, chartData: [] };
    let totalCash = 0, totalExpense = 0, totalReceived = 0, totalOpening = 0;
    const chartData = [...reports].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(-10).map((r: any) => {
      const opening = Number(r.openingBalance) || 0;
      const received = Number(r.receivedAmount) || 0;
      const wahid = Number(r.giveByWahid) || 0;
      const expense = r.items?.reduce((sum: number, item: any) => sum + (Number(item.amount) || 0), 0) || 0;
      totalCash += opening + received + wahid;
      totalExpense += expense;
      totalReceived += received + wahid;
      totalOpening += opening;
      return {
        date: format(new Date(r.date), "dd-MM"),
        cash: opening + received + wahid,
        expense,
        balance: (opening + received + wahid) - expense,
      };
    });
    return { totalCash, totalExpense, totalReceived, totalOpening, chartData };
  }, [reports]);

  const invoiceStats = useMemo(() => {
    if (!purchaseInvoices || purchaseInvoices.length === 0) return { totalAmount: 0, totalPaid: 0, totalUnpaid: 0, paidCount: 0, unpaidCount: 0, vendorData: [], paymentPieData: [] };
    let totalAmount = 0, totalPaid = 0, totalUnpaid = 0, paidCount = 0, unpaidCount = 0;
    const vendorMap = new Map<string, number>();
    purchaseInvoices.forEach((inv: any) => {
      const grand = Number(inv.grandTotal) || 0;
      totalAmount += grand;
      if (inv.paymentGiven) { totalPaid += grand; paidCount++; }
      else { totalUnpaid += grand; unpaidCount++; }
      vendorMap.set(inv.vendorName, (vendorMap.get(inv.vendorName) || 0) + grand);
    });
    const vendorData = Array.from(vendorMap.entries()).map(([name, amount]) => ({ name: name.length > 12 ? name.slice(0, 12) + '...' : name, amount })).sort((a, b) => b.amount - a.amount).slice(0, 8);
    const paymentPieData = [
      { name: "Paid", value: totalPaid },
      { name: "Unpaid", value: totalUnpaid },
    ].filter(d => d.value > 0);
    return { totalAmount, totalPaid, totalUnpaid, paidCount, unpaidCount, vendorData, paymentPieData };
  }, [purchaseInvoices]);

  const purchaseStats = useMemo(() => {
    if (!purchaseRequests) return { pending: 0, approved: 0, rejected: 0 };
    let pending = 0, approved = 0, rejected = 0;
    purchaseRequests.forEach((pr: any) => {
      if (pr.status === 'pending') pending++;
      else if (pr.status === 'approved') approved++;
      else rejected++;
    });
    return { pending, approved, rejected };
  }, [purchaseRequests]);

  if (anyLoading) {
    return (
      <Layout>
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      </Layout>
    );
  }

  const sortedReports = reports ? [...reports].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  ) : [];

  const sortedInventories = inventories ? [...inventories].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  ) : [];

  const handleExportReportsExcel = async () => {
    if (!sortedReports.length) return;
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet("Expense Reports");

    const titleRow = ws.addRow(["Daily Cash Expense Reports"]);
    titleRow.getCell(1).font = { bold: true, size: 16 };
    ws.mergeCells("A1:H1");
    titleRow.alignment = { horizontal: "center" };
    ws.addRow([]);

    const headerRow = ws.addRow(["Report No.", "Date", "Opening Balance", "Received Amount", "Total Cash", "Total Expense", "Balance", "Item Count"]);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF6366F1" } };
      cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
      cell.alignment = { horizontal: "center" };
    });

    sortedReports.forEach((report: any) => {
      const opening = Number(report.openingBalance) || 0;
      const received = Number(report.receivedAmount) || 0;
      const totalCash = opening + received;
      const totalExpense = report.items?.reduce((sum: number, item: any) => sum + (Number(item.amount) || 0), 0) || 0;
      const r = ws.addRow([
        report.reportNumber, format(new Date(report.date), "dd-MM-yyyy"),
        opening, received, totalCash, totalExpense, totalCash - totalExpense,
        report.items?.length || 0
      ]);
      r.eachCell((cell) => {
        cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
        cell.font = { size: 10 };
      });
    });

    ws.addRow([]);
    ws.addRow([]);

    sortedReports.forEach((report: any) => {
      if (!report.items || report.items.length === 0) return;
      const rHeader = ws.addRow([`Report #${report.reportNumber} - ${format(new Date(report.date), "dd-MM-yyyy")}`]);
      rHeader.getCell(1).font = { bold: true, size: 11 };
      ws.mergeCells(`A${rHeader.number}:G${rHeader.number}`);

      const itemHeader = ws.addRow(["", "Category", "Description", "UOM", "Qty", "Rate", "Amount"]);
      itemHeader.eachCell((cell) => {
        cell.font = { bold: true, size: 9 };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E7FF" } };
        cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
      });

      report.items.forEach((item: any) => {
        const r = ws.addRow(["", item.category, item.description, item.uom, Number(item.qty), Number(item.rate), Number(item.amount)]);
        r.eachCell((cell) => {
          cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
          cell.font = { size: 9 };
        });
      });
      ws.addRow([]);
    });

    ws.getColumn(1).width = 12;
    ws.getColumn(2).width = 14;
    ws.getColumn(3).width = 30;
    ws.getColumn(4).width = 10;
    ws.getColumn(5).width = 10;
    ws.getColumn(6).width = 12;
    ws.getColumn(7).width = 14;
    ws.getColumn(8).width = 12;

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const link = document.createElement("a");
    link.download = `ExpenseReports_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 bg-clip-text text-transparent" data-testid="text-dashboard-title">Daily Cash Expance</h1>
            <p className="text-muted-foreground mt-1 text-xs sm:text-sm">Canteen Management Dashboard</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {perms.includes('expense') && (
              <Link href="/new">
                <Button className="h-9 sm:h-10 px-3 sm:px-4 rounded-xl shadow-lg shadow-indigo-500/20 text-xs sm:text-sm bg-gradient-to-r from-indigo-500 to-purple-600 border-0" data-testid="button-new-report">
                  <Plus className="w-4 h-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Daily Cash Expance</span>
                  <span className="sm:hidden">New Report</span>
                </Button>
              </Link>
            )}
            {perms.includes('cashseal') && (
              <Link href="/cash-seal">
                <Button variant="outline" className="h-9 sm:h-10 px-3 sm:px-4 rounded-xl text-xs sm:text-sm border-teal-200 text-teal-700 dark:border-teal-800 dark:text-teal-400" data-testid="button-cash-seal">
                  <Calculator className="w-4 h-4 mr-1 sm:mr-2" />
                  Daily Cash Seal
                </Button>
              </Link>
            )}
            {perms.includes('inventory') && (
              <Link href="/inventory">
                <Button variant="outline" className="h-9 sm:h-10 px-3 sm:px-4 rounded-xl text-xs sm:text-sm border-orange-200 text-orange-700 dark:border-orange-800 dark:text-orange-400" data-testid="button-inventory">
                  <ClipboardList className="w-4 h-4 mr-1 sm:mr-2" />
                  Inventory
                </Button>
              </Link>
            )}
            {isAdmin && (
              <Link href="/vendor-report">
                <Button variant="outline" className="h-9 sm:h-10 px-3 sm:px-4 rounded-xl text-xs sm:text-sm border-violet-200 text-violet-700 dark:border-violet-800 dark:text-violet-400" data-testid="button-vendor-report">
                  <BarChart3 className="w-4 h-4 mr-1 sm:mr-2" />
                  Vendor Report
                </Button>
              </Link>
            )}
          </div>
        </div>

        {hasExpense && reports && reports.length > 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <SummaryCard title="Total Cash" value={fmt(expenseStats.totalCash)} icon={Wallet} color="blue" subtitle={`${reports.length} reports`} />
              <SummaryCard title="Total Expense" value={fmt(expenseStats.totalExpense)} icon={TrendingDown} color="red" subtitle="All reports" />
              <SummaryCard title="Received Amount" value={fmt(expenseStats.totalReceived)} icon={TrendingUp} color="green" subtitle="Cash received" />
              <SummaryCard title="Opening Balance" value={fmt(expenseStats.totalOpening)} icon={IndianRupee} color="purple" subtitle="Carried forward" />
            </div>

            {expenseStats.chartData.length > 1 && (
              <Card className="border-0 shadow-lg overflow-hidden" data-testid="chart-expense-trends">
                <CardHeader className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white pb-3 pt-4">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    Cash vs Expense (Last 10 Reports)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-2 sm:p-4">
                  <div className="h-[220px] sm:h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={expenseStats.chartData} barGap={4}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                        <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                        <Tooltip
                          contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: '12px' }}
                          formatter={(value: number) => [fmt(value), undefined]}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                        <Bar dataKey="cash" name="Total Cash" fill="#6366f1" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="expense" name="Expense" fill="#f43f5e" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="balance" name="Balance" fill="#10b981" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {hasPurchase && purchaseInvoices && purchaseInvoices.length > 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <SummaryCard title="Total Invoices" value={fmt(invoiceStats.totalAmount)} icon={Receipt} color="indigo" subtitle={`${purchaseInvoices.length} invoices`} />
              <SummaryCard title="Payment Given" value={fmt(invoiceStats.totalPaid)} icon={Check} color="green" subtitle={`${invoiceStats.paidCount} paid`} />
              <SummaryCard title="Balance to Pay" value={fmt(invoiceStats.totalUnpaid)} icon={CreditCard} color="orange" subtitle={`${invoiceStats.unpaidCount} unpaid`} />
              <SummaryCard title="Purchase Requests" value={`${purchaseRequests?.length || 0}`} icon={ShoppingCart} color="amber" subtitle={`${purchaseStats.pending} pending, ${purchaseStats.approved} approved`} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {invoiceStats.vendorData.length > 0 && (
                <Card className="border-0 shadow-lg overflow-hidden" data-testid="chart-vendor-invoices">
                  <CardHeader className="bg-gradient-to-r from-violet-500 to-purple-500 text-white pb-3 pt-4">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Store className="w-4 h-4" />
                      Vendor-wise Invoice Amount
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-2 sm:p-4">
                    <div className="h-[220px] sm:h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={invoiceStats.vendorData} layout="vertical" barSize={20}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                          <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                          <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" width={90} />
                          <Tooltip
                            contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: '12px' }}
                            formatter={(value: number) => [fmt(value), "Amount"]}
                          />
                          <Bar dataKey="amount" radius={[0, 6, 6, 0]}>
                            {invoiceStats.vendorData.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              {invoiceStats.paymentPieData.length > 0 && (
                <Card className="border-0 shadow-lg overflow-hidden" data-testid="chart-payment-status">
                  <CardHeader className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white pb-3 pt-4">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      Payment Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-2 sm:p-4">
                    <div className="h-[220px] sm:h-[280px] flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={invoiceStats.paymentPieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={90}
                            paddingAngle={5}
                            dataKey="value"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            labelLine={false}
                          >
                            <Cell fill="#10b981" />
                            <Cell fill="#f43f5e" />
                          </Pie>
                          <Tooltip
                            contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: '12px' }}
                            formatter={(value: number) => [fmt(value), undefined]}
                          />
                          <Legend wrapperStyle={{ fontSize: '12px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        <Tabs defaultValue={defaultTab} className="space-y-4">
          {tabItems.length > 0 && (
            <div className="tabs-scroll-wrap">
              <TabsList className="inline-flex min-w-full sm:grid sm:w-full h-auto bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 rounded-xl p-1" style={{ gridTemplateColumns: `repeat(${Math.min(tabItems.length, 6)}, 1fr)` }} data-testid="tabs-dashboard">
                {tabItems.map(tab => (
                  <TabsTrigger key={tab.value} value={tab.value} className="text-xs sm:text-sm py-2.5 px-2.5 sm:px-3 whitespace-nowrap min-h-[44px] rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md" data-testid={`tab-${tab.value}`}>
                    <tab.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-1.5 shrink-0" />
                    <span>{tab.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          )}

          <TabsContent value="reports">
            {reports?.length === 0 ? (
              <Card className="border-0 shadow-lg overflow-hidden">
                <CardContent className="text-center py-20">
                  <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <FileText className="w-8 h-8 text-indigo-500" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">No reports yet</h3>
                  <p className="text-muted-foreground max-w-sm mx-auto mb-8">
                    Create your first daily expense report to start tracking.
                  </p>
                  <Link href="/new">
                    <Button className="bg-gradient-to-r from-indigo-500 to-purple-600 border-0 shadow-lg">Create Report</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-0 shadow-lg overflow-hidden" data-testid="card-reports-table">
                <CardHeader className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white pb-3 pt-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="w-5 h-5" />
                    Expense Reports
                    <span className="ml-auto flex items-center gap-2">
                      <Button variant="ghost" size="sm" className="h-7 text-white/90 hover:text-white hover:bg-white/20 text-xs" onClick={handleExportReportsExcel} data-testid="button-export-excel-reports">
                        <FileSpreadsheet className="w-3.5 h-3.5 mr-1" />
                        Excel
                      </Button>
                      <span className="text-sm font-normal bg-white/20 px-2.5 py-0.5 rounded-full">{sortedReports.length}</span>
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {/* Mobile cards */}
                  <div className="sm:hidden divide-y">
                    {sortedReports.map((report) => {
                      const opening = Number(report.openingBalance) || 0;
                      const received = Number(report.receivedAmount) || 0;
                      const totalCash = opening + received;
                      const totalExpense = report.items?.reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0) || 0;
                      return (
                        <div key={report.id} className="p-3 flex flex-col gap-2" data-testid={`mobile-card-report-${report.id}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm">
                                {format(new Date(report.date), "dd")}
                              </div>
                              <div>
                                <div className="font-semibold text-sm">{format(new Date(report.date), "dd-MM-yyyy")}</div>
                                <div className="text-[10px] text-muted-foreground">{format(new Date(report.date), "EEEE")} · #{report.reportNumber}</div>
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <Link href={`/report/${report.id}/pdf`}>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-emerald-600" data-testid={`button-pdf-report-${report.id}`}><FileDown className="w-4 h-4" /></Button>
                              </Link>
                              <Link href={`/report/${report.id}`}>
                                <Button size="sm" variant="ghost" className="h-8 px-2 text-xs text-indigo-600" data-testid={`button-view-report-${report.id}`}>View <ArrowRight className="w-3 h-3 ml-1" /></Button>
                              </Link>
                              {isAdmin && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" data-testid={`button-delete-report-${report.id}`}><Trash2 className="w-4 h-4" /></Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the report for {format(new Date(report.date), "dd-MM-yyyy")}.</AlertDialogDescription></AlertDialogHeader>
                                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteMutation.mutate(report.id)} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Delete</AlertDialogAction></AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-1.5 text-center">
                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-1.5">
                              <div className="text-[10px] text-muted-foreground">Total Cash</div>
                              <div className="font-mono text-xs font-bold text-indigo-600">{fmt(totalCash)}</div>
                            </div>
                            <div className="bg-rose-50 dark:bg-rose-950/20 rounded-lg p-1.5">
                              <div className="text-[10px] text-muted-foreground">Expense</div>
                              <div className="font-mono text-xs font-semibold text-rose-600">{fmt(totalExpense)}</div>
                            </div>
                            <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-lg p-1.5">
                              <div className="text-[10px] text-muted-foreground">Received</div>
                              <div className="font-mono text-xs font-semibold text-emerald-600">{fmt(received)}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Desktop table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-indigo-50 dark:bg-indigo-950/20 border-b border-indigo-200 dark:border-indigo-800/50">
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-indigo-700 dark:text-indigo-400">No.</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-indigo-700 dark:text-indigo-400">Date</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-indigo-700 dark:text-indigo-400">Opening Bal.</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-indigo-700 dark:text-indigo-400">Received</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-indigo-700 dark:text-indigo-400">Total Cash</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-indigo-700 dark:text-indigo-400">Total Expense</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-indigo-700 dark:text-indigo-400">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedReports.map((report, idx) => {
                          const opening = Number(report.openingBalance) || 0;
                          const received = Number(report.receivedAmount) || 0;
                          const totalCash = opening + received;
                          const totalExpense = report.items?.reduce((sum: number, item: any) => sum + (Number(item.amount) || 0), 0) || 0;
                          return (
                            <tr key={report.id} className="border-b last:border-0 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/10 transition-colors group">
                              <td className="px-3 py-2.5"><span className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-white text-[10px] inline-flex items-center justify-center font-bold">#{report.reportNumber}</span></td>
                              <td className="px-3 py-2.5 font-medium">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">{format(new Date(report.date), "dd")}</div>
                                  <div className="flex flex-col min-w-0"><span className="text-sm truncate">{format(new Date(report.date), "MM-yyyy")}</span><span className="text-[10px] text-muted-foreground truncate">{format(new Date(report.date), "EEEE")}</span></div>
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono text-xs text-muted-foreground">{fmt(opening)}</td>
                              <td className="px-3 py-2.5 text-right font-mono text-xs text-emerald-600 font-semibold">{fmt(received)}</td>
                              <td className="px-3 py-2.5 text-right font-mono text-xs font-bold text-indigo-600">{fmt(totalCash)}</td>
                              <td className="px-3 py-2.5 text-right font-mono text-xs text-rose-600 font-semibold">{fmt(totalExpense)}</td>
                              <td className="px-3 py-2.5 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Link href={`/report/${report.id}/pdf`}><Button size="sm" variant="ghost" className="h-7 text-xs text-emerald-600" data-testid={`button-pdf-report-${report.id}`}><FileDown className="w-3.5 h-3.5 mr-0.5" />PDF</Button></Link>
                                  <Link href={`/report/${report.id}`}><Button size="sm" variant="ghost" className="h-7 text-xs text-indigo-600" data-testid={`button-view-report-${report.id}`}>View <ArrowRight className="w-3 h-3 ml-1" /></Button></Link>
                                  {isAdmin && (<AlertDialog><AlertDialogTrigger asChild><Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" data-testid={`button-delete-report-${report.id}`}><Trash2 className="w-3.5 h-3.5" /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the report for {format(new Date(report.date), "dd-MM-yyyy")}.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteMutation.mutate(report.id)} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>)}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="cashseal">
            {csLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
              </div>
            ) : !cashSeals || cashSeals.length === 0 ? (
              <Card className="border-0 shadow-lg overflow-hidden">
                <CardContent className="text-center py-12">
                  <div className="w-16 h-16 bg-gradient-to-br from-teal-100 to-cyan-100 dark:from-teal-900/30 dark:to-cyan-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Calculator className="w-8 h-8 text-teal-500" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">No Daily Cash Seal records yet</h3>
                  <p className="text-muted-foreground max-w-sm mx-auto mb-6">Start recording your daily cash seal income and expenses.</p>
                  <Link href="/cash-seal">
                    <Button className="bg-gradient-to-r from-teal-500 to-cyan-600 border-0 shadow-lg" data-testid="button-go-cashseal">Create Daily Cash Seal Record</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-0 shadow-lg overflow-hidden" data-testid="card-cashseal-table">
                <CardHeader className="bg-gradient-to-r from-teal-500 to-cyan-500 text-white pb-3 pt-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Calculator className="w-5 h-5" />
                    Daily Cash Seal Records
                    <span className="ml-auto text-sm font-normal bg-white/20 px-2.5 py-0.5 rounded-full">{cashSeals.length}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {/* Mobile cards */}
                  <div className="sm:hidden divide-y">
                    {cashSeals.map((seal: any) => {
                      const n = (v: any) => Number(v) || 0;
                      const psIncome = n(seal.incomePsBreakfastCashQty)*5 + n(seal.incomePsLunchCashQty)*20 + n(seal.incomePsEveningCashQty)*10 + n(seal.incomePsNightCashQty)*10 + n(seal.incomePsRechargeRate)*n(seal.incomePsRechargeCashQty) + n(seal.incomePsBreakfastOnlineQty)*5 + n(seal.incomePsLunchOnlineQty)*20 + n(seal.incomePsEveningOnlineQty)*10 + n(seal.incomePsNightOnlineQty)*10 + n(seal.incomePsRechargeRate)*n(seal.incomePsRechargeOnlineQty);
                      const tpIncome = n(seal.incomeTpBreakfastCashQty)*20 + n(seal.incomeTpLunchVegCashQty)*35 + n(seal.incomeTpLunchNvRate)*n(seal.incomeTpLunchNvCashQty) + n(seal.incomeTpEveningCashQty)*20 + n(seal.incomeTpNightCashQty)*20 + n(seal.incomeTpBreakfastOnlineQty)*20 + n(seal.incomeTpLunchVegOnlineQty)*35 + n(seal.incomeTpLunchNvRate)*n(seal.incomeTpLunchNvOnlineQty) + n(seal.incomeTpEveningOnlineQty)*20 + n(seal.incomeTpNightOnlineQty)*20;
                      const legacyIncome = n(seal.incomeMorningQty)*5 + n(seal.incomeLunchQty)*20 + n(seal.incomeEveningQty)*10 + n(seal.incomeNightQty)*10 + n(seal.incomeNonVegRate)*n(seal.incomeNonVegQty) + n(seal.incomeVegRate)*n(seal.incomeVegQty) + n(seal.incomeMorningCashRate)*n(seal.incomeMorningCashQty) + n(seal.incomeEveningCashRate)*n(seal.incomeEveningCashQty) + n(seal.incomeOnlineBreakfastQty)*5 + n(seal.incomeOnlineLunchQty)*20 + n(seal.incomeOnlineEveningSnacksQty)*10 + n(seal.incomeOnlineNightQty)*10;
                      const income = psIncome + tpIncome + legacyIncome;
                      const expense = (n(seal.expenseBananaQty) * 4.5) + (n(seal.expenseDahiBharQty) * n(seal.expenseDahiBharRate)) + n(seal.expenseOtherAmount);
                      const balance = income - expense;
                      return (
                        <div key={seal.id} className="p-3 flex flex-col gap-2" data-testid={`mobile-card-seal-${seal.id}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm">
                                {format(new Date(seal.date), "dd")}
                              </div>
                              <div>
                                <div className="font-semibold text-sm">{format(new Date(seal.date), "dd-MM-yyyy")}</div>
                                <div className="text-[10px] text-muted-foreground">{format(new Date(seal.date), "EEEE")} · #{seal.serialNumber}</div>
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <Link href={`/cash-seal?edit=${seal.id}`}><Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-teal-600" data-testid={`button-edit-seal-${seal.id}`}><Pencil className="w-4 h-4" /></Button></Link>
                              <Link href={`/cash-seal/${seal.id}/pdf`}><Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-emerald-600" data-testid={`button-pdf-seal-${seal.id}`}><FileDown className="w-4 h-4" /></Button></Link>
                            </div>
                          </div>
                          <div className="grid grid-cols-4 gap-1 text-center">
                            <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-lg p-1.5">
                              <div className="text-[10px] text-muted-foreground">Income</div>
                              <div className="font-mono text-[11px] font-bold text-emerald-600">{fmt(income)}</div>
                            </div>
                            <div className="bg-rose-50 dark:bg-rose-950/20 rounded-lg p-1.5">
                              <div className="text-[10px] text-muted-foreground">Expense</div>
                              <div className="font-mono text-[11px] font-semibold text-rose-600">{fmt(expense)}</div>
                            </div>
                            <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-1.5">
                              <div className="text-[10px] text-muted-foreground">Balance</div>
                              <div className="font-mono text-[11px] font-bold text-blue-600">{fmt(balance)}</div>
                            </div>
                            <div className="bg-orange-50 dark:bg-orange-950/20 rounded-lg p-1.5">
                              <div className="text-[10px] text-muted-foreground">Akbar Ali</div>
                              <div className="font-mono text-[11px] font-semibold text-orange-600">{fmt(n(seal.totalGivenToAkbarAli))}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Desktop table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-teal-50 dark:bg-teal-950/20 border-b border-teal-200 dark:border-teal-800/50">
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-teal-700 dark:text-teal-400">No.</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-teal-700 dark:text-teal-400">Date</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-emerald-700 dark:text-emerald-400">Total Income</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-rose-700 dark:text-rose-400">Total Expense</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-blue-700 dark:text-blue-400">Balance</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-orange-700 dark:text-orange-400">Given to Akbar Ali</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-teal-700 dark:text-teal-400">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cashSeals.map((seal: any) => {
                          const BANANA_RATE = 4.5;
                          const n = (v: any) => Number(v) || 0;
                          const psIncome = n(seal.incomePsBreakfastCashQty)*5 + n(seal.incomePsLunchCashQty)*20 + n(seal.incomePsEveningCashQty)*10 + n(seal.incomePsNightCashQty)*10 + n(seal.incomePsRechargeRate)*n(seal.incomePsRechargeCashQty) + n(seal.incomePsBreakfastOnlineQty)*5 + n(seal.incomePsLunchOnlineQty)*20 + n(seal.incomePsEveningOnlineQty)*10 + n(seal.incomePsNightOnlineQty)*10 + n(seal.incomePsRechargeRate)*n(seal.incomePsRechargeOnlineQty);
                          const tpIncome = n(seal.incomeTpBreakfastCashQty)*20 + n(seal.incomeTpLunchVegCashQty)*35 + n(seal.incomeTpLunchNvRate)*n(seal.incomeTpLunchNvCashQty) + n(seal.incomeTpEveningCashQty)*20 + n(seal.incomeTpNightCashQty)*20 + n(seal.incomeTpBreakfastOnlineQty)*20 + n(seal.incomeTpLunchVegOnlineQty)*35 + n(seal.incomeTpLunchNvRate)*n(seal.incomeTpLunchNvOnlineQty) + n(seal.incomeTpEveningOnlineQty)*20 + n(seal.incomeTpNightOnlineQty)*20;
                          const legacyIncome = n(seal.incomeMorningQty)*5 + n(seal.incomeLunchQty)*20 + n(seal.incomeEveningQty)*10 + n(seal.incomeNightQty)*10 + n(seal.incomeNonVegRate)*n(seal.incomeNonVegQty) + n(seal.incomeVegRate)*n(seal.incomeVegQty) + n(seal.incomeMorningCashRate)*n(seal.incomeMorningCashQty) + n(seal.incomeEveningCashRate)*n(seal.incomeEveningCashQty) + n(seal.incomeOnlineBreakfastQty)*5 + n(seal.incomeOnlineLunchQty)*20 + n(seal.incomeOnlineEveningSnacksQty)*10 + n(seal.incomeOnlineNightQty)*10;
                          const income = psIncome + tpIncome + legacyIncome;
                          const expense = (n(seal.expenseBananaQty) * BANANA_RATE) + (n(seal.expenseDahiBharQty) * n(seal.expenseDahiBharRate)) + n(seal.expenseOtherAmount);
                          const balance = income - expense;
                          return (
                            <tr key={seal.id} className="border-b last:border-0 hover:bg-teal-50/50 dark:hover:bg-teal-950/10 transition-colors">
                              <td className="px-3 py-2.5"><span className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 text-white text-[10px] inline-flex items-center justify-center font-bold">#{seal.serialNumber}</span></td>
                              <td className="px-3 py-2.5 font-medium">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-500 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">{format(new Date(seal.date), "dd")}</div>
                                  <div className="flex flex-col min-w-0"><span className="text-sm truncate">{format(new Date(seal.date), "MM-yyyy")}</span><span className="text-[10px] text-muted-foreground truncate">{format(new Date(seal.date), "EEEE")}</span></div>
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono text-xs text-emerald-600 font-semibold">{fmt(income)}</td>
                              <td className="px-3 py-2.5 text-right font-mono text-xs text-rose-600">{fmt(expense)}</td>
                              <td className="px-3 py-2.5 text-right font-mono text-xs font-bold text-blue-600">{fmt(balance)}</td>
                              <td className="px-3 py-2.5 text-right font-mono text-xs text-orange-600 font-semibold">{fmt(Number(seal.totalGivenToAkbarAli))}</td>
                              <td className="px-3 py-2.5 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Link href={`/cash-seal?edit=${seal.id}`}><Button size="sm" variant="ghost" className="h-7 text-xs text-teal-600" data-testid={`button-edit-seal-${seal.id}`}><Pencil className="w-3.5 h-3.5 mr-0.5" />Edit</Button></Link>
                                  <Link href={`/cash-seal/${seal.id}/pdf`}><Button size="sm" variant="ghost" className="h-7 text-xs text-emerald-600" data-testid={`button-pdf-seal-${seal.id}`}><FileDown className="w-3.5 h-3.5 mr-0.5" />PDF</Button></Link>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="inventory">
            {invLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
              </div>
            ) : sortedInventories.length === 0 ? (
              <Card className="border-0 shadow-lg overflow-hidden">
                <CardContent className="text-center py-12">
                  <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <ClipboardList className="w-8 h-8 text-orange-500" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">No inventory records yet</h3>
                  <p className="text-muted-foreground max-w-sm mx-auto mb-6">Start tracking your daily kitchen stock and biscuit inventory.</p>
                  <Link href="/inventory">
                    <Button className="bg-gradient-to-r from-orange-500 to-amber-600 border-0 shadow-lg" data-testid="button-create-inventory">Create Inventory Record</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-0 shadow-lg overflow-hidden" data-testid="card-inventory-table">
                <CardHeader className="bg-gradient-to-r from-orange-500 to-amber-500 text-white pb-3 pt-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ClipboardList className="w-5 h-5" />
                    Daily Inventory Records
                    <span className="ml-auto text-sm font-normal bg-white/20 px-2.5 py-0.5 rounded-full">{sortedInventories.length}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {/* Mobile cards */}
                  <div className="sm:hidden divide-y">
                    {sortedInventories.map((inv) => {
                      const totalKitchenUsed = inv.kitchenStock?.reduce((s: number, i: any) => s + (Number(i.used) || 0), 0) || 0;
                      const totalBiscuitUsed = inv.biscuits?.reduce((s: number, i: any) => s + (Number(i.used) || 0), 0) || 0;
                      return (
                        <div key={inv.id} className="p-3 flex flex-col gap-2" data-testid={`mobile-card-inventory-${inv.id}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm">
                                {format(new Date(inv.date), "dd")}
                              </div>
                              <div>
                                <div className="font-semibold text-sm">{format(new Date(inv.date), "dd-MM-yyyy")}</div>
                                <div className="text-[10px] text-muted-foreground">{format(new Date(inv.date), "EEEE")} · #{(inv as any).serialNumber}</div>
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <Link href={`/inventory/${inv.id}/pdf`}><Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-emerald-600" data-testid={`button-pdf-inventory-${inv.id}`}><FileDown className="w-4 h-4" /></Button></Link>
                              <Button size="sm" variant="ghost" className="h-8 px-2 text-xs text-orange-600" data-testid={`button-view-inventory-${inv.id}`}>View <ArrowRight className="w-3 h-3 ml-1" /></Button>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-1.5 text-center">
                            <div className="bg-indigo-50 dark:bg-indigo-950/20 rounded-lg p-1.5">
                              <div className="text-[10px] text-muted-foreground">Kitchen</div>
                              <div className="font-mono text-xs font-bold text-indigo-600">{inv.kitchenStock?.length || 0} items</div>
                            </div>
                            <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-1.5">
                              <div className="text-[10px] text-muted-foreground">Biscuits</div>
                              <div className="font-mono text-xs font-semibold text-amber-600">{inv.biscuits?.length || 0} items</div>
                            </div>
                            <div className="bg-rose-50 dark:bg-rose-950/20 rounded-lg p-1.5">
                              <div className="text-[10px] text-muted-foreground">Total Used</div>
                              <div className="font-mono text-xs font-semibold text-rose-600">{(totalKitchenUsed + totalBiscuitUsed).toFixed(0)}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Desktop table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-orange-50 dark:bg-orange-950/20 border-b border-orange-200 dark:border-orange-800/50">
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-orange-700 dark:text-orange-400">No.</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-orange-700 dark:text-orange-400">Date</th>
                          <th className="px-3 py-2.5 text-center text-xs font-semibold text-orange-700 dark:text-orange-400">Kitchen Items</th>
                          <th className="px-3 py-2.5 text-center text-xs font-semibold text-orange-700 dark:text-orange-400">Biscuit Items</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-orange-700 dark:text-orange-400">Total Used</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-orange-700 dark:text-orange-400">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedInventories.map((inv) => {
                          const totalKitchenUsed = inv.kitchenStock?.reduce((sum: number, item: any) => sum + (Number(item.used) || 0), 0) || 0;
                          const totalBiscuitUsed = inv.biscuits?.reduce((sum: number, item: any) => sum + (Number(item.used) || 0), 0) || 0;
                          return (
                            <tr key={inv.id} className="border-b last:border-0 hover:bg-orange-50/50 dark:hover:bg-orange-950/10 transition-colors">
                              <td className="px-3 py-2.5"><span className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 text-white text-[10px] inline-flex items-center justify-center font-bold">#{(inv as any).serialNumber}</span></td>
                              <td className="px-3 py-2.5 font-medium">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">{format(new Date(inv.date), "dd")}</div>
                                  <div className="flex flex-col min-w-0"><span className="text-sm truncate">{format(new Date(inv.date), "MM-yyyy")}</span><span className="text-[10px] text-muted-foreground truncate">{format(new Date(inv.date), "EEEE")}</span></div>
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-center"><span className="font-mono text-xs bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 px-2 py-0.5 rounded-full font-semibold">{inv.kitchenStock?.length || 0}</span></td>
                              <td className="px-3 py-2.5 text-center"><span className="font-mono text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-600 px-2 py-0.5 rounded-full font-semibold">{inv.biscuits?.length || 0}</span></td>
                              <td className="px-3 py-2.5 text-right font-mono text-xs text-rose-600 font-semibold">{(totalKitchenUsed + totalBiscuitUsed).toFixed(0)} items</td>
                              <td className="px-3 py-2.5 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Link href={`/inventory/${inv.id}/pdf`}><Button size="sm" variant="ghost" className="h-7 text-xs text-emerald-600" data-testid={`button-pdf-inventory-${inv.id}`}><FileDown className="w-3.5 h-3.5 mr-0.5" />PDF</Button></Link>
                                  <Button size="sm" variant="ghost" className="h-7 text-xs text-orange-600" data-testid={`button-view-inventory-${inv.id}`}>View <ArrowRight className="w-3 h-3 ml-1" /></Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="menus">
            {menusLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
              </div>
            ) : !savedMenus || savedMenus.length === 0 ? (
              <Card className="border-0 shadow-lg overflow-hidden">
                <CardContent className="text-center py-12">
                  <div className="w-16 h-16 bg-gradient-to-br from-violet-100 to-fuchsia-100 dark:from-violet-900/30 dark:to-fuchsia-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <UtensilsCrossed className="w-8 h-8 text-violet-500" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">No saved menus yet</h3>
                  <p className="text-muted-foreground max-w-sm mx-auto mb-6">Create a menu in the Menu Manager and save it to see it here.</p>
                  <Link href="/menu">
                    <Button className="bg-gradient-to-r from-violet-500 to-fuchsia-600 border-0 shadow-lg" data-testid="button-go-menu">Go to Menu Manager</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-0 shadow-lg overflow-hidden" data-testid="card-menus-table">
                <CardHeader className="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white pb-3 pt-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <UtensilsCrossed className="w-5 h-5" />
                    Saved Menus
                    <span className="ml-auto text-sm font-normal bg-white/20 px-2.5 py-0.5 rounded-full">{savedMenus.length}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-violet-50 dark:bg-violet-950/20 border-b border-violet-200 dark:border-violet-800/50">
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-violet-700 dark:text-violet-400">Client Name</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-violet-700 dark:text-violet-400">Date Range</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-violet-700 dark:text-violet-400">Saved On</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-violet-700 dark:text-violet-400">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {savedMenus.map((menu, idx) => (
                          <tr key={menu.id} className="border-b last:border-0 hover:bg-violet-50/50 dark:hover:bg-violet-950/10 transition-colors">
                            <td className="px-3 py-2.5 font-medium">
                              <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                                  <UtensilsCrossed className="w-4 h-4" />
                                </div>
                                <span className="truncate">{menu.clientName}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                              {format(new Date(menu.startDate), "dd-MM-yyyy")} — {format(new Date(menu.endDate), "dd-MM-yyyy")}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-muted-foreground">
                              {menu.createdAt ? format(new Date(menu.createdAt), "dd-MM-yyyy, hh:mm a") : "-"}
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Link href={`/menu?load=${menu.id}`}>
                                  <Button size="sm" variant="ghost" className="h-7 text-xs text-violet-600" data-testid={`button-view-menu-${menu.id}`}>
                                    View <ArrowRight className="w-3 h-3 ml-1" />
                                  </Button>
                                </Link>
                                {isAdmin && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" data-testid={`button-delete-menu-${menu.id}`}>
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete saved menu?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This will permanently delete the saved menu for {menu.clientName}.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => deleteMenuMutation.mutate(menu.id)}
                                        className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="purchase">
            {!purchaseRequests || purchaseRequests.length === 0 ? (
              <Card className="border-0 shadow-lg overflow-hidden">
                <CardContent className="text-center py-12">
                  <div className="w-16 h-16 bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <ShoppingCart className="w-8 h-8 text-amber-500" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">
                    {isAdmin ? "No purchase requests to review" : "No approved purchase requests yet"}
                  </h3>
                  <p className="text-muted-foreground max-w-sm mx-auto mb-6">
                    {isAdmin ? "Purchase requests from users will appear here for your approval." : "Your purchase requests are pending admin approval."}
                  </p>
                  <Link href="/purchase-request">
                    <Button className="bg-gradient-to-r from-amber-500 to-orange-600 border-0 shadow-lg" data-testid="button-go-purchase">Create Purchase Request</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-0 shadow-lg overflow-hidden" data-testid="card-purchase-table">
                <CardHeader className="bg-gradient-to-r from-amber-500 to-orange-500 text-white pb-3 pt-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ShoppingCart className="w-5 h-5" />
                    Purchase Requests
                    <span className="ml-auto text-sm font-normal bg-white/20 px-2.5 py-0.5 rounded-full">{purchaseRequests.length}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {/* Mobile cards */}
                  <div className="sm:hidden divide-y">
                    {purchaseRequests.map((pr: any) => (
                      <div key={pr.id} className="p-3 flex flex-col gap-2" data-testid={`mobile-card-purchase-${pr.id}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                              <ShoppingCart className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-sm truncate">{pr.clientName}</div>
                              <div className="text-[10px] text-muted-foreground">{format(new Date(pr.date), "dd-MM-yyyy")} · {(pr as any).prCode || `#${pr.serialNumber}`} · {pr.items?.length || 0} items</div>
                            </div>
                          </div>
                          <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${pr.status === 'approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : pr.status === 'rejected' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                            {pr.status === 'approved' ? 'Approved' : pr.status === 'rejected' ? 'Rejected' : 'Pending'}
                          </span>
                        </div>
                        <div className="flex gap-1 justify-end">
                          {pr.status === 'approved' && (<>
                            <Link href={`/purchase-request/${pr.id}/pdf`}><Button size="sm" variant="outline" className="h-7 text-xs gap-1" data-testid={`button-view-pdf-${pr.id}`}><FileDown className="w-3 h-3" />PDF</Button></Link>
                            {pr.invoiced ? (
                              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-emerald-600 cursor-default opacity-70" disabled data-testid={`button-invoiced-${pr.id}`}><CheckCircle2 className="w-3 h-3" />Invoiced</Button>
                            ) : (
                              <Link href={`/purchase-invoice/from/${pr.id}`}><Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-orange-600" data-testid={`button-create-invoice-${pr.id}`}><Receipt className="w-3 h-3" />Invoice</Button></Link>
                            )}
                          </>)}
                          {isAdmin && (pr.status === 'pending' || pr.status === 'approved') && (
                            <Link href={`/purchase-request/${pr.id}/review`}><Button size="sm" variant="outline" className={`h-7 text-xs gap-1 ${pr.status === 'pending' ? 'text-emerald-600' : 'text-blue-600'}`} data-testid={`button-review-purchase-${pr.id}`}>{pr.status === 'pending' ? <><Check className="w-3 h-3" />Review</> : <><Pencil className="w-3 h-3" />Edit</>}</Button></Link>
                          )}
                          {isAdmin && (<AlertDialog><AlertDialogTrigger asChild><Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" data-testid={`button-delete-purchase-${pr.id}`}><Trash2 className="w-3.5 h-3.5" /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete purchase request?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the purchase request for {pr.clientName} ({format(new Date(pr.date), "dd-MM-yyyy")}).</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deletePurchaseMutation.mutate(pr.id)} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>)}
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Desktop table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-800/50">
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-amber-700 dark:text-amber-400">S.No</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-amber-700 dark:text-amber-400">Client Name</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-amber-700 dark:text-amber-400">Created By</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-amber-700 dark:text-amber-400">Date</th>
                          <th className="px-3 py-2.5 text-center text-xs font-semibold text-amber-700 dark:text-amber-400">Items</th>
                          <th className="px-3 py-2.5 text-center text-xs font-semibold text-amber-700 dark:text-amber-400">Status</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-amber-700 dark:text-amber-400">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {purchaseRequests.map((pr: any) => (
                          <tr key={pr.id} className="border-b last:border-0 hover:bg-amber-50/50 dark:hover:bg-amber-950/10 transition-colors">
                            <td className="px-3 py-2.5"><span className="font-mono text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded whitespace-nowrap">{(pr as any).prCode || `#${pr.serialNumber}`}</span></td>
                            <td className="px-3 py-2.5 font-medium">
                              <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center shrink-0 shadow-sm"><ShoppingCart className="w-4 h-4" /></div>
                                <span className="truncate text-sm">{pr.clientName}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-xs text-muted-foreground">{pr.createdBy || '-'}</td>
                            <td className="px-3 py-2.5 text-xs text-muted-foreground">{format(new Date(pr.date), "dd-MM-yyyy")}</td>
                            <td className="px-3 py-2.5 text-center"><span className="font-mono text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-600 px-2 py-0.5 rounded-full font-semibold">{pr.items?.length || 0}</span></td>
                            <td className="px-3 py-2.5 text-center">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold shadow-sm ${pr.status === 'approved' ? 'bg-gradient-to-r from-emerald-400 to-green-500 text-white' : pr.status === 'rejected' ? 'bg-gradient-to-r from-rose-400 to-red-500 text-white' : 'bg-gradient-to-r from-amber-400 to-yellow-500 text-white'}`}>
                                {pr.status === 'approved' ? 'Approved' : pr.status === 'rejected' ? 'Rejected' : 'Pending'}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {pr.status === 'approved' && (<>
                                  <Link href={`/purchase-request/${pr.id}/pdf`}><Button size="sm" variant="ghost" className="h-7 text-xs text-indigo-600" data-testid={`button-view-pdf-${pr.id}`}><FileDown className="w-3.5 h-3.5 mr-0.5" />PDF</Button></Link>
                                  {pr.invoiced ? (
                                    <Button size="sm" variant="ghost" className="h-7 text-xs text-emerald-600 cursor-default opacity-70" disabled data-testid={`button-invoiced-${pr.id}`}><CheckCircle2 className="w-3.5 h-3.5 mr-0.5" />Invoiced</Button>
                                  ) : (
                                    <Link href={`/purchase-invoice/from/${pr.id}`}><Button size="sm" variant="ghost" className="h-7 text-xs text-orange-600" data-testid={`button-create-invoice-${pr.id}`}><Receipt className="w-3.5 h-3.5 mr-0.5" />Invoice</Button></Link>
                                  )}
                                </>)}
                                {isAdmin && (pr.status === 'pending' || pr.status === 'approved') && (
                                  <Link href={`/purchase-request/${pr.id}/review`}><Button size="sm" variant="ghost" className={`h-7 text-xs ${pr.status === 'pending' ? 'text-emerald-600' : 'text-blue-600'}`} data-testid={`button-review-purchase-${pr.id}`}>{pr.status === 'pending' ? <Check className="w-3.5 h-3.5 mr-0.5" /> : <Pencil className="w-3.5 h-3.5 mr-0.5" />}<span>{pr.status === 'pending' ? 'Review' : 'Edit'}</span></Button></Link>
                                )}
                                {isAdmin && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" data-testid={`button-delete-purchase-${pr.id}`}>
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete purchase request?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This will permanently delete the purchase request for {pr.clientName} ({format(new Date(pr.date), "dd-MM-yyyy")}).
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => deletePurchaseMutation.mutate(pr.id)}
                                        className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="invoices">
            {!purchaseInvoices || purchaseInvoices.length === 0 ? (
              <Card className="border-0 shadow-lg overflow-hidden">
                <CardContent className="text-center py-12">
                  <div className="w-16 h-16 bg-gradient-to-br from-rose-100 to-pink-100 dark:from-rose-900/30 dark:to-pink-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Receipt className="w-8 h-8 text-rose-500" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">No purchase invoices yet</h3>
                  <p className="text-muted-foreground max-w-sm mx-auto mb-6">
                    Create invoices from approved purchase requests with vendor details, pricing and GST.
                  </p>
                  <Link href="/purchase-invoice">
                    <Button className="bg-gradient-to-r from-rose-500 to-pink-600 border-0 shadow-lg" data-testid="button-go-invoice">Create Purchase Invoice</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-0 shadow-lg overflow-hidden" data-testid="card-invoices-table">
                <CardHeader className="bg-gradient-to-r from-rose-500 to-pink-500 text-white pb-3 pt-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Receipt className="w-5 h-5" />
                    Purchase Invoices
                    <span className="ml-auto flex items-center gap-2">
                      <Link href="/purchase-invoice">
                        <Button size="sm" variant="ghost" className="h-7 text-white/90 hover:text-white hover:bg-white/20 text-xs gap-1" data-testid="button-new-purchase-invoice">
                          <Plus className="w-3.5 h-3.5" /> New Invoice
                        </Button>
                      </Link>
                      <span className="text-sm font-normal bg-white/20 px-2.5 py-0.5 rounded-full">{purchaseInvoices.length}</span>
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {/* Mobile cards */}
                  <div className="sm:hidden divide-y">
                    {purchaseInvoices.map((inv: any) => (
                      <div key={inv.id} className="p-3 flex flex-col gap-2" data-testid={`mobile-card-invoice-${inv.id}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                              <Receipt className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-sm truncate flex items-center gap-1.5">
                                {inv.clientName}
                                {inv.djInvoiceNo && <span className="font-mono text-[10px] bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 px-1.5 py-0.5 rounded shrink-0">{inv.djInvoiceNo}</span>}
                              </div>
                              <div className="text-[10px] text-muted-foreground truncate">{inv.vendorName} · {format(new Date(inv.date), "dd-MM-yyyy")}</div>
                            </div>
                          </div>
                          {(() => {
                            const paid = (inv.payments || []).reduce((s: number, p: any) => s + Number(p.amount), 0);
                            const total = Number(inv.grandTotal);
                            const isPaid = paid >= total && total > 0;
                            const isPartial = paid > 0 && paid < total;
                            return (
                              <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${isPaid ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : isPartial ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'}`} data-testid={`badge-payment-${inv.id}`}>
                                {isPaid ? 'Paid' : isPartial ? `Partial ₹${paid.toFixed(0)}` : 'Unpaid'}
                              </span>
                            );
                          })()}
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="font-mono text-sm font-bold text-indigo-600">{fmt(Number(inv.grandTotal))}</div>
                          <div className="flex gap-1">
                            <Link href={`/purchase-invoice/${inv.id}/edit`}><Button size="sm" variant="ghost" className="h-7 text-xs text-violet-600 gap-0.5" data-testid={`button-payment-invoice-${inv.id}`}><IndianRupee className="w-3.5 h-3.5" />Pay</Button></Link>
                            <Link href={`/purchase-invoice/${inv.id}/edit`}><Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-blue-600" data-testid={`button-edit-invoice-${inv.id}`}><Pencil className="w-4 h-4" /></Button></Link>
                            {isAdmin && (<AlertDialog><AlertDialogTrigger asChild><Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" data-testid={`button-delete-invoice-${inv.id}`}><Trash2 className="w-4 h-4" /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete purchase invoice?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the invoice for {inv.clientName} - {inv.vendorName} ({format(new Date(inv.date), "dd-MM-yyyy")}).</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteInvoiceMutation.mutate(inv.id)} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Desktop table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-rose-50 dark:bg-rose-950/20 border-b border-rose-200 dark:border-rose-800/50">
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-rose-700 dark:text-rose-400">DJ No.</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-rose-700 dark:text-rose-400">Client Name</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-rose-700 dark:text-rose-400">Vendor</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-rose-700 dark:text-rose-400">Date</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-rose-700 dark:text-rose-400">Grand Total</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-rose-700 dark:text-rose-400">Paid</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-rose-700 dark:text-rose-400">Balance</th>
                          <th className="px-3 py-2.5 text-center text-xs font-semibold text-rose-700 dark:text-rose-400">Status</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-rose-700 dark:text-rose-400">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {purchaseInvoices.map((inv: any) => {
                          const totalPaid = (inv.payments || []).reduce((s: number, p: any) => s + Number(p.amount), 0);
                          const grandTotal = Number(inv.grandTotal);
                          const balance = grandTotal - totalPaid;
                          const isPaid = totalPaid >= grandTotal && grandTotal > 0;
                          const isPartial = totalPaid > 0 && totalPaid < grandTotal;
                          return (
                          <tr key={inv.id} className="border-b last:border-0 hover:bg-rose-50/50 dark:hover:bg-rose-950/10 transition-colors">
                            <td className="px-3 py-2.5">
                              <span className="font-mono text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 px-2 py-1 rounded">{inv.djInvoiceNo || `#${inv.serialNumber}`}</span>
                            </td>
                            <td className="px-3 py-2.5 font-medium">
                              <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-rose-500 to-pink-500 text-white flex items-center justify-center shrink-0 shadow-sm"><Receipt className="w-4 h-4" /></div>
                                <div className="min-w-0">
                                  <div className="truncate text-sm">{inv.clientName}</div>
                                  <div className="text-[10px] text-muted-foreground truncate">{inv.vendorName}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-xs text-muted-foreground">{inv.vendorInvoiceNo || '-'}</td>
                            <td className="px-3 py-2.5 text-xs text-muted-foreground">{format(new Date(inv.date), "dd-MM-yyyy")}</td>
                            <td className="px-3 py-2.5 text-right font-mono text-xs font-bold text-indigo-600">{fmt(grandTotal)}</td>
                            <td className="px-3 py-2.5 text-right font-mono text-xs font-semibold text-emerald-600">{totalPaid > 0 ? fmt(totalPaid) : '-'}</td>
                            <td className="px-3 py-2.5 text-right font-mono text-xs font-semibold text-rose-600">{!isPaid && balance > 0 ? fmt(balance) : '-'}</td>
                            <td className="px-3 py-2.5 text-center">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold shadow-sm ${isPaid ? 'bg-gradient-to-r from-emerald-400 to-green-500 text-white' : isPartial ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-white' : 'bg-gradient-to-r from-rose-400 to-red-500 text-white'}`} data-testid={`badge-payment-${inv.id}`}>
                                {isPaid ? 'Paid' : isPartial ? 'Partial' : 'Unpaid'}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Link href={`/purchase-invoice/${inv.id}/edit`}><Button size="sm" variant="ghost" className="h-7 text-xs text-violet-600" data-testid={`button-payment-invoice-${inv.id}`}><IndianRupee className="w-3.5 h-3.5 mr-0.5" />Pay</Button></Link>
                                <Link href={`/purchase-invoice/${inv.id}/edit`}><Button size="sm" variant="ghost" className="h-7 text-xs text-blue-600" data-testid={`button-edit-invoice-${inv.id}`}><Pencil className="w-3.5 h-3.5 mr-0.5" />Edit</Button></Link>
                                {isAdmin && (<AlertDialog><AlertDialogTrigger asChild><Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" data-testid={`button-delete-invoice-${inv.id}`}><Trash2 className="w-3.5 h-3.5" /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete purchase invoice?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the invoice for {inv.clientName} - {inv.vendorName} ({format(new Date(inv.date), "dd-MM-yyyy")}).</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteInvoiceMutation.mutate(inv.id)} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>)}
                              </div>
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

        </Tabs>
      </div>
    </Layout>
  );
}
