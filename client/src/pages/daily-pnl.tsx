import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useClientNames } from "@/hooks/use-reports";
import { RefreshCw, Save, Printer, TrendingUp, TrendingDown, Plus, Trash2, BarChart3, ClipboardEdit } from "lucide-react";
import { format } from "date-fns";

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
type ManpowerItem = { slNo: number; employeeName: string; basicWagesPerDay: number };
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

  // Expense states
  const [breakfast, setBreakfast] = useState<ExpenseItem[]>([makeExpItem(1), makeExpItem(2)]);
  const [lunch,     setLunch]     = useState<ExpenseItem[]>(LUNCH_FIXED.map((n, i) => makeExpItem(i + 1, n)));
  const [evening,   setEvening]   = useState<ExpenseItem[]>([makeExpItem(1), makeExpItem(2)]);
  const [night,     setNight]     = useState<ExpenseItem[]>([makeExpItem(1), makeExpItem(2)]);
  const [manpower,  setManpower]  = useState<ManpowerItem[]>([{ slNo: 1, employeeName: "", basicWagesPerDay: 0 }]);
  const [otherExpense, setOtherExpense] = useState(0);

  // Sale states
  const [psSale, setPsSale] = useState<PsSaleRow[]>(PS_ROWS.map(makePsRow));
  const [tpSale, setTpSale] = useState<TpSaleRow[]>(TP_ROWS.map(makeTpRow));

  // ── Totals ────────────────────────────────────────────────────────────────
  const totalBf = breakfast.reduce((s, r) => s + r.total, 0);
  const totalLu = lunch.reduce((s, r) => s + r.total, 0);
  const totalEv = evening.reduce((s, r) => s + r.total, 0);
  const totalNt = night.reduce((s, r) => s + r.total, 0);
  const totalMp = manpower.reduce((s, r) => s + r.basicWagesPerDay, 0);
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

  const totalSale  = totalPsSale + totalTpSale;
  const profitLoss = totalSale - totalExpense;

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: dbClients = [] } = useClientNames();
  const { data: employees  = [] } = useQuery<any[]>({
    queryKey: ["/api/employees", clientName],
    queryFn: () => fetch(`/api/employees${clientName ? `?clientName=${encodeURIComponent(clientName)}` : ""}`, { credentials: "include" }).then(r => r.json()),
  });
  const { data: skillRates = [] } = useQuery<any[]>({ queryKey: ["/api/skill-wage-rates"] });
  const { data: vegItems   = [] } = useQuery<any[]>({
    queryKey: ["/api/vegetables"],
    queryFn: () => fetch("/api/vegetables", { credentials: "include" }).then(r => r.json()),
  });
  const itemNames: string[] = (vegItems as any[]).map((v: any) => v.name).filter(Boolean);


  const loadCashSeal = useCallback(async () => {
    if (!entryDate) return;
    const r  = await fetch(`/api/daily-pnl/cash-seal?date=${entryDate}`, { credentials: "include" });
    const cs = await r.json();
    if (!cs) return;
    setPsSale(PS_ROWS.map((row, i) => ({
      slNo: i + 1, itemName: row.itemName, billQty: 0,
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
      return { slNo: idx + 1, employeeName: e.name, basicWagesPerDay: sr ? Number(sr.dailyRate) : 0 };
    });
  }, [entryDate, employees, skillRates]);

  const loadEntry = useCallback(async () => {
    if (!entryDate) return;
    const r    = await fetch(`/api/daily-pnl/entry?date=${entryDate}&client=${encodeURIComponent(clientName)}`, { credentials: "include" });
    const data = await r.json();
    if (data) {
      setEntryId(data.id);
      const parse = (s: any) => { try { return JSON.parse(s || "[]"); } catch { return []; } };
      const bf = parse(data.breakfastItems); setBreakfast(bf.length ? bf : [makeExpItem(1), makeExpItem(2)]);
      const lu = parse(data.lunchItems);     setLunch(lu.length ? lu : LUNCH_FIXED.map((n, i) => makeExpItem(i + 1, n)));
      const ev = parse(data.eveningItems);   setEvening(ev.length ? ev : [makeExpItem(1), makeExpItem(2)]);
      const nt = parse(data.nightItems);     setNight(nt.length ? nt : [makeExpItem(1), makeExpItem(2)]);
      const mp = parse(data.manpowerItems);  setManpower(mp.length ? mp : buildManpowerFromEmployees());
      const ps = parse(data.psSaleItems);
      setPsSale(ps.length ? ps.map((r: any, i: number) => ({ ...r, cashRate: PS_ROWS[i]?.cashRate ?? 5, onlineRate: PS_ROWS[i]?.onlineRate ?? 5, billRate: PS_ROWS[i]?.billRate ?? 30 })) : PS_ROWS.map(makePsRow));
      const tp = parse(data.saleItems);      setTpSale(tp.length ? tp : TP_ROWS.map(makeTpRow));
      setOtherExpense(Number(data.otherExpense) || 0);
    } else {
      setEntryId(undefined);
      setBreakfast([makeExpItem(1), makeExpItem(2)]);
      setLunch(LUNCH_FIXED.map((n, i) => makeExpItem(i + 1, n)));
      setEvening([makeExpItem(1), makeExpItem(2)]);
      setNight([makeExpItem(1), makeExpItem(2)]);
      setManpower(buildManpowerFromEmployees());
      setOtherExpense(0);
      setPsSale(PS_ROWS.map(makePsRow));
      setTpSale(TP_ROWS.map(makeTpRow));
      await loadCashSeal();
    }
  }, [entryDate, clientName, loadCashSeal, buildManpowerFromEmployees]);

  useEffect(() => { loadEntry(); }, [loadEntry]);

  const fetchLastPrice = async (items: ExpenseItem[], i: number, setter: (r: ExpenseItem[]) => void) => {
    const name = items[i]?.itemName?.trim();
    if (!name || items[i].rate > 0) return;
    const r = await fetch(`/api/daily-pnl/last-price?item=${encodeURIComponent(name)}`, { credentials: "include" });
    const { price } = await r.json();
    if (price > 0) setter(items.map((x, xi) => xi === i ? { ...x, rate: price, total: x.qty * price } : x));
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
    enabled: tab === "dashboard",
  });

  // ── Table style helpers ───────────────────────────────────────────────────
  const thExp  = { border: "1px solid #ddd", padding: "4px 5px", textAlign: "center" as const, background: "#78350f", color: "#fff", fontWeight: "bold", fontSize: 11 };
  const thPS   = { border: "1px solid #ddd", padding: "4px 5px", textAlign: "center" as const, background: "#166534", color: "#fff", fontWeight: "bold", fontSize: 11 };
  const thTP   = { border: "1px solid #ddd", padding: "4px 5px", textAlign: "center" as const, background: "#1e3a8a", color: "#fff", fontWeight: "bold", fontSize: 11 };
  const thDash = { border: "1px solid #ddd", padding: "4px 6px", textAlign: "center" as const, background: "#78350f", color: "#fff", fontWeight: "bold", fontSize: 11 };
  const tdS    = { border: "1px solid #ddd", padding: "2px 5px", fontSize: 11, textAlign: "center" as const };
  const tdTot  = { border: "1px solid #333", padding: "3px 6px", textAlign: "center" as const, fontWeight: "bold", fontSize: 11, background: "#e8f0fe" };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-700 to-orange-600 text-white px-4 py-3 flex flex-wrap items-center gap-3">
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

      <div className="max-w-6xl mx-auto px-3 py-4">

        {/* ═══ ENTRY TAB ═══ */}
        {tab === "entry" && (
          <>
            {/* Controls bar */}
            <div className="flex flex-wrap items-center gap-2 mb-4 bg-white rounded-lg shadow-sm p-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-gray-600">Date:</span>
                <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm" data-testid="input-pnl-date" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-gray-600">Client:</span>
                <select value={clientName} onChange={e => setClientName(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm" data-testid="input-pnl-client">
                  <option value="">— Select —</option>
                  {(dbClients as any[]).map((c: any) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
              <button onClick={loadEntry} className="px-3 py-1.5 border rounded text-xs font-medium flex items-center gap-1 hover:bg-gray-50" data-testid="btn-pnl-load">
                <RefreshCw className="w-3.5 h-3.5" /> Load
              </button>
              <div className="ml-auto flex gap-2">
                <button onClick={handlePrint} className="px-3 py-1.5 border rounded text-xs font-medium flex items-center gap-1 hover:bg-gray-50" data-testid="btn-pnl-print">
                  <Printer className="w-3.5 h-3.5" /> Print
                </button>
                <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}
                  className="px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1 bg-amber-700 text-white hover:bg-amber-800 disabled:opacity-50" data-testid="btn-pnl-save">
                  {saveMut.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
                </button>
              </div>
            </div>

            <div ref={printRef}>
              <div className="text-center mb-3">
                <h2 className="text-base font-bold">Daily P&amp;L — {fmtDate(entryDate)}</h2>
                <p className="text-xs text-gray-600">Client: {clientName}</p>
              </div>

              {/* ─── EXPENSE ─── */}
              <div className="bg-white rounded-lg shadow-sm p-3 mb-4">
                <div className="text-center font-bold py-1 mb-3 text-white text-sm rounded" style={{ background: "#78350f" }}>EXPENSE</div>

                <Section title="Breakfast" color="#92400e">
                  <ExpenseTable rows={breakfast} onChange={setBreakfast} itemNames={itemNames}
                    onAdd={() => setBreakfast(r => [...r, makeExpItem(r.length + 1)])}
                    onDelete={i => setBreakfast(r => r.filter((_, xi) => xi !== i).map((x, xi) => ({ ...x, slNo: xi + 1 })))}
                    onBlurItem={i => fetchLastPrice(breakfast, i, setBreakfast)} />
                </Section>
                <Section title="Lunch" color="#92400e">
                  <ExpenseTable rows={lunch} onChange={setLunch} itemNames={itemNames}
                    onAdd={() => setLunch(r => [...r, makeExpItem(r.length + 1)])}
                    onDelete={i => setLunch(r => r.filter((_, xi) => xi !== i).map((x, xi) => ({ ...x, slNo: xi + 1 })))}
                    onBlurItem={i => fetchLastPrice(lunch, i, setLunch)} />
                </Section>
                <Section title="Evening Snacks" color="#92400e">
                  <ExpenseTable rows={evening} onChange={setEvening} itemNames={itemNames}
                    onAdd={() => setEvening(r => [...r, makeExpItem(r.length + 1)])}
                    onDelete={i => setEvening(r => r.filter((_, xi) => xi !== i).map((x, xi) => ({ ...x, slNo: xi + 1 })))}
                    onBlurItem={i => fetchLastPrice(evening, i, setEvening)} />
                </Section>
                <Section title="Night Snacks" color="#92400e">
                  <ExpenseTable rows={night} onChange={setNight} itemNames={itemNames}
                    onAdd={() => setNight(r => [...r, makeExpItem(r.length + 1)])}
                    onDelete={i => setNight(r => r.filter((_, xi) => xi !== i).map((x, xi) => ({ ...x, slNo: xi + 1 })))}
                    onBlurItem={i => fetchLastPrice(night, i, setNight)} />
                </Section>

                {/* Manpower */}
                <Section title="Daily Manpower" color="#1e3a8a">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse" style={{ fontSize: 11 }}>
                      <thead><tr>
                        <th style={{ ...thTP, width: 35 }}>Sl.No</th>
                        <th style={{ ...thTP, minWidth: 150 }}>Employee Name</th>
                        <th style={{ ...thTP, width: 130 }}>Basic Wages / Day (₹)</th>
                        <th style={{ ...thTP, width: 28 }}></th>
                      </tr></thead>
                      <tbody>
                        {manpower.map((r, i) => (
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
                            <td style={{ border: "1px solid #ddd", padding: "2px 4px" }}>
                              <input type="number" className="w-full border-0 outline-none bg-transparent text-xs text-center" value={r.basicWagesPerDay||""}
                                onChange={e => setManpower(mp => mp.map((x, xi) => xi === i ? { ...x, basicWagesPerDay: parseFloat(e.target.value)||0 } : x))} />
                            </td>
                            <td style={{ ...tdS }}>
                              <button onClick={() => setManpower(mp => mp.filter((_, xi) => xi !== i).map((x, xi) => ({ ...x, slNo: xi + 1 })))} className="text-red-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                            </td>
                          </tr>
                        ))}
                        <tr><td colSpan={4} style={{ border: "1px solid #ddd", padding: 4, textAlign: "center" }}>
                          <button onClick={() => setManpower(mp => [...mp, { slNo: mp.length + 1, employeeName: "", basicWagesPerDay: 0 }])} className="flex items-center gap-1 mx-auto text-blue-600 text-xs">
                            <Plus className="w-3 h-3" /> Add Row
                          </button>
                        </td></tr>
                        <tr>
                          <td colSpan={2} style={{ ...tdTot, textAlign: "right" }}>Total Wages</td>
                          <td style={tdTot}>{totalMp.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                          <td style={{ border: "1px solid #ddd" }} />
                        </tr>
                      </tbody>
                    </table>
                  </div>
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
                <div className="overflow-x-auto">
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
                          <td style={{ ...tdS, background: "#fef9c3" }}>{r.cashAmt > 0 ? r.cashAmt.toLocaleString("en-IN") : "—"}</td>
                          <td style={{ ...tdS, background: "#e0f2fe" }}>
                            <input type="number" className="w-full border-0 outline-none bg-transparent text-center text-xs" value={r.onlineQty||""}
                              onChange={e => setPsSale(rows => rows.map((x, xi) => xi === i ? { ...x, onlineQty: parseFloat(e.target.value)||0 } : x))} />
                          </td>
                          <td style={{ ...tdS, background: "#dbeafe" }}>{r.onlineAmt > 0 ? r.onlineAmt.toLocaleString("en-IN") : "—"}</td>
                          <td style={{ ...tdS, fontWeight: "bold" }}>{(r.cashQty + r.onlineQty) || "—"}</td>
                          <td style={{ ...tdS, background: "#dcfce7" }}>{r.coTotal > 0 ? r.coTotal.toLocaleString("en-IN") : "—"}</td>
                          <td style={{ ...tdS, background: "#fce7f3" }}>
                            <input type="number" className="w-full border-0 outline-none bg-transparent text-center text-xs" value={r.billQty||""}
                              onChange={e => setPsSale(rows => rows.map((x, xi) => xi === i ? { ...x, billQty: parseFloat(e.target.value)||0 } : x))} />
                          </td>
                          <td style={{ ...tdS, background: "#fdf2f8" }}>{r.billAmt > 0 ? r.billAmt.toLocaleString("en-IN") : "—"}</td>
                          <td style={{ ...tdS, fontWeight: "bold", background: "#bbf7d0", fontSize: 12 }}>{r.totalAmt > 0 ? r.totalAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "—"}</td>
                        </tr>
                      ))}
                      <tr>
                        <td colSpan={10} style={{ ...tdTot, textAlign: "right", background: "#166534", color: "#fff" }}>Total PS Sale</td>
                        <td style={{ ...tdTot, background: "#166534", color: "#fff", fontSize: 12 }}>{fmtINR(totalPsSale)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ─── SALE THIRD PARTY ─── */}
              <div className="bg-white rounded-lg shadow-sm p-3 mb-4">
                <div className="text-center font-bold py-1 mb-2 text-white text-sm rounded" style={{ background: "#1e3a8a" }}>SALE THIRD PARTY</div>
                <div className="text-xs text-gray-500 mb-2 italic">
                  Rates: Breakfast ₹20 · Lunch Veg ₹35 · Egg ₹45 · Chicken ₹65 · Fish ₹55 · Evening ₹20 · Night ₹30
                </div>
                <div className="overflow-x-auto">
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
                </div>
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
                <div className="grid grid-cols-3 gap-3 text-center">
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
              </div>
            </div>
          </>
        )}

        {/* ═══ DASHBOARD TAB ═══ */}
        {tab === "dashboard" && (
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium">Month:</span>
                <select value={dashMonth} onChange={e => setDashMonth(Number(e.target.value))} className="border border-gray-300 rounded px-2 py-1 text-sm" data-testid="select-pnl-month">
                  {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium">Year:</span>
                <select value={dashYear} onChange={e => setDashYear(Number(e.target.value))} className="border border-gray-300 rounded px-2 py-1 text-sm" data-testid="select-pnl-year">
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <span className="text-sm font-semibold text-gray-600">P&amp;L Dashboard — {MONTHS[dashMonth - 1]} {dashYear}</span>
            </div>

            {dashData.length === 0 ? (
              <div className="text-center py-12 text-gray-400">No P&amp;L entries found for {MONTHS[dashMonth - 1]} {dashYear}</div>
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
          </div>
        )}
      </div>
    </div>
  );
}
