import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { Save, ArrowLeft, Loader2, Plus, Pencil, FileDown, Users, UserPlus, TrendingUp, TrendingDown, Wallet, IndianRupee } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCreateCashSeal, useUpdateCashSeal, useCashSeals } from "@/hooks/use-reports";
import { useLocation } from "wouter";

// ── Fixed rates ───────────────────────────────────────────────────
const PS_RATES = { bf: 5, ln: 20, ev: 10, nt: 10 }; // Permanent Staff
const TP_RATES = { bf: 20, lv: 35, ev: 20, nt: 20 }; // Third Party
const BANANA_RATE = 4.5;
const fmt = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── calcTotals for list/dashboard (includes both old + new fields) ─
function calcTotals(s: any) {
  const n = (v: any) => Number(v) || 0;
  // New PS income
  const psIncome =
    n(s.incomePsBreakfastCashQty) * PS_RATES.bf +
    n(s.incomePsLunchCashQty) * PS_RATES.ln +
    n(s.incomePsEveningCashQty) * PS_RATES.ev +
    n(s.incomePsNightCashQty) * PS_RATES.nt +
    n(s.incomePsRechargeRate) * n(s.incomePsRechargeCashQty) +
    n(s.incomePsBreakfastOnlineQty) * PS_RATES.bf +
    n(s.incomePsLunchOnlineQty) * PS_RATES.ln +
    n(s.incomePsEveningOnlineQty) * PS_RATES.ev +
    n(s.incomePsNightOnlineQty) * PS_RATES.nt +
    n(s.incomePsRechargeRate) * n(s.incomePsRechargeOnlineQty);
  // New TP income
  const tpIncome =
    n(s.incomeTpBreakfastCashQty) * TP_RATES.bf +
    n(s.incomeTpLunchVegCashQty) * TP_RATES.lv +
    n(s.incomeTpLunchNvRate) * n(s.incomeTpLunchNvCashQty) +
    n(s.incomeTpEveningCashQty) * TP_RATES.ev +
    n(s.incomeTpNightCashQty) * TP_RATES.nt +
    n(s.incomeTpBreakfastOnlineQty) * TP_RATES.bf +
    n(s.incomeTpLunchVegOnlineQty) * TP_RATES.lv +
    n(s.incomeTpLunchNvRate) * n(s.incomeTpLunchNvOnlineQty) +
    n(s.incomeTpEveningOnlineQty) * TP_RATES.ev +
    n(s.incomeTpNightOnlineQty) * TP_RATES.nt;
  // Legacy income (old records)
  const legacyIncome =
    n(s.incomeMorningQty) * 5 + n(s.incomeLunchQty) * 20 +
    n(s.incomeEveningQty) * 10 + n(s.incomeNightQty) * 10 +
    n(s.incomeNonVegRate) * n(s.incomeNonVegQty) +
    n(s.incomeVegRate) * n(s.incomeVegQty) +
    n(s.incomeMorningCashRate) * n(s.incomeMorningCashQty) +
    n(s.incomeEveningCashRate) * n(s.incomeEveningCashQty) +
    n(s.incomeOnlineBreakfastQty) * 5 + n(s.incomeOnlineLunchQty) * 20 +
    n(s.incomeOnlineEveningSnacksQty) * 10 + n(s.incomeOnlineNightQty) * 10;
  const income = psIncome + tpIncome + legacyIncome;
  const expense = n(s.expenseBananaQty) * BANANA_RATE
    + n(s.expenseDahiBharQty) * n(s.expenseDahiBharRate)
    + n(s.expenseOtherAmount);
  return { income, expense, balance: income - expense };
}

// ── Inline number input ───────────────────────────────────────────
function NumInput({ value, onChange, placeholder = "0", className = "" }: {
  value: number; onChange: (v: number) => void; placeholder?: string; className?: string;
}) {
  return (
    <Input
      type="number"
      min={0}
      value={value === 0 ? "" : value}
      onChange={e => onChange(Number(e.target.value) || 0)}
      placeholder={placeholder}
      className={`h-8 text-center text-sm font-mono px-1 ${className}`}
      data-testid="input-qty"
    />
  );
}

