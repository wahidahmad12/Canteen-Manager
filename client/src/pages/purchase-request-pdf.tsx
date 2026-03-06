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
  const isAdmin = user?.role === "admin";

  const handlePrint = () => {
    const originalTitle = document.title;
    if (pr) {
      const dateStr = format(new Date(pr.date), "dd-MM-yyyy");
      document.title = `DJ Hospitality Purchase Request for ${pr.clientName} ${pr.serialNumber} ${dateStr}`;
    }
    window.print();
    document.title = originalTitle;
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
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

  const allItems = pr.items || [];
  const approvedItems = allItems.filter((item: any) => item.approved);

  const statusColor = pr.status === 'approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' :
    pr.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';

  const statusLabel = pr.status === 'approved' ? 'APPROVED' : pr.status === 'rejected' ? 'REJECTED' : 'PENDING';

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-1 sm:px-0">
        <div className="flex items-center justify-between mb-4 sm:mb-6 print:hidden">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} data-testid="button-back-dashboard">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <Button size="sm" onClick={handlePrint} className="bg-gradient-to-r from-violet-500 to-purple-600 border-0 text-white shadow-md" data-testid="button-convert-pdf">
            <FileDown className="w-4 h-4 mr-1" /> Convert to PDF
          </Button>
        </div>

        <div className="bg-white dark:bg-card border rounded-xl p-4 sm:p-8 print:border-0 print:shadow-none print:p-0" id="pdf-content">
          <div className="text-center mb-5 sm:mb-6 pb-4 border-b-2 border-violet-200 dark:border-violet-800 print:border-gray-300">
            <h1 className="text-lg sm:text-2xl font-bold text-foreground print:text-black leading-tight">DJ Hospitality & Facility Management Pvt Ltd</h1>
            <p className="text-xs sm:text-sm font-semibold text-violet-600 dark:text-violet-400 print:text-gray-600 mt-1 uppercase tracking-wider">Purchase Request</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mb-5 text-xs sm:text-sm">
            <div className="flex justify-between sm:justify-start gap-1">
              <span className="text-muted-foreground print:text-gray-500">Serial No:</span>
              <span className="font-bold bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 px-2 py-0.5 rounded print:bg-gray-100 print:text-black">#{pr.serialNumber}</span>
            </div>
            <div className="flex justify-between sm:justify-end gap-1">
              <span className="text-muted-foreground print:text-gray-500">Date:</span>
              <span className="font-semibold print:text-black">{format(new Date(pr.date), "dd MMM yyyy")}</span>
            </div>
            <div className="flex justify-between sm:justify-start gap-1">
              <span className="text-muted-foreground print:text-gray-500">Client:</span>
              <span className="font-semibold print:text-black">{pr.clientName}</span>
            </div>
            <div className="flex justify-between sm:justify-end gap-1">
              <span className="text-muted-foreground print:text-gray-500">Status:</span>
              <span className={`font-bold px-2 py-0.5 rounded text-xs ${statusColor} print:text-black print:bg-gray-100`}>
                {statusLabel}
              </span>
            </div>
          </div>

          {isAdmin ? (
            <>
              <div className="sm:hidden space-y-2 mb-4">
                {allItems.map((item: any, index: number) => (
                  <div key={item.id || index} className={`border rounded-lg p-2.5 ${item.approved ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/10 print:bg-green-50' : 'border-border/60 print:border-gray-300'}`}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span className={`w-5 h-5 rounded-full ${item.approved ? 'bg-emerald-500' : 'bg-gray-400'} text-white text-[9px] flex items-center justify-center font-bold shrink-0`}>{index + 1}</span>
                        <p className="text-xs font-medium truncate print:text-black">{item.itemName}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${item.approved ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                        {item.approved ? 'Approved' : 'Rejected'}
                      </span>
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground print:text-gray-500">
                      <span>{item.uom}</span>
                      <span>Req: {Number(item.requestQty)} | Appr: {item.approveQty != null ? Number(item.approveQty) : '-'}</span>
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
                      <th className="border border-border print:border-gray-300 px-2 py-1.5 text-right font-semibold">Request Qty</th>
                      <th className="border border-border print:border-gray-300 px-2 py-1.5 text-right font-semibold">Approve Qty</th>
                      <th className="border border-border print:border-gray-300 px-2 py-1.5 text-center font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allItems.map((item: any, index: number) => (
                      <tr key={item.id || index} className={item.approved ? 'bg-emerald-50/50 print:bg-green-50' : ''}>
                        <td className="border border-border print:border-gray-300 px-2 py-1 text-center text-muted-foreground print:text-gray-600">{index + 1}</td>
                        <td className="border border-border print:border-gray-300 px-2 py-1 font-medium print:text-black">{item.itemName}</td>
                        <td className="border border-border print:border-gray-300 px-2 py-1 text-center print:text-gray-700">{item.uom}</td>
                        <td className="border border-border print:border-gray-300 px-2 py-1 text-right font-mono print:text-black">{Number(item.requestQty)}</td>
                        <td className="border border-border print:border-gray-300 px-2 py-1 text-right font-mono print:text-black">{item.approveQty != null ? Number(item.approveQty) : '-'}</td>
                        <td className="border border-border print:border-gray-300 px-2 py-1 text-center">
                          <span className={`text-[10px] font-bold ${item.approved ? 'text-emerald-600 print:text-green-700' : 'text-red-500 print:text-red-700'}`}>
                            {item.approved ? 'Approved' : 'Rejected'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 dark:bg-muted/30 print:bg-gray-50 font-semibold">
                      <td colSpan={3} className="border border-border print:border-gray-300 px-2 py-1.5 text-right print:text-black">Total Items: {allItems.length}</td>
                      <td className="border border-border print:border-gray-300 px-2 py-1.5 text-right font-mono print:text-black">{allItems.reduce((sum: number, item: any) => sum + Number(item.requestQty), 0)}</td>
                      <td className="border border-border print:border-gray-300 px-2 py-1.5 text-right font-mono print:text-black">{approvedItems.reduce((sum: number, item: any) => sum + (Number(item.approveQty) || 0), 0)}</td>
                      <td className="border border-border print:border-gray-300 px-2 py-1.5 text-center font-semibold text-emerald-600 print:text-green-700">{approvedItems.length}/{allItems.length}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          ) : (
            <>
              <div className="sm:hidden space-y-2 mb-4">
                {approvedItems.map((item: any, index: number) => (
                  <div key={item.id || index} className="flex items-center justify-between py-1.5 border-b border-dashed border-border/60 last:border-0">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="w-5 h-5 rounded-full bg-violet-500 text-white text-[9px] flex items-center justify-center font-bold shrink-0">{index + 1}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate print:text-black">{item.itemName}</p>
                        <p className="text-[10px] text-muted-foreground print:text-gray-500">{item.uom}</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold font-mono ml-2 shrink-0 print:text-black">{item.approveQty != null ? Number(item.approveQty) : 0}</span>
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
                      <th className="border border-border print:border-gray-300 px-2 py-1.5 text-right font-semibold">Approve Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approvedItems.map((item: any, index: number) => (
                      <tr key={item.id || index}>
                        <td className="border border-border print:border-gray-300 px-2 py-1 text-center text-muted-foreground print:text-gray-600">{index + 1}</td>
                        <td className="border border-border print:border-gray-300 px-2 py-1 font-medium print:text-black">{item.itemName}</td>
                        <td className="border border-border print:border-gray-300 px-2 py-1 text-center print:text-gray-700">{item.uom}</td>
                        <td className="border border-border print:border-gray-300 px-2 py-1 text-right font-mono print:text-black">{item.approveQty != null ? Number(item.approveQty) : 0}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 dark:bg-muted/30 print:bg-gray-50 font-semibold">
                      <td colSpan={3} className="border border-border print:border-gray-300 px-2 py-1.5 text-right print:text-black">Total Approved: {approvedItems.length}</td>
                      <td className="border border-border print:border-gray-300 px-2 py-1.5 text-right font-mono print:text-black">{approvedItems.reduce((sum: number, item: any) => sum + (Number(item.approveQty) || 0), 0)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-6 sm:gap-8 mt-10 sm:mt-12 pt-6 sm:pt-8 border-t print:mt-16">
            <div className="text-center">
              {pr.createdBy && (
                <p className="font-semibold text-xs sm:text-sm print:text-black mb-1" data-testid="text-prepared-by-name">{pr.createdBy}</p>
              )}
              <div className="border-t border-border print:border-gray-400 pt-2 mt-6 sm:mt-8">
                <p className="text-xs sm:text-sm text-muted-foreground print:text-gray-500">Prepared By</p>
              </div>
            </div>
            <div className="text-center">
              {pr.approvedBy && (
                <p className="font-semibold text-xs sm:text-sm print:text-black mb-1" data-testid="text-approved-by-name">{pr.approvedBy}</p>
              )}
              <div className="border-t border-border print:border-gray-400 pt-2 mt-6 sm:mt-8">
                <p className="text-xs sm:text-sm text-muted-foreground print:text-gray-500">Approved By</p>
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
