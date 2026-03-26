import { useRoute } from "wouter";
import { usePurchaseInvoice, useCurrentUser } from "@/hooks/use-reports";
import { format } from "date-fns";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, FileDown } from "lucide-react";
import { useLocation } from "wouter";

export default function PurchaseInvoicePDF() {
  const [, params] = useRoute("/purchase-invoice/:id/pdf");
  const id = params?.id ? Number(params.id) : null;
  const { data: inv, isLoading } = usePurchaseInvoice(id);
  const { data: user } = useCurrentUser();
  const [, navigate] = useLocation();

  const handlePrint = () => {
    const originalTitle = document.title;
    if (inv) {
      const dateStr = format(new Date(inv.date), "dd-MM-yyyy");
      document.title = `DJ Hospitality Purchase Invoice for ${inv.clientName} ${inv.serialNumber} ${dateStr}`;
    }
    window.print();
    document.title = originalTitle;
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      </Layout>
    );
  }

  if (!inv) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Invoice not found</p>
          <Button variant="ghost" onClick={() => navigate("/")} className="mt-4">
            Back to Dashboard
          </Button>
        </div>
      </Layout>
    );
  }

  const allItems = inv.items || [];
  const payments = (inv as any).payments || [];
  const totalAmount = allItems.reduce((sum: number, item: any) => sum + Number(item.totalPrice), 0);
  const totalGst = allItems.reduce((sum: number, item: any) => sum + Number(item.gstAmount), 0);
  const grandTotal = allItems.reduce((sum: number, item: any) => sum + Number(item.netAmount), 0);
  const totalPaid = payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
  const balance = grandTotal - totalPaid;

  const fmt = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-1 sm:px-0">
        <div className="flex items-center justify-between mb-4 sm:mb-6 print:hidden">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} data-testid="button-back-dashboard">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <Button size="sm" onClick={handlePrint} className="bg-gradient-to-r from-blue-500 to-indigo-600 border-0 text-white shadow-md" data-testid="button-convert-pdf">
            <FileDown className="w-4 h-4 mr-1" /> Convert to PDF
          </Button>
        </div>

        <div className="bg-white dark:bg-card border rounded-xl p-4 sm:p-8 print:border-0 print:shadow-none print:p-0" id="pdf-content">
          <div className="text-center mb-5 sm:mb-6 pb-4 border-b-2 border-blue-200 dark:border-blue-800 print:border-gray-300">
            <h1 className="text-lg sm:text-2xl font-bold text-foreground print:text-black leading-tight">DJ Hospitality & Facility Management Pvt Ltd</h1>
            <p className="text-xs sm:text-sm font-semibold text-blue-600 dark:text-blue-400 print:text-gray-600 mt-1 uppercase tracking-wider">Purchase Invoice</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mb-5 text-xs sm:text-sm">
            <div className="flex justify-between sm:justify-start gap-1">
              <span className="text-muted-foreground print:text-gray-500">Invoice No:</span>
              <span className="font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded print:bg-gray-100 print:text-black">#{inv.serialNumber}</span>
            </div>
            <div className="flex justify-between sm:justify-end gap-1">
              <span className="text-muted-foreground print:text-gray-500">Date:</span>
              <span className="font-semibold print:text-black">{format(new Date(inv.date), "dd-MM-yyyy")}</span>
            </div>
            <div className="flex justify-between sm:justify-start gap-1">
              <span className="text-muted-foreground print:text-gray-500">Client:</span>
              <span className="font-semibold print:text-black">{inv.clientName}</span>
            </div>
            <div className="flex justify-between sm:justify-end gap-1">
              <span className="text-muted-foreground print:text-gray-500">Vendor:</span>
              <span className="font-semibold print:text-black">{inv.vendorName}</span>
            </div>
            {inv.vendorInvoiceNo && (
              <div className="flex justify-between sm:justify-start gap-1">
                <span className="text-muted-foreground print:text-gray-500">Vendor Inv No:</span>
                <span className="font-semibold print:text-black">{inv.vendorInvoiceNo}</span>
              </div>
            )}
            <div className={`flex justify-between ${inv.vendorInvoiceNo ? 'sm:justify-end' : 'sm:justify-start'} gap-1`}>
              <span className="text-muted-foreground print:text-gray-500">Payment Status:</span>
              <span className={`font-bold px-2 py-0.5 rounded text-xs ${balance <= 0 && grandTotal > 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 print:text-green-700' : totalPaid > 0 ? 'bg-amber-100 text-amber-700 print:text-amber-700' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 print:text-red-700'}`}>
                {balance <= 0 && grandTotal > 0 ? 'FULLY PAID' : totalPaid > 0 ? 'PARTIAL' : 'UNPAID'}
              </span>
            </div>
          </div>

          <div className="sm:hidden space-y-2 mb-4">
            {allItems.map((item: any, index: number) => (
              <div key={item.id || index} className="border border-border/60 rounded-lg p-2.5 print:border-gray-300">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span className="w-5 h-5 rounded-full bg-blue-500 text-white text-[9px] flex items-center justify-center font-bold shrink-0">{index + 1}</span>
                    <p className="text-xs font-medium truncate print:text-black">{item.itemName}</p>
                  </div>
                  <span className="text-xs font-bold font-mono shrink-0 print:text-black">{fmt(Number(item.netAmount))}</span>
                </div>
                <div className="grid grid-cols-4 gap-1 text-[10px] text-muted-foreground print:text-gray-500">
                  <span>{Number(item.qty)} {item.uom}</span>
                  <span>@{fmt(Number(item.unitPrice))}</span>
                  <span>GST {Number(item.gstRate)}%</span>
                  <span className="text-right">+{fmt(Number(item.gstAmount))}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden sm:block overflow-x-auto mb-4">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-muted/50 print:bg-gray-100">
                  <th className="border border-border print:border-gray-300 px-2 py-1.5 text-center font-semibold">#</th>
                  <th className="border border-border print:border-gray-300 px-2 py-1.5 text-left font-semibold">Item Name</th>
                  <th className="border border-border print:border-gray-300 px-2 py-1.5 text-center font-semibold">UOM</th>
                  <th className="border border-border print:border-gray-300 px-2 py-1.5 text-right font-semibold">Qty</th>
                  <th className="border border-border print:border-gray-300 px-2 py-1.5 text-right font-semibold">Unit Price</th>
                  <th className="border border-border print:border-gray-300 px-2 py-1.5 text-right font-semibold">Total</th>
                  <th className="border border-border print:border-gray-300 px-2 py-1.5 text-center font-semibold">GST%</th>
                  <th className="border border-border print:border-gray-300 px-2 py-1.5 text-right font-semibold">GST Amt</th>
                  <th className="border border-border print:border-gray-300 px-2 py-1.5 text-right font-semibold">Net Amt</th>
                </tr>
              </thead>
              <tbody>
                {allItems.map((item: any, index: number) => (
                  <tr key={item.id || index}>
                    <td className="border border-border print:border-gray-300 px-2 py-1 text-center text-muted-foreground print:text-gray-600">{index + 1}</td>
                    <td className="border border-border print:border-gray-300 px-2 py-1 font-medium print:text-black">{item.itemName}</td>
                    <td className="border border-border print:border-gray-300 px-2 py-1 text-center print:text-gray-700">{item.uom}</td>
                    <td className="border border-border print:border-gray-300 px-2 py-1 text-right font-mono print:text-black">{Number(item.qty)}</td>
                    <td className="border border-border print:border-gray-300 px-2 py-1 text-right font-mono print:text-black">{fmt(Number(item.unitPrice))}</td>
                    <td className="border border-border print:border-gray-300 px-2 py-1 text-right font-mono print:text-black">{fmt(Number(item.totalPrice))}</td>
                    <td className="border border-border print:border-gray-300 px-2 py-1 text-center print:text-gray-700">{Number(item.gstRate)}%</td>
                    <td className="border border-border print:border-gray-300 px-2 py-1 text-right font-mono print:text-black">{fmt(Number(item.gstAmount))}</td>
                    <td className="border border-border print:border-gray-300 px-2 py-1 text-right font-mono font-semibold print:text-black">{fmt(Number(item.netAmount))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 dark:bg-muted/30 print:bg-gray-50 font-semibold">
                  <td colSpan={5} className="border border-border print:border-gray-300 px-2 py-1.5 text-right print:text-black">Totals:</td>
                  <td className="border border-border print:border-gray-300 px-2 py-1.5 text-right font-mono print:text-black">{fmt(totalAmount)}</td>
                  <td className="border border-border print:border-gray-300 px-2 py-1.5"></td>
                  <td className="border border-border print:border-gray-300 px-2 py-1.5 text-right font-mono print:text-black">{fmt(totalGst)}</td>
                  <td className="border border-border print:border-gray-300 px-2 py-1.5 text-right font-mono print:text-black">{fmt(grandTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4">
            <div className="bg-gray-50 dark:bg-muted/30 rounded-lg p-2.5 sm:p-4 text-center print:bg-gray-50 print:border print:border-gray-200">
              <p className="text-[10px] sm:text-xs text-muted-foreground print:text-gray-500 uppercase tracking-wide font-semibold mb-1">Sub Total</p>
              <p className="text-xs sm:text-lg font-bold font-mono print:text-black">{fmt(totalAmount)}</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-2.5 sm:p-4 text-center print:bg-gray-50 print:border print:border-gray-200">
              <p className="text-[10px] sm:text-xs text-muted-foreground print:text-gray-500 uppercase tracking-wide font-semibold mb-1">GST Total</p>
              <p className="text-xs sm:text-lg font-bold font-mono text-amber-600 print:text-black">{fmt(totalGst)}</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-2.5 sm:p-4 text-center print:bg-gray-50 print:border print:border-gray-200">
              <p className="text-[10px] sm:text-xs text-muted-foreground print:text-gray-500 uppercase tracking-wide font-semibold mb-1">Grand Total</p>
              <p className="text-xs sm:text-lg font-bold font-mono text-blue-600 print:text-black">{fmt(grandTotal)}</p>
            </div>
          </div>

          {/* Payment Details Section */}
          <div className="mb-4 border border-border print:border-gray-300 rounded-lg overflow-hidden">
            <div className="bg-slate-100 dark:bg-slate-800 print:bg-gray-100 px-3 py-2 border-b border-border print:border-gray-300">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300 print:text-gray-700">Payment Details</p>
            </div>
            {payments.length === 0 ? (
              <div className="px-3 py-3 text-xs text-muted-foreground print:text-gray-500 text-center italic">No payments recorded</div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 dark:bg-muted/30 print:bg-gray-50">
                    <th className="text-left px-3 py-1.5 font-semibold text-muted-foreground print:text-gray-600 border-b border-border print:border-gray-300">#</th>
                    <th className="text-left px-3 py-1.5 font-semibold text-muted-foreground print:text-gray-600 border-b border-border print:border-gray-300">Payment Date</th>
                    <th className="text-right px-3 py-1.5 font-semibold text-muted-foreground print:text-gray-600 border-b border-border print:border-gray-300">Amount (₹)</th>
                    <th className="text-left px-3 py-1.5 font-semibold text-muted-foreground print:text-gray-600 border-b border-border print:border-gray-300">Notes / UTR</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p: any, idx: number) => (
                    <tr key={p.id} className="border-b border-border/50 print:border-gray-200 last:border-0">
                      <td className="px-3 py-1.5 text-muted-foreground print:text-gray-500">{idx + 1}</td>
                      <td className="px-3 py-1.5 font-medium print:text-black">{format(new Date(p.paymentDate), "dd-MM-yyyy")}</td>
                      <td className="px-3 py-1.5 text-right font-mono font-semibold text-emerald-700 dark:text-emerald-400 print:text-black">{fmt(Number(p.amount))}</td>
                      <td className="px-3 py-1.5 text-muted-foreground print:text-gray-600">{p.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 dark:bg-muted/30 print:bg-gray-50 font-semibold border-t-2 border-border print:border-gray-300">
                    <td colSpan={2} className="px-3 py-1.5 text-right text-muted-foreground print:text-gray-600">Total Paid:</td>
                    <td className="px-3 py-1.5 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400 print:text-green-700">{fmt(totalPaid)}</td>
                    <td className="px-3 py-1.5"></td>
                  </tr>
                  {balance > 0.01 && (
                    <tr className="font-semibold">
                      <td colSpan={2} className="px-3 py-1.5 text-right text-muted-foreground print:text-gray-600">Balance Due:</td>
                      <td className="px-3 py-1.5 text-right font-mono font-bold text-red-600 dark:text-red-400 print:text-red-700">{fmt(balance)}</td>
                      <td className="px-3 py-1.5"></td>
                    </tr>
                  )}
                </tfoot>
              </table>
            )}
          </div>

          <div className="grid grid-cols-2 gap-6 sm:gap-8 mt-10 sm:mt-12 pt-6 sm:pt-8 border-t print:mt-16">
            <div className="text-center">
              {inv.createdBy && (
                <p className="font-semibold text-xs sm:text-sm print:text-black mb-1">{inv.createdBy}</p>
              )}
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
            Generated on {format(new Date(), "dd-MM-yyyy, hh:mm a")}
          </div>
        </div>
      </div>
    </Layout>
  );
}
