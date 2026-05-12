import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Loader2, BarChart3, Download, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "exceljs";
import { saveAs } from "file-saver";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

interface StockRow {
  itemName: string;
  uom: string;
  month: number;
  totalQty: number;
  totalAmount: number;
}

function fmt(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtQty(n: number) {
  return n % 1 === 0 ? n.toFixed(0) : n.toFixed(2);
}

export default function ItemStockReportPage() {
  const { toast } = useToast();
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedClient, setSelectedClient] = useState("all");
  const [view, setView] = useState<"qty" | "amount" | "both">("both");

  const yearOptions: number[] = [];
  for (let y = now.getFullYear() + 1; y >= 2020; y--) yearOptions.push(y);

  const { data: clients = [] } = useQuery<string[]>({
    queryKey: ["/api/purchase-invoices/item-stock-clients"],
    queryFn: () => fetch("/api/purchase-invoices/item-stock-clients", { credentials: "include" }).then(r => r.json()),
  });

  const { data: rows = [], isLoading } = useQuery<StockRow[]>({
    queryKey: ["/api/purchase-invoices/item-stock-report", selectedYear, selectedClient],
    queryFn: () => {
      const params = new URLSearchParams({ year: String(selectedYear) });
      if (selectedClient !== "all") params.set("client", selectedClient);
      return fetch(`/api/purchase-invoices/item-stock-report?${params}`, { credentials: "include" }).then(r => r.json());
    },
  });

  // Build pivot: { [itemName]: { uom, months: { [1..12]: { qty, amount } } } }
  const pivot = useMemo(() => {
    const map: Record<string, { uom: string; months: Record<number, { qty: number; amount: number }> }> = {};
    for (const r of rows) {
      if (!map[r.itemName]) map[r.itemName] = { uom: r.uom, months: {} };
      map[r.itemName].months[r.month] = { qty: r.totalQty, amount: r.totalAmount };
    }
    return map;
  }, [rows]);

  const itemNames = useMemo(() => Object.keys(pivot).sort((a, b) => a.localeCompare(b)), [pivot]);

  // Month totals (column totals)
  const monthTotals = useMemo(() => {
    const totals: Record<number, { qty: number; amount: number }> = {};
    for (let m = 1; m <= 12; m++) totals[m] = { qty: 0, amount: 0 };
    for (const item of itemNames) {
      for (let m = 1; m <= 12; m++) {
        const cell = pivot[item]?.months[m];
        if (cell) { totals[m].qty += cell.qty; totals[m].amount += cell.amount; }
      }
    }
    return totals;
  }, [pivot, itemNames]);

  // Row totals
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

  // Active months (months that have any data)
  const activeMonths = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => i + 1).filter(m =>
      itemNames.some(item => pivot[item]?.months[m])
    );
  }, [pivot, itemNames]);

  const handleExcel = async () => {
    if (!itemNames.length) return;
    const wb = new XLSX.Workbook();
    const ws = wb.addWorksheet(`Stock ${selectedYear}`);

    // Build header
    const headers = ["#", "Item Name", "UOM"];
    for (const m of activeMonths) {
      headers.push(`${MONTHS[m - 1]} Qty`);
      headers.push(`${MONTHS[m - 1]} Amount`);
    }
    headers.push("Total Qty", "Total Amount");

    ws.columns = headers.map((h, i) => ({
      header: h,
      key: `col${i}`,
      width: i <= 2 ? (i === 1 ? 32 : 10) : 13,
    }));
    const hdrRow = ws.getRow(1);
    hdrRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    hdrRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1B4F72" } };
    hdrRow.alignment = { horizontal: "center", vertical: "middle" };
    hdrRow.height = 20;

    // Data rows
    itemNames.forEach((item, idx) => {
      const vals: (string | number)[] = [idx + 1, item, pivot[item]?.uom || ""];
      for (const m of activeMonths) {
        const cell = pivot[item]?.months[m];
        vals.push(cell ? cell.qty : 0);
        vals.push(cell ? cell.amount : 0);
      }
      vals.push(rowTotals[item]?.qty || 0, rowTotals[item]?.amount || 0);
      const row = ws.addRow(vals);
      row.height = 15;
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: idx % 2 === 0 ? "FFFFFFFF" : "FFF5F8FF" } };
      row.alignment = { horizontal: "center" };
      row.getCell(2).alignment = { horizontal: "left" };
    });

    // Totals row
    const totalVals: (string | number)[] = ["", "GRAND TOTAL", ""];
    for (const m of activeMonths) { totalVals.push(monthTotals[m].qty, monthTotals[m].amount); }
    totalVals.push(grandTotal.qty, grandTotal.amount);
    const totRow = ws.addRow(totalVals);
    totRow.font = { bold: true };
    totRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1B4F72" } };
    totRow.getCell(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    totRow.getCell(2).font = { bold: true, color: { argb: "FFFFFFFF" } };
    totRow.getCell(3).font = { bold: true, color: { argb: "FFFFFFFF" } };
    totRow.eachCell(c => { c.font = { bold: true, color: { argb: "FFFFFFFF" } }; });

    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf]), `ItemStockReport_${selectedYear}${selectedClient !== "all" ? "_" + selectedClient : ""}.xlsx`);
    toast({ title: "Excel downloaded" });
  };

  const handlePrint = () => {
    const t = document.title;
    document.title = `ItemStockReport_${selectedYear}`;
    window.print();
    document.title = t;
  };

  return (
    <Layout>
      {/* Action bar */}
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
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            className="h-8 text-xs border border-slate-200 rounded-lg px-2 bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
            data-testid="select-year"
          >
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {/* Client */}
          <select
            value={selectedClient}
            onChange={e => setSelectedClient(e.target.value)}
            className="h-8 text-xs border border-slate-200 rounded-lg px-2 bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
            data-testid="select-client"
          >
            <option value="all">All Clients</option>
            {clients.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {/* View toggle */}
          <div className="flex border border-slate-200 dark:border-slate-600 rounded-lg overflow-hidden text-xs">
            {(["qty","amount","both"] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-2.5 py-1.5 font-medium transition-colors ${view === v ? "bg-teal-600 text-white" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"}`}
                data-testid={`btn-view-${v}`}
              >
                {v === "qty" ? "Qty Only" : v === "amount" ? "Amount Only" : "Both"}
              </button>
            ))}
          </div>
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs print:hidden" onClick={handleExcel} disabled={!itemNames.length} data-testid="btn-excel">
            <Download className="w-3.5 h-3.5" /> Excel
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs print:hidden" onClick={handlePrint} disabled={!itemNames.length} data-testid="btn-print">
            <Printer className="w-3.5 h-3.5" /> Print
          </Button>
        </div>
      </div>

      {/* Report */}
      <div className="px-2 py-4 print:px-0 print:py-0" id="item-stock-report">
        {/* Print header */}
        <div className="hidden print:block text-center mb-3">
          <div className="text-base font-bold">DJ Hospitality &amp; Facility Management Pvt Ltd</div>
          <div className="text-sm font-semibold">Item-wise Monthly Purchase Stock Report — {selectedYear}</div>
          {selectedClient !== "all" && <div className="text-xs">Client: {selectedClient}</div>}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin mr-3" />
            <span>Loading report…</span>
          </div>
        ) : itemNames.length === 0 ? (
          <div className="text-center py-24 text-slate-400">
            <BarChart3 className="w-14 h-14 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium text-slate-500">No purchase data found</p>
            <p className="text-sm mt-1">for {selectedYear}{selectedClient !== "all" ? ` · ${selectedClient}` : ""}</p>
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

            {/* Pivot table */}
            <div className="overflow-x-auto rounded-xl shadow-md border border-slate-200 dark:border-slate-700">
              <table className="w-full border-collapse text-xs min-w-[800px]">
                <thead>
                  {/* Month header row */}
                  <tr className="bg-slate-800 text-white">
                    <th className="border border-slate-600 px-2 py-2 text-center font-semibold w-8">#</th>
                    <th className="border border-slate-600 px-3 py-2 text-left font-semibold min-w-[180px]">Item Name</th>
                    <th className="border border-slate-600 px-2 py-2 text-center font-semibold w-12">UOM</th>
                    {activeMonths.map(m => (
                      <th
                        key={m}
                        colSpan={view === "both" ? 2 : 1}
                        className="border border-slate-600 px-2 py-2 text-center font-semibold"
                      >
                        {MONTHS[m - 1]}
                      </th>
                    ))}
                    <th
                      colSpan={view === "both" ? 2 : 1}
                      className="border border-slate-500 px-2 py-2 text-center font-semibold bg-slate-700"
                    >
                      Total
                    </th>
                  </tr>
                  {/* Sub-header row for Qty / Amount */}
                  {view === "both" && (
                    <tr className="bg-slate-700 text-slate-200 text-[10px]">
                      <th className="border border-slate-600 px-1 py-1"></th>
                      <th className="border border-slate-600 px-1 py-1"></th>
                      <th className="border border-slate-600 px-1 py-1"></th>
                      {activeMonths.map(m => (
                        <>
                          <th key={`${m}-q`} className="border border-slate-600 px-1 py-1 text-center font-medium text-blue-200">Qty</th>
                          <th key={`${m}-a`} className="border border-slate-600 px-1 py-1 text-center font-medium text-green-200">Amt ₹</th>
                        </>
                      ))}
                      <th className="border border-slate-600 px-1 py-1 text-center font-medium text-blue-200">Qty</th>
                      <th className="border border-slate-600 px-1 py-1 text-center font-medium text-green-200">Amt ₹</th>
                    </tr>
                  )}
                  {view === "qty" && (
                    <tr className="bg-slate-700 text-slate-200 text-[10px]">
                      <th className="border border-slate-600 px-1 py-1"></th>
                      <th className="border border-slate-600 px-1 py-1"></th>
                      <th className="border border-slate-600 px-1 py-1"></th>
                      {activeMonths.map(m => (
                        <th key={m} className="border border-slate-600 px-1 py-1 text-center font-medium text-blue-200">Qty</th>
                      ))}
                      <th className="border border-slate-600 px-1 py-1 text-center font-medium text-blue-200">Total Qty</th>
                    </tr>
                  )}
                  {view === "amount" && (
                    <tr className="bg-slate-700 text-slate-200 text-[10px]">
                      <th className="border border-slate-600 px-1 py-1"></th>
                      <th className="border border-slate-600 px-1 py-1"></th>
                      <th className="border border-slate-600 px-1 py-1"></th>
                      {activeMonths.map(m => (
                        <th key={m} className="border border-slate-600 px-1 py-1 text-center font-medium text-green-200">Amount ₹</th>
                      ))}
                      <th className="border border-slate-600 px-1 py-1 text-center font-medium text-green-200">Total Amt ₹</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {itemNames.map((item, idx) => {
                    const info = pivot[item];
                    const rt = rowTotals[item];
                    return (
                      <tr
                        key={item}
                        className={`border-b border-slate-100 dark:border-slate-800 hover:bg-teal-50/40 dark:hover:bg-teal-950/20 transition-colors ${idx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/60 dark:bg-slate-800/40"}`}
                        data-testid={`row-item-${idx}`}
                      >
                        <td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center text-slate-400">{idx + 1}</td>
                        <td className="border border-slate-200 dark:border-slate-700 px-3 py-1.5 font-medium text-slate-800 dark:text-slate-200">{item}</td>
                        <td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center text-slate-500 dark:text-slate-400">{info?.uom || ""}</td>
                        {activeMonths.map(m => {
                          const cell = info?.months[m];
                          if (view === "both") return (
                            <>
                              <td key={`${m}-q`} className={`border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center font-mono ${cell ? "text-blue-700 dark:text-blue-400 font-semibold" : "text-slate-300 dark:text-slate-600"}`}>
                                {cell ? fmtQty(cell.qty) : "—"}
                              </td>
                              <td key={`${m}-a`} className={`border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center font-mono ${cell ? "text-emerald-700 dark:text-emerald-400" : "text-slate-300 dark:text-slate-600"}`}>
                                {cell ? fmt(cell.amount) : "—"}
                              </td>
                            </>
                          );
                          if (view === "qty") return (
                            <td key={m} className={`border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center font-mono ${cell ? "text-blue-700 dark:text-blue-400 font-semibold" : "text-slate-300 dark:text-slate-600"}`}>
                              {cell ? fmtQty(cell.qty) : "—"}
                            </td>
                          );
                          return (
                            <td key={m} className={`border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center font-mono ${cell ? "text-emerald-700 dark:text-emerald-400" : "text-slate-300 dark:text-slate-600"}`}>
                              {cell ? fmt(cell.amount) : "—"}
                            </td>
                          );
                        })}
                        {/* Row total */}
                        {view === "both" ? (
                          <>
                            <td className="border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-center font-mono font-bold text-blue-800 dark:text-blue-300 bg-blue-50/60 dark:bg-blue-950/20">
                              {rt ? fmtQty(rt.qty) : "—"}
                            </td>
                            <td className="border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-center font-mono font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/20">
                              {rt ? fmt(rt.amount) : "—"}
                            </td>
                          </>
                        ) : view === "qty" ? (
                          <td className="border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-center font-mono font-bold text-blue-800 dark:text-blue-300 bg-blue-50/60 dark:bg-blue-950/20">
                            {rt ? fmtQty(rt.qty) : "—"}
                          </td>
                        ) : (
                          <td className="border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-center font-mono font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/20">
                            {rt ? fmt(rt.amount) : "—"}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                {/* Grand total footer */}
                <tfoot>
                  <tr className="bg-slate-800 text-white font-bold">
                    <td className="border border-slate-600 px-2 py-2 text-center"></td>
                    <td className="border border-slate-600 px-3 py-2 text-left text-sm">GRAND TOTAL</td>
                    <td className="border border-slate-600 px-2 py-2"></td>
                    {activeMonths.map(m => {
                      const mt = monthTotals[m];
                      if (view === "both") return (
                        <>
                          <td key={`${m}-q`} className="border border-slate-600 px-2 py-2 text-center font-mono text-blue-200">{fmtQty(mt.qty)}</td>
                          <td key={`${m}-a`} className="border border-slate-600 px-2 py-2 text-center font-mono text-green-200">{fmt(mt.amount)}</td>
                        </>
                      );
                      if (view === "qty") return (
                        <td key={m} className="border border-slate-600 px-2 py-2 text-center font-mono text-blue-200">{fmtQty(mt.qty)}</td>
                      );
                      return (
                        <td key={m} className="border border-slate-600 px-2 py-2 text-center font-mono text-green-200">{fmt(mt.amount)}</td>
                      );
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

            <p className="text-xs text-slate-400 mt-2 print:hidden">
              {itemNames.length} items · {activeMonths.length} month{activeMonths.length !== 1 ? "s" : ""} with data · Year {selectedYear}
              {selectedClient !== "all" ? ` · ${selectedClient}` : ""}
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
