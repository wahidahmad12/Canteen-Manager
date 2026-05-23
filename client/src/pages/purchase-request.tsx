import { useState } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { ShoppingCart, Plus, Trash2, Save, Loader2, ClipboardList, CalendarDays, Building2, Package, Ruler, Hash, Share2 } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";
import { useCreatePurchaseRequest, useClientNames, useItemMaster, useCurrentUser } from "@/hooks/use-reports";
import { useLocation } from "wouter";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface PurchaseItem {
  itemName: string;
  uom: string;
  requestQty: number;
}

const UOM_OPTIONS = ["Kg", "Gm", "Ltr", "Ml", "Pcs", "Pkt", "Box", "Dz", "Nos", "Bag", "Tin", "Cyl", "Plats", "Cup", "Set"];

export default function PurchaseRequest() {
  const [date, setDate] = useState<Date>(new Date());
  const [clientName, setClientName] = useState("");
  const [items, setItems] = useState<PurchaseItem[]>([
    { itemName: "", uom: "Kg", requestQty: 0 },
  ]);
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const createMutation = useCreatePurchaseRequest();
  const { data: clients } = useClientNames();
  const { data: purchaseItems } = useItemMaster("purchase");
  const { data: currentUser } = useCurrentUser();
  const isAdmin = currentUser?.role === 'admin';
  const [shareDialog, setShareDialog] = useState<{ open: boolean; code: string; items: PurchaseItem[]; clientName: string; date: string }>({ open: false, code: '', items: [], clientName: '', date: '' });
  const savedItems = (purchaseItems || []).map((item: any) => ({ id: item.id, name: item.itemName }));

  const addItem = () => {
    setItems([...items, { itemName: "", uom: "Kg", requestQty: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof PurchaseItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === "itemName" && purchaseItems) {
      const match = purchaseItems.find((p: any) => p.itemName.toLowerCase() === String(value).toLowerCase());
      if (match) {
        newItems[index].uom = match.uom;
      }
    }
    setItems(newItems);
  };

  const handleSave = () => {
    if (!clientName) {
      toast({ title: "Error", description: "Please select a client name", variant: "destructive" });
      return;
    }
    const validItems = items.filter(item => item.itemName.trim() !== "");
    if (validItems.length === 0) {
      toast({ title: "Error", description: "Please add at least one item", variant: "destructive" });
      return;
    }

    createMutation.mutate(
      {
        clientName,
        date: format(date, "yyyy-MM-dd"),
        items: validItems,
      },
      {
        onSuccess: (data: any) => {
          const code = data?.prCode || data?.serialNumber || '';
          toast({ title: "Success", description: `Purchase request ${code ? `(${code}) ` : ''}saved successfully` });
          setShareDialog({ open: true, code: String(code), items: validItems, clientName, date: format(date, "dd-MM-yyyy") });
        },
        onError: (err: any) => {
          toast({ title: "Error", description: err.message || "Failed to save", variant: "destructive" });
        },
      }
    );
  };

  const validCount = items.filter(i => i.itemName.trim() !== "").length;

  return (
    <Layout>
      <datalist id="purchase-item-suggestions">
        {savedItems?.map((item) => (
          <option key={item.id} value={item.name} />
        ))}
      </datalist>
      <div className="max-w-4xl mx-auto px-2 sm:px-0">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center shadow-lg shadow-orange-200 dark:shadow-orange-900/30">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold" data-testid="text-purchase-title">Purchase Request</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">Create a new purchase request</p>
          </div>
        </div>

        <Card className="border-0 shadow-lg overflow-hidden mb-5" data-testid="card-request-details">
          <CardHeader className="bg-gradient-to-r from-indigo-500 to-blue-500 text-white pb-3 pt-4 px-4 sm:px-6">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="w-4 h-4" />
              Request Details
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 bg-gradient-to-b from-indigo-50/50 to-transparent dark:from-indigo-950/20">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" /> Client Name
                </Label>
                <Select value={clientName} onValueChange={setClientName} data-testid="select-client">
                  <SelectTrigger className="h-11 border-indigo-200 focus:border-indigo-400 dark:border-indigo-800" data-testid="select-client-trigger">
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients?.map((c) => (
                      <SelectItem key={c.id} value={c.name} data-testid={`client-option-${c.id}`}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5" /> Date
                </Label>
                <DatePicker date={date} setDate={(d: Date | undefined) => d && setDate(d)} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg overflow-hidden" data-testid="card-items">
          <CardHeader className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white pb-3 pt-4 px-4 sm:px-6">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="w-4 h-4" />
                Items
                <Badge variant="secondary" className="ml-1 bg-white/20 text-white hover:bg-white/30 text-xs">
                  {validCount} item{validCount !== 1 ? 's' : ''}
                </Badge>
              </CardTitle>
              <Button
                size="sm"
                onClick={addItem}
                className="bg-white/20 hover:bg-white/30 text-white border-0 h-8 text-xs"
                data-testid="button-add-item"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Add
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 bg-gradient-to-b from-emerald-50/50 to-transparent dark:from-emerald-950/20">
            <div className="hidden sm:block">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-emerald-200 dark:border-emerald-800">
                      <th className="text-left py-2.5 px-2 font-semibold text-emerald-700 dark:text-emerald-400 w-8">
                        <Hash className="w-3.5 h-3.5" />
                      </th>
                      <th className="text-left py-2.5 px-2 font-semibold text-emerald-700 dark:text-emerald-400">Item Name</th>
                      <th className="text-left py-2.5 px-2 font-semibold text-emerald-700 dark:text-emerald-400 w-28">UOM</th>
                      <th className="text-right py-2.5 px-2 font-semibold text-emerald-700 dark:text-emerald-400 w-28">Qty</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={index} className="border-b last:border-0 border-emerald-100 dark:border-emerald-900 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-colors">
                        <td className="py-2 px-2">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                            {index + 1}
                          </span>
                        </td>
                        <td className="py-2 px-2">
                          <Input
                            value={item.itemName}
                            onChange={(e) => updateItem(index, "itemName", e.target.value)}
                            placeholder="Enter item name"
                            className="h-9 border-emerald-200 focus:border-emerald-400 dark:border-emerald-800"
                            list="purchase-item-suggestions"
                            data-testid={`input-item-name-${index}`}
                          />
                        </td>
                        <td className="py-2 px-2">
                          <Select value={item.uom} onValueChange={(v) => updateItem(index, "uom", v)}>
                            <SelectTrigger className="h-9 border-emerald-200 focus:border-emerald-400 dark:border-emerald-800" data-testid={`select-uom-${index}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {UOM_OPTIONS.map((u) => (
                                <SelectItem key={u} value={u}>{u}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-2 px-2">
                          <Input
                            type="number"
                            value={item.requestQty || ""}
                            onChange={(e) => updateItem(index, "requestQty", Number(e.target.value))}
                            className="h-9 text-right font-mono border-emerald-200 focus:border-emerald-400 dark:border-emerald-800"
                            min={0}
                            data-testid={`input-request-qty-${index}`}
                          />
                        </td>
                        <td className="py-2 px-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                            onClick={() => removeItem(index)}
                            disabled={items.length <= 1}
                            data-testid={`button-remove-item-${index}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="sm:hidden space-y-3">
              {items.map((item, index) => (
                <div key={index} className="border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 space-y-3 bg-white dark:bg-gray-900 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-white text-xs font-bold shadow-sm">
                        {index + 1}
                      </span>
                      <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Item #{index + 1}</span>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                      onClick={() => removeItem(index)}
                      disabled={items.length <= 1}
                      data-testid={`button-remove-item-mobile-${index}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <Package className="w-3 h-3" /> Item Name
                    </Label>
                    <Input
                      value={item.itemName}
                      onChange={(e) => updateItem(index, "itemName", e.target.value)}
                      placeholder="Enter item name"
                      className="h-10 border-emerald-200 focus:border-emerald-400 dark:border-emerald-800"
                      list="purchase-item-suggestions"
                      data-testid={`input-item-name-mobile-${index}`}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-teal-600 dark:text-teal-400 flex items-center gap-1">
                        <Ruler className="w-3 h-3" /> UOM
                      </Label>
                      <Select value={item.uom} onValueChange={(v) => updateItem(index, "uom", v)}>
                        <SelectTrigger className="h-10 border-emerald-200 focus:border-emerald-400 dark:border-emerald-800" data-testid={`select-uom-mobile-${index}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {UOM_OPTIONS.map((u) => (
                            <SelectItem key={u} value={u}>{u}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                        <Hash className="w-3 h-3" /> Qty
                      </Label>
                      <Input
                        type="number"
                        value={item.requestQty || ""}
                        onChange={(e) => updateItem(index, "requestQty", Number(e.target.value))}
                        className="h-10 text-right font-mono border-emerald-200 focus:border-emerald-400 dark:border-emerald-800"
                        min={0}
                        data-testid={`input-request-qty-mobile-${index}`}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-center mt-4">
              <Button
                size="sm"
                variant="outline"
                onClick={addItem}
                className="w-full sm:w-auto border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                data-testid="button-add-item-bottom"
              >
                <Plus className="w-4 h-4 mr-1" /> Add Item
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6 pt-4 border-t border-emerald-200 dark:border-emerald-800">
              <Button
                variant="outline"
                onClick={() => navigate("/")}
                className="w-full sm:w-auto order-3 sm:order-1"
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              {(() => {
                const validItems = items.filter(it => it.itemName.trim() !== "");
                const header = `*Purchase Request*\nClient: ${clientName || '(no client)'}\nDate: ${format(date, 'dd-MM-yyyy')}\n`;
                const fmtQty = (q: any) => { const n = Number(q); return Number.isFinite(n) ? String(parseFloat(n.toFixed(3))) : String(q ?? ''); };
                const lines = validItems.map((it, i) => `${i + 1}. ${it.itemName} — ${fmtQty(it.requestQty)} ${it.uom}`).join("\n");
                const message = `${header}\n${lines}`;
                const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
                return (
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      if (validItems.length === 0) {
                        e.preventDefault();
                        toast({ title: "Nothing to share", description: "Please add at least one item first", variant: "destructive" });
                      }
                    }}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-md bg-[#25D366] hover:bg-[#1ebe57] text-white shadow-lg h-10 px-4 py-2 text-sm font-medium order-2 sm:order-2"
                    data-testid="button-share-whatsapp-inline"
                  >
                    <SiWhatsapp className="w-4 h-4" /> Share on WhatsApp
                  </a>
                );
              })()}
              <Button
                onClick={handleSave}
                disabled={createMutation.isPending}
                className="w-full sm:w-auto bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-200 dark:shadow-emerald-900/30 order-1 sm:order-3"
                data-testid="button-save-request"
              >
                {createMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Request
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={shareDialog.open} onOpenChange={(o) => { if (!o) { setShareDialog(s => ({ ...s, open: false })); navigate("/"); } }}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-share-pr">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="w-5 h-5 text-emerald-600" /> Share Purchase Request
            </DialogTitle>
            <DialogDescription>
              Send this purchase request to vendors or team members via WhatsApp.
            </DialogDescription>
          </DialogHeader>
          {(() => {
            const header = `*Purchase Request${shareDialog.code ? ` (${shareDialog.code})` : ''}*\nClient: ${shareDialog.clientName}\nDate: ${shareDialog.date}\n`;
            const fmtQty = (q: any) => { const n = Number(q); return Number.isFinite(n) ? String(parseFloat(n.toFixed(3))) : String(q ?? ''); };
            const lines = shareDialog.items.map((it, i) => `${i + 1}. ${it.itemName} — ${fmtQty(it.requestQty)} ${it.uom}`).join("\n");
            const message = `${header}\n${lines}`;
            const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
            return (
              <>
                <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 max-h-64 overflow-y-auto">
                  <pre className="text-xs font-mono whitespace-pre-wrap text-gray-800 dark:text-gray-200" data-testid="text-share-preview">{message}</pre>
                </div>
                <DialogFooter className="flex-col sm:flex-row gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(message);
                      toast({ title: "Copied", description: "Message copied to clipboard" });
                    }}
                    className="w-full sm:w-auto"
                    data-testid="button-copy-message"
                  >
                    Copy
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => { setShareDialog(s => ({ ...s, open: false })); navigate("/"); }}
                    className="w-full sm:w-auto"
                    data-testid="button-skip-share"
                  >
                    Skip
                  </Button>
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-md bg-[#25D366] hover:bg-[#1ebe57] text-white h-10 px-4 py-2 text-sm font-medium"
                    data-testid="button-share-whatsapp"
                  >
                    <SiWhatsapp className="w-4 h-4" /> Share on WhatsApp
                  </a>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
