import { useRoute } from "wouter";
import { useCashSeal } from "@/hooks/use-reports";
import { format } from "date-fns";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, FileDown } from "lucide-react";
import { useLocation } from "wouter";

export default function CashSealPDF() {
  const [, params] = useRoute("/cash-seal/:id/pdf");
  const id = params?.id ? Number(params.id) : null;
  const { data: seal, isLoading } = useCashSeal(id);
  const [, navigate] = useLocation();

  const handlePrint = () => {
    const originalTitle = document.title;
    if (seal) {
      const dateStr = format(new Date(seal.date), "dd-MM-yyyy");
      document.title = `DJ KPF Daily Cash Seal ${seal.serialNumber} ${dateStr}`;
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
          <Button variant="ghost" onClick={() => navigate("/")} className="mt-4">
            Back to Dashboard
          </Button>
        </div>
      </Layout>
    );
  }

  const MORNING_RATE = 5;
  const LUNCH_RATE = 20;
  const EVENING_RATE = 10;
  const NIGHT_RATE = 10;
  const BANANA_RATE = 4.5;

  const incomeRows = [
    { desc: "Morning", rate: MORNING_RATE, qty: Number(seal.incomeMorningQty), total: Number(seal.incomeMorningQty) * MORNING_RATE },
    { desc: "Lunch", rate: LUNCH_RATE, qty: Number(seal.incomeLunchQty), total: Number(seal.incomeLunchQty) * LUNCH_RATE },
    { desc: "Evening", rate: EVENING_RATE, qty: Number(seal.incomeEveningQty), total: Number(seal.incomeEveningQty) * EVENING_RATE },
    { desc: "Night", rate: NIGHT_RATE, qty: Number(seal.incomeNightQty), total: Number(seal.incomeNightQty) * NIGHT_RATE },
    { desc: "CASH Non Veg", rate: Number(seal.incomeNonVegRate), qty: Number(seal.incomeNonVegQty), total: Number(seal.incomeNonVegRate) * Number(seal.incomeNonVegQty) },
    { desc: "CASH Veg", rate: Number(seal.incomeVegRate), qty: Number(seal.incomeVegQty), total: Number(seal.incomeVegRate) * Number(seal.incomeVegQty) },
    { desc: "Morning CASH", rate: Number(seal.incomeMorningCashRate), qty: Number(seal.incomeMorningCashQty), total: Number(seal.incomeMorningCashRate) * Number(seal.incomeMorningCashQty) },
    { desc: "Evening CASH", rate: Number(seal.incomeEveningCashRate), qty: Number(seal.incomeEveningCashQty), total: Number(seal.incomeEveningCashRate) * Number(seal.incomeEveningCashQty) },
  ].filter(row => row.qty > 0 || row.total > 0);

  const totalIncome = incomeRows.reduce((sum, r) => sum + r.total, 0);

  const expenseRows = [
    { desc: "Banana", rate: BANANA_RATE, qty: Number(seal.expenseBananaQty), total: Number(seal.expenseBananaQty) * BANANA_RATE },
    { desc: "Dahi Bhar", rate: Number(seal.expenseDahiBharRate), qty: Number(seal.expenseDahiBharQty), total: Number(seal.expenseDahiBharQty) * Number(seal.expenseDahiBharRate) },
  ].filter(row => row.qty > 0 || row.total > 0);

  const otherExpense = Number(seal.expenseOtherAmount);
  const totalExpense = expenseRows.reduce((sum, r) => sum + r.total, 0) + otherExpense;
  const balance = totalIncome - totalExpense;
  const givenToAkbarAli = Number(seal.totalGivenToAkbarAli);

  const fmt = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const renderMobileRows = (rows: typeof incomeRows, colorClass: string) => (
    <div className="sm:hidden space-y-1.5">
      {rows.map((row, idx) => (
        <div key={idx} className="flex items-center justify-between py-1.5 border-b border-dashed border-border/60 last:border-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className={`w-5 h-5 rounded-full ${colorClass} text-white text-[9px] flex items-center justify-center font-bold shrink-0`}>{idx + 1}</span>
            <div className="min-w-0">
              <p className="text-xs font-medium truncate print:text-black">{row.desc}</p>
              <p className="text-[10px] text-muted-foreground print:text-gray-500">{row.qty} x {fmt(row.rate)}</p>
            </div>
          </div>
          <span className="text-xs font-bold font-mono ml-2 shrink-0 print:text-black">{fmt(row.total)}</span>
        </div>
      ))}
    </div>
  );

  const renderDesktopTable = (rows: typeof incomeRows) => (
    <div className="hidden sm:block overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-gray-50 dark:bg-muted/50 print:bg-gray-100">
            <th className="border border-border print:border-gray-300 px-2 py-1.5 text-center font-semibold">#</th>
            <th className="border border-border print:border-gray-300 px-2 py-1.5 text-left font-semibold">Description</th>
            <th className="border border-border print:border-gray-300 px-2 py-1.5 text-right font-semibold">Rate</th>
            <th className="border border-border print:border-gray-300 px-2 py-1.5 text-right font-semibold">Qty</th>
            <th className="border border-border print:border-gray-300 px-2 py-1.5 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx}>
              <td className="border border-border print:border-gray-300 px-2 py-1 text-center text-muted-foreground print:text-gray-600">{idx + 1}</td>
              <td className="border border-border print:border-gray-300 px-2 py-1 font-medium print:text-black">{row.desc}</td>
              <td className="border border-border print:border-gray-300 px-2 py-1 text-right font-mono print:text-black">{fmt(row.rate)}</td>
              <td className="border border-border print:border-gray-300 px-2 py-1 text-right font-mono print:text-black">{row.qty}</td>
              <td className="border border-border print:border-gray-300 px-2 py-1 text-right font-mono font-semibold print:text-black">{fmt(row.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-1 sm:px-0">
        <div className="flex items-center justify-between mb-4 sm:mb-6 print:hidden">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} data-testid="button-back-dashboard">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <Button size="sm" onClick={handlePrint} className="bg-gradient-to-r from-teal-500 to-cyan-600 border-0 text-white shadow-md" data-testid="button-convert-pdf">
            <FileDown className="w-4 h-4 mr-1" /> Convert to PDF
          </Button>
        </div>

        <div className="bg-white dark:bg-card border rounded-xl p-4 sm:p-8 print:border-0 print:shadow-none print:p-0" id="pdf-content">
          <div className="text-center mb-5 sm:mb-6 pb-4 border-b-2 border-teal-200 dark:border-teal-800 print:border-gray-300">
            <h1 className="text-lg sm:text-2xl font-bold text-foreground print:text-black leading-tight">DJ Hospitality & Facility Management Pvt Ltd</h1>
            <p className="text-xs sm:text-sm font-semibold text-teal-600 dark:text-teal-400 print:text-gray-600 mt-1 uppercase tracking-wider">Daily Cash Seal KPF</p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 mb-5 text-xs sm:text-sm">
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground print:text-gray-500">Serial No:</span>
              <span className="font-bold bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 px-2 py-0.5 rounded print:bg-gray-100 print:text-black" data-testid="text-serial-number">#{seal.serialNumber}</span>
            </div>
            <div>
              <span className="text-muted-foreground print:text-gray-500">Date: </span>
              <span className="font-semibold print:text-black" data-testid="text-seal-date">{format(new Date(seal.date), "dd MMM yyyy, EEEE")}</span>
            </div>
          </div>

          <div className="mb-5">
            <div className="flex items-center justify-between mb-2 pb-1.5 border-b-2 border-emerald-300 dark:border-emerald-700 print:border-gray-400">
              <h3 className="text-sm font-bold text-emerald-700 dark:text-emerald-400 print:text-black">Income</h3>
              <span className="text-xs font-bold font-mono text-emerald-700 dark:text-emerald-400 sm:hidden">{fmt(totalIncome)}</span>
            </div>
            {renderMobileRows(incomeRows, "bg-emerald-500")}
            {renderDesktopTable(incomeRows)}
            <div className="flex justify-between items-center mt-2 pt-2 border-t border-emerald-200 dark:border-emerald-800 print:border-gray-300">
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 print:text-black">Total Income</span>
              <span className="text-sm font-bold font-mono text-emerald-600 print:text-green-700" data-testid="text-total-income">{fmt(totalIncome)}</span>
            </div>
          </div>

          <div className="mb-5">
            <div className="flex items-center justify-between mb-2 pb-1.5 border-b-2 border-rose-300 dark:border-rose-700 print:border-gray-400">
              <h3 className="text-sm font-bold text-rose-700 dark:text-rose-400 print:text-black">Expense</h3>
              <span className="text-xs font-bold font-mono text-rose-700 dark:text-rose-400 sm:hidden">{fmt(totalExpense)}</span>
            </div>
            {renderMobileRows(expenseRows, "bg-rose-500")}
            {renderDesktopTable(expenseRows)}
            {otherExpense > 0 && (
              <div className="flex items-center justify-between py-1.5 border-b border-dashed border-border/60 sm:mt-1">
                <span className="text-xs font-medium print:text-black">Other Expense</span>
                <span className="text-xs font-bold font-mono print:text-black">{fmt(otherExpense)}</span>
              </div>
            )}
            <div className="flex justify-between items-center mt-2 pt-2 border-t border-rose-200 dark:border-rose-800 print:border-gray-300">
              <span className="text-xs font-semibold text-rose-700 dark:text-rose-400 print:text-black">Total Expense</span>
              <span className="text-sm font-bold font-mono text-rose-600 print:text-red-700" data-testid="text-total-expense">{fmt(totalExpense)}</span>
            </div>
          </div>

          <div className="border-t-2 border-gray-300 dark:border-gray-600 print:border-gray-400 pt-4">
            <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4">
              <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-lg p-3 text-center print:bg-gray-50 print:border print:border-gray-200">
                <p className="text-[10px] sm:text-xs text-muted-foreground print:text-gray-500 uppercase tracking-wide font-semibold mb-1">Income</p>
                <p className="text-sm sm:text-lg font-bold font-mono text-emerald-600 print:text-black">{fmt(totalIncome)}</p>
              </div>
              <div className="bg-rose-50 dark:bg-rose-950/20 rounded-lg p-3 text-center print:bg-gray-50 print:border print:border-gray-200">
                <p className="text-[10px] sm:text-xs text-muted-foreground print:text-gray-500 uppercase tracking-wide font-semibold mb-1">Expense</p>
                <p className="text-sm sm:text-lg font-bold font-mono text-rose-600 print:text-black">{fmt(totalExpense)}</p>
              </div>
            </div>

            {givenToAkbarAli > 0 && (
              <div className="flex justify-between items-center text-xs sm:text-sm mb-3 px-1">
                <span className="text-muted-foreground print:text-gray-500">Given to Akbar Ali</span>
                <span className="font-mono font-semibold text-orange-600 print:text-orange-700" data-testid="text-given-akbar-ali">{fmt(givenToAkbarAli)}</span>
              </div>
            )}

            <div className={`rounded-xl p-4 sm:p-5 text-center ${balance >= 0 ? 'bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 border border-emerald-200 dark:border-emerald-800 print:bg-green-50 print:border-green-200' : 'bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30 border border-red-200 dark:border-red-800 print:bg-red-50 print:border-red-200'}`}>
              <p className="text-xs text-muted-foreground print:text-gray-500 uppercase tracking-wider font-semibold mb-1">Net Balance</p>
              <p className={`text-2xl sm:text-3xl font-bold font-mono ${balance >= 0 ? 'text-emerald-600 print:text-green-700' : 'text-red-600 print:text-red-700'}`} data-testid="text-balance">
                {fmt(balance)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 sm:gap-8 mt-10 sm:mt-12 pt-6 sm:pt-8 border-t print:mt-16">
            <div className="text-center">
              <div className="border-t border-border print:border-gray-400 pt-2 mt-6 sm:mt-8">
                <p className="text-xs sm:text-sm text-muted-foreground print:text-gray-500">Prepared By</p>
              </div>
            </div>
            <div className="text-center">
              <div className="border-t border-border print:border-gray-400 pt-2 mt-6 sm:mt-8">
                <p className="text-xs sm:text-sm text-muted-foreground print:text-gray-500">Authorized Signatory</p>
              </div>
            </div>
          </div>

          <div className="text-center mt-6 sm:mt-8 text-[10px] sm:text-xs text-muted-foreground print:text-gray-400">
            Generated on {format(new Date(), "dd MMM yyyy, hh:mm a")}
          </div>
        </div>
      </div>
    </Layout>
  );
}
