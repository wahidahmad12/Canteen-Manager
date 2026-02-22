import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { FileText, Plus, Trash2, Save, Loader2, Store } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCreatePurchaseInvoice, useClientNames, useVendors, useCreateVendor, usePurchaseRequests, usePurchaseInvoice, useUpdatePurchaseInvoice, useLastPurchasePrices } from "@/hooks/use-reports";
import { useLocation, useRoute } from "wouter";
import { Label } from "@/components/ui/label";

interface InvoiceItem {
  itemName: string;
  uom: string;
  qty: number;
  unitPrice: number;
  totalPrice: number;
  gstRate: number;
  gstAmount: number;
  netAmount: number;
}

const UOM_OPTIONS = ["Kg", "Gm", "Ltr", "Ml", "Pcs", "Pkt", "Box", "Dz", "Nos", "Bag", "Tin", "Cyl", "Plats", "Cup", "Set"];
const GST_RATES = [0, 5, 12, 18, 28];

export default function PurchaseInvoice() {
  const [, editParams] = useRoute("/purchase-invoice/:id/edit");
  const editId = editParams?.id ? Number(editParams.id) : null;
  const { data: existingInvoice } = usePurchaseInvoice(editId);

  const [, prParams] = useRoute("/purchase-invoice/from/:prId");
  const fromPrId = prParams?.prId ? Number(prParams.prId) : null;

  const [date, setDate] = useState<Date>(new Date());
  const [clientName, setClientName] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [newVendorName, setNewVendorName] = useState("");
  const [vendorInvoiceNo, setVendorInvoiceNo] = useState("");
  const [purchaseRequestId, setPurchaseRequestId] = useState<number | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([
    { itemName: "", uom: "Kg", qty: 0, unitPrice: 0, totalPrice: 0, gstRate: 0, gstAmount: 0, netAmount: 0 },
  ]);
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const createMutation = useCreatePurchaseInvoice();
  const updateMutation = useUpdatePurchaseInvoice();
  const { data: clients } = useClientNames();
  const { data: vendorsList } = useVendors();
  const createVendorMutation = useCreateVendor();
  const { data: purchaseRequests } = usePurchaseRequests();
  const { data: lastPrices } = useLastPurchasePrices();
  const [showNewVendor, setShowNewVendor] = useState(false);

  const approvedPRs = (purchaseRequests || []).filter((pr: any) => pr.status === 'approved');

  useEffect(() => {
    if (existingInvoice && editId) {
      setDate(new Date(existingInvoice.date));
      setClientName(existingInvoice.clientName);
      setVendorName(existingInvoice.vendorName);
      setVendorInvoiceNo(existingInvoice.vendorInvoiceNo || "");
      setPurchaseRequestId(existingInvoice.purchaseRequestId || null);
      if (existingInvoice.items?.length > 0) {
        setItems(existingInvoice.items.map((item: any) => ({
          itemName: item.itemName,
          uom: item.uom,
          qty: Number(item.qty),
          unitPrice: Number(item.unitPrice),
          totalPrice: Number(item.totalPrice),
          gstRate: Number(item.gstRate),
          gstAmount: Number(item.gstAmount),
          netAmount: Number(item.netAmount),
        })));
      }
    }
  }, [existingInvoice, editId]);

  useEffect(() => {
    if (fromPrId && purchaseRequests) {
      const pr = purchaseRequests.find((p: any) => p.id === fromPrId);
      if (pr) {
        setClientName(pr.clientName);
        setPurchaseRequestId(pr.id);
        const approvedItems = (pr.items || []).filter((item: any) => item.approved);
        if (approvedItems.length > 0) {
          setItems(approvedItems.map((item: any) => {
            const base: InvoiceItem = {
              itemName: item.itemName,
              uom: item.uom,
              qty: Number(item.approveQty) || 0,
              unitPrice: 0,
              totalPrice: 0,
              gstRate: 0,
              gstAmount: 0,
              netAmount: 0,
            };
            return applyLastPrice(base);
          }));
        }
      }
    }
  }, [fromPrId, purchaseRequests, lastPrices]);

  const loadFromPR = (prId: string) => {
    if (!prId) {
      setPurchaseRequestId(null);
      return;
    }
    const pr = approvedPRs.find((p: any) => p.id === Number(prId));
    if (pr) {
      setPurchaseRequestId(pr.id);
      setClientName(pr.clientName);
      const approvedItems = (pr.items || []).filter((item: any) => item.approved);
      if (approvedItems.length > 0) {
        setItems(approvedItems.map((item: any) => {
          const base: InvoiceItem = {
            itemName: item.itemName,
            uom: item.uom,
            qty: Number(item.approveQty) || 0,
            unitPrice: 0,
            totalPrice: 0,
            gstRate: 0,
            gstAmount: 0,
            netAmount: 0,
          };
          return applyLastPrice(base);
        }));
      }
    }
  };

  const recalcItem = (item: InvoiceItem): InvoiceItem => {
    const totalPrice = item.qty * item.unitPrice;
    const gstAmount = totalPrice * item.gstRate / 100;
    const netAmount = totalPrice + gstAmount;
    return { ...item, totalPrice, gstAmount, netAmount };
  };

  const addItem = () => {
    setItems([...items, { itemName: "", uom: "Kg", qty: 0, unitPrice: 0, totalPrice: 0, gstRate: 0, gstAmount: 0, netAmount: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const applyLastPrice = (item: InvoiceItem): InvoiceItem => {
    if (!lastPrices || item.unitPrice > 0) return item;
    const match = lastPrices.find(p => p.itemName.toLowerCase() === item.itemName.toLowerCase());
    if (match) {
      const updated = { ...item, unitPrice: match.unitPrice, gstRate: match.gstRate };
      return recalcItem(updated);
    }
    return item;
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === "itemName" && lastPrices) {
      const match = lastPrices.find(p => p.itemName.toLowerCase() === String(value).toLowerCase());
      if (match) {
        newItems[index].unitPrice = match.unitPrice;
        newItems[index].gstRate = match.gstRate;
      }
    }
    newItems[index] = recalcItem(newItems[index]);
    setItems(newItems);
  };

  const handleAddVendor = () => {
    if (!newVendorName.trim()) return;
    createVendorMutation.mutate({ name: newVendorName.trim() }, {
      onSuccess: () => {
        setVendorName(newVendorName.trim());
        setNewVendorName("");
        setShowNewVendor(false);
        toast({ title: "Vendor added" });
      },
      onError: (err) => {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    });
  };

  const handleSave = () => {
    if (!clientName) {
      toast({ title: "Error", description: "Please select a client name", variant: "destructive" });
      return;
    }
    if (!vendorName) {
      toast({ title: "Error", description: "Please select a vendor", variant: "destructive" });
      return;
    }
    const validItems = items.filter(item => item.itemName.trim() !== "");
    if (validItems.length === 0) {
      toast({ title: "Error", description: "Please add at least one item", variant: "destructive" });
      return;
    }

    const payload = {
      purchaseRequestId: purchaseRequestId || null,
      clientName,
      vendorName,
      vendorInvoiceNo,
      date: format(date, "yyyy-MM-dd"),
      items: validItems,
    };

    if (editId) {
      updateMutation.mutate({ id: editId, ...payload }, {
        onSuccess: () => {
          toast({ title: "Invoice updated successfully" });
          navigate("/");
        },
        onError: (err) => {
          toast({ title: "Error", description: err.message, variant: "destructive" });
        }
      });
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => {
          toast({ title: "Invoice created successfully" });
          navigate("/");
        },
        onError: (err) => {
          toast({ title: "Error", description: err.message, variant: "destructive" });
        }
      });
    }
  };

  const totals = items.reduce((acc, item) => ({
    totalPrice: acc.totalPrice + item.totalPrice,
    gstAmount: acc.gstAmount + item.gstAmount,
    netAmount: acc.netAmount + item.netAmount,
  }), { totalPrice: 0, gstAmount: 0, netAmount: 0 });

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {editId ? "Edit Purchase Invoice" : "New Purchase Invoice"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label>Date</Label>
                <DatePicker date={date} setDate={(d) => d && setDate(d)} />
              </div>

              {!editId && approvedPRs.length > 0 && (
                <div>
                  <Label>Load from Purchase Request</Label>
                  <Select value={purchaseRequestId?.toString() || ""} onValueChange={loadFromPR}>
                    <SelectTrigger data-testid="select-purchase-request">
                      <SelectValue placeholder="Select PR (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {approvedPRs.map((pr: any) => (
                        <SelectItem key={pr.id} value={pr.id.toString()}>
                          #{pr.serialNumber} - {pr.clientName} ({format(new Date(pr.date), "dd MMM yyyy")})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label>Client Name</Label>
                <Select value={clientName} onValueChange={setClientName}>
                  <SelectTrigger data-testid="select-client-name">
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {(clients || []).map((c: any) => (
                      <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Vendor Name</Label>
                {showNewVendor ? (
                  <div className="flex gap-2">
                    <Input
                      placeholder="New vendor name"
                      value={newVendorName}
                      onChange={(e) => setNewVendorName(e.target.value)}
                      data-testid="input-new-vendor"
                    />
                    <Button size="sm" onClick={handleAddVendor} disabled={createVendorMutation.isPending} data-testid="button-save-vendor">
                      {createVendorMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowNewVendor(false)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Select value={vendorName} onValueChange={setVendorName}>
                      <SelectTrigger data-testid="select-vendor">
                        <SelectValue placeholder="Select vendor" />
                      </SelectTrigger>
                      <SelectContent>
                        {(vendorsList || []).map((v: any) => (
                          <SelectItem key={v.id} value={v.name}>{v.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="outline" onClick={() => setShowNewVendor(true)} data-testid="button-new-vendor">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>

              <div>
                <Label>Vendor Invoice No.</Label>
                <Input
                  placeholder="Invoice number"
                  value={vendorInvoiceNo}
                  onChange={(e) => setVendorInvoiceNo(e.target.value)}
                  data-testid="input-vendor-invoice-no"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">Invoice Items</h3>
                <Button size="sm" variant="outline" onClick={addItem} data-testid="button-add-item">
                  <Plus className="w-4 h-4 mr-1" /> Add Item
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-1 w-8">#</th>
                      <th className="text-left py-2 px-1">Item Name</th>
                      <th className="text-left py-2 px-1 w-20">UOM</th>
                      <th className="text-right py-2 px-1 w-20">Qty</th>
                      <th className="text-right py-2 px-1 w-24">Unit Price</th>
                      <th className="text-right py-2 px-1 w-24">Total Price</th>
                      <th className="text-center py-2 px-1 w-20">GST %</th>
                      <th className="text-right py-2 px-1 w-24">GST Amt</th>
                      <th className="text-right py-2 px-1 w-24">Net Amt</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={index} className="border-b">
                        <td className="py-2 px-1 text-muted-foreground">{index + 1}</td>
                        <td className="py-2 px-1">
                          <Input
                            value={item.itemName}
                            onChange={(e) => updateItem(index, "itemName", e.target.value)}
                            placeholder="Item name"
                            className="h-8"
                            data-testid={`input-item-name-${index}`}
                          />
                        </td>
                        <td className="py-2 px-1">
                          <Select value={item.uom} onValueChange={(v) => updateItem(index, "uom", v)}>
                            <SelectTrigger className="h-8" data-testid={`select-uom-${index}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {UOM_OPTIONS.map(u => (
                                <SelectItem key={u} value={u}>{u}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-2 px-1">
                          <Input
                            type="number"
                            value={item.qty || ""}
                            onChange={(e) => updateItem(index, "qty", Number(e.target.value) || 0)}
                            className="h-8 text-right"
                            data-testid={`input-qty-${index}`}
                          />
                        </td>
                        <td className="py-2 px-1">
                          <Input
                            type="number"
                            value={item.unitPrice || ""}
                            onChange={(e) => updateItem(index, "unitPrice", Number(e.target.value) || 0)}
                            className="h-8 text-right"
                            data-testid={`input-unit-price-${index}`}
                          />
                        </td>
                        <td className="py-2 px-1 text-right font-mono">
                          {item.totalPrice.toFixed(2)}
                        </td>
                        <td className="py-2 px-1">
                          <Select value={item.gstRate.toString()} onValueChange={(v) => updateItem(index, "gstRate", Number(v))}>
                            <SelectTrigger className="h-8" data-testid={`select-gst-${index}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {GST_RATES.map(r => (
                                <SelectItem key={r} value={r.toString()}>{r}%</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-2 px-1 text-right font-mono">
                          {item.gstAmount.toFixed(2)}
                        </td>
                        <td className="py-2 px-1 text-right font-mono font-semibold">
                          {item.netAmount.toFixed(2)}
                        </td>
                        <td className="py-2 px-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeItem(index)}
                            className="h-8 w-8 p-0 text-destructive"
                            disabled={items.length <= 1}
                            data-testid={`button-remove-item-${index}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/50 font-semibold">
                      <td colSpan={5} className="py-2 px-1 text-right">Totals:</td>
                      <td className="py-2 px-1 text-right font-mono">{totals.totalPrice.toFixed(2)}</td>
                      <td></td>
                      <td className="py-2 px-1 text-right font-mono">{totals.gstAmount.toFixed(2)}</td>
                      <td className="py-2 px-1 text-right font-mono text-primary">{totals.netAmount.toFixed(2)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="flex justify-center mt-4">
              <Button size="sm" variant="outline" onClick={addItem} className="w-full sm:w-auto" data-testid="button-add-item-bottom">
                <Plus className="w-4 h-4 mr-1" /> Add Item
              </Button>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => navigate("/")} data-testid="button-cancel-invoice">
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-invoice"
              >
                {(createMutation.isPending || updateMutation.isPending) ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {editId ? "Update Invoice" : "Save Invoice"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
