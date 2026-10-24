import { Fragment, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Printer, FileDown } from "lucide-react";

type StmtRow = {
  id: string;
  label: string;
  custom?: boolean;
  qty: Record<string, number>;
  rate: Record<string, number>;
};

const MEALS = [
  { key: "bf", label: "Breakfast" },
  { key: "lu", label: "Lunch" },
  { key: "di", label: "Dinner" },
  { key: "sp", label: "Special Lunch" },
];

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function defaultRows(): StmtRow[] {
  const mk = (id: string, label: string, bf: number, lu: number, di: number, sp = 58): StmtRow => ({
    id, label, qty: { bf: 0, lu: 0, di: 0, sp: 0 }, rate: { bf, lu, di, sp },
  });
  return [
    mk("cw", "Contract Worker", 18.4, 46.4, 46.4, 46.4),
    mk("ap", "Apprentice", 23, 58, 58),
    mk("em", "Employee", 23, 58, 58),
    mk("fc", "Free Coupon", 23, 58, 58),
    mk("mr", "Manual Register", 23, 58, 58),
    mk("gh", "Guest House", 23, 58, 58),
  ];
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const money = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

export function CiplaStatementPanel({ month, year }: { month: number; year: number }) {
  const storeKey = `cipla-statement-${year}-${month}`;
  const [rows, setRows] = useState<StmtRow[]>(defaultRows());
  const [newLabel, setNewLabel] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storeKey);
      setRows(raw ? JSON.parse(raw) : defaultRows());
    } catch {
      setRows(defaultRows());
    }
  }, [storeKey]);

  const persist = (next: StmtRow[]) => {
    setRows(next);
    try { localStorage.setItem(storeKey, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const setVal = (idx: number, kind: "qty" | "rate", meal: string, value: string) => {
    const next = rows.map((r, i) => i === idx ? { ...r, [kind]: { ...r[kind], [meal]: parseFloat(value) || 0 } } : r);
    persist(next);
  };

  const addRow = () => {
    const label = newLabel.trim();
    if (!label) return;
    persist([...rows, { id: `c${Date.now()}`, label, custom: true, qty: { bf: 0, lu: 0, di: 0, sp: 0 }, rate: { bf: 0, lu: 0, di: 0, sp: 0 } }]);
    setNewLabel("");
  };

  const rowAmt = (r: StmtRow, m: string) => (r.qty[m] || 0) * (r.rate[m] || 0);
  const totQty = (m: string) => rows.reduce((s, r) => s + (r.qty[m] || 0), 0);
  const totAmt = (m: string) => rows.reduce((s, r) => s + rowAmt(r, m), 0);
  const grand = MEALS.reduce((s, m) => s + totAmt(m.key), 0);
  const title = `Number of Lunch & Dinner Per Month to Cipla Limited Unit 1 — ${MONTH_NAMES[month - 1]} ${year}`;

  const handlePrint = () => {
    const head = `<tr><th rowspan="2">Particulars</th>${MEALS.map(m => `<th colspan="3">${m.label}</th>`).join("")}</tr><tr>${MEALS.map(() => "<th>Qty</th><th>Rate</th><th>Amount</th>").join("")}</tr>`;
    const body = rows.map(r => `<tr><td class="l">${esc(r.label)}</td>${MEALS.map(m => `<td>${r.qty[m.key] || ""}</td><td>${r.rate[m.key] || ""}</td><td>${r.qty[m.key] ? money(rowAmt(r, m.key)) : ""}</td>`).join("")}</tr>`).join("");
    const foot = `<tr class="t"><td class="l">Total</td>${MEALS.map(m => `<td>${totQty(m.key)}</td><td></td><td>${money(totAmt(m.key))}</td>`).join("")}</tr><tr class="t"><td class="l" colspan="${MEALS.length * 3}">Grand Total</td><td>${money(grand)}</td></tr>`;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<html><head><title>Cipla Monthly Statement</title><style>
      body{font-family:"Times New Roman",serif;margin:10mm;font-size:12pt;}
      h3,h4{text-align:center;margin:2px 0;}
      table{width:100%;border-collapse:collapse;margin-top:10px;}
      th,td{border:1px solid #333;padding:4px 6px;text-align:center;font-size:11pt;}
      th{background:#1a3a5a;color:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      td.l{text-align:left;} tr.t td{font-weight:bold;background:#e8f0fe;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      @media print{@page{size:A4 landscape;margin:8mm;}}
    </style></head><body><h3>DJ Hospitality &amp; Facility Management Pvt. Ltd.</h3><h4>${esc(title)}</h4><table><thead>${head}</thead><tbody>${body}${foot}</tbody></table></body></html>`);
    win.document.close();
    win.onload = () => win.print();
  };

  const handleExcel = async () => {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Monthly Statement");
    ws.addRow(["DJ Hospitality & Facility Management Pvt. Ltd."]).font = { bold: true, size: 13 };
    ws.addRow([title]).font = { bold: true };
    const h1 = ws.addRow(["Particulars", ...MEALS.flatMap(m => [m.label, "", ""])]);
    const h2 = ws.addRow(["", ...MEALS.flatMap(() => ["Qty", "Rate", "Amount"])]);
    MEALS.forEach((_, i) => ws.mergeCells(3, 2 + i * 3, 3, 4 + i * 3));
    ws.mergeCells(3, 1, 4, 1);
    [h1, h2].forEach(h => h.eachCell(c => { c.font = { bold: true }; c.alignment = { horizontal: "center" }; }));
    rows.forEach(r => ws.addRow([r.label, ...MEALS.flatMap(m => [r.qty[m.key] || 0, r.rate[m.key] || 0, Math.round(rowAmt(r, m.key) * 100) / 100])]));
    const t = ws.addRow(["Total", ...MEALS.flatMap(m => [totQty(m.key), "", Math.round(totAmt(m.key) * 100) / 100])]);
    t.font = { bold: true };
    const g = ws.addRow(["Grand Total", ...Array(MEALS.length * 3 - 1).fill(""), Math.round(grand * 100) / 100]);
    g.font = { bold: true };
    ws.columns = [{ width: 22 }, ...Array(MEALS.length * 3).fill({ width: 11 })];
    const buf = await wb.xlsx.writeBuffer();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([buf]));
    a.download = `Cipla_Monthly_Statement_${MONTH_NAMES[month - 1]}_${year}.xlsx`;
    a.click();
  };

  const inp = "w-16 text-center border border-gray-300 rounded px-1 py-0.5 text-sm dark:bg-gray-900";

  return (
    <div className="mt-6 border rounded-xl p-3">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <h3 className="font-bold text-sm flex-1">Monthly Statement (Qty / Rate / Amount) — Cipla Unit 1</h3>
        <Button size="sm" variant="outline" onClick={handlePrint}><Printer className="w-4 h-4 mr-1.5" />Print Statement</Button>
        <Button size="sm" variant="outline" onClick={handleExcel} className="text-green-700 border-green-300"><FileDown className="w-4 h-4 mr-1.5" />Export Excel</Button>
      </div>
      <div className="overflow-x-auto">
        <table className="text-sm border-collapse w-full">
          <thead>
            <tr className="bg-slate-700 text-white">
              <th className="border p-1" rowSpan={2}>Particulars</th>
              {MEALS.map(m => <th key={m.key} className="border p-1" colSpan={3}>{m.label}</th>)}
              <th className="border p-1" rowSpan={2}></th>
            </tr>
            <tr className="bg-slate-600 text-white">
              {MEALS.map(m => <Fragment key={m.key}><th key={m.key + "q"} className="border p-1">Qty</th><th key={m.key + "r"} className="border p-1">Rate</th><th key={m.key + "a"} className="border p-1">Amount</th></Fragment>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={r.id}>
                <td className="border p-1 font-medium">{r.label}</td>
                {MEALS.map(m => (
                  <Fragment key={m.key}>
                    <td key={m.key + "q"} className="border p-1 text-center"><input type="number" min={0} className={inp} value={r.qty[m.key] || ""} onChange={e => setVal(idx, "qty", m.key, e.target.value)} /></td>
                    <td key={m.key + "r"} className="border p-1 text-center"><input type="number" min={0} step="any" className={inp} value={r.rate[m.key] || ""} onChange={e => setVal(idx, "rate", m.key, e.target.value)} /></td>
                    <td key={m.key + "a"} className="border p-1 text-right">{r.qty[m.key] ? money(rowAmt(r, m.key)) : ""}</td>
                  </Fragment>
                ))}
                <td className="border p-1 text-center">
                  {r.custom && <button onClick={() => persist(rows.filter((_, i) => i !== idx))} className="text-red-600"><Trash2 className="w-4 h-4" /></button>}
                </td>
              </tr>
            ))}
            <tr className="font-bold bg-blue-50 dark:bg-slate-800">
              <td className="border p-1">Total</td>
              {MEALS.map(m => (
                <Fragment key={m.key}>
                  <td key={m.key + "q"} className="border p-1 text-center">{totQty(m.key)}</td>
                  <td key={m.key + "r"} className="border p-1"></td>
                  <td key={m.key + "a"} className="border p-1 text-right">{money(totAmt(m.key))}</td>
                </Fragment>
              ))}
              <td className="border p-1 text-right">{money(grand)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="flex gap-2 mt-3">
        <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="New row name (Guest House ke neeche)"
          className="border border-gray-300 rounded px-2 py-1 text-sm flex-1 max-w-xs dark:bg-gray-900" />
        <Button size="sm" onClick={addRow} className="bg-blue-600 text-white"><Plus className="w-4 h-4 mr-1" />Add Row</Button>
      </div>
    </div>
  );
}
