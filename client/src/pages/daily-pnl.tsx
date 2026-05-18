import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useClientNames } from "@/hooks/use-reports";
import { RefreshCw, Save, Printer, TrendingUp, TrendingDown, Plus, Trash2, BarChart3, ClipboardEdit, LayoutList, Table2 } from "lucide-react";
import { format } from "date-fns";
import { Layout } from "@/components/layout";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const LUNCH_FIXED = ["Rice","Dal","Vegetable","Non Veg","Sweets","Curd","Paneer"];

// ─── Permanent Staff sale rows ───────────────────────────────────────────────
// Per-row Cash/Online/Bill rates: Breakfast ₹5/₹5/₹30 · Lunch ₹20/₹20/₹50 · Evening ₹10/₹10/₹30 · Night ₹10/₹10/₹17
const PS_ROWS = [
  { itemName: "Breakfast",      cashRate: 5,  onlineRate: 5,  billRate: 30, cashKey: "income_ps_breakfast_cash_qty", onlineKey: "income_ps_breakfast_online_qty" },
  { itemName: "Lunch",          cashRate: 20, onlineRate: 20, billRate: 50, cashKey: "income_ps_lunch_cash_qty",      onlineKey: "income_ps_lunch_online_qty" },
  { itemName: "Evening Snacks", cashRate: 10, onlineRate: 10, billRate: 30, cashKey: "income_ps_evening_cash_qty",    onlineKey: "income_ps_evening_online_qty" },
  { itemName: "Night Snacks",   cashRate: 10, onlineRate: 10, billRate: 17, cashKey: "income_ps_night_cash_qty",      onlineKey: "income_ps_night_online_qty" },
];

// ─── Third Party sale rows ────────────────────────────────────────────────────
const TP_ROWS: { itemName: string; rate: number; cashKey: string; onlineKey: string }[] = [
  { itemName: "Breakfast",      rate: 20, cashKey: "income_tp_breakfast_cash_qty",       onlineKey: "income_tp_breakfast_online_qty" },
  { itemName: "Lunch Veg",      rate: 35, cashKey: "income_tp_lunch_veg_cash_qty",        onlineKey: "income_tp_lunch_veg_online_qty" },
  { itemName: "Egg Lunch",      rate: 45, cashKey: "income_tp_lunch_egg_cash_qty",        onlineKey: "income_tp_lunch_egg_online_qty" },
  { itemName: "Chicken Lunch",  rate: 65, cashKey: "income_tp_lunch_chicken_cash_qty",    onlineKey: "income_tp_lunch_chicken_online_qty" },
  { itemName: "Fish Lunch",     rate: 55, cashKey: "income_tp_lunch_fish_cash_qty",       onlineKey: "income_tp_lunch_fish_online_qty" },
  { itemName: "Evening Snacks", rate: 20, cashKey: "income_ps_evening_cash_qty",          onlineKey: "income_ps_evening_online_qty" },
  { itemName: "Night Snacks",   rate: 30, cashKey: "income_tp_night_cash_qty",            onlineKey: "income_tp_night_online_qty" },
];

// ─── Types ────────────────────────────────────────────────────────────────────
type ExpenseItem = { slNo: number; itemName: string; uom: string; qty: number; rate: number; total: number };
type ManpowerItem = { slNo: number; employeeName: string; basicWagesPerDay: number; leaveBalance: number };
type PsSaleRow  = { slNo: number; itemName: string; cashQty: number; onlineQty: number; billQty: number; cashRate: number; onlineRate: number; billRate: number };
type TpSaleRow  = { slNo: number; itemName: string; rate: number; cashQty: number; onlineQty: number };

const makeExpItem    = (slNo: number, itemName = ""): ExpenseItem => ({ slNo, itemName, uom: "", qty: 0, rate: 0, total: 0 });
const makePsRow      = (r: typeof PS_ROWS[number], i: number): PsSaleRow  => ({ slNo: i + 1, itemName: r.itemName, cashQty: 0, onlineQty: 0, billQty: 0, cashRate: r.cashRate, onlineRate: r.onlineRate, billRate: r.billRate });
const makeTpRow      = (r: typeof TP_ROWS[number], i: number): TpSaleRow  => ({ slNo: i + 1, itemName: r.itemName, rate: r.rate, cashQty: 0, onlineQty: 0 });


const today   = () => format(new Date(), "yyyy-MM-dd");
const fmtINR  = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (s: string) => { try { return format(new Date(s + "T00:00:00"), "dd-MM-yyyy"); } catch { return s; } };

// ─── Sub-components ───────────────────────────────────────────────────────────
function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 border rounded-lg overflow-hidden">
      <div className="px-3 py-1.5 font-bold text-sm text-white text-center" style={{ background: color }}>{title}</div>
      <div className="p-2">{children}</div>
    </div>
  );
}

