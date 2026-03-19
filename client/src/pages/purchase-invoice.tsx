import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { format, parse } from "date-fns";
import { FileText, Plus, Trash2, Save, Loader2, ArrowLeft, Receipt, Store, ChevronDown, ChevronUp, IndianRupee, CalendarCheck, CheckCircle2, Clock, ListChecks, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCreatePurchaseInvoice, useClientNames, useVendors, useCreateVendor, usePurchaseRequests, usePurchaseInvoice, useUpdatePurchaseInvoice, useLastPurchasePrices, useItemMaster, useNextDjInvoiceNo, useAddPurchaseInvoicePayment, useDeletePurchaseInvoicePayment } from "@/hooks/use-reports";
import { useLocation, useRoute, Link } from "wouter";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
  prDate?: string;
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
  const [djInvoiceNo, setDjInvoiceNo] = useState("");
  const [purchaseRequestId, setPurchaseRequestId] = useState<number | null>(null);
  const [selectedPrIds, setSelectedPrIds] = useState<number[]>([]);
  const [prPopoverOpen, setPrPopoverOpen] = useState(false);
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
  const { data: nextDjNo } = useNextDjInvoiceNo();
  const addPaymentMutation = useAddPurchaseInvoicePayment();
  const deletePaymentMutation = useDeletePurchaseInvoicePayment();

  const [showNewVendor, setShowNewVendor] = useState(false);
  const [showPrSection, setShowPrSection] = useState(false);

  // Payment form state
  const [newPaymentDate, setNewPaymentDate] = useState<Date>(new Date());
  const [newPaymentAmount, setNewPaymentAmount] = useState("");
  const [newPaymentNotes, setNewPaymentNotes] = useState("");

  const allApprovedPRs = (purchaseRequests || []).filter((pr: any) => pr.status === 'approved');
  const approvedPRs = allApprovedPRs.filter((pr: any) => !pr.invoiced);

  // Auto-fill DJ Invoice No for new invoices
  useEffect(() => {
    if (!editId && nextDjNo && !djInvoiceNo) {
      setDjInvoiceNo(nextDjNo);
    }
  }, [nextDjNo, editId]);

  useEffect(() => {
    if (existingInvoice && editId) {
      setDate(new Date(existingInvoice.date));
      setClientName(existingInvoice.clientName);
      setVendorName(existingInvoice.vendorName);
      setVendorInvoiceNo(existingInvoice.vendorInvoiceNo || "");
      setDjInvoiceNo(existingInvoice.djInvoiceNo || "");
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
        setSelectedPrIds([pr.id]);
        setShowPrSection(true);
        const approvedItems = (pr.items || []).filter((item: any) => item.approved);
        if (approvedItems.length > 0) {
          setItems(approvedItems.map((item: any) => {
            const base: InvoiceItem = {
              itemName: item.itemName,
              uom: item.uom,
              qty: Number(item.approveQty) || 0,
              unitPrice: 0, totalPrice: 0, gstRate: 0, gstAmount: 0, netAmount: 0,
            };
            return applyLastPrice(base);
          }));
        }
      }
    }
  }, [fromPrId, purchaseRequests, lastPrices]);

  const togglePrSelection = (prId: number) => {
    setSelectedPrIds(prev =>
      prev.includes(prId) ? prev.filter(id => id !== prId) : [...prev, prId]
    );
  };

  const loadItemsFromSelectedPRs = () => {
    if (selectedPrIds.length === 0) return;
    const selectedPRs = approvedPRs.filter((p: any) => selectedPrIds.includes(p.id));
    if (selectedPRs.length === 0) return;

    // Auto-set client name from the first selected PR if not set
    if (!clientName && selectedPRs[0]?.clientName) {
      setClientName(selectedPRs[0].clientName);
    }
    // Set purchaseRequestId to first PR's id (for legacy single-link support)
    setPurchaseRequestId(selectedPRs[0].id);

    // Combine all approved items from all selected PRs
    const allItems: InvoiceItem[] = [];
    selectedPRs.forEach((pr: any) => {
      const approvedItems = (pr.items || []).filter((item: any) => item.approved);
      approvedItems.forEach((item: any) => {
        const base: InvoiceItem = { itemName: item.itemName, uom: item.uom, qty: Number(item.approveQty) || 0, unitPrice: 0, totalPrice: 0, gstRate: 0, gstAmount: 0, netAmount: 0, prDate: pr.date };
        allItems.push(applyLastPrice(base));
      });
    });

    if (allItems.length > 0) {
      setItems(allItems);
      toast({ title: `${allItems.length} items loaded from ${selectedPRs.length} Purchase Request${selectedPRs.length > 1 ? 's' : ''}` });
    }
    setPrPopoverOpen(false);
    setShowPrSection(false);
  };

  const recalcFromUnitPrice = (item: InvoiceItem): InvoiceItem => {
    const totalPrice = item.qty * item.unitPrice;
    const gstAmount = totalPrice * item.gstRate / 100;
    return { ...item, totalPrice, gstAmount, netAmount: totalPrice + gstAmount };
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

  const applyLastPrice = (item: InvoiceItem): InvoiceItem => {
    if (!lastPrices || item.unitPrice > 0) return item;
    const match = lastPrices.find(p => p.itemName.toLowerCase() === item.itemName.toLowerCase());
    if (match) return recalcItem({ ...item, unitPrice: match.unitPrice, gstRate: match.gstRate });
    return item;
  };

  const addItem = () =>
    setItems([...items, { itemName: "", uom: "Kg", qty: 0, unitPrice: 0, totalPrice: 0, gstRate: 0, gstAmount: 0, netAmount: 0 }]);

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
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
      allPrIds: selectedPrIds.length > 0 ? selectedPrIds : undefined,
      djInvoiceNo: djInvoiceNo.trim() || undefined,
      clientName,
      vendorName,
      vendorInvoiceNo,
      date: format(date, "yyyy-MM-dd"),
      items: validItems.map(({ lastEdited, prDate, ...rest }) => rest),
    };

    if (editId) {
      updateMutation.mutate({ id: editId, ...payload }, {
        onSuccess: () => { toast({ title: "Invoice updated successfully" }); },
        onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
      });
    } else {
      createMutation.mutate(payload, {
        onSuccess: (inv: any) => {
          toast({ title: `Invoice ${djInvoiceNo} created successfully` });
          navigate(`/purchase-invoice/${inv.id}/edit`);
        },
        onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
      });
    }
  };

  const handleAddPayment = () => {
    if (!editId) { toast({ title: "Please save the invoice first before adding payments", variant: "destructive" }); return; }
    const amount = parseFloat(newPaymentAmount);
    if (!newPaymentDate || !amount || amount <= 0) { toast({ title: "Error", description: "Please enter a valid date and amount", variant: "destructive" }); return; }
    addPaymentMutation.mutate({
      invoiceId: editId,
      paymentDate: format(newPaymentDate, "yyyy-MM-dd"),
      amount,
      notes: newPaymentNotes.trim() || undefined,
    }, {
      onSuccess: () => {
        toast({ title: "Payment recorded" });
        setNewPaymentAmount("");
        setNewPaymentNotes("");
        setNewPaymentDate(new Date());
      },
      onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
    });
  };

  const totals = items.reduce((acc, item) => ({
    totalPrice: acc.totalPrice + item.totalPrice,
    gstAmount: acc.gstAmount + item.gstAmount,
    netAmount: acc.netAmount + item.netAmount,
  }), { totalPrice: 0, gstAmount: 0, netAmount: 0 });

  const payments = (existingInvoice as any)?.payments || [];
  const totalPaid = payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
  const balance = totals.netAmount - totalPaid;
  const isPaid = balance <= 0 && totals.netAmount > 0;

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
          <Link href="/purchase-invoice">
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
                  <h1 className="text-lg font-bold flex items-center gap-2">
                    {editId ? "Edit Purchase Invoice" : "New Purchase Invoice"}
                    {djInvoiceNo && <span className="bg-white/20 text-white text-sm px-2.5 py-0.5 rounded-full font-mono">{djInvoiceNo}</span>}
                  </h1>
                  <p className="text-rose-100 text-xs">{editId ? "Update invoice details and manage payments" : "Create a direct purchase invoice"}</p>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {/* DJ Invoice No */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">DJ Invoice No.</Label>
                <div className="relative">
                  <Input
                    value={djInvoiceNo}
                    onChange={(e) => setDjInvoiceNo(e.target.value.toUpperCase())}
                    placeholder="DJ001"
                    className="font-mono font-bold text-rose-600 dark:text-rose-400 pl-3"
                    data-testid="input-dj-invoice-no"
                  />
                </div>
              </div>

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
                    <Button size="sm" onClick={handleAddVendor} disabled={createVendorMutation.isPending}>
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
                    <Button size="sm" variant="outline" onClick={() => setShowNewVendor(true)} title="Add new vendor">
                      <Store className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Vendor Invoice No.</Label>
                <Input placeholder="Invoice number" value={vendorInvoiceNo} onChange={(e) => setVendorInvoiceNo(e.target.value)} data-testid="input-vendor-invoice-no" />
              </div>
            </div>

            {/* Optional: Load from multiple PRs */}
            {!editId && allApprovedPRs.length > 0 && (
              <div className="border border-dashed border-rose-200 dark:border-rose-800/50 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-rose-700 dark:text-rose-400">
                  <ListChecks className="w-4 h-4" />
                  Load items from Purchase Requests
                  {selectedPrIds.length > 0 && (
                    <span className="bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 text-xs px-2 py-0.5 rounded-full font-semibold">
                      {selectedPrIds.length} selected
                    </span>
                  )}
                </div>

                <Popover open={prPopoverOpen} onOpenChange={setPrPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="w-full justify-start border-rose-200 dark:border-rose-800 text-left font-normal" data-testid="button-select-prs">
                      <FileText className="w-4 h-4 mr-2 text-rose-500 shrink-0" />
                      {selectedPrIds.length === 0
                        ? <span className="text-muted-foreground">Select approved Purchase Requests…</span>
                        : <span className="truncate">{allApprovedPRs.filter((p: any) => selectedPrIds.includes(p.id)).map((p: any) => (p as any).prCode || `#${p.serialNumber}`).join(", ")}</span>
                      }
                      <ChevronDown className="w-4 h-4 ml-auto shrink-0 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-96 p-2" align="start">
                    <p className="text-xs font-semibold text-muted-foreground uppercase px-2 pb-2">Approved Purchase Requests</p>
                    <div className="space-y-1 max-h-60 overflow-y-auto">
                      {allApprovedPRs.map((pr: any) => {
                        const isInvoiced = !!pr.invoiced;
                        return (
                          <label key={pr.id} className={`flex items-start gap-2.5 px-2 py-2 rounded-lg transition-colors ${isInvoiced ? 'opacity-50 cursor-not-allowed' : selectedPrIds.includes(pr.id) ? 'bg-rose-50 dark:bg-rose-950/20 cursor-pointer' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer'}`}>
                            <Checkbox
                              checked={selectedPrIds.includes(pr.id)}
                              onCheckedChange={() => !isInvoiced && togglePrSelection(pr.id)}
                              disabled={isInvoiced}
                              className="mt-0.5 shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium flex items-center gap-1.5">
                                {(pr as any).prCode || `#${pr.serialNumber}`} — {pr.clientName}
                                {isInvoiced && <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-1.5 py-0.5 rounded font-semibold">Invoiced</span>}
                              </div>
                              <div className="text-xs text-muted-foreground">{format(new Date(pr.date), "dd-MM-yyyy")} · {(pr.items || []).filter((i: any) => i.approved).length} approved items</div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                    <div className="pt-2 border-t mt-2 flex gap-2">
                      <Button size="sm" variant="ghost" className="text-xs" onClick={() => setSelectedPrIds(approvedPRs.map((p: any) => p.id))}>
                        Select All
                      </Button>
                      <Button size="sm" variant="ghost" className="text-xs" onClick={() => setSelectedPrIds([])}>
                        Clear
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>

                {selectedPrIds.length > 0 && (
                  <Button
                    type="button"
                    onClick={loadItemsFromSelectedPRs}
                    className="w-full bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 border-0 text-white"
                    data-testid="button-load-pr-items"
                  >
                    <ListChecks className="w-4 h-4 mr-2" />
                    Load Items from {selectedPrIds.length} Selected PR{selectedPrIds.length > 1 ? 's' : ''}
                  </Button>
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
                        {item.prDate && (
                          <div className="text-[10px] text-rose-500 dark:text-rose-400 font-medium mt-0.5 pl-1">PR: {format(new Date(item.prDate), "dd-MM-yyyy")}</div>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        <Select value={item.uom} onValueChange={(v) => updateItem(index, "uom", v)}>
                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>{UOM_OPTIONS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                      <td className="py-2 px-2">
                        <Input type="number" value={item.qty || ""} onChange={(e) => updateItem(index, "qty", Number(e.target.value) || 0)} className="h-8 text-right" />
                      </td>
                      <td className="py-2 px-2">
                        <Input type="number" value={item.unitPrice || ""} onChange={(e) => updateItem(index, "unitPrice", Number(e.target.value) || 0)} className="h-8 text-right" />
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-xs text-muted-foreground">{item.totalPrice.toFixed(2)}</td>
                      <td className="py-2 px-2">
                        <Select value={item.gstRate.toString()} onValueChange={(v) => updateItem(index, "gstRate", Number(v))}>
                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>{GST_RATES.map(r => <SelectItem key={r} value={r.toString()}>{r}%</SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-xs text-muted-foreground">{item.gstAmount.toFixed(2)}</td>
                      <td className="py-2 px-2">
                        <Input type="number" value={item.netAmount || ""} onChange={(e) => updateItem(index, "netAmount", Number(e.target.value) || 0)} className="h-8 text-right font-mono font-semibold text-rose-600 dark:text-rose-400" />
                      </td>
                      <td className="py-2 px-2">
                        <Button size="sm" variant="ghost" onClick={() => removeItem(index)} className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10" disabled={items.length <= 1}>
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
                <div key={index} className="p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">Item #{index + 1}</span>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => removeItem(index)} disabled={items.length <= 1}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Item Name</Label>
                    <Input value={item.itemName} onChange={(e) => updateItem(index, "itemName", e.target.value)} list="invoice-item-suggestions" placeholder="Enter item name" className="h-9 mt-1" />
                    {item.prDate && (
                      <div className="text-[10px] text-rose-500 dark:text-rose-400 font-medium mt-1 pl-0.5">PR Date: {format(new Date(item.prDate), "dd-MM-yyyy")}</div>
                    )}
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
                      <Input type="number" value={item.netAmount || ""} onChange={(e) => updateItem(index, "netAmount", Number(e.target.value) || 0)} className="h-9 mt-1 text-right font-mono font-semibold text-rose-600 dark:text-rose-400" />
                    </div>
                  </div>
                </div>
              ))}
              <div className="p-3 bg-rose-50 dark:bg-rose-950/20 space-y-1.5">
                <div className="flex justify-between text-sm text-muted-foreground"><span>Total Price</span><span className="font-mono">₹{totals.totalPrice.toFixed(2)}</span></div>
                <div className="flex justify-between text-sm text-muted-foreground"><span>Total GST</span><span className="font-mono">₹{totals.gstAmount.toFixed(2)}</span></div>
                <div className="flex justify-between text-base font-bold text-rose-600 dark:text-rose-400 border-t border-rose-200 dark:border-rose-800/50 pt-1.5"><span>Grand Total</span><span className="font-mono">₹{totals.netAmount.toFixed(2)}</span></div>
              </div>
            </div>

            <div className="p-3 border-t">
              <Button variant="outline" onClick={addItem} className="w-full gap-1.5" data-testid="button-add-item-bottom">
                <Plus className="w-4 h-4" /> Add Another Item
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Payment Tracking Card — shown in both new and edit mode */}
        <Card className="border-0 shadow-lg overflow-hidden">
          <CardHeader className={`pb-3 pt-4 text-white ${isPaid ? 'bg-gradient-to-r from-emerald-500 to-green-600' : 'bg-gradient-to-r from-violet-600 to-purple-700'}`}>
            <CardTitle className="flex items-center justify-between text-base">
              <div className="flex items-center gap-2">
                {isPaid ? <CheckCircle2 className="w-5 h-5" /> : <IndianRupee className="w-5 h-5" />}
                Payment Tracking
                {isPaid && <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full font-semibold">FULLY PAID</span>}
              </div>
              {editId && (
                <div className="flex items-center gap-3 text-xs text-white/80">
                  <span>Grand Total: <span className="font-mono font-bold text-white">₹{totals.netAmount.toFixed(2)}</span></span>
                  <span>Paid: <span className="font-mono font-bold text-white">₹{totalPaid.toFixed(2)}</span></span>
                  {!isPaid && balance > 0 && <span>Balance: <span className="font-mono font-bold text-yellow-200">₹{balance.toFixed(2)}</span></span>}
                </div>
              )}
            </CardTitle>
          </CardHeader>

          <CardContent className="p-4 sm:p-6 space-y-4">
            {!editId && (
              <p className="text-sm text-muted-foreground text-center py-2 bg-muted/30 rounded-lg">
                Save the invoice first, then come back to record payments here.
              </p>
            )}

            {editId && (
              <>
                {/* Payment progress bar */}
                {totals.netAmount > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Payment Progress</span>
                      <span className="font-semibold">{Math.min(100, Math.round((totalPaid / totals.netAmount) * 100))}%</span>
                    </div>
                    <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${isPaid ? 'bg-emerald-500' : 'bg-violet-500'}`}
                        style={{ width: `${Math.min(100, (totalPaid / totals.netAmount) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Existing payments list */}
                {payments.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                      <CalendarCheck className="w-4 h-4" /> Payment Records ({djInvoiceNo})
                    </h4>
                    <div className="border rounded-lg divide-y overflow-hidden">
                      {payments.map((p: any, idx: number) => (
                        <div key={p.id} className="flex items-center justify-between px-3 py-2.5 bg-white dark:bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800/20" data-testid={`payment-record-${p.id}`}>
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 flex items-center justify-center text-xs font-bold shrink-0">{idx + 1}</div>
                            <div>
                              <div className="text-sm font-semibold">₹{Number(p.amount).toFixed(2)}</div>
                              <div className="text-xs text-muted-foreground">{format(new Date(p.paymentDate), "dd-MM-yyyy")}{p.notes && ` · ${p.notes}`}</div>
                            </div>
                          </div>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10" data-testid={`button-delete-payment-${p.id}`}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete this payment record?</AlertDialogTitle>
                                <AlertDialogDescription>Payment of ₹{Number(p.amount).toFixed(2)} on {format(new Date(p.paymentDate), "dd-MM-yyyy")} will be removed.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deletePaymentMutation.mutate(p.id)} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add payment form */}
                <div className="space-y-3 border border-dashed border-violet-200 dark:border-violet-800/50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold flex items-center gap-1.5 text-violet-700 dark:text-violet-400">
                    <Plus className="w-4 h-4" /> Add Payment Record
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Payment Date</Label>
                      <DatePicker date={newPaymentDate} setDate={(d) => d && setNewPaymentDate(d)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Amount (₹)</Label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={newPaymentAmount}
                        onChange={(e) => setNewPaymentAmount(e.target.value)}
                        className="font-mono"
                        data-testid="input-payment-amount"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Notes (optional)</Label>
                      <Input
                        placeholder="e.g. Cheque No."
                        value={newPaymentNotes}
                        onChange={(e) => setNewPaymentNotes(e.target.value)}
                        data-testid="input-payment-notes"
                      />
                    </div>
                  </div>
                  <Button
                    onClick={handleAddPayment}
                    disabled={addPaymentMutation.isPending || !newPaymentAmount}
                    className="w-full bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800 text-white gap-2"
                    data-testid="button-add-payment"
                  >
                    {addPaymentMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                    Record Payment
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Bottom save button */}
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
