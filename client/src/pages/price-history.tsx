import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, History, Search, TrendingUp, TrendingDown, Minus, X, Download, IndianRupee, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "exceljs";
import { saveAs } from "file-saver";

interface PriceHistoryRow {
  id: number;
  date: string;
  djInvoiceNo: string | null;
  vendorName: string;
  clientName: string;
  itemName: string;
  uom: string;
  qty: number;
  unitPrice: number;
  gstRate: number;
  totalPrice: number;
}

function fmtDate(d: string) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtNum(n: number, decimals = 2) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export default function PriceHistoryPage() {
  const { toast } = useToast();

  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: itemMasterList = [] } = useQuery<{ id: number; itemName: string }[]>({
    queryKey: ["/api/item-master"],
    queryFn: () => fetch("/api/item-master", { credentials: "include" }).then(r => r.json()),
  });

  const suggestions = useMemo(() => {
    if (!searchInput.trim() || searchInput.length < 2) return [];
    const q = searchInput.toLowerCase();
    return itemMasterList.filter(i => i.itemName.toLowerCase().includes(q)).slice(0, 8);
  }, [itemMasterList, searchInput]);

  const { data: rows = [], isLoading, isFetching } = useQuery<PriceHistoryRow[]>({
    queryKey: ["/api/purchase-invoices/price-history", appliedSearch, fromDate, toDate],
    queryFn: () => {
      if (!appliedSearch.trim()) return Promise.resolve([]);
      const params = new URLSearchParams({ item: appliedSearch });
      if (fromDate) params.set("from", fromDate);
      if (toDate)   params.set("to",   toDate);
      return fetch(`/api/purchase-invoices/price-history?${params}`, { credentials: "include" }).then(r => r.json());
    },
    enabled: !!appliedSearch.trim(),
  });

  const vendors = useMemo(() => ["all", ...Array.from(new Set(rows.map(r => r.vendorName))).sort()], [rows]);
  const clients = useMemo(() => ["all", ...Array.from(new Set(rows.map(r => r.clientName))).sort()], [rows]);

  const filtered = useMemo(() => rows.filter(r =>
    (vendorFilter === "all" || r.vendorName === vendorFilter) &&
    (clientFilter === "all" || r.clientName === clientFilter)
  ), [rows, vendorFilter, clientFilter]);

  const stats = useMemo(() => {
    if (!filtered.length) return null;
    const prices = filtered.map(r => r.unitPrice).filter(p => p > 0);
    if (!prices.length) return null;
    return {
      count: filtered.length,
      latest: filtered[0].unitPrice,
      latestDate: filtered[0].date,
      min: Math.min(...prices),
      max: Math.max(...prices),
      avg: prices.reduce((a, b) => a + b, 0) / prices.length,
    };
  }, [filtered]);

  const handleSearch = () => {
    if (!searchInput.trim()) return;
    setAppliedSearch(searchInput.trim());
    setVendorFilter("all");
    setClientFilter("all");
    setShowSuggestions(false);
  };

  const handleSelect = (name: string) => {
    setSearchInput(name);
    setAppliedSearch(name);
    setVendorFilter("all");
    setClientFilter("all");
    setShowSuggestions(false);
  };

  const handleExcel = async () => {
    if (!filtered.length) return;
    const wb = new XLSX.Workbook();
    const ws = wb.addWorksheet("Price History");
    ws.columns = [
      { header: "Date",       key: "date",       width: 14 },
      { header: "DJ Inv No",  key: "djInvoiceNo", width: 12 },
      { header: "Vendor",     key: "vendorName",  width: 22 },
      { header: "Client",     key: "clientName",  width: 18 },
      { header: "Item",       key: "itemName",    width: 28 },
      { header: "UOM",        key: "uom",         width: 8  },
      { header: "Qty",        key: "qty",         width: 10 },
      { header: "Rate (₹)",   key: "unitPrice",   width: 12 },
      { header: "GST%",       key: "gstRate",     width: 8  },
      { header: "Total (₹)",  key: "totalPrice",  width: 14 },
    ];
    const hdr = ws.getRow(1);
    hdr.font = { bold: true, color: { argb: "FFFFFFFF" } };
    hdr.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
    hdr.alignment = { vertical: "middle", horizontal: "center" };
    hdr.height = 20;
    filtered.forEach((r, i) => {
      const row = ws.addRow({ ...r, date: fmtDate(r.date), djInvoiceNo: r.djInvoiceNo || "—" });
      row.height = 16;
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: i % 2 === 0 ? "FFFFFFFF" : "FFF8FAFC" } };
      row.getCell(8).numFmt = "₹#,##0.00";
      row.getCell(10).numFmt = "₹#,##0.00";
    });
    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf]), `PriceHistory_${appliedSearch.replace(/[^a-z0-9]/gi, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast({ title: "Excel downloaded" });
  };

  const priceTrend = (i: number) => {
    if (i >= filtered.length - 1) return null;
    const curr = filtered[i].unitPrice;
    const prev = filtered[i + 1].unitPrice;
    if (curr > prev) return "up";
    if (curr < prev) return "down";
    return "same";
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Purchase Price History</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Track item-wise price trends across all purchase invoices</p>
          </div>
          {filtered.length > 0 && (
            <Button size="sm" variant="outline" className="ml-auto gap-1.5 text-xs" onClick={handleExcel} data-testid="btn-price-history-excel">
              <Download className="w-3.5 h-3.5" /> Excel
            </Button>
          )}
        </div>

        {/* Search Bar */}
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Item search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <Input
                  ref={inputRef}
                  placeholder="Search item name…"
                  value={searchInput}
                  onChange={e => { setSearchInput(e.target.value); setShowSuggestions(true); }}
                  onFocus={() => setShowSuggestions(true)}
                  onKeyDown={e => { if (e.key === "Enter") handleSearch(); if (e.key === "Escape") setShowSuggestions(false); }}
                  className="pl-9 pr-8"
                  data-testid="input-price-history-search"
                />
                {searchInput && (
                  <button className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => { setSearchInput(""); setAppliedSearch(""); }}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg overflow-hidden">
                    {suggestions.map(s => (
                      <button
                        key={s.id}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 dark:hover:bg-indigo-950/30 flex items-center gap-2"
                        onMouseDown={() => handleSelect(s.itemName)}
                      >
                        <Package className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        {s.itemName}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Date filters */}
              <div className="flex gap-2 items-center">
                <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-36 text-xs" data-testid="input-price-history-from" />
                <span className="text-slate-400 text-xs">to</span>
                <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-36 text-xs" data-testid="input-price-history-to" />
              </div>
              <Button onClick={handleSearch} disabled={!searchInput.trim()} className="gap-1.5 bg-indigo-600 hover:bg-indigo-700" data-testid="btn-price-history-search">
                {(isLoading || isFetching) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Search
              </Button>
            </div>

            {/* Quick date shortcuts */}
            <div className="flex flex-wrap gap-2 mt-3">
              {[
                { label: "This Month", from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) },
                { label: "Last 3 Months", from: new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) },
                { label: "This Year", from: `${new Date().getFullYear()}-01-01`, to: new Date().toISOString().slice(0, 10) },
                { label: "All Time", from: "", to: "" },
              ].map(s => (
                <button
                  key={s.label}
                  onClick={() => { setFromDate(s.from); setToDate(s.to); }}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${fromDate === s.from && toDate === s.to ? "bg-indigo-100 border-indigo-300 text-indigo-700 dark:bg-indigo-900/40 dark:border-indigo-700 dark:text-indigo-300" : "bg-slate-50 border-slate-200 text-slate-600 hover:border-indigo-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400"}`}
                  data-testid={`btn-shortcut-${s.label.replace(/\s+/g, "-").toLowerCase()}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: "Records", value: stats.count.toString(), color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300", icon: null },
              { label: "Latest Rate", value: `₹${fmtNum(stats.latest)}`, sub: fmtDate(stats.latestDate), color: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300", icon: null },
              { label: "Min Rate", value: `₹${fmtNum(stats.min)}`, color: "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300", icon: "down" },
              { label: "Max Rate", value: `₹${fmtNum(stats.max)}`, color: "bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300", icon: "up" },
              { label: "Avg Rate", value: `₹${fmtNum(stats.avg)}`, color: "bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-300", icon: null },
            ].map((s, i) => (
              <div key={i} className={`rounded-xl p-3 ${s.color} space-y-0.5`} data-testid={`stat-price-${s.label.toLowerCase().replace(/\s+/g, "-")}`}>
                <p className="text-[11px] font-semibold opacity-70 uppercase tracking-wide">{s.label}</p>
                <p className="text-lg font-bold leading-tight">{s.value}</p>
                {s.sub && <p className="text-[10px] opacity-60">{s.sub}</p>}
              </div>
            ))}
          </div>
        )}

        {/* Vendor / Client Filters */}
        {rows.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-slate-500 font-medium">Filter:</span>
            <select value={vendorFilter} onChange={e => setVendorFilter(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200" data-testid="select-vendor-filter">
              {vendors.map(v => <option key={v} value={v}>{v === "all" ? "All Vendors" : v}</option>)}
            </select>
            <select value={clientFilter} onChange={e => setClientFilter(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200" data-testid="select-client-filter">
              {clients.map(c => <option key={c} value={c}>{c === "all" ? "All Clients" : c}</option>)}
            </select>
            {filtered.length !== rows.length && (
              <span className="text-xs text-indigo-600 font-medium">{filtered.length} of {rows.length} shown</span>
            )}
          </div>
        )}

        {/* Results Table */}
        {(isLoading || isFetching) && (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="w-7 h-7 animate-spin mr-3" />
            <span className="text-sm">Loading price history…</span>
          </div>
        )}

        {!isLoading && !isFetching && appliedSearch && filtered.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No purchase records found</p>
            <p className="text-sm mt-1">for "{appliedSearch}" {fromDate || toDate ? "in selected date range" : ""}</p>
          </div>
        )}

        {!appliedSearch && (
          <div className="text-center py-16 text-slate-400">
            <IndianRupee className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium text-slate-500">Enter an item name to view price history</p>
            <p className="text-sm mt-1">Search by item name or pick from Item Master suggestions</p>
          </div>
        )}

        {filtered.length > 0 && !isLoading && (
          <Card className="border-0 shadow-md overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <History className="w-4 h-4" />
                {appliedSearch}
                <Badge className="ml-2 bg-white/20 text-white border-0 text-xs">{filtered.length} records</Badge>
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-600 dark:text-slate-300">Date</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-600 dark:text-slate-300">DJ Inv #</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-600 dark:text-slate-300">Vendor</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-600 dark:text-slate-300">Client</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-600 dark:text-slate-300">Item Name</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-slate-600 dark:text-slate-300">UOM</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-slate-600 dark:text-slate-300">Qty</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-slate-600 dark:text-slate-300">Rate ₹</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-slate-600 dark:text-slate-300">Trend</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-slate-600 dark:text-slate-300">GST%</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-slate-600 dark:text-slate-300">Total ₹</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => {
                    const trend = priceTrend(i);
                    return (
                      <tr
                        key={r.id}
                        className={`border-b border-slate-100 dark:border-slate-800 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-colors ${i % 2 === 0 ? "" : "bg-slate-50/50 dark:bg-slate-900/30"}`}
                        data-testid={`row-price-history-${r.id}`}
                      >
                        <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">{fmtDate(r.date)}</td>
                        <td className="px-3 py-2 text-indigo-600 dark:text-indigo-400 font-mono">{r.djInvoiceNo || "—"}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400 max-w-[140px] truncate">{r.vendorName}</td>
                        <td className="px-3 py-2 text-slate-500 dark:text-slate-500 max-w-[100px] truncate">{r.clientName}</td>
                        <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-300">{r.itemName}</td>
                        <td className="px-3 py-2 text-center text-slate-500">{r.uom}</td>
                        <td className="px-3 py-2 text-center font-semibold text-green-700 dark:text-green-400">{fmtNum(r.qty, 2)}</td>
                        <td className="px-3 py-2 text-center font-bold text-blue-700 dark:text-blue-400">₹{fmtNum(r.unitPrice)}</td>
                        <td className="px-3 py-2 text-center">
                          {trend === "up" && <TrendingUp className="w-3.5 h-3.5 text-red-500 inline" title="Higher than previous" />}
                          {trend === "down" && <TrendingDown className="w-3.5 h-3.5 text-green-500 inline" title="Lower than previous" />}
                          {trend === "same" && <Minus className="w-3.5 h-3.5 text-slate-400 inline" title="Same as previous" />}
                        </td>
                        <td className="px-3 py-2 text-center text-slate-500">{r.gstRate > 0 ? `${r.gstRate}%` : "—"}</td>
                        <td className="px-3 py-2 text-center font-bold text-purple-700 dark:text-purple-400">₹{fmtNum(r.totalPrice)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                {stats && (
                  <tfoot>
                    <tr className="bg-indigo-50 dark:bg-indigo-950/30 border-t-2 border-indigo-200 dark:border-indigo-800">
                      <td colSpan={7} className="px-3 py-2 text-right font-semibold text-slate-600 dark:text-slate-400 text-xs">Summary ({filtered.length} records) — Avg Rate:</td>
                      <td className="px-3 py-2 text-center font-bold text-indigo-700 dark:text-indigo-400 text-sm">₹{fmtNum(stats.avg)}</td>
                      <td colSpan={3} className="px-3 py-2 text-xs text-slate-500 dark:text-slate-500">
                        Min: <span className="font-semibold text-green-700">₹{fmtNum(stats.min)}</span>
                        &nbsp;·&nbsp;Max: <span className="font-semibold text-orange-700">₹{fmtNum(stats.max)}</span>
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Card>
        )}
      </div>
    </Layout>
  );
}
