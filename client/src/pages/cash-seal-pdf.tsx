import { useRoute } from "wouter";
import { useCashSeal } from "@/hooks/use-reports";
import { format, parseISO } from "date-fns";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Printer } from "lucide-react";
import { useLocation } from "wouter";

const PS_RATES = { bf: 5, ln: 20, ev: 10, nt: 10 };
const TP_RATES = { bf: 20, lv: 35, ev: 20, nt: 20 };
const BANANA_RATE = 4.5;
const fmt = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function parseDate(d: string) {
  try { return d.includes("T") ? parseISO(d) : new Date(d + "T00:00:00"); } catch { return new Date(); }
}

// ── Section table for PS or TP ─────────────────────────────────
interface SealRow { no: number; name: string; cashQty: number; cashTotal: number; onlineQty: number; onlineTotal: number; }

function ReportSection({ title, color, rows }: { title: string; color: "blue" | "green"; rows: SealRow[] }) {
  const headerBg = color === "blue" ? "#1d4ed8" : "#16a34a";
  const subHeaderBg = color === "blue" ? "#dbeafe" : "#dcfce7";
  const subHeaderColor = color === "blue" ? "#1e40af" : "#15803d";
  const cashTotalSum = rows.reduce((s, r) => s + r.cashTotal, 0);
  const onlineTotalSum = rows.reduce((s, r) => s + r.onlineTotal, 0);
  const grandSum = cashTotalSum + onlineTotalSum;

  return (
    <div className="mb-4">
      <div style={{ background: headerBg }} className="text-white text-center text-sm font-bold py-1.5 print:py-1">
        {title}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs min-w-[620px]">
          <thead>
            <tr style={{ background: subHeaderBg }}>
              <th className="border border-gray-300 px-2 py-1 text-center w-8" style={{ color: subHeaderColor }}>Sl No.</th>
              <th className="border border-gray-300 px-2 py-1 text-left" style={{ color: subHeaderColor }}>Name</th>
              <th className="border border-gray-300 px-2 py-1 text-right" style={{ color: subHeaderColor }}>Total Cash Qty</th>
              <th className="border border-gray-300 px-2 py-1 text-right" style={{ color: subHeaderColor }}>Total Cash Amount</th>
              <th className="border border-gray-300 px-2 py-1 text-right" style={{ color: subHeaderColor }}>Total Online Qty</th>
              <th className="border border-gray-300 px-2 py-1 text-right" style={{ color: subHeaderColor }}>Total Online Amount</th>
              <th className="border border-gray-300 px-2 py-1 text-right" style={{ color: subHeaderColor }}>Cash + Online Qty</th>
              <th className="border border-gray-300 px-2 py-1 text-right" style={{ color: subHeaderColor }}>Total Amount</th>
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
            <tr style={{ background: subHeaderBg }}>
              <td colSpan={3} className="border border-gray-300 px-2 py-1 text-right font-bold">Total:</td>
              <td className="border border-gray-300 px-2 py-1 text-right font-bold font-mono">{fmt(cashTotalSum)}</td>
              <td className="border border-gray-300 px-2 py-1"></td>
              <td className="border border-gray-300 px-2 py-1 text-right font-bold font-mono">{fmt(onlineTotalSum)}</td>
              <td colSpan={2} className="border border-gray-300 px-2 py-1"></td>
            </tr>
            <tr style={{ background: subHeaderBg }}>
              <td colSpan={6} className="border border-gray-300 px-2 py-1 text-right font-bold">Total Cash + Total Online:</td>
              <td colSpan={2} className="border border-gray-300 px-2 py-1 text-right font-bold font-mono text-sm">{fmt(grandSum)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export default function CashSealPDF() {
  const [, params] = useRoute("/cash-seal/:id/pdf");
  const id = params?.id ? Number(params.id) : null;
  const { data: seal, isLoading } = useCashSeal(id);
  const [, navigate] = useLocation();

  const handlePrint = () => {
    const originalTitle = document.title;
    if (seal) {
      try {
        const dt = parseDate(seal.date);
        document.title = `CashSeal_KPF_${format(dt, "dd-MM-yyyy")}`;
      } catch { /* */ }
    }
    window.print();
    document.title = originalTitle;
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
        </div>
      </Layout>
    );
  }

  if (!seal) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Cash Seal record not found</p>
          <Button variant="ghost" onClick={() => navigate("/cash-seal")} className="mt-4"><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
        </div>
      </Layout>
    );
  }

  const n = (v: any) => Number(v) || 0;

  // ── PS rows ──────────────────────────────────────────────────
  const psRcRate = n(seal.incomePsRechargeRate);
  const psRows: SealRow[] = [
    { no: 1, name: "Breakfast", cashQty: n(seal.incomePsBreakfastCashQty), cashTotal: n(seal.incomePsBreakfastCashQty) * PS_RATES.bf, onlineQty: n(seal.incomePsBreakfastOnlineQty), onlineTotal: n(seal.incomePsBreakfastOnlineQty) * PS_RATES.bf },
    { no: 2, name: "Lunch", cashQty: n(seal.incomePsLunchCashQty), cashTotal: n(seal.incomePsLunchCashQty) * PS_RATES.ln, onlineQty: n(seal.incomePsLunchOnlineQty), onlineTotal: n(seal.incomePsLunchOnlineQty) * PS_RATES.ln },
    { no: 3, name: "Evening Snacks", cashQty: n(seal.incomePsEveningCashQty), cashTotal: n(seal.incomePsEveningCashQty) * PS_RATES.ev, onlineQty: n(seal.incomePsEveningOnlineQty), onlineTotal: n(seal.incomePsEveningOnlineQty) * PS_RATES.ev },
    { no: 4, name: "Night Snacks", cashQty: n(seal.incomePsNightCashQty), cashTotal: n(seal.incomePsNightCashQty) * PS_RATES.nt, onlineQty: n(seal.incomePsNightOnlineQty), onlineTotal: n(seal.incomePsNightOnlineQty) * PS_RATES.nt },
    { no: 5, name: "Recharge", cashQty: n(seal.incomePsRechargeCashQty), cashTotal: n(seal.incomePsRechargeCashQty) * psRcRate, onlineQty: n(seal.incomePsRechargeOnlineQty), onlineTotal: n(seal.incomePsRechargeOnlineQty) * psRcRate },
  ];

  // ── TP rows ──────────────────────────────────────────────────
  const tpRows: SealRow[] = [
    { no: 1, name: "Breakfast", cashQty: n(seal.incomeTpBreakfastCashQty), cashTotal: n(seal.incomeTpBreakfastCashQty) * TP_RATES.bf, onlineQty: n(seal.incomeTpBreakfastOnlineQty), onlineTotal: n(seal.incomeTpBreakfastOnlineQty) * TP_RATES.bf },
    { no: 2, name: "Lunch Veg", cashQty: n(seal.incomeTpLunchVegCashQty), cashTotal: n(seal.incomeTpLunchVegCashQty) * TP_RATES.lv, onlineQty: n(seal.incomeTpLunchVegOnlineQty), onlineTotal: n(seal.incomeTpLunchVegOnlineQty) * TP_RATES.lv },
    {
      no: 3, name: "Lunch Non Veg",
      cashQty: n(seal.incomeTpLunchEggCashQty) + n(seal.incomeTpLunchFishCashQty) + n(seal.incomeTpLunchChickenCashQty),
      cashTotal: n(seal.incomeTpLunchEggCashQty) * 45 + n(seal.incomeTpLunchFishCashQty) * 55 + n(seal.incomeTpLunchChickenCashQty) * 65,
      onlineQty: n(seal.incomeTpLunchEggOnlineQty) + n(seal.incomeTpLunchFishOnlineQty) + n(seal.incomeTpLunchChickenOnlineQty),
      onlineTotal: n(seal.incomeTpLunchEggOnlineQty) * 45 + n(seal.incomeTpLunchFishOnlineQty) * 55 + n(seal.incomeTpLunchChickenOnlineQty) * 65,
    },
    { no: 4, name: "Evening Snacks", cashQty: n(seal.incomeTpEveningCashQty), cashTotal: n(seal.incomeTpEveningCashQty) * TP_RATES.ev, onlineQty: n(seal.incomeTpEveningOnlineQty), onlineTotal: n(seal.incomeTpEveningOnlineQty) * TP_RATES.ev },
    { no: 5, name: "Night", cashQty: n(seal.incomeTpNightCashQty), cashTotal: n(seal.incomeTpNightCashQty) * TP_RATES.nt, onlineQty: n(seal.incomeTpNightOnlineQty), onlineTotal: n(seal.incomeTpNightOnlineQty) * TP_RATES.nt },
  ];

  const psCashTotal   = psRows.reduce((s, r) => s + r.cashTotal, 0);
  const psOnlineTotal = psRows.reduce((s, r) => s + r.onlineTotal, 0);
  const psTotal       = psCashTotal + psOnlineTotal;
  const tpCashTotal   = tpRows.reduce((s, r) => s + r.cashTotal, 0);
  const tpOnlineTotal = tpRows.reduce((s, r) => s + r.onlineTotal, 0);
  const tpTotal       = tpCashTotal + tpOnlineTotal;
  const grandCash     = psCashTotal + tpCashTotal;
  const grandOnline   = psOnlineTotal + tpOnlineTotal;
  const grandIncome   = psTotal + tpTotal;
  const bananaTotal = n(seal.expenseBananaQty) * BANANA_RATE;
  const dahiBharTotal = n(seal.expenseDahiBharQty) * n(seal.expenseDahiBharRate);
  const totalExpense = bananaTotal + dahiBharTotal + n(seal.expenseOtherAmount);
  const balance = grandIncome - totalExpense;

  let dateStr = "";
  try { dateStr = format(parseDate(seal.date), "dd-MM-yyyy, EEEE"); } catch { dateStr = seal.date; }

  return (
    <Layout>
      {/* Action bar (hidden when printing) */}
      <div className="flex items-center justify-between px-4 py-3 border-b print:hidden bg-white dark:bg-slate-800 sticky top-0 z-10">
        <Button variant="ghost" size="sm" onClick={() => navigate("/cash-seal")} data-testid="button-back">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <Button size="sm" onClick={handlePrint} className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5" data-testid="button-print">
          <Printer className="w-4 h-4" /> Print / PDF
        </Button>
      </div>

      {/* Print content */}
      <div className="max-w-3xl mx-auto px-4 py-6 print:px-0 print:py-0 print:max-w-none" id="print-content">
        {/* Company header */}
        <div className="text-center mb-3 print:mb-2">
          <div className="text-base font-bold text-gray-800 print:text-black">DJ Hospitality & Facility Management Private Limited</div>
          <div className="text-sm text-gray-600 print:text-gray-700">Clint Name: -</div>
        </div>

        {/* Date row */}
        <div className="text-xs text-gray-700 mb-3 print:mb-2">
          <span className="font-semibold">Date:</span> {dateStr}
          {seal.serialNumber && <span className="ml-4"><span className="font-semibold">Serial No:</span> #{seal.serialNumber}</span>}
        </div>

        {/* Permanent Staff section */}
        <ReportSection title="Permanent Staff" color="blue" rows={psRows} />

        {/* Third Party section */}
        <ReportSection title="Third Party" color="green" rows={tpRows} />

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
                <td className="border border-gray-300 px-2 py-1.5 text-right font-mono font-bold text-blue-800">{fmt(psTotal)}</td>
              </tr>
              <tr className="bg-green-50">
                <td className="border border-gray-300 px-2 py-1.5 font-semibold text-green-800">Third Party</td>
                <td className="border border-gray-300 px-2 py-1.5 text-right font-mono text-red-600">{fmt(tpCashTotal)}</td>
                <td className="border border-gray-300 px-2 py-1.5 text-right font-mono text-blue-700">{fmt(tpOnlineTotal)}</td>
                <td className="border border-gray-300 px-2 py-1.5 text-right font-mono font-bold text-green-800">{fmt(tpTotal)}</td>
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

        {/* Expense section */}
        <div className="mb-4">
          <div className="bg-red-600 text-white text-center text-sm font-bold py-1.5 rounded-t">Expense</div>
          <table className="w-full border-collapse text-xs" style={{ border: "1px solid #ccc" }}>
            <thead>
              <tr className="bg-red-50">
                <th className="border border-gray-300 px-1.5 py-1 text-left text-red-700">Description</th>
                <th className="border border-gray-300 px-1.5 py-1 text-right text-red-700">Rate</th>
                <th className="border border-gray-300 px-1.5 py-1 text-right text-red-700">Qty</th>
                <th className="border border-gray-300 px-1.5 py-1 text-right text-red-700">Amount</th>
              </tr>
            </thead>
            <tbody>
              {n(seal.expenseBananaQty) > 0 && (
                <tr>
                  <td className="border border-gray-300 px-1.5 py-1">Banana</td>
                  <td className="border border-gray-300 px-1.5 py-1 text-right font-mono">{fmt(BANANA_RATE)}</td>
                  <td className="border border-gray-300 px-1.5 py-1 text-right font-mono">{n(seal.expenseBananaQty)}</td>
                  <td className="border border-gray-300 px-1.5 py-1 text-right font-mono font-semibold">{fmt(bananaTotal)}</td>
                </tr>
              )}
              {n(seal.expenseDahiBharQty) > 0 && (
                <tr>
                  <td className="border border-gray-300 px-1.5 py-1">Dahi Bhar</td>
                  <td className="border border-gray-300 px-1.5 py-1 text-right font-mono">{fmt(n(seal.expenseDahiBharRate))}</td>
                  <td className="border border-gray-300 px-1.5 py-1 text-right font-mono">{n(seal.expenseDahiBharQty)}</td>
                  <td className="border border-gray-300 px-1.5 py-1 text-right font-mono font-semibold">{fmt(dahiBharTotal)}</td>
                </tr>
              )}
              {n(seal.expenseOtherAmount) > 0 && (
                <tr>
                  <td className="border border-gray-300 px-1.5 py-1" colSpan={3}>Other</td>
                  <td className="border border-gray-300 px-1.5 py-1 text-right font-mono font-semibold">{fmt(n(seal.expenseOtherAmount))}</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-red-50">
                <td colSpan={3} className="border border-gray-300 px-1.5 py-1 text-right font-bold">Total Expense:</td>
                <td className="border border-gray-300 px-1.5 py-1 text-right font-bold font-mono">{fmt(totalExpense)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Balance summary */}
        <div className="grid grid-cols-3 gap-3 mb-4 print:gap-2">
          <div className="border rounded p-2 text-center print:border-gray-400">
            <div className="text-xs text-gray-500 mb-1">Total Income</div>
            <div className="font-bold font-mono text-green-700">{fmt(grandIncome)}</div>
          </div>
          <div className="border rounded p-2 text-center print:border-gray-400">
            <div className="text-xs text-gray-500 mb-1">Total Expense</div>
            <div className="font-bold font-mono text-red-700">{fmt(totalExpense)}</div>
          </div>
          <div className={`border rounded p-2 text-center print:border-gray-400 ${balance >= 0 ? "bg-green-50" : "bg-orange-50"}`}>
            <div className="text-xs text-gray-500 mb-1">Net Balance</div>
            <div className={`font-bold font-mono ${balance >= 0 ? "text-green-700" : "text-orange-700"}`}>{fmt(balance)}</div>
          </div>
        </div>

        {n(seal.totalGivenToAkbarAli) > 0 && (
          <div className="flex justify-between text-sm mb-4">
            <span className="text-gray-600">Given to Akbar Ali</span>
            <span className="font-semibold font-mono text-orange-700">{fmt(n(seal.totalGivenToAkbarAli))}</span>
          </div>
        )}

        {/* Signature */}
        <div className="grid grid-cols-2 gap-8 mt-12 pt-4 border-t print:mt-16 print:border-gray-400 text-center text-xs text-gray-500">
          <div><div className="border-t mt-8 pt-2 print:border-gray-400">Prepared By</div></div>
          <div><div className="border-t mt-8 pt-2 print:border-gray-400">Authorized Signatory</div></div>
        </div>

        <div className="text-center text-xs text-gray-400 mt-4 print:mt-6">
          Generated on {format(new Date(), "dd-MM-yyyy, hh:mm a")}
        </div>
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
