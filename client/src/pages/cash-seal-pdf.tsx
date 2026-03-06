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

  const morningTotal = Number(seal.incomeMorningQty) * MORNING_RATE;
  const lunchTotal = Number(seal.incomeLunchQty) * LUNCH_RATE;
  const eveningTotal = Number(seal.incomeEveningQty) * EVENING_RATE;
  const nightTotal = Number(seal.incomeNightQty) * NIGHT_RATE;
  const nonVegTotal = Number(seal.incomeNonVegRate) * Number(seal.incomeNonVegQty);
  const vegTotal = Number(seal.incomeVegRate) * Number(seal.incomeVegQty);
  const morningCashTotal = Number(seal.incomeMorningCashRate) * Number(seal.incomeMorningCashQty);
  const eveningCashTotal = Number(seal.incomeEveningCashRate) * Number(seal.incomeEveningCashQty);

  const totalIncome = morningTotal + lunchTotal + eveningTotal + nightTotal + nonVegTotal + vegTotal + morningCashTotal + eveningCashTotal;

  const bananaTotal = Number(seal.expenseBananaQty) * BANANA_RATE;
  const dahiBharTotal = Number(seal.expenseDahiBharQty) * Number(seal.expenseDahiBharRate);
  const otherExpense = Number(seal.expenseOtherAmount);
  const totalExpense = bananaTotal + dahiBharTotal + otherExpense;

  const balance = totalIncome - totalExpense;
  const givenToAkbarAli = Number(seal.totalGivenToAkbarAli);

  const fmt = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6 print:hidden">
          <Button variant="ghost" onClick={() => navigate("/")} data-testid="button-back-dashboard">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <Button onClick={handlePrint} data-testid="button-convert-pdf">
            <FileDown className="w-4 h-4 mr-2" /> Convert to PDF
          </Button>
        </div>

        <div className="bg-white dark:bg-card border rounded-xl p-6 sm:p-8 print:border-0 print:shadow-none print:p-0" id="pdf-content">
          <div className="text-center mb-6 border-b pb-4">
            <h1 className="text-2xl font-bold text-foreground print:text-black">DJ Hospitality & Facility Management Pvt Ltd</h1>
            <p className="text-sm text-muted-foreground print:text-gray-600 mt-1">Daily Cash Seal KPF</p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
            <div>
              <span className="text-muted-foreground print:text-gray-500">Serial No:</span>
              <span className="ml-2 font-semibold print:text-black" data-testid="text-serial-number">#{seal.serialNumber}</span>
            </div>
            <div className="text-right">
              <span className="text-muted-foreground print:text-gray-500">Date:</span>
              <span className="ml-2 font-semibold print:text-black" data-testid="text-seal-date">{format(new Date(seal.date), "dd MMM yyyy, EEEE")}</span>
            </div>
          </div>

          <h3 className="text-sm font-bold mb-2 print:text-black">Income</h3>
          <table className="w-full text-sm border-collapse mb-6">
            <thead>
              <tr className="bg-muted/50 print:bg-gray-100">
                <th className="border border-border print:border-gray-300 px-3 py-1.5 text-left font-semibold w-10">S.No</th>
                <th className="border border-border print:border-gray-300 px-3 py-1.5 text-left font-semibold">Description</th>
                <th className="border border-border print:border-gray-300 px-3 py-1.5 text-right font-semibold w-20">Rate</th>
                <th className="border border-border print:border-gray-300 px-3 py-1.5 text-right font-semibold w-16">Qty</th>
                <th className="border border-border print:border-gray-300 px-3 py-1.5 text-right font-semibold w-24">Amount</th>
              </tr>
            </thead>
            <tbody>
              {[
                { desc: "Morning", rate: MORNING_RATE, qty: Number(seal.incomeMorningQty), total: morningTotal },
                { desc: "Lunch", rate: LUNCH_RATE, qty: Number(seal.incomeLunchQty), total: lunchTotal },
                { desc: "Evening", rate: EVENING_RATE, qty: Number(seal.incomeEveningQty), total: eveningTotal },
                { desc: "Night", rate: NIGHT_RATE, qty: Number(seal.incomeNightQty), total: nightTotal },
                { desc: "CASH Non Veg", rate: Number(seal.incomeNonVegRate), qty: Number(seal.incomeNonVegQty), total: nonVegTotal },
                { desc: "CASH Veg", rate: Number(seal.incomeVegRate), qty: Number(seal.incomeVegQty), total: vegTotal },
                { desc: "Morning CASH", rate: Number(seal.incomeMorningCashRate), qty: Number(seal.incomeMorningCashQty), total: morningCashTotal },
                { desc: "Evening CASH", rate: Number(seal.incomeEveningCashRate), qty: Number(seal.incomeEveningCashQty), total: eveningCashTotal },
              ].filter(row => row.qty > 0 || row.total > 0).map((row, idx) => (
                <tr key={idx}>
                  <td className="border border-border print:border-gray-300 px-3 py-1 text-center text-muted-foreground print:text-gray-600">{idx + 1}</td>
                  <td className="border border-border print:border-gray-300 px-3 py-1 font-medium print:text-black">{row.desc}</td>
                  <td className="border border-border print:border-gray-300 px-3 py-1 text-right font-mono print:text-black">{fmt(row.rate)}</td>
                  <td className="border border-border print:border-gray-300 px-3 py-1 text-right font-mono print:text-black">{row.qty}</td>
                  <td className="border border-border print:border-gray-300 px-3 py-1 text-right font-mono font-semibold print:text-black">{fmt(row.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-emerald-50/50 dark:bg-emerald-950/10 print:bg-green-50 font-semibold">
                <td colSpan={4} className="border border-border print:border-gray-300 px-3 py-1.5 text-right print:text-black">
                  Total Income:
                </td>
                <td className="border border-border print:border-gray-300 px-3 py-1.5 text-right font-mono text-emerald-600 print:text-green-700" data-testid="text-total-income">
                  {fmt(totalIncome)}
                </td>
              </tr>
            </tfoot>
          </table>

          <h3 className="text-sm font-bold mb-2 print:text-black">Expense</h3>
          <table className="w-full text-sm border-collapse mb-6">
            <thead>
              <tr className="bg-muted/50 print:bg-gray-100">
                <th className="border border-border print:border-gray-300 px-3 py-1.5 text-left font-semibold w-10">S.No</th>
                <th className="border border-border print:border-gray-300 px-3 py-1.5 text-left font-semibold">Description</th>
                <th className="border border-border print:border-gray-300 px-3 py-1.5 text-right font-semibold w-20">Rate</th>
                <th className="border border-border print:border-gray-300 px-3 py-1.5 text-right font-semibold w-16">Qty</th>
                <th className="border border-border print:border-gray-300 px-3 py-1.5 text-right font-semibold w-24">Amount</th>
              </tr>
            </thead>
            <tbody>
              {[
                { desc: "Banana", rate: BANANA_RATE, qty: Number(seal.expenseBananaQty), total: bananaTotal },
                { desc: "Dahi Bhar", rate: Number(seal.expenseDahiBharRate), qty: Number(seal.expenseDahiBharQty), total: dahiBharTotal },
              ].filter(row => row.qty > 0 || row.total > 0).map((row, idx) => (
                <tr key={idx}>
                  <td className="border border-border print:border-gray-300 px-3 py-1 text-center text-muted-foreground print:text-gray-600">{idx + 1}</td>
                  <td className="border border-border print:border-gray-300 px-3 py-1 font-medium print:text-black">{row.desc}</td>
                  <td className="border border-border print:border-gray-300 px-3 py-1 text-right font-mono print:text-black">{fmt(row.rate)}</td>
                  <td className="border border-border print:border-gray-300 px-3 py-1 text-right font-mono print:text-black">{row.qty}</td>
                  <td className="border border-border print:border-gray-300 px-3 py-1 text-right font-mono font-semibold print:text-black">{fmt(row.total)}</td>
                </tr>
              ))}
              {otherExpense > 0 && (
                <tr>
                  <td className="border border-border print:border-gray-300 px-3 py-1 text-center text-muted-foreground print:text-gray-600">
                    {[bananaTotal, dahiBharTotal].filter(t => t > 0).length + 1}
                  </td>
                  <td className="border border-border print:border-gray-300 px-3 py-1 font-medium print:text-black">Other Expense</td>
                  <td className="border border-border print:border-gray-300 px-3 py-1 text-right font-mono print:text-black">-</td>
                  <td className="border border-border print:border-gray-300 px-3 py-1 text-right font-mono print:text-black">-</td>
                  <td className="border border-border print:border-gray-300 px-3 py-1 text-right font-mono font-semibold print:text-black">{fmt(otherExpense)}</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-rose-50/50 dark:bg-rose-950/10 print:bg-red-50 font-semibold">
                <td colSpan={4} className="border border-border print:border-gray-300 px-3 py-1.5 text-right print:text-black">
                  Total Expense:
                </td>
                <td className="border border-border print:border-gray-300 px-3 py-1.5 text-right font-mono text-rose-600 print:text-red-700" data-testid="text-total-expense">
                  {fmt(totalExpense)}
                </td>
              </tr>
            </tfoot>
          </table>

          <div className="border-t-2 border-border print:border-gray-400 pt-4">
            <div className="grid grid-cols-2 gap-4 text-sm mb-3">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground print:text-gray-500">Total Income:</span>
                  <span className="font-mono font-semibold text-emerald-600 print:text-green-700">{fmt(totalIncome)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground print:text-gray-500">Total Expense:</span>
                  <span className="font-mono font-semibold text-rose-600 print:text-red-700">{fmt(totalExpense)}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground print:text-gray-500">Balance (Income - Expense):</span>
                  <span className={`font-mono font-bold ${balance >= 0 ? 'text-emerald-600 print:text-green-700' : 'text-red-600 print:text-red-700'}`} data-testid="text-balance">
                    {fmt(balance)}
                  </span>
                </div>
                {givenToAkbarAli > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground print:text-gray-500">Given to Akbar Ali:</span>
                    <span className="font-mono font-semibold text-orange-600 print:text-orange-700" data-testid="text-given-akbar-ali">{fmt(givenToAkbarAli)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className={`rounded-lg p-4 mt-2 text-center ${balance >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/20 print:bg-green-50' : 'bg-red-50 dark:bg-red-950/20 print:bg-red-50'}`}>
              <span className="text-sm text-muted-foreground print:text-gray-500">Net Balance:</span>
              <span className={`ml-3 text-xl font-bold font-mono ${balance >= 0 ? 'text-emerald-600 print:text-green-700' : 'text-red-600 print:text-red-700'}`} data-testid="text-net-balance">
                {fmt(balance)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mt-12 pt-8 border-t print:mt-16">
            <div className="text-center">
              <div className="border-t border-border print:border-gray-400 pt-2 mt-8">
                <p className="text-sm text-muted-foreground print:text-gray-500">Prepared By</p>
              </div>
            </div>
            <div className="text-center">
              <div className="border-t border-border print:border-gray-400 pt-2 mt-8">
                <p className="text-sm text-muted-foreground print:text-gray-500">Authorized Signatory</p>
              </div>
            </div>
          </div>

          <div className="text-center mt-8 text-xs text-muted-foreground print:text-gray-400">
            Generated on {format(new Date(), "dd MMM yyyy, hh:mm a")}
          </div>
        </div>
      </div>
    </Layout>
  );
}
