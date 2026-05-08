import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, TrendingDown, IndianRupee, Printer, ChevronDown, ChevronRight, BarChart3, Building2, Check, X } from "lucide-react";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const now = new Date();

function fmtINR(v: number) {
  return "₹" + v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pct(part: number, total: number) {
  if (!total) return "0%";
  return (part / total * 100).toFixed(1) + "%";
}

function SummaryCard({ title, value, icon, color, sub }: {
  title: string; value: number; icon: React.ReactNode; color: string; sub?: string;
}) {
  return (
    <Card className={`border-l-4 ${color}`}>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{title}</p>
            <p className="text-xl font-bold mt-0.5">{fmtINR(value)}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className="text-muted-foreground opacity-50">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function Accordion({ title, total, badge, children, defaultOpen = false }: {
  title: string; total: number; badge: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/70 transition-colors text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          <span className="font-semibold text-sm">{title}</span>
          <Badge variant="outline" className="text-xs">{badge}</Badge>
        </div>
        <span className="font-bold text-sm">{fmtINR(total)}</span>
      </button>
      {open && <div className="px-4 py-2 divide-y text-sm">{children}</div>}
    </div>
  );
}

function DetailRow({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <span className="text-sm">{label}</span>
        {sub && <span className="ml-2 text-xs text-muted-foreground">{sub}</span>}
      </div>
      <span className="font-medium text-sm">{fmtINR(value)}</span>
    </div>
  );
}

export default function MonthlyPnlPage() {
  const printRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  // Fetch client names
  const { data: clientNames = [] } = useQuery<any[]>({
    queryKey: ['/api/clients'],
  });

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setClientDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const toggleClient = (name: string) => {
    setSelectedClients(prev =>
      prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name]
    );
  };

  const clientsParam = selectedClients.length > 0 ? `&clients=${encodeURIComponent(selectedClients.join(','))}` : '';

  const { data, isLoading, isError } = useQuery<any>({
    queryKey: ['/api/monthly-pnl', month, year, selectedClients.join(',')],
    queryFn: () => fetch(`/api/monthly-pnl?month=${month}&year=${year}${clientsParam}`, { credentials: 'include' }).then(r => r.json()),
    enabled: !!month && !!year,
  });

  const d = data || {};
  const salesTotal = d.salesTotal || 0;
  const cashSealIncome = d.cashSealIncome || 0;
  const psIncome = d.psIncome || 0;
  const tpIncome = d.tpIncome || 0;
  const legacyIncome = d.legacyIncome || 0;
  const totalIncome = salesTotal + cashSealIncome;

  const purchaseTotal = d.purchaseTotal || 0;
  const salaryTotal = d.salaryTotal || 0;
  const grossWage = d.grossWage || 0;
  const epfoTotal = d.epfoTotal || 0;
  const employeePF = d.employeePF || 0;
  const employerPF = d.employerPF || 0;
  const esicTotal = d.esicTotal || 0;
  const employeeESIC = d.employeeESIC || 0;
  const employerESIC = d.employerESIC || 0;
  const ptax = d.ptax || 0;
  const lwfTotal = d.lwfTotal || 0;
  const expenseTotal = d.expenseTotal || 0;
  const cashSealExpense = d.cashSealExpense || 0;
  const bananaExpense = d.bananaExpense || 0;
  const dahiBharExpense = d.dahiBharExpense || 0;
  const otherExpense = d.otherExpense || 0;
  const cashSealTotal = d.cashSealTotal || 0;
  const totalDailyOps = expenseTotal + cashSealExpense;
  const totalExpenses = purchaseTotal + salaryTotal + totalDailyOps + cashSealTotal;

  const netPnl = totalIncome - totalExpenses;
  const isProfit = netPnl >= 0;

  const monthLabel = `${MONTHS[month-1]} ${year}`;
  const clientLabel = selectedClients.length === 0
    ? 'All Clients'
    : selectedClients.length === 1
    ? selectedClients[0]
    : `${selectedClients.length} Clients`;

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>Monthly P&L – ${monthLabel}</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; color: #000; }
      h1 { text-align: center; font-size: 16px; margin-bottom: 4px; }
      h2 { text-align: center; font-size: 13px; color: #555; margin-bottom: 4px; }
      h3 { text-align: center; font-size: 11px; color: #888; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
      th { background: #1e293b; color: #fff; padding: 6px 8px; text-align: left; font-size: 11px; }
      td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; }
      .amount { text-align: right; font-weight: 600; }
      .total-row td { font-weight: bold; background: #f1f5f9; }
      .profit { color: #16a34a; }
      .loss { color: #dc2626; }
      .section-header { background: #e2e8f0; font-weight: bold; padding: 5px 8px; }
      @media print { body { margin: 10px; } }
    </style></head><body>${content}</body></html>`);
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-xl font-bold">Monthly P&L</h1>
              <p className="text-xs text-muted-foreground">Profit & Loss Statement</p>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            {/* Month */}
            <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
              <SelectTrigger className="w-36 h-9" data-testid="select-month">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Year */}
            <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
              <SelectTrigger className="w-24 h-9" data-testid="select-year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>

            {/* Multi-Client Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <Button
                variant="outline"
                size="sm"
                className="h-9 min-w-[150px] justify-between gap-1 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                onClick={() => setClientDropdownOpen(o => !o)}
                data-testid="button-client-select"
              >
                <span className="flex items-center gap-1.5 text-xs truncate max-w-[130px]">
                  <Building2 className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                  {clientLabel}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              </Button>

              {clientDropdownOpen && (
                <div
                  className="absolute right-0 z-50 mt-1 w-72 bg-white dark:bg-gray-900 border border-blue-100 dark:border-blue-900 rounded-xl shadow-2xl p-2 max-h-72 overflow-y-auto"
                  data-testid="dropdown-clients"
                  onClick={e => e.stopPropagation()}
                  onMouseDown={e => e.stopPropagation()}
                >
                  <div className="flex gap-2 mb-2 px-1">
                    <Button
                      size="sm" variant="outline"
                      className="h-6 text-[10px] border-blue-200 flex-1"
                      onClick={e => { e.stopPropagation(); setSelectedClients(clientNames.map((c: any) => c.name)); }}
                    >
                      Select All
                    </Button>
                    <Button
                      size="sm" variant="outline"
                      className="h-6 text-[10px] border-blue-200 flex-1"
                      onClick={e => { e.stopPropagation(); setSelectedClients([]); }}
                    >
                      Clear All
                    </Button>
                  </div>
                  {clientNames.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-3">No clients found</p>
                  )}
                  {clientNames.map((c: any) => (
                    <div
                      key={c.id}
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/30 cursor-pointer transition-colors"
                      onClick={e => { e.stopPropagation(); toggleClient(c.name); }}
                      data-testid={`checkbox-client-${c.name}`}
                    >
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center text-white text-xs transition-all flex-shrink-0 ${selectedClients.includes(c.name) ? 'bg-blue-600 border-blue-600' : 'border-gray-300 dark:border-gray-600'}`}>
                        {selectedClients.includes(c.name) && <Check className="w-3.5 h-3.5" />}
                      </div>
                      <span className="text-sm leading-tight">{c.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Active client chips */}
            {selectedClients.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selectedClients.map(c => (
                  <Badge
                    key={c}
                    variant="secondary"
                    className="text-xs gap-1 pr-1 cursor-pointer hover:bg-destructive/10"
                    onClick={() => toggleClient(c)}
                  >
                    {c.length > 20 ? c.slice(0, 18) + '…' : c}
                    <X className="w-3 h-3" />
                  </Badge>
                ))}
              </div>
            )}

            <Button size="sm" variant="outline" onClick={handlePrint} className="h-9 gap-1">
              <Printer className="w-4 h-4" /> Print
            </Button>
          </div>
        </div>

        {/* Client filter notice */}
        {selectedClients.length > 0 && (
          <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300">
            <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Filtering Sales &amp; Salary by: <strong>{selectedClients.join(', ')}</strong>. Purchase Invoices, Daily Expenses &amp; Cash Seal show all clients.</span>
            <button className="ml-auto text-blue-400 hover:text-blue-600" onClick={() => setSelectedClients([])}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {isLoading && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {isError && (
          <div className="text-center py-16 text-destructive">Failed to load P&L data. Please try again.</div>
        )}

        {!isLoading && !isError && data && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <SummaryCard
                title="Total Income"
                value={totalIncome}
                icon={<TrendingUp className="w-8 h-8" />}
                color="border-l-green-500"
                sub="Sales + Cash Seal KPF"
              />
              <SummaryCard
                title="Total Expenses"
                value={totalExpenses}
                icon={<TrendingDown className="w-8 h-8" />}
                color="border-l-red-500"
                sub="Purchase + Salary + Ops"
              />
              <Card className={`border-l-4 ${isProfit ? 'border-l-emerald-600' : 'border-l-rose-600'}`}>
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Net {isProfit ? 'Profit' : 'Loss'}</p>
                      <p className={`text-xl font-bold mt-0.5 ${isProfit ? 'text-emerald-600' : 'text-rose-600'}`}>{fmtINR(Math.abs(netPnl))}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{monthLabel}</p>
                    </div>
                    <IndianRupee className={`w-8 h-8 opacity-50 ${isProfit ? 'text-emerald-600' : 'text-rose-600'}`} />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Printable Content */}
            <div ref={printRef}>
              <div style={{ display: 'none' }}>
                <h1>DJ Hospitality &amp; Facility Management</h1>
                <h2>Monthly Profit &amp; Loss Statement — {monthLabel}</h2>
                {selectedClients.length > 0 && <h3>Clients: {selectedClients.join(', ')}</h3>}
              </div>

              {/* INCOME SECTION */}
              <Card className="mb-4">
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-base flex items-center gap-2 text-green-700 dark:text-green-400">
                    <TrendingUp className="w-4 h-4" /> Income
                    <span className="ml-auto font-bold">{fmtINR(totalIncome)}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-4 space-y-2">
                  <Accordion title="Sales Invoices" total={salesTotal} badge={`${(d.salesByClient || []).length} clients`} defaultOpen>
                    {(d.salesByClient || []).length === 0 ? (
                      <p className="text-muted-foreground py-2 text-xs">No sales invoices for this period.</p>
                    ) : (
                      (d.salesByClient || []).map((c: any, i: number) => (
                        <DetailRow key={i} label={c.clientName} value={c.total} sub={pct(c.total, salesTotal)} />
                      ))
                    )}
                    <div className="flex justify-between py-2 font-bold border-t mt-1">
                      <span>Total Sales</span>
                      <span>{fmtINR(salesTotal)}</span>
                    </div>
                  </Accordion>

                  {cashSealIncome > 0 && (
                    <Accordion title="Daily Cash Seal KPF" total={cashSealIncome} badge="Canteen" defaultOpen>
                      {psIncome > 0 && <DetailRow label="PS Income" value={psIncome} sub={pct(psIncome, cashSealIncome)} />}
                      {tpIncome > 0 && <DetailRow label="TP Income" value={tpIncome} sub={pct(tpIncome, cashSealIncome)} />}
                      {legacyIncome > 0 && <DetailRow label="Other Income" value={legacyIncome} sub={pct(legacyIncome, cashSealIncome)} />}
                      <div className="flex justify-between py-2 font-bold border-t mt-1">
                        <span>Total Income (KPF)</span>
                        <span>{fmtINR(cashSealIncome)}</span>
                      </div>
                    </Accordion>
                  )}

                  <div className="flex justify-between px-4 py-3 bg-green-50 dark:bg-green-900/20 rounded-lg font-bold text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800">
                    <span>TOTAL INCOME</span>
                    <span>{fmtINR(totalIncome)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* EXPENSES SECTION */}
              <Card className="mb-4">
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-base flex items-center gap-2 text-red-700 dark:text-red-400">
                    <TrendingDown className="w-4 h-4" /> Expenses
                    <span className="ml-auto font-bold">{fmtINR(totalExpenses)}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-4 space-y-2">
                  <Accordion title="Purchase Invoices" total={purchaseTotal} badge={`${(d.purchaseByVendor || []).length} vendors`} defaultOpen>
                    {(d.purchaseByVendor || []).length === 0 ? (
                      <p className="text-muted-foreground py-2 text-xs">No purchase invoices for this period.</p>
                    ) : (
                      (d.purchaseByVendor || []).map((v: any, i: number) => (
                        <DetailRow key={i} label={v.vendorName || 'Unknown Vendor'} value={v.total} sub={pct(v.total, purchaseTotal)} />
                      ))
                    )}
                    <div className="flex justify-between py-2 font-bold border-t mt-1">
                      <span>Total Purchases</span>
                      <span>{fmtINR(purchaseTotal)}</span>
                    </div>
                  </Accordion>

                  <Accordion title="Salary & Wages" total={salaryTotal} badge={`${(d.salaryByClient || []).length} clients`} defaultOpen>
                    {(d.salaryByClient || []).length === 0 ? (
                      <p className="text-muted-foreground py-2 text-xs">No salary records for this period.</p>
                    ) : (
                      (d.salaryByClient || []).map((c: any, i: number) => (
                        <DetailRow key={i} label={c.clientName} value={c.total} sub={pct(c.total, salaryTotal)} />
                      ))
                    )}
                    <div className="flex justify-between py-1.5 text-xs text-muted-foreground border-t mt-1 pt-2">
                      <span>Gross Wages</span><span>{fmtINR(grossWage)}</span>
                    </div>
                    {(epfoTotal > 0 || esicTotal > 0 || ptax > 0 || lwfTotal > 0) && (
                      <>
                        <div className="px-2 pt-2 pb-0.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Statutory Contributions</div>
                        {epfoTotal > 0 && (
                          <DetailRow label="EPFO (PF)" value={epfoTotal} sub={`Emp ₹${employeePF.toFixed(0)} + Empr ₹${employerPF.toFixed(0)}`} />
                        )}
                        {esicTotal > 0 && (
                          <DetailRow label="ESIC" value={esicTotal} sub={`Emp ₹${employeeESIC.toFixed(0)} + Empr ₹${employerESIC.toFixed(0)}`} />
                        )}
                        {ptax > 0 && <DetailRow label="Professional Tax (PTax)" value={ptax} />}
                        {lwfTotal > 0 && <DetailRow label="Labour Welfare Fund (LWF)" value={lwfTotal} />}
                      </>
                    )}
                    <div className="flex justify-between py-2 font-bold border-t mt-1">
                      <span>Total Net Pay</span>
                      <span>{fmtINR(salaryTotal)}</span>
                    </div>
                  </Accordion>

                  {totalDailyOps > 0 && (
                    <Accordion title="Daily Operational Expenses" total={totalDailyOps} badge="Canteen ops">
                      {expenseTotal > 0 && <DetailRow label="Expense items (vegetables, fixed)" value={expenseTotal} sub={pct(expenseTotal, totalDailyOps)} />}
                      {cashSealExpense > 0 && <>
                        <div className="px-2 pt-2 pb-0.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cash Seal KPF Expenses</div>
                        {bananaExpense > 0 && <DetailRow label="Banana" value={bananaExpense} />}
                        {dahiBharExpense > 0 && <DetailRow label="Dahi Bhar" value={dahiBharExpense} />}
                        {otherExpense > 0 && <DetailRow label="Other Expenses" value={otherExpense} />}
                        <DetailRow label="Cash Seal KPF Total Expense" value={cashSealExpense} sub={pct(cashSealExpense, totalDailyOps)} />
                      </>}
                      <div className="flex justify-between py-2 font-bold border-t mt-1">
                        <span>Total Daily Expenses</span>
                        <span>{fmtINR(totalDailyOps)}</span>
                      </div>
                    </Accordion>
                  )}

                  {cashSealTotal > 0 && (
                    <Accordion title="Cash Seal Settlement" total={cashSealTotal} badge="Canteen">
                      <DetailRow label="Total Given to Akbar Ali" value={cashSealTotal} />
                      <div className="flex justify-between py-2 font-bold border-t mt-1">
                        <span>Total Settlement</span>
                        <span>{fmtINR(cashSealTotal)}</span>
                      </div>
                    </Accordion>
                  )}

                  <div className="flex justify-between px-4 py-3 bg-red-50 dark:bg-red-900/20 rounded-lg font-bold text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800">
                    <span>TOTAL EXPENSES</span>
                    <span>{fmtINR(totalExpenses)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* NET P&L SUMMARY */}
              <Card className={`border-2 ${isProfit ? 'border-emerald-400 dark:border-emerald-600' : 'border-rose-400 dark:border-rose-600'}`}>
                <CardContent className="py-5 px-6">
                  <table className="w-full text-sm">
                    <tbody>
                      <tr className="border-b">
                        <td className="py-2 text-green-700 dark:text-green-400 font-semibold">Total Income</td>
                        <td className="py-2 text-right font-bold text-green-700 dark:text-green-400">{fmtINR(totalIncome)}</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 text-red-700 dark:text-red-400 font-semibold">Total Expenses</td>
                        <td className="py-2 text-right font-bold text-red-700 dark:text-red-400">({fmtINR(totalExpenses)})</td>
                      </tr>
                      <tr>
                        <td className={`py-3 text-lg font-bold ${isProfit ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                          Net {isProfit ? 'Profit' : 'Loss'}
                        </td>
                        <td className={`py-3 text-right text-xl font-extrabold ${isProfit ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                          {isProfit ? '+' : '-'}{fmtINR(Math.abs(netPnl))}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="mt-3 grid grid-cols-3 gap-3 pt-3 border-t text-center text-xs text-muted-foreground">
                    <div>
                      <p className="font-semibold text-sm text-foreground">{pct(purchaseTotal, totalExpenses)}</p>
                      <p>Purchase %</p>
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-foreground">{pct(salaryTotal, totalExpenses)}</p>
                      <p>Salary %</p>
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-foreground">{pct(expenseTotal + cashSealTotal, totalExpenses)}</p>
                      <p>Ops %</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {!isLoading && !isError && !data && (
          <div className="text-center py-16 text-muted-foreground">Select a month and year to view the P&L.</div>
        )}
      </div>
    </Layout>
  );
}
