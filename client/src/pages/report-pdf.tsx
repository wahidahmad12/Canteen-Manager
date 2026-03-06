import { useRoute } from "wouter";
import { useReport, useCurrentUser } from "@/hooks/use-reports";
import { format } from "date-fns";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, FileDown } from "lucide-react";
import { useLocation } from "wouter";

export default function ReportPDF() {
  const [, params] = useRoute("/report/:id/pdf");
  const id = params?.id ? Number(params.id) : null;
  const { data: report, isLoading } = useReport(id);
  const { data: user } = useCurrentUser();
  const [, navigate] = useLocation();

  const handlePrint = () => {
    const originalTitle = document.title;
    if (report) {
      const dateStr = format(new Date(report.date), "dd-MM-yyyy");
      document.title = `DJ KPF Daily Cash Expance Report ${report.reportNumber} ${dateStr}`;
    }
    window.print();
    document.title = originalTitle;
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      </Layout>
    );
  }

  if (!report) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Report not found</p>
          <Button variant="ghost" onClick={() => navigate("/")} className="mt-4">
            Back to Dashboard
          </Button>
        </div>
      </Layout>
    );
  }

  const allItems = report.items || [];
  const fixedItems = allItems.filter((item) => item.category === "fixed");
  const vegetableItems = allItems.filter((item) => item.category === "vegetable");
  const otherItems = allItems.filter((item) => item.category === "other");

  const totalFixedCost = fixedItems.reduce((sum, item) => sum + Number(item.amount), 0);
  const totalVegCost = vegetableItems.reduce((sum, item) => sum + Number(item.amount), 0);
  const totalOtherCost = otherItems.reduce((sum, item) => sum + Number(item.amount), 0);
  const grandTotalExpense = totalFixedCost + totalVegCost + totalOtherCost;

  const openingBalance = Number(report.openingBalance) || 0;
  const receivedAmount = Number(report.receivedAmount) || 0;
  const totalCash = openingBalance + receivedAmount;
  const balanceInHand = totalCash - grandTotalExpense;

  const fmt = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const renderMobileItems = (items: typeof allItems, colorClass: string) => {
    if (items.length === 0) return null;
    return (
      <div className="sm:hidden space-y-2">
        {items.map((item, index) => {
          const amt = Number(item.amount);
          if (amt === 0) return null;
          return (
            <div key={item.id || index} className="flex items-center justify-between py-1.5 border-b border-dashed border-border/60 last:border-0">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className={`w-5 h-5 rounded-full ${colorClass} text-white text-[9px] flex items-center justify-center font-bold shrink-0`}>{index + 1}</span>
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate print:text-black">{item.description}</p>
                  <p className="text-[10px] text-muted-foreground print:text-gray-500">{Number(item.qty)} {item.uom} x {fmt(Number(item.rate))}</p>
                </div>
              </div>
              <span className="text-xs font-bold font-mono ml-2 shrink-0 print:text-black">{fmt(amt)}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const renderDesktopTable = (items: typeof allItems, startIndex: number) => {
    if (items.length === 0) return null;
    return (
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50 dark:bg-muted/50 print:bg-gray-100">
              <th className="border border-border print:border-gray-300 px-2 py-1.5 text-center font-semibold">#</th>
              <th className="border border-border print:border-gray-300 px-2 py-1.5 text-left font-semibold">Description</th>
              <th className="border border-border print:border-gray-300 px-2 py-1.5 text-center font-semibold">UoM</th>
              <th className="border border-border print:border-gray-300 px-2 py-1.5 text-right font-semibold">Qty</th>
              <th className="border border-border print:border-gray-300 px-2 py-1.5 text-right font-semibold">Rate</th>
              <th className="border border-border print:border-gray-300 px-2 py-1.5 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={item.id || index} className="hover:bg-gray-50/50 dark:hover:bg-muted/20">
                <td className="border border-border print:border-gray-300 px-2 py-1 text-center text-muted-foreground print:text-gray-600 text-xs">{startIndex + index + 1}</td>
                <td className="border border-border print:border-gray-300 px-2 py-1 font-medium print:text-black text-xs">{item.description}</td>
                <td className="border border-border print:border-gray-300 px-2 py-1 text-center print:text-gray-700 text-xs">{item.uom}</td>
                <td className="border border-border print:border-gray-300 px-2 py-1 text-right font-mono print:text-black text-xs">{Number(item.qty)}</td>
                <td className="border border-border print:border-gray-300 px-2 py-1 text-right font-mono print:text-black text-xs">{fmt(Number(item.rate))}</td>
                <td className="border border-border print:border-gray-300 px-2 py-1 text-right font-mono font-semibold print:text-black text-xs">{fmt(Number(item.amount))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 dark:bg-muted/30 print:bg-gray-50 font-semibold">
              <td colSpan={5} className="border border-border print:border-gray-300 px-2 py-1.5 text-right print:text-black text-xs">Sub Total:</td>
              <td className="border border-border print:border-gray-300 px-2 py-1.5 text-right font-mono print:text-black text-xs">
                {fmt(items.reduce((sum, item) => sum + Number(item.amount), 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  };

  const renderSection = (items: typeof allItems, title: string, startIndex: number, gradientFrom: string, gradientTo: string, colorClass: string) => {
    if (items.length === 0) return null;
    const sectionTotal = items.reduce((sum, item) => sum + Number(item.amount), 0);
    return (
      <div className="mb-5">
        <div className={`flex items-center justify-between mb-2 pb-1.5 border-b-2 ${gradientFrom}`}>
          <h3 className="text-sm font-bold print:text-black">{title}</h3>
          <span className={`text-xs font-bold font-mono sm:hidden ${gradientTo}`}>{fmt(sectionTotal)}</span>
        </div>
        {renderMobileItems(items, colorClass)}
        {renderDesktopTable(items, startIndex)}
      </div>
    );
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-1 sm:px-0">
        <div className="flex items-center justify-between mb-4 sm:mb-6 print:hidden">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/report/${id}`)} data-testid="button-back-report">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <Button size="sm" onClick={handlePrint} className="bg-gradient-to-r from-indigo-500 to-purple-600 border-0 text-white shadow-md" data-testid="button-convert-pdf">
            <FileDown className="w-4 h-4 mr-1" /> Convert to PDF
          </Button>
        </div>

        <div className="bg-white dark:bg-card border rounded-xl p-4 sm:p-8 print:border-0 print:shadow-none print:p-0" id="pdf-content">
          <div className="text-center mb-5 sm:mb-6 pb-4 border-b-2 border-indigo-200 dark:border-indigo-800 print:border-gray-300">
            <h1 className="text-lg sm:text-2xl font-bold text-foreground print:text-black leading-tight">DJ Hospitality & Facility Management Pvt Ltd</h1>
            <p className="text-xs sm:text-sm font-semibold text-indigo-600 dark:text-indigo-400 print:text-gray-600 mt-1 uppercase tracking-wider">Daily Cash Expance Report</p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 mb-4 sm:mb-6 text-xs sm:text-sm">
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground print:text-gray-500">Report No:</span>
              <span className="font-bold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded print:bg-gray-100 print:text-black" data-testid="text-report-number">#{report.reportNumber}</span>
            </div>
            <div>
              <span className="text-muted-foreground print:text-gray-500">Date: </span>
              <span className="font-semibold print:text-black" data-testid="text-report-date">{format(new Date(report.date), "dd MMM yyyy, EEEE")}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-5 sm:mb-6">
            <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-2.5 sm:p-4 text-center print:bg-gray-50 print:border print:border-gray-200">
              <p className="text-[10px] sm:text-xs text-muted-foreground print:text-gray-500 uppercase tracking-wide font-semibold mb-1">Opening Bal.</p>
              <p className="text-sm sm:text-lg font-bold font-mono print:text-black" data-testid="text-opening-balance">{fmt(openingBalance)}</p>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-lg p-2.5 sm:p-4 text-center print:bg-gray-50 print:border print:border-gray-200">
              <p className="text-[10px] sm:text-xs text-muted-foreground print:text-gray-500 uppercase tracking-wide font-semibold mb-1">Received</p>
              <p className="text-sm sm:text-lg font-bold font-mono text-emerald-600 print:text-black" data-testid="text-received-amount">{fmt(receivedAmount)}</p>
            </div>
            <div className="bg-indigo-50 dark:bg-indigo-950/20 rounded-lg p-2.5 sm:p-4 text-center print:bg-gray-50 print:border print:border-gray-200">
              <p className="text-[10px] sm:text-xs text-muted-foreground print:text-gray-500 uppercase tracking-wide font-semibold mb-1">Total Cash</p>
              <p className="text-sm sm:text-lg font-bold font-mono text-indigo-600 print:text-black" data-testid="text-total-cash">{fmt(totalCash)}</p>
            </div>
          </div>

          {renderSection(fixedItems, "Fixed Items", 0, "border-amber-300 dark:border-amber-700 print:border-gray-400", "text-amber-700 dark:text-amber-400", "bg-amber-500")}
          {renderSection(vegetableItems, "Vegetable Purchase", fixedItems.length, "border-emerald-300 dark:border-emerald-700 print:border-gray-400", "text-emerald-700 dark:text-emerald-400", "bg-emerald-500")}
          {renderSection(otherItems, "Other Item Purchase", fixedItems.length + vegetableItems.length, "border-purple-300 dark:border-purple-700 print:border-gray-400", "text-purple-700 dark:text-purple-400", "bg-purple-500")}

          <div className="border-t-2 border-gray-300 dark:border-gray-600 print:border-gray-400 mt-4 pt-4">
            <div className="space-y-2 text-xs sm:text-sm mb-4">
              {fixedItems.length > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground print:text-gray-500">Fixed Items Total</span>
                  <span className="font-mono font-semibold print:text-black">{fmt(totalFixedCost)}</span>
                </div>
              )}
              {vegetableItems.length > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground print:text-gray-500">Vegetable Purchase Total</span>
                  <span className="font-mono font-semibold print:text-black">{fmt(totalVegCost)}</span>
                </div>
              )}
              {otherItems.length > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground print:text-gray-500">Other Item Purchase Total</span>
                  <span className="font-mono font-semibold print:text-black">{fmt(totalOtherCost)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-dashed border-border print:border-gray-300">
                <span className="font-semibold print:text-black">Grand Total Expense</span>
                <span className="font-mono font-bold text-rose-600 print:text-red-700 text-sm sm:text-base" data-testid="text-grand-total-expense">{fmt(grandTotalExpense)}</span>
              </div>
            </div>

            <div className={`rounded-xl p-4 sm:p-5 text-center ${balanceInHand < 0 ? 'bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30 border border-red-200 dark:border-red-800 print:bg-red-50 print:border-red-200' : 'bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 border border-emerald-200 dark:border-emerald-800 print:bg-green-50 print:border-green-200'}`}>
              <p className="text-xs text-muted-foreground print:text-gray-500 uppercase tracking-wider font-semibold mb-1">Balance in Hand</p>
              <p className={`text-2xl sm:text-3xl font-bold font-mono ${balanceInHand < 0 ? 'text-red-600 print:text-red-700' : 'text-emerald-600 print:text-green-700'}`} data-testid="text-balance-in-hand">
                {fmt(balanceInHand)}
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
