import { useRoute } from "wouter";
import { useInventory } from "@/hooks/use-reports";
import { format } from "date-fns";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, FileDown } from "lucide-react";
import { useLocation } from "wouter";

export default function InventoryPDF() {
  const [, params] = useRoute("/inventory/:id/pdf");
  const id = params?.id ? Number(params.id) : null;
  const { data: inventory, isLoading } = useInventory(id);
  const [, navigate] = useLocation();

  const handlePrint = () => {
    const originalTitle = document.title;
    if (inventory) {
      const dateStr = format(new Date(inventory.date), "dd-MM-yyyy");
      document.title = `DJ KPF Daily Inventory ${(inventory as any).serialNumber} ${dateStr}`;
    }
    window.print();
    document.title = originalTitle;
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        </div>
      </Layout>
    );
  }

  if (!inventory) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Inventory record not found</p>
          <Button variant="ghost" onClick={() => navigate("/")} className="mt-4">
            Back to Dashboard
          </Button>
        </div>
      </Layout>
    );
  }

  const kitchenStock = inventory.kitchenStock || [];
  const biscuits = inventory.biscuits || [];

  const totalKitchenOpen = kitchenStock.reduce((sum, item) => sum + (Number(item.open) || 0), 0);
  const totalKitchenUsed = kitchenStock.reduce((sum, item) => sum + (Number(item.used) || 0), 0);
  const totalKitchenBalance = kitchenStock.reduce((sum, item) => sum + (Number(item.balance) || 0), 0);

  const totalBiscuitGiven = biscuits.reduce((sum, item) => sum + (Number(item.given) || 0), 0);
  const totalBiscuitUsed = biscuits.reduce((sum, item) => sum + (Number(item.used) || 0), 0);
  const totalBiscuitBalance = biscuits.reduce((sum, item) => sum + (Number(item.balance) || 0), 0);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-1 sm:px-0">
        <div className="flex items-center justify-between mb-4 sm:mb-6 print:hidden">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} data-testid="button-back-dashboard">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <Button size="sm" onClick={handlePrint} className="bg-gradient-to-r from-orange-500 to-amber-600 border-0 text-white shadow-md" data-testid="button-convert-pdf">
            <FileDown className="w-4 h-4 mr-1" /> Convert to PDF
          </Button>
        </div>

        <div className="bg-white dark:bg-card border rounded-xl p-4 sm:p-8 print:border-0 print:shadow-none print:p-0" id="pdf-content">
          <div className="text-center mb-5 sm:mb-6 pb-4 border-b-2 border-orange-200 dark:border-orange-800 print:border-gray-300">
            <h1 className="text-lg sm:text-2xl font-bold text-foreground print:text-black leading-tight">DJ Hospitality & Facility Management Pvt Ltd</h1>
            <p className="text-xs sm:text-sm font-semibold text-orange-600 dark:text-orange-400 print:text-gray-600 mt-1 uppercase tracking-wider">Daily Inventory Report</p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 mb-5 text-xs sm:text-sm">
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground print:text-gray-500">Serial No:</span>
              <span className="font-bold bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded print:bg-gray-100 print:text-black" data-testid="text-serial-number">#{(inventory as any).serialNumber}</span>
            </div>
            <div>
              <span className="text-muted-foreground print:text-gray-500">Date: </span>
              <span className="font-semibold print:text-black" data-testid="text-inventory-date">{format(new Date(inventory.date), "dd MMM yyyy, EEEE")}</span>
            </div>
          </div>

          {kitchenStock.length > 0 && (
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2 pb-1.5 border-b-2 border-indigo-300 dark:border-indigo-700 print:border-gray-400">
                <h3 className="text-sm font-bold text-indigo-700 dark:text-indigo-400 print:text-black">Kitchen Stock</h3>
              </div>

              <div className="sm:hidden space-y-1.5">
                {kitchenStock.map((item, idx) => (
                  <div key={item.id || idx} className="flex items-center justify-between py-1.5 border-b border-dashed border-border/60 last:border-0">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="w-5 h-5 rounded-full bg-indigo-500 text-white text-[9px] flex items-center justify-center font-bold shrink-0">{idx + 1}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate print:text-black">{item.name}</p>
                        <p className="text-[10px] text-muted-foreground print:text-gray-500">{item.unit} | Open: {Number(item.open)} | Used: {Number(item.used)}</p>
                      </div>
                    </div>
                    <div className="text-right ml-2 shrink-0">
                      <span className="text-xs font-bold font-mono print:text-black">Bal: {Number(item.balance)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-muted/50 print:bg-gray-100">
                      <th className="border border-border print:border-gray-300 px-2 py-1.5 text-center font-semibold">#</th>
                      <th className="border border-border print:border-gray-300 px-2 py-1.5 text-left font-semibold">Item Name</th>
                      <th className="border border-border print:border-gray-300 px-2 py-1.5 text-center font-semibold">Unit</th>
                      <th className="border border-border print:border-gray-300 px-2 py-1.5 text-right font-semibold">Open</th>
                      <th className="border border-border print:border-gray-300 px-2 py-1.5 text-right font-semibold">Used</th>
                      <th className="border border-border print:border-gray-300 px-2 py-1.5 text-right font-semibold">Balance</th>
                      <th className="border border-border print:border-gray-300 px-2 py-1.5 text-left font-semibold">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kitchenStock.map((item, idx) => (
                      <tr key={item.id || idx}>
                        <td className="border border-border print:border-gray-300 px-2 py-1 text-center text-muted-foreground print:text-gray-600">{idx + 1}</td>
                        <td className="border border-border print:border-gray-300 px-2 py-1 font-medium print:text-black">{item.name}</td>
                        <td className="border border-border print:border-gray-300 px-2 py-1 text-center print:text-gray-700">{item.unit}</td>
                        <td className="border border-border print:border-gray-300 px-2 py-1 text-right font-mono print:text-black">{Number(item.open)}</td>
                        <td className="border border-border print:border-gray-300 px-2 py-1 text-right font-mono text-rose-600 print:text-red-700">{Number(item.used)}</td>
                        <td className="border border-border print:border-gray-300 px-2 py-1 text-right font-mono font-semibold print:text-black">{Number(item.balance)}</td>
                        <td className="border border-border print:border-gray-300 px-2 py-1 text-muted-foreground print:text-gray-600 text-[10px]">{item.remarks || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 dark:bg-muted/30 print:bg-gray-50 font-semibold">
                      <td colSpan={3} className="border border-border print:border-gray-300 px-2 py-1.5 text-right print:text-black">Totals:</td>
                      <td className="border border-border print:border-gray-300 px-2 py-1.5 text-right font-mono print:text-black" data-testid="text-kitchen-open">{totalKitchenOpen}</td>
                      <td className="border border-border print:border-gray-300 px-2 py-1.5 text-right font-mono text-rose-600 print:text-red-700" data-testid="text-kitchen-used">{totalKitchenUsed}</td>
                      <td className="border border-border print:border-gray-300 px-2 py-1.5 text-right font-mono print:text-black" data-testid="text-kitchen-balance">{totalKitchenBalance}</td>
                      <td className="border border-border print:border-gray-300 px-2 py-1.5"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="sm:hidden flex justify-between items-center mt-2 pt-2 border-t border-indigo-200 dark:border-indigo-800 text-xs">
                <span className="text-muted-foreground">Open: <b className="text-foreground">{totalKitchenOpen}</b></span>
                <span className="text-muted-foreground">Used: <b className="text-rose-600">{totalKitchenUsed}</b></span>
                <span className="text-muted-foreground">Bal: <b className="text-foreground">{totalKitchenBalance}</b></span>
              </div>
            </div>
          )}

          {biscuits.length > 0 && (
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2 pb-1.5 border-b-2 border-amber-300 dark:border-amber-700 print:border-gray-400">
                <h3 className="text-sm font-bold text-amber-700 dark:text-amber-400 print:text-black">Biscuits</h3>
              </div>

              <div className="sm:hidden space-y-1.5">
                {biscuits.map((item, idx) => (
                  <div key={item.id || idx} className="flex items-center justify-between py-1.5 border-b border-dashed border-border/60 last:border-0">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[9px] flex items-center justify-center font-bold shrink-0">{idx + 1}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate print:text-black">{item.name}</p>
                        <p className="text-[10px] text-muted-foreground print:text-gray-500">
                          {item.brand || '-'} | Given: {Number(item.given)} | Used: {Number(item.used)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right ml-2 shrink-0">
                      <span className="text-xs font-bold font-mono print:text-black">Bal: {Number(item.balance)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-muted/50 print:bg-gray-100">
                      <th className="border border-border print:border-gray-300 px-2 py-1.5 text-center font-semibold">#</th>
                      <th className="border border-border print:border-gray-300 px-2 py-1.5 text-left font-semibold">Item Name</th>
                      <th className="border border-border print:border-gray-300 px-2 py-1.5 text-center font-semibold">Exp. Date</th>
                      <th className="border border-border print:border-gray-300 px-2 py-1.5 text-left font-semibold">Brand</th>
                      <th className="border border-border print:border-gray-300 px-2 py-1.5 text-right font-semibold">Given</th>
                      <th className="border border-border print:border-gray-300 px-2 py-1.5 text-right font-semibold">Used</th>
                      <th className="border border-border print:border-gray-300 px-2 py-1.5 text-right font-semibold">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {biscuits.map((item, idx) => (
                      <tr key={item.id || idx}>
                        <td className="border border-border print:border-gray-300 px-2 py-1 text-center text-muted-foreground print:text-gray-600">{idx + 1}</td>
                        <td className="border border-border print:border-gray-300 px-2 py-1 font-medium print:text-black">{item.name}</td>
                        <td className="border border-border print:border-gray-300 px-2 py-1 text-center print:text-gray-700">{item.expDate || '-'}</td>
                        <td className="border border-border print:border-gray-300 px-2 py-1 print:text-gray-700">{item.brand || '-'}</td>
                        <td className="border border-border print:border-gray-300 px-2 py-1 text-right font-mono print:text-black">{Number(item.given)}</td>
                        <td className="border border-border print:border-gray-300 px-2 py-1 text-right font-mono text-rose-600 print:text-red-700">{Number(item.used)}</td>
                        <td className="border border-border print:border-gray-300 px-2 py-1 text-right font-mono font-semibold print:text-black">{Number(item.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 dark:bg-muted/30 print:bg-gray-50 font-semibold">
                      <td colSpan={4} className="border border-border print:border-gray-300 px-2 py-1.5 text-right print:text-black">Totals:</td>
                      <td className="border border-border print:border-gray-300 px-2 py-1.5 text-right font-mono print:text-black" data-testid="text-biscuit-given">{totalBiscuitGiven}</td>
                      <td className="border border-border print:border-gray-300 px-2 py-1.5 text-right font-mono text-rose-600 print:text-red-700" data-testid="text-biscuit-used">{totalBiscuitUsed}</td>
                      <td className="border border-border print:border-gray-300 px-2 py-1.5 text-right font-mono print:text-black" data-testid="text-biscuit-balance">{totalBiscuitBalance}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="sm:hidden flex justify-between items-center mt-2 pt-2 border-t border-amber-200 dark:border-amber-800 text-xs">
                <span className="text-muted-foreground">Given: <b className="text-foreground">{totalBiscuitGiven}</b></span>
                <span className="text-muted-foreground">Used: <b className="text-rose-600">{totalBiscuitUsed}</b></span>
                <span className="text-muted-foreground">Bal: <b className="text-foreground">{totalBiscuitBalance}</b></span>
              </div>
            </div>
          )}

          <div className="border-t-2 border-gray-300 dark:border-gray-600 print:border-gray-400 pt-4">
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-3 sm:p-4 text-center print:bg-gray-50 print:border print:border-gray-200">
                <p className="text-[10px] sm:text-xs text-muted-foreground print:text-gray-500 uppercase tracking-wide font-semibold mb-1">Total Opening</p>
                <p className="text-sm sm:text-xl font-bold font-mono print:text-black" data-testid="text-total-open">{totalKitchenOpen + totalBiscuitGiven}</p>
              </div>
              <div className="bg-rose-50 dark:bg-rose-950/20 rounded-lg p-3 sm:p-4 text-center print:bg-gray-50 print:border print:border-gray-200">
                <p className="text-[10px] sm:text-xs text-muted-foreground print:text-gray-500 uppercase tracking-wide font-semibold mb-1">Total Used</p>
                <p className="text-sm sm:text-xl font-bold font-mono text-rose-600 print:text-black" data-testid="text-total-used">{totalKitchenUsed + totalBiscuitUsed}</p>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-lg p-3 sm:p-4 text-center print:bg-gray-50 print:border print:border-gray-200">
                <p className="text-[10px] sm:text-xs text-muted-foreground print:text-gray-500 uppercase tracking-wide font-semibold mb-1">Total Balance</p>
                <p className="text-sm sm:text-xl font-bold font-mono text-emerald-600 print:text-black" data-testid="text-total-balance">{totalKitchenBalance + totalBiscuitBalance}</p>
              </div>
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