// ── Row component for Permanent Staff ─────────────────────────────
function PsRow({ no, name, rate, cashQty, onCashQty, onlineQty, onOnlineQty, customRate, onCustomRate }: {
  no: number; name: string; rate: number | null; cashQty: number; onCashQty: (v: number) => void;
  onlineQty: number; onOnlineQty: (v: number) => void;
  customRate?: number; onCustomRate?: (v: number) => void;
}) {
  const r = customRate !== undefined ? customRate : (rate ?? 0);
  const cashTotal = cashQty * r;
  const onlineTotal = onlineQty * r;
  const rowTotal = cashTotal + onlineTotal;

  return (
    <>
      {/* Desktop row */}
      <tr className="hidden sm:table-row border-b border-blue-100 dark:border-blue-900/40 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors">
        <td className="px-2 py-1.5 text-center text-xs text-slate-500">{no}</td>
        <td className="px-2 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">{name}</td>
        <td className="px-2 py-1.5 text-center">
          {customRate !== undefined ? (
            <NumInput value={customRate} onChange={onCustomRate!} className="w-16 bg-amber-50 dark:bg-amber-900/20" />
          ) : (
            <Badge variant="outline" className="text-xs font-mono text-blue-700 border-blue-300 bg-blue-50">₹{rate}</Badge>
          )}
        </td>
        <td className="px-2 py-1.5"><NumInput value={cashQty} onChange={onCashQty} className="w-16" /></td>
        <td className="px-2 py-1.5 text-right text-sm font-mono text-slate-600 dark:text-slate-300">₹{cashTotal.toFixed(2)}</td>
        <td className="px-2 py-1.5"><NumInput value={onlineQty} onChange={onOnlineQty} className="w-16 bg-indigo-50 dark:bg-indigo-900/20" /></td>
        <td className="px-2 py-1.5 text-right text-sm font-mono text-indigo-600">₹{onlineTotal.toFixed(2)}</td>
        <td className="px-2 py-1.5 text-right text-sm font-mono font-semibold text-blue-700">₹{rowTotal.toFixed(2)}</td>
      </tr>
      {/* Mobile card row */}
      <tr className="sm:hidden border-b border-blue-100 dark:border-blue-900/40">
        <td colSpan={8} className="px-2 py-2">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{no}. {name}</span>
            {customRate !== undefined ? (
              <NumInput value={customRate} onChange={onCustomRate!} className="w-20 text-xs bg-amber-50" placeholder="Rate" />
            ) : (
              <Badge variant="outline" className="text-xs font-mono text-blue-700 border-blue-300 bg-blue-50">₹{rate}</Badge>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2 border border-slate-200 dark:border-slate-700">
              <div className="text-xs text-slate-500 mb-1 font-medium">Cash</div>
              <NumInput value={cashQty} onChange={onCashQty} className="w-full mb-1" />
              <div className="text-xs font-mono text-right text-slate-600">= ₹{cashTotal.toFixed(2)}</div>
            </div>
            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-2 border border-indigo-200 dark:border-indigo-800">
              <div className="text-xs text-indigo-600 mb-1 font-medium">Online</div>
              <NumInput value={onlineQty} onChange={onOnlineQty} className="w-full mb-1 bg-white dark:bg-indigo-900/30" />
              <div className="text-xs font-mono text-right text-indigo-600">= ₹{onlineTotal.toFixed(2)}</div>
            </div>
          </div>
          {rowTotal > 0 && (
            <div className="text-right text-xs font-semibold text-blue-700 mt-1">Total: ₹{rowTotal.toFixed(2)}</div>
          )}
        </td>
      </tr>
    </>
  );
}

// ── Row component for Third Party ─────────────────────────────────
function TpRow({ no, name, rate, cashQty, onCashQty, onlineQty, onOnlineQty, customRate, onCustomRate }: {
  no: number; name: string; rate: number | null; cashQty: number; onCashQty: (v: number) => void;
  onlineQty: number; onOnlineQty: (v: number) => void;
  customRate?: number; onCustomRate?: (v: number) => void;
}) {
  const r = customRate !== undefined ? customRate : (rate ?? 0);
  const cashTotal = cashQty * r;
  const onlineTotal = onlineQty * r;
  const rowTotal = cashTotal + onlineTotal;

  return (
    <>
      {/* Desktop row */}
      <tr className="hidden sm:table-row border-b border-green-100 dark:border-green-900/40 hover:bg-green-50/30 dark:hover:bg-green-900/10 transition-colors">
        <td className="px-2 py-1.5 text-center text-xs text-slate-500">{no}</td>
        <td className="px-2 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">{name}</td>
        <td className="px-2 py-1.5 text-center">
          {customRate !== undefined ? (
            <NumInput value={customRate} onChange={onCustomRate!} className="w-16 bg-amber-50 dark:bg-amber-900/20" />
          ) : (
            <Badge variant="outline" className="text-xs font-mono text-green-700 border-green-300 bg-green-50">₹{rate}</Badge>
          )}
        </td>
        <td className="px-2 py-1.5"><NumInput value={cashQty} onChange={onCashQty} className="w-16" /></td>
        <td className="px-2 py-1.5 text-right text-sm font-mono text-slate-600 dark:text-slate-300">₹{cashTotal.toFixed(2)}</td>
        <td className="px-2 py-1.5"><NumInput value={onlineQty} onChange={onOnlineQty} className="w-16 bg-indigo-50 dark:bg-indigo-900/20" /></td>
        <td className="px-2 py-1.5 text-right text-sm font-mono text-indigo-600">₹{onlineTotal.toFixed(2)}</td>
        <td className="px-2 py-1.5 text-right text-sm font-mono font-semibold text-green-700">₹{rowTotal.toFixed(2)}</td>
      </tr>
      {/* Mobile card row */}
      <tr className="sm:hidden border-b border-green-100 dark:border-green-900/40">
        <td colSpan={8} className="px-2 py-2">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{no}. {name}</span>
            {customRate !== undefined ? (
              <NumInput value={customRate} onChange={onCustomRate!} className="w-20 text-xs bg-amber-50" placeholder="Rate" />
            ) : (
              <Badge variant="outline" className="text-xs font-mono text-green-700 border-green-300 bg-green-50">₹{rate}</Badge>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2 border border-slate-200 dark:border-slate-700">
              <div className="text-xs text-slate-500 mb-1 font-medium">Cash</div>
              <NumInput value={cashQty} onChange={onCashQty} className="w-full mb-1" />
              <div className="text-xs font-mono text-right text-slate-600">= ₹{cashTotal.toFixed(2)}</div>
            </div>
            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-2 border border-indigo-200 dark:border-indigo-800">
              <div className="text-xs text-indigo-600 mb-1 font-medium">Online</div>
              <NumInput value={onlineQty} onChange={onOnlineQty} className="w-full mb-1 bg-white dark:bg-indigo-900/30" />
              <div className="text-xs font-mono text-right text-indigo-600">= ₹{onlineTotal.toFixed(2)}</div>
            </div>
          </div>
          {rowTotal > 0 && (
            <div className="text-right text-xs font-semibold text-green-700 mt-1">Total: ₹{rowTotal.toFixed(2)}</div>
          )}
        </td>
      </tr>
    </>
  );
}

// ── Table header for PS/TP sections (module-level for React stability) ─
function SectionTableHeader({ color }: { color: "blue" | "green" }) {
  const c = color === "blue" ? "bg-blue-600 text-white" : "bg-green-600 text-white";
  const sub = color === "blue"
    ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
    : "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300";
  return (
    <thead>
      <tr className={`hidden sm:table-row ${c} text-xs`}>
        <th className="px-2 py-1.5 text-center w-8">Sl</th>
        <th className="px-2 py-1.5 text-left">Name</th>
        <th className="px-2 py-1.5 text-center w-20">Rate</th>
        <th className="px-2 py-1.5 text-center" colSpan={2}>Cash</th>
        <th className="px-2 py-1.5 text-center" colSpan={2}>Online</th>
        <th className="px-2 py-1.5 text-right w-24">Total</th>
      </tr>
      <tr className={`hidden sm:table-row ${sub} text-xs border-b`}>
        <th className="px-2 py-1"></th>
        <th className="px-2 py-1"></th>
        <th className="px-2 py-1"></th>
        <th className="px-2 py-1 text-center">Qty</th>
        <th className="px-2 py-1 text-right">Total</th>
        <th className="px-2 py-1 text-center">Qty</th>
        <th className="px-2 py-1 text-right">Total</th>
        <th className="px-2 py-1"></th>
      </tr>
    </thead>
  );
}

function SectionTotalRow({ cashTotal, onlineTotal, color }: { cashTotal: number; onlineTotal: number; color: "blue" | "green" }) {
  const cls = color === "blue"
    ? "bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200"
    : "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200";
  const grand = cashTotal + onlineTotal;
  return (
    <>
      <tr className={`hidden sm:table-row ${cls} font-semibold text-xs border-t`}>
        <td colSpan={3} className="px-2 py-1.5 text-right">Sub Total:</td>
        <td className="px-2 py-1.5 text-right font-mono">{fmt(cashTotal)}</td>
        <td></td>
        <td className="px-2 py-1.5 text-right font-mono">{fmt(onlineTotal)}</td>
        <td></td>
        <td></td>
      </tr>
      <tr className={`hidden sm:table-row ${cls} font-bold text-xs border-b-2`}>
        <td colSpan={6} className="px-2 py-1.5 text-right">Total Cash + Total Online:</td>
        <td colSpan={2} className="px-2 py-1.5 text-right font-mono text-sm">{fmt(grand)}</td>
      </tr>
      <tr className={`sm:hidden ${cls}`}>
        <td colSpan={8} className="px-3 py-2">
          <div className="flex justify-between text-xs">
            <span>Cash: <span className="font-mono">{fmt(cashTotal)}</span></span>
            <span>Online: <span className="font-mono">{fmt(onlineTotal)}</span></span>
            <span className="font-bold">Total: <span className="font-mono">{fmt(grand)}</span></span>
          </div>
        </td>
      </tr>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
export default function CashSeal() {
  const [view, setView] = useState<"list" | "form">("list");
  const [editId, setEditId] = useState<number | null>(null);
  const autoEditHandled = useRef(false);

  const [date, setDate] = useState<Date>(new Date());
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const saveMutation = useCreateCashSeal();
  const updateMutation = useUpdateCashSeal();
  const { data: records = [], isLoading: recordsLoading } = useCashSeals();

  // ── Permanent Staff states ──────────────────────────────────────
  const [psBfCash, setPsBfCash] = useState(0);
  const [psLnCash, setPsLnCash] = useState(0);
  const [psEvCash, setPsEvCash] = useState(0);
  const [psNtCash, setPsNtCash] = useState(0);
  const [psRcRate, setPsRcRate] = useState(0);
  const [psRcCash, setPsRcCash] = useState(0);
  const [psBfOnline, setPsBfOnline] = useState(0);
  const [psLnOnline, setPsLnOnline] = useState(0);
  const [psEvOnline, setPsEvOnline] = useState(0);
  const [psNtOnline, setPsNtOnline] = useState(0);
  const [psRcOnline, setPsRcOnline] = useState(0);

  // ── Third Party states ─────────────────────────────────────────
  const [tpBfCash, setTpBfCash] = useState(0);
  const [tpLvCash, setTpLvCash] = useState(0);
  const [tpNvRate, setTpNvRate] = useState(0);
  const [tpNvCash, setTpNvCash] = useState(0);
  const [tpEvCash, setTpEvCash] = useState(0);
  const [tpNtCash, setTpNtCash] = useState(0);
  const [tpBfOnline, setTpBfOnline] = useState(0);
  const [tpLvOnline, setTpLvOnline] = useState(0);
  const [tpNvOnline, setTpNvOnline] = useState(0);
  const [tpEvOnline, setTpEvOnline] = useState(0);
  const [tpNtOnline, setTpNtOnline] = useState(0);

  // ── Expense states ─────────────────────────────────────────────
  const [bananaQty, setBananaQty] = useState(0);
  const [dahiBharQty, setDahiBharQty] = useState(0);
  const [dahiBharRate, setDahiBharRate] = useState(0);
  const [otherExpense, setOtherExpense] = useState(0);
  const [akbarAliAmount, setAkbarAliAmount] = useState(0);

  // ── Auto-edit from URL param ───────────────────────────────────
  useEffect(() => {
    if (autoEditHandled.current) return;
    if (!records || (records as any[]).length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const editParam = params.get("edit");
    if (editParam) {
      const id = Number(editParam);
      const rec = (records as any[]).find((r: any) => r.id === id);
      if (rec) {
        autoEditHandled.current = true;
        handleEdit(rec);
      }
    }
  }, [records]);

  function loadRecord(rec: any) {
    const n = (v: any) => Number(v) || 0;
    // PS Cash
    setPsBfCash(n(rec.incomePsBreakfastCashQty));
    setPsLnCash(n(rec.incomePsLunchCashQty));
    setPsEvCash(n(rec.incomePsEveningCashQty));
    setPsNtCash(n(rec.incomePsNightCashQty));
    setPsRcRate(n(rec.incomePsRechargeRate));
    setPsRcCash(n(rec.incomePsRechargeCashQty));
    // PS Online
    setPsBfOnline(n(rec.incomePsBreakfastOnlineQty));
    setPsLnOnline(n(rec.incomePsLunchOnlineQty));
    setPsEvOnline(n(rec.incomePsEveningOnlineQty));
    setPsNtOnline(n(rec.incomePsNightOnlineQty));
    setPsRcOnline(n(rec.incomePsRechargeOnlineQty));
    // TP Cash
    setTpBfCash(n(rec.incomeTpBreakfastCashQty));
    setTpLvCash(n(rec.incomeTpLunchVegCashQty));
    setTpNvRate(n(rec.incomeTpLunchNvRate));
    setTpNvCash(n(rec.incomeTpLunchNvCashQty));
    setTpEvCash(n(rec.incomeTpEveningCashQty));
    setTpNtCash(n(rec.incomeTpNightCashQty));
    // TP Online
    setTpBfOnline(n(rec.incomeTpBreakfastOnlineQty));
    setTpLvOnline(n(rec.incomeTpLunchVegOnlineQty));
    setTpNvOnline(n(rec.incomeTpLunchNvOnlineQty));
    setTpEvOnline(n(rec.incomeTpEveningOnlineQty));
    setTpNtOnline(n(rec.incomeTpNightOnlineQty));
    // Expense
    setBananaQty(n(rec.expenseBananaQty));
    setDahiBharQty(n(rec.expenseDahiBharQty));
    setDahiBharRate(n(rec.expenseDahiBharRate));
    setOtherExpense(n(rec.expenseOtherAmount));
    setAkbarAliAmount(n(rec.totalGivenToAkbarAli));
    if (rec.date) {
      try { setDate(parseISO(rec.date)); } catch { setDate(new Date(rec.date)); }
    }
  }

  function resetForm() {
    setPsBfCash(0); setPsLnCash(0); setPsEvCash(0); setPsNtCash(0);
    setPsRcRate(0); setPsRcCash(0);
    setPsBfOnline(0); setPsLnOnline(0); setPsEvOnline(0); setPsNtOnline(0); setPsRcOnline(0);
    setTpBfCash(0); setTpLvCash(0); setTpNvRate(0); setTpNvCash(0);
    setTpEvCash(0); setTpNtCash(0);
    setTpBfOnline(0); setTpLvOnline(0); setTpNvOnline(0); setTpEvOnline(0); setTpNtOnline(0);
    setBananaQty(0); setDahiBharQty(0); setDahiBharRate(0); setOtherExpense(0);
    setAkbarAliAmount(0); setDate(new Date());
  }

  function handleEdit(rec: any) {
    setEditId(rec.id);
    loadRecord(rec);
    setView("form");
  }

  function handleNew() {
    setEditId(null);
    resetForm();
    setView("form");
  }

  function handleBack() {
    if (view === "form") { setView("list"); setEditId(null); }
    else { navigate("/"); }
  }

  // ── Calculations ───────────────────────────────────────────────
  // PS totals
  const psBfCashTotal = psBfCash * PS_RATES.bf;
  const psLnCashTotal = psLnCash * PS_RATES.ln;
  const psEvCashTotal = psEvCash * PS_RATES.ev;
  const psNtCashTotal = psNtCash * PS_RATES.nt;
  const psRcCashTotal = psRcCash * psRcRate;
  const psBfOnlineTotal = psBfOnline * PS_RATES.bf;
  const psLnOnlineTotal = psLnOnline * PS_RATES.ln;
  const psEvOnlineTotal = psEvOnline * PS_RATES.ev;
  const psNtOnlineTotal = psNtOnline * PS_RATES.nt;
  const psRcOnlineTotal = psRcOnline * psRcRate;
  const psTotalCash = psBfCashTotal + psLnCashTotal + psEvCashTotal + psNtCashTotal + psRcCashTotal;
  const psTotalOnline = psBfOnlineTotal + psLnOnlineTotal + psEvOnlineTotal + psNtOnlineTotal + psRcOnlineTotal;
  const psGrandTotal = psTotalCash + psTotalOnline;

  // TP totals
  const tpBfCashTotal = tpBfCash * TP_RATES.bf;
  const tpLvCashTotal = tpLvCash * TP_RATES.lv;
  const tpNvCashTotal = tpNvCash * tpNvRate;
  const tpEvCashTotal = tpEvCash * TP_RATES.ev;
  const tpNtCashTotal = tpNtCash * TP_RATES.nt;
  const tpBfOnlineTotal = tpBfOnline * TP_RATES.bf;
  const tpLvOnlineTotal = tpLvOnline * TP_RATES.lv;
  const tpNvOnlineTotal = tpNvOnline * tpNvRate;
  const tpEvOnlineTotal = tpEvOnline * TP_RATES.ev;
  const tpNtOnlineTotal = tpNtOnline * TP_RATES.nt;
  const tpTotalCash = tpBfCashTotal + tpLvCashTotal + tpNvCashTotal + tpEvCashTotal + tpNtCashTotal;
  const tpTotalOnline = tpBfOnlineTotal + tpLvOnlineTotal + tpNvOnlineTotal + tpEvOnlineTotal + tpNtOnlineTotal;
  const tpGrandTotal = tpTotalCash + tpTotalOnline;

  const totalIncome = psGrandTotal + tpGrandTotal;
  const bananaTotal = bananaQty * BANANA_RATE;
  const dahiBharTotal = dahiBharQty * dahiBharRate;
  const totalExpense = bananaTotal + dahiBharTotal + otherExpense;
  const balance = totalIncome - totalExpense;

  const payload = {
    incomePsBreakfastCashQty: psBfCash, incomePsLunchCashQty: psLnCash,
    incomePsEveningCashQty: psEvCash, incomePsNightCashQty: psNtCash,
    incomePsRechargeRate: psRcRate, incomePsRechargeCashQty: psRcCash,
    incomePsBreakfastOnlineQty: psBfOnline, incomePsLunchOnlineQty: psLnOnline,
    incomePsEveningOnlineQty: psEvOnline, incomePsNightOnlineQty: psNtOnline,
    incomePsRechargeOnlineQty: psRcOnline,
    incomeTpBreakfastCashQty: tpBfCash, incomeTpLunchVegCashQty: tpLvCash,
    incomeTpLunchNvRate: tpNvRate, incomeTpLunchNvCashQty: tpNvCash,
    incomeTpEveningCashQty: tpEvCash, incomeTpNightCashQty: tpNtCash,
    incomeTpBreakfastOnlineQty: tpBfOnline, incomeTpLunchVegOnlineQty: tpLvOnline,
    incomeTpLunchNvOnlineQty: tpNvOnline, incomeTpEveningOnlineQty: tpEvOnline,
    incomeTpNightOnlineQty: tpNtOnline,
    expenseBananaQty: bananaQty, expenseDahiBharQty: dahiBharQty,
    expenseDahiBharRate: dahiBharRate, expenseOtherAmount: otherExpense,
    totalGivenToAkbarAli: akbarAliAmount,
  };

  const handleSave = async () => {
    try {
      if (editId) {
        await updateMutation.mutateAsync({ id: editId, data: payload });
        toast({ title: "Updated", description: "Cash Seal KPF record updated successfully" });
      } else {
        await saveMutation.mutateAsync({ date: format(date, 'yyyy-MM-dd'), ...payload });
        toast({ title: "Saved", description: "Cash Seal KPF saved successfully" });
      }
      setView("list");
      setEditId(null);
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to save", variant: "destructive" });
    }
  };

  const isPending = saveMutation.isPending || updateMutation.isPending;

  const formatDate = (d: string) => {
    try {
      const dt = d.includes("T") ? parseISO(d) : new Date(d + "T00:00:00");
      return format(dt, "dd MMM yyyy");
    } catch { return d; }
  };

  // ─────────────────────────────────────────────────────────────────
  // LIST VIEW
  // ─────────────────────────────────────────────────────────────────
  if (view === "list") {
    return (
      <Layout>
        <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100">Daily Cash Seal KPF</h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">Permanent Staff & Third Party records</p>
            </div>
            <Button onClick={handleNew} size="sm" className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5" data-testid="button-new-seal">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Entry</span>
              <span className="sm:hidden">New</span>
            </Button>
          </div>

          {recordsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
            </div>
          ) : (records as any[]).length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <IndianRupee className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No records yet. Create your first entry.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(records as any[]).map((seal: any) => {
                const { income, expense, balance } = calcTotals(seal);
                return (
                  <div key={seal.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow p-3 sm:p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center">
                          <IndianRupee className="w-4 h-4 text-teal-600" />
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-slate-800 dark:text-slate-100">{formatDate(seal.date || "")}</div>
                          <div className="text-xs text-slate-400">ID #{seal.id}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 gap-1" onClick={() => handleEdit(seal)} data-testid={`button-edit-seal-${seal.id}`}>
                          <Pencil className="w-3.5 h-3.5" /><span className="hidden sm:inline">Edit</span>
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 gap-1" onClick={() => navigate(`/cash-seal/${seal.id}/pdf`)} data-testid={`button-pdf-seal-${seal.id}`}>
                          <FileDown className="w-3.5 h-3.5" /><span className="hidden sm:inline">PDF</span>
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-2 text-center">
                        <div className="text-xs text-emerald-600 font-medium mb-0.5">Income</div>
                        <div className="text-sm font-bold font-mono text-emerald-700">{fmt(income)}</div>
                      </div>
                      <div className="bg-rose-50 dark:bg-rose-900/20 rounded-lg p-2 text-center">
                        <div className="text-xs text-rose-600 font-medium mb-0.5">Expense</div>
                        <div className="text-sm font-bold font-mono text-rose-700">{fmt(expense)}</div>
                      </div>
                      <div className={`rounded-lg p-2 text-center ${balance >= 0 ? "bg-blue-50 dark:bg-blue-900/20" : "bg-orange-50 dark:bg-orange-900/20"}`}>
                        <div className={`text-xs font-medium mb-0.5 ${balance >= 0 ? "text-blue-600" : "text-orange-600"}`}>Balance</div>
                        <div className={`text-sm font-bold font-mono ${balance >= 0 ? "text-blue-700" : "text-orange-700"}`}>{fmt(balance)}</div>
                      </div>
                    </div>
                    {Number(seal.totalGivenToAkbarAli) > 0 && (
                      <div className="mt-2 text-right text-xs text-orange-600">
                        Akbar Ali: <span className="font-mono font-semibold">{fmt(Number(seal.totalGivenToAkbarAli))}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Layout>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // FORM VIEW
  // ─────────────────────────────────────────────────────────────────
  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleBack} className="h-8 px-2" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100">
                {editId ? "Edit Cash Seal KPF" : "New Cash Seal KPF"}
              </h1>
              <p className="text-xs text-slate-500">Daily income & expense record</p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={isPending} size="sm" className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5" data-testid="button-save-seal">
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {editId ? "Update" : "Save"}
          </Button>
        </div>

        {/* Date */}
        {!editId && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3 sm:p-4 flex items-center gap-3">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide w-10">Date</div>
            <DatePicker date={date} onDateChange={(d) => d && setDate(d)} />
          </div>
        )}

        {/* ── PERMANENT STAFF SECTION ─────────────────────────── */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-blue-200 dark:border-blue-800 overflow-hidden shadow-sm">
          {/* Section header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-white" />
            <h2 className="text-sm font-bold text-white tracking-wide">Permanent Staff</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <SectionTableHeader color="blue" />
              <tbody>
                <PsRow no={1} name="Breakfast" rate={PS_RATES.bf} cashQty={psBfCash} onCashQty={setPsBfCash} onlineQty={psBfOnline} onOnlineQty={setPsBfOnline} />
                <PsRow no={2} name="Lunch" rate={PS_RATES.ln} cashQty={psLnCash} onCashQty={setPsLnCash} onlineQty={psLnOnline} onOnlineQty={setPsLnOnline} />
                <PsRow no={3} name="Evening Snacks" rate={PS_RATES.ev} cashQty={psEvCash} onCashQty={setPsEvCash} onlineQty={psEvOnline} onOnlineQty={setPsEvOnline} />
                <PsRow no={4} name="Night Snacks" rate={PS_RATES.nt} cashQty={psNtCash} onCashQty={setPsNtCash} onlineQty={psNtOnline} onOnlineQty={setPsNtOnline} />
                <PsRow no={5} name="Recharge" rate={null} cashQty={psRcCash} onCashQty={setPsRcCash} onlineQty={psRcOnline} onOnlineQty={setPsRcOnline} customRate={psRcRate} onCustomRate={setPsRcRate} />
                <SectionTotalRow cashTotal={psTotalCash} onlineTotal={psTotalOnline} color="blue" />
              </tbody>
            </table>
          </div>
        </div>

        {/* ── THIRD PARTY SECTION ─────────────────────────────── */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-green-200 dark:border-green-800 overflow-hidden shadow-sm">
          {/* Section header */}
          <div className="bg-gradient-to-r from-green-600 to-green-500 px-4 py-3 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-white" />
            <h2 className="text-sm font-bold text-white tracking-wide">Third Party</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <SectionTableHeader color="green" />
              <tbody>
                <TpRow no={1} name="Breakfast" rate={TP_RATES.bf} cashQty={tpBfCash} onCashQty={setTpBfCash} onlineQty={tpBfOnline} onOnlineQty={setTpBfOnline} />
                <TpRow no={2} name="Lunch Veg" rate={TP_RATES.lv} cashQty={tpLvCash} onCashQty={setTpLvCash} onlineQty={tpLvOnline} onOnlineQty={setTpLvOnline} />
                <TpRow no={3} name="Lunch Non Veg" rate={null} cashQty={tpNvCash} onCashQty={setTpNvCash} onlineQty={tpNvOnline} onOnlineQty={setTpNvOnline} customRate={tpNvRate} onCustomRate={setTpNvRate} />
                <TpRow no={4} name="Evening Snacks" rate={TP_RATES.ev} cashQty={tpEvCash} onCashQty={setTpEvCash} onlineQty={tpEvOnline} onOnlineQty={setTpEvOnline} />
                <TpRow no={5} name="Night" rate={TP_RATES.nt} cashQty={tpNtCash} onCashQty={setTpNtCash} onlineQty={tpNtOnline} onOnlineQty={setTpNtOnline} />
                <SectionTotalRow cashTotal={tpTotalCash} onlineTotal={tpTotalOnline} color="green" />
              </tbody>
            </table>
          </div>
        </div>

        {/* Grand Total Income */}
        <div className="bg-gradient-to-r from-slate-700 to-slate-600 dark:from-slate-700 dark:to-slate-800 rounded-xl p-3 sm:p-4 flex items-center justify-between shadow">
          <div className="flex items-center gap-2 text-white">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <span className="font-bold text-sm sm:text-base">Grand Total Income</span>
            <span className="text-xs text-slate-300">(PS + Third Party)</span>
          </div>
          <span className="text-lg sm:text-xl font-bold font-mono text-emerald-400">{fmt(totalIncome)}</span>
        </div>

        {/* ── EXPENSE SECTION ─────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-rose-200 dark:border-rose-800 overflow-hidden shadow-sm">
          <div className="bg-gradient-to-r from-rose-600 to-rose-500 px-4 py-3 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-white" />
            <h2 className="text-sm font-bold text-white tracking-wide">Expense</h2>
          </div>
          <div className="p-3 sm:p-4 space-y-3">
            {/* Banana */}
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-700 dark:text-slate-200">Banana</div>
                <div className="text-xs text-slate-400">₹{BANANA_RATE} × qty</div>
              </div>
              <NumInput value={bananaQty} onChange={setBananaQty} className="w-24" />
              <div className="w-28 text-right text-sm font-mono font-semibold text-rose-600">{fmt(bananaTotal)}</div>
            </div>
            {/* Dahi Bhar */}
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-700 dark:text-slate-200">Dahi Bhar</div>
                <div className="text-xs text-slate-400">rate × qty</div>
              </div>
              <div className="flex items-center gap-1.5">
                <NumInput value={dahiBharRate} onChange={setDahiBharRate} placeholder="Rate" className="w-20 bg-amber-50 dark:bg-amber-900/20" />
                <span className="text-slate-400 text-xs">×</span>
                <NumInput value={dahiBharQty} onChange={setDahiBharQty} className="w-20" />
              </div>
              <div className="w-28 text-right text-sm font-mono font-semibold text-rose-600">{fmt(dahiBharTotal)}</div>
            </div>
            {/* Other */}
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-700 dark:text-slate-200">Other</div>
                <div className="text-xs text-slate-400">Direct amount</div>
              </div>
              <NumInput value={otherExpense} onChange={setOtherExpense} className="w-24" />
              <div className="w-28 text-right text-sm font-mono font-semibold text-rose-600">{fmt(otherExpense)}</div>
            </div>
            {/* Expense total */}
            <div className="border-t border-rose-100 dark:border-rose-800 pt-2 flex justify-between items-center">
              <span className="text-sm font-bold text-rose-700">Total Expense</span>
              <span className="text-base font-bold font-mono text-rose-700">{fmt(totalExpense)}</span>
            </div>
          </div>
        </div>

        {/* ── AKBAR ALI & SUMMARY ──────────────────────────────── */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-orange-200 dark:border-orange-800 p-3 sm:p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">Total Given to Akbar Ali</div>
              <div className="text-xs text-slate-400">Cash handover amount</div>
            </div>
            <NumInput value={akbarAliAmount} onChange={setAkbarAliAmount} className="w-32 bg-orange-50 dark:bg-orange-900/20" />
            <div className="w-28 text-right text-sm font-mono font-semibold text-orange-600">{fmt(akbarAliAmount)}</div>
          </div>
        </div>

        {/* Summary bar */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 dark:from-slate-800 dark:to-slate-900 rounded-xl p-3 sm:p-4 shadow-lg">
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            <div className="text-center">
              <div className="text-xs text-slate-400 mb-1 flex items-center justify-center gap-1">
                <TrendingUp className="w-3 h-3 text-emerald-400" /> Income
              </div>
              <div className="text-base sm:text-lg font-bold font-mono text-emerald-400">{fmt(totalIncome)}</div>
            </div>
            <div className="text-center border-x border-slate-600">
              <div className="text-xs text-slate-400 mb-1 flex items-center justify-center gap-1">
                <TrendingDown className="w-3 h-3 text-rose-400" /> Expense
              </div>
              <div className="text-base sm:text-lg font-bold font-mono text-rose-400">{fmt(totalExpense)}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-slate-400 mb-1 flex items-center justify-center gap-1">
                <Wallet className="w-3 h-3 text-sky-400" /> Balance
              </div>
              <div className={`text-base sm:text-lg font-bold font-mono ${balance >= 0 ? "text-sky-400" : "text-orange-400"}`}>{fmt(balance)}</div>
            </div>
          </div>
        </div>

        {/* Save button at bottom */}
        <Button onClick={handleSave} disabled={isPending} className="w-full bg-teal-600 hover:bg-teal-700 text-white h-11 text-base gap-2" data-testid="button-save-bottom">
          {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          {editId ? "Update Seal KPF" : "Save Seal KPF"}
        </Button>
      </div>
    </Layout>
  );
}
