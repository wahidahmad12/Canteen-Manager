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
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
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
  const totalAmount = allItems.reduce((sum: number, item: any) => sum + Number(item.totalPrice), 0);
  const totalGst = allItems.reduce((sum: number, item: any) => sum + Number(item.gstAmount), 0);
  const grandTotal = allItems.reduce((sum: number, item: any) => sum + Number(item.netAmount), 0);

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
          <div className="text-center mb-8 border-b pb-6">
            <h1 className="text-2xl font-bold text-foreground print:text-black">DJ Hospitality & Facility Management Pvt Ltd</h1>
            <p className="text-sm text-muted-foreground print:text-gray-600 mt-1">Purchase Invoice</p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
            <div>
              <span className="text-muted-foreground print:text-gray-500">Invoice No:</span>
              <span className="ml-2 font-semibold print:text-black">#{inv.serialNumber}</span>
            </div>
            <div className="text-right">
              <span className="text-muted-foreground print:text-gray-500">Date:</span>
              <span className="ml-2 font-semibold print:text-black">{format(new Date(inv.date), "dd MMM yyyy")}</span>
            </div>
            <div>
              <span className="text-muted-foreground print:text-gray-500">Client Name:</span>
              <span className="ml-2 font-semibold print:text-black">{inv.clientName}</span>
            </div>
            <div className="text-right">
              <span className="text-muted-foreground print:text-gray-500">Vendor:</span>
              <span className="ml-2 font-semibold print:text-black">{inv.vendorName}</span>
            </div>
            {inv.vendorInvoiceNo && (
              <div>
                <span className="text-muted-foreground print:text-gray-500">Vendor Invoice No:</span>
                <span className="ml-2 font-semibold print:text-black">{inv.vendorInvoiceNo}</span>
              </div>
            )}
            <div className={inv.vendorInvoiceNo ? "text-right" : ""}>
              <span className="text-muted-foreground print:text-gray-500">Payment:</span>
              <span className={`ml-2 font-semibold ${inv.paymentGiven ? 'text-green-600 print:text-green-700' : 'text-red-600 print:text-red-700'}`}>
                {inv.paymentGiven ? 'Paid' : 'Unpaid'}
              </span>
            </div>
          </div>

          <table className="w-full text-sm border-collapse mb-6">
            <thead>
              <tr className="bg-muted/50 print:bg-gray-100">
                <th className="border border-border print:border-gray-300 px-3 py-2 text-left font-semibold w-10">S.No</th>
                <th className="border border-border print:border-gray-300 px-3 py-2 text-left font-semibold">Item Name</th>
                <th className="border border-border print:border-gray-300 px-3 py-2 text-center font-semibold w-16">UOM</th>
                <th className="border border-border print:border-gray-300 px-3 py-2 text-right font-semibold w-16">Qty</th>
                <th className="border border-border print:border-gray-300 px-3 py-2 text-right font-semibold w-20">Unit Price</th>
                <th className="border border-border print:border-gray-300 px-3 py-2 text-right font-semibold w-24">Total Price</th>
                <th className="border border-border print:border-gray-300 px-3 py-2 text-center font-semibold w-16">GST %</th>
                <th className="border border-border print:border-gray-300 px-3 py-2 text-right font-semibold w-20">GST Amt</th>
                <th className="border border-border print:border-gray-300 px-3 py-2 text-right font-semibold w-24">Net Amt</th>
              </tr>
            </thead>
            <tbody>
              {allItems.map((item: any, index: number) => (
                <tr key={item.id || index}>
                  <td className="border border-border print:border-gray-300 px-3 py-2 text-center text-muted-foreground">{index + 1}</td>
                  <td className="border border-border print:border-gray-300 px-3 py-2 font-medium print:text-black">{item.itemName}</td>
                  <td className="border border-border print:border-gray-300 px-3 py-2 text-center">{item.uom}</td>
                  <td className="border border-border print:border-gray-300 px-3 py-2 text-right font-mono">{Number(item.qty)}</td>
                  <td className="border border-border print:border-gray-300 px-3 py-2 text-right font-mono">{Number(item.unitPrice).toFixed(2)}</td>
                  <td className="border border-border print:border-gray-300 px-3 py-2 text-right font-mono">{Number(item.totalPrice).toFixed(2)}</td>
                  <td className="border border-border print:border-gray-300 px-3 py-2 text-center">{Number(item.gstRate)}%</td>
                  <td className="border border-border print:border-gray-300 px-3 py-2 text-right font-mono">{Number(item.gstAmount).toFixed(2)}</td>
                  <td className="border border-border print:border-gray-300 px-3 py-2 text-right font-mono font-semibold">{Number(item.netAmount).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted/30 print:bg-gray-50 font-semibold">
                <td colSpan={5} className="border border-border print:border-gray-300 px-3 py-2 text-right">
                  Totals:
                </td>
                <td className="border border-border print:border-gray-300 px-3 py-2 text-right font-mono">
                  {totalAmount.toFixed(2)}
                </td>
                <td className="border border-border print:border-gray-300 px-3 py-2"></td>
                <td className="border border-border print:border-gray-300 px-3 py-2 text-right font-mono">
                  {totalGst.toFixed(2)}
                </td>
                <td className="border border-border print:border-gray-300 px-3 py-2 text-right font-mono text-primary print:text-black">
                  {grandTotal.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>

          <div className="bg-muted/30 print:bg-gray-50 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground print:text-gray-500">Sub Total:</span>
                <span className="ml-2 font-semibold font-mono print:text-black">{totalAmount.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-muted-foreground print:text-gray-500">GST Total:</span>
                <span className="ml-2 font-semibold font-mono print:text-black">{totalGst.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-muted-foreground print:text-gray-500">Grand Total:</span>
                <span className="ml-2 font-bold font-mono text-primary print:text-black">{grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mt-12 pt-8 border-t print:mt-16">
            <div className="text-center">
              {inv.createdBy && (
                <p className="font-semibold text-sm print:text-black mb-1">{inv.createdBy}</p>
              )}
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
