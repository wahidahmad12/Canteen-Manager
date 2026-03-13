import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO } from "date-fns";
import {
  Save, ArrowLeft, Loader2, Plus, Pencil, FileDown,
  Users, UserPlus, TrendingUp, TrendingDown, Wallet,
  IndianRupee, BarChart3, Calendar, Printer, Search
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCreateCashSeal, useUpdateCashSeal, useCashSeals } from "@/hooks/use-reports";
import { useLocation } from "wouter";

// ── Rates ─────────────────────────────────────────────────────────
const PS_RATES = { bf: 5, ln: 20, ev: 10, nt: 10 };
const TP_RATES = { bf: 20, lv: 35, ev: 20, nt: 20 };
const BANANA_RATE = 4.5;
const fmtN = (n: number) =>
  "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Totals helper for list view ────────────────────────────────────
function calcTotals(s: any) {
  const n = (v: any) => Number(v) || 0;
  const psIncome =
    n(s.incomePsBreakfastCashQty) * PS_RATES.bf + n(s.incomePsLunchCashQty) * PS_RATES.ln +
    n(s.incomePsEveningCashQty) * PS_RATES.ev + n(s.incomePsNightCashQty) * PS_RATES.nt +
    n(s.incomePsRechargeRate) * n(s.incomePsRechargeCashQty) +
    n(s.incomePsBreakfastOnlineQty) * PS_RATES.bf + n(s.incomePsLunchOnlineQty) * PS_RATES.ln +
    n(s.incomePsEveningOnlineQty) * PS_RATES.ev + n(s.incomePsNightOnlineQty) * PS_RATES.nt +
    n(s.incomePsRechargeRate) * n(s.incomePsRechargeOnlineQty);
  const tpIncome =
    n(s.incomeTpBreakfastCashQty) * TP_RATES.bf + n(s.incomeTpLunchVegCashQty) * TP_RATES.lv +
    n(s.incomeTpLunchNvRate) * n(s.incomeTpLunchNvCashQty) +
    n(s.incomeTpEveningCashQty) * TP_RATES.ev + n(s.incomeTpNightCashQty) * TP_RATES.nt +
    n(s.incomeTpBreakfastOnlineQty) * TP_RATES.bf + n(s.incomeTpLunchVegOnlineQty) * TP_RATES.lv +
    n(s.incomeTpLunchNvRate) * n(s.incomeTpLunchNvOnlineQty) +
    n(s.incomeTpEveningOnlineQty) * TP_RATES.ev + n(s.incomeTpNightOnlineQty) * TP_RATES.nt;
  const legacyIncome =
    n(s.incomeMorningQty) * 5 + n(s.incomeLunchQty) * 20 +
    n(s.incomeEveningQty) * 10 + n(s.incomeNightQty) * 10 +
    n(s.incomeNonVegRate) * n(s.incomeNonVegQty) + n(s.incomeVegRate) * n(s.incomeVegQty) +
    n(s.incomeMorningCashRate) * n(s.incomeMorningCashQty) +
    n(s.incomeEveningCashRate) * n(s.incomeEveningCashQty) +
    n(s.incomeOnlineBreakfastQty) * 5 + n(s.incomeOnlineLunchQty) * 20 +
    n(s.incomeOnlineEveningSnacksQty) * 10 + n(s.incomeOnlineNightQty) * 10;
  const income = psIncome + tpIncome + legacyIncome;
  const expense = n(s.expenseBananaQty) * BANANA_RATE
    + n(s.expenseDahiBharQty) * n(s.expenseDahiBharRate) + n(s.expenseOtherAmount);
  return { income, expense, balance: income - expense };
}

// ── Number input ──────────────────────────────────────────────────
function QtyInput({ value, onChange, placeholder = "0", className = "", large = false }: {
  value: number; onChange: (v: number) => void; placeholder?: string;
  className?: string; large?: boolean;
}) {
  return (
    <Input
      type="number"
      inputMode="numeric"
      min={0}
      value={value === 0 ? "" : value}
      onChange={e => onChange(Number(e.target.value) || 0)}
      placeholder={placeholder}
      className={`text-center font-mono ${large ? "h-12 text-xl font-bold" : "h-9 text-sm"} ${className}`}
      data-testid="input-qty"
    />
  );
}

