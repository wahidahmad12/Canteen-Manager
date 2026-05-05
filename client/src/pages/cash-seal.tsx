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
  IndianRupee, BarChart3, Calendar, Printer, Search, Trash2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCreateCashSeal, useUpdateCashSeal, useDeleteCashSeal, useCashSeals } from "@/hooks/use-reports";
import { queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";

// ── Rates ─────────────────────────────────────────────────────────
const PS_RATES = { bf: 5, ln: 20, ev: 10, nt: 10 };
const TP_RATES = { bf: 20, lv: 35, ev: 20, nt: 20, eg: 45, fs: 55, ck: 65 };
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
    n(s.incomeTpLunchEggCashQty) * TP_RATES.eg + n(s.incomeTpLunchFishCashQty) * TP_RATES.fs +
    n(s.incomeTpLunchChickenCashQty) * TP_RATES.ck +
    n(s.incomeTpEveningCashQty) * TP_RATES.ev + n(s.incomeTpNightCashQty) * TP_RATES.nt +
    n(s.incomeTpBreakfastOnlineQty) * TP_RATES.bf + n(s.incomeTpLunchVegOnlineQty) * TP_RATES.lv +
    n(s.incomeTpLunchNvRate) * n(s.incomeTpLunchNvOnlineQty) +
    n(s.incomeTpLunchEggOnlineQty) * TP_RATES.eg + n(s.incomeTpLunchFishOnlineQty) * TP_RATES.fs +
    n(s.incomeTpLunchChickenOnlineQty) * TP_RATES.ck +
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

// ── Qty display formatter (shows decimals cleanly) ────────────────
const fmtQty = (n: number): string => {
  if (n === 0) return "0";
  if (Number.isInteger(n)) return String(n);
  return parseFloat(n.toFixed(4)).toString();
};

// ── Number input (supports decimals) ─────────────────────────────
function QtyInput({ value, onChange, placeholder = "0", className = "", large = false }: {
  value: number; onChange: (v: number) => void; placeholder?: string;
  className?: string; large?: boolean;
}) {
  return (
    <Input
      type="number"
      inputMode="decimal"
      step="any"
      min={0}
      value={value === 0 ? "" : value}
      onChange={e => onChange(Number(e.target.value) || 0)}
      placeholder={placeholder}
      className={`text-center font-mono ${large ? "h-12 text-lg font-bold" : "h-9 text-sm"} ${className}`}
      data-testid="input-qty"
    />
  );
}

// ── Shared item props ─────────────────────────────────────────────
interface ItemCardProps {
  no: number; name: string;
  fixedRate?: number;
  customRate?: number; onCustomRate?: (v: number) => void;
  cashQty: number; onCashQty: (v: number) => void;
  onlineQty: number; onOnlineQty: (v: number) => void;
  color: "blue" | "green";
  amountMode?: boolean;
}

// ── Amount input helper (bidirectional) ───────────────────────────
function AmountInput({ rate, qty, onQty, className = "", placeholder = "0.00", liveMode = false }: {
  rate: number; qty: number; onQty: (v: number) => void;
  className?: string; placeholder?: string; liveMode?: boolean;
}) {
  const [localAmt, setLocalAmt] = useState<string>(qty > 0 && rate > 0 ? String(qty * rate) : "");
  useEffect(() => {
    setLocalAmt(qty > 0 && rate > 0 ? String(qty * rate) : "");
  }, [qty, rate]);

  const disabled = !liveMode && rate === 0;
  return (
    <Input
      type="number"
      inputMode="decimal"
      min={0}
      disabled={disabled}
      value={localAmt}
      onChange={e => {
        setLocalAmt(e.target.value);
        if (liveMode) {
          const amt = Number(e.target.value) || 0;
          onQty(rate > 0 ? amt / rate : amt);
        }
      }}
      onBlur={() => {
        if (liveMode) {
          const amt = Number(localAmt) || 0;
          const newQty = rate > 0 ? amt / rate : amt;
          onQty(newQty);
          setLocalAmt(amt > 0 ? String(amt) : "");
        } else if (rate > 0) {
          const amt = Number(localAmt) || 0;
          const newQty = amt > 0 ? amt / rate : 0;
          onQty(newQty);
          setLocalAmt(amt > 0 ? String(amt) : "");
        }
      }}
      placeholder={disabled ? "Set rate first" : placeholder}
      className={`text-center font-mono text-sm h-9 ${disabled ? "opacity-40 cursor-not-allowed" : ""} ${className}`}
      data-testid="input-amount"
    />
  );
}

// ── Mobile item card ──────────────────────────────────────────────
function ItemMobileCard({ no, name, fixedRate, customRate, onCustomRate, cashQty, onCashQty, onlineQty, onOnlineQty, color, amountMode }: ItemCardProps) {
  const rate = customRate !== undefined ? customRate : (fixedRate ?? 0);
  const cashTotal = cashQty * rate;
  const onlineTotal = onlineQty * rate;
  const rowTotal = cashTotal + onlineTotal;
  const borderColor = color === "blue" ? "border-blue-100 dark:border-blue-900/40" : "border-green-100 dark:border-green-900/40";
  const accentText = color === "blue" ? "text-blue-700 dark:text-blue-300" : "text-green-700 dark:text-green-300";

  return (
    <div className={`border-b last:border-b-0 ${borderColor} px-3 py-3`}>
      {/* Name + rate row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${color === "blue" ? "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300" : "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300"}`}>{no}</span>
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{name}</span>
        </div>
        {customRate !== undefined ? (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-400 font-medium">₹</span>
            <Input type="number" inputMode="decimal" min={0}
              value={customRate === 0 ? "" : customRate}
              onChange={e => onCustomRate!(Number(e.target.value) || 0)}
              placeholder="Rate"
              className="w-20 h-8 text-center text-sm bg-amber-50 dark:bg-amber-900/20 border-amber-300 font-mono"
            />
          </div>
        ) : (
          <Badge variant="outline" className={`text-xs font-mono px-2 py-0.5 ${color === "blue" ? "text-blue-700 border-blue-300 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300" : "text-green-700 border-green-300 bg-green-50 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300"}`}>₹{fixedRate}</Badge>
        )}
      </div>

      {/* Cash / Online input cards */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="bg-slate-50 dark:bg-slate-700/40 rounded-xl p-2.5 border border-slate-200 dark:border-slate-600">
          <span className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-bold block mb-1.5">Cash</span>
          {amountMode ? (
            <div className="flex flex-col gap-1.5">
              <div>
                <div className="text-[9px] text-slate-400 mb-0.5 text-center">Cash Amt (₹)</div>
                <AmountInput rate={rate} qty={cashQty} onQty={onCashQty} liveMode className="w-full bg-white dark:bg-slate-700" />
              </div>
              <div className="text-center text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                Qty: <span className="font-bold text-slate-700 dark:text-slate-200">{fmtQty(cashQty)}</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <div>
                <div className="text-[9px] text-slate-400 mb-0.5 text-center">Qty</div>
                <QtyInput value={cashQty} onChange={onCashQty} large className="w-full" />
              </div>
              <div>
                <div className="text-[9px] text-slate-400 mb-0.5 text-center">Amount (₹)</div>
                <AmountInput rate={rate} qty={cashQty} onQty={onCashQty} className="w-full bg-white dark:bg-slate-700" />
              </div>
            </div>
          )}
        </div>
        <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-2.5 border border-indigo-200 dark:border-indigo-700">
          <span className="text-[10px] uppercase tracking-widest text-indigo-500 dark:text-indigo-400 font-bold block mb-1.5">Online</span>
          {amountMode ? (
            <div className="flex flex-col gap-1.5">
              <div>
                <div className="text-[9px] text-indigo-400 mb-0.5 text-center">Online Amt (₹)</div>
                <AmountInput rate={rate} qty={onlineQty} onQty={onOnlineQty} liveMode className="w-full bg-white dark:bg-indigo-900/30" />
              </div>
              <div className="text-center text-[11px] text-indigo-500 dark:text-indigo-400 font-mono">
                Qty: <span className="font-bold text-indigo-700 dark:text-indigo-200">{fmtQty(onlineQty)}</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <div>
                <div className="text-[9px] text-indigo-400 mb-0.5 text-center">Qty</div>
                <QtyInput value={onlineQty} onChange={onOnlineQty} large className="w-full bg-white dark:bg-indigo-900/30" />
              </div>
              <div>
                <div className="text-[9px] text-indigo-400 mb-0.5 text-center">Amount (₹)</div>
                <AmountInput rate={rate} qty={onlineQty} onQty={onOnlineQty} className="w-full bg-white dark:bg-indigo-900/30" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Row total */}
      {rowTotal > 0 && (
        <div className={`flex items-center justify-between mt-2.5 pt-2 border-t border-dashed ${borderColor}`}>
          <span className="text-[11px] text-slate-400">Total Qty: <span className="font-bold text-slate-600 dark:text-slate-300">{fmtQty(cashQty + onlineQty)}</span></span>
          <span className={`text-sm font-bold font-mono ${accentText}`}>{fmtN(rowTotal)}</span>
        </div>
      )}
    </div>
  );
}

// ── Desktop table row ─────────────────────────────────────────────
function ItemTableRow({ no, name, fixedRate, customRate, onCustomRate, cashQty, onCashQty, onlineQty, onOnlineQty, color, amountMode }: ItemCardProps) {
  const rate = customRate !== undefined ? customRate : (fixedRate ?? 0);
  const cashTotal = cashQty * rate;
  const onlineTotal = onlineQty * rate;
  const rowTotal = cashTotal + onlineTotal;
  const accentText = color === "blue" ? "text-blue-700 dark:text-blue-400" : "text-green-700 dark:text-green-400";

  return (
    <tr className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50/60 dark:hover:bg-slate-700/20 transition-colors">
      <td className="py-2 px-2 text-center">
        <span className={`inline-flex w-5 h-5 rounded-full items-center justify-center text-[10px] font-bold ${color === "blue" ? "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300" : "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300"}`}>{no}</span>
      </td>
      <td className="py-2 px-3">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap">{name}</span>
      </td>
      <td className="py-2 px-2 text-center">
        {customRate !== undefined ? (
          <Input type="number" inputMode="decimal" min={0}
            value={customRate === 0 ? "" : customRate}
            onChange={e => onCustomRate!(Number(e.target.value) || 0)}
            placeholder="Rate" className="h-8 text-center text-sm w-full bg-amber-50 dark:bg-amber-900/20 border-amber-300 font-mono" />
        ) : (
          <Badge variant="outline" className={`text-xs font-mono ${color === "blue" ? "text-blue-700 border-blue-300 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300" : "text-green-700 border-green-300 bg-green-50 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300"}`}>₹{fixedRate}</Badge>
        )}
      </td>
      <td className="py-2 px-2">
        {amountMode
          ? <span className="block text-center text-sm font-mono font-bold text-slate-600 dark:text-slate-300 min-w-[72px]">{fmtQty(cashQty)}</span>
          : <QtyInput value={cashQty} onChange={onCashQty} className="w-full min-w-[72px]" />}
      </td>
      <td className="py-2 px-2">
        <AmountInput rate={rate} qty={cashQty} onQty={onCashQty} liveMode={amountMode} className="w-full min-w-[90px] bg-slate-50 dark:bg-slate-700/30" />
      </td>
      <td className="py-2 px-2">
        {amountMode
          ? <span className="block text-center text-sm font-mono font-bold text-indigo-600 dark:text-indigo-300 min-w-[72px]">{fmtQty(onlineQty)}</span>
          : <QtyInput value={onlineQty} onChange={onOnlineQty} className="w-full min-w-[72px] bg-indigo-50 dark:bg-indigo-900/20" />}
      </td>
      <td className="py-2 px-2">
        <AmountInput rate={rate} qty={onlineQty} onQty={onOnlineQty} liveMode={amountMode} className="w-full min-w-[90px] bg-indigo-50 dark:bg-indigo-900/20" />
      </td>
      <td className="py-2 px-3 text-right">
        <span className="text-sm font-mono font-bold text-slate-500 dark:text-slate-400">{(cashQty + onlineQty) > 0 ? fmtQty(cashQty + onlineQty) : <span className="text-slate-300 dark:text-slate-600">—</span>}</span>
      </td>
      <td className="py-2 px-3 text-right">
        <span className={`text-sm font-bold font-mono ${accentText}`}>{rowTotal > 0 ? fmtN(rowTotal) : <span className="text-slate-300 dark:text-slate-600">—</span>}</span>
      </td>
    </tr>
  );
}

// ── Section table header row ──────────────────────────────────────
function SectionTableHead({ color }: { color: "blue" | "green" }) {
  const cls = color === "blue"
    ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-800"
    : "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-100 dark:border-green-800";
  return (
    <thead>
      <tr className={`text-[10px] font-bold uppercase tracking-wide border-b ${cls}`}>
        <th className="py-2 px-2 text-center w-10">#</th>
        <th className="py-2 px-3 text-left">Name</th>
        <th className="py-2 px-2 text-center w-20">Rate</th>
        <th className="py-2 px-2 text-center w-24">Cash Qty</th>
        <th className="py-2 px-2 text-center w-28">Cash Amt ₹</th>
        <th className="py-2 px-2 text-center w-24">Online Qty</th>
        <th className="py-2 px-2 text-center w-28">Online Amt ₹</th>
        <th className="py-2 px-3 text-right w-20">Row Qty</th>
        <th className="py-2 px-3 text-right w-28">Row Amt</th>
      </tr>
    </thead>
  );
}

interface SubtotalProps {
  cashTotal: number; onlineTotal: number;
  cashQtyTotal: number; onlineQtyTotal: number;
  color: "blue" | "green";
}

// ── Desktop table footer row ──────────────────────────────────────
function SubtotalTableFoot({ cashTotal, onlineTotal, cashQtyTotal, onlineQtyTotal, color }: SubtotalProps) {
  const grand = cashTotal + onlineTotal;
  const isBlue = color === "blue";
  const bg = isBlue ? "bg-blue-50 dark:bg-blue-900/30" : "bg-green-50 dark:bg-green-900/30";
  const border = isBlue ? "border-t-2 border-blue-200 dark:border-blue-700" : "border-t-2 border-green-200 dark:border-green-700";
  const accent = isBlue ? "text-blue-700 dark:text-blue-300" : "text-green-700 dark:text-green-300";
  return (
    <tfoot>
      <tr className={`${bg} ${border}`}>
        <td />
        <td className={`py-2.5 px-3 text-xs font-bold uppercase tracking-wider ${accent}`}>TOTALS</td>
        <td />
        <td className={`py-2.5 px-2 text-center text-sm font-bold font-mono ${accent}`}>{cashQtyTotal > 0 ? fmtQty(cashQtyTotal) : "—"}</td>
        <td className={`py-2.5 px-3 text-right text-sm font-bold font-mono ${accent}`}>{cashTotal > 0 ? fmtN(cashTotal) : "—"}</td>
        <td className="py-2.5 px-2 text-center text-sm font-bold font-mono text-indigo-600 dark:text-indigo-400">{onlineQtyTotal > 0 ? fmtQty(onlineQtyTotal) : "—"}</td>
        <td className="py-2.5 px-3 text-right text-sm font-bold font-mono text-indigo-600 dark:text-indigo-400">{onlineTotal > 0 ? fmtN(onlineTotal) : "—"}</td>
        <td className="py-2.5 px-3 text-right text-sm font-bold font-mono text-slate-500 dark:text-slate-400">{(cashQtyTotal + onlineQtyTotal) > 0 ? fmtQty(cashQtyTotal + onlineQtyTotal) : "—"}</td>
        <td className={`py-2.5 px-3 text-right text-sm font-bold font-mono ${accent}`}>{grand > 0 ? fmtN(grand) : "—"}</td>
      </tr>
    </tfoot>
  );
}

// ── Mobile subtotal summary ───────────────────────────────────────
function SubtotalMobile({ cashTotal, onlineTotal, cashQtyTotal, onlineQtyTotal, color }: SubtotalProps) {
  const grand = cashTotal + onlineTotal;
  const isBlue = color === "blue";
  const bg = isBlue ? "bg-blue-50/80 dark:bg-blue-900/30" : "bg-green-50/80 dark:bg-green-900/30";
  const accent = isBlue ? "text-blue-700 dark:text-blue-300" : "text-green-700 dark:text-green-300";
  const border = isBlue ? "border-blue-200 dark:border-blue-800" : "border-green-200 dark:border-green-800";
  return (
    <div className={`border-t ${border} ${bg} px-3 py-3`}>
      <div className="grid grid-cols-2 gap-2 mb-2.5">
        <div className="bg-white/80 dark:bg-slate-800/60 rounded-xl p-2.5 border border-slate-100 dark:border-slate-700">
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Cash</div>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold ${accent}`}>Qty: {cashQtyTotal > 0 ? fmtQty(cashQtyTotal) : "—"}</span>
            <span className={`text-xs font-bold font-mono ${accent}`}>{cashTotal > 0 ? fmtN(cashTotal) : "—"}</span>
          </div>
        </div>
        <div className="bg-white/80 dark:bg-slate-800/60 rounded-xl p-2.5 border border-indigo-100 dark:border-indigo-900/50">
          <div className="text-[10px] font-bold uppercase tracking-wide text-indigo-400 mb-1.5">Online</div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Qty: {onlineQtyTotal > 0 ? fmtQty(onlineQtyTotal) : "—"}</span>
            <span className="text-xs font-bold font-mono text-indigo-600 dark:text-indigo-400">{onlineTotal > 0 ? fmtN(onlineTotal) : "—"}</span>
          </div>
        </div>
      </div>
      <div className={`flex items-center justify-between pt-2 border-t border-dashed ${border}`}>
        <span className="text-xs text-slate-400">Total Qty: <span className={`font-bold ${accent}`}>{fmtQty(cashQtyTotal + onlineQtyTotal)}</span></span>
        <span className={`text-base font-bold font-mono ${accent}`}>{fmtN(grand)}</span>
      </div>
    </div>
  );
}

// ── Unified section wrapper ───────────────────────────────────────
interface SectionProps {
  color: "blue" | "green";
  items: ItemCardProps[];
  cashTotal: number; onlineTotal: number;
  cashQtyTotal: number; onlineQtyTotal: number;
}
function IncomeSection({ color, items, cashTotal, onlineTotal, cashQtyTotal, onlineQtyTotal }: SectionProps) {
  return (
    <>
      {/* Mobile: stacked cards + summary */}
      <div className="md:hidden">
        <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
          {items.map(item => <ItemMobileCard key={item.no} {...item} />)}
        </div>
        <SubtotalMobile cashTotal={cashTotal} onlineTotal={onlineTotal} cashQtyTotal={cashQtyTotal} onlineQtyTotal={onlineQtyTotal} color={color} />
      </div>
      {/* Desktop: proper HTML table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse">
          <SectionTableHead color={color} />
          <tbody>
            {items.map(item => <ItemTableRow key={item.no} {...item} />)}
          </tbody>
          <SubtotalTableFoot cashTotal={cashTotal} onlineTotal={onlineTotal} cashQtyTotal={cashQtyTotal} onlineQtyTotal={onlineQtyTotal} color={color} />
        </table>
      </div>
    </>
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
  const deleteMutation = useDeleteCashSeal();
  const { data: records = [], isLoading: recordsLoading } = useCashSeals();
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // ── PS state ───────────────────────────────────────────────────
  const [psBfCash, setPsBfCash] = useState(0);
  const [psLnCash, setPsLnCash] = useState(0);
  const [psEvCash, setPsEvCash] = useState(0);
  const [psNtCash, setPsNtCash] = useState(0);
  const [psRcRate, setPsRcRate] = useState(1);
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
  const [tpEgCash, setTpEgCash] = useState(0);
  const [tpFsCash, setTpFsCash] = useState(0);
  const [tpCkCash, setTpCkCash] = useState(0);
  const [tpEvCash, setTpEvCash] = useState(0);
  const [tpNtCash, setTpNtCash] = useState(0);
  const [tpBfOnline, setTpBfOnline] = useState(0);
  const [tpLvOnline, setTpLvOnline] = useState(0);
  const [tpNvOnline, setTpNvOnline] = useState(0);
  const [tpEgOnline, setTpEgOnline] = useState(0);
  const [tpFsOnline, setTpFsOnline] = useState(0);
  const [tpCkOnline, setTpCkOnline] = useState(0);
  const [tpEvOnline, setTpEvOnline] = useState(0);
  const [tpNtOnline, setTpNtOnline] = useState(0);

  // ── Put Days state ─────────────────────────────────────────────
  const [putDays, setPutDays] = useState(0);

  // ── Expense state ──────────────────────────────────────────────
  const [bananaQty, setBananaQty] = useState(0);
  const [dahiBharQty, setDahiBharQty] = useState(0);
  const [dahiBharRate, setDahiBharRate] = useState(0);
  const [otherExpense, setOtherExpense] = useState(0);
  const [akbarAliAmount, setAkbarAliAmount] = useState(0);
  const [akbarAliManual, setAkbarAliManual] = useState(false);

  // ── Dirty-state tracking ───────────────────────────────────────
  const originalRec = useRef<any>(null);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

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
    setPsRcRate(n(rec.incomePsRechargeRate) || 1); setPsRcCash(n(rec.incomePsRechargeCashQty));
    setPsBfOnline(n(rec.incomePsBreakfastOnlineQty)); setPsLnOnline(n(rec.incomePsLunchOnlineQty));
    setPsEvOnline(n(rec.incomePsEveningOnlineQty)); setPsNtOnline(n(rec.incomePsNightOnlineQty));
    setPsRcOnline(n(rec.incomePsRechargeOnlineQty));
    setTpBfCash(n(rec.incomeTpBreakfastCashQty)); setTpLvCash(n(rec.incomeTpLunchVegCashQty));
    setTpNvRate(n(rec.incomeTpLunchNvRate)); setTpNvCash(n(rec.incomeTpLunchNvCashQty));
    setTpEgCash(n(rec.incomeTpLunchEggCashQty)); setTpFsCash(n(rec.incomeTpLunchFishCashQty));
    setTpCkCash(n(rec.incomeTpLunchChickenCashQty));
    setTpEvCash(n(rec.incomeTpEveningCashQty)); setTpNtCash(n(rec.incomeTpNightCashQty));
    setTpBfOnline(n(rec.incomeTpBreakfastOnlineQty)); setTpLvOnline(n(rec.incomeTpLunchVegOnlineQty));
    setTpNvOnline(n(rec.incomeTpLunchNvOnlineQty));
    setTpEgOnline(n(rec.incomeTpLunchEggOnlineQty)); setTpFsOnline(n(rec.incomeTpLunchFishOnlineQty));
    setTpCkOnline(n(rec.incomeTpLunchChickenOnlineQty));
    setTpEvOnline(n(rec.incomeTpEveningOnlineQty)); setTpNtOnline(n(rec.incomeTpNightOnlineQty));
    setBananaQty(n(rec.expenseBananaQty)); setDahiBharQty(n(rec.expenseDahiBharQty));
    setDahiBharRate(n(rec.expenseDahiBharRate)); setOtherExpense(n(rec.expenseOtherAmount));
    setAkbarAliAmount(n(rec.totalGivenToAkbarAli));
    setPutDays(n(rec.putDays));
    setAkbarAliManual(true);
    originalRec.current = rec;
    if (rec.date) { try { setDate(parseISO(rec.date)); } catch { setDate(new Date(rec.date)); } }
  }

  function resetForm() {
    setPsBfCash(0); setPsLnCash(0); setPsEvCash(0); setPsNtCash(0); setPsRcRate(1); setPsRcCash(0);
    setPsBfOnline(0); setPsLnOnline(0); setPsEvOnline(0); setPsNtOnline(0); setPsRcOnline(0);
    setTpBfCash(0); setTpLvCash(0); setTpNvRate(0); setTpNvCash(0);
    setTpEgCash(0); setTpFsCash(0); setTpCkCash(0); setTpEvCash(0); setTpNtCash(0);
    setTpBfOnline(0); setTpLvOnline(0); setTpNvOnline(0);
    setTpEgOnline(0); setTpFsOnline(0); setTpCkOnline(0); setTpEvOnline(0); setTpNtOnline(0);
    setBananaQty(0); setDahiBharQty(0); setDahiBharRate(0); setOtherExpense(0);
    setAkbarAliAmount(0); setAkbarAliManual(false); setPutDays(0); setDate(new Date());
    originalRec.current = null;
  }

  function handleEdit(rec: any) { setEditId(rec.id); loadRecord(rec); setView("form"); }
  function handleNew() { setEditId(null); resetForm(); setView("form"); }

  function getIsDirty() {
    if (!editId || !originalRec.current) return false;
    const n = (v: any) => Number(v) || 0;
    const r = originalRec.current;
    return (
      psBfCash !== n(r.incomePsBreakfastCashQty) || psLnCash !== n(r.incomePsLunchCashQty) ||
      psEvCash !== n(r.incomePsEveningCashQty) || psNtCash !== n(r.incomePsNightCashQty) ||
      psRcRate !== n(r.incomePsRechargeRate) || psRcCash !== n(r.incomePsRechargeCashQty) ||
      psBfOnline !== n(r.incomePsBreakfastOnlineQty) || psLnOnline !== n(r.incomePsLunchOnlineQty) ||
      psEvOnline !== n(r.incomePsEveningOnlineQty) || psNtOnline !== n(r.incomePsNightOnlineQty) ||
      psRcOnline !== n(r.incomePsRechargeOnlineQty) ||
      tpBfCash !== n(r.incomeTpBreakfastCashQty) || tpLvCash !== n(r.incomeTpLunchVegCashQty) ||
      tpNvRate !== n(r.incomeTpLunchNvRate) || tpNvCash !== n(r.incomeTpLunchNvCashQty) ||
      tpEgCash !== n(r.incomeTpLunchEggCashQty) || tpFsCash !== n(r.incomeTpLunchFishCashQty) ||
      tpCkCash !== n(r.incomeTpLunchChickenCashQty) ||
      tpEvCash !== n(r.incomeTpEveningCashQty) || tpNtCash !== n(r.incomeTpNightCashQty) ||
      tpBfOnline !== n(r.incomeTpBreakfastOnlineQty) || tpLvOnline !== n(r.incomeTpLunchVegOnlineQty) ||
      tpNvOnline !== n(r.incomeTpLunchNvOnlineQty) ||
      tpEgOnline !== n(r.incomeTpLunchEggOnlineQty) || tpFsOnline !== n(r.incomeTpLunchFishOnlineQty) ||
      tpCkOnline !== n(r.incomeTpLunchChickenOnlineQty) ||
      tpEvOnline !== n(r.incomeTpEveningOnlineQty) || tpNtOnline !== n(r.incomeTpNightOnlineQty) ||
      bananaQty !== n(r.expenseBananaQty) || dahiBharQty !== n(r.expenseDahiBharQty) ||
      dahiBharRate !== n(r.expenseDahiBharRate) || otherExpense !== n(r.expenseOtherAmount) ||
      akbarAliAmount !== n(r.totalGivenToAkbarAli)
    );
  }

  function handleBack() {
    if (view === "form") {
      if (editId && getIsDirty()) {
        setShowUnsavedDialog(true);
      } else {
        setView("list"); setEditId(null);
      }
    } else {
      navigate("/");
    }
  }
  async function handleDelete(id: number) {
    try {
      await deleteMutation.mutateAsync(id);
      toast({ title: "Deleted", description: "Record deleted successfully" });
      setConfirmDeleteId(null);
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to delete", variant: "destructive" });
    }
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
  const psCashQtyTotal = psBfCash + psLnCash + psEvCash + psNtCash + psRcCash;
  const psOnlineQtyTotal = psBfOnline + psLnOnline + psEvOnline + psNtOnline + psRcOnline;

  const tpBfCashT = tpBfCash * TP_RATES.bf;  const tpLvCashT = tpLvCash * TP_RATES.lv;
  const tpNvCashT = tpNvCash * tpNvRate;
  const tpEgCashT = tpEgCash * TP_RATES.eg; const tpFsCashT = tpFsCash * TP_RATES.fs;
  const tpCkCashT = tpCkCash * TP_RATES.ck;
  const tpEvCashT = tpEvCash * TP_RATES.ev;  const tpNtCashT = tpNtCash * TP_RATES.nt;
  const tpBfOnlineT = tpBfOnline * TP_RATES.bf; const tpLvOnlineT = tpLvOnline * TP_RATES.lv;
  const tpNvOnlineT = tpNvOnline * tpNvRate;
  const tpEgOnlineT = tpEgOnline * TP_RATES.eg; const tpFsOnlineT = tpFsOnline * TP_RATES.fs;
  const tpCkOnlineT = tpCkOnline * TP_RATES.ck;
  const tpEvOnlineT = tpEvOnline * TP_RATES.ev; const tpNtOnlineT = tpNtOnline * TP_RATES.nt;
  const tpTotalCash = tpBfCashT + tpLvCashT + tpNvCashT + tpEgCashT + tpFsCashT + tpCkCashT + tpEvCashT + tpNtCashT;
  const tpTotalOnline = tpBfOnlineT + tpLvOnlineT + tpNvOnlineT + tpEgOnlineT + tpFsOnlineT + tpCkOnlineT + tpEvOnlineT + tpNtOnlineT;
  const tpCashQtyTotal = tpBfCash + tpLvCash + tpNvCash + tpEgCash + tpFsCash + tpCkCash + tpEvCash + tpNtCash;
  const tpOnlineQtyTotal = tpBfOnline + tpLvOnline + tpNvOnline + tpEgOnline + tpFsOnline + tpCkOnline + tpEvOnline + tpNtOnline;

  const totalCashIncome = psTotalCash + tpTotalCash;
  const totalOnlineIncome = psTotalOnline + tpTotalOnline;
  const totalIncome = totalCashIncome + totalOnlineIncome;
  const bananaTotal = bananaQty * BANANA_RATE;
  const dahiBharTotal = dahiBharQty * dahiBharRate;
  const totalExpense = bananaTotal + dahiBharTotal + otherExpense;
  const cashBalance = totalCashIncome - totalExpense;
  const onlineBalance = totalOnlineIncome;
  const balance = totalIncome - totalExpense;

  // Auto-sync Akbar Ali amount with cash balance when not manually overridden
  useEffect(() => {
    if (!akbarAliManual) {
      setAkbarAliAmount(Math.max(0, Math.round(cashBalance * 100) / 100));
    }
  }, [cashBalance, akbarAliManual]);

  const payload = {
    incomePsBreakfastCashQty: psBfCash, incomePsLunchCashQty: psLnCash,
    incomePsEveningCashQty: psEvCash, incomePsNightCashQty: psNtCash,
    incomePsRechargeRate: psRcRate, incomePsRechargeCashQty: psRcCash,
    incomePsBreakfastOnlineQty: psBfOnline, incomePsLunchOnlineQty: psLnOnline,
    incomePsEveningOnlineQty: psEvOnline, incomePsNightOnlineQty: psNtOnline,
    incomePsRechargeOnlineQty: psRcOnline,
    incomeTpBreakfastCashQty: tpBfCash, incomeTpLunchVegCashQty: tpLvCash,
    incomeTpLunchNvRate: tpNvRate, incomeTpLunchNvCashQty: tpNvCash,
    incomeTpLunchEggCashQty: tpEgCash, incomeTpLunchFishCashQty: tpFsCash,
    incomeTpLunchChickenCashQty: tpCkCash,
    incomeTpEveningCashQty: tpEvCash, incomeTpNightCashQty: tpNtCash,
    incomeTpBreakfastOnlineQty: tpBfOnline, incomeTpLunchVegOnlineQty: tpLvOnline,
    incomeTpLunchNvOnlineQty: tpNvOnline,
    incomeTpLunchEggOnlineQty: tpEgOnline, incomeTpLunchFishOnlineQty: tpFsOnline,
    incomeTpLunchChickenOnlineQty: tpCkOnline,
    incomeTpEveningOnlineQty: tpEvOnline, incomeTpNightOnlineQty: tpNtOnline,
    expenseBananaQty: bananaQty, expenseDahiBharQty: dahiBharQty,
    expenseDahiBharRate: dahiBharRate, expenseOtherAmount: otherExpense,
    totalGivenToAkbarAli: akbarAliAmount,
    putDays,
  };

  const handleSave = async () => {
    try {
      if (editId) {
        await updateMutation.mutateAsync({ id: editId, data: payload });
        toast({ title: "Updated", description: "Record updated & Expense Report synced" });
      } else {
        await saveMutation.mutateAsync({ date: format(date, "yyyy-MM-dd"), ...payload });
        toast({ title: "Saved", description: "Cash Seal KPF saved & Expense Report synced" });
      }
      // Invalidate expense reports so the linked report reflects the new Akbar Ali amount
      queryClient.invalidateQueries({ queryKey: ['/api/reports'] });
      setView("list"); setEditId(null);
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to save", variant: "destructive" });
    }
  };

  const isPending = saveMutation.isPending || updateMutation.isPending;

  const handleExportExcel = async () => {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Cash Seal KPF");

    const dateStr = format(date, "dd MMM yyyy");
    const navy  = "FF1E3A5F";
    const teal  = "FF0F766E";
    const white = "FFFFFFFF";
    const green = "FF15803D";
    const gray  = "FFF1F5F9";
    const totalBg = "FFE0F2FE";
    const thin  = { style: "thin" as const, color: { argb: "FFCBD5E1" } };
    const border = { top: thin, left: thin, bottom: thin, right: thin };

    ws.columns = [
      { key: "no",    width: 6  },
      { key: "name",  width: 22 },
      { key: "rate",  width: 10 },
      { key: "cq",    width: 12 },
      { key: "cat",   width: 18 },
      { key: "oq",    width: 12 },
      { key: "oat",   width: 18 },
      { key: "rqt",   width: 14 },
      { key: "rat",   width: 18 },
    ];

    const headers = ["#", "Name", "Rate", "Cash Qty", "Cash Amount Total", "Online Qty", "Online Amount Total", "Row Qty Total", "Row Amount Total"];

    const addTitle = (label: string, bg: string) => {
      const r = ws.addRow([label]);
      ws.mergeCells(`A${r.number}:I${r.number}`);
      const c = r.getCell(1);
      c.font = { bold: true, color: { argb: white }, size: 12 };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      c.alignment = { horizontal: "center", vertical: "middle" };
      r.height = 22;
    };

    const addHeader = () => {
      const r = ws.addRow(headers);
      r.height = 18;
      headers.forEach((_, i) => {
        const c = r.getCell(i + 1);
        c.font = { bold: true, color: { argb: white } };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: teal } };
        c.alignment = { horizontal: i >= 3 ? "center" : i === 1 ? "left" : "center", vertical: "middle" };
        c.border = border;
      });
    };

    const addDataRow = (no: number, name: string, rate: number | string, cq: number, cat: number, oq: number, oat: number) => {
      const rqt = cq + oq;
      const rat = cat + oat;
      const r = ws.addRow([no, name, rate, cq, cat, oq, oat, rqt, rat]);
      r.height = 16;
      const bg = no % 2 === 0 ? gray : white;
      [1,2,3,4,5,6,7,8,9].forEach(i => {
        const c = r.getCell(i);
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        c.alignment = { horizontal: i <= 2 ? (i===1?"center":"left") : "right", vertical: "middle" };
        c.border = border;
        if ([4,5,6,7,8,9].includes(i) && typeof c.value === "number") c.numFmt = i===4||i===6||i===8 ? "0" : "#,##0.00";
      });
    };

    const addTotalsRow = (cq: number, cat: number, oq: number, oat: number) => {
      const rqt = cq + oq;
      const rat = cat + oat;
      const r = ws.addRow(["", "", "Total", cq, cat, oq, oat, rqt, rat]);
      r.height = 17;
      [1,2,3,4,5,6,7,8,9].forEach(i => {
        const c = r.getCell(i);
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: totalBg } };
        c.font = { bold: true, color: { argb: i===9 ? green : "FF0F172A" } };
        c.alignment = { horizontal: i===3?"right": i>=4?"right":"center", vertical: "middle" };
        c.border = border;
        if ([4,5,6,7,8,9].includes(i) && typeof c.value === "number") c.numFmt = i===4||i===6||i===8 ? "0" : "#,##0.00";
      });
    };

    // ─── Header ───
    const titleRow = ws.addRow(["DJ Hospitality & Facility Management Pvt Ltd"]);
    ws.mergeCells(`A${titleRow.number}:I${titleRow.number}`);
    const tc = titleRow.getCell(1);
    tc.font = { bold: true, color: { argb: white }, size: 14 };
    tc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: navy } };
    tc.alignment = { horizontal: "center", vertical: "middle" };
    titleRow.height = 26;

    const subRow = ws.addRow([`Daily Cash Seal KPF — ${dateStr}`]);
    ws.mergeCells(`A${subRow.number}:I${subRow.number}`);
    const sc = subRow.getCell(1);
    sc.font = { bold: true, color: { argb: white }, size: 11 };
    sc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: teal } };
    sc.alignment = { horizontal: "center", vertical: "middle" };
    subRow.height = 20;

    ws.addRow([]);

    // ─── PS section ───
    addTitle("Permanent Staff (PS)", "FF1E40AF");
    addHeader();
    addDataRow(1, "Breakfast",    `₹${PS_RATES.bf}`, psBfCash,  psBfCashT,  psBfOnline,  psBfOnlineT);
    addDataRow(2, "Lunch",        `₹${PS_RATES.ln}`, psLnCash,  psLnCashT,  psLnOnline,  psLnOnlineT);
    addDataRow(3, "Evening Snacks",`₹${PS_RATES.ev}`,psEvCash,  psEvCashT,  psEvOnline,  psEvOnlineT);
    addDataRow(4, "Night Snacks", `₹${PS_RATES.nt}`, psNtCash,  psNtCashT,  psNtOnline,  psNtOnlineT);
    addDataRow(5, "Recharge",     `₹${psRcRate}`,    psRcCash,  psRcCashT,  psRcOnline,  psRcOnlineT);
    addTotalsRow(psCashQtyTotal, psTotalCash, psOnlineQtyTotal, psTotalOnline);

    ws.addRow([]);

    // ─── TP section ───
    addTitle("Third Party (TP)", "FF065F46");
    addHeader();
    addDataRow(1, "Breakfast",         `₹${TP_RATES.bf}`, tpBfCash, tpBfCashT, tpBfOnline, tpBfOnlineT);
    addDataRow(2, "Lunch Veg",         `₹${TP_RATES.lv}`, tpLvCash, tpLvCashT, tpLvOnline, tpLvOnlineT);
    addDataRow(3, "Egg Lunch",         `₹${TP_RATES.eg}`, tpEgCash, tpEgCashT, tpEgOnline, tpEgOnlineT);
    addDataRow(4, "Fish Lunch",        `₹${TP_RATES.fs}`, tpFsCash, tpFsCashT, tpFsOnline, tpFsOnlineT);
    addDataRow(5, "Chicken Lunch",     `₹${TP_RATES.ck}`, tpCkCash, tpCkCashT, tpCkOnline, tpCkOnlineT);
    addDataRow(6, "Evening Snacks",    `₹${TP_RATES.ev}`, tpEvCash, tpEvCashT, tpEvOnline, tpEvOnlineT);
    addDataRow(7, "Night",             `₹${TP_RATES.nt}`, tpNtCash, tpNtCashT, tpNtOnline, tpNtOnlineT);
    addTotalsRow(tpCashQtyTotal, tpTotalCash, tpOnlineQtyTotal, tpTotalOnline);

    ws.addRow([]);

    // ─── Grand Total ───
    const grandCashQty = psCashQtyTotal + tpCashQtyTotal;
    const grandCashAmt = psTotalCash + tpTotalCash;
    const grandOnlineQty = psOnlineQtyTotal + tpOnlineQtyTotal;
    const grandOnlineAmt = psTotalOnline + tpTotalOnline;
    const gtr = ws.addRow(["", "", "Grand Total", grandCashQty, grandCashAmt, grandOnlineQty, grandOnlineAmt, grandCashQty + grandOnlineQty, grandCashAmt + grandOnlineAmt]);
    gtr.height = 20;
    [1,2,3,4,5,6,7,8,9].forEach(i => {
      const c = gtr.getCell(i);
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: navy } };
      c.font = { bold: true, color: { argb: white }, size: i===9?12:11 };
      c.alignment = { horizontal: i>=3?"right":"center", vertical: "middle" };
      c.border = border;
      if ([4,5,6,7,8,9].includes(i) && typeof c.value === "number") c.numFmt = i===4||i===6||i===8 ? "0" : "#,##0.00";
    });

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `CashSeal_KPF_${format(date, "yyyy-MM-dd")}.xlsx`; a.click();
    URL.revokeObjectURL(url);
  };

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
      return { income: acc.income + t.income, expense: acc.expense + t.expense, balance: acc.balance + t.balance, akbarAli: acc.akbarAli + (Number(s.totalGivenToAkbarAli) || 0) };
    }, { income: 0, expense: 0, balance: 0, akbarAli: 0 });

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
                        {["Sl#", "Date", "Put Days", "PS Income", "TP Income", "Total Income", "Expense", "Balance", "Akbar Ali", "Actions"].map(h => (
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
                            <td className="px-3 py-2.5 text-center">
                              {Number(seal.putDays) > 0
                                ? <span className="inline-block px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 text-xs font-bold font-mono">{seal.putDays}</span>
                                : <span className="text-slate-300">—</span>}
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
                                {confirmDeleteId === seal.id ? (
                                  <span className="flex items-center gap-1">
                                    <button onClick={() => handleDelete(seal.id)}
                                      disabled={deleteMutation.isPending}
                                      className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white hover:bg-red-700 transition-colors"
                                      data-testid={`button-confirm-delete-seal-${seal.id}`}>
                                      {deleteMutation.isPending ? "..." : "Yes"}
                                    </button>
                                    <button onClick={() => setConfirmDeleteId(null)}
                                      className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors"
                                      data-testid={`button-cancel-delete-seal-${seal.id}`}>
                                      No
                                    </button>
                                  </span>
                                ) : (
                                  <button onClick={() => setConfirmDeleteId(seal.id)}
                                    className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                    title="Delete" data-testid={`button-delete-seal-${seal.id}`}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {/* Footer totals */}
                    <tfoot>
                      <tr className="bg-teal-50 dark:bg-teal-900/20 border-t-2 border-teal-200 dark:border-teal-700">
                        <td colSpan={5} className="px-3 py-2.5 text-xs font-bold uppercase text-teal-700 dark:text-teal-300 tracking-wide">Total ({filtered.length} records)</td>
                        <td className="px-3 py-2.5 text-sm font-bold font-mono text-emerald-700 dark:text-emerald-300">{fmtN(totals.income)}</td>
                        <td className="px-3 py-2.5 text-sm font-bold font-mono text-rose-600 dark:text-rose-400">{fmtN(totals.expense)}</td>
                        <td className="px-3 py-2.5 text-sm font-bold font-mono text-sky-700 dark:text-sky-300">{fmtN(totals.balance)}</td>
                        <td className="px-3 py-2.5 text-sm font-bold font-mono text-orange-600 dark:text-orange-400">{fmtN(totals.akbarAli)}</td>
                        <td></td>
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
                              {Number(seal.putDays) > 0 && (
                                <div className="text-[10px] text-amber-700 font-semibold">Put Days: {seal.putDays}</div>
                              )}
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
                            {confirmDeleteId === seal.id ? (
                              <span className="flex items-center gap-1">
                                <button onClick={() => handleDelete(seal.id)}
                                  disabled={deleteMutation.isPending}
                                  className="px-2 py-1 rounded text-xs font-bold bg-red-600 text-white">
                                  {deleteMutation.isPending ? "..." : "Yes"}
                                </button>
                                <button onClick={() => setConfirmDeleteId(null)}
                                  className="px-2 py-1 rounded text-xs font-bold bg-slate-200 text-slate-700">
                                  No
                                </button>
                              </span>
                            ) : (
                              <button onClick={() => setConfirmDeleteId(seal.id)}
                                className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                data-testid={`button-delete-seal-mobile-${seal.id}`}>
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
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
                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="text-center"><div className="text-[10px] text-emerald-600">Income</div><div className="text-xs font-bold font-mono text-emerald-700">{fmtN(totals.income)}</div></div>
                      <div className="text-center"><div className="text-[10px] text-rose-600">Expense</div><div className="text-xs font-bold font-mono text-rose-700">{fmtN(totals.expense)}</div></div>
                      <div className="text-center"><div className="text-[10px] text-sky-600">Balance</div><div className="text-xs font-bold font-mono text-sky-700">{fmtN(totals.balance)}</div></div>
                      <div className="text-center"><div className="text-[10px] text-orange-600">Akbar Ali</div><div className="text-xs font-bold font-mono text-orange-700">{fmtN(totals.akbarAli)}</div></div>
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
      {/* ── Unsaved Changes Dialog ─────────────────────────────── */}
      {showUnsavedDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0">
                <Save className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">Unsaved Changes</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">You have made changes. Do you want to save before closing?</p>
              </div>
            </div>
            <div className="flex flex-col gap-2 mt-4">
              <Button
                onClick={async () => { setShowUnsavedDialog(false); await handleSave(); }}
                disabled={isPending}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white gap-2"
                data-testid="button-unsaved-save">
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save & Close
              </Button>
              <Button
                variant="outline"
                onClick={() => { setShowUnsavedDialog(false); setView("list"); setEditId(null); }}
                className="w-full border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-700 dark:text-rose-400"
                data-testid="button-unsaved-discard">
                Discard Changes
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowUnsavedDialog(false)}
                className="w-full text-slate-500"
                data-testid="button-unsaved-cancel">
                Cancel (Keep Editing)
              </Button>
            </div>
          </div>
        </div>
      )}

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
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportExcel}
              className="h-9 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 gap-1.5"
              data-testid="button-excel-cashseal">
              <FileDown className="w-4 h-4" />
              <span className="hidden sm:inline">Excel</span>
            </Button>
            <Button onClick={handleSave} disabled={isPending}
              className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5 h-9"
              data-testid="button-save-seal">
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {editId ? "Update" : "Save"}
            </Button>
          </div>
        </div>

        {/* Date + Put Days */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 flex flex-wrap items-center gap-3">
          {!editId && (
            <>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</span>
              <DatePicker date={date} setDate={(d) => d && setDate(d)} />
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300 tracking-wide">
                {["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][date.getDay()]}
              </span>
            </>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Put Days</span>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              value={putDays === 0 ? "" : putDays}
              onChange={e => setPutDays(Number(e.target.value) || 0)}
              placeholder="0"
              className="w-20 h-8 text-sm text-center font-mono"
              data-testid="input-put-days"
            />
          </div>
        </div>

        {/* ── PERMANENT STAFF ──────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-blue-200 dark:border-blue-800 overflow-hidden shadow-sm">
          <div className="bg-gradient-to-r from-blue-700 to-blue-500 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-white" />
              <h2 className="text-sm font-bold text-white">Permanent Staff</h2>
            </div>
            <span className="text-xs text-blue-100 font-medium">Rates: ₹5 / ₹20 / ₹10 / ₹10</span>
          </div>
          <IncomeSection color="blue"
            cashTotal={psTotalCash} onlineTotal={psTotalOnline}
            cashQtyTotal={psCashQtyTotal} onlineQtyTotal={psOnlineQtyTotal}
            items={[
              { no: 1, name: "Breakfast", fixedRate: PS_RATES.bf, color: "blue", cashQty: psBfCash, onCashQty: setPsBfCash, onlineQty: psBfOnline, onOnlineQty: setPsBfOnline },
              { no: 2, name: "Lunch", fixedRate: PS_RATES.ln, color: "blue", cashQty: psLnCash, onCashQty: setPsLnCash, onlineQty: psLnOnline, onOnlineQty: setPsLnOnline },
              { no: 3, name: "Evening Snacks", fixedRate: PS_RATES.ev, color: "blue", cashQty: psEvCash, onCashQty: setPsEvCash, onlineQty: psEvOnline, onOnlineQty: setPsEvOnline },
              { no: 4, name: "Night Snacks", fixedRate: PS_RATES.nt, color: "blue", cashQty: psNtCash, onCashQty: setPsNtCash, onlineQty: psNtOnline, onOnlineQty: setPsNtOnline },
              { no: 5, name: "Recharge", customRate: psRcRate, onCustomRate: setPsRcRate, color: "blue", cashQty: psRcCash, onCashQty: setPsRcCash, onlineQty: psRcOnline, onOnlineQty: setPsRcOnline, amountMode: true },
            ]}
          />
        </div>

        {/* ── THIRD PARTY ───────────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-green-200 dark:border-green-800 overflow-hidden shadow-sm">
          <div className="bg-gradient-to-r from-green-700 to-green-500 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-white" />
              <h2 className="text-sm font-bold text-white">Third Party</h2>
            </div>
            <span className="text-xs text-green-100 font-medium">Rates: ₹20 / ₹35 / ₹20 / ₹20</span>
          </div>
          {(() => {
            const dow = date.getDay(); // 0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat
            const showFish    = dow === 1 || dow === 4; // Mon, Thu
            const showChicken = dow === 0 || dow === 3 || dow === 5; // Sun, Wed, Fri
            // Tue & Sat: only Egg; Mon & Thu: Egg + Fish; Sun/Wed/Fri: Egg + Chicken
            let no = 2;
            const tpItems: any[] = [
              { no: 1, name: "Breakfast",  fixedRate: TP_RATES.bf, color: "green", cashQty: tpBfCash, onCashQty: setTpBfCash, onlineQty: tpBfOnline, onOnlineQty: setTpBfOnline },
              { no: ++no, name: "Lunch Veg", fixedRate: TP_RATES.lv, color: "green", cashQty: tpLvCash, onCashQty: setTpLvCash, onlineQty: tpLvOnline, onOnlineQty: setTpLvOnline },
              { no: ++no, name: "Egg Lunch ₹45", fixedRate: TP_RATES.eg, color: "green", cashQty: tpEgCash, onCashQty: setTpEgCash, onlineQty: tpEgOnline, onOnlineQty: setTpEgOnline },
              ...(showFish    ? [{ no: ++no, name: "Fish Lunch ₹55",    fixedRate: TP_RATES.fs, color: "green", cashQty: tpFsCash, onCashQty: setTpFsCash, onlineQty: tpFsOnline, onOnlineQty: setTpFsOnline }] : []),
              ...(showChicken ? [{ no: ++no, name: "Chicken Lunch ₹65", fixedRate: TP_RATES.ck, color: "green", cashQty: tpCkCash, onCashQty: setTpCkCash, onlineQty: tpCkOnline, onOnlineQty: setTpCkOnline }] : []),
              { no: ++no, name: "Evening Snacks", fixedRate: TP_RATES.ev, color: "green", cashQty: tpEvCash, onCashQty: setTpEvCash, onlineQty: tpEvOnline, onOnlineQty: setTpEvOnline },
              { no: ++no, name: "Night",          fixedRate: TP_RATES.nt, color: "green", cashQty: tpNtCash, onCashQty: setTpNtCash, onlineQty: tpNtOnline, onOnlineQty: setTpNtOnline },
            ];
            return (
              <IncomeSection color="green"
                cashTotal={tpTotalCash} onlineTotal={tpTotalOnline}
                cashQtyTotal={tpCashQtyTotal} onlineQtyTotal={tpOnlineQtyTotal}
                items={tpItems}
              />
            );
          })()}
        </div>

        {/* Grand Total Income — split by Cash / Online */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl px-4 py-3 shadow">
          <div className="flex items-center gap-2 mb-2.5">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span className="text-white text-xs font-bold uppercase tracking-wide">Grand Total Income</span>
            <span className="text-slate-400 text-[10px]">(PS + Third Party)</span>
            <span className="ml-auto text-lg font-extrabold font-mono text-emerald-400">{fmtN(totalIncome)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-700/60 rounded-lg px-3 py-2 flex items-center justify-between">
              <div>
                <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-0.5">Cash Income</div>
                <div className="text-sm font-bold font-mono text-emerald-300">{fmtN(totalCashIncome)}</div>
              </div>
              <IndianRupee className="w-4 h-4 text-slate-500" />
            </div>
            <div className="bg-indigo-900/40 rounded-lg px-3 py-2 flex items-center justify-between">
              <div>
                <div className="text-[10px] text-indigo-300 font-semibold uppercase tracking-wide mb-0.5">Online Income</div>
                <div className="text-sm font-bold font-mono text-indigo-300">{fmtN(totalOnlineIncome)}</div>
              </div>
              <IndianRupee className="w-4 h-4 text-indigo-500" />
            </div>
          </div>
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
            {!akbarAliManual && (
              <span className="ml-auto bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wide">AUTO</span>
            )}
          </div>
          <div className="px-3 py-3">
            <div className="flex items-center justify-between mb-1">
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Total cash given to Akbar Ali</div>
                {!akbarAliManual ? (
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Auto-filled from Cash Balance</div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAkbarAliManual(false)}
                    className="text-[10px] text-orange-500 hover:text-orange-700 font-medium underline"
                  >
                    Reset to auto (Cash Balance = {fmtN(cashBalance)})
                  </button>
                )}
              </div>
              <span className="text-sm font-bold font-mono text-orange-600">{akbarAliAmount > 0 ? fmtN(akbarAliAmount) : "—"}</span>
            </div>
            <QtyInput
              value={akbarAliAmount}
              onChange={(val) => { setAkbarAliManual(true); setAkbarAliAmount(val); }}
              large
              className="w-full max-w-[160px] bg-orange-50 dark:bg-orange-900/20"
            />
          </div>
        </div>

        {/* ── SUMMARY BAR ───────────────────────────────────────── */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-xl shadow-lg overflow-hidden">
          {/* Top row: Income split */}
          <div className="px-3 py-2.5 border-b border-slate-700/60">
            <div className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-2 text-center">Income Breakdown</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Cash Income</span>
                </div>
                <div className="text-base font-bold font-mono text-emerald-400">{fmtN(totalCashIncome)}</div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block"></span>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Online Income</span>
                </div>
                <div className="text-base font-bold font-mono text-indigo-400">{fmtN(totalOnlineIncome)}</div>
              </div>
            </div>
          </div>

          {/* Middle: Expense (deducted from cash) */}
          <div className="px-3 py-2.5 border-b border-slate-700/60 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Total Expense</span>
              <span className="text-[9px] text-slate-600">(deducted from cash)</span>
            </div>
            <div className="text-base font-bold font-mono text-rose-400">{fmtN(totalExpense)}</div>
          </div>

          {/* Bottom row: Balance split */}
          <div className="px-3 py-2.5">
            <div className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-2 text-center">Balance</div>
            <div className="grid grid-cols-2 gap-2">
              <div className={`rounded-lg px-3 py-2 text-center ${cashBalance >= 0 ? "bg-sky-900/30 border border-sky-700/40" : "bg-orange-900/30 border border-orange-700/40"}`}>
                <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-1">Cash Balance</div>
                <div className={`text-base font-extrabold font-mono ${cashBalance >= 0 ? "text-sky-400" : "text-orange-400"}`}>{fmtN(cashBalance)}</div>
                <div className="text-[9px] text-slate-500 mt-0.5">Cash − Expense</div>
              </div>
              <div className="bg-indigo-900/30 border border-indigo-700/40 rounded-lg px-3 py-2 text-center">
                <div className="text-[10px] text-indigo-300 font-semibold uppercase tracking-wide mb-1">Online Balance</div>
                <div className="text-base font-extrabold font-mono text-indigo-400">{fmtN(onlineBalance)}</div>
                <div className="text-[9px] text-slate-500 mt-0.5">Online (no expense)</div>
              </div>
            </div>
            <div className={`mt-2 flex items-center justify-between px-1`}>
              <span className="text-[10px] text-slate-500">Overall Balance (Cash + Online)</span>
              <span className={`text-sm font-extrabold font-mono ${balance >= 0 ? "text-teal-400" : "text-orange-400"}`}>{fmtN(balance)}</span>
            </div>
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
