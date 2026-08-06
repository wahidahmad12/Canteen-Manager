import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Printer, ArrowLeft, TrendingDown, FileSpreadsheet } from "lucide-react";
import type { FixedAsset } from "@shared/schema";

const fmtINR = (n: number) =>
  "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface AssetRow {
  asset: FixedAsset;
  cost: number;
  depPercent: number;
  years: number;
  accumulated: number;
  bookValue: number;
}

function computeRow(asset: FixedAsset, asOf: Date): AssetRow {
  const cost = Number(asset.cost) || 0;
  const depPercent = Number(asset.depreciationPercent) || 0;
  let years = 0;
  if (asset.purchaseDate) {
    const pd = new Date(asset.purchaseDate + "T00:00:00");
    if (!isNaN(pd.getTime())) {
      years = Math.max(0, (asOf.getTime() - pd.getTime()) / (365.25 * 24 * 3600 * 1000));
    }
  }
  // Straight-line: accumulated depreciation = cost × yearly % × years elapsed, capped at cost
  const accumulated = Math.min(cost, cost * (depPercent / 100) * years);
  const bookValue = cost - accumulated;
  return { asset, cost, depPercent, years, accumulated, bookValue };
}

function groupTotals(rows: AssetRow[], key: (r: AssetRow) => string) {
  const map = new Map<string, { count: number; cost: number; accumulated: number; bookValue: number }>();
  for (const r of rows) {
    const k = key(r) || "—";
    const g = map.get(k) || { count: 0, cost: 0, accumulated: 0, bookValue: 0 };
    g.count += 1;
    g.cost += r.cost;
    g.accumulated += r.accumulated;
    g.bookValue += r.bookValue;
    map.set(k, g);
  }
  return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

export default function DepreciationReportPage() {
  const { data: assets = [], isLoading } = useQuery<FixedAsset[]>({ queryKey: ["/api/fixed-assets"] });

  const asOf = useMemo(() => new Date(), []);
  const rows = useMemo(
    () =>
      assets
        .map((a) => computeRow(a, asOf))
        .sort((a, b) => (a.asset.category || "").localeCompare(b.asset.category || "") || (a.asset.assetTag || "").localeCompare(b.asset.assetTag || "")),
    [assets, asOf],
  );

  const totals = rows.reduce(
    (t, r) => ({ cost: t.cost + r.cost, accumulated: t.accumulated + r.accumulated, bookValue: t.bookValue + r.bookValue }),
    { cost: 0, accumulated: 0, bookValue: 0 },
  );

  const byCategory = useMemo(() => groupTotals(rows, (r) => r.asset.category || ""), [rows]);
  const byLocation = useMemo(() => groupTotals(rows, (r) => r.asset.location || ""), [rows]);

  const asOfStr = asOf.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });

  const handleExportExcel = async () => {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();

    const headerStyle = (row: any) => {
      row.font = { bold: true };
      row.eachCell((cell: any) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
        cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
      });
    };

    // Sheet 1: Asset detail
    const ws = wb.addWorksheet("Asset Detail");
    ws.addRow(["Fixed Asset Depreciation Report"]).font = { bold: true, size: 14 };
    ws.addRow([`As on ${asOfStr} · Straight-line method (cost × yearly % × years since purchase)`]);
    ws.addRow([]);
    const head = ws.addRow(["Asset ID", "Name", "Category", "Location", "Purchase Date", "Cost", "Depr %/yr", "Years", "Accum. Depr.", "Book Value"]);
    headerStyle(head);
    for (const r of rows) {
      ws.addRow([
        r.asset.assetTag,
        r.asset.name,
        r.asset.category,
        r.asset.location,
        r.asset.purchaseDate,
        r.cost,
        r.depPercent,
        Number(r.years.toFixed(1)),
        Number(r.accumulated.toFixed(2)),
        Number(r.bookValue.toFixed(2)),
      ]);
    }
    const totalRow = ws.addRow([
      `Grand Total (${rows.length} assets)`, "", "", "", "",
      Number(totals.cost.toFixed(2)), "", "",
      Number(totals.accumulated.toFixed(2)), Number(totals.bookValue.toFixed(2)),
    ]);
    totalRow.font = { bold: true };
    ws.columns.forEach((c, i) => { c.width = i === 1 ? 30 : 16; });
    [6, 9, 10].forEach((n) => { ws.getColumn(n).numFmt = "#,##0.00"; });

    // Summary sheets
    const addSummarySheet = (name: string, groups: ReturnType<typeof groupTotals>) => {
      const s = wb.addWorksheet(name);
      const h = s.addRow(["Name", "Assets", "Total Cost", "Accum. Depreciation", "Book Value"]);
      headerStyle(h);
      for (const [gname, g] of groups) {
        s.addRow([gname, g.count, Number(g.cost.toFixed(2)), Number(g.accumulated.toFixed(2)), Number(g.bookValue.toFixed(2))]);
      }
      const t = s.addRow(["Total", rows.length, Number(totals.cost.toFixed(2)), Number(totals.accumulated.toFixed(2)), Number(totals.bookValue.toFixed(2))]);
      t.font = { bold: true };
      s.columns.forEach((c, i) => { c.width = i === 0 ? 30 : 20; });
      [3, 4, 5].forEach((n) => { s.getColumn(n).numFmt = "#,##0.00"; });
    };
    addSummarySheet("By Category", byCategory);
    addSummarySheet("By Location", byLocation);

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Depreciation_Report_${asOf.toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const summaryTable = (title: string, groups: ReturnType<typeof groupTotals>) => (
    <div>
      <h2 className="text-sm font-bold uppercase tracking-wide mb-2">{title}</h2>
      <table className="w-full text-sm border-collapse dep-table">
        <thead>
          <tr>
            <th className="text-left">Name</th>
            <th className="text-right">Assets</th>
            <th className="text-right">Total Cost</th>
            <th className="text-right">Accum. Depreciation</th>
            <th className="text-right">Book Value</th>
          </tr>
        </thead>
        <tbody>
          {groups.map(([name, g]) => (
            <tr key={name}>
              <td>{name}</td>
              <td className="text-right">{g.count}</td>
              <td className="text-right">{fmtINR(g.cost)}</td>
              <td className="text-right">{fmtINR(g.accumulated)}</td>
              <td className="text-right font-semibold">{fmtINR(g.bookValue)}</td>
            </tr>
          ))}
          <tr className="dep-total-row">
            <td className="font-bold">Total</td>
            <td className="text-right font-bold">{rows.length}</td>
            <td className="text-right font-bold">{fmtINR(totals.cost)}</td>
            <td className="text-right font-bold">{fmtINR(totals.accumulated)}</td>
            <td className="text-right font-bold">{fmtINR(totals.bookValue)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-5" id="dep-report-page">
      <style>{`
        .dep-table th, .dep-table td { border: 1px solid #d1d5db; padding: 4px 8px; }
        .dep-table thead th { background: #f3f4f6; font-weight: 700; text-transform: uppercase; font-size: 11px; }
        .dep-total-row td { background: #f9fafb; border-top: 2px solid #374151; }
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          body * { visibility: hidden; }
          #dep-report-page, #dep-report-page * { visibility: visible; }
          #dep-report-page { position: absolute; left: 0; top: 0; width: 100%; padding: 0; }
          .no-print { display: none !important; }
          #dep-report-page .rounded-lg, #dep-report-page [class*="card"] { border: none !important; box-shadow: none !important; }
          .dep-table { font-size: 10px; }
          .dep-table th, .dep-table td { border-color: #000; padding: 3px 6px; }
          .dep-break-avoid { break-inside: avoid; }
        }
      `}</style>

      {/* Screen toolbar */}
      <div className="flex items-center justify-between no-print">
        <div className="flex items-center gap-2">
          <TrendingDown className="w-6 h-6 text-blue-600" />
          <h1 className="text-xl md:text-2xl font-bold">Asset Depreciation Report</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/fixed-assets">
            <Button variant="outline" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Fixed Assets</Button>
          </Link>
          <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={rows.length === 0} data-testid="button-export-excel">
            <FileSpreadsheet className="w-4 h-4 mr-1" /> Export Excel
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-1" /> Print Report
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 md:p-6 space-y-6">
          {/* Report header */}
          <div className="text-center border-b pb-3">
            <div className="font-bold uppercase text-base">DJ Hospitality &amp; Facility Management Private Limited</div>
            <div className="font-semibold uppercase text-sm mt-1">Fixed Asset Depreciation Report</div>
            <div className="text-xs text-muted-foreground mt-1">
              As on {asOfStr} · Straight-line method (cost × yearly % × years since purchase)
            </div>
          </div>

          {isLoading && <p className="text-center text-muted-foreground py-8">Loading...</p>}
          {!isLoading && rows.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No assets registered. Add assets on the Fixed Assets page first.</p>
          )}

          {rows.length > 0 && (
            <>
              {/* Asset detail table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse dep-table whitespace-nowrap">
                  <thead>
                    <tr>
                      <th className="text-left">Asset ID</th>
                      <th className="text-left">Name</th>
                      <th className="text-left">Category</th>
                      <th className="text-left">Location</th>
                      <th className="text-left">Purchase Date</th>
                      <th className="text-right">Cost</th>
                      <th className="text-right">Depr %/yr</th>
                      <th className="text-right">Years</th>
                      <th className="text-right">Accum. Depr.</th>
                      <th className="text-right">Book Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.asset.id}>
                        <td className="font-medium">{r.asset.assetTag}</td>
                        <td>{r.asset.name}</td>
                        <td>{r.asset.category}</td>
                        <td>{r.asset.location}</td>
                        <td>{r.asset.purchaseDate}</td>
                        <td className="text-right">{fmtINR(r.cost)}</td>
                        <td className="text-right">{r.depPercent}%</td>
                        <td className="text-right">{r.years.toFixed(1)}</td>
                        <td className="text-right">{fmtINR(r.accumulated)}</td>
                        <td className="text-right font-semibold">{fmtINR(r.bookValue)}</td>
                      </tr>
                    ))}
                    <tr className="dep-total-row">
                      <td colSpan={5} className="font-bold">Grand Total ({rows.length} assets)</td>
                      <td className="text-right font-bold">{fmtINR(totals.cost)}</td>
                      <td></td>
                      <td></td>
                      <td className="text-right font-bold">{fmtINR(totals.accumulated)}</td>
                      <td className="text-right font-bold">{fmtINR(totals.bookValue)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Summaries */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="dep-break-avoid">{summaryTable("Totals by Category", byCategory)}</div>
                <div className="dep-break-avoid">{summaryTable("Totals by Location", byLocation)}</div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
