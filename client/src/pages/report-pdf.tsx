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
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
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

  const renderItemTable = (items: typeof allItems, title: string, startIndex: number) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-4">
        <h3 className="text-sm font-bold mb-1 print:text-black">{title}</h3>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted/50 print:bg-gray-100">
              <th className="border border-border print:border-gray-300 px-2 py-1.5 text-left font-semibold w-10">S.No</th>
              <th className="border border-border print:border-gray-300 px-2 py-1.5 text-left font-semibold">Description</th>
              <th className="border border-border print:border-gray-300 px-2 py-1.5 text-center font-semibold w-14">UoM</th>
              <th className="border border-border print:border-gray-300 px-2 py-1.5 text-right font-semibold w-16">Qty</th>
              <th className="border border-border print:border-gray-300 px-2 py-1.5 text-right font-semibold w-20">Rate</th>
              <th className="border border-border print:border-gray-300 px-2 py-1.5 text-right font-semibold w-24">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={item.id || index}>
                <td className="border border-border print:border-gray-300 px-2 py-1 text-center text-muted-foreground print:text-gray-600">{startIndex + index + 1}</td>
                <td className="border border-border print:border-gray-300 px-2 py-1 font-medium print:text-black">{item.description}</td>
                <td className="border border-border print:border-gray-300 px-2 py-1 text-center print:text-gray-700">{item.uom}</td>
                <td className="border border-border print:border-gray-300 px-2 py-1 text-right font-mono print:text-black">{Number(item.qty)}</td>
                <td className="border border-border print:border-gray-300 px-2 py-1 text-right font-mono print:text-black">{Number(item.rate).toFixed(2)}</td>
                <td className="border border-border print:border-gray-300 px-2 py-1 text-right font-mono font-semibold print:text-black">{Number(item.amount).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-muted/30 print:bg-gray-50 font-semibold">
              <td colSpan={5} className="border border-border print:border-gray-300 px-2 py-1.5 text-right print:text-black">
                Sub Total:
              </td>
              <td className="border border-border print:border-gray-300 px-2 py-1.5 text-right font-mono print:text-black">
                {items.reduce((sum, item) => sum + Number(item.amount), 0).toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6 print:hidden">
          <Button variant="ghost" onClick={() => navigate(`/report/${id}`)} data-testid="button-back-report">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Report
          </Button>
          <Button onClick={handlePrint} data-testid="button-convert-pdf">
            <FileDown className="w-4 h-4 mr-2" /> Convert to PDF
          </Button>
        </div>

        <div className="bg-white dark:bg-card border rounded-xl p-6 sm:p-8 print:border-0 print:shadow-none print:p-0" id="pdf-content">
          <div className="text-center mb-6 border-b pb-4">
            <h1 className="text-2xl font-bold text-foreground print:text-black">DJ Hospitality & Facility Management Pvt Ltd</h1>
            <p className="text-sm text-muted-foreground print:text-gray-600 mt-1">Daily Cash Expance Report</p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
            <div>
              <span className="text-muted-foreground print:text-gray-500">Report No:</span>
              <span className="ml-2 font-semibold print:text-black" data-testid="text-report-number">#{report.reportNumber}</span>
            </div>
            <div className="text-right">
              <span className="text-muted-foreground print:text-gray-500">Date:</span>
              <span className="ml-2 font-semibold print:text-black" data-testid="text-report-date">{format(new Date(report.date), "dd MMM yyyy, EEEE")}</span>
            </div>
          </div>

          <div className="bg-muted/30 print:bg-gray-50 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground print:text-gray-500">Opening Balance:</span>
                <span className="ml-2 font-semibold font-mono print:text-black" data-testid="text-opening-balance">{openingBalance.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-muted-foreground print:text-gray-500">Received Amount:</span>
                <span className="ml-2 font-semibold font-mono print:text-black" data-testid="text-received-amount">{receivedAmount.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-muted-foreground print:text-gray-500">Total Cash:</span>
                <span className="ml-2 font-bold font-mono text-foreground print:text-black" data-testid="text-total-cash">{totalCash.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {renderItemTable(fixedItems, "Fixed Items", 0)}
          {renderItemTable(vegetableItems, "Vegetable Purchase", fixedItems.length)}
          {renderItemTable(otherItems, "Other Item Purchase", fixedItems.length + vegetableItems.length)}

          <div className="border-t-2 border-border print:border-gray-400 mt-6 pt-4">
            <div className="grid grid-cols-2 gap-4 text-sm mb-3">
              <div className="space-y-2">
                {fixedItems.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground print:text-gray-500">Fixed Items Total:</span>
                    <span className="font-mono font-semibold print:text-black">{totalFixedCost.toFixed(2)}</span>
                  </div>
                )}
                {vegetableItems.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground print:text-gray-500">Vegetable Purchase Total:</span>
                    <span className="font-mono font-semibold print:text-black">{totalVegCost.toFixed(2)}</span>
                  </div>
                )}
                {otherItems.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground print:text-gray-500">Other Item Purchase Total:</span>
                    <span className="font-mono font-semibold print:text-black">{totalOtherCost.toFixed(2)}</span>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground print:text-gray-500">Total Cash:</span>
                  <span className="font-mono font-semibold print:text-black">{totalCash.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground print:text-gray-500">Grand Total Expense:</span>
                  <span className="font-mono font-semibold text-rose-600 print:text-red-700" data-testid="text-grand-total-expense">{grandTotalExpense.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className={`rounded-lg p-4 mt-2 text-center ${balanceInHand < 0 ? 'bg-red-50 dark:bg-red-950/20 print:bg-red-50' : 'bg-emerald-50 dark:bg-emerald-950/20 print:bg-green-50'}`}>
              <span className="text-sm text-muted-foreground print:text-gray-500">Balance in Hand:</span>
              <span className={`ml-3 text-xl font-bold font-mono ${balanceInHand < 0 ? 'text-red-600 print:text-red-700' : 'text-emerald-600 print:text-green-700'}`} data-testid="text-balance-in-hand">
                {balanceInHand.toFixed(2)}
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