function ExpenseTable({ rows, onChange, onAdd, onDelete, onBlurItem, itemNames }: {
  rows: ExpenseItem[]; onChange: (r: ExpenseItem[]) => void;
  onAdd: () => void; onDelete: (i: number) => void;
  onBlurItem?: (i: number) => void;
  itemNames: string[];
}) {
  const th = { border: "1px solid #ddd", padding: "3px 5px", textAlign: "center" as const, background: "#f5f5f5", fontSize: 11, fontWeight: "bold" };
  const td = { border: "1px solid #ddd", padding: "2px 4px", fontSize: 11 };
  const num = (items: ExpenseItem[], i: number, f: "qty" | "rate", v: string) => {
    const n = parseFloat(v) || 0;
    onChange(items.map((r, xi) => {
      if (xi !== i) return r;
      const q  = f === "qty"  ? n : r.qty;
      const rt = f === "rate" ? n : r.rate;
      return { ...r, [f]: n, total: q * rt };
    }));
  };
  // unique id per table instance
  const lid = `iml-${rows[0]?.slNo ?? 0}`;
  return (
    <div className="overflow-x-auto">
      <datalist id={lid}>{itemNames.map((n, i) => <option key={i} value={n} />)}</datalist>
      <table className="w-full border-collapse" style={{ fontSize: 11 }}>
        <thead><tr>
          <th style={{ ...th, width: 35 }}>Sl.No</th>
          <th style={{ ...th, minWidth: 140 }}>Item Name</th>
          <th style={{ ...th, width: 55 }}>UoM</th>
          <th style={{ ...th, width: 60 }}>Qty</th>
          <th style={{ ...th, width: 80 }}>Rate (₹)</th>
          <th style={{ ...th, width: 90 }}>Total (₹)</th>
          <th style={{ ...th, width: 28 }}></th>
        </tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td style={{ ...td, textAlign: "center" }}>{r.slNo}</td>
              <td style={td}>
                <input list={lid} className="w-full border-0 outline-none bg-transparent text-xs" value={r.itemName}
                  onChange={e => onChange(rows.map((x, xi) => xi === i ? { ...x, itemName: e.target.value } : x))}
                  onBlur={() => onBlurItem?.(i)} placeholder="Type or select…" />
              </td>
              <td style={td}><input className="w-full border-0 outline-none bg-transparent text-xs text-center" value={r.uom} onChange={e => onChange(rows.map((x, xi) => xi === i ? { ...x, uom: e.target.value } : x))} placeholder="Kg/Pcs…" /></td>
              <td style={td}><input type="number" className="w-full border-0 outline-none bg-transparent text-xs text-center" value={r.qty||""} onChange={e => num(rows, i, "qty", e.target.value)} /></td>
              <td style={{ ...td, background: "#fffde7" }}><input type="number" className="w-full border-0 outline-none bg-transparent text-xs text-center" value={r.rate||""} onChange={e => num(rows, i, "rate", e.target.value)} /></td>
              <td style={{ ...td, textAlign: "right", fontWeight: "bold", background: "#f0fdf4" }}>{r.total > 0 ? r.total.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : ""}</td>
              <td style={{ ...td, textAlign: "center" }}><button onClick={() => onDelete(i)} className="text-red-400 hover:text-red-600 p-0.5"><Trash2 className="w-3 h-3" /></button></td>
            </tr>
          ))}
          <tr><td colSpan={7} style={{ ...td, textAlign: "center", padding: 4 }}>
            <button onClick={onAdd} className="flex items-center gap-1 mx-auto text-blue-600 hover:text-blue-800 text-xs"><Plus className="w-3 h-3" /> Add Row</button>
          </td></tr>
          <tr>
            <td colSpan={5} style={{ ...th, textAlign: "right" }}>Total</td>
            <td style={{ ...td, textAlign: "right", fontWeight: "bold", background: "#e8f0fe" }}>{rows.reduce((s, r) => s + r.total, 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
            <td style={td} />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ─── Mobile card: Expense section ─────────────────────────────────────────────
function ExpenseCards({ rows, onChange, onAdd, onDelete, onBlurItem, itemNames, color }: {
  rows: ExpenseItem[]; onChange: (r: ExpenseItem[]) => void;
  onAdd: () => void; onDelete: (i: number) => void;
  onBlurItem?: (i: number) => void;
  itemNames: string[]; color: string;
}) {
  const lid = `mc-${rows[0]?.slNo ?? Math.random()}`;
  const total = rows.reduce((s, r) => s + r.total, 0);
  return (
    <div>
      <datalist id={lid}>{itemNames.map((n, i) => <option key={i} value={n} />)}</datalist>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="border rounded-lg p-2.5 bg-white shadow-sm">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-xs font-semibold text-gray-400 w-5">{r.slNo}.</span>
              <input list={lid} className="flex-1 border border-gray-200 rounded px-2 py-1 text-sm bg-amber-50 outline-none"
                value={r.itemName} placeholder="Item name…"
                onChange={e => onChange(rows.map((x, xi) => xi === i ? { ...x, itemName: e.target.value } : x))}
                onBlur={() => onBlurItem?.(i)} />
              <button onClick={() => onDelete(i)} className="text-red-400 hover:text-red-600 p-0.5 ml-1"><Trash2 className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <div className="flex flex-col gap-0.5">
                <label className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">UoM</label>
                <input className="border border-gray-200 rounded px-2 py-1 text-sm text-center outline-none"
                  value={r.uom} placeholder="Kg…"
                  onChange={e => onChange(rows.map((x, xi) => xi === i ? { ...x, uom: e.target.value } : x))} />
              </div>
              <div className="flex flex-col gap-0.5">
                <label className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">Qty</label>
                <input type="number" inputMode="decimal" className="border border-gray-200 rounded px-2 py-1 text-sm text-center outline-none"
                  value={r.qty || ""} placeholder="0"
                  onChange={e => {
                    const qty = parseFloat(e.target.value) || 0;
                    onChange(rows.map((x, xi) => xi === i ? { ...x, qty, total: qty * x.rate } : x));
                  }} />
              </div>
              <div className="flex flex-col gap-0.5">
                <label className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">Rate ₹</label>
                <input type="number" inputMode="decimal" className="border border-yellow-300 rounded px-2 py-1 text-sm text-center outline-none bg-yellow-50"
                  value={r.rate || ""} placeholder="0"
                  onChange={e => {
                    const rate = parseFloat(e.target.value) || 0;
                    onChange(rows.map((x, xi) => xi === i ? { ...x, rate, total: x.qty * rate } : x));
                  }} />
              </div>
            </div>
            {r.total > 0 && (
              <div className="mt-1.5 text-right text-xs font-bold text-green-700">
                Total: ₹{r.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mt-2 pt-1.5 border-t">
        <button onClick={onAdd} className="flex items-center gap-1 text-blue-600 text-xs font-medium hover:text-blue-800">
          <Plus className="w-3.5 h-3.5" /> Add Row
        </button>
        {total > 0 && <span className="text-xs font-bold text-gray-700">Total: ₹{total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>}
      </div>
    </div>
  );
}

// ─── Mobile card: PS Sale section ─────────────────────────────────────────────
function PsSaleCards({ rows, onChange, psCalc, totalPsSale }: {
  rows: PsSaleRow[];
  onChange: (r: PsSaleRow[]) => void;
  psCalc: (PsSaleRow & { cashAmt: number; onlineAmt: number; coTotal: number; billAmt: number; totalAmt: number })[];
  totalPsSale: number;
}) {
  return (
    <div className="space-y-2">
      {psCalc.map((r, i) => (
        <div key={i} className="border border-green-100 rounded-lg p-3 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-sm text-green-800">{r.itemName}</span>
            {r.totalAmt > 0 && <span className="text-xs font-bold bg-green-100 text-green-800 px-2 py-0.5 rounded-full">₹{r.totalAmt.toLocaleString("en-IN")}</span>}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] text-yellow-700 font-semibold uppercase">Cash Qty <span className="font-normal text-gray-400">×₹{r.cashRate}</span></label>
              <input type="number" inputMode="numeric" className="border border-yellow-200 rounded px-2 py-1.5 text-sm text-center outline-none bg-yellow-50"
                value={r.cashQty || ""} placeholder="0"
                onChange={e => onChange(rows.map((x, xi) => xi === i ? { ...x, cashQty: parseFloat(e.target.value) || 0 } : x))} />
              {r.cashAmt > 0 && <span className="text-[10px] text-center text-yellow-700">₹{r.cashAmt.toLocaleString("en-IN")}</span>}
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] text-blue-700 font-semibold uppercase">Online <span className="font-normal text-gray-400">×₹{r.onlineRate}</span></label>
              <input type="number" inputMode="numeric" className="border border-blue-200 rounded px-2 py-1.5 text-sm text-center outline-none bg-blue-50"
                value={r.onlineQty || ""} placeholder="0"
                onChange={e => onChange(rows.map((x, xi) => xi === i ? { ...x, onlineQty: parseFloat(e.target.value) || 0 } : x))} />
              {r.onlineAmt > 0 && <span className="text-[10px] text-center text-blue-700">₹{r.onlineAmt.toLocaleString("en-IN")}</span>}
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] text-pink-700 font-semibold uppercase">Bill <span className="font-normal text-gray-400">×₹{r.billRate}</span></label>
              <input type="number" inputMode="numeric" className="border border-pink-200 rounded px-2 py-1.5 text-sm text-center outline-none bg-pink-50"
                value={r.billQty || ""} placeholder="0"
                onChange={e => onChange(rows.map((x, xi) => xi === i ? { ...x, billQty: parseFloat(e.target.value) || 0 } : x))} />
              {r.billAmt > 0 && <span className="text-[10px] text-center text-pink-700">₹{r.billAmt.toLocaleString("en-IN")}</span>}
            </div>
          </div>
        </div>
      ))}
      {totalPsSale > 0 && (
        <div className="text-right text-sm font-bold text-green-800 pt-1 border-t border-green-100">
          Total PS Sale: ₹{totalPsSale.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
        </div>
      )}
    </div>
  );
}

// ─── Mobile card: TP Sale section ─────────────────────────────────────────────
function TpSaleCards({ rows, onChange, tpCalc, totalTpSale }: {
  rows: TpSaleRow[];
  onChange: (r: TpSaleRow[]) => void;
  tpCalc: (TpSaleRow & { cashAmt: number; onlineAmt: number; totalQty: number; coTotal: number })[];
  totalTpSale: number;
}) {
  return (
    <div className="space-y-2">
      {tpCalc.map((r, i) => (
        <div key={i} className="border border-blue-100 rounded-lg p-3 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="font-semibold text-sm text-blue-900">{r.itemName}</span>
              <span className="ml-1.5 text-xs text-blue-500 font-medium">₹{r.rate}/pax</span>
            </div>
            {r.coTotal > 0 && <span className="text-xs font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">₹{r.coTotal.toLocaleString("en-IN")}</span>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] text-yellow-700 font-semibold uppercase">Cash Qty</label>
              <input type="number" inputMode="numeric" className="border border-yellow-200 rounded px-2 py-1.5 text-sm text-center outline-none bg-yellow-50"
                value={r.cashQty || ""} placeholder="0"
                onChange={e => onChange(rows.map((x, xi) => xi === i ? { ...x, cashQty: parseFloat(e.target.value) || 0 } : x))} />
              {r.cashAmt > 0 && <span className="text-[10px] text-center text-yellow-700">₹{r.cashAmt.toLocaleString("en-IN")}</span>}
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] text-blue-700 font-semibold uppercase">Online Qty</label>
              <input type="number" inputMode="numeric" className="border border-blue-200 rounded px-2 py-1.5 text-sm text-center outline-none bg-blue-50"
                value={r.onlineQty || ""} placeholder="0"
                onChange={e => onChange(rows.map((x, xi) => xi === i ? { ...x, onlineQty: parseFloat(e.target.value) || 0 } : x))} />
              {r.onlineAmt > 0 && <span className="text-[10px] text-center text-blue-700">₹{r.onlineAmt.toLocaleString("en-IN")}</span>}
            </div>
          </div>
          {r.totalQty > 0 && (
            <div className="mt-1.5 text-right text-xs text-gray-500">Total Qty: <span className="font-bold text-gray-700">{r.totalQty}</span></div>
          )}
        </div>
      ))}
      {totalTpSale > 0 && (
        <div className="text-right text-sm font-bold text-blue-800 pt-1 border-t border-blue-100">
          Total TP Sale: ₹{totalTpSale.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
        </div>
      )}
    </div>
  );
}

// ─── Mobile card: Manpower section ────────────────────────────────────────────
function ManpowerCards({ manpower, setManpower, mpCalc, totalMp, employees, skillRates }: {
  manpower: ManpowerItem[]; setManpower: (fn: (mp: ManpowerItem[]) => ManpowerItem[]) => void;
  mpCalc: (ManpowerItem & { pf: number; esic: number; bonus: number; leave: number; total: number })[];
  totalMp: number; employees: any[]; skillRates: any[];
}) {
  return (
    <div className="space-y-2">
      <datalist id="mc-emp-list">{employees.map((em: any) => <option key={em.id} value={em.name} />)}</datalist>
      {mpCalc.map((r, i) => (
        <div key={i} className="border border-indigo-100 rounded-lg p-3 bg-white shadow-sm">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-xs font-semibold text-gray-400 w-5">{r.slNo}.</span>
            <input list="mc-emp-list" className="flex-1 border border-gray-200 rounded px-2 py-1 text-sm bg-indigo-50 outline-none"
              value={r.employeeName} placeholder="Employee name…"
              onChange={e => setManpower(mp => mp.map((x, xi) => xi === i ? { ...x, employeeName: e.target.value } : x))}
              onBlur={e => {
                const emp = employees.find((em: any) => em.name === e.target.value);
                if (emp) {
                  const sr = skillRates.find((s: any) => s.skillCategory === emp.skills && s.year === new Date().getFullYear() && s.month === new Date().getMonth() + 1);
                  if (sr) setManpower(mp => mp.map((x, xi) => xi === i ? { ...x, basicWagesPerDay: Number(sr.dailyRate) } : x));
                }
              }} />
            <button onClick={() => setManpower(mp => mp.filter((_, xi) => xi !== i).map((x, xi) => ({ ...x, slNo: xi + 1 })))}
              className="text-red-400 hover:text-red-600 p-0.5 ml-1"><Trash2 className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-2 gap-1.5 mb-1.5">
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] text-gray-500 font-medium uppercase">Wages/Day ₹</label>
              <input type="number" inputMode="decimal" className="border border-yellow-200 rounded px-2 py-1.5 text-sm text-center outline-none bg-yellow-50"
                value={r.basicWagesPerDay || ""} placeholder="0"
                onChange={e => setManpower(mp => mp.map((x, xi) => xi === i ? { ...x, basicWagesPerDay: parseFloat(e.target.value) || 0 } : x))} />
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] text-purple-600 font-medium uppercase">Leave Bal ₹</label>
              <input type="number" inputMode="decimal" className="border border-purple-200 rounded px-2 py-1.5 text-sm text-center outline-none bg-purple-50"
                value={r.leaveBalance ?? 30} placeholder="30"
                onChange={e => setManpower(mp => mp.map((x, xi) => xi === i ? { ...x, leaveBalance: parseFloat(e.target.value) || 0 } : x))} />
            </div>
          </div>
          {r.basicWagesPerDay > 0 && (
            <div className="grid grid-cols-3 gap-1 text-[10px] text-center mb-1">
              <div className="bg-green-50 rounded px-1 py-0.5">
                <div className="text-green-600 font-medium">PF 13%</div>
                <div className="font-bold text-green-800">₹{r.pf.toFixed(2)}</div>
              </div>
              <div className="bg-blue-50 rounded px-1 py-0.5">
                <div className="text-blue-600 font-medium">ESIC 3.25%</div>
                <div className="font-bold text-blue-800">₹{r.esic.toFixed(2)}</div>
              </div>
              <div className="bg-orange-50 rounded px-1 py-0.5">
                <div className="text-orange-600 font-medium">Bonus 8.33%</div>
                <div className="font-bold text-orange-800">₹{r.bonus.toFixed(2)}</div>
              </div>
            </div>
          )}
          {r.total > 0 && (
            <div className="text-right text-xs font-bold text-indigo-700 pt-1 border-t border-indigo-50">
              Total: ₹{r.total.toFixed(2)}
            </div>
          )}
        </div>
      ))}
      <div className="flex items-center justify-between mt-1 pt-1.5 border-t">
        <button onClick={() => setManpower(mp => [...mp, { slNo: mp.length + 1, employeeName: "", basicWagesPerDay: 0, leaveBalance: 30 }])}
          className="flex items-center gap-1 text-blue-600 text-xs font-medium hover:text-blue-800">
          <Plus className="w-3.5 h-3.5" /> Add Employee
        </button>
        {totalMp > 0 && <span className="text-xs font-bold text-indigo-800">Total: ₹{totalMp.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function DailyPnlPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);
  const [tab, setTab]           = useState<"entry" | "dashboard">("entry");
  const [entryDate, setEntryDate] = useState(today());
  const [clientName, setClientName] = useState("KPF");
  const [entryId, setEntryId]   = useState<number | undefined>();
  const [dashMonth, setDashMonth] = useState(new Date().getMonth() + 1);
  const [dashYear,  setDashYear]  = useState(new Date().getFullYear());
  const [dashView,  setDashView]  = useState<"daily" | "monthly" | "yearly">("daily");
  const [repYear,   setRepYear]   = useState(new Date().getFullYear());
  const [repClient, setRepClient] = useState("");
  const [mobileView, setMobileView] = useState(false);

  // Expense states
  const [breakfast, setBreakfast] = useState<ExpenseItem[]>([makeExpItem(1), makeExpItem(2)]);
  const [lunch,     setLunch]     = useState<ExpenseItem[]>(LUNCH_FIXED.map((n, i) => makeExpItem(i + 1, n)));
  const [evening,   setEvening]   = useState<ExpenseItem[]>([makeExpItem(1), makeExpItem(2)]);
  const [night,     setNight]     = useState<ExpenseItem[]>([makeExpItem(1), makeExpItem(2)]);
  const [manpower,  setManpower]  = useState<ManpowerItem[]>([{ slNo: 1, employeeName: "", basicWagesPerDay: 0, leaveBalance: 30 }]);
  const [otherExpense, setOtherExpense] = useState(0);
  const [openingBalance, setOpeningBalance] = useState(0);

  // Sale states
  const [psSale, setPsSale] = useState<PsSaleRow[]>(PS_ROWS.map(makePsRow));
  const [tpSale, setTpSale] = useState<TpSaleRow[]>(TP_ROWS.map(makeTpRow));

  // ── Totals ────────────────────────────────────────────────────────────────
  const totalBf = breakfast.reduce((s, r) => s + r.total, 0);
  const totalLu = lunch.reduce((s, r) => s + r.total, 0);
  const totalEv = evening.reduce((s, r) => s + r.total, 0);
  const totalNt = night.reduce((s, r) => s + r.total, 0);
  const mpCalc = manpower.map(r => {
    const pf      = r.basicWagesPerDay * 0.13;
    const esic    = r.basicWagesPerDay * 0.0325;
    const bonus   = r.basicWagesPerDay * 0.0833;
    const leave   = r.leaveBalance ?? 30;
    const total   = r.basicWagesPerDay + pf + esic + bonus + leave;
    return { ...r, pf, esic, bonus, leave, total };
  });
  const totalMp = mpCalc.reduce((s, r) => s + r.total, 0);
  const totalExpense = totalBf + totalLu + totalEv + totalNt + totalMp + otherExpense;

  const psCalc = psSale.map(r => {
    const cashAmt   = r.cashQty   * r.cashRate;
    const onlineAmt = r.onlineQty * r.onlineRate;
    const coTotal   = cashAmt + onlineAmt;
    const billAmt   = r.billQty   * r.billRate;
    return { ...r, cashAmt, onlineAmt, coTotal, billAmt, totalAmt: coTotal + billAmt };
  });
  const totalPsSale = psCalc.reduce((s, r) => s + r.totalAmt, 0);

  const tpCalc = tpSale.map(r => {
    const cashAmt   = r.cashQty   * r.rate;
    const onlineAmt = r.onlineQty * r.rate;
    const totalQty  = r.cashQty   + r.onlineQty;
    const coTotal   = cashAmt + onlineAmt;
    return { ...r, cashAmt, onlineAmt, totalQty, coTotal };
  });
  const totalTpSale = tpCalc.reduce((s, r) => s + r.coTotal, 0);

  const totalSale    = totalPsSale + totalTpSale;
  const profitLoss   = totalSale - totalExpense;
  const cashFromPs   = psCalc.reduce((s, r) => s + r.cashAmt, 0);
  const cashFromTp   = tpCalc.reduce((s, r) => s + r.cashAmt, 0);
  const balanceInHand = openingBalance + cashFromPs + cashFromTp - totalExpense;

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: dbClients = [] } = useClientNames();
  const { data: employees  = [] } = useQuery<any[]>({
    queryKey: ["/api/employees", clientName],
    queryFn: () => fetch(`/api/employees${clientName ? `?clientName=${encodeURIComponent(clientName)}` : ""}`, { credentials: "include" }).then(r => r.json()),
  });
  const { data: skillRates = [] } = useQuery<any[]>({ queryKey: ["/api/skill-wage-rates"] });
  const { data: itemMasterData = [] } = useQuery<any[]>({
    queryKey: ["/api/item-master", "purchase"],
    queryFn: () => fetch("/api/item-master?type=purchase", { credentials: "include" }).then(r => r.json()),
  });
  const itemNames: string[] = (itemMasterData as any[]).map((v: any) => v.itemName).filter(Boolean);
  const itemMasterMap = new Map<string, { uom: string; rate: number }>(
    (itemMasterData as any[]).map((v: any) => [v.itemName, { uom: v.uom || "", rate: parseFloat(v.rate) || 0 }])
  );

  // ── BOM dish names + cost per person ──────────────────────────────────────

  const fetchBomItems = (mt: string) =>
    clientName
      ? fetch(`/api/bom-items?clientName=${encodeURIComponent(clientName)}&mealType=${mt}`, { credentials: "include" }).then(r => r.ok ? r.json() : [])
      : Promise.resolve([]);

  const { data: bomBreakfast = [] } = useQuery<any[]>({ queryKey: ["/api/bom-items", clientName, "breakfast"], queryFn: () => fetchBomItems("breakfast"), enabled: !!clientName });
  const { data: bomLunch     = [] } = useQuery<any[]>({ queryKey: ["/api/bom-items", clientName, "lunch"],     queryFn: () => fetchBomItems("lunch"),     enabled: !!clientName });
  const { data: bomEvening   = [] } = useQuery<any[]>({ queryKey: ["/api/bom-items", clientName, "evening"],   queryFn: () => fetchBomItems("evening"),   enabled: !!clientName });
  const { data: bomNight     = [] } = useQuery<any[]>({ queryKey: ["/api/bom-items", clientName, "night"],     queryFn: () => fetchBomItems("night"),     enabled: !!clientName });

  const { data: bomPriceList = [] } = useQuery<{ itemName: string; unitPrice: number; uom: string }[]>({
    queryKey: ["/api/purchase-invoices/last-prices"],
    queryFn: () => fetch("/api/purchase-invoices/last-prices", { credentials: "include" }).then(r => r.ok ? r.json() : []),
  });
  const bomPriceMap = useMemo(() => new Map(bomPriceList.map(p => [p.itemName.toLowerCase(), p])), [bomPriceList]);

  const { data: itemMasterForBom = [] } = useQuery<{ itemName: string; uom: string; rate?: string }[]>({
    queryKey: ["/api/item-master", "bom-fallback"],
    queryFn: () => fetch("/api/item-master", { credentials: "include" }).then(r => r.ok ? r.json() : []),
  });
  const itemMasterBomMap = useMemo(() =>
    new Map(itemMasterForBom.map(i => [i.itemName.toLowerCase(), { unitPrice: parseFloat(i.rate || '0') || 0, uom: i.uom || '' }])),
    [itemMasterForBom]
  );

  function qtyConverted(qty: number, bomUom: string, invUom: string): number {
    const b = bomUom.toLowerCase().trim();
    const iv = invUom.toLowerCase().trim();
    if (b === iv) return qty;
    if ((b === 'gm' || b === 'g') && iv === 'kg') return qty / 1000;
    if (b === 'ml' && (iv === 'l' || iv === 'litre' || iv === 'liter' || iv === 'ltr')) return qty / 1000;
    if (b === 'kg' && (iv === 'gm' || iv === 'g')) return qty * 1000;
    if ((b === 'l' || b === 'litre') && iv === 'ml') return qty * 1000;
    return qty;
  }

  function resolveBomPrice(ingredientName: string): { unitPrice: number; uom: string } | null {
    const key = ingredientName.toLowerCase().trim();
    // 1. Exact — invoice
    const inv = bomPriceMap.get(key);
    if (inv && inv.unitPrice > 0) return inv;
    // 2. Exact — item master
    const im = itemMasterBomMap.get(key);
    if (im && im.unitPrice > 0) return im;
    // 3. Partial — invoice
    for (const [mk, mv] of bomPriceMap) {
      if (mv.unitPrice > 0 && (key.includes(mk) || mk.includes(key))) return mv;
    }
    // 4. Partial — item master
    for (const [mk, mv] of itemMasterBomMap) {
      if (mv.unitPrice > 0 && (key.includes(mk) || mk.includes(key))) return mv;
    }
    return null;
  }

  function buildDishCost(items: any[]): Map<string, number> {
    const m = new Map<string, number>();
    items.forEach((item: any) => {
      const dish = (item.dishName || "").trim();
      if (!dish) return;
      let priceEntry = resolveBomPrice(item.ingredientName || "");
      // Fallback: use manual rate saved on the BOM item itself
      if (!priceEntry && item.manualRate && parseFloat(item.manualRate) > 0) {
        priceEntry = { unitPrice: parseFloat(item.manualRate), uom: item.uom || '' };
      }
      if (!priceEntry) return;
      const converted = qtyConverted(parseFloat(item.qtyPerPerson || "0"), item.uom || '', priceEntry.uom);
      m.set(dish, (m.get(dish) || 0) + priceEntry.unitPrice * converted);
    });
    return m;
  }

  const bomBreakfastCost = useMemo(() => buildDishCost(bomBreakfast), [bomBreakfast, bomPriceMap, itemMasterBomMap]);
  const bomLunchCost     = useMemo(() => buildDishCost(bomLunch),     [bomLunch,     bomPriceMap, itemMasterBomMap]);
  const bomEveningCost   = useMemo(() => buildDishCost(bomEvening),   [bomEvening,   bomPriceMap, itemMasterBomMap]);
  const bomNightCost     = useMemo(() => buildDishCost(bomNight),     [bomNight,     bomPriceMap, itemMasterBomMap]);

  const bomBreakfastNames = useMemo(() => [...new Set(bomBreakfast.map((i: any) => i.dishName))].filter(Boolean) as string[], [bomBreakfast]);
  const bomLunchNames     = useMemo(() => [...new Set(bomLunch.map((i: any)     => i.dishName))].filter(Boolean) as string[], [bomLunch]);
  const bomEveningNames   = useMemo(() => [...new Set(bomEvening.map((i: any)   => i.dishName))].filter(Boolean) as string[], [bomEvening]);
  const bomNightNames     = useMemo(() => [...new Set(bomNight.map((i: any)     => i.dishName))].filter(Boolean) as string[], [bomNight]);

  const makeBomRows = (names: string[], fallbackCount = 2): ExpenseItem[] =>
    names.length
      ? names.map((n, i) => makeExpItem(i + 1, n))
      : Array.from({ length: fallbackCount }, (_, i) => makeExpItem(i + 1));

  const loadCashSeal = useCallback(async () => {
    if (!entryDate) return;
    const r  = await fetch(`/api/daily-pnl/cash-seal?date=${entryDate}`, { credentials: "include" });
    const cs = await r.json();
    if (!cs) return;
    setPsSale(PS_ROWS.map((row, i) => ({
      slNo: i + 1, itemName: row.itemName, billQty: 0,
      cashRate: row.cashRate, onlineRate: row.onlineRate, billRate: row.billRate,
      cashQty:   Number(cs[row.cashKey])   || 0,
      onlineQty: Number(cs[row.onlineKey]) || 0,
    })));
    setTpSale(TP_ROWS.map((row, i) => ({
      slNo: i + 1, itemName: row.itemName, rate: row.rate,
      cashQty:   Number(cs[row.cashKey])   || 0,
      onlineQty: Number(cs[row.onlineKey]) || 0,
    })));
  }, [entryDate]);

  const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

  const buildManpowerFromEmployees = useCallback(() => {
    const dayName = DAY_NAMES[new Date(entryDate + "T00:00:00").getDay()];
    const activeEmps = (employees as any[]).filter(e => e.weeklyOffDay !== dayName);
    if (!activeEmps.length) return [{ slNo: 1, employeeName: "", basicWagesPerDay: 0 }];
    const now = new Date();
    const curMonth = now.getMonth() + 1;
    const curYear  = now.getFullYear();
    return activeEmps.map((e: any, idx: number) => {
      const sr = (skillRates as any[]).find(s => s.skillCategory === e.skills && s.year === curYear && s.month === curMonth);
      return { slNo: idx + 1, employeeName: e.name, basicWagesPerDay: sr ? Number(sr.dailyRate) : 0, leaveBalance: 30 };
    });
  }, [entryDate, employees, skillRates]);

  const loadEntry = useCallback(async () => {
    if (!entryDate) return;
    const r    = await fetch(`/api/daily-pnl/entry?date=${entryDate}&client=${encodeURIComponent(clientName)}`, { credentials: "include" });
    const data = await r.json();
    if (data) {
      setEntryId(data.id);
      const parse = (s: any) => { try { return JSON.parse(s || "[]"); } catch { return []; } };
      const bf = parse(data.breakfastItems); setBreakfast(bf.length ? bf : makeBomRows(bomBreakfastNames));
      const lu = parse(data.lunchItems);     setLunch(lu.length ? lu : LUNCH_FIXED.map((n, i) => makeExpItem(i + 1, n)));
      const ev = parse(data.eveningItems);   setEvening(ev.length ? ev : makeBomRows(bomEveningNames));
      const nt = parse(data.nightItems);     setNight(nt.length ? nt : makeBomRows(bomNightNames));
      const mp = parse(data.manpowerItems);  setManpower(mp.length ? mp.map((r: any) => ({ leaveBalance: 30, ...r })) : buildManpowerFromEmployees());
      const ps = parse(data.psSaleItems);
      setPsSale(ps.length ? ps.map((r: any, i: number) => ({ ...r, cashRate: PS_ROWS[i]?.cashRate ?? 5, onlineRate: PS_ROWS[i]?.onlineRate ?? 5, billRate: PS_ROWS[i]?.billRate ?? 30 })) : PS_ROWS.map(makePsRow));
      const tp = parse(data.saleItems);      setTpSale(tp.length ? tp : TP_ROWS.map(makeTpRow));
      setOtherExpense(Number(data.otherExpense) || 0);
      setOpeningBalance(Number(data.openingBalance) || 0);
    } else {
      setEntryId(undefined);
      setBreakfast(makeBomRows(bomBreakfastNames));
      setLunch(LUNCH_FIXED.map((n, i) => makeExpItem(i + 1, n)));
      setEvening(makeBomRows(bomEveningNames));
      setNight(makeBomRows(bomNightNames));
      setManpower(buildManpowerFromEmployees());
      setOtherExpense(0);
      setPsSale(PS_ROWS.map(makePsRow));
      setTpSale(TP_ROWS.map(makeTpRow));
      await loadCashSeal();
      // Auto-populate opening balance from previous day's balance in hand
      if (clientName) {
        try {
          const pb = await fetch(`/api/daily-pnl/prev-balance?date=${entryDate}&client=${encodeURIComponent(clientName)}`, { credentials: "include" });
          const { balance } = await pb.json();
          setOpeningBalance(Number(balance) || 0);
        } catch { setOpeningBalance(0); }
      } else {
        setOpeningBalance(0);
      }
    }
  }, [entryDate, clientName, loadCashSeal, buildManpowerFromEmployees, bomBreakfastNames, bomEveningNames, bomNightNames]);

  useEffect(() => { loadEntry(); }, [loadEntry]);

  const fetchLastPrice = async (items: ExpenseItem[], i: number, setter: (r: ExpenseItem[]) => void, bomCostMap?: Map<string, number>) => {
    const name = items[i]?.itemName?.trim();
    if (!name) return;
    const updates: Partial<ExpenseItem> = {};

    // 1. Try BOM dish cost (cost per person for that dish)
    if (items[i].rate === 0 && bomCostMap) {
      const bomCost = bomCostMap.get(name);
      if (bomCost && bomCost > 0) {
        updates.rate  = parseFloat(bomCost.toFixed(2));
        updates.total = items[i].qty * updates.rate;
        return setter(items.map((x, xi) => xi === i ? { ...x, ...updates } : x));
      }
    }

    // 2. Fall back to item master + last purchase price API
    const masterInfo = itemMasterMap.get(name);
    if (!items[i].uom && masterInfo?.uom) updates.uom = masterInfo.uom;
    if (items[i].rate === 0) {
      const r = await fetch(`/api/daily-pnl/last-price?item=${encodeURIComponent(name)}`, { credentials: "include" });
      const { price } = await r.json();
      if (price > 0) {
        updates.rate = price;
        updates.total = items[i].qty * price;
      } else if (masterInfo?.rate && masterInfo.rate > 0) {
        updates.rate = masterInfo.rate;
        updates.total = items[i].qty * masterInfo.rate;
      }
    }
    if (Object.keys(updates).length > 0)
      setter(items.map((x, xi) => xi === i ? { ...x, ...updates } : x));
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        id: entryId, entryDate, clientName,
        breakfastItems: JSON.stringify(breakfast),
        lunchItems:     JSON.stringify(lunch),
        eveningItems:   JSON.stringify(evening),
        nightItems:     JSON.stringify(night),
        manpowerItems:  JSON.stringify(manpower),
        psSaleItems:    JSON.stringify(psSale),
        saleItems:      JSON.stringify(tpSale),
        otherExpense:   otherExpense.toFixed(2),
        totalExpense:   totalExpense.toFixed(2),
        totalSale:      totalSale.toFixed(2),
        profitLoss:     profitLoss.toFixed(2),
        openingBalance: openingBalance.toFixed(2),
        balanceInHand:  balanceInHand.toFixed(2),
      };
      const r = await fetch("/api/daily-pnl/entry", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      return r.json();
    },
    onSuccess: (data) => {
      setEntryId(data.id);
      toast({ title: "Saved", description: `P&L for ${fmtDate(entryDate)} saved.` });
      qc.invalidateQueries({ queryKey: ["/api/daily-pnl/month-summary"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<html><head><title>Daily P&L — ${fmtDate(entryDate)}</title><style>
      *{box-sizing:border-box;}body{font-family:"Times New Roman",serif;margin:0;font-size:10pt;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      h2,h3,p{text-align:center;margin:2px 0;}
      table{width:100%;border-collapse:collapse;margin-bottom:8px;}
      th,td{border:1px solid #333;padding:2px 4px;font-size:9pt;}
      @media print{@page{margin:8mm;size:A4 portrait;}body{margin:0;}}
    </style></head><body>${content}</body></html>`);
    win.document.close(); win.print();
  };

  const { data: dashData = [] } = useQuery<any[]>({
    queryKey: ["/api/daily-pnl/month-summary", dashMonth, dashYear],
    queryFn: () => fetch(`/api/daily-pnl/month-summary?month=${dashMonth}&year=${dashYear}`, { credentials: "include" }).then(r => r.json()),
    enabled: tab === "dashboard" && dashView === "daily",
  });

  const { data: monthlyData = [] } = useQuery<any[]>({
    queryKey: ["/api/daily-pnl/monthly-report", repYear, repClient],
    queryFn: () => fetch(`/api/daily-pnl/monthly-report?year=${repYear}${repClient ? `&client=${encodeURIComponent(repClient)}` : ""}`, { credentials: "include" }).then(r => r.json()),
    enabled: tab === "dashboard" && dashView === "monthly",
  });

  const { data: yearlyData = [] } = useQuery<any[]>({
    queryKey: ["/api/daily-pnl/yearly-report", repClient],
    queryFn: () => fetch(`/api/daily-pnl/yearly-report${repClient ? `?client=${encodeURIComponent(repClient)}` : ""}`, { credentials: "include" }).then(r => r.json()),
    enabled: tab === "dashboard" && dashView === "yearly",
  });

  // ── Table style helpers ───────────────────────────────────────────────────
  const thExp  = { border: "1px solid #ddd", padding: "4px 5px", textAlign: "center" as const, background: "#78350f", color: "#fff", fontWeight: "bold", fontSize: 11 };
  const thPS   = { border: "1px solid #ddd", padding: "4px 5px", textAlign: "center" as const, background: "#166534", color: "#fff", fontWeight: "bold", fontSize: 11 };
  const thTP   = { border: "1px solid #ddd", padding: "4px 5px", textAlign: "center" as const, background: "#1e3a8a", color: "#fff", fontWeight: "bold", fontSize: 11 };
  const thDash = { border: "1px solid #ddd", padding: "4px 6px", textAlign: "center" as const, background: "#78350f", color: "#fff", fontWeight: "bold", fontSize: 11 };
  const tdS    = { border: "1px solid #ddd", padding: "2px 5px", fontSize: 11, textAlign: "center" as const };
  const tdTot  = { border: "1px solid #333", padding: "3px 6px", textAlign: "center" as const, fontWeight: "bold", fontSize: 11, background: "#e8f0fe" };

  return (
    <Layout>
      {/* Page Header */}
      <div className="bg-gradient-to-r from-amber-700 to-orange-600 text-white px-4 py-3 flex flex-wrap items-center gap-3 rounded-t-lg -mx-3 sm:-mx-4 md:-mx-8 -mt-3 sm:-mt-4 md:-mt-8 mb-0">
        <h1 className="text-lg font-bold flex items-center gap-2"><BarChart3 className="w-5 h-5" /> Daily P&amp;L</h1>
        <div className="flex gap-2 ml-auto">
          <button onClick={() => setTab("entry")} className={`px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1 ${tab === "entry" ? "bg-white text-amber-700" : "bg-amber-800/50 text-white hover:bg-amber-800"}`} data-testid="btn-pnl-entry-tab">
            <ClipboardEdit className="w-3.5 h-3.5" /> Entry
          </button>
          <button onClick={() => setTab("dashboard")} className={`px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1 ${tab === "dashboard" ? "bg-white text-amber-700" : "bg-amber-800/50 text-white hover:bg-amber-800"}`} data-testid="btn-pnl-dashboard-tab">
            <BarChart3 className="w-3.5 h-3.5" /> Dashboard
          </button>
        </div>
      </div>

      {/* ── Sticky Active Panel ── */}
      {tab === "entry" && (
        <div className="sticky top-[52px] md:top-0 z-10 bg-white border-b border-amber-200 shadow-md px-3 py-2 -mx-3 sm:-mx-4 md:-mx-8">
          {/* Row 1: Date + Client + Load */}
          <div className="flex flex-wrap items-center gap-2 mb-2 sm:mb-0 sm:inline-flex sm:w-auto">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-gray-500">Date:</span>
              <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1 text-sm w-36" data-testid="input-pnl-date" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-gray-500">Client:</span>
              <select value={clientName} onChange={e => setClientName(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1 text-sm max-w-[160px]" data-testid="input-pnl-client">
                <option value="">— Select —</option>
                {(dbClients as any[]).map((c: any) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
            <button onClick={loadEntry} className="px-3 py-1.5 border border-gray-300 rounded text-xs font-medium flex items-center gap-1 hover:bg-gray-50 bg-white" data-testid="btn-pnl-load">
              <RefreshCw className="w-3.5 h-3.5" /> Load
            </button>
          </div>
          {/* Row 1 (desktop) / Row 2 (mobile): action buttons */}
          <div className="flex items-center gap-2 sm:float-right sm:mt-[-30px]">
            <button onClick={() => setMobileView(v => !v)}
              className={`flex-1 sm:flex-none px-3 py-1.5 border rounded text-xs font-medium flex items-center justify-center gap-1 ${mobileView ? "bg-amber-100 border-amber-400 text-amber-800" : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"}`}
              data-testid="btn-pnl-mobile-view" title={mobileView ? "Switch to table view" : "Switch to card view"}>
              {mobileView ? <Table2 className="w-3.5 h-3.5" /> : <LayoutList className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{mobileView ? "Table" : "Cards"}</span>
            </button>
            <button onClick={handlePrint} className="flex-1 sm:flex-none px-3 py-1.5 border border-gray-300 rounded text-xs font-medium flex items-center justify-center gap-1 hover:bg-gray-50 bg-white" data-testid="btn-pnl-print">
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
            <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}
              className="flex-1 sm:flex-none px-4 py-1.5 rounded text-xs font-bold flex items-center justify-center gap-1 bg-amber-700 text-white hover:bg-amber-800 disabled:opacity-50" data-testid="btn-pnl-save">
              {saveMut.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
            </button>
          </div>
          <div className="clear-both" />
          {clientName && (
            <div className="text-xs text-amber-700 font-medium mt-0.5">{clientName} — {fmtDate(entryDate)}{entryId ? " ✓ Loaded" : " · New Entry"}</div>
          )}
        </div>
      )}

      <div className="max-w-6xl mx-auto px-3 py-4 pb-6">

        {/* ═══ ENTRY TAB ═══ */}
        {tab === "entry" && (
          <>

            <div ref={printRef}>
              <div className="text-center mb-3">
                <h2 className="text-base font-bold">Daily P&amp;L — {fmtDate(entryDate)}</h2>
                <p className="text-xs text-gray-600">Client: {clientName}</p>
              </div>

              {/* ─── EXPENSE ─── */}
              <div className="bg-white rounded-lg shadow-sm p-3 mb-4">
                <div className="text-center font-bold py-1 mb-3 text-white text-sm rounded" style={{ background: "#78350f" }}>EXPENSE</div>

                <Section title="Breakfast" color="#92400e">
                  {mobileView
                    ? <ExpenseCards rows={breakfast} onChange={setBreakfast} itemNames={bomBreakfastNames.length ? bomBreakfastNames : itemNames} color="#92400e"
                        onAdd={() => setBreakfast(r => [...r, makeExpItem(r.length + 1)])}
                        onDelete={i => setBreakfast(r => r.filter((_, xi) => xi !== i).map((x, xi) => ({ ...x, slNo: xi + 1 })))}
                        onBlurItem={i => fetchLastPrice(breakfast, i, setBreakfast, bomBreakfastCost)} />
                    : <ExpenseTable rows={breakfast} onChange={setBreakfast} itemNames={bomBreakfastNames.length ? bomBreakfastNames : itemNames}
                        onAdd={() => setBreakfast(r => [...r, makeExpItem(r.length + 1)])}
                        onDelete={i => setBreakfast(r => r.filter((_, xi) => xi !== i).map((x, xi) => ({ ...x, slNo: xi + 1 })))}
                        onBlurItem={i => fetchLastPrice(breakfast, i, setBreakfast, bomBreakfastCost)} />}
                </Section>
                <Section title="Lunch" color="#92400e">
                  {mobileView
                    ? <ExpenseCards rows={lunch} onChange={setLunch} itemNames={bomLunchNames.length ? bomLunchNames : itemNames} color="#92400e"
                        onAdd={() => setLunch(r => [...r, makeExpItem(r.length + 1)])}
                        onDelete={i => setLunch(r => r.filter((_, xi) => xi !== i).map((x, xi) => ({ ...x, slNo: xi + 1 })))}
                        onBlurItem={i => fetchLastPrice(lunch, i, setLunch, bomLunchCost)} />
                    : <ExpenseTable rows={lunch} onChange={setLunch} itemNames={bomLunchNames.length ? bomLunchNames : itemNames}
                        onAdd={() => setLunch(r => [...r, makeExpItem(r.length + 1)])}
                        onDelete={i => setLunch(r => r.filter((_, xi) => xi !== i).map((x, xi) => ({ ...x, slNo: xi + 1 })))}
                        onBlurItem={i => fetchLastPrice(lunch, i, setLunch, bomLunchCost)} />}
                </Section>
                <Section title="Evening Snacks" color="#92400e">
                  {mobileView
                    ? <ExpenseCards rows={evening} onChange={setEvening} itemNames={bomEveningNames.length ? bomEveningNames : itemNames} color="#92400e"
                        onAdd={() => setEvening(r => [...r, makeExpItem(r.length + 1)])}
                        onDelete={i => setEvening(r => r.filter((_, xi) => xi !== i).map((x, xi) => ({ ...x, slNo: xi + 1 })))}
                        onBlurItem={i => fetchLastPrice(evening, i, setEvening, bomEveningCost)} />
                    : <ExpenseTable rows={evening} onChange={setEvening} itemNames={bomEveningNames.length ? bomEveningNames : itemNames}
                        onAdd={() => setEvening(r => [...r, makeExpItem(r.length + 1)])}
                        onDelete={i => setEvening(r => r.filter((_, xi) => xi !== i).map((x, xi) => ({ ...x, slNo: xi + 1 })))}
                        onBlurItem={i => fetchLastPrice(evening, i, setEvening, bomEveningCost)} />}
                </Section>
                <Section title="Night Snacks" color="#92400e">
                  {mobileView
                    ? <ExpenseCards rows={night} onChange={setNight} itemNames={bomNightNames.length ? bomNightNames : itemNames} color="#92400e"
                        onAdd={() => setNight(r => [...r, makeExpItem(r.length + 1)])}
                        onDelete={i => setNight(r => r.filter((_, xi) => xi !== i).map((x, xi) => ({ ...x, slNo: xi + 1 })))}
                        onBlurItem={i => fetchLastPrice(night, i, setNight, bomNightCost)} />
                    : <ExpenseTable rows={night} onChange={setNight} itemNames={bomNightNames.length ? bomNightNames : itemNames}
                        onAdd={() => setNight(r => [...r, makeExpItem(r.length + 1)])}
                        onDelete={i => setNight(r => r.filter((_, xi) => xi !== i).map((x, xi) => ({ ...x, slNo: xi + 1 })))}
                        onBlurItem={i => fetchLastPrice(night, i, setNight, bomNightCost)} />}
                </Section>

                {/* Manpower */}
                <Section title="Daily Manpower" color="#1e3a8a">
                  {mobileView ? (
                    <ManpowerCards manpower={manpower} setManpower={setManpower} mpCalc={mpCalc} totalMp={totalMp} employees={employees as any[]} skillRates={skillRates as any[]} />
                  ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse" style={{ fontSize: 11 }}>
                      <thead>
                        <tr>
                          <th style={{ ...thTP, width: 30 }}>Sl.No</th>
                          <th style={{ ...thTP, minWidth: 140 }}>Employee Name</th>
                          <th style={{ ...thTP, width: 100 }}>Basic Wages / Day (₹)</th>
                          <th style={{ ...thTP, width: 75 }}>PF @13%</th>
                          <th style={{ ...thTP, width: 80 }}>ESIC @3.25%</th>
                          <th style={{ ...thTP, width: 85 }}>Bonus @8.33%</th>
                          <th style={{ ...thTP, width: 110 }}>Leave Balance Amt (₹)</th>
                          <th style={{ ...thTP, width: 95 }}>Total Amount</th>
                          <th style={{ ...thTP, width: 26 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {mpCalc.map((r, i) => (
                          <tr key={i}>
                            <td style={{ ...tdS }}>{r.slNo}</td>
                            <td style={{ border: "1px solid #ddd", padding: "2px 4px" }}>
                              <input list="emp-list" className="w-full border-0 outline-none bg-transparent text-xs" value={r.employeeName}
                                onChange={e => setManpower(mp => mp.map((x, xi) => xi === i ? { ...x, employeeName: e.target.value } : x))}
                                onBlur={e => {
                                  const emp = (employees as any[]).find(em => em.name === e.target.value);
                                  if (emp) {
                                    const sr = (skillRates as any[]).find(s => s.skillCategory === emp.skills && s.year === new Date().getFullYear() && s.month === new Date().getMonth() + 1);
                                    if (sr) setManpower(mp => mp.map((x, xi) => xi === i ? { ...x, basicWagesPerDay: Number(sr.dailyRate) } : x));
                                  }
                                }} />
                              <datalist id="emp-list">{(employees as any[]).map((em: any) => <option key={em.id} value={em.name} />)}</datalist>
                            </td>
                            <td style={{ border: "1px solid #ddd", padding: "2px 4px", background: "#fffde7" }}>
                              <input type="number" className="w-full border-0 outline-none bg-transparent text-xs text-center" value={r.basicWagesPerDay||""}
                                onChange={e => setManpower(mp => mp.map((x, xi) => xi === i ? { ...x, basicWagesPerDay: parseFloat(e.target.value)||0 } : x))} />
                            </td>
                            <td style={{ ...tdS, background: "#e8f5e9", color: "#1b5e20" }}>{r.pf > 0 ? r.pf.toFixed(2) : ""}</td>
                            <td style={{ ...tdS, background: "#e3f2fd", color: "#0d47a1" }}>{r.esic > 0 ? r.esic.toFixed(2) : ""}</td>
                            <td style={{ ...tdS, background: "#fff3e0", color: "#e65100" }}>{r.bonus > 0 ? r.bonus.toFixed(2) : ""}</td>
                            <td style={{ border: "1px solid #ddd", padding: "2px 4px", background: "#f3e5f5" }}>
                              <input type="number" className="w-full border-0 outline-none bg-transparent text-xs text-center" value={r.leaveBalance ?? 30}
                                onChange={e => setManpower(mp => mp.map((x, xi) => xi === i ? { ...x, leaveBalance: parseFloat(e.target.value)||0 } : x))} />
                            </td>
                            <td style={{ ...tdS, fontWeight: "bold", background: "#f0fdf4", color: "#166534" }}>{r.total > 0 ? r.total.toFixed(2) : ""}</td>
                            <td style={{ ...tdS }}>
                              <button onClick={() => setManpower(mp => mp.filter((_, xi) => xi !== i).map((x, xi) => ({ ...x, slNo: xi + 1 })))} className="text-red-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                            </td>
                          </tr>
                        ))}
                        <tr>
                          <td colSpan={9} style={{ border: "1px solid #ddd", padding: 4, textAlign: "center" }}>
                            <button onClick={() => setManpower(mp => [...mp, { slNo: mp.length + 1, employeeName: "", basicWagesPerDay: 0, leaveBalance: 30 }])} className="flex items-center gap-1 mx-auto text-blue-600 text-xs">
                              <Plus className="w-3 h-3" /> Add Row
                            </button>
                          </td>
                        </tr>
                        <tr>
                          <td colSpan={7} style={{ ...tdTot, textAlign: "right" }}>Total Manpower Cost</td>
                          <td style={{ ...tdTot, color: "#166534" }}>{totalMp.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                          <td style={{ border: "1px solid #ddd" }} />
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  )}
                </Section>

                {/* Other expense */}
                <div className="flex flex-wrap items-center gap-4 mt-2 px-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Other Expense (₹):</span>
                    <input type="number" value={otherExpense||""} onChange={e => setOtherExpense(parseFloat(e.target.value)||0)}
                      className="border border-gray-300 rounded px-2 py-1 text-sm w-28" data-testid="input-pnl-other-expense" />
                  </div>
                  <div className="ml-auto">
                    <span className="font-bold text-sm">Total Expense: </span>
                    <span className="font-bold text-base text-red-700">{fmtINR(totalExpense)}</span>
                  </div>
                </div>
              </div>

              {/* ─── SALE PERMANENT STAFF ─── */}
              <div className="bg-white rounded-lg shadow-sm p-3 mb-4">
                <div className="text-center font-bold py-1 mb-2 text-white text-sm rounded" style={{ background: "#166534" }}>SALE PERMANENT STAFF</div>
                <div className="text-xs text-gray-500 mb-2 italic">
                  Cash &amp; Online Qty auto-loaded from Daily Cash Seal (PS). Breakfast ×₹5 · Lunch ×₹20 · Evening ×₹10 · Night ×₹10 | Bill: Breakfast ×₹30 · Lunch ×₹50 · Evening ×₹30 · Night ×₹17
                </div>
                {mobileView
                  ? <PsSaleCards rows={psSale} onChange={setPsSale} psCalc={psCalc} totalPsSale={totalPsSale} />
                  : <div className="overflow-x-auto">
                  <table className="w-full border-collapse" style={{ fontSize: 11 }}>
                    <thead>
                      <tr>
                        <th style={{ ...thPS, width: 38 }}>Sl No</th>
                        <th style={{ ...thPS, minWidth: 110 }}>Item Name</th>
                        <th style={{ ...thPS, width: 65 }}>Cash Qty</th>
                        <th style={{ ...thPS, width: 85 }}>Cash Amt (₹)</th>
                        <th style={{ ...thPS, width: 70 }}>Online Qty</th>
                        <th style={{ ...thPS, width: 90 }}>Online Amt (₹)</th>
                        <th style={{ ...thPS, width: 65 }}>Total Qty</th>
                        <th style={{ ...thPS, width: 100 }}>C&amp;O Total (₹)</th>
                        <th style={{ ...thPS, width: 65 }}>Bill Qty</th>
                        <th style={{ ...thPS, width: 85 }}>Bill Amt (₹)</th>
                        <th style={{ ...thPS, width: 100, background: "#14532d" }}>Total Amt (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {psCalc.map((r, i) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? "#f0fdf4" : "#fff" }}>
                          <td style={{ ...tdS }}>{r.slNo}</td>
                          <td style={{ ...tdS, textAlign: "left", fontWeight: "bold", paddingLeft: 8 }}>{r.itemName}</td>
                          <td style={{ ...tdS, background: "#fef3c7" }}>
                            <input type="number" className="w-full border-0 outline-none bg-transparent text-center text-xs" value={r.cashQty||""}
                              onChange={e => setPsSale(rows => rows.map((x, xi) => xi === i ? { ...x, cashQty: parseFloat(e.target.value)||0 } : x))} />
                          </td>
                          <td style={{ ...tdS, background: "#fef9c3" }}>{r.cashAmt.toLocaleString("en-IN")}</td>
                          <td style={{ ...tdS, background: "#e0f2fe" }}>
                            <input type="number" className="w-full border-0 outline-none bg-transparent text-center text-xs" value={r.onlineQty||""}
                              onChange={e => setPsSale(rows => rows.map((x, xi) => xi === i ? { ...x, onlineQty: parseFloat(e.target.value)||0 } : x))} />
                          </td>
                          <td style={{ ...tdS, background: "#dbeafe" }}>{r.onlineAmt.toLocaleString("en-IN")}</td>
                          <td style={{ ...tdS, fontWeight: "bold" }}>{r.cashQty + r.onlineQty}</td>
                          <td style={{ ...tdS, background: "#dcfce7", fontWeight: "bold" }}>{r.coTotal.toLocaleString("en-IN")}</td>
                          <td style={{ ...tdS, background: "#fce7f3" }}>
                            <input type="number" className="w-full border-0 outline-none bg-transparent text-center text-xs" value={r.billQty||""}
                              onChange={e => setPsSale(rows => rows.map((x, xi) => xi === i ? { ...x, billQty: parseFloat(e.target.value)||0 } : x))} />
                          </td>
                          <td style={{ ...tdS, background: "#fdf2f8" }}>{r.billAmt.toLocaleString("en-IN")}</td>
                          <td style={{ ...tdS, fontWeight: "bold", background: "#bbf7d0", fontSize: 12 }}>{r.totalAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                      <tr>
                        <td colSpan={10} style={{ ...tdTot, textAlign: "right", background: "#166534", color: "#fff" }}>Total PS Sale</td>
                        <td style={{ ...tdTot, background: "#166534", color: "#fff", fontSize: 12 }}>{fmtINR(totalPsSale)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>}
              </div>

              {/* ─── SALE THIRD PARTY ─── */}
              <div className="bg-white rounded-lg shadow-sm p-3 mb-4">
                <div className="text-center font-bold py-1 mb-2 text-white text-sm rounded" style={{ background: "#1e3a8a" }}>SALE THIRD PARTY</div>
                <div className="text-xs text-gray-500 mb-2 italic">
                  Rates: Breakfast ₹20 · Lunch Veg ₹35 · Egg ₹45 · Chicken ₹65 · Fish ₹55 · Evening ₹20 · Night ₹30
                </div>
                {mobileView
                  ? <TpSaleCards rows={tpSale} onChange={setTpSale} tpCalc={tpCalc} totalTpSale={totalTpSale} />
                  : <div className="overflow-x-auto">
                  <table className="w-full border-collapse" style={{ fontSize: 11 }}>
                    <thead>
                      <tr>
                        <th style={{ ...thTP, width: 38 }}>Sl No</th>
                        <th style={{ ...thTP, minWidth: 130 }}>Item Name</th>
                        <th style={{ ...thTP, width: 55 }}>Rate (₹)</th>
                        <th style={{ ...thTP, width: 65 }}>Cash Qty</th>
                        <th style={{ ...thTP, width: 85 }}>Cash Amt (₹)</th>
                        <th style={{ ...thTP, width: 70 }}>Online Qty</th>
                        <th style={{ ...thTP, width: 90 }}>Online Amt (₹)</th>
                        <th style={{ ...thTP, width: 70 }}>Total Qty</th>
                        <th style={{ ...thTP, width: 110, background: "#374151" }}>C&amp;O Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tpCalc.map((r, i) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? "#f9fafb" : "#fff" }}>
                          <td style={{ ...tdS }}>{r.slNo}</td>
                          <td style={{ ...tdS, textAlign: "left", fontWeight: "bold", paddingLeft: 8 }}>{r.itemName}</td>
                          <td style={{ ...tdS }}>{r.rate}</td>
                          <td style={{ ...tdS, background: "#fef3c7" }}>
                            <input type="number" className="w-full border-0 outline-none bg-transparent text-center text-xs" value={r.cashQty||""}
                              onChange={e => setTpSale(rows => rows.map((x, xi) => xi === i ? { ...x, cashQty: parseFloat(e.target.value)||0 } : x))} />
                          </td>
                          <td style={{ ...tdS, background: "#fef9c3" }}>{r.cashAmt > 0 ? r.cashAmt.toLocaleString("en-IN") : "—"}</td>
                          <td style={{ ...tdS, background: "#e0f2fe" }}>
                            <input type="number" className="w-full border-0 outline-none bg-transparent text-center text-xs" value={r.onlineQty||""}
                              onChange={e => setTpSale(rows => rows.map((x, xi) => xi === i ? { ...x, onlineQty: parseFloat(e.target.value)||0 } : x))} />
                          </td>
                          <td style={{ ...tdS, background: "#dbeafe" }}>{r.onlineAmt > 0 ? r.onlineAmt.toLocaleString("en-IN") : "—"}</td>
                          <td style={{ ...tdS, fontWeight: "bold" }}>{r.totalQty || "—"}</td>
                          <td style={{ ...tdS, fontWeight: "bold", background: "#eff6ff", fontSize: 12 }}>{r.coTotal > 0 ? r.coTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "—"}</td>
                        </tr>
                      ))}
                      <tr>
                        <td colSpan={7} style={{ ...tdTot, textAlign: "right", background: "#1e3a8a", color: "#fff" }}>Total TP Sale</td>
                        <td style={{ ...tdTot, background: "#1e3a8a", color: "#fff" }}>{tpCalc.reduce((s, r) => s + r.totalQty, 0)}</td>
                        <td style={{ ...tdTot, background: "#1e3a8a", color: "#fff", fontSize: 12 }}>{fmtINR(totalTpSale)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>}
              </div>

              {/* ─── P&L SUMMARY ─── */}
              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="grid grid-cols-2 gap-2 mb-3 text-center text-xs">
                  <div className="bg-green-50 border border-green-200 rounded p-2">
                    <div className="text-green-700 font-medium">PS Sale Total</div>
                    <div className="font-bold text-green-800">{fmtINR(totalPsSale)}</div>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded p-2">
                    <div className="text-blue-700 font-medium">TP Sale Total</div>
                    <div className="font-bold text-blue-800">{fmtINR(totalTpSale)}</div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center mb-3">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="text-xs text-red-500 font-medium mb-1">Total Expense</div>
                    <div className="text-lg font-bold text-red-700">{fmtINR(totalExpense)}</div>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="text-xs text-blue-500 font-medium mb-1">Total Sale (PS + TP)</div>
                    <div className="text-lg font-bold text-blue-700">{fmtINR(totalSale)}</div>
                  </div>
                  <div className={`border rounded-lg p-3 ${profitLoss >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                    <div className="flex items-center justify-center gap-1 text-xs font-medium mb-1" style={{ color: profitLoss >= 0 ? "#15803d" : "#b91c1c" }}>
                      {profitLoss >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                      Profit / Loss
                    </div>
                    <div className="text-lg font-bold" style={{ color: profitLoss >= 0 ? "#15803d" : "#b91c1c" }}>{fmtINR(Math.abs(profitLoss))}</div>
                    <div className="text-xs mt-0.5" style={{ color: profitLoss >= 0 ? "#15803d" : "#b91c1c" }}>{profitLoss >= 0 ? "Profit" : "Loss"}</div>
                  </div>
                </div>

                {/* ── Cash in Hand section ── */}
                <div className="border-t border-amber-200 pt-3">
                  <div className="text-xs font-semibold text-amber-800 mb-2 text-center">CASH IN HAND STATEMENT</div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-center text-xs">
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
                      <div className="text-amber-700 font-medium mb-1">Opening Balance</div>
                      <input
                        type="number"
                        value={openingBalance || ""}
                        onChange={e => setOpeningBalance(parseFloat(e.target.value) || 0)}
                        className="w-full text-center text-sm font-bold text-amber-800 border border-amber-300 rounded px-1 py-0.5 bg-white"
                        placeholder="0.00"
                        data-testid="input-opening-balance"
                      />
                      <div className="text-amber-500 text-[10px] mt-0.5">Auto from prev. day</div>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-2">
                      <div className="text-green-700 font-medium mb-1">Cash Received (PS)</div>
                      <div className="text-sm font-bold text-green-800">{fmtINR(cashFromPs)}</div>
                      <div className="text-green-500 text-[10px] mt-0.5">PS cash sales</div>
                    </div>
                    <div className="bg-teal-50 border border-teal-200 rounded-lg p-2">
                      <div className="text-teal-700 font-medium mb-1">Cash Received (TP)</div>
                      <div className="text-sm font-bold text-teal-800">{fmtINR(cashFromTp)}</div>
                      <div className="text-teal-500 text-[10px] mt-0.5">TP cash sales</div>
                    </div>
                    <div className={`border rounded-lg p-2 ${balanceInHand >= 0 ? "bg-emerald-50 border-emerald-300" : "bg-red-50 border-red-300"}`}>
                      <div className={`font-semibold mb-1 ${balanceInHand >= 0 ? "text-emerald-700" : "text-red-700"}`}>Balance in Hand</div>
                      <div className={`text-sm font-bold ${balanceInHand >= 0 ? "text-emerald-800" : "text-red-800"}`}>{fmtINR(Math.abs(balanceInHand))}</div>
                      <div className={`text-[10px] mt-0.5 ${balanceInHand >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {balanceInHand >= 0 ? "Opening + Cash In − Expenses" : "Deficit"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ═══ DASHBOARD / REPORTS TAB ═══ */}
        {tab === "dashboard" && (
          <div className="bg-white rounded-lg shadow-sm p-3">

            {/* Sub-tab bar */}
            <div className="flex gap-1 mb-4 border-b border-gray-200 pb-2">
              {(["daily","monthly","yearly"] as const).map(v => (
                <button key={v} onClick={() => setDashView(v)}
                  className={`px-4 py-1.5 rounded-t text-xs font-semibold capitalize transition-colors ${dashView === v ? "bg-amber-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                  data-testid={`btn-dash-${v}`}>
                  {v === "daily" ? "Daily" : v === "monthly" ? "Monthly Report" : "Yearly Report"}
                </button>
              ))}
            </div>

            {/* ── DAILY VIEW ── */}
            {dashView === "daily" && (
              <>
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-gray-600">Month:</span>
                    <select value={dashMonth} onChange={e => setDashMonth(Number(e.target.value))} className="border border-gray-300 rounded px-2 py-1 text-sm" data-testid="select-pnl-month">
                      {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-gray-600">Year:</span>
                    <select value={dashYear} onChange={e => setDashYear(Number(e.target.value))} className="border border-gray-300 rounded px-2 py-1 text-sm" data-testid="select-pnl-year">
                      {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                  <span className="text-xs font-semibold text-amber-700 ml-1">Daily P&amp;L — {MONTHS[dashMonth - 1]} {dashYear}</span>
                  <button onClick={() => {
                    const w = window.open("","_blank","width=900,height=600");
                    if (!w) return;
                    const rows = dashData as any[];
                    const totE = rows.reduce((s,r)=>s+Number(r.totalExpense||0),0);
                    const totS = rows.reduce((s,r)=>s+Number(r.totalSale||0),0);
                    const totP = rows.reduce((s,r)=>s+Number(r.profitLoss||0),0);
                    w.document.write(`<html><head><title>Daily P&L ${MONTHS[dashMonth-1]} ${dashYear}</title><style>body{font-family:Arial,sans-serif;font-size:11px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:4px 6px;text-align:center}th{background:#78350f;color:#fff}</style></head><body>
                      <h3 style="text-align:center">Daily P&L — ${MONTHS[dashMonth-1]} ${dashYear}</h3>
                      <table><thead><tr><th>Date</th><th>Client</th><th>Expense (₹)</th><th>Sale (₹)</th><th>P&L (₹)</th></tr></thead><tbody>
                      ${rows.map(r=>{const pl=Number(r.profitLoss)||0;return`<tr><td>${fmtDate(r.entryDate)}</td><td>${r.clientName}</td><td style="color:#b91c1c">${Number(r.totalExpense).toLocaleString("en-IN",{minimumFractionDigits:2})}</td><td style="color:#1d4ed8">${Number(r.totalSale).toLocaleString("en-IN",{minimumFractionDigits:2})}</td><td style="color:${pl>=0?"#166534":"#b91c1c"}">${pl>=0?"+":""}${pl.toLocaleString("en-IN",{minimumFractionDigits:2})}</td></tr>`;}).join("")}
                      <tr><td colspan="2"><b>Grand Total</b></td><td style="color:#b91c1c"><b>${totE.toLocaleString("en-IN",{minimumFractionDigits:2})}</b></td><td style="color:#1d4ed8"><b>${totS.toLocaleString("en-IN",{minimumFractionDigits:2})}</b></td><td style="color:${totP>=0?"#166534":"#b91c1c"}"><b>${totP>=0?"+":""}${totP.toLocaleString("en-IN",{minimumFractionDigits:2})}</b></td></tr>
                      </tbody></table></body></html>`);
                    w.document.close(); w.print();
                  }} className="ml-auto px-3 py-1.5 border rounded text-xs font-medium flex items-center gap-1 hover:bg-gray-50" data-testid="btn-dash-daily-print">
                    <Printer className="w-3.5 h-3.5" /> Print
                  </button>
                </div>
                {dashData.length === 0 ? (
                  <div className="text-center py-10 text-gray-400 text-sm">No entries for {MONTHS[dashMonth - 1]} {dashYear}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse" style={{ fontSize: 11 }}>
                      <thead>
                        <tr>
                          <th style={{ ...thDash, textAlign: "left", paddingLeft: 8 }}>Date</th>
                          <th style={thDash}>Client</th>
                          <th style={{ ...thDash, background: "#b91c1c" }}>Total Expense (₹)</th>
                          <th style={{ ...thDash, background: "#1d4ed8" }}>Total Sale (₹)</th>
                          <th style={{ ...thDash, background: "#166534" }}>Profit / Loss (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashData.map((r: any, i) => {
                          const pl = Number(r.profitLoss) || 0;
                          return (
                            <tr key={i} style={{ background: i % 2 === 0 ? "#f9fafb" : "#fff" }}>
                              <td style={{ ...tdS, textAlign: "left", fontWeight: 500 }}>{fmtDate(r.entryDate)}</td>
                              <td style={tdS}>{r.clientName}</td>
                              <td style={{ ...tdS, color: "#b91c1c", fontWeight: "bold" }}>{Number(r.totalExpense).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                              <td style={{ ...tdS, color: "#1d4ed8", fontWeight: "bold" }}>{Number(r.totalSale).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                              <td style={{ ...tdS, fontWeight: "bold", color: pl >= 0 ? "#166534" : "#b91c1c" }}>
                                {pl >= 0 ? "+" : ""}{pl.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          );
                        })}
                        {(() => {
                          const totExp  = dashData.reduce((s: number, r: any) => s + (Number(r.totalExpense) || 0), 0);
                          const totSale = dashData.reduce((s: number, r: any) => s + (Number(r.totalSale)    || 0), 0);
                          const totPl   = dashData.reduce((s: number, r: any) => s + (Number(r.profitLoss)   || 0), 0);
                          return (
                            <tr>
                              <td colSpan={2} style={tdTot}>Grand Total</td>
                              <td style={{ ...tdTot, color: "#b91c1c" }}>{totExp.toLocaleString("en-IN",  { minimumFractionDigits: 2 })}</td>
                              <td style={{ ...tdTot, color: "#1d4ed8" }}>{totSale.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                              <td style={{ ...tdTot, color: totPl >= 0 ? "#166534" : "#b91c1c" }}>
                                {totPl >= 0 ? "+" : ""}{totPl.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {/* ── MONTHLY REPORT ── */}
            {dashView === "monthly" && (
              <>
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-gray-600">Year:</span>
                    <select value={repYear} onChange={e => setRepYear(Number(e.target.value))} className="border border-gray-300 rounded px-2 py-1 text-sm" data-testid="select-rep-year">
                      {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-gray-600">Client:</span>
                    <select value={repClient} onChange={e => setRepClient(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm" data-testid="select-rep-client">
                      <option value="">All Clients</option>
                      {(dbClients as any[]).map((c: any) => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                  <span className="text-xs font-semibold text-amber-700 ml-1">Monthly Report — {repYear}{repClient ? ` · ${repClient}` : ""}</span>
                  <button onClick={() => {
                    const w = window.open("","_blank","width=900,height=600");
                    if (!w) return;
                    const rows = monthlyData as any[];
                    const totE = rows.reduce((s,r)=>s+Number(r.totalExpense||0),0);
                    const totS = rows.reduce((s,r)=>s+Number(r.totalSale||0),0);
                    const totP = rows.reduce((s,r)=>s+Number(r.profitLoss||0),0);
                    w.document.write(`<html><head><title>Monthly P&L ${repYear}</title><style>body{font-family:Arial,sans-serif;font-size:11px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:4px 8px;text-align:center}th{background:#78350f;color:#fff}</style></head><body>
                      <h3 style="text-align:center">Monthly P&L — ${repYear}${repClient?` · ${repClient}`:""}</h3>
                      <table><thead><tr><th>Month</th><th>Year</th><th>Total Expense (₹)</th><th>Total Sale (₹)</th><th>Profit / Loss (₹)</th></tr></thead><tbody>
                      ${rows.map(r=>{const pl=Number(r.profitLoss)||0;return`<tr><td>${MONTHS[Number(r.month)-1]}</td><td>${r.year}</td><td style="color:#b91c1c">${Number(r.totalExpense).toLocaleString("en-IN",{minimumFractionDigits:2})}</td><td style="color:#1d4ed8">${Number(r.totalSale).toLocaleString("en-IN",{minimumFractionDigits:2})}</td><td style="color:${pl>=0?"#166534":"#b91c1c"}">${pl>=0?"+":""}${pl.toLocaleString("en-IN",{minimumFractionDigits:2})}</td></tr>`;}).join("")}
                      <tr><td colspan="2"><b>Grand Total</b></td><td><b>${totE.toLocaleString("en-IN",{minimumFractionDigits:2})}</b></td><td><b>${totS.toLocaleString("en-IN",{minimumFractionDigits:2})}</b></td><td><b>${totP>=0?"+":""}${totP.toLocaleString("en-IN",{minimumFractionDigits:2})}</b></td></tr>
                      </tbody></table></body></html>`);
                    w.document.close(); w.print();
                  }} className="ml-auto px-3 py-1.5 border rounded text-xs font-medium flex items-center gap-1 hover:bg-gray-50" data-testid="btn-monthly-print">
                    <Printer className="w-3.5 h-3.5" /> Print
                  </button>
                </div>
                {monthlyData.length === 0 ? (
                  <div className="text-center py-10 text-gray-400 text-sm">No entries for {repYear}{repClient ? ` · ${repClient}` : ""}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse" style={{ fontSize: 11 }}>
                      <thead>
                        <tr>
                          <th style={{ ...thDash, textAlign: "left", paddingLeft: 8 }}>Month</th>
                          <th style={thDash}>Year</th>
                          <th style={{ ...thDash, background: "#b91c1c" }}>Total Expense (₹)</th>
                          <th style={{ ...thDash, background: "#1d4ed8" }}>Total Sale (₹)</th>
                          <th style={{ ...thDash, background: "#166534" }}>Profit / Loss (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyData.map((r: any, i) => {
                          const pl = Number(r.profitLoss) || 0;
                          return (
                            <tr key={i} style={{ background: i % 2 === 0 ? "#f9fafb" : "#fff" }}>
                              <td style={{ ...tdS, textAlign: "left", fontWeight: 600 }}>{MONTHS[Number(r.month) - 1]}</td>
                              <td style={tdS}>{r.year}</td>
                              <td style={{ ...tdS, color: "#b91c1c", fontWeight: "bold" }}>{Number(r.totalExpense).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                              <td style={{ ...tdS, color: "#1d4ed8", fontWeight: "bold" }}>{Number(r.totalSale).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                              <td style={{ ...tdS, fontWeight: "bold", color: pl >= 0 ? "#166534" : "#b91c1c" }}>
                                {pl >= 0 ? "+" : ""}{pl.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          );
                        })}
                        {(() => {
                          const totE = monthlyData.reduce((s: number, r: any) => s + (Number(r.totalExpense) || 0), 0);
                          const totS = monthlyData.reduce((s: number, r: any) => s + (Number(r.totalSale)    || 0), 0);
                          const totP = monthlyData.reduce((s: number, r: any) => s + (Number(r.profitLoss)   || 0), 0);
                          return (
                            <tr>
                              <td colSpan={2} style={tdTot}>Grand Total</td>
                              <td style={{ ...tdTot, color: "#b91c1c" }}>{totE.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                              <td style={{ ...tdTot, color: "#1d4ed8" }}>{totS.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                              <td style={{ ...tdTot, color: totP >= 0 ? "#166534" : "#b91c1c" }}>
                                {totP >= 0 ? "+" : ""}{totP.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {/* ── YEARLY REPORT ── */}
            {dashView === "yearly" && (
              <>
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-gray-600">Client:</span>
                    <select value={repClient} onChange={e => setRepClient(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm" data-testid="select-rep-client-yearly">
                      <option value="">All Clients</option>
                      {(dbClients as any[]).map((c: any) => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                  <span className="text-xs font-semibold text-amber-700 ml-1">Yearly Report{repClient ? ` · ${repClient}` : " · All Clients"}</span>
                  <button onClick={() => {
                    const w = window.open("","_blank","width=900,height=600");
                    if (!w) return;
                    const rows = yearlyData as any[];
                    const totE = rows.reduce((s,r)=>s+Number(r.totalExpense||0),0);
                    const totS = rows.reduce((s,r)=>s+Number(r.totalSale||0),0);
                    const totP = rows.reduce((s,r)=>s+Number(r.profitLoss||0),0);
                    w.document.write(`<html><head><title>Yearly P&L Report</title><style>body{font-family:Arial,sans-serif;font-size:11px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:4px 8px;text-align:center}th{background:#78350f;color:#fff}</style></head><body>
                      <h3 style="text-align:center">Yearly P&L Report${repClient?` · ${repClient}`:""}</h3>
                      <table><thead><tr><th>Year</th><th>Total Expense (₹)</th><th>Total Sale (₹)</th><th>Profit / Loss (₹)</th></tr></thead><tbody>
                      ${rows.map(r=>{const pl=Number(r.profitLoss)||0;return`<tr><td><b>${r.year}</b></td><td style="color:#b91c1c">${Number(r.totalExpense).toLocaleString("en-IN",{minimumFractionDigits:2})}</td><td style="color:#1d4ed8">${Number(r.totalSale).toLocaleString("en-IN",{minimumFractionDigits:2})}</td><td style="color:${pl>=0?"#166534":"#b91c1c"}">${pl>=0?"+":""}${pl.toLocaleString("en-IN",{minimumFractionDigits:2})}</td></tr>`;}).join("")}
                      <tr><td><b>Grand Total</b></td><td><b>${totE.toLocaleString("en-IN",{minimumFractionDigits:2})}</b></td><td><b>${totS.toLocaleString("en-IN",{minimumFractionDigits:2})}</b></td><td><b>${totP>=0?"+":""}${totP.toLocaleString("en-IN",{minimumFractionDigits:2})}</b></td></tr>
                      </tbody></table></body></html>`);
                    w.document.close(); w.print();
                  }} className="ml-auto px-3 py-1.5 border rounded text-xs font-medium flex items-center gap-1 hover:bg-gray-50" data-testid="btn-yearly-print">
                    <Printer className="w-3.5 h-3.5" /> Print
                  </button>
                </div>
                {yearlyData.length === 0 ? (
                  <div className="text-center py-10 text-gray-400 text-sm">No P&amp;L entries found{repClient ? ` for ${repClient}` : ""}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse" style={{ fontSize: 11 }}>
                      <thead>
                        <tr>
                          <th style={{ ...thDash, textAlign: "left", paddingLeft: 8 }}>Year</th>
                          <th style={{ ...thDash, background: "#b91c1c" }}>Total Expense (₹)</th>
                          <th style={{ ...thDash, background: "#1d4ed8" }}>Total Sale (₹)</th>
                          <th style={{ ...thDash, background: "#166534" }}>Profit / Loss (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {yearlyData.map((r: any, i) => {
                          const pl = Number(r.profitLoss) || 0;
                          return (
                            <tr key={i} style={{ background: i % 2 === 0 ? "#f9fafb" : "#fff" }}>
                              <td style={{ ...tdS, textAlign: "left", fontWeight: 700, fontSize: 12 }}>{r.year}</td>
                              <td style={{ ...tdS, color: "#b91c1c", fontWeight: "bold" }}>{Number(r.totalExpense).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                              <td style={{ ...tdS, color: "#1d4ed8", fontWeight: "bold" }}>{Number(r.totalSale).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                              <td style={{ ...tdS, fontWeight: "bold", color: pl >= 0 ? "#166534" : "#b91c1c" }}>
                                {pl >= 0 ? "+" : ""}{pl.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          );
                        })}
                        {(() => {
                          const totE = yearlyData.reduce((s: number, r: any) => s + (Number(r.totalExpense) || 0), 0);
                          const totS = yearlyData.reduce((s: number, r: any) => s + (Number(r.totalSale)    || 0), 0);
                          const totP = yearlyData.reduce((s: number, r: any) => s + (Number(r.profitLoss)   || 0), 0);
                          return (
                            <tr>
                              <td style={tdTot}>Grand Total</td>
                              <td style={{ ...tdTot, color: "#b91c1c" }}>{totE.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                              <td style={{ ...tdTot, color: "#1d4ed8" }}>{totS.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                              <td style={{ ...tdTot, color: totP >= 0 ? "#166534" : "#b91c1c" }}>
                                {totP >= 0 ? "+" : ""}{totP.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

          </div>
        )}
      </div>
    </Layout>
  );
}