// ── Mobile item card (inside income sections) ─────────────────────
interface ItemCardProps {
  no: number; name: string;
  fixedRate?: number;
  customRate?: number; onCustomRate?: (v: number) => void;
  cashQty: number; onCashQty: (v: number) => void;
  onlineQty: number; onOnlineQty: (v: number) => void;
  color: "blue" | "green";
}
function ItemCard({ no, name, fixedRate, customRate, onCustomRate, cashQty, onCashQty, onlineQty, onOnlineQty, color }: ItemCardProps) {
  const rate = customRate !== undefined ? customRate : (fixedRate ?? 0);
  const cashTotal = cashQty * rate;
  const onlineTotal = onlineQty * rate;
  const rowTotal = cashTotal + onlineTotal;
  const accent = color === "blue" ? "text-blue-700 bg-blue-50 border-blue-100" : "text-green-700 bg-green-50 border-green-100";
  const onlineBg = "bg-indigo-50 dark:bg-indigo-900/20";
  const cashBg = "bg-slate-50 dark:bg-slate-700/40";

  return (
    <div className={`border-b last:border-b-0 ${color === "blue" ? "border-blue-100 dark:border-blue-900/40" : "border-green-100 dark:border-green-900/40"}`}>
      {/* Mobile card */}
      <div className="block sm:hidden px-3 py-3">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-200 text-[10px] font-bold flex items-center justify-center flex-shrink-0">{no}</span>
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{name}</span>
          </div>
          {customRate !== undefined ? (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-400">₹</span>
              <Input
                type="number" inputMode="decimal" min={0}
                value={customRate === 0 ? "" : customRate}
                onChange={e => onCustomRate!(Number(e.target.value) || 0)}
                placeholder="Rate"
                className="w-16 h-8 text-center text-sm bg-amber-50 dark:bg-amber-900/20 border-amber-300"
              />
            </div>
          ) : (
            <Badge variant="outline" className={`text-xs font-mono ${color === "blue" ? "text-blue-700 border-blue-300 bg-blue-50" : "text-green-700 border-green-300 bg-green-50"}`}>₹{fixedRate}</Badge>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className={`${cashBg} rounded-xl p-2.5 border border-slate-200 dark:border-slate-600`}>
            <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-2">Cash</div>
            <QtyInput value={cashQty} onChange={onCashQty} large className="w-full" />
            <div className="text-xs font-mono text-right text-slate-600 dark:text-slate-300 mt-1.5 font-semibold">
              {cashTotal > 0 ? fmtN(cashTotal) : "—"}
            </div>
          </div>
          <div className={`${onlineBg} rounded-xl p-2.5 border border-indigo-200 dark:border-indigo-700`}>
            <div className="text-[10px] uppercase tracking-widest text-indigo-500 font-semibold mb-2">Online</div>
            <QtyInput value={onlineQty} onChange={onOnlineQty} large className="w-full bg-white dark:bg-indigo-900/30" />
            <div className="text-xs font-mono text-right text-indigo-600 mt-1.5 font-semibold">
              {onlineTotal > 0 ? fmtN(onlineTotal) : "—"}
            </div>
          </div>
        </div>
        {rowTotal > 0 && (
          <div className={`flex items-center justify-between mt-2 pt-2 border-t ${color === "blue" ? "border-blue-100 dark:border-blue-900/40" : "border-green-100 dark:border-green-900/40"}`}>
            <span className="text-xs text-slate-400">Row total</span>
            <span className={`text-sm font-bold font-mono ${color === "blue" ? "text-blue-700" : "text-green-700"}`}>{fmtN(rowTotal)}</span>
          </div>
        )}
      </div>

      {/* Desktop table row */}
      <div className={`hidden sm:grid sm:grid-cols-[30px_1fr_90px_100px_80px_100px_80px_90px] items-center gap-1 px-3 py-2 hover:bg-slate-50/60 dark:hover:bg-slate-700/20`}>
        <span className="text-xs text-slate-400 text-center">{no}</span>
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{name}</span>
        <span className="text-center">
          {customRate !== undefined ? (
            <Input type="number" inputMode="decimal" min={0}
              value={customRate === 0 ? "" : customRate}
              onChange={e => onCustomRate!(Number(e.target.value) || 0)}
              placeholder="Rate" className="h-8 text-center text-sm w-full bg-amber-50 dark:bg-amber-900/20" />
          ) : (
            <Badge variant="outline" className={`text-xs font-mono ${color === "blue" ? "text-blue-700 border-blue-300 bg-blue-50" : "text-green-700 border-green-300 bg-green-50"}`}>₹{fixedRate}</Badge>
          )}
        </span>
        <QtyInput value={cashQty} onChange={onCashQty} />
        <span className="text-right text-xs font-mono text-slate-600 dark:text-slate-300">{cashTotal > 0 ? fmtN(cashTotal) : "—"}</span>
        <QtyInput value={onlineQty} onChange={onOnlineQty} className="bg-indigo-50 dark:bg-indigo-900/20" />
        <span className="text-right text-xs font-mono text-indigo-600">{onlineTotal > 0 ? fmtN(onlineTotal) : "—"}</span>
        <span className={`text-right text-sm font-bold font-mono ${color === "blue" ? "text-blue-700" : "text-green-700"}`}>{rowTotal > 0 ? fmtN(rowTotal) : "—"}</span>
      </div>
    </div>
  );
}

// ── Section subtotal bar ──────────────────────────────────────────
function SectionSubtotal({ cashTotal, onlineTotal, color }: { cashTotal: number; onlineTotal: number; color: "blue" | "green" }) {
  const cls = color === "blue"
    ? "bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 border-blue-100 dark:border-blue-800"
    : "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border-green-100 dark:border-green-800";
  const grand = cashTotal + onlineTotal;
  return (
    <div className={`${cls} border-t px-3 py-2.5`}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex gap-4">
          <span>Cash: <span className="font-mono font-semibold">{fmtN(cashTotal)}</span></span>
          <span>Online: <span className="font-mono font-semibold">{fmtN(onlineTotal)}</span></span>
        </div>
        <span className="font-bold text-sm">Total: <span className="font-mono">{fmtN(grand)}</span></span>
      </div>
    </div>
  );
}

// ── Desktop header row for income sections ────────────────────────
function DesktopSectionHeader({ color }: { color: "blue" | "green" }) {
  const cls = color === "blue"
    ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
    : "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300";
  return (
    <div className={`hidden sm:grid sm:grid-cols-[30px_1fr_90px_100px_80px_100px_80px_90px] items-center gap-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide border-b ${cls}`}>
      <span className="text-center">#</span>
      <span>Name</span>
      <span className="text-center">Rate</span>
      <span className="text-center">Cash Qty</span>
      <span className="text-right">Cash Total</span>
      <span className="text-center">Online Qty</span>
      <span className="text-right">Online Total</span>
      <span className="text-right">Row Total</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
export default function CashSeal() {
  const [view, setView] = useState<"list" | "form">("list");
  const [editId, setEditId] = useState<number | null>(null);
  const autoEditHandled = useRef(false);
  const [date, setDate] = useState<Date>(new Date());
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>(String(new Date().getFullYear()));
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const saveMutation = useCreateCashSeal();
  const updateMutation = useUpdateCashSeal();
  const { data: records = [], isLoading: recordsLoading } = useCashSeals();

  // ── PS state ───────────────────────────────────────────────────
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

  // ── TP state ───────────────────────────────────────────────────
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

  // ── Expense state ──────────────────────────────────────────────
  const [bananaQty, setBananaQty] = useState(0);
  const [dahiBharQty, setDahiBharQty] = useState(0);
  const [dahiBharRate, setDahiBharRate] = useState(0);
  const [otherExpense, setOtherExpense] = useState(0);
  const [akbarAliAmount, setAkbarAliAmount] = useState(0);

  // ── URL param auto-edit ────────────────────────────────────────
  useEffect(() => {
    if (autoEditHandled.current) return;
    if (!records || (records as any[]).length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const editParam = params.get("edit");
    if (editParam) {
      const id = Number(editParam);
      const rec = (records as any[]).find((r: any) => r.id === id);
      if (rec) { autoEditHandled.current = true; handleEdit(rec); }
    }
  }, [records]);

  function loadRecord(rec: any) {
    const n = (v: any) => Number(v) || 0;
    setPsBfCash(n(rec.incomePsBreakfastCashQty)); setPsLnCash(n(rec.incomePsLunchCashQty));
    setPsEvCash(n(rec.incomePsEveningCashQty)); setPsNtCash(n(rec.incomePsNightCashQty));
    setPsRcRate(n(rec.incomePsRechargeRate)); setPsRcCash(n(rec.incomePsRechargeCashQty));
    setPsBfOnline(n(rec.incomePsBreakfastOnlineQty)); setPsLnOnline(n(rec.incomePsLunchOnlineQty));
    setPsEvOnline(n(rec.incomePsEveningOnlineQty)); setPsNtOnline(n(rec.incomePsNightOnlineQty));
    setPsRcOnline(n(rec.incomePsRechargeOnlineQty));
    setTpBfCash(n(rec.incomeTpBreakfastCashQty)); setTpLvCash(n(rec.incomeTpLunchVegCashQty));
    setTpNvRate(n(rec.incomeTpLunchNvRate)); setTpNvCash(n(rec.incomeTpLunchNvCashQty));
    setTpEvCash(n(rec.incomeTpEveningCashQty)); setTpNtCash(n(rec.incomeTpNightCashQty));
    setTpBfOnline(n(rec.incomeTpBreakfastOnlineQty)); setTpLvOnline(n(rec.incomeTpLunchVegOnlineQty));
    setTpNvOnline(n(rec.incomeTpLunchNvOnlineQty)); setTpEvOnline(n(rec.incomeTpEveningOnlineQty));
    setTpNtOnline(n(rec.incomeTpNightOnlineQty));
    setBananaQty(n(rec.expenseBananaQty)); setDahiBharQty(n(rec.expenseDahiBharQty));
    setDahiBharRate(n(rec.expenseDahiBharRate)); setOtherExpense(n(rec.expenseOtherAmount));
    setAkbarAliAmount(n(rec.totalGivenToAkbarAli));
    if (rec.date) { try { setDate(parseISO(rec.date)); } catch { setDate(new Date(rec.date)); } }
  }

  function resetForm() {
    setPsBfCash(0); setPsLnCash(0); setPsEvCash(0); setPsNtCash(0); setPsRcRate(0); setPsRcCash(0);
    setPsBfOnline(0); setPsLnOnline(0); setPsEvOnline(0); setPsNtOnline(0); setPsRcOnline(0);
    setTpBfCash(0); setTpLvCash(0); setTpNvRate(0); setTpNvCash(0); setTpEvCash(0); setTpNtCash(0);
    setTpBfOnline(0); setTpLvOnline(0); setTpNvOnline(0); setTpEvOnline(0); setTpNtOnline(0);
    setBananaQty(0); setDahiBharQty(0); setDahiBharRate(0); setOtherExpense(0);
    setAkbarAliAmount(0); setDate(new Date());
  }

  function handleEdit(rec: any) { setEditId(rec.id); loadRecord(rec); setView("form"); }
  function handleNew() { setEditId(null); resetForm(); setView("form"); }
  function handleBack() {
    if (view === "form") { setView("list"); setEditId(null); } else { navigate("/"); }
  }

  // ── Calculations ───────────────────────────────────────────────
  const psBfCashT = psBfCash * PS_RATES.bf;  const psLnCashT = psLnCash * PS_RATES.ln;
  const psEvCashT = psEvCash * PS_RATES.ev;  const psNtCashT = psNtCash * PS_RATES.nt;
  const psRcCashT = psRcCash * psRcRate;
  const psBfOnlineT = psBfOnline * PS_RATES.bf; const psLnOnlineT = psLnOnline * PS_RATES.ln;
  const psEvOnlineT = psEvOnline * PS_RATES.ev; const psNtOnlineT = psNtOnline * PS_RATES.nt;
  const psRcOnlineT = psRcOnline * psRcRate;
  const psTotalCash = psBfCashT + psLnCashT + psEvCashT + psNtCashT + psRcCashT;
  const psTotalOnline = psBfOnlineT + psLnOnlineT + psEvOnlineT + psNtOnlineT + psRcOnlineT;

  const tpBfCashT = tpBfCash * TP_RATES.bf;  const tpLvCashT = tpLvCash * TP_RATES.lv;
  const tpNvCashT = tpNvCash * tpNvRate;
  const tpEvCashT = tpEvCash * TP_RATES.ev;  const tpNtCashT = tpNtCash * TP_RATES.nt;
  const tpBfOnlineT = tpBfOnline * TP_RATES.bf; const tpLvOnlineT = tpLvOnline * TP_RATES.lv;
  const tpNvOnlineT = tpNvOnline * tpNvRate;
  const tpEvOnlineT = tpEvOnline * TP_RATES.ev; const tpNtOnlineT = tpNtOnline * TP_RATES.nt;
  const tpTotalCash = tpBfCashT + tpLvCashT + tpNvCashT + tpEvCashT + tpNtCashT;
  const tpTotalOnline = tpBfOnlineT + tpLvOnlineT + tpNvOnlineT + tpEvOnlineT + tpNtOnlineT;

  const totalIncome = psTotalCash + psTotalOnline + tpTotalCash + tpTotalOnline;
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
        toast({ title: "Updated", description: "Record updated successfully" });
      } else {
        await saveMutation.mutateAsync({ date: format(date, "yyyy-MM-dd"), ...payload });
        toast({ title: "Saved", description: "Cash Seal KPF saved" });
      }
      setView("list"); setEditId(null);
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to save", variant: "destructive" });
    }
  };

  const isPending = saveMutation.isPending || updateMutation.isPending;

  const formatDate = (d: string) => {
    try {
      return format(d.includes("T") ? parseISO(d) : new Date(d + "T00:00:00"), "dd MMM yyyy");
    } catch { return d; }
  };

  // ─────────────────────────────────────────────────────────────────
  // LIST VIEW
  // ─────────────────────────────────────────────────────────────────
  if (view === "list") {
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 5 }, (_, i) => String(currentYear - i));
    const months = [
      { value: "all", label: "All Months" },
      { value: "1", label: "January" }, { value: "2", label: "February" },
      { value: "3", label: "March" }, { value: "4", label: "April" },
      { value: "5", label: "May" }, { value: "6", label: "June" },
      { value: "7", label: "July" }, { value: "8", label: "August" },
      { value: "9", label: "September" }, { value: "10", label: "October" },
      { value: "11", label: "November" }, { value: "12", label: "December" },
    ];

    const getDateObj = (d: string) => {
      try { return d.includes("T") ? parseISO(d) : new Date(d + "T00:00:00"); } catch { return new Date(); }
    };

    const allRecords = records as any[];
    const filtered = allRecords.filter(s => {
      const dt = getDateObj(s.date || "");
      if (filterYear !== "all" && dt.getFullYear() !== Number(filterYear)) return false;
      if (filterMonth !== "all" && (dt.getMonth() + 1) !== Number(filterMonth)) return false;
      return true;
    });

    const totals = filtered.reduce((acc, s) => {
      const t = calcTotals(s);
      return { income: acc.income + t.income, expense: acc.expense + t.expense, balance: acc.balance + t.balance };
    }, { income: 0, expense: 0, balance: 0 });

    const statCards = [
      { label: "Total Records", value: String(filtered.length), isCount: true, grad: "from-blue-600 to-blue-400", icon: IndianRupee },
      { label: "Total Income", value: fmtN(totals.income), isCount: false, grad: "from-emerald-600 to-teal-400", icon: TrendingUp },
      { label: "Total Expense", value: fmtN(totals.expense), isCount: false, grad: "from-rose-600 to-orange-400", icon: TrendingDown },
      { label: "Net Balance", value: fmtN(totals.balance), isCount: false, grad: totals.balance >= 0 ? "from-sky-600 to-cyan-400" : "from-orange-600 to-red-400", icon: Wallet },
    ];

    return (
      <Layout>
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
          {/* ── Page Header ── */}
          <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 sm:px-6 py-4">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-600 to-teal-400 flex items-center justify-center shadow-md flex-shrink-0">
                  <IndianRupee className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100 leading-tight">Daily Cash Seal KPF</h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Track daily income & expenses</p>
                </div>
              </div>
              <Button onClick={() => navigate("/cash-seal/monthly")} variant="outline"
                className="gap-1.5 border-teal-300 text-teal-700 hover:bg-teal-50 dark:border-teal-700 dark:text-teal-400 h-9"
                data-testid="button-monthly-report">
                <BarChart3 className="w-4 h-4" />
                <span className="hidden sm:inline text-sm">Monthly Report</span>
              </Button>
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-5">

            {/* ── Action row ── */}
            <div className="flex items-center justify-end gap-2">
              <Button onClick={handleNew}
                className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5 h-9 px-4"
                data-testid="button-new-seal">
                <Plus className="w-4 h-4" />
                New Entry
              </Button>
            </div>

            {/* ── Stat cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {statCards.map(({ label, value, isCount, grad, icon: Icon }) => (
                <div key={label} className={`bg-gradient-to-br ${grad} rounded-2xl p-4 text-white shadow-md`}>
                  <div className="flex items-center gap-2 mb-2 opacity-90">
                    <Icon className="w-4 h-4" />
                    <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
                  </div>
                  <div className={`font-bold font-mono ${isCount ? "text-4xl" : "text-lg sm:text-xl"} leading-tight`}>{value}</div>
                </div>
              ))}
            </div>

            {/* ── Filters ── */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3 sm:p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm font-medium">Filter</span>
                </div>
                <Select value={filterMonth} onValueChange={setFilterMonth}>
                  <SelectTrigger className="w-36 h-9 text-sm" data-testid="select-month">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filterYear} onValueChange={setFilterYear}>
                  <SelectTrigger className="w-28 h-9 text-sm" data-testid="select-year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Years</SelectItem>
                    {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
                {(filterMonth !== "all" || filterYear !== "all") && (
                  <Button variant="ghost" size="sm" className="h-9 text-slate-500 text-sm"
                    onClick={() => { setFilterMonth("all"); setFilterYear("all"); }}>
                    Clear
                  </Button>
                )}
                <div className="ml-auto text-sm text-slate-500 dark:text-slate-400">
                  {filtered.length} record{filtered.length !== 1 ? "s" : ""}
                </div>
              </div>
            </div>

            {/* ── Table ── */}
            {recordsLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-center py-16 text-slate-400">
                <IndianRupee className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">{allRecords.length === 0 ? "No records yet. Create your first entry." : "No records match the selected filter."}</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gradient-to-r from-teal-700 to-teal-500 text-white">
                        {["Sl#", "Date", "PS Income", "TP Income", "Total Income", "Expense", "Balance", "Akbar Ali", "Actions"].map(h => (
                          <th key={h} className="px-3 py-3 text-xs font-bold uppercase tracking-wide text-left whitespace-nowrap first:rounded-tl-none last:text-center">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {filtered.map((seal: any, idx: number) => {
                        const n = (v: any) => Number(v) || 0;
                        const psTotal = (n(seal.incomePsBreakfastCashQty) + n(seal.incomePsBreakfastOnlineQty)) * PS_RATES.bf
                          + (n(seal.incomePsLunchCashQty) + n(seal.incomePsLunchOnlineQty)) * PS_RATES.ln
                          + (n(seal.incomePsEveningCashQty) + n(seal.incomePsEveningOnlineQty)) * PS_RATES.ev
                          + (n(seal.incomePsNightCashQty) + n(seal.incomePsNightOnlineQty)) * PS_RATES.nt
                          + (n(seal.incomePsRechargeCashQty) + n(seal.incomePsRechargeOnlineQty)) * n(seal.incomePsRechargeRate);
                        const tpTotal = (n(seal.incomeTpBreakfastCashQty) + n(seal.incomeTpBreakfastOnlineQty)) * TP_RATES.bf
                          + (n(seal.incomeTpLunchVegCashQty) + n(seal.incomeTpLunchVegOnlineQty)) * TP_RATES.lv
                          + (n(seal.incomeTpLunchNvCashQty) + n(seal.incomeTpLunchNvOnlineQty)) * n(seal.incomeTpLunchNvRate)
                          + (n(seal.incomeTpEveningCashQty) + n(seal.incomeTpEveningOnlineQty)) * TP_RATES.ev
                          + (n(seal.incomeTpNightCashQty) + n(seal.incomeTpNightOnlineQty)) * TP_RATES.nt;
                        const { income, expense, balance } = calcTotals(seal);
                        const isEven = idx % 2 === 0;
                        return (
                          <tr key={seal.id} className={`${isEven ? "bg-white dark:bg-slate-800" : "bg-slate-50 dark:bg-slate-800/60"} hover:bg-teal-50/50 dark:hover:bg-teal-900/10 transition-colors`}>
                            <td className="px-3 py-2.5 text-sm text-slate-500 font-mono">{idx + 1}</td>
                            <td className="px-3 py-2.5">
                              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap">{formatDate(seal.date || "")}</div>
                            </td>
                            <td className="px-3 py-2.5 text-sm font-mono text-blue-700 dark:text-blue-400">{psTotal > 0 ? fmtN(psTotal) : <span className="text-slate-300">—</span>}</td>
                            <td className="px-3 py-2.5 text-sm font-mono text-green-700 dark:text-green-400">{tpTotal > 0 ? fmtN(tpTotal) : <span className="text-slate-300">—</span>}</td>
                            <td className="px-3 py-2.5">
                              <span className="text-sm font-bold font-mono text-emerald-700 dark:text-emerald-400">{fmtN(income)}</span>
                            </td>
                            <td className="px-3 py-2.5">
                              <span className="text-sm font-mono text-rose-600 dark:text-rose-400">{expense > 0 ? fmtN(expense) : <span className="text-slate-300">—</span>}</span>
                            </td>
                            <td className="px-3 py-2.5">
                              <span className={`text-sm font-bold font-mono ${balance >= 0 ? "text-sky-700 dark:text-sky-400" : "text-orange-600 dark:text-orange-400"}`}>{fmtN(balance)}</span>
                            </td>
                            <td className="px-3 py-2.5 text-sm font-mono text-orange-600">
                              {Number(seal.totalGivenToAkbarAli) > 0 ? fmtN(Number(seal.totalGivenToAkbarAli)) : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={() => handleEdit(seal)}
                                  className="p-1.5 rounded-lg text-teal-600 hover:bg-teal-100 dark:hover:bg-teal-900/30 transition-colors"
                                  title="Edit" data-testid={`button-edit-seal-${seal.id}`}>
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => navigate(`/cash-seal/${seal.id}/pdf`)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                  title="View PDF" data-testid={`button-pdf-seal-${seal.id}`}>
                                  <Printer className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {/* Footer totals */}
                    <tfoot>
                      <tr className="bg-teal-50 dark:bg-teal-900/20 border-t-2 border-teal-200 dark:border-teal-700">
                        <td colSpan={4} className="px-3 py-2.5 text-xs font-bold uppercase text-teal-700 dark:text-teal-300 tracking-wide">Total ({filtered.length} records)</td>
                        <td className="px-3 py-2.5 text-sm font-bold font-mono text-emerald-700 dark:text-emerald-300">{fmtN(totals.income)}</td>
                        <td className="px-3 py-2.5 text-sm font-bold font-mono text-rose-600 dark:text-rose-400">{fmtN(totals.expense)}</td>
                        <td className="px-3 py-2.5 text-sm font-bold font-mono text-sky-700 dark:text-sky-300">{fmtN(totals.balance)}</td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-700">
                  {filtered.map((seal: any, idx: number) => {
                    const { income, expense, balance } = calcTotals(seal);
                    return (
                      <div key={seal.id} className="p-3">
                        <div className="flex items-center justify-between mb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-900/40 text-teal-700 text-xs font-bold flex items-center justify-center">{idx + 1}</span>
                            <div>
                              <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{formatDate(seal.date || "")}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleEdit(seal)}
                              className="p-2 rounded-lg text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/30"
                              data-testid={`button-edit-seal-${seal.id}`}>
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => navigate(`/cash-seal/${seal.id}/pdf`)}
                              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                              data-testid={`button-pdf-seal-${seal.id}`}>
                              <Printer className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-2 text-center">
                            <div className="text-[10px] text-emerald-600 font-semibold mb-0.5">Income</div>
                            <div className="text-xs font-bold font-mono text-emerald-700">{fmtN(income)}</div>
                          </div>
                          <div className="bg-rose-50 dark:bg-rose-900/20 rounded-lg p-2 text-center">
                            <div className="text-[10px] text-rose-600 font-semibold mb-0.5">Expense</div>
                            <div className="text-xs font-bold font-mono text-rose-700">{fmtN(expense)}</div>
                          </div>
                          <div className={`rounded-lg p-2 text-center ${balance >= 0 ? "bg-sky-50 dark:bg-sky-900/20" : "bg-orange-50 dark:bg-orange-900/20"}`}>
                            <div className={`text-[10px] font-semibold mb-0.5 ${balance >= 0 ? "text-sky-600" : "text-orange-600"}`}>Balance</div>
                            <div className={`text-xs font-bold font-mono ${balance >= 0 ? "text-sky-700" : "text-orange-700"}`}>{fmtN(balance)}</div>
                          </div>
                        </div>
                        {Number(seal.totalGivenToAkbarAli) > 0 && (
                          <div className="mt-1.5 text-right text-xs text-orange-500">
                            Akbar Ali: <span className="font-mono font-semibold">{fmtN(Number(seal.totalGivenToAkbarAli))}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {/* Mobile footer */}
                  <div className="p-3 bg-teal-50 dark:bg-teal-900/20">
                    <div className="text-xs font-bold text-teal-700 dark:text-teal-300 mb-2">Total ({filtered.length} records)</div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <div className="text-center"><div className="text-[10px] text-emerald-600">Income</div><div className="text-xs font-bold font-mono text-emerald-700">{fmtN(totals.income)}</div></div>
                      <div className="text-center"><div className="text-[10px] text-rose-600">Expense</div><div className="text-xs font-bold font-mono text-rose-700">{fmtN(totals.expense)}</div></div>
                      <div className="text-center"><div className="text-[10px] text-sky-600">Balance</div><div className="text-xs font-bold font-mono text-sky-700">{fmtN(totals.balance)}</div></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </Layout>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // FORM VIEW
  // ─────────────────────────────────────────────────────────────────
  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-3 sm:px-5 py-4 sm:py-6 space-y-4">

        {/* Sticky header bar */}
        <div className="sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-700 -mx-3 sm:-mx-5 px-3 sm:px-5 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleBack} className="h-9 px-2" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100">
                {editId ? "Edit Cash Seal KPF" : "New Cash Seal KPF"}
              </h1>
              <p className="text-[10px] text-slate-400">Income & expense entry</p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={isPending}
            className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5 h-9"
            data-testid="button-save-seal">
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {editId ? "Update" : "Save"}
          </Button>
        </div>

        {/* Date */}
        {!editId && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</span>
            <DatePicker date={date} onDateChange={(d) => d && setDate(d)} />
          </div>
        )}

        {/* ── PERMANENT STAFF ──────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-blue-200 dark:border-blue-800 overflow-hidden shadow-sm">
          <div className="bg-gradient-to-r from-blue-700 to-blue-500 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-white" />
              <h2 className="text-sm font-bold text-white">Permanent Staff</h2>
            </div>
            <span className="text-xs text-blue-100">Rates: ₹5 / ₹20 / ₹10 / ₹10</span>
          </div>
          <DesktopSectionHeader color="blue" />
          <ItemCard no={1} name="Breakfast" fixedRate={PS_RATES.bf} color="blue"
            cashQty={psBfCash} onCashQty={setPsBfCash} onlineQty={psBfOnline} onOnlineQty={setPsBfOnline} />
          <ItemCard no={2} name="Lunch" fixedRate={PS_RATES.ln} color="blue"
            cashQty={psLnCash} onCashQty={setPsLnCash} onlineQty={psLnOnline} onOnlineQty={setPsLnOnline} />
          <ItemCard no={3} name="Evening Snacks" fixedRate={PS_RATES.ev} color="blue"
            cashQty={psEvCash} onCashQty={setPsEvCash} onlineQty={psEvOnline} onOnlineQty={setPsEvOnline} />
          <ItemCard no={4} name="Night Snacks" fixedRate={PS_RATES.nt} color="blue"
            cashQty={psNtCash} onCashQty={setPsNtCash} onlineQty={psNtOnline} onOnlineQty={setPsNtOnline} />
          <ItemCard no={5} name="Recharge" customRate={psRcRate} onCustomRate={setPsRcRate} color="blue"
            cashQty={psRcCash} onCashQty={setPsRcCash} onlineQty={psRcOnline} onOnlineQty={setPsRcOnline} />
          <SectionSubtotal cashTotal={psTotalCash} onlineTotal={psTotalOnline} color="blue" />
        </div>

        {/* ── THIRD PARTY ───────────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-green-200 dark:border-green-800 overflow-hidden shadow-sm">
          <div className="bg-gradient-to-r from-green-700 to-green-500 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-white" />
              <h2 className="text-sm font-bold text-white">Third Party</h2>
            </div>
            <span className="text-xs text-green-100">Rates: ₹20 / ₹35 / ₹20 / ₹20</span>
          </div>
          <DesktopSectionHeader color="green" />
          <ItemCard no={1} name="Breakfast" fixedRate={TP_RATES.bf} color="green"
            cashQty={tpBfCash} onCashQty={setTpBfCash} onlineQty={tpBfOnline} onOnlineQty={setTpBfOnline} />
          <ItemCard no={2} name="Lunch Veg" fixedRate={TP_RATES.lv} color="green"
            cashQty={tpLvCash} onCashQty={setTpLvCash} onlineQty={tpLvOnline} onOnlineQty={setTpLvOnline} />
          <ItemCard no={3} name="Lunch Non Veg" customRate={tpNvRate} onCustomRate={setTpNvRate} color="green"
            cashQty={tpNvCash} onCashQty={setTpNvCash} onlineQty={tpNvOnline} onOnlineQty={setTpNvOnline} />
          <ItemCard no={4} name="Evening Snacks" fixedRate={TP_RATES.ev} color="green"
            cashQty={tpEvCash} onCashQty={setTpEvCash} onlineQty={tpEvOnline} onOnlineQty={setTpEvOnline} />
          <ItemCard no={5} name="Night" fixedRate={TP_RATES.nt} color="green"
            cashQty={tpNtCash} onCashQty={setTpNtCash} onlineQty={tpNtOnline} onOnlineQty={setTpNtOnline} />
          <SectionSubtotal cashTotal={tpTotalCash} onlineTotal={tpTotalOnline} color="green" />
        </div>

        {/* Grand Total Income */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-600 rounded-xl px-4 py-3 flex items-center justify-between shadow">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <div>
              <div className="text-white font-bold text-sm">Grand Total Income</div>
              <div className="text-slate-300 text-[10px]">Permanent Staff + Third Party</div>
            </div>
          </div>
          <span className="text-xl font-bold font-mono text-emerald-400">{fmtN(totalIncome)}</span>
        </div>

        {/* ── EXPENSE ───────────────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-rose-200 dark:border-rose-800 overflow-hidden shadow-sm">
          <div className="bg-gradient-to-r from-rose-700 to-rose-500 px-4 py-3 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-white" />
            <h2 className="text-sm font-bold text-white">Expense</h2>
          </div>

          <div className="divide-y divide-rose-100 dark:divide-rose-900/40">
            {/* Banana */}
            <div className="px-3 py-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">Banana</div>
                  <div className="text-xs text-slate-400">₹{BANANA_RATE} per unit</div>
                </div>
                <span className="text-sm font-bold font-mono text-rose-600">{bananaTotal > 0 ? fmtN(bananaTotal) : "—"}</span>
              </div>
              <QtyInput value={bananaQty} onChange={setBananaQty} large className="w-full max-w-[160px]" />
            </div>

            {/* Dahi Bhar */}
            <div className="px-3 py-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">Dahi Bhar</div>
                  <div className="text-xs text-slate-400">Rate × Qty</div>
                </div>
                <span className="text-sm font-bold font-mono text-rose-600">{dahiBharTotal > 0 ? fmtN(dahiBharTotal) : "—"}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[10px] text-amber-600 mb-1 font-medium uppercase tracking-wide">Rate (₹)</div>
                  <QtyInput value={dahiBharRate} onChange={setDahiBharRate} large placeholder="Rate" className="w-full bg-amber-50 dark:bg-amber-900/20" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 mb-1 font-medium uppercase tracking-wide">Qty</div>
                  <QtyInput value={dahiBharQty} onChange={setDahiBharQty} large className="w-full" />
                </div>
              </div>
            </div>

            {/* Other */}
            <div className="px-3 py-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">Other Expense</div>
                  <div className="text-xs text-slate-400">Direct amount</div>
                </div>
                <span className="text-sm font-bold font-mono text-rose-600">{otherExpense > 0 ? fmtN(otherExpense) : "—"}</span>
              </div>
              <QtyInput value={otherExpense} onChange={setOtherExpense} large className="w-full max-w-[160px]" />
            </div>

            {/* Expense total */}
            <div className="px-3 py-2.5 bg-rose-50 dark:bg-rose-900/20 flex items-center justify-between">
              <span className="text-sm font-bold text-rose-800 dark:text-rose-200">Total Expense</span>
              <span className="text-base font-bold font-mono text-rose-700">{fmtN(totalExpense)}</span>
            </div>
          </div>
        </div>

        {/* ── AKBAR ALI ─────────────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-orange-200 dark:border-orange-800 overflow-hidden shadow-sm">
          <div className="bg-gradient-to-r from-orange-600 to-amber-500 px-4 py-3 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-white" />
            <h2 className="text-sm font-bold text-white">Akbar Ali Handover</h2>
          </div>
          <div className="px-3 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-slate-400">Total cash given to Akbar Ali</div>
              <span className="text-sm font-bold font-mono text-orange-600">{akbarAliAmount > 0 ? fmtN(akbarAliAmount) : "—"}</span>
            </div>
            <QtyInput value={akbarAliAmount} onChange={setAkbarAliAmount} large className="w-full max-w-[160px] bg-orange-50 dark:bg-orange-900/20" />
          </div>
        </div>

        {/* ── SUMMARY BAR ───────────────────────────────────────── */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-700 rounded-xl p-3 sm:p-4 shadow-lg">
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            {[
              { icon: TrendingUp, label: "Income", value: totalIncome, cls: "text-emerald-400" },
              { icon: TrendingDown, label: "Expense", value: totalExpense, cls: "text-rose-400" },
              { icon: Wallet, label: "Balance", value: balance, cls: balance >= 0 ? "text-sky-400" : "text-orange-400" },
            ].map(({ icon: Icon, label, value, cls }) => (
              <div key={label} className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Icon className={`w-3 h-3 ${cls}`} />
                  <span className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</span>
                </div>
                <div className={`text-base sm:text-lg font-bold font-mono ${cls}`}>{fmtN(value)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom save button */}
        <Button onClick={handleSave} disabled={isPending}
          className="w-full bg-teal-600 hover:bg-teal-700 text-white h-12 text-base gap-2"
          data-testid="button-save-bottom">
          {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          {editId ? "Update Seal KPF" : "Save Seal KPF"}
        </Button>

        {/* Bottom spacing for mobile */}
        <div className="h-4" />
      </div>
    </Layout>
  );
}
