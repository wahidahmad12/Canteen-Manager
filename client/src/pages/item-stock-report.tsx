import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Loader2, BarChart3, Download, Printer, ShoppingCart, BookOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "exceljs";
import { saveAs } from "file-saver";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const CAT_LABELS: Record<string, string> = { vegetable: "Vegetable", fixed: "Fixed Item", other: "Other", kpf: "Cash Seal KPF" };
const CAT_COLORS: Record<string, string> = {
  vegetable: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  fixed:     "bg-blue-100  text-blue-800  dark:bg-blue-900/40  dark:text-blue-300",
  other:     "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  kpf:       "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
};

interface StockRow     { itemName: string; uom: string; month: number; totalQty: number; totalAmount: number; }
interface ExpenseRow   { itemName: string; uom: string; category: string; month: number; totalQty: number; totalAmount: number; }

function fmt(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtQty(n: number) {
  return n % 1 === 0 ? n.toFixed(0) : n.toFixed(2);
}

// ─── Shared pivot + stats helpers ─────────────────────────────────────────────
function buildPivot<T extends { itemName: string; uom: string; month: number; totalQty: number; totalAmount: number; }>(
  rows: T[],
  extraKey?: (r: T) => string
) {
  const map: Record<string, { uom: string; extra: string; months: Record<number, { qty: number; amount: number }> }> = {};
  for (const r of rows) {
    const key = r.itemName;
    if (!map[key]) map[key] = { uom: r.uom, extra: extraKey ? extraKey(r) : "", months: {} };
    if (!map[key].months[r.month]) map[key].months[r.month] = { qty: 0, amount: 0 };
    map[key].months[r.month].qty    += r.totalQty;
    map[key].months[r.month].amount += r.totalAmount;
  }
  return map;
}

// ─── Reusable pivot table ─────────────────────────────────────────────────────
function PivotTable({
  pivot, itemNames, activeMonths, monthTotals, rowTotals, grandTotal, view, extraCol,
}: {
  pivot: Record<string, { uom: string; extra: string; months: Record<number, { qty: number; amount: number }> }>;
  itemNames: string[];
  activeMonths: number[];
  monthTotals: Record<number, { qty: number; amount: number }>;
  rowTotals: Record<string, { qty: number; amount: number }>;
  grandTotal: { qty: number; amount: number };
  view: "qty" | "amount" | "both";
  extraCol?: { header: string; render: (extra: string) => React.ReactNode };
}) {
  const colSpan = view === "both" ? 2 : 1;
  return (
    <div className="overflow-x-auto rounded-xl shadow-md border border-slate-200 dark:border-slate-700">
      <table className="w-full border-collapse text-xs min-w-[800px]">
        <thead>
          <tr className="bg-slate-800 text-white">
            <th className="border border-slate-600 px-2 py-2 text-center w-8">#</th>
            <th className="border border-slate-600 px-3 py-2 text-left min-w-[160px]">Item Name</th>
            {extraCol && <th className="border border-slate-600 px-2 py-2 text-center w-20">{extraCol.header}</th>}
            <th className="border border-slate-600 px-2 py-2 text-center w-12">UOM</th>
            {activeMonths.map(m => (
              <th key={m} colSpan={colSpan} className="border border-slate-600 px-2 py-2 text-center">{MONTHS[m-1]}</th>
            ))}
            <th colSpan={colSpan} className="border border-slate-500 px-2 py-2 text-center bg-slate-700">Total</th>
          </tr>
          {view === "both" && (
            <tr className="bg-slate-700 text-slate-200 text-[10px]">
              <th className="border border-slate-600" /><th className="border border-slate-600" />
              {extraCol && <th className="border border-slate-600" />}
              <th className="border border-slate-600" />
              {activeMonths.map(m => (
                <>
                  <th key={`${m}-q`} className="border border-slate-600 px-1 py-1 text-center text-blue-200">Qty</th>
                  <th key={`${m}-a`} className="border border-slate-600 px-1 py-1 text-center text-green-200">Amt ₹</th>
                </>
              ))}
              <th className="border border-slate-600 px-1 py-1 text-center text-blue-200">Qty</th>
              <th className="border border-slate-600 px-1 py-1 text-center text-green-200">Amt ₹</th>
            </tr>
          )}
          {view === "qty" && (
            <tr className="bg-slate-700 text-slate-200 text-[10px]">
              <th className="border border-slate-600" /><th className="border border-slate-600" />
              {extraCol && <th className="border border-slate-600" />}
              <th className="border border-slate-600" />
              {activeMonths.map(m => <th key={m} className="border border-slate-600 px-1 py-1 text-center text-blue-200">Qty</th>)}
              <th className="border border-slate-600 px-1 py-1 text-center text-blue-200">Total Qty</th>
            </tr>
          )}
          {view === "amount" && (
            <tr className="bg-slate-700 text-slate-200 text-[10px]">
              <th className="border border-slate-600" /><th className="border border-slate-600" />
              {extraCol && <th className="border border-slate-600" />}
              <th className="border border-slate-600" />
              {activeMonths.map(m => <th key={m} className="border border-slate-600 px-1 py-1 text-center text-green-200">Amt ₹</th>)}
              <th className="border border-slate-600 px-1 py-1 text-center text-green-200">Total Amt ₹</th>
            </tr>
          )}
        </thead>
        <tbody>
          {itemNames.map((item, idx) => {
            const info = pivot[item];
            const rt   = rowTotals[item];
            return (
              <tr key={item} className={`border-b border-slate-100 dark:border-slate-800 hover:bg-teal-50/40 dark:hover:bg-teal-950/20 transition-colors ${idx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/60 dark:bg-slate-800/40"}`} data-testid={`row-item-${idx}`}>
                <td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center text-slate-400">{idx + 1}</td>
                <td className="border border-slate-200 dark:border-slate-700 px-3 py-1.5 font-medium text-slate-800 dark:text-slate-200">{item}</td>
                {extraCol && <td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center">{extraCol.render(info?.extra || "")}</td>}
                <td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center text-slate-500 dark:text-slate-400">{info?.uom || ""}</td>
                {activeMonths.map(m => {
                  const cell = info?.months[m];
                  if (view === "both") return (
                    <>
                      <td key={`${m}-q`} className={`border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center font-mono ${cell ? "text-blue-700 dark:text-blue-400 font-semibold" : "text-slate-300 dark:text-slate-600"}`}>{cell ? fmtQty(cell.qty) : "—"}</td>
                      <td key={`${m}-a`} className={`border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center font-mono ${cell ? "text-emerald-700 dark:text-emerald-400" : "text-slate-300 dark:text-slate-600"}`}>{cell ? fmt(cell.amount) : "—"}</td>
                    </>
                  );
                  if (view === "qty") return (
                    <td key={m} className={`border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center font-mono ${cell ? "text-blue-700 dark:text-blue-400 font-semibold" : "text-slate-300 dark:text-slate-600"}`}>{cell ? fmtQty(cell.qty) : "—"}</td>
                  );
                  return (
                    <td key={m} className={`border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center font-mono ${cell ? "text-emerald-700 dark:text-emerald-400" : "text-slate-300 dark:text-slate-600"}`}>{cell ? fmt(cell.amount) : "—"}</td>
                  );
                })}
                {view === "both" ? (
                  <>
                    <td className="border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-center font-mono font-bold text-blue-800 dark:text-blue-300 bg-blue-50/60 dark:bg-blue-950/20">{rt ? fmtQty(rt.qty) : "—"}</td>
                    <td className="border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-center font-mono font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/20">{rt ? fmt(rt.amount) : "—"}</td>
                  </>
                ) : view === "qty" ? (
                  <td className="border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-center font-mono font-bold text-blue-800 dark:text-blue-300 bg-blue-50/60 dark:bg-blue-950/20">{rt ? fmtQty(rt.qty) : "—"}</td>
                ) : (
                  <td className="border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-center font-mono font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/20">{rt ? fmt(rt.amount) : "—"}</td>
                )}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-slate-800 text-white font-bold">
            <td className="border border-slate-600 px-2 py-2" />
            <td className="border border-slate-600 px-3 py-2 text-sm" colSpan={extraCol ? 2 : 1}>GRAND TOTAL</td>
            <td className="border border-slate-600 px-2 py-2" />
            {activeMonths.map(m => {
              const mt = monthTotals[m];
              if (view === "both") return (
                <>
                  <td key={`${m}-q`} className="border border-slate-600 px-2 py-2 text-center font-mono text-blue-200">{fmtQty(mt.qty)}</td>
                  <td key={`${m}-a`} className="border border-slate-600 px-2 py-2 text-center font-mono text-green-200">{fmt(mt.amount)}</td>
                </>
              );
              if (view === "qty") return <td key={m} className="border border-slate-600 px-2 py-2 text-center font-mono text-blue-200">{fmtQty(mt.qty)}</td>;
              return <td key={m} className="border border-slate-600 px-2 py-2 text-center font-mono text-green-200">{fmt(mt.amount)}</td>;
            })}
            {view === "both" ? (
              <>
                <td className="border border-slate-500 px-2 py-2 text-center font-mono text-blue-100 text-sm">{fmtQty(grandTotal.qty)}</td>
                <td className="border border-slate-500 px-2 py-2 text-center font-mono text-green-100 text-sm">{fmt(grandTotal.amount)}</td>
              </>
            ) : view === "qty" ? (
              <td className="border border-slate-500 px-2 py-2 text-center font-mono text-blue-100 text-sm">{fmtQty(grandTotal.qty)}</td>
            ) : (
              <td className="border border-slate-500 px-2 py-2 text-center font-mono text-green-100 text-sm">{fmt(grandTotal.amount)}</td>
            )}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ItemStockReportPage() {
  const { toast } = useToast();
  const now = new Date();

  const [purchaseYear,   setPurchaseYear]   = useState(now.getFullYear());
  const [expenseYear,    setExpenseYear]    = useState(now.getFullYear());
  const [selectedClient, setSelectedClient] = useState("all");
  const [expCategory,    setExpCategory]    = useState("all");
  const [view,           setView]           = useState<"qty"|"amount"|"both">("both");
  const [source,         setSource]         = useState<"purchase"|"expense">("purchase");

  const selectedYear = source === "purchase" ? purchaseYear : expenseYear;
  const setSelectedYear = source === "purchase" ? setPurchaseYear : setExpenseYear;

  // ── Available years (from DB) ──────────────────────────────────────────────
  const { data: purchaseYears = [] } = useQuery<number[]>({
    queryKey: ["/api/purchase-invoices/item-stock-years"],
    queryFn: () => fetch("/api/purchase-invoices/item-stock-years", { credentials: "include" }).then(r => r.json()),
  });

  const { data: expenseYears = [] } = useQuery<number[]>({
    queryKey: ["/api/expense-items/stock-years"],
    queryFn: () => fetch("/api/expense-items/stock-years", { credentials: "include" }).then(r => r.json()),
  });

  // Auto-set year to the latest year with actual data
  useEffect(() => { if (purchaseYears.length > 0) setPurchaseYear(purchaseYears[0]); }, [purchaseYears]);
  useEffect(() => { if (expenseYears.length  > 0) setExpenseYear(expenseYears[0]);   }, [expenseYears]);

  const yearOptions = source === "purchase"
    ? (purchaseYears.length > 0 ? purchaseYears : [now.getFullYear()])
    : (expenseYears.length  > 0 ? expenseYears  : [now.getFullYear()]);

  // ── Purchase data ──────────────────────────────────────────────────────────
  const { data: clients = [] } = useQuery<string[]>({
    queryKey: ["/api/purchase-invoices/item-stock-clients"],
    queryFn: () => fetch("/api/purchase-invoices/item-stock-clients", { credentials: "include" }).then(r => r.json()),
  });

  const { data: purchaseRows = [], isLoading: purchaseLoading } = useQuery<StockRow[]>({
    queryKey: ["/api/purchase-invoices/item-stock-report", purchaseYear, selectedClient],
    enabled: source === "purchase",
    queryFn: () => {
      const params = new URLSearchParams({ year: String(purchaseYear) });
      if (selectedClient !== "all") params.set("client", selectedClient);
      return fetch(`/api/purchase-invoices/item-stock-report?${params}`, { credentials: "include" }).then(r => r.json());
    },
  });

  // ── Expense data ───────────────────────────────────────────────────────────
  const { data: expenseRows = [], isLoading: expenseLoading } = useQuery<ExpenseRow[]>({
    queryKey: ["/api/expense-items/stock-report", expenseYear, expCategory],
    enabled: source === "expense",
    queryFn: () => {
      const params = new URLSearchParams({ year: String(expenseYear) });
      if (expCategory !== "all") params.set("category", expCategory);
      return fetch(`/api/expense-items/stock-report?${params}`, { credentials: "include" }).then(r => r.json());
    },
  });

  const isLoading = source === "purchase" ? purchaseLoading : expenseLoading;

  // ── Pivot computations ─────────────────────────────────────────────────────
  const pivot = useMemo(() => {
    if (source === "purchase") return buildPivot(purchaseRows);
    return buildPivot(expenseRows, r => (r as ExpenseRow).category);
  }, [source, purchaseRows, expenseRows]);

  const itemNames = useMemo(() => Object.keys(pivot).sort((a, b) => a.localeCompare(b)), [pivot]);

  const activeMonths = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => i + 1).filter(m => itemNames.some(item => pivot[item]?.months[m]))
  , [pivot, itemNames]);

  const monthTotals = useMemo(() => {
    const t: Record<number, { qty: number; amount: number }> = {};
    for (let m = 1; m <= 12; m++) t[m] = { qty: 0, amount: 0 };
    for (const item of itemNames) for (let m = 1; m <= 12; m++) {
      const cell = pivot[item]?.months[m];
      if (cell) { t[m].qty += cell.qty; t[m].amount += cell.amount; }
    }
    return t;
  }, [pivot, itemNames]);

  const rowTotals = useMemo(() => {
    const t: Record<string, { qty: number; amount: number }> = {};
    for (const item of itemNames) {
      t[item] = { qty: 0, amount: 0 };
      for (let m = 1; m <= 12; m++) {
        const cell = pivot[item]?.months[m];
        if (cell) { t[item].qty += cell.qty; t[item].amount += cell.amount; }
      }
    }
    return t;
  }, [pivot, itemNames]);

  const grandTotal = useMemo(() => {
    let qty = 0, amount = 0;
    for (const v of Object.values(monthTotals)) { qty += v.qty; amount += v.amount; }
    return { qty, amount };
  }, [monthTotals]);

  // ── Excel export ───────────────────────────────────────────────────────────
  const handleExcel = async () => {
    if (!itemNames.length) return;
    const wb = new XLSX.Workbook();
    const ws = wb.addWorksheet(`Stock ${selectedYear}`);
    const hasCat = source === "expense";
    const headers = ["#", "Item Name", ...(hasCat ? ["Category"] : []), "UOM"];
    for (const m of activeMonths) { headers.push(`${MONTHS[m-1]} Qty`, `${MONTHS[m-1]} Amt ₹`); }
    headers.push("Total Qty", "Total Amt ₹");
    ws.columns = headers.map((h, i) => ({ header: h, key: `c${i}`, width: i === 1 ? 32 : i <= 3 ? 10 : 13 }));
    const hdr = ws.getRow(1);
    hdr.font = { bold: true, color: { argb: "FFFFFFFF" } };
    hdr.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1B4F72" } };
    hdr.alignment = { horizontal: "center", vertical: "middle" };
    hdr.height = 20;
    itemNames.forEach((item, idx) => {
      const info = pivot[item];
      const rt   = rowTotals[item];
      const vals: (string|number)[] = [idx+1, item, ...(hasCat ? [CAT_LABELS[info?.extra] || info?.extra || ""] : []), info?.uom || ""];
      for (const m of activeMonths) { const c = info?.months[m]; vals.push(c ? c.qty : 0, c ? c.amount : 0); }
      vals.push(rt?.qty || 0, rt?.amount || 0);
      const row = ws.addRow(vals);
      row.height = 15;
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: idx % 2 === 0 ? "FFFFFFFF" : "FFF5F8FF" } };
      row.alignment = { horizontal: "center" };
      row.getCell(2).alignment = { horizontal: "left" };
    });
    const totalVals: (string|number)[] = ["", "GRAND TOTAL", ...(hasCat ? [""] : []), ""];
    for (const m of activeMonths) { totalVals.push(monthTotals[m].qty, monthTotals[m].amount); }
    totalVals.push(grandTotal.qty, grandTotal.amount);
    const totRow = ws.addRow(totalVals);
    totRow.eachCell(c => { c.font = { bold: true, color: { argb: "FFFFFFFF" } }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1B4F72" } }; });
    const buf = await wb.xlsx.writeBuffer();
    const suffix = source === "purchase"
      ? `_Purchase${selectedClient !== "all" ? "_" + selectedClient : ""}`
      : `_DailyExpense${expCategory !== "all" ? "_" + expCategory : ""}`;
    saveAs(new Blob([buf]), `ItemStockReport_${selectedYear}${suffix}.xlsx`);
    toast({ title: "Excel downloaded" });
  };

  const handlePrint = () => {
    const t = document.title;
    document.title = `ItemStockReport_${selectedYear}`;
    window.print();
    document.title = t;
  };

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <Layout>
      {/* ── Action bar ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b print:hidden bg-white dark:bg-slate-800 sticky top-0 z-10 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-800 dark:text-slate-100">Item-wise Stock Report</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Monthly purchase qty &amp; amount per item</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Year */}
          <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
            className="h-8 text-xs border border-slate-200 rounded-lg px-2 bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200" data-testid="select-year">
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          {/* Source-specific filters */}
          {source === "purchase" && (
            <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)}
              className="h-8 text-xs border border-slate-200 rounded-lg px-2 bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200" data-testid="select-client">
              <option value="all">All Clients</option>
              {clients.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          {source === "expense" && (
            <select value={expCategory} onChange={e => setExpCategory(e.target.value)}
              className="h-8 text-xs border border-slate-200 rounded-lg px-2 bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200" data-testid="select-category">
              <option value="all">All Categories</option>
              <option value="vegetable">Vegetable</option>
              <option value="fixed">Fixed Item</option>
              <option value="other">Other</option>
              <option value="kpf">Cash Seal KPF (Banana)</option>
            </select>
          )}

          {/* View toggle */}
          <div className="flex border border-slate-200 dark:border-slate-600 rounded-lg overflow-hidden text-xs">
            {(["qty","amount","both"] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-2.5 py-1.5 font-medium transition-colors ${view === v ? "bg-teal-600 text-white" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"}`}
                data-testid={`btn-view-${v}`}>
                {v === "qty" ? "Qty" : v === "amount" ? "Amount" : "Both"}
              </button>
            ))}
          </div>

          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={handleExcel} disabled={!itemNames.length} data-testid="btn-excel">
            <Download className="w-3.5 h-3.5" /> Excel
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={handlePrint} disabled={!itemNames.length} data-testid="btn-print">
            <Printer className="w-3.5 h-3.5" /> Print
          </Button>
        </div>
      </div>

      {/* ── Source tabs ── */}
      <div className="flex border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 print:hidden">
        {([
          { key: "purchase", label: "Purchase Invoices", icon: ShoppingCart, color: "text-teal-600 border-teal-600" },
          { key: "expense",  label: "Daily Cash Expenses", icon: BookOpen,    color: "text-orange-600 border-orange-500" },
        ] as const).map(tab => (
          <button key={tab.key} onClick={() => setSource(tab.key)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${source === tab.key ? tab.color : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"}`}
            data-testid={`tab-${tab.key}`}>
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Report body ── */}
      <div className="px-2 py-4 print:px-0 print:py-0">
        {/* Print header */}
        <div className="hidden print:block text-center mb-3">
          <div className="text-base font-bold">DJ Hospitality &amp; Facility Management Pvt Ltd</div>
          <div className="text-sm font-semibold">
            {source === "purchase" ? "Item-wise Monthly Purchase Stock Report" : "Item-wise Monthly Daily Expense Report"} — {selectedYear}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin mr-3" />
            <span>Loading report…</span>
          </div>
        ) : itemNames.length === 0 ? (
          <div className="text-center py-24 text-slate-400">
            <BarChart3 className="w-14 h-14 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium text-slate-500">No data found</p>
            <p className="text-sm mt-1">for {selectedYear}
              {source === "purchase" && selectedClient !== "all" ? ` · ${selectedClient}` : ""}
              {source === "expense"  && expCategory  !== "all" ? ` · ${CAT_LABELS[expCategory]}` : ""}
            </p>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3 mb-4 print:hidden">
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 p-3 text-center">
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wide mb-1">Total Items</p>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{itemNames.length}</p>
              </div>
              <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 p-3 text-center">
                <p className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold uppercase tracking-wide mb-1">Total Qty</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{fmtQty(grandTotal.qty)}</p>
              </div>
              <div className="rounded-xl bg-purple-50 dark:bg-purple-950/30 p-3 text-center">
                <p className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold uppercase tracking-wide mb-1">Total Amount</p>
                <p className="text-xl font-bold text-purple-700 dark:text-purple-300">₹{fmt(grandTotal.amount)}</p>
              </div>
            </div>

            {/* Category chips (expense mode only, "all" selected) */}
            {source === "expense" && expCategory === "all" && (() => {
              const cats = [...new Set(expenseRows.map(r => r.category))].filter(Boolean);
              return cats.length > 0 ? (
                <div className="flex flex-wrap gap-2 mb-3 print:hidden">
                  {cats.map(cat => (
                    <span key={cat} className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${CAT_COLORS[cat] || "bg-slate-100 text-slate-700"}`}>
                      {CAT_LABELS[cat] || cat}
                    </span>
                  ))}
                </div>
              ) : null;
            })()}

            <PivotTable
              pivot={pivot}
              itemNames={itemNames}
              activeMonths={activeMonths}
              monthTotals={monthTotals}
              rowTotals={rowTotals}
              grandTotal={grandTotal}
              view={view}
              extraCol={source === "expense" ? {
                header: "Category",
                render: (extra) => (
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${CAT_COLORS[extra] || "bg-slate-100 text-slate-600"}`}>
                    {CAT_LABELS[extra] || extra}
                  </span>
                ),
              } : undefined}
            />

            <p className="text-xs text-slate-400 mt-2 print:hidden">
              {itemNames.length} items · {activeMonths.length} month{activeMonths.length !== 1 ? "s" : ""} with data · {selectedYear}
              {source === "purchase" && selectedClient !== "all" ? ` · ${selectedClient}` : ""}
              {source === "expense"  && expCategory  !== "all" ? ` · ${CAT_LABELS[expCategory]}` : ""}
            </p>
          </>
        )}
      </div>

      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          body { font-size: 9px; }
          @page { margin: 0.7cm; size: landscape; }
        }
      `}</style>
    </Layout>
  );
}
