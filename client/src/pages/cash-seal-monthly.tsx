import { useState } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCashSeals, useBananaRates } from "@/hooks/use-reports";
import { ArrowLeft, Printer, Loader2, FileBarChart } from "lucide-react";
import { useLocation } from "wouter";
import { format, parseISO } from "date-fns";
import { bananaRateForDate } from "@shared/banana-rate";

const PS_RATES = { bf: 5, ln: 20, ev: 10, nt: 10 };
const TP_RATES = { bf: 20, lv: 35, ev: 20, nt: 20 };
const fmt = (v: number) => v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const n = (v: any) => Number(v) || 0;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function parseDate(d: string) {
  try { return d.includes("T") ? parseISO(d) : new Date(d + "T00:00:00"); } catch { return null; }
}

interface AggRow { no: number; name: string; cashQty: number; cashTotal: number; onlineQty: number; onlineTotal: number; }

function MonthlySection({ title, color, rows }: { title: string; color: "blue" | "green"; rows: AggRow[] }) {
  const headerBg = color === "blue" ? "#1d4ed8" : "#16a34a";
  const subBg = color === "blue" ? "#dbeafe" : "#dcfce7";
  const subColor = color === "blue" ? "#1e40af" : "#15803d";
  const cashSum = rows.reduce((s, r) => s + r.cashTotal, 0);
  const onlineSum = rows.reduce((s, r) => s + r.onlineTotal, 0);
  const grand = cashSum + onlineSum;

  return (
    <div className="mb-4">
      <div style={{ background: headerBg }} className="text-white text-center text-sm font-bold py-1.5 print:py-1">
        {title}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs min-w-[620px]">
          <thead>
            <tr style={{ background: subBg }}>
              <th className="border border-gray-300 px-2 py-1 text-center w-8" style={{ color: subColor }}>Sl No.</th>
              <th className="border border-gray-300 px-2 py-1 text-left" style={{ color: subColor }}>Name</th>
              <th className="border border-gray-300 px-2 py-1 text-right" style={{ color: subColor }}>Total Cash Qty</th>
              <th className="border border-gray-300 px-2 py-1 text-right" style={{ color: subColor }}>Total Cash Amount</th>
              <th className="border border-gray-300 px-2 py-1 text-right" style={{ color: subColor }}>Total Online Qty</th>
              <th className="border border-gray-300 px-2 py-1 text-right" style={{ color: subColor }}>Total Online Amount</th>
              <th className="border border-gray-300 px-2 py-1 text-right" style={{ color: subColor }}>Cash + Online Qty</th>
              <th className="border border-gray-300 px-2 py-1 text-right" style={{ color: subColor }}>Total Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const combinedQty = row.cashQty + row.onlineQty;
              const totalAmt = row.cashTotal + row.onlineTotal;
              return (
                <tr key={row.no} className="hover:bg-gray-50">
                  <td className="border border-gray-300 px-2 py-1 text-center text-gray-500">{row.no}</td>
                  <td className="border border-gray-300 px-2 py-1 font-medium text-green-800">{row.name}</td>
                  <td className="border border-gray-300 px-2 py-1 text-right font-mono">{row.cashQty > 0 ? row.cashQty : ""}</td>
                  <td className="border border-gray-300 px-2 py-1 text-right font-mono text-red-600">{row.cashTotal > 0 ? fmt(row.cashTotal) : ""}</td>
                  <td className="border border-gray-300 px-2 py-1 text-right font-mono">{row.onlineQty > 0 ? row.onlineQty : ""}</td>
                  <td className="border border-gray-300 px-2 py-1 text-right font-mono text-blue-700">{row.onlineTotal > 0 ? fmt(row.onlineTotal) : ""}</td>
                  <td className="border border-gray-300 px-2 py-1 text-right font-mono">{combinedQty > 0 ? combinedQty : ""}</td>
                  <td className="border border-gray-300 px-2 py-1 text-right font-mono font-semibold">{totalAmt > 0 ? fmt(totalAmt) : ""}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: subBg }}>
              <td colSpan={3} className="border border-gray-300 px-2 py-1 text-right font-bold">Total:</td>
              <td className="border border-gray-300 px-2 py-1 text-right font-bold font-mono">{fmt(cashSum)}</td>
              <td className="border border-gray-300 px-2 py-1"></td>
              <td className="border border-gray-300 px-2 py-1 text-right font-bold font-mono">{fmt(onlineSum)}</td>
              <td colSpan={2} className="border border-gray-300 px-2 py-1"></td>
            </tr>
            <tr style={{ background: subBg }}>
              <td colSpan={6} className="border border-gray-300 px-2 py-1 text-right font-bold">Total Cash + Total Online:</td>
              <td colSpan={2} className="border border-gray-300 px-2 py-1 text-right font-bold font-mono text-sm">{fmt(grand)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export default function CashSealMonthly() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1); // 1-12
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [, navigate] = useLocation();

  const { data: allSeals = [], isLoading } = useCashSeals();
  const { data: bananaRateSchedule = [] } = useBananaRates();

  // Filter records for selected month/year
  const filtered = (allSeals as any[]).filter(s => {
    if (!s.date) return false;
    const dt = parseDate(s.date);
    if (!dt) return false;
    return dt.getMonth() + 1 === selectedMonth && dt.getFullYear() === selectedYear;
  });

  // Aggregate PS fields
  const agg = filtered.reduce((acc, s) => {
    const psRcRate = n(s.incomePsRechargeRate);
    return {
      psBfCash: acc.psBfCash + n(s.incomePsBreakfastCashQty),
      psBfOnline: acc.psBfOnline + n(s.incomePsBreakfastOnlineQty),
      psLnCash: acc.psLnCash + n(s.incomePsLunchCashQty),
      psLnOnline: acc.psLnOnline + n(s.incomePsLunchOnlineQty),
      psEvCash: acc.psEvCash + n(s.incomePsEveningCashQty),
      psEvOnline: acc.psEvOnline + n(s.incomePsEveningOnlineQty),
      psNtCash: acc.psNtCash + n(s.incomePsNightCashQty),
      psNtOnline: acc.psNtOnline + n(s.incomePsNightOnlineQty),
      psRcCash: acc.psRcCash + n(s.incomePsRechargeCashQty),
      psRcOnline: acc.psRcOnline + n(s.incomePsRechargeOnlineQty),
      psRcCashTotal: acc.psRcCashTotal + n(s.incomePsRechargeCashQty) * psRcRate,
      psRcOnlineTotal: acc.psRcOnlineTotal + n(s.incomePsRechargeOnlineQty) * psRcRate,
      tpBfCash: acc.tpBfCash + n(s.incomeTpBreakfastCashQty),
      tpBfOnline: acc.tpBfOnline + n(s.incomeTpBreakfastOnlineQty),
      tpLvCash: acc.tpLvCash + n(s.incomeTpLunchVegCashQty),
      tpLvOnline: acc.tpLvOnline + n(s.incomeTpLunchVegOnlineQty),
      tpNvCash: acc.tpNvCash + n(s.incomeTpLunchEggCashQty) + n(s.incomeTpLunchFishCashQty) + n(s.incomeTpLunchChickenCashQty),
      tpNvOnline: acc.tpNvOnline + n(s.incomeTpLunchEggOnlineQty) + n(s.incomeTpLunchFishOnlineQty) + n(s.incomeTpLunchChickenOnlineQty),
      tpNvCashTotal: acc.tpNvCashTotal + n(s.incomeTpLunchEggCashQty) * 45 + n(s.incomeTpLunchFishCashQty) * 55 + n(s.incomeTpLunchChickenCashQty) * 65,
      tpNvOnlineTotal: acc.tpNvOnlineTotal + n(s.incomeTpLunchEggOnlineQty) * 45 + n(s.incomeTpLunchFishOnlineQty) * 55 + n(s.incomeTpLunchChickenOnlineQty) * 65,
      tpEvCash: acc.tpEvCash + n(s.incomeTpEveningCashQty),
      tpEvOnline: acc.tpEvOnline + n(s.incomeTpEveningOnlineQty),
      tpNtCash: acc.tpNtCash + n(s.incomeTpNightCashQty),
      tpNtOnline: acc.tpNtOnline + n(s.incomeTpNightOnlineQty),
      expBananaQty: acc.expBananaQty + n(s.expenseBananaQty),
      expBananaTotal: acc.expBananaTotal + n(s.expenseBananaQty) * bananaRateForDate(s.date, bananaRateSchedule),
      expDahiBharTotal: acc.expDahiBharTotal + n(s.expenseDahiBharQty) * n(s.expenseDahiBharRate),
      expOther: acc.expOther + n(s.expenseOtherAmount),
    };
  }, {
    psBfCash: 0, psBfOnline: 0, psLnCash: 0, psLnOnline: 0,
    psEvCash: 0, psEvOnline: 0, psNtCash: 0, psNtOnline: 0,
    psRcCash: 0, psRcOnline: 0, psRcCashTotal: 0, psRcOnlineTotal: 0,
    tpBfCash: 0, tpBfOnline: 0, tpLvCash: 0, tpLvOnline: 0,
    tpNvCash: 0, tpNvOnline: 0, tpNvCashTotal: 0, tpNvOnlineTotal: 0,
    tpEvCash: 0, tpEvOnline: 0, tpNtCash: 0, tpNtOnline: 0,
    expBananaQty: 0, expBananaTotal: 0, expDahiBharTotal: 0, expOther: 0,
  });

  const psRows: AggRow[] = [
    { no: 1, name: "Breakfast", cashQty: agg.psBfCash, cashTotal: agg.psBfCash * PS_RATES.bf, onlineQty: agg.psBfOnline, onlineTotal: agg.psBfOnline * PS_RATES.bf },
    { no: 2, name: "Lunch", cashQty: agg.psLnCash, cashTotal: agg.psLnCash * PS_RATES.ln, onlineQty: agg.psLnOnline, onlineTotal: agg.psLnOnline * PS_RATES.ln },
    { no: 3, name: "Evening Snacks", cashQty: agg.psEvCash, cashTotal: agg.psEvCash * PS_RATES.ev, onlineQty: agg.psEvOnline, onlineTotal: agg.psEvOnline * PS_RATES.ev },
    { no: 4, name: "Night Snacks", cashQty: agg.psNtCash, cashTotal: agg.psNtCash * PS_RATES.nt, onlineQty: agg.psNtOnline, onlineTotal: agg.psNtOnline * PS_RATES.nt },
    { no: 5, name: "Recharge", cashQty: agg.psRcCash, cashTotal: agg.psRcCashTotal, onlineQty: agg.psRcOnline, onlineTotal: agg.psRcOnlineTotal },
  ];

  const tpRows: AggRow[] = [
    { no: 1, name: "Breakfast", cashQty: agg.tpBfCash, cashTotal: agg.tpBfCash * TP_RATES.bf, onlineQty: agg.tpBfOnline, onlineTotal: agg.tpBfOnline * TP_RATES.bf },
    { no: 2, name: "Lunch Veg", cashQty: agg.tpLvCash, cashTotal: agg.tpLvCash * TP_RATES.lv, onlineQty: agg.tpLvOnline, onlineTotal: agg.tpLvOnline * TP_RATES.lv },
    { no: 3, name: "Lunch Non Veg", cashQty: agg.tpNvCash, cashTotal: agg.tpNvCashTotal, onlineQty: agg.tpNvOnline, onlineTotal: agg.tpNvOnlineTotal },
    { no: 4, name: "Evening Snacks", cashQty: agg.tpEvCash, cashTotal: agg.tpEvCash * TP_RATES.ev, onlineQty: agg.tpEvOnline, onlineTotal: agg.tpEvOnline * TP_RATES.ev },
    { no: 5, name: "Night", cashQty: agg.tpNtCash, cashTotal: agg.tpNtCash * TP_RATES.nt, onlineQty: agg.tpNtOnline, onlineTotal: agg.tpNtOnline * TP_RATES.nt },
  ];

  const psCashTotal  = psRows.reduce((s, r) => s + r.cashTotal, 0);
  const psOnlineTotal = psRows.reduce((s, r) => s + r.onlineTotal, 0);
  const psGrandTotal = psCashTotal + psOnlineTotal;
  const tpCashTotal  = tpRows.reduce((s, r) => s + r.cashTotal, 0);
  const tpOnlineTotal = tpRows.reduce((s, r) => s + r.onlineTotal, 0);
  const tpGrandTotal = tpCashTotal + tpOnlineTotal;
  const grandCash   = psCashTotal + tpCashTotal;
  const grandOnline = psOnlineTotal + tpOnlineTotal;
  const grandIncome = psGrandTotal + tpGrandTotal;
  const monthBananaRate = bananaRateForDate(`${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`, bananaRateSchedule);
  const totalExpense = agg.expBananaTotal + agg.expDahiBharTotal + agg.expOther;
  const balance = grandIncome - totalExpense;

  const yearOptions = [];
  for (let y = now.getFullYear() + 1; y >= 2020; y--) yearOptions.push(y);

  const handlePrint = () => {
    const t = document.title;
    document.title = `CashSeal_Monthly_${MONTHS[selectedMonth - 1]}_${selectedYear}`;
    window.print();
    document.title = t;
  };

  return (
    <Layout>
      {/* Action bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b print:hidden bg-white dark:bg-slate-800 sticky top-0 z-10 gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate("/cash-seal")} data-testid="button-back">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={String(selectedMonth)} onValueChange={v => setSelectedMonth(Number(v))}>
            <SelectTrigger className="w-32 h-8 text-xs" data-testid="select-month"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-24 h-8 text-xs" data-testid="select-year"><SelectValue /></SelectTrigger>
            <SelectContent>
              {yearOptions.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={handlePrint} className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5 h-8" data-testid="button-print">
            <Printer className="w-4 h-4" /> Print / PDF
          </Button>
        </div>
      </div>

      {/* Report content */}
      <div className="max-w-3xl mx-auto px-4 py-6 print:px-0 print:py-0 print:max-w-none" id="monthly-report">
        {/* Company header */}
        <div className="text-center mb-3 print:mb-2">
          <div className="text-base font-bold text-gray-800 print:text-black">DJ Hospitality & Facility Management Private Limited</div>
          <div className="text-sm text-gray-600 print:text-gray-700">Clint Name: -</div>
        </div>

        {/* Month/Year info */}
        <div className="flex items-center justify-between text-xs text-gray-700 mb-3 print:mb-2">
          <div className="font-semibold">Period: {MONTHS[selectedMonth - 1]} {selectedYear}</div>
          <div className="text-gray-500">{filtered.length} record{filtered.length !== 1 ? "s" : ""} found</div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 print:hidden">
            <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 print:py-8 text-gray-400">
            <FileBarChart className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No records found for {MONTHS[selectedMonth - 1]} {selectedYear}</p>
          </div>
        ) : (
          <>
            {/* Permanent Staff */}
            <MonthlySection title="Permanent Staff" color="blue" rows={psRows} />

            {/* Third Party */}
            <MonthlySection title="Third Party" color="green" rows={tpRows} />

            {/* Grand Total Income Breakdown */}
            <div className="mb-4 overflow-x-auto">
              <div className="bg-gray-800 text-white text-center text-sm font-bold py-1.5 print:py-1">
                Grand Total Income Summary (Permanent Staff + Third Party)
              </div>
              <table className="w-full border-collapse text-xs min-w-[500px]">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-2 py-1.5 text-left text-gray-700">Section</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right text-red-700">Cash Amount</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right text-blue-700">Online Amount</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right text-gray-800">Total (Cash + Online)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-blue-50">
                    <td className="border border-gray-300 px-2 py-1.5 font-semibold text-blue-800">Permanent Staff</td>
                    <td className="border border-gray-300 px-2 py-1.5 text-right font-mono text-red-600">{fmt(psCashTotal)}</td>
                    <td className="border border-gray-300 px-2 py-1.5 text-right font-mono text-blue-700">{fmt(psOnlineTotal)}</td>
                    <td className="border border-gray-300 px-2 py-1.5 text-right font-mono font-bold text-blue-800">{fmt(psGrandTotal)}</td>
                  </tr>
                  <tr className="bg-green-50">
                    <td className="border border-gray-300 px-2 py-1.5 font-semibold text-green-800">Third Party</td>
                    <td className="border border-gray-300 px-2 py-1.5 text-right font-mono text-red-600">{fmt(tpCashTotal)}</td>
                    <td className="border border-gray-300 px-2 py-1.5 text-right font-mono text-blue-700">{fmt(tpOnlineTotal)}</td>
                    <td className="border border-gray-300 px-2 py-1.5 text-right font-mono font-bold text-green-800">{fmt(tpGrandTotal)}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className="bg-gray-800 text-white">
                    <td className="border border-gray-600 px-2 py-2 font-bold text-sm">Grand Total</td>
                    <td className="border border-gray-600 px-2 py-2 text-right font-mono font-bold text-red-300">{fmt(grandCash)}</td>
                    <td className="border border-gray-600 px-2 py-2 text-right font-mono font-bold text-blue-300">{fmt(grandOnline)}</td>
                    <td className="border border-gray-600 px-2 py-2 text-right font-mono font-bold text-lg">{fmt(grandIncome)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Expense summary */}
            {totalExpense > 0 && (
              <div className="mb-4">
                <div className="bg-red-600 text-white text-center text-sm font-bold py-1.5 rounded-t">Monthly Expense Summary</div>
                <table className="w-full border-collapse text-xs">
                  <tbody>
                    {agg.expBananaQty > 0 && (
                      <tr>
                        <td className="border border-gray-300 px-2 py-1">Banana</td>
                        <td className="border border-gray-300 px-2 py-1 text-right font-mono">{agg.expBananaQty} × {fmt(monthBananaRate)}</td>
                        <td className="border border-gray-300 px-2 py-1 text-right font-mono font-semibold">{fmt(agg.expBananaTotal)}</td>
                      </tr>
                    )}
                    {agg.expDahiBharTotal > 0 && (
                      <tr>
                        <td className="border border-gray-300 px-2 py-1">Dahi Bhar</td>
                        <td className="border border-gray-300 px-2 py-1"></td>
                        <td className="border border-gray-300 px-2 py-1 text-right font-mono font-semibold">{fmt(agg.expDahiBharTotal)}</td>
                      </tr>
                    )}
                    {agg.expOther > 0 && (
                      <tr>
                        <td className="border border-gray-300 px-2 py-1">Other</td>
                        <td className="border border-gray-300 px-2 py-1"></td>
                        <td className="border border-gray-300 px-2 py-1 text-right font-mono font-semibold">{fmt(agg.expOther)}</td>
                      </tr>
                    )}
                    <tr className="bg-red-50">
                      <td colSpan={2} className="border border-gray-300 px-2 py-1 font-bold text-right">Total Expense:</td>
                      <td className="border border-gray-300 px-2 py-1 text-right font-bold font-mono">{fmt(totalExpense)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Balance summary */}
            <div className="grid grid-cols-3 gap-3 mb-4 print:gap-2">
              <div className="border rounded p-2 text-center print:border-gray-400">
                <div className="text-xs text-gray-500 mb-1">Total Income</div>
                <div className="font-bold font-mono text-green-700 text-sm">{fmt(grandIncome)}</div>
              </div>
              <div className="border rounded p-2 text-center print:border-gray-400">
                <div className="text-xs text-gray-500 mb-1">Total Expense</div>
                <div className="font-bold font-mono text-red-700 text-sm">{fmt(totalExpense)}</div>
              </div>
              <div className={`border rounded p-2 text-center print:border-gray-400 ${balance >= 0 ? "bg-green-50" : "bg-orange-50"}`}>
                <div className="text-xs text-gray-500 mb-1">Net Balance</div>
                <div className={`font-bold font-mono text-sm ${balance >= 0 ? "text-green-700" : "text-orange-700"}`}>{fmt(balance)}</div>
              </div>
            </div>

            {/* Dates covered */}
            <div className="text-xs text-gray-500 mb-4 print:mb-2">
              <span className="font-semibold">Dates covered: </span>
              {filtered
                .map(s => { try { return format(parseDate(s.date)!, "dd"); } catch { return ""; } })
                .filter(Boolean)
                .join(", ")} {MONTHS[selectedMonth - 1]} {selectedYear}
            </div>

            {/* Signature */}
            <div className="grid grid-cols-2 gap-8 mt-12 pt-4 border-t print:mt-16 print:border-gray-400 text-center text-xs text-gray-500">
              <div><div className="border-t mt-8 pt-2 print:border-gray-400">Prepared By</div></div>
              <div><div className="border-t mt-8 pt-2 print:border-gray-400">Authorized Signatory</div></div>
            </div>

            <div className="text-center text-xs text-gray-400 mt-4 print:mt-6">
              Generated on {format(new Date(), "dd-MM-yyyy, hh:mm a")}
            </div>
          </>
        )}
      </div>

      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          body { font-size: 11px; }
          @page { margin: 1cm; }
        }
      `}</style>
    </Layout>
  );
}
