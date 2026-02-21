import { useRoute } from "wouter";
import { usePurchaseRequest, useCurrentUser } from "@/hooks/use-reports";
import { format } from "date-fns";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, FileDown } from "lucide-react";
import { useLocation } from "wouter";

export default function PurchaseRequestPDF() {
  const [, params] = useRoute("/purchase-request/:id/pdf");
  const id = params?.id ? Number(params.id) : null;
  const { data: pr, isLoading } = usePurchaseRequest(id);
  const { data: user } = useCurrentUser();
  const [, navigate] = useLocation();

  const handlePrint = () => {
    window.print();
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

  if (!pr) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Purchase request not found</p>
          <Button variant="ghost" onClick={() => navigate("/")} className="mt-4">
            Back to Dashboard
          </Button>
        </div>
      </Layout>
    );
  }

  const approvedItems = pr.items?.filter((item: any) => item.approved) || [];
  const allItems = pr.items || [];

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
            <p className="text-sm text-muted-foreground print:text-gray-600 mt-1">Purchase Request</p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
            <div>
              <span className="text-muted-foreground print:text-gray-500">Serial No:</span>
              <span className="ml-2 font-semibold print:text-black">#{pr.serialNumber}</span>
            </div>
            <div className="text-right">
              <span className="text-muted-foreground print:text-gray-500">Date:</span>
              <span className="ml-2 font-semibold print:text-black">{format(new Date(pr.date), "dd MMM yyyy")}</span>
            </div>
            <div>
              <span className="text-muted-foreground print:text-gray-500">Client Name:</span>
              <span className="ml-2 font-semibold print:text-black">{pr.clientName}</span>
            </div>
            <div className="text-right">
              <span className="text-muted-foreground print:text-gray-500">Status:</span>
              <span className={`ml-2 font-semibold ${
                pr.status === 'approved' ? 'text-green-600' :
                pr.status === 'rejected' ? 'text-red-600' :
                'text-yellow-600'
              }`}>
                {pr.status === 'approved' ? 'APPROVED' : pr.status === 'rejected' ? 'REJECTED' : 'PENDING'}
              </span>
            </div>
          </div>

          <table className="w-full text-sm border-collapse mb-6">
            <thead>
              <tr className="bg-muted/50 print:bg-gray-100">
                <th className="border border-border print:border-gray-300 px-3 py-2 text-left font-semibold w-12">S.No</th>
                <th className="border border-border print:border-gray-300 px-3 py-2 text-left font-semibold">Item Name</th>
                <th className="border border-border print:border-gray-300 px-3 py-2 text-center font-semibold w-20">UOM</th>
                <th className="border border-border print:border-gray-300 px-3 py-2 text-right font-semibold w-20">Qty</th>
                <th className="border border-border print:border-gray-300 px-3 py-2 text-right font-semibold w-24">Req Qty</th>
                <th className="border border-border print:border-gray-300 px-3 py-2 text-center font-semibold w-24">Approved</th>
              </tr>
            </thead>
            <tbody>
              {allItems.map((item: any, index: number) => (
                <tr key={item.id || index} className={item.approved ? 'bg-green-50/50 print:bg-green-50' : ''}>
                  <td className="border border-border print:border-gray-300 px-3 py-2 text-center text-muted-foreground">{index + 1}</td>
                  <td className="border border-border print:border-gray-300 px-3 py-2 font-medium print:text-black">{item.itemName}</td>
                  <td className="border border-border print:border-gray-300 px-3 py-2 text-center">{item.uom}</td>
                  <td className="border border-border print:border-gray-300 px-3 py-2 text-right font-mono">{Number(item.qty)}</td>
                  <td className="border border-border print:border-gray-300 px-3 py-2 text-right font-mono">{Number(item.requestQty)}</td>
                  <td className="border border-border print:border-gray-300 px-3 py-2 text-center">
                    {item.approved ? (
                      <span className="text-green-600 font-semibold">✓ Yes</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted/30 print:bg-gray-50">
                <td colSpan={3} className="border border-border print:border-gray-300 px-3 py-2 font-semibold text-right">
                  Total Items: {allItems.length}
                </td>
                <td className="border border-border print:border-gray-300 px-3 py-2 text-right font-mono font-semibold">
                  {allItems.reduce((sum: number, item: any) => sum + Number(item.qty), 0)}
                </td>
                <td className="border border-border print:border-gray-300 px-3 py-2 text-right font-mono font-semibold">
                  {allItems.reduce((sum: number, item: any) => sum + Number(item.requestQty), 0)}
                </td>
                <td className="border border-border print:border-gray-300 px-3 py-2 text-center font-semibold text-green-600">
                  {approvedItems.length} approved
                </td>
              </tr>
            </tfoot>
          </table>

          <div className="grid grid-cols-2 gap-8 mt-12 pt-8 border-t print:mt-16">
            <div className="text-center">
              {pr.createdBy && (
                <p className="font-semibold text-sm print:text-black mb-1" data-testid="text-prepared-by-name">{pr.createdBy}</p>
              )}
              <div className="border-t border-border print:border-gray-400 pt-2 mt-8">
                <p className="text-sm text-muted-foreground print:text-gray-500">Prepared By</p>
              </div>
            </div>
            <div className="text-center">
              {pr.approvedBy && (
                <p className="font-semibold text-sm print:text-black mb-1" data-testid="text-approved-by-name">{pr.approvedBy}</p>
              )}
              <div className="border-t border-border print:border-gray-400 pt-2 mt-8">
                <p className="text-sm text-muted-foreground print:text-gray-500">Approved By</p>
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
