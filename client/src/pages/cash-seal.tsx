import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { format, parseISO } from "date-fns";
import { Save, ArrowLeft, CalendarDays, TrendingUp, TrendingDown, Wallet, Loader2, Banknote, Coffee, Sun, Moon, UtensilsCrossed, HandCoins, Plus, Pencil, List } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCreateCashSeal, useUpdateCashSeal, useCashSeals } from "@/hooks/use-reports";
import { useLocation } from "wouter";

const MORNING_RATE = 5;
const LUNCH_RATE = 20;
const EVENING_RATE = 10;
const NIGHT_RATE = 10;
const BANANA_RATE = 4.5;

function calcTotals(s: any) {
  const n = (v: any) => Number(v) || 0;
  const income = n(s.incomeMorningQty) * MORNING_RATE
    + n(s.incomeLunchQty) * LUNCH_RATE
    + n(s.incomeEveningQty) * EVENING_RATE
    + n(s.incomeNightQty) * NIGHT_RATE
    + n(s.incomeNonVegRate) * n(s.incomeNonVegQty)
    + n(s.incomeVegRate) * n(s.incomeVegQty)
    + n(s.incomeMorningCashRate) * n(s.incomeMorningCashQty)
    + n(s.incomeEveningCashRate) * n(s.incomeEveningCashQty)
    + n(s.incomeOnlineBreakfastQty) * MORNING_RATE
    + n(s.incomeOnlineLunchQty) * LUNCH_RATE
    + n(s.incomeOnlineEveningSnacksQty) * EVENING_RATE
    + n(s.incomeOnlineNightQty) * NIGHT_RATE;
  const expense = n(s.expenseBananaQty) * BANANA_RATE
    + n(s.expenseDahiBharQty) * n(s.expenseDahiBharRate)
    + n(s.expenseOtherAmount);
  return { income, expense, balance: income - expense };
}

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

  const [morningQty, setMorningQty] = useState(0);
  const [lunchQty, setLunchQty] = useState(0);
  const [eveningQty, setEveningQty] = useState(0);
  const [nightQty, setNightQty] = useState(0);
  const [nonVegRate, setNonVegRate] = useState(0);
  const [nonVegQty, setNonVegQty] = useState(0);
  const [vegRate, setVegRate] = useState(0);
  const [vegQty, setVegQty] = useState(0);
  const [morningCashRate, setMorningCashRate] = useState(0);
  const [morningCashQty, setMorningCashQty] = useState(0);
  const [eveningCashRate, setEveningCashRate] = useState(0);
  const [eveningCashQty, setEveningCashQty] = useState(0);
  const [onlineBreakfastQty, setOnlineBreakfastQty] = useState(0);
  const [onlineLunchQty, setOnlineLunchQty] = useState(0);
  const [onlineEveningSnacksQty, setOnlineEveningSnacksQty] = useState(0);
  const [onlineNightQty, setOnlineNightQty] = useState(0);
  const [bananaQty, setBananaQty] = useState(0);
  const [dahiBharQty, setDahiBharQty] = useState(0);
  const [dahiBharRate, setDahiBharRate] = useState(0);
  const [otherExpense, setOtherExpense] = useState(0);
  const [akbarAliAmount, setAkbarAliAmount] = useState(0);

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
    setMorningQty(n(rec.incomeMorningQty));
    setLunchQty(n(rec.incomeLunchQty));
    setEveningQty(n(rec.incomeEveningQty));
    setNightQty(n(rec.incomeNightQty));
    setNonVegRate(n(rec.incomeNonVegRate));
    setNonVegQty(n(rec.incomeNonVegQty));
    setVegRate(n(rec.incomeVegRate));
    setVegQty(n(rec.incomeVegQty));
    setMorningCashRate(n(rec.incomeMorningCashRate));
    setMorningCashQty(n(rec.incomeMorningCashQty));
    setEveningCashRate(n(rec.incomeEveningCashRate));
    setEveningCashQty(n(rec.incomeEveningCashQty));
    setOnlineBreakfastQty(n(rec.incomeOnlineBreakfastQty));
    setOnlineLunchQty(n(rec.incomeOnlineLunchQty));
    setOnlineEveningSnacksQty(n(rec.incomeOnlineEveningSnacksQty));
    setOnlineNightQty(n(rec.incomeOnlineNightQty));
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
    setMorningQty(0); setLunchQty(0); setEveningQty(0); setNightQty(0);
    setNonVegRate(0); setNonVegQty(0); setVegRate(0); setVegQty(0);
    setMorningCashRate(0); setMorningCashQty(0); setEveningCashRate(0); setEveningCashQty(0);
    setOnlineBreakfastQty(0); setOnlineLunchQty(0); setOnlineEveningSnacksQty(0); setOnlineNightQty(0);
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
    if (view === "form") {
      setView("list");
      setEditId(null);
    } else {
      navigate("/");
    }
  }

  const morningTotal = morningQty * MORNING_RATE;
  const lunchTotal = lunchQty * LUNCH_RATE;
  const eveningTotal = eveningQty * EVENING_RATE;
  const nightTotal = nightQty * NIGHT_RATE;
  const nonVegTotal = nonVegRate * nonVegQty;
  const vegTotal = vegRate * vegQty;
  const morningCashTotal = morningCashRate * morningCashQty;
  const eveningCashTotal = eveningCashRate * eveningCashQty;
  const onlineBreakfastTotal = onlineBreakfastQty * MORNING_RATE;
  const onlineLunchTotal = onlineLunchQty * LUNCH_RATE;
  const onlineEveningSnacksTotal = onlineEveningSnacksQty * EVENING_RATE;
  const onlineNightTotal = onlineNightQty * NIGHT_RATE;
  const totalOnlinePayment = onlineBreakfastTotal + onlineLunchTotal + onlineEveningSnacksTotal + onlineNightTotal;
  const totalIncome = morningTotal + lunchTotal + eveningTotal + nightTotal + nonVegTotal + vegTotal + morningCashTotal + eveningCashTotal + totalOnlinePayment;
  const bananaTotal = bananaQty * BANANA_RATE;
  const dahiBharTotal = dahiBharQty * dahiBharRate;
  const totalExpense = bananaTotal + dahiBharTotal + otherExpense;
  const balance = totalIncome - totalExpense;

  const payload = {
    incomeMorningQty: morningQty, incomeLunchQty: lunchQty,
    incomeEveningQty: eveningQty, incomeNightQty: nightQty,
    incomeNonVegRate: nonVegRate, incomeNonVegQty: nonVegQty,
    incomeVegRate: vegRate, incomeVegQty: vegQty,
    incomeMorningCashRate: morningCashRate, incomeMorningCashQty: morningCashQty,
    incomeEveningCashRate: eveningCashRate, incomeEveningCashQty: eveningCashQty,
    incomeOnlineBreakfastQty: onlineBreakfastQty, incomeOnlineLunchQty: onlineLunchQty,
    incomeOnlineEveningSnacksQty: onlineEveningSnacksQty, incomeOnlineNightQty: onlineNightQty,
    expenseBananaQty: bananaQty, expenseDahiBharQty: dahiBharQty,
    expenseDahiBharRate: dahiBharRate, expenseOtherAmount: otherExpense,
    totalGivenToAkbarAli: akbarAliAmount,
  };

  const handleSave = async () => {
    try {
      if (editId) {
        await updateMutation.mutateAsync({ id: editId, data: payload });
        toast({ title: "Success", description: "Cash Seal KPF record updated successfully" });
      } else {
        await saveMutation.mutateAsync({ date: format(date, 'yyyy-MM-dd'), ...payload });
        toast({ title: "Success", description: "Daily Cash Seal KPF saved successfully" });
      }
      setView("list");
      setEditId(null);
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to save", variant: "destructive" });
    }
  };

  const isPending = saveMutation.isPending || updateMutation.isPending;
  const fmt = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const formatDate = (d: string) => {
    try {
      const dt = d.includes("T") ? parseISO(d) : new Date(d + "T00:00:00");
      return { date: format(dt, "dd/MM/yyyy"), day: format(dt, "EEE") };
    } catch { return { date: d, day: "" }; }
  };

  return (
    <Layout>
      <div className="space-y-6 pb-32 sm:pb-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-4">
            <Button variant="outline" size="icon" onClick={handleBack} type="button"
              className="shrink-0 rounded-xl border-teal-200 hover:bg-teal-50 dark:border-teal-800 dark:hover:bg-teal-900/30" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold tracking-tight bg-gradient-to-r from-teal-600 via-cyan-600 to-blue-500 bg-clip-text text-transparent" data-testid="text-page-title">
                CASH SEAL KPF
              </h1>
              <p className="text-muted-foreground text-xs sm:text-sm">
                {view === "list" ? "Daily Cash Seal Records" : editId ? "Edit Cash Seal Record" : "New Cash Seal Record"}
              </p>
            </div>
          </div>
          <div className="flex gap-2 sm:gap-3 ml-12 sm:ml-0">
            {view === "list" ? (
              <Button onClick={handleNew}
                className="shadow-lg shadow-teal-500/20 text-xs sm:text-sm h-9 sm:h-10 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 border-0"
                data-testid="button-new-seal">
                <Plus className="w-4 h-4 mr-2" /> New Record
              </Button>
            ) : (
              <>
                <Button variant="outline" type="button" onClick={() => { setView("list"); setEditId(null); }} className="text-xs sm:text-sm h-9 sm:h-10 rounded-xl">
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={isPending}
                  className="shadow-lg shadow-teal-500/20 text-xs sm:text-sm h-9 sm:h-10 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 border-0"
                  data-testid="button-save-seal">
                  {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  {editId ? "Update Seal" : "Save Seal"}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* LIST VIEW */}
        {view === "list" && (
          <Card className="border-0 shadow-lg overflow-hidden" data-testid="card-records-list">
            <CardHeader className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white pb-3 pt-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <List className="w-5 h-5" />
                Daily Cash Seal Records
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {recordsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
                </div>
              ) : records.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No records yet. Click "New Record" to add one.</p>
                </div>
              ) : (
                <>
                  {/* Mobile cards */}
                  <div className="sm:hidden divide-y">
                    {(records as any[]).map((rec: any) => {
                      const { date: dStr, day } = formatDate(rec.date);
                      const { income, expense, balance: bal } = calcTotals(rec);
                      return (
                        <div key={rec.id} className="p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-semibold text-sm">{dStr}</span>
                              <span className="ml-2 text-xs text-muted-foreground">{day}</span>
                            </div>
                            <Button size="sm" variant="outline" onClick={() => handleEdit(rec)}
                              className="h-7 text-xs border-teal-200 text-teal-700 hover:bg-teal-50 dark:border-teal-800 dark:text-teal-400"
                              data-testid={`button-edit-seal-${rec.id}`}>
                              <Pencil className="w-3 h-3 mr-1" /> Edit
                            </Button>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center text-xs">
                            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded p-1.5">
                              <p className="text-muted-foreground">Income</p>
                              <p className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">₹{fmt(income)}</p>
                            </div>
                            <div className="bg-rose-50 dark:bg-rose-900/20 rounded p-1.5">
                              <p className="text-muted-foreground">Expense</p>
                              <p className="font-mono font-semibold text-rose-600 dark:text-rose-400">₹{fmt(expense)}</p>
                            </div>
                            <div className={`${bal >= 0 ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-red-50 dark:bg-red-900/20'} rounded p-1.5`}>
                              <p className="text-muted-foreground">Balance</p>
                              <p className={`font-mono font-semibold ${bal >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>₹{fmt(bal)}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Desktop table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full border-collapse min-w-[600px]">
                      <thead>
                        <tr className="bg-teal-50 dark:bg-teal-950/20 border-b border-teal-200 dark:border-teal-800">
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-teal-700 dark:text-teal-400">Date</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-teal-700 dark:text-teal-400">Day</th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-teal-700 dark:text-teal-400">Total Income</th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-teal-700 dark:text-teal-400">Total Expense</th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-teal-700 dark:text-teal-400">Balance</th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-teal-700 dark:text-teal-400">Akbar Ali</th>
                          <th className="px-4 py-2.5 text-center text-xs font-semibold text-teal-700 dark:text-teal-400">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(records as any[]).map((rec: any) => {
                          const { date: dStr, day } = formatDate(rec.date);
                          const { income, expense, balance: bal } = calcTotals(rec);
                          return (
                            <tr key={rec.id} className="border-b hover:bg-teal-50/50 dark:hover:bg-teal-950/10">
                              <td className="px-4 py-2.5 font-semibold text-sm">{dStr}</td>
                              <td className="px-4 py-2.5 text-muted-foreground text-sm">{day}</td>
                              <td className="px-4 py-2.5 text-right font-mono text-sm font-semibold text-emerald-600 dark:text-emerald-400">₹{fmt(income)}</td>
                              <td className="px-4 py-2.5 text-right font-mono text-sm font-semibold text-rose-600 dark:text-rose-400">₹{fmt(expense)}</td>
                              <td className={`px-4 py-2.5 text-right font-mono text-sm font-semibold ${bal >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>₹{fmt(bal)}</td>
                              <td className="px-4 py-2.5 text-right font-mono text-sm text-amber-600 dark:text-amber-400">₹{fmt(Number(rec.totalGivenToAkbarAli) || 0)}</td>
                              <td className="px-4 py-2.5 text-center">
                                <Button size="sm" variant="outline" onClick={() => handleEdit(rec)}
                                  className="h-7 text-xs border-teal-200 text-teal-700 hover:bg-teal-50 dark:border-teal-800 dark:text-teal-400"
                                  data-testid={`button-edit-seal-${rec.id}`}>
                                  <Pencil className="w-3 h-3 mr-1" /> Edit
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* FORM VIEW */}
        {view === "form" && (
          <>
            <Card className="border-0 shadow-lg overflow-hidden" data-testid="card-date-info">
              <CardHeader className="bg-gradient-to-r from-slate-600 to-slate-700 text-white pb-3 pt-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarDays className="w-5 h-5" /> Date Information
                </CardTitle>
              </CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-4 p-4 sm:p-6 bg-gradient-to-b from-slate-50/50 to-transparent dark:from-slate-900/20">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5" /> Date
                  </label>
                  {editId ? (
                    <Input value={format(date, "dd/MM/yyyy")} readOnly className="bg-slate-50 dark:bg-slate-900/20 font-semibold" />
                  ) : (
                    <DatePicker date={date} setDate={(d) => d && setDate(d)} />
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-cyan-600 dark:text-cyan-400 flex items-center gap-1.5">
                    <Sun className="w-3.5 h-3.5" /> Week Day
                  </label>
                  <Input value={format(date, "EEEE")} readOnly className="bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-800 font-semibold" />
                </div>
              </CardContent>
            </Card>

            {/* INCOME CARD */}
            <Card className="border-0 shadow-lg overflow-hidden" data-testid="card-income">
              <CardHeader className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white pb-3 pt-4">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <TrendingUp className="w-5 h-5" /> INCOME
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="sm:hidden divide-y">
                  {[
                    { name: "MORNING", icon: Coffee, rate: MORNING_RATE, qty: morningQty, setQty: setMorningQty, total: morningTotal, color: "amber" },
                    { name: "LUNCH", icon: UtensilsCrossed, rate: LUNCH_RATE, qty: lunchQty, setQty: setLunchQty, total: lunchTotal, color: "orange" },
                    { name: "EVENING", icon: Sun, rate: EVENING_RATE, qty: eveningQty, setQty: setEveningQty, total: eveningTotal, color: "rose" },
                    { name: "NIGHT", icon: Moon, rate: NIGHT_RATE, qty: nightQty, setQty: setNightQty, total: nightTotal, color: "indigo" },
                  ].map((item, idx) => (
                    <div key={item.name} className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm flex items-center gap-1.5">
                          <span className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white text-[10px] flex items-center justify-center font-bold shrink-0">{idx + 1}</span>
                          {item.name}
                        </span>
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-mono bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full font-semibold">Rate: ₹{item.rate}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 items-end">
                        <div>
                          <label className="text-[10px] text-muted-foreground uppercase font-semibold">Qty</label>
                          <Input type="number" inputMode="numeric" className="h-9 font-mono text-center no-spinner" value={item.qty || ""} onFocus={(e) => e.target.select()} onChange={(e) => item.setQty(Number(e.target.value) || 0)} />
                        </div>
                        <div className="text-center text-muted-foreground text-sm py-2">× ₹{item.rate} =</div>
                        <div>
                          <label className="text-[10px] text-muted-foreground uppercase font-semibold">Total</label>
                          <div className="h-9 flex items-center justify-end font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-md px-2 text-sm">₹{fmt(item.total)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="px-3 pt-2 pb-1">
                    <p className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wider">Cash Items (custom rate)</p>
                  </div>
                  {[
                    { name: "CASH Non Veg", rate: nonVegRate, setRate: setNonVegRate, qty: nonVegQty, setQty: setNonVegQty, total: nonVegTotal },
                    { name: "CASH Veg", rate: vegRate, setRate: setVegRate, qty: vegQty, setQty: setVegQty, total: vegTotal },
                    { name: "Morning CASH", rate: morningCashRate, setRate: setMorningCashRate, qty: morningCashQty, setQty: setMorningCashQty, total: morningCashTotal },
                    { name: "Evening CASH", rate: eveningCashRate, setRate: setEveningCashRate, qty: eveningCashQty, setQty: setEveningCashQty, total: eveningCashTotal },
                  ].map((item, idx) => (
                    <div key={item.name} className="p-3 space-y-2">
                      <div className="flex items-center gap-1.5">
                        <span className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 text-white text-[10px] flex items-center justify-center font-bold shrink-0">{idx + 5}</span>
                        <span className="font-semibold text-sm">{item.name}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] text-muted-foreground uppercase font-semibold">Rate ₹</label>
                          <Input type="number" inputMode="decimal" className="h-9 font-mono text-center no-spinner" placeholder="0" value={item.rate || ""} onFocus={(e) => e.target.select()} onChange={(e) => item.setRate(Number(e.target.value) || 0)} />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground uppercase font-semibold">Qty</label>
                          <Input type="number" inputMode="numeric" className="h-9 font-mono text-center no-spinner" value={item.qty || ""} onFocus={(e) => e.target.select()} onChange={(e) => item.setQty(Number(e.target.value) || 0)} />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground uppercase font-semibold">Total</label>
                          <div className="h-9 flex items-center justify-end font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-md px-2 text-sm">₹{fmt(item.total)}</div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Online Payment — mobile */}
                  <div className="px-3 pt-3 pb-1 bg-indigo-50/50 dark:bg-indigo-950/10 border-t border-indigo-200 dark:border-indigo-800/40">
                    <p className="text-[10px] text-indigo-700 dark:text-indigo-400 font-semibold uppercase tracking-wider">Online Payment</p>
                  </div>
                  {[
                    { name: "Breakfast", rate: MORNING_RATE, qty: onlineBreakfastQty, setQty: setOnlineBreakfastQty, total: onlineBreakfastTotal },
                    { name: "Lunch", rate: LUNCH_RATE, qty: onlineLunchQty, setQty: setOnlineLunchQty, total: onlineLunchTotal },
                    { name: "Evening Snacks", rate: EVENING_RATE, qty: onlineEveningSnacksQty, setQty: setOnlineEveningSnacksQty, total: onlineEveningSnacksTotal },
                    { name: "Night", rate: NIGHT_RATE, qty: onlineNightQty, setQty: setOnlineNightQty, total: onlineNightTotal },
                  ].map((item, idx) => (
                    <div key={"online-" + item.name} className="p-3 space-y-2 border-t border-indigo-100 dark:border-indigo-900/20">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm flex items-center gap-1.5">
                          <span className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 text-white text-[10px] flex items-center justify-center font-bold shrink-0">{idx + 1}</span>
                          {item.name}
                        </span>
                        <span className="text-xs text-indigo-600 dark:text-indigo-400 font-mono bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-full font-semibold">₹{item.rate}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 items-end">
                        <div>
                          <label className="text-[10px] text-muted-foreground uppercase font-semibold">Qty</label>
                          <Input type="number" inputMode="numeric" className="h-9 font-mono text-center no-spinner" value={item.qty || ""} onFocus={(e) => e.target.select()} onChange={(e) => item.setQty(Number(e.target.value) || 0)} />
                        </div>
                        <div className="text-center text-muted-foreground text-sm py-2">× ₹{item.rate} =</div>
                        <div>
                          <label className="text-[10px] text-muted-foreground uppercase font-semibold">Total</label>
                          <div className="h-9 flex items-center justify-end font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 rounded-md px-2 text-sm">₹{fmt(item.total)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full border-collapse min-w-[500px]">
                    <thead>
                      <tr className="bg-emerald-50 dark:bg-emerald-950/20 border-b border-emerald-200 dark:border-emerald-800">
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-emerald-700 dark:text-emerald-400">#</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-emerald-700 dark:text-emerald-400">Name</th>
                        <th className="px-3 py-2.5 text-center w-24 text-xs font-semibold text-emerald-700 dark:text-emerald-400">Rate</th>
                        <th className="px-3 py-2.5 text-center w-8 text-xs"></th>
                        <th className="px-3 py-2.5 text-center w-28 text-xs font-semibold text-emerald-700 dark:text-emerald-400">Qty</th>
                        <th className="px-3 py-2.5 text-center w-8 text-xs"></th>
                        <th className="px-3 py-2.5 text-right w-36 text-xs font-semibold text-emerald-700 dark:text-emerald-400">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { name: "MORNING", rate: MORNING_RATE, qty: morningQty, setQty: setMorningQty, total: morningTotal },
                        { name: "LUNCH", rate: LUNCH_RATE, qty: lunchQty, setQty: setLunchQty, total: lunchTotal },
                        { name: "EVENING", rate: EVENING_RATE, qty: eveningQty, setQty: setEveningQty, total: eveningTotal },
                        { name: "NIGHT", rate: NIGHT_RATE, qty: nightQty, setQty: setNightQty, total: nightTotal },
                      ].map((item, idx) => (
                        <tr key={item.name} className="border-b hover:bg-emerald-50/50 dark:hover:bg-emerald-950/10">
                          <td className="px-3 py-2">
                            <span className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white text-[10px] inline-flex items-center justify-center font-bold">{idx + 1}</span>
                          </td>
                          <td className="px-3 py-2 font-semibold">{item.name}</td>
                          <td className="px-3 py-2 text-center font-mono">
                            <span className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full text-xs font-semibold">₹{item.rate}</span>
                          </td>
                          <td className="px-1 py-2 text-center text-muted-foreground text-xs">×</td>
                          <td className="px-2 py-1">
                            <Input type="number" className="h-8 text-center font-mono no-spinner" value={item.qty || ""} onFocus={(e) => e.target.select()} onChange={(e) => item.setQty(Number(e.target.value) || 0)} />
                          </td>
                          <td className="px-1 py-2 text-center text-muted-foreground text-xs">=</td>
                          <td className="px-3 py-2 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">₹{fmt(item.total)}</td>
                        </tr>
                      ))}
                      {[
                        { name: "CASH Non Veg", rate: nonVegRate, setRate: setNonVegRate, qty: nonVegQty, setQty: setNonVegQty, total: nonVegTotal },
                        { name: "CASH Veg", rate: vegRate, setRate: setVegRate, qty: vegQty, setQty: setVegQty, total: vegTotal },
                        { name: "Morning CASH", rate: morningCashRate, setRate: setMorningCashRate, qty: morningCashQty, setQty: setMorningCashQty, total: morningCashTotal },
                        { name: "Evening CASH", rate: eveningCashRate, setRate: setEveningCashRate, qty: eveningCashQty, setQty: setEveningCashQty, total: eveningCashTotal },
                      ].map((item, idx) => (
                        <tr key={item.name} className="border-b hover:bg-cyan-50/50 dark:hover:bg-cyan-950/10">
                          <td className="px-3 py-2">
                            <span className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 text-white text-[10px] inline-flex items-center justify-center font-bold">{idx + 5}</span>
                          </td>
                          <td className="px-3 py-2 font-semibold">{item.name}</td>
                          <td className="px-2 py-1">
                            <Input type="number" placeholder="Rate" className="h-8 text-center font-mono no-spinner" value={item.rate || ""} onFocus={(e) => e.target.select()} onChange={(e) => item.setRate(Number(e.target.value) || 0)} />
                          </td>
                          <td className="px-1 py-2 text-center text-muted-foreground text-xs">×</td>
                          <td className="px-2 py-1">
                            <Input type="number" className="h-8 text-center font-mono no-spinner" value={item.qty || ""} onFocus={(e) => e.target.select()} onChange={(e) => item.setQty(Number(e.target.value) || 0)} />
                          </td>
                          <td className="px-1 py-2 text-center text-muted-foreground text-xs">=</td>
                          <td className="px-3 py-2 text-right font-mono font-semibold text-cyan-600 dark:text-cyan-400">₹{fmt(item.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Online Payment — desktop */}
                <div className="border-t border-indigo-200 dark:border-indigo-800/40">
                  <div className="px-3 py-2 bg-indigo-50 dark:bg-indigo-950/20 flex items-center justify-between">
                    <p className="text-xs text-indigo-700 dark:text-indigo-400 font-semibold uppercase tracking-wider">Online Payment</p>
                    <span className="font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full">Total: ₹{fmt(totalOnlinePayment)}</span>
                  </div>
                  <table className="w-full border-collapse min-w-[500px]">
                    <tbody>
                      {[
                        { name: "Breakfast", rate: MORNING_RATE, qty: onlineBreakfastQty, setQty: setOnlineBreakfastQty, total: onlineBreakfastTotal },
                        { name: "Lunch", rate: LUNCH_RATE, qty: onlineLunchQty, setQty: setOnlineLunchQty, total: onlineLunchTotal },
                        { name: "Evening Snacks", rate: EVENING_RATE, qty: onlineEveningSnacksQty, setQty: setOnlineEveningSnacksQty, total: onlineEveningSnacksTotal },
                        { name: "Night", rate: NIGHT_RATE, qty: onlineNightQty, setQty: setOnlineNightQty, total: onlineNightTotal },
                      ].map((item, idx) => (
                        <tr key={item.name} className="border-b hover:bg-indigo-50/50 dark:hover:bg-indigo-950/10">
                          <td className="px-3 py-2 w-10">
                            <span className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 text-white text-[10px] inline-flex items-center justify-center font-bold">{idx + 1}</span>
                          </td>
                          <td className="px-3 py-2 font-semibold">{item.name}</td>
                          <td className="px-3 py-2 text-center font-mono w-24">
                            <span className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-full text-xs font-semibold">₹{item.rate}</span>
                          </td>
                          <td className="px-1 py-2 text-center text-muted-foreground text-xs w-8">×</td>
                          <td className="px-2 py-1 w-28">
                            <Input type="number" className="h-8 text-center font-mono no-spinner" value={item.qty || ""} onFocus={(e) => e.target.select()} onChange={(e) => item.setQty(Number(e.target.value) || 0)} />
                          </td>
                          <td className="px-1 py-2 text-center text-muted-foreground text-xs w-8">=</td>
                          <td className="px-3 py-2 text-right font-mono font-semibold text-indigo-600 dark:text-indigo-400 w-36">₹{fmt(item.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="p-3 sm:p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border-t border-emerald-200 dark:border-emerald-800/30 flex justify-end">
                  <div className="text-sm font-semibold flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    Total Income: <span className="font-mono ml-1 text-base sm:text-lg text-emerald-600 dark:text-emerald-400" data-testid="text-total-income">₹{fmt(totalIncome)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* EXPENSE CARD */}
            <Card className="border-0 shadow-lg overflow-hidden" data-testid="card-expense">
              <CardHeader className="bg-gradient-to-r from-rose-500 to-pink-500 text-white pb-3 pt-4">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <TrendingDown className="w-5 h-5" /> EXPENSE
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="sm:hidden divide-y">
                  <div className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm flex items-center gap-1.5">
                        <span className="w-6 h-6 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 text-white text-[10px] flex items-center justify-center font-bold shrink-0">1</span>
                        Banana
                      </span>
                      <span className="text-xs text-rose-600 dark:text-rose-400 font-mono bg-rose-50 dark:bg-rose-900/20 px-2 py-0.5 rounded-full font-semibold">₹{BANANA_RATE}/pc</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 items-end">
                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase font-semibold">Qty (Pcs)</label>
                        <Input type="number" inputMode="numeric" className="h-9 font-mono text-center no-spinner" value={bananaQty || ""} onFocus={(e) => e.target.select()} onChange={(e) => setBananaQty(Number(e.target.value) || 0)} />
                      </div>
                      <div className="text-center text-muted-foreground text-sm py-2">× ₹{BANANA_RATE} =</div>
                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase font-semibold">Total</label>
                        <div className="h-9 flex items-center justify-end font-mono font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 rounded-md px-2 text-sm">₹{fmt(bananaTotal)}</div>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 space-y-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-6 h-6 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 text-white text-[10px] flex items-center justify-center font-bold shrink-0">2</span>
                      <span className="font-semibold text-sm">Dahi Bhar</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase font-semibold">Qty (Pcs)</label>
                        <Input type="number" inputMode="numeric" className="h-9 font-mono text-center no-spinner" value={dahiBharQty || ""} onFocus={(e) => e.target.select()} onChange={(e) => setDahiBharQty(Number(e.target.value) || 0)} />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase font-semibold">Rate ₹</label>
                        <Input type="number" inputMode="decimal" className="h-9 font-mono text-center no-spinner" placeholder="0" value={dahiBharRate || ""} onFocus={(e) => e.target.select()} onChange={(e) => setDahiBharRate(Number(e.target.value) || 0)} />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase font-semibold">Total</label>
                        <div className="h-9 flex items-center justify-end font-mono font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 rounded-md px-2 text-sm">₹{fmt(dahiBharTotal)}</div>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 space-y-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-6 h-6 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 text-white text-[10px] flex items-center justify-center font-bold shrink-0">3</span>
                      <span className="font-semibold text-sm">Other Expense</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase font-semibold">Amount ₹</label>
                        <Input type="number" inputMode="decimal" className="h-9 font-mono text-center no-spinner" placeholder="0" value={otherExpense || ""} onFocus={(e) => e.target.select()} onChange={(e) => setOtherExpense(Number(e.target.value) || 0)} />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase font-semibold">Total</label>
                        <div className="h-9 flex items-center justify-end font-mono font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 rounded-md px-2 text-sm">₹{fmt(otherExpense)}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full border-collapse min-w-[400px]">
                    <thead>
                      <tr className="bg-rose-50 dark:bg-rose-950/20 border-b border-rose-200 dark:border-rose-800">
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-rose-700 dark:text-rose-400">#</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-rose-700 dark:text-rose-400">Name</th>
                        <th className="px-3 py-2.5 text-center w-24 text-xs font-semibold text-rose-700 dark:text-rose-400">Qty</th>
                        <th className="px-3 py-2.5 text-center w-20 text-xs font-semibold text-rose-700 dark:text-rose-400">UoM</th>
                        <th className="px-3 py-2.5 text-center w-28 text-xs font-semibold text-rose-700 dark:text-rose-400">Price</th>
                        <th className="px-3 py-2.5 text-right w-36 text-xs font-semibold text-rose-700 dark:text-rose-400">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b hover:bg-rose-50/50 dark:hover:bg-rose-950/10">
                        <td className="px-3 py-2"><span className="w-6 h-6 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 text-white text-[10px] inline-flex items-center justify-center font-bold">1</span></td>
                        <td className="px-3 py-2 font-semibold">Banana</td>
                        <td className="px-2 py-1">
                          <Input type="number" className="h-8 text-center font-mono no-spinner" value={bananaQty || ""} onFocus={(e) => e.target.select()} onChange={(e) => setBananaQty(Number(e.target.value) || 0)} />
                        </td>
                        <td className="px-3 py-2 text-center"><span className="text-xs text-rose-600 dark:text-rose-400 font-mono bg-rose-50 dark:bg-rose-900/20 px-2 py-0.5 rounded-full font-semibold">Pcs</span></td>
                        <td className="px-3 py-2 text-center font-mono">
                          <span className="bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 px-2 py-0.5 rounded-full text-xs font-semibold">₹{BANANA_RATE}</span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-semibold text-rose-600 dark:text-rose-400">₹{fmt(bananaTotal)}</td>
                      </tr>
                      <tr className="border-b hover:bg-rose-50/50 dark:hover:bg-rose-950/10">
                        <td className="px-3 py-2"><span className="w-6 h-6 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 text-white text-[10px] inline-flex items-center justify-center font-bold">2</span></td>
                        <td className="px-3 py-2 font-semibold">Dahi Bhar</td>
                        <td className="px-2 py-1">
                          <Input type="number" className="h-8 text-center font-mono no-spinner" value={dahiBharQty || ""} onFocus={(e) => e.target.select()} onChange={(e) => setDahiBharQty(Number(e.target.value) || 0)} />
                        </td>
                        <td className="px-3 py-2 text-center"><span className="text-xs text-rose-600 dark:text-rose-400 font-mono bg-rose-50 dark:bg-rose-900/20 px-2 py-0.5 rounded-full font-semibold">Pcs</span></td>
                        <td className="px-2 py-1">
                          <Input type="number" placeholder="Rate" className="h-8 text-center font-mono no-spinner" value={dahiBharRate || ""} onFocus={(e) => e.target.select()} onChange={(e) => setDahiBharRate(Number(e.target.value) || 0)} />
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-semibold text-rose-600 dark:text-rose-400">₹{fmt(dahiBharTotal)}</td>
                      </tr>
                      <tr className="border-b hover:bg-rose-50/50 dark:hover:bg-rose-950/10">
                        <td className="px-3 py-2"><span className="w-6 h-6 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 text-white text-[10px] inline-flex items-center justify-center font-bold">3</span></td>
                        <td className="px-3 py-2 font-semibold">Other Expense</td>
                        <td className="px-3 py-2 text-center font-mono">1</td>
                        <td className="px-3 py-2 text-center text-muted-foreground">—</td>
                        <td className="px-2 py-1">
                          <Input type="number" placeholder="Amount" className="h-8 text-center font-mono no-spinner" value={otherExpense || ""} onFocus={(e) => e.target.select()} onChange={(e) => setOtherExpense(Number(e.target.value) || 0)} />
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-semibold text-rose-600 dark:text-rose-400">₹{fmt(otherExpense)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="p-3 sm:p-4 bg-gradient-to-r from-rose-50 to-pink-50 dark:from-rose-950/20 dark:to-pink-950/20 border-t border-rose-200 dark:border-rose-800/30 flex justify-end">
                  <div className="text-sm font-semibold flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-rose-500" />
                    Total Expense: <span className="font-mono ml-1 text-base sm:text-lg text-rose-600 dark:text-rose-400" data-testid="text-total-expense">₹{fmt(totalExpense)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* AKBAR ALI */}
            <Card className="border-0 shadow-lg overflow-hidden" data-testid="card-akbar-ali">
              <CardHeader className="bg-gradient-to-r from-amber-500 to-orange-500 text-white pb-3 pt-4">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <HandCoins className="w-5 h-5" /> Amount Given to Akbar Ali
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 bg-gradient-to-b from-amber-50/50 to-transparent dark:from-amber-950/20">
                <div className="flex items-center gap-3">
                  <Banknote className="w-5 h-5 text-amber-500 shrink-0" />
                  <Input type="number" inputMode="decimal"
                    className="font-mono text-right text-lg border-amber-200 focus:border-amber-400 dark:border-amber-800 no-spinner"
                    placeholder="0.00" value={akbarAliAmount || ""} onFocus={(e) => e.target.select()}
                    onChange={(e) => setAkbarAliAmount(Number(e.target.value) || 0)} data-testid="input-akbar-ali" />
                </div>
              </CardContent>
            </Card>

            {/* SUMMARY BAR */}
            <div className="fixed bottom-0 left-0 right-0 sm:static bg-background/80 backdrop-blur-md sm:bg-transparent border-t sm:border-0 p-3 sm:p-0 z-10">
              <Card className="border-0 shadow-xl overflow-hidden">
                <CardContent className="p-0">
                  <div className="grid grid-cols-2 sm:grid-cols-4">
                    <div className="p-3 sm:p-5 bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                      <p className="text-[10px] sm:text-xs uppercase tracking-wider font-semibold text-white/80 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" /> Income
                      </p>
                      <p className="text-lg sm:text-2xl font-bold font-mono" data-testid="text-summary-income">₹{fmt(totalIncome)}</p>
                    </div>
                    <div className="p-3 sm:p-5 bg-gradient-to-br from-rose-500 to-pink-600 text-white">
                      <p className="text-[10px] sm:text-xs uppercase tracking-wider font-semibold text-white/80 flex items-center gap-1">
                        <TrendingDown className="w-3 h-3" /> Expense
                      </p>
                      <p className="text-lg sm:text-2xl font-bold font-mono" data-testid="text-summary-expense">₹{fmt(totalExpense)}</p>
                    </div>
                    <div className={`p-3 sm:p-5 ${balance < 0 ? 'bg-gradient-to-br from-red-600 to-rose-700' : 'bg-gradient-to-br from-blue-500 to-indigo-600'} text-white`}>
                      <p className="text-[10px] sm:text-xs uppercase tracking-wider font-semibold text-white/80 flex items-center gap-1">
                        <Wallet className="w-3 h-3" /> Balance
                      </p>
                      <p className="text-lg sm:text-2xl font-bold font-mono" data-testid="text-summary-balance">₹{fmt(balance)}</p>
                    </div>
                    <div className="p-3 sm:p-5 bg-gradient-to-br from-amber-500 to-orange-600 text-white">
                      <p className="text-[10px] sm:text-xs uppercase tracking-wider font-semibold text-white/80 flex items-center gap-1">
                        <HandCoins className="w-3 h-3" /> Akbar Ali
                      </p>
                      <p className="text-lg sm:text-2xl font-bold font-mono" data-testid="text-summary-akbar">₹{fmt(akbarAliAmount)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
