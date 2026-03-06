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
            <p className="text-sm text-muted-foreground print:text-gray-600 mt-1">Daily Inventory Report</p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
            <div>
              <span className="text-muted-foreground print:text-gray-500">Serial No:</span>
              <span className="ml-2 font-semibold print:text-black" data-testid="text-serial-number">#{(inventory as any).serialNumber}</span>
            </div>
            <div className="text-right">
              <span className="text-muted-foreground print:text-gray-500">Date:</span>
              <span className="ml-2 font-semibold print:text-black" data-testid="text-inventory-date">{format(new Date(inventory.date), "dd MMM yyyy, EEEE")}</span>
            </div>
          </div>

          {kitchenStock.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-bold mb-2 print:text-black">Kitchen Stock</h3>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-muted/50 print:bg-gray-100">
                    <th className="border border-border print:border-gray-300 px-3 py-1.5 text-left font-semibold w-10">S.No</th>
                    <th className="border border-border print:border-gray-300 px-3 py-1.5 text-left font-semibold">Item Name</th>
                    <th className="border border-border print:border-gray-300 px-3 py-1.5 text-center font-semibold w-14">Unit</th>
                    <th className="border border-border print:border-gray-300 px-3 py-1.5 text-right font-semibold w-20">Open</th>
                    <th className="border border-border print:border-gray-300 px-3 py-1.5 text-right font-semibold w-20">Used</th>
                    <th className="border border-border print:border-gray-300 px-3 py-1.5 text-right font-semibold w-20">Balance</th>
                    <th className="border border-border print:border-gray-300 px-3 py-1.5 text-left font-semibold">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {kitchenStock.map((item, idx) => (
                    <tr key={item.id || idx}>
                      <td className="border border-border print:border-gray-300 px-3 py-1 text-center text-muted-foreground print:text-gray-600">{idx + 1}</td>
                      <td className="border border-border print:border-gray-300 px-3 py-1 font-medium print:text-black">{item.name}</td>
                      <td className="border border-border print:border-gray-300 px-3 py-1 text-center print:text-gray-700">{item.unit}</td>
                      <td className="border border-border print:border-gray-300 px-3 py-1 text-right font-mono print:text-black">{Number(item.open)}</td>
                      <td className="border border-border print:border-gray-300 px-3 py-1 text-right font-mono text-rose-600 print:text-red-700">{Number(item.used)}</td>
                      <td className="border border-border print:border-gray-300 px-3 py-1 text-right font-mono font-semibold print:text-black">{Number(item.balance)}</td>
                      <td className="border border-border print:border-gray-300 px-3 py-1 text-muted-foreground print:text-gray-600 text-xs">{item.remarks || '-'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/30 print:bg-gray-50 font-semibold">
                    <td colSpan={3} className="border border-border print:border-gray-300 px-3 py-1.5 text-right print:text-black">Totals:</td>
                    <td className="border border-border print:border-gray-300 px-3 py-1.5 text-right font-mono print:text-black" data-testid="text-kitchen-open">{totalKitchenOpen}</td>
                    <td className="border border-border print:border-gray-300 px-3 py-1.5 text-right font-mono text-rose-600 print:text-red-700" data-testid="text-kitchen-used">{totalKitchenUsed}</td>
                    <td className="border border-border print:border-gray-300 px-3 py-1.5 text-right font-mono print:text-black" data-testid="text-kitchen-balance">{totalKitchenBalance}</td>
                    <td className="border border-border print:border-gray-300 px-3 py-1.5"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {biscuits.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-bold mb-2 print:text-black">Biscuits</h3>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-muted/50 print:bg-gray-100">
                    <th className="border border-border print:border-gray-300 px-3 py-1.5 text-left font-semibold w-10">S.No</th>
                    <th className="border border-border print:border-gray-300 px-3 py-1.5 text-left font-semibold">Item Name</th>
                    <th className="border border-border print:border-gray-300 px-3 py-1.5 text-center font-semibold w-24">Exp. Date</th>
                    <th className="border border-border print:border-gray-300 px-3 py-1.5 text-left font-semibold w-24">Brand</th>
                    <th className="border border-border print:border-gray-300 px-3 py-1.5 text-right font-semibold w-20">Given</th>
                    <th className="border border-border print:border-gray-300 px-3 py-1.5 text-right font-semibold w-20">Used</th>
                    <th className="border border-border print:border-gray-300 px-3 py-1.5 text-right font-semibold w-20">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {biscuits.map((item, idx) => (
                    <tr key={item.id || idx}>
                      <td className="border border-border print:border-gray-300 px-3 py-1 text-center text-muted-foreground print:text-gray-600">{idx + 1}</td>
                      <td className="border border-border print:border-gray-300 px-3 py-1 font-medium print:text-black">{item.name}</td>
                      <td className="border border-border print:border-gray-300 px-3 py-1 text-center print:text-gray-700">{item.expDate || '-'}</td>
                      <td className="border border-border print:border-gray-300 px-3 py-1 print:text-gray-700">{item.brand || '-'}</td>
                      <td className="border border-border print:border-gray-300 px-3 py-1 text-right font-mono print:text-black">{Number(item.given)}</td>
                      <td className="border border-border print:border-gray-300 px-3 py-1 text-right font-mono text-rose-600 print:text-red-700">{Number(item.used)}</td>
                      <td className="border border-border print:border-gray-300 px-3 py-1 text-right font-mono font-semibold print:text-black">{Number(item.balance)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/30 print:bg-gray-50 font-semibold">
                    <td colSpan={4} className="border border-border print:border-gray-300 px-3 py-1.5 text-right print:text-black">Totals:</td>
                    <td className="border border-border print:border-gray-300 px-3 py-1.5 text-right font-mono print:text-black" data-testid="text-biscuit-given">{totalBiscuitGiven}</td>
                    <td className="border border-border print:border-gray-300 px-3 py-1.5 text-right font-mono text-rose-600 print:text-red-700" data-testid="text-biscuit-used">{totalBiscuitUsed}</td>
                    <td className="border border-border print:border-gray-300 px-3 py-1.5 text-right font-mono print:text-black" data-testid="text-biscuit-balance">{totalBiscuitBalance}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          <div className="border-t-2 border-border print:border-gray-400 pt-4">
            <div className="bg-muted/30 print:bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-bold mb-3 print:text-black">Summary</h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="text-center">
                  <span className="text-muted-foreground print:text-gray-500 block text-xs mb-1">Total Opening</span>
                  <span className="font-mono font-bold text-lg print:text-black" data-testid="text-total-open">{totalKitchenOpen + totalBiscuitGiven}</span>
                </div>
                <div className="text-center">
                  <span className="text-muted-foreground print:text-gray-500 block text-xs mb-1">Total Used</span>
                  <span className="font-mono font-bold text-lg text-rose-600 print:text-red-700" data-testid="text-total-used">{totalKitchenUsed + totalBiscuitUsed}</span>
                </div>
                <div className="text-center">
                  <span className="text-muted-foreground print:text-gray-500 block text-xs mb-1">Total Balance</span>
                  <span className="font-mono font-bold text-lg text-emerald-600 print:text-green-700" data-testid="text-total-balance">{totalKitchenBalance + totalBiscuitBalance}</span>
                </div>
              </div>
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
