import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { FileText, Plus, Trash2, Save, Loader2, ArrowLeft, Receipt, Store, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCreatePurchaseInvoice, useClientNames, useVendors, useCreateVendor, usePurchaseRequests, usePurchaseInvoice, useUpdatePurchaseInvoice, useLastPurchasePrices, useItemMaster } from "@/hooks/use-reports";
import { useLocation, useRoute, Link } from "wouter";
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
  lastEdited?: "unitPrice" | "netAmount";
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
  const { data: purchaseItemMaster } = useItemMaster("purchase");
  const [paymentGiven, setPaymentGiven] = useState(false);
  const [showNewVendor, setShowNewVendor] = useState(false);
  const [showPrSection, setShowPrSection] = useState(false);

  const approvedPRs = (purchaseRequests || []).filter((pr: any) => pr.status === 'approved');

  useEffect(() => {
    if (existingInvoice && editId) {
      setDate(new Date(existingInvoice.date));
      setClientName(existingInvoice.clientName);
      setVendorName(existingInvoice.vendorName);
      setVendorInvoiceNo(existingInvoice.vendorInvoiceNo || "");
      setPurchaseRequestId(existingInvoice.purchaseRequestId || null);
      setPaymentGiven(existingInvoice.paymentGiven || false);
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
        setShowPrSection(true);
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
    if (!prId) { setPurchaseRequestId(null); return; }
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

  const recalcFromUnitPrice = (item: InvoiceItem): InvoiceItem => {
    const totalPrice = item.qty * item.unitPrice;
    const gstAmount = totalPrice * item.gstRate / 100;
    const netAmount = totalPrice + gstAmount;
    return { ...item, totalPrice, gstAmount, netAmount };
  };

  const recalcFromNetAmount = (item: InvoiceItem): InvoiceItem => {
    const gstMultiplier = 1 + item.gstRate / 100;
    const totalPrice = item.netAmount / gstMultiplier;
    const unitPrice = item.qty > 0 ? totalPrice / item.qty : 0;
    const gstAmount = item.netAmount - totalPrice;
    return { ...item, unitPrice: Math.round(unitPrice * 100) / 100, totalPrice: Math.round(totalPrice * 100) / 100, gstAmount: Math.round(gstAmount * 100) / 100 };
  };

  const recalcItem = (item: InvoiceItem): InvoiceItem =>
    item.lastEdited === "netAmount" ? recalcFromNetAmount(item) : recalcFromUnitPrice(item);

  const addItem = () =>
    setItems([...items, { itemName: "", uom: "Kg", qty: 0, unitPrice: 0, totalPrice: 0, gstRate: 0, gstAmount: 0, netAmount: 0 }]);

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const applyLastPrice = (item: InvoiceItem): InvoiceItem => {
    if (!lastPrices || item.unitPrice > 0) return item;
    const match = lastPrices.find(p => p.itemName.toLowerCase() === item.itemName.toLowerCase());
    if (match) return recalcItem({ ...item, unitPrice: match.unitPrice, gstRate: match.gstRate });
    return item;
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === "unitPrice") newItems[index].lastEdited = "unitPrice";
    else if (field === "netAmount") newItems[index].lastEdited = "netAmount";
    if (field === "itemName") {
      const nameVal = String(value).toLowerCase();
      if (lastPrices) {
        const match = lastPrices.find(p => p.itemName.toLowerCase() === nameVal);
        if (match) { newItems[index].unitPrice = match.unitPrice; newItems[index].gstRate = match.gstRate; newItems[index].lastEdited = "unitPrice"; }
      }
      if (purchaseItemMaster) {
        const masterMatch = purchaseItemMaster.find((p: any) => p.itemName.toLowerCase() === nameVal);
        if (masterMatch) {
          if (!newItems[index].gstRate || newItems[index].gstRate === 0) newItems[index].gstRate = Number(masterMatch.gstPercent) || 0;
          newItems[index].uom = masterMatch.uom || newItems[index].uom;
        }
      }
    }
    newItems[index] = recalcItem(newItems[index]);
    setItems(newItems);
  };

  const handleAddVendor = () => {
    if (!newVendorName.trim()) return;
    createVendorMutation.mutate({ name: newVendorName.trim() }, {
      onSuccess: () => { setVendorName(newVendorName.trim()); setNewVendorName(""); setShowNewVendor(false); toast({ title: "Vendor added" }); },
      onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
    });
  };

  const handleSave = () => {
    if (!clientName) { toast({ title: "Error", description: "Please select a client name", variant: "destructive" }); return; }
    if (!vendorName) { toast({ title: "Error", description: "Please select a vendor", variant: "destructive" }); return; }
    const validItems = items.filter(item => item.itemName.trim() !== "");
    if (validItems.length === 0) { toast({ title: "Error", description: "Please add at least one item", variant: "destructive" }); return; }

    const payload = {
      purchaseRequestId: purchaseRequestId || null,
      clientName,
      vendorName,
      vendorInvoiceNo,
      date: format(date, "yyyy-MM-dd"),
      paymentGiven,
      items: validItems.map(({ lastEdited, ...rest }) => rest),
    };

    if (editId) {
      updateMutation.mutate({ id: editId, ...payload }, {
        onSuccess: () => { toast({ title: "Invoice updated successfully" }); navigate("/"); },
        onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
      });
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => { toast({ title: "Invoice created successfully" }); navigate("/"); },
        onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
      });
    }
  };

  const totals = items.reduce((acc, item) => ({
    totalPrice: acc.totalPrice + item.totalPrice,
    gstAmount: acc.gstAmount + item.gstAmount,
    netAmount: acc.netAmount + item.netAmount,
  }), { totalPrice: 0, gstAmount: 0, netAmount: 0 });

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Layout>
      <datalist id="invoice-item-suggestions">
        {(purchaseItemMaster || []).map((item: any) => (
          <option key={item.id} value={item.itemName} />
        ))}
      </datalist>

      <div className="max-w-5xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
          </Link>
        </div>

        {/* Hero card */}
        <Card className="border-0 shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-rose-500 to-pink-600 px-5 py-4 text-white">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-lg font-bold">{editId ? "Edit Purchase Invoice" : "New Purchase Invoice"}</h1>
                  <p className="text-rose-100 text-xs">{editId ? "Update invoice details below" : "Create a direct purchase invoice"}</p>
                </div>
              </div>
              <Button
                onClick={handleSave}
                disabled={isPending}
                className="bg-white text-rose-600 hover:bg-rose-50 border-0 shadow-md font-semibold"
                data-testid="button-save-invoice"
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                {editId ? "Update Invoice" : "Save Invoice"}
              </Button>
            </div>
          </div>

          <CardContent className="p-4 sm:p-6 space-y-5">
            {/* Basic details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</Label>
                <DatePicker date={date} setDate={(d) => d && setDate(d)} />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Client Name</Label>
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

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Vendor Name</Label>
                {showNewVendor ? (
                  <div className="flex gap-2">
                    <Input placeholder="New vendor name" value={newVendorName} onChange={(e) => setNewVendorName(e.target.value)} data-testid="input-new-vendor" />
                    <Button size="sm" onClick={handleAddVendor} disabled={createVendorMutation.isPending} data-testid="button-save-vendor">
                      {createVendorMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowNewVendor(false)}>Cancel</Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Select value={vendorName} onValueChange={setVendorName}>
                      <SelectTrigger data-testid="select-vendor"><SelectValue placeholder="Select vendor" /></SelectTrigger>
                      <SelectContent>
                        {(vendorsList || []).map((v: any) => (
                          <SelectItem key={v.id} value={v.name}>{v.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="outline" onClick={() => setShowNewVendor(true)} title="Add new vendor" data-testid="button-new-vendor">
                      <Store className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Vendor Invoice No.</Label>
                <Input placeholder="Invoice number" value={vendorInvoiceNo} onChange={(e) => setVendorInvoiceNo(e.target.value)} data-testid="input-vendor-invoice-no" />
              </div>

              {/* Payment toggle */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Payment Status</Label>
                <button
                  type="button"
                  role="switch"
                  aria-checked={paymentGiven}
                  onClick={() => setPaymentGiven(!paymentGiven)}
                  className={`flex items-center gap-3 w-full h-10 px-3 rounded-md border transition-colors ${paymentGiven ? 'bg-emerald-50 border-emerald-300 dark:bg-emerald-950/20 dark:border-emerald-700' : 'bg-muted/30 border-input'}`}
                  data-testid="switch-payment-given"
                >
                  <span className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${paymentGiven ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${paymentGiven ? 'translate-x-4' : 'translate-x-0'}`} />
                  </span>
                  <span className={`text-sm font-medium ${paymentGiven ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                    {paymentGiven ? "Payment Given" : "Payment Pending"}
                  </span>
                </button>
              </div>
            </div>

            {/* Optional: Load from PR */}
            {!editId && approvedPRs.length > 0 && (
              <div className="border border-dashed border-rose-200 dark:border-rose-800/50 rounded-lg">
                <button
                  type="button"
                  onClick={() => setShowPrSection(!showPrSection)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-rose-700 dark:text-rose-400 hover:bg-rose-50/50 dark:hover:bg-rose-950/10 rounded-lg transition-colors"
                  data-testid="button-toggle-pr"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Load items from approved Purchase Request
                    {purchaseRequestId && <span className="bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 text-xs px-2 py-0.5 rounded-full">Linked</span>}
                  </span>
                  {showPrSection ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showPrSection && (
                  <div className="px-4 pb-3">
                    <Select value={purchaseRequestId?.toString() || ""} onValueChange={loadFromPR}>
                      <SelectTrigger data-testid="select-purchase-request">
                        <SelectValue placeholder="Select an approved PR to load items" />
                      </SelectTrigger>
                      <SelectContent>
                        {approvedPRs.map((pr: any) => (
                          <SelectItem key={pr.id} value={pr.id.toString()}>
                            #{pr.serialNumber} — {pr.clientName} ({format(new Date(pr.date), "dd-MM-yyyy")})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1.5">Selecting a PR will auto-fill the client and approved items.</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Items card */}
        <Card className="border-0 shadow-lg overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-slate-700 to-slate-800 text-white pb-3 pt-4">
            <CardTitle className="flex items-center justify-between text-base">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Invoice Items
                <span className="text-sm font-normal bg-white/20 px-2 py-0.5 rounded-full">{items.filter(i => i.itemName).length}</span>
              </div>
              <Button size="sm" variant="ghost" onClick={addItem} className="text-white/90 hover:text-white hover:bg-white/20 gap-1" data-testid="button-add-item">
                <Plus className="w-4 h-4" /> Add Item
              </Button>
            </CardTitle>
          </CardHeader>

          <CardContent className="p-0">
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 border-b">
                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground w-8">#</th>
                    <th className="text-left py-2.5 px-2 text-xs font-semibold text-muted-foreground">Item Name</th>
                    <th className="text-left py-2.5 px-2 text-xs font-semibold text-muted-foreground w-20">UOM</th>
                    <th className="text-right py-2.5 px-2 text-xs font-semibold text-muted-foreground w-20">Qty</th>
                    <th className="text-right py-2.5 px-2 text-xs font-semibold text-muted-foreground w-24">Unit Price</th>
                    <th className="text-right py-2.5 px-2 text-xs font-semibold text-muted-foreground w-24">Total Price</th>
                    <th className="text-center py-2.5 px-2 text-xs font-semibold text-muted-foreground w-20">GST %</th>
                    <th className="text-right py-2.5 px-2 text-xs font-semibold text-muted-foreground w-24">GST Amt</th>
                    <th className="text-right py-2.5 px-2 text-xs font-semibold text-rose-600 dark:text-rose-400 w-24">Net Amt</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={index} className="border-b last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="py-2 px-3 text-muted-foreground text-xs">{index + 1}</td>
                      <td className="py-2 px-2">
                        <Input value={item.itemName} onChange={(e) => updateItem(index, "itemName", e.target.value)} list="invoice-item-suggestions" placeholder="Item name" className="h-8" data-testid={`input-item-name-${index}`} />
                      </td>
                      <td className="py-2 px-2">
                        <Select value={item.uom} onValueChange={(v) => updateItem(index, "uom", v)}>
                          <SelectTrigger className="h-8" data-testid={`select-uom-${index}`}><SelectValue /></SelectTrigger>
                          <SelectContent>{UOM_OPTIONS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                      <td className="py-2 px-2">
                        <Input type="number" value={item.qty || ""} onChange={(e) => updateItem(index, "qty", Number(e.target.value) || 0)} className="h-8 text-right" data-testid={`input-qty-${index}`} />
                      </td>
                      <td className="py-2 px-2">
                        <Input type="number" value={item.unitPrice || ""} onChange={(e) => updateItem(index, "unitPrice", Number(e.target.value) || 0)} className="h-8 text-right" data-testid={`input-unit-price-${index}`} />
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-xs text-muted-foreground">{item.totalPrice.toFixed(2)}</td>
                      <td className="py-2 px-2">
                        <Select value={item.gstRate.toString()} onValueChange={(v) => updateItem(index, "gstRate", Number(v))}>
                          <SelectTrigger className="h-8" data-testid={`select-gst-${index}`}><SelectValue /></SelectTrigger>
                          <SelectContent>{GST_RATES.map(r => <SelectItem key={r} value={r.toString()}>{r}%</SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-xs text-muted-foreground">{item.gstAmount.toFixed(2)}</td>
                      <td className="py-2 px-2">
                        <Input type="number" value={item.netAmount || ""} onChange={(e) => updateItem(index, "netAmount", Number(e.target.value) || 0)} className="h-8 text-right font-mono font-semibold text-rose-600 dark:text-rose-400" data-testid={`input-net-amount-${index}`} />
                      </td>
                      <td className="py-2 px-2">
                        <Button size="sm" variant="ghost" onClick={() => removeItem(index)} className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10" disabled={items.length <= 1} data-testid={`button-remove-item-${index}`}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-rose-50 dark:bg-rose-950/20 border-t-2 border-rose-200 dark:border-rose-800/50 font-semibold">
                    <td colSpan={5} className="py-3 px-3 text-right text-sm">Totals:</td>
                    <td className="py-3 px-2 text-right font-mono text-sm">{totals.totalPrice.toFixed(2)}</td>
                    <td></td>
                    <td className="py-3 px-2 text-right font-mono text-sm">{totals.gstAmount.toFixed(2)}</td>
                    <td className="py-3 px-2 text-right font-mono text-sm text-rose-600 dark:text-rose-400 font-bold">₹{totals.netAmount.toFixed(2)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Mobile item cards */}
            <div className="md:hidden divide-y">
              {items.map((item, index) => (
                <div key={index} className="p-3 space-y-3" data-testid={`mobile-invoice-item-${index}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">Item #{index + 1}</span>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => removeItem(index)} disabled={items.length <= 1}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Item Name</Label>
                    <Input value={item.itemName} onChange={(e) => updateItem(index, "itemName", e.target.value)} list="invoice-item-suggestions" placeholder="Enter item name" className="h-9 mt-1" />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">UOM</Label>
                      <Select value={item.uom} onValueChange={(v) => updateItem(index, "uom", v)}>
                        <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>{UOM_OPTIONS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Qty</Label>
                      <Input type="number" value={item.qty || ""} onChange={(e) => updateItem(index, "qty", Number(e.target.value) || 0)} className="h-9 text-right mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Unit Price</Label>
                      <Input type="number" value={item.unitPrice || ""} onChange={(e) => updateItem(index, "unitPrice", Number(e.target.value) || 0)} className="h-9 text-right mt-1" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">GST %</Label>
                      <Select value={item.gstRate.toString()} onValueChange={(v) => updateItem(index, "gstRate", Number(v))}>
                        <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>{GST_RATES.map(r => <SelectItem key={r} value={r.toString()}>{r}%</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">GST Amt</Label>
                      <div className="h-9 mt-1 flex items-center justify-end font-mono text-sm bg-muted/30 rounded-md px-2 text-muted-foreground">₹{item.gstAmount.toFixed(2)}</div>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-rose-600 dark:text-rose-400">Net Amt</Label>
                      <Input type="number" value={item.netAmount || ""} onChange={(e) => updateItem(index, "netAmount", Number(e.target.value) || 0)} className="h-9 mt-1 text-right font-mono font-semibold text-rose-600 dark:text-rose-400" data-testid={`input-net-amount-${index}`} />
                    </div>
                  </div>
                </div>
              ))}

              {/* Mobile totals */}
              <div className="p-3 bg-rose-50 dark:bg-rose-950/20 space-y-1.5">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Total Price</span>
                  <span className="font-mono">₹{totals.totalPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Total GST</span>
                  <span className="font-mono">₹{totals.gstAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-base font-bold text-rose-600 dark:text-rose-400 border-t border-rose-200 dark:border-rose-800/50 pt-1.5">
                  <span>Grand Total</span>
                  <span className="font-mono">₹{totals.netAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Add item bottom */}
            <div className="p-3 border-t">
              <Button variant="outline" onClick={addItem} className="w-full gap-1.5" data-testid="button-add-item-bottom">
                <Plus className="w-4 h-4" /> Add Another Item
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Save button bottom (mobile) */}
        <div className="pb-4">
          <Button onClick={handleSave} disabled={isPending} className="w-full bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white shadow-lg gap-2" size="lg" data-testid="button-save-invoice-bottom">
            {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {editId ? "Update Invoice" : "Save Invoice"}
          </Button>
        </div>
      </div>
    </Layout>
  );
}
