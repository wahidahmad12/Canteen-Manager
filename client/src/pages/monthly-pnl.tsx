import { useState, useRef, useEffect } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, TrendingDown, IndianRupee, Printer, ChevronDown, ChevronRight, BarChart3, Building2, Check, X, CalendarDays, Calendar } from "lucide-react";

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
  const annualPrintRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"monthly" | "annual">("monthly");

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

  // Annual view — fetch all 12 months in parallel
  const annualResults = useQueries({
    queries: MONTHS.map((_, i) => ({
      queryKey: ['/api/monthly-pnl', i + 1, year, selectedClients.join(',')],
      queryFn: () => fetch(`/api/monthly-pnl?month=${i + 1}&year=${year}${clientsParam}`, { credentials: 'include' }).then(r => r.json()),
      enabled: viewMode === 'annual',
    })),
  });
  const annualLoading = annualResults.some(r => r.isLoading);

  function calcTotals(d: any) {
    const HUL_CLIENT = "Hindustan Unilever Limited";
    const showHul = selectedClients.length === 0 || selectedClients.includes(HUL_CLIENT);
    const salesTotal = Number(d?.salesTotal || 0);
    const cashSealIncome = showHul ? Number(d?.cashSealIncome || 0) : 0;
    const income = salesTotal + cashSealIncome;
    const purchaseTotal = Number(d?.purchaseTotal || 0);
    const salaryTotal = Number(d?.salaryTotal || 0);
    const epfoTotal = Number(d?.epfoTotal || 0);
    const esicTotal = Number(d?.esicTotal || 0);
    const ptax = Number(d?.ptax || 0);
    const lwfTotal = Number(d?.lwfTotal || 0);
    const bonusAmount = Number(d?.bonusAmount || 0);
    const totalSalaryCost = salaryTotal + epfoTotal + esicTotal + ptax + lwfTotal + bonusAmount;
    const expenseTotal = Number(d?.expenseTotal || 0);
    const cashSealExpense = showHul ? Number(d?.cashSealExpense || 0) : 0;
    const totalDailyOps = showHul ? (expenseTotal + cashSealExpense) : 0;
    const expenses = purchaseTotal + totalSalaryCost + totalDailyOps;
    return { income, expenses, net: income - expenses, salesTotal, purchaseTotal, totalSalaryCost, totalDailyOps };
  }

  const annualRows = annualResults.map((r, i) => ({ month: i + 1, label: MONTHS[i].slice(0, 3), ...calcTotals(r.data) }));
  const annualTotals = annualRows.reduce(
    (acc, r) => ({ income: acc.income + r.income, expenses: acc.expenses + r.expenses, net: acc.net + r.net }),
    { income: 0, expenses: 0, net: 0 }
  );

  const handleAnnualPrint = () => {
    const content = annualPrintRef.current?.innerHTML;
    if (!content) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>Annual P&L – ${year}</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; color: #000; }
      h1 { text-align: center; font-size: 16px; margin-bottom: 4px; }
      h2 { text-align: center; font-size: 13px; color: #555; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #1e293b; color: #fff; padding: 6px 8px; text-align: left; font-size: 11px; }
      td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; }
      .right { text-align: right; }
      .profit { color: #16a34a; font-weight: bold; }
      .loss { color: #dc2626; font-weight: bold; }
      .total-row td { font-weight: bold; background: #f1f5f9; font-size: 13px; }
      @media print { body { margin: 10px; } }
    </style></head><body>${content}</body></html>`);
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  const d = data || {};
  const salesTotal = d.salesTotal || 0;
  const cashSealIncome = d.cashSealIncome || 0;
  const psIncome = d.psIncome || 0;
  const tpIncome = d.tpIncome || 0;
  const legacyIncome = d.legacyIncome || 0;
  const totalIncome = salesTotal + cashSealIncome;

  const purchaseTotal = d.purchaseTotal || 0;
  const purchaseByClient: any[] = d.purchaseByClient || [];
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
  const bonusAmount = d.bonusAmount || 0;
  const statutoryTotal = epfoTotal + esicTotal + ptax + lwfTotal + bonusAmount;
  const totalSalaryCost = salaryTotal + statutoryTotal;
  const expenseTotal = d.expenseTotal || 0;
  const cashSealExpense = d.cashSealExpense || 0;
  const bananaExpense = d.bananaExpense || 0;
  const dahiBharExpense = d.dahiBharExpense || 0;
  const otherExpense = d.otherExpense || 0;
  const totalDailyOps = expenseTotal + cashSealExpense;
  const totalExpenses = purchaseTotal + totalSalaryCost + totalDailyOps;

  const HUL_CLIENT = "Hindustan Unilever Limited";
  const showHulSections = selectedClients.length === 0 || selectedClients.includes(HUL_CLIENT);

  // Exclude HUL canteen from totals when HUL is not in scope
  const effectiveCashSealIncome = showHulSections ? cashSealIncome : 0;
  const effectiveTotalDailyOps  = showHulSections ? totalDailyOps  : 0;
  const effectiveTotalIncome    = salesTotal + effectiveCashSealIncome;
  const effectiveTotalExpenses  = purchaseTotal + totalSalaryCost + effectiveTotalDailyOps;
  const netPnl = effectiveTotalIncome - effectiveTotalExpenses;
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

            {/* View mode toggle */}
            <div className="flex rounded-lg border overflow-hidden h-9">
              <button
                className={`px-3 text-xs flex items-center gap-1.5 transition-colors ${viewMode === 'monthly' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}
                onClick={() => setViewMode('monthly')}
                data-testid="button-view-monthly"
              >
                <Calendar className="w-3.5 h-3.5" /> Monthly
              </button>
              <button
                className={`px-3 text-xs flex items-center gap-1.5 border-l transition-colors ${viewMode === 'annual' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}
                onClick={() => setViewMode('annual')}
                data-testid="button-view-annual"
              >
                <CalendarDays className="w-3.5 h-3.5" /> Annual
              </button>
            </div>

            <Button size="sm" variant="outline" onClick={viewMode === 'annual' ? handleAnnualPrint : handlePrint} className="h-9 gap-1">
              <Printer className="w-4 h-4" /> Print
            </Button>
          </div>
        </div>

        {/* Client filter notice */}
        {selectedClients.length > 0 && (
          <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300">
            <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Filtering Sales, Salary &amp; Purchase Invoices by: <strong>{selectedClients.join(', ')}</strong>.{!showHulSections && " HUL Canteen sections (Cash Seal KPF & Daily Ops) are hidden for non-HUL clients."}</span>
            <button className="ml-auto text-blue-400 hover:text-blue-600" onClick={() => setSelectedClients([])}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ── ANNUAL VIEW ─────────────────────────────────────────── */}
        {viewMode === 'annual' && (
          <>
            {annualLoading && (
              <div className="flex justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            )}
            {!annualLoading && (
              <>
                {/* Annual summary cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  <SummaryCard title="Annual Income" value={annualTotals.income} icon={<TrendingUp className="w-8 h-8" />} color="border-l-green-500" sub={`Year ${year}`} />
                  <SummaryCard title="Annual Expenses" value={annualTotals.expenses} icon={<TrendingDown className="w-8 h-8" />} color="border-l-red-500" sub={`Year ${year}`} />
                  <Card className={`border-l-4 ${annualTotals.net >= 0 ? 'border-l-emerald-600' : 'border-l-rose-600'}`}>
                    <CardContent className="pt-4 pb-3 px-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Net {annualTotals.net >= 0 ? 'Profit' : 'Loss'}</p>
                          <p className={`text-xl font-bold mt-0.5 ${annualTotals.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{fmtINR(Math.abs(annualTotals.net))}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Jan – Dec {year}</p>
                        </div>
                        <IndianRupee className={`w-8 h-8 opacity-50 ${annualTotals.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`} />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Annual table */}
                <div ref={annualPrintRef}>
                  <div style={{ display: 'none' }}>
                    <h1>DJ Hospitality &amp; Facility Management</h1>
                    <h2>Annual Profit &amp; Loss Statement — {year}</h2>
                    {selectedClients.length > 0 && <h3>Clients: {selectedClients.join(', ')}</h3>}
                  </div>
                  <Card>
                    <CardHeader className="pb-2 pt-4">
                      <CardTitle className="text-base flex items-center gap-2">
                        <CalendarDays className="w-4 h-4" /> Annual P&amp;L — {year}
                        {selectedClients.length > 0 && <span className="text-xs font-normal text-muted-foreground ml-1">· {selectedClients.length} client{selectedClients.length !== 1 ? 's' : ''}</span>}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-900/50 border-b">
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Month</th>
                            <th className="px-4 py-2.5 text-right text-xs font-semibold text-green-700 dark:text-green-400">Income</th>
                            <th className="px-4 py-2.5 text-right text-xs font-semibold text-red-700 dark:text-red-400">Expenses</th>
                            <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">Net P&amp;L</th>
                          </tr>
                        </thead>
                        <tbody>
                          {annualRows.map((row) => {
                            const isP = row.net >= 0;
                            return (
                              <tr key={row.month} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                <td className="px-4 py-2.5 font-medium">{MONTHS[row.month - 1]}</td>
                                <td className="px-4 py-2.5 text-right font-mono text-sm text-green-700 dark:text-green-400">{row.income > 0 ? fmtINR(row.income) : <span className="text-muted-foreground text-xs">—</span>}</td>
                                <td className="px-4 py-2.5 text-right font-mono text-sm text-red-700 dark:text-red-400">{row.expenses > 0 ? fmtINR(row.expenses) : <span className="text-muted-foreground text-xs">—</span>}</td>
                                <td className={`px-4 py-2.5 text-right font-mono text-sm font-semibold ${isP ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                  {row.income === 0 && row.expenses === 0 ? <span className="text-muted-foreground text-xs font-normal">—</span> : `${isP ? '+' : '-'}${fmtINR(Math.abs(row.net))}`}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-100 dark:bg-slate-800/60 border-t-2 font-bold">
                            <td className="px-4 py-3 text-sm">Total {year}</td>
                            <td className="px-4 py-3 text-right font-mono text-sm text-green-700 dark:text-green-400">{fmtINR(annualTotals.income)}</td>
                            <td className="px-4 py-3 text-right font-mono text-sm text-red-700 dark:text-red-400">{fmtINR(annualTotals.expenses)}</td>
                            <td className={`px-4 py-3 text-right font-mono text-sm ${annualTotals.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                              {annualTotals.net >= 0 ? '+' : '-'}{fmtINR(Math.abs(annualTotals.net))}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </>
        )}

        {/* ── MONTHLY VIEW ────────────────────────────────────────── */}
        {viewMode === 'monthly' && isLoading && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {viewMode === 'monthly' && isError && (
          <div className="text-center py-16 text-destructive">Failed to load P&L data. Please try again.</div>
        )}

        {viewMode === 'monthly' && !isLoading && !isError && data && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <SummaryCard
                title="Total Income"
                value={effectiveTotalIncome}
                icon={<TrendingUp className="w-8 h-8" />}
                color="border-l-green-500"
                sub={showHulSections ? "Sales + Cash Seal KPF" : "Sales Only"}
              />
              <SummaryCard
                title="Total Expenses"
                value={effectiveTotalExpenses}
                icon={<TrendingDown className="w-8 h-8" />}
                color="border-l-red-500"
                sub={showHulSections ? "Purchase + Salary + Ops" : "Purchase + Salary"}
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
                    <span className="ml-auto font-bold">{fmtINR(effectiveTotalIncome)}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-4 space-y-2">
                  {(() => {
                    const apiClients: any[] = d.salesByClient || [];
                    const apiNames = new Set(apiClients.map((c: any) => c.clientName));
                    // Add selected clients that have no sales (₹0)
                    const zeroClients = selectedClients
                      .filter(name => !apiNames.has(name))
                      .map(name => ({ clientName: name, total: 0 }));
                    const displayClients = [...apiClients, ...zeroClients];
                    const badgeCount = selectedClients.length > 0 ? selectedClients.length : apiClients.length;
                    return (
                      <Accordion title="Sales Invoices" total={salesTotal} badge={`${badgeCount} client${badgeCount !== 1 ? 's' : ''}`} defaultOpen>
                        {displayClients.length === 0 ? (
                          <p className="text-muted-foreground py-2 text-xs">No sales invoices for this period.</p>
                        ) : (
                          displayClients.map((c: any, i: number) => (
                            <DetailRow key={i} label={c.clientName} value={c.total} sub={salesTotal > 0 ? pct(c.total, salesTotal) : "₹0"} />
                          ))
                        )}
                        <div className="flex justify-between py-2 font-bold border-t mt-1">
                          <span>Total Sales</span>
                          <span>{fmtINR(salesTotal)}</span>
                        </div>
                      </Accordion>
                    );
                  })()}

                  {showHulSections && cashSealIncome > 0 && (
                    <Accordion title="Daily Cash Seal KPF" total={cashSealIncome} badge="HUL Canteen" defaultOpen>
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
                    <span>{fmtINR(effectiveTotalIncome)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* EXPENSES SECTION */}
              <Card className="mb-4">
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-base flex items-center gap-2 text-red-700 dark:text-red-400">
                    <TrendingDown className="w-4 h-4" /> Expenses
                    <span className="ml-auto font-bold">{fmtINR(effectiveTotalExpenses)}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-4 space-y-2">
                  <Accordion
                    title="Purchase Invoices"
                    total={purchaseTotal}
                    badge={selectedClients.length > 0 ? `${purchaseByClient.length} clients` : `${(d.purchaseByVendor || []).length} vendors`}
                    defaultOpen
                  >
                    {(d.purchaseByVendor || []).length === 0 ? (
                      <p className="text-muted-foreground py-2 text-xs">No purchase invoices for this period.</p>
                    ) : (
                      <>
                        {/* Client breakdown (always shown) */}
                        {purchaseByClient.length > 0 && (
                          <>
                            <div className="px-2 pt-2 pb-0.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">By Client</div>
                            {purchaseByClient.map((c: any, i: number) => (
                              <DetailRow key={i} label={c.clientName || 'Unknown Client'} value={c.total} sub={pct(c.total, purchaseTotal)} />
                            ))}
                          </>
                        )}
                        {/* Vendor breakdown */}
                        <div className="px-2 pt-2 pb-0.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">By Vendor</div>
                        {(d.purchaseByVendor || []).map((v: any, i: number) => (
                          <DetailRow key={i} label={v.vendorName || 'Unknown Vendor'} value={v.total} sub={pct(v.total, purchaseTotal)} />
                        ))}
                      </>
                    )}
                    <div className="flex justify-between py-2 font-bold border-t mt-1">
                      <span>Total Purchases</span>
                      <span>{fmtINR(purchaseTotal)}</span>
                    </div>
                  </Accordion>

                  <Accordion title="Salary & Wages" total={totalSalaryCost} badge={`${(d.salaryByClient || []).length} clients`} defaultOpen>
                    {(d.salaryByClient || []).length === 0 ? (
                      <p className="text-muted-foreground py-2 text-xs">No salary records for this period.</p>
                    ) : (
                      (d.salaryByClient || []).map((c: any, i: number) => (
                        <DetailRow key={i} label={c.clientName} value={c.total} sub={pct(c.total, totalSalaryCost)} />
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
                        {bonusAmount > 0 && <DetailRow label="Bonus (8.33% of Basic)" value={bonusAmount} />}
                      </>
                    )}
                    <div className="flex justify-between py-2 font-bold border-t mt-1">
                      <span>Total Salary Cost</span>
                      <span>{fmtINR(totalSalaryCost)}</span>
                    </div>
                  </Accordion>

                  {showHulSections && totalDailyOps > 0 && (
                    <Accordion title="Daily Operational Expenses" total={totalDailyOps} badge="HUL Canteen ops">
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

                  <div className="flex justify-between px-4 py-3 bg-red-50 dark:bg-red-900/20 rounded-lg font-bold text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800">
                    <span>TOTAL EXPENSES</span>
                    <span>{fmtINR(effectiveTotalExpenses)}</span>
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
                        <td className="py-2 text-right font-bold text-green-700 dark:text-green-400">{fmtINR(effectiveTotalIncome)}</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 text-red-700 dark:text-red-400 font-semibold">Total Expenses</td>
                        <td className="py-2 text-right font-bold text-red-700 dark:text-red-400">({fmtINR(effectiveTotalExpenses)})</td>
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
                  <div className={`mt-3 grid gap-3 pt-3 border-t text-center text-xs text-muted-foreground ${showHulSections ? 'grid-cols-3' : 'grid-cols-2'}`}>
                    <div>
                      <p className="font-semibold text-sm text-foreground">{pct(purchaseTotal, effectiveTotalExpenses)}</p>
                      <p>Purchase %</p>
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-foreground">{pct(totalSalaryCost, effectiveTotalExpenses)}</p>
                      <p>Salary %</p>
                    </div>
                    {showHulSections && (
                      <div>
                        <p className="font-semibold text-sm text-foreground">{pct(effectiveTotalDailyOps, effectiveTotalExpenses)}</p>
                        <p>Ops %</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {viewMode === 'monthly' && !isLoading && !isError && !data && (
          <div className="text-center py-16 text-muted-foreground">Select a month and year to view the P&L.</div>
        )}
      </div>
    </Layout>
  );
}
