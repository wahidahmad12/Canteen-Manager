import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useClientNames, useCurrentUser } from "@/hooks/use-reports";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText, Plus, Save, Loader2, Pencil, Trash2, Search,
  CalendarDays, Building2, Receipt, IndianRupee, Percent,
  CheckCircle2, XCircle, X, BarChart3, ClipboardList, AlertTriangle,
  Printer, User, Check, TrendingUp, FileDown
} from "lucide-react";
import { Link } from "wouter";
import { DateEntryTab } from "./date-entry-tab";

interface PurchaseOrderType {
  id: number;
  poNumber: string;
  poDate: string;
  poAmount: string;
  clientName: string;
  createdBy: string | null;
}

interface SalesInvoice {
  id: number;
  slNo: number;
  poId: number | null;
  clientName: string;
  billDate: string;
  billNumber: string;
  billAmount: string;
  gstPercent: string;
  gstAmount: string;
  totalBillAmount: string;
  tdsPercent: string;
  tdsAmount: string;
  paymentReceivedDate: string | null;
  paymentReceivedAmount: string;
  utrNo: string | null;
  createdBy: string | null;
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return format(dt, "dd-MM-yyyy");
  } catch { return d; }
}

function fmtCurrency(v: string | number) {
  const n = Number(v);
  if (isNaN(n)) return "₹0.00";
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ViewInvoiceDialog({ invoice, onClose, poName, onEdit }: { invoice: SalesInvoice; onClose: () => void; poName: string | null; onEdit: () => void }) {
  const toReceive = Math.round((Number(invoice.totalBillAmount) - Number(invoice.tdsAmount)) * 100) / 100;
  const received = Math.round(Number(invoice.paymentReceivedAmount) * 100) / 100;
  const balance = Math.round((toReceive - received) * 100) / 100;
  const status = toReceive > 0 && received >= toReceive ? "full" : toReceive > 0 && received > 0 && received < toReceive ? "partial" : "due";
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg w-full max-h-[90vh] overflow-y-auto p-0">
        <div className={`h-1.5 rounded-t-lg ${status === "full" ? "bg-gradient-to-r from-green-400 to-emerald-500" : status === "partial" ? "bg-gradient-to-r from-amber-400 to-yellow-500" : "bg-gradient-to-r from-orange-400 to-red-500"}`} />
        <div className="p-5 space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">{invoice.slNo}</div>
                <div>
                  <p className="text-base font-bold leading-tight">{invoice.clientName}</p>
                  <p className="text-xs text-muted-foreground font-normal">{invoice.billNumber}</p>
                </div>
              </div>
              {status === "full" ? (
                <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs shrink-0"><CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Full Paid</Badge>
              ) : status === "partial" ? (
                <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs shrink-0"><IndianRupee className="w-3.5 h-3.5 mr-1" /> Partial Received</Badge>
              ) : (
                <Badge variant="outline" className="text-red-600 border-red-300 dark:border-red-700 text-xs shrink-0"><XCircle className="w-3.5 h-3.5 mr-1" /> Payment Due</Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Bill Date</p>
              <p className="font-medium">{fmtDate(invoice.billDate)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Bill Number</p>
              <p className="font-mono font-medium">{invoice.billNumber}</p>
            </div>
            {poName && (
              <div className="col-span-2 space-y-1">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Purchase Order</p>
                <Badge variant="outline" className="text-[11px] border-cyan-300 text-cyan-700 dark:border-cyan-700 dark:text-cyan-400">{poName}</Badge>
              </div>
            )}
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/40 rounded-xl p-3 space-y-2">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Bill Breakdown</p>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bill Amount</span>
                <span className="font-mono font-semibold">{fmtCurrency(invoice.billAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">GST ({Number(invoice.gstPercent)}%)</span>
                <span className="font-mono text-orange-600">+ {fmtCurrency(invoice.gstAmount)}</span>
              </div>
              <div className="flex justify-between border-t pt-1.5 font-semibold">
                <span>Total Bill</span>
                <span className="font-mono text-violet-700 dark:text-violet-400">{fmtCurrency(invoice.totalBillAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">TDS ({Number(invoice.tdsPercent)}%)</span>
                <span className="font-mono text-red-500">− {fmtCurrency(invoice.tdsAmount)}</span>
              </div>
              <div className="flex justify-between border-t pt-1.5 font-bold text-blue-700 dark:text-blue-400">
                <span>Net Receivable</span>
                <span className="font-mono">{fmtCurrency(toReceive)}</span>
              </div>
            </div>
          </div>

          <div className="bg-green-50 dark:bg-green-950/20 rounded-xl p-3 space-y-2 border border-green-200 dark:border-green-800">
            <p className="text-[10px] font-bold text-green-700 dark:text-green-400 uppercase tracking-wide">Payment Details</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-[10px] text-muted-foreground">Payment Date</p>
                <p className="font-medium">{fmtDate(invoice.paymentReceivedDate)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Amount Received</p>
                <p className="font-mono font-semibold text-green-700 dark:text-green-400">{fmtCurrency(received)}</p>
              </div>
            </div>
            {invoice.utrNo && (
              <div>
                <p className="text-[10px] text-muted-foreground">UTR / Reference No.</p>
                <p className="font-mono font-semibold text-cyan-700 dark:text-cyan-400 text-sm break-all">{invoice.utrNo}</p>
              </div>
            )}
            {balance > 0 && (
              <div className="border-t border-green-200 dark:border-green-800 pt-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-orange-600 dark:text-orange-400 font-medium">Balance Pending</span>
                  <span className="font-mono font-bold text-orange-600 dark:text-orange-400">{fmtCurrency(balance)}</span>
                </div>
              </div>
            )}
          </div>

          {invoice.createdBy && (
            <p className="text-[10px] text-muted-foreground flex items-center gap-1"><User className="w-3 h-3" /> Created by {invoice.createdBy}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose} size="sm">Close</Button>
            <Button size="sm" className="bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white" onClick={onEdit}><Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit Invoice</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InvoiceFormDialog({ invoice, onClose, clients, purchaseOrders, allInvoices }: { invoice?: SalesInvoice | null; onClose: () => void; clients: any[]; purchaseOrders: PurchaseOrderType[]; allInvoices: SalesInvoice[] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = !!invoice;

  const [clientName, setClientName] = useState(invoice?.clientName || "");
  const [billDate, setBillDate] = useState<Date>(invoice?.billDate ? new Date(invoice.billDate) : new Date());
  const [billNumber, setBillNumber] = useState(invoice?.billNumber || "");
  const [billNumberAuto, setBillNumberAuto] = useState(false);
  const [selectedPoId, setSelectedPoId] = useState<string>(invoice?.poId ? String(invoice.poId) : "none");
  const [bypassPO, setBypassPO] = useState(false);
  const [billAmount, setBillAmount] = useState(invoice ? Number(invoice.billAmount) : 0);
  const [gstPercent, setGstPercent] = useState(invoice ? Number(invoice.gstPercent) : 5);
  const [tdsPercent, setTdsPercent] = useState(invoice ? Number(invoice.tdsPercent) : 2);
  const [paymentReceivedDate, setPaymentReceivedDate] = useState<Date | undefined>(
    invoice?.paymentReceivedDate ? new Date(invoice.paymentReceivedDate) : undefined
  );
  const [paymentReceivedAmount, setPaymentReceivedAmount] = useState(invoice ? Number(invoice.paymentReceivedAmount) : 0);
  const [utrNo, setUtrNo] = useState(invoice?.utrNo || "");

  const gstAmount = Math.round(billAmount * gstPercent / 100 * 100) / 100;
  const totalBillAmount = Math.round((billAmount + gstAmount) * 100) / 100;
  const tdsAmount = Math.round(billAmount * tdsPercent / 100 * 100) / 100;

  const clientPOs = purchaseOrders.filter(po => po.clientName === clientName);

  const selectedPO = selectedPoId !== "none" ? purchaseOrders.find(po => po.id === Number(selectedPoId)) : null;
  const poUsedAmount = selectedPO
    ? allInvoices
        .filter(inv => inv.poId === selectedPO.id && inv.id !== invoice?.id)
        .reduce((sum, inv) => sum + Number(inv.billAmount), 0)
    : 0;
  const poBalance = selectedPO ? Math.round((Number(selectedPO.poAmount) - poUsedAmount) * 100) / 100 : 0;
  const isBillExceedsPO = selectedPO && !bypassPO ? billAmount > poBalance : false;

  useEffect(() => {
    if (isEdit || !clientName) return;
    const client = clients.find((c: any) => c.name === clientName);
    if (!client?.stateCode) return;
    const yr = String(billDate.getFullYear()).slice(-2);
    fetch(`/api/sales-invoices/next-bill-number?stateCode=${encodeURIComponent(client.stateCode)}&year=${billDate.getFullYear()}`, { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        if (data.billNumber) {
          setBillNumber(data.billNumber);
          setBillNumberAuto(true);
        }
      })
      .catch(() => {});
  }, [clientName, billDate, isEdit, clients]);

  useEffect(() => {
    setSelectedPoId(invoice?.poId ? String(invoice.poId) : "none");
  }, [clientName]);

  const billNumberPattern = /^DJ-[A-Z]{2,5}-\d{2}-\d{3,}$/;
  const isBillNumberValid = billNumberPattern.test(billNumber);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/sales-invoices", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data), credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to create sales invoice");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      toast({ title: "Success", description: "Sales invoice created" });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/sales-invoices/${invoice!.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data), credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to update sales invoice");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      toast({ title: "Success", description: "Sales invoice updated" });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!clientName) {
      toast({ title: "Error", description: "Select a client", variant: "destructive" });
      return;
    }
    if (!billNumber.trim()) {
      toast({ title: "Error", description: "Enter bill number", variant: "destructive" });
      return;
    }
    if (!isBillNumberValid) {
      toast({ title: "Error", description: "Bill number must be in format DJ-CODE-YY-NNN (e.g. DJ-KOL-25-001)", variant: "destructive" });
      return;
    }
    // Validate state code in bill number matches the selected client's state code
    const billCodeMatch = billNumber.trim().match(/^DJ-([A-Z]{2,5})-/);
    const billStateCode = billCodeMatch ? billCodeMatch[1] : null;
    const selectedClient = clients.find((c: any) => c.name === clientName);
    const clientStateCode = selectedClient?.stateCode?.trim().toUpperCase();
    if (billStateCode && clientStateCode && billStateCode !== clientStateCode) {
      toast({
        title: "State Code Mismatch",
        description: `Bill Number code "${billStateCode}" does not match client's state code "${clientStateCode}". Please correct the Bill Number.`,
        variant: "destructive",
      });
      return;
    }
    if (isBillExceedsPO) {
      toast({ title: "Error", description: `Bill Amount (${fmtCurrency(billAmount)}) exceeds PO remaining balance (${fmtCurrency(poBalance)})`, variant: "destructive" });
      return;
    }
    const payload = {
      clientName,
      billDate: format(billDate, "yyyy-MM-dd"),
      billNumber: billNumber.trim(),
      billAmount,
      gstPercent,
      gstAmount,
      totalBillAmount,
      tdsPercent,
      tdsAmount,
      paymentReceivedDate: paymentReceivedDate ? format(paymentReceivedDate, "yyyy-MM-dd") : null,
      paymentReceivedAmount,
      utrNo: utrNo.trim() || null,
      poId: selectedPoId !== "none" ? Number(selectedPoId) : null,
      bypassPO,
    };
    if (isEdit) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5" /> Client Name
          </Label>
          <Select value={clientName} onValueChange={setClientName} data-testid="select-sales-client">
            <SelectTrigger className="h-10 border-indigo-200 dark:border-indigo-800" data-testid="select-sales-client-trigger">
              <SelectValue placeholder="Select client" />
            </SelectTrigger>
            <SelectContent>
              {clients?.map((c: any) => (
                <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5" /> Bill Date
          </Label>
          <DatePicker date={billDate} setDate={(d) => d && setBillDate(d)} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold text-purple-700 dark:text-purple-400 flex items-center gap-1.5">
            <Receipt className="w-3.5 h-3.5" /> Bill Number
          </Label>
          <div className="relative">
            <Input
              value={billNumber}
              onChange={(e) => { setBillNumber(e.target.value.toUpperCase()); setBillNumberAuto(false); }}
              placeholder="DJ-KOL-25-001"
              className={`h-10 font-mono pr-8 ${billNumber && !isBillNumberValid ? 'border-red-400 focus:border-red-500' : billNumber && isBillNumberValid ? 'border-green-400 focus:border-green-500' : ''}`}
              data-testid="input-bill-number"
            />
            {billNumber && (
              <span className="absolute right-2 top-1/2 -translate-y-1/2">
                {isBillNumberValid ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-400" />}
              </span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">Format: DJ-CODE-YY-NNN (auto-generated from client)</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
            <IndianRupee className="w-3.5 h-3.5" /> Bill Amount
          </Label>
          <Input
            type="number"
            value={billAmount || ""}
            onChange={(e) => setBillAmount(Number(e.target.value))}
            className="h-10 font-mono"
            min={0}
            data-testid="input-bill-amount"
          />
        </div>
      </div>

      <div className="bg-gradient-to-r from-cyan-50 to-sky-50 dark:from-cyan-950/20 dark:to-sky-950/20 rounded-xl p-3 space-y-3 border border-cyan-200 dark:border-cyan-800">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-cyan-700 dark:text-cyan-400 uppercase tracking-wide flex items-center gap-1.5">
            <ClipboardList className="w-3.5 h-3.5" /> Purchase Order (PO)
          </p>
          {selectedPO && (
            <Button
              type="button"
              size="sm"
              variant={bypassPO ? "default" : "outline"}
              className={`h-6 text-[10px] px-2 ${bypassPO ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'border-orange-300 text-orange-600 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400'}`}
              onClick={() => setBypassPO(!bypassPO)}
              data-testid="button-bypass-po"
            >
              {bypassPO ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
              Bypass PO
            </Button>
          )}
        </div>
        <div className="space-y-2">
          <Select value={selectedPoId} onValueChange={setSelectedPoId} data-testid="select-po">
            <SelectTrigger className="h-9 border-cyan-200 dark:border-cyan-800" data-testid="select-po-trigger">
              <SelectValue placeholder="Select PO (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No PO</SelectItem>
              {clientPOs.map(po => (
                <SelectItem key={po.id} value={String(po.id)}>
                  {po.poNumber} — {fmtCurrency(po.poAmount)} ({fmtDate(po.poDate)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedPO && (
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="bg-cyan-100 dark:bg-cyan-900/30 rounded-md p-2 text-center">
                <p className="text-[10px] text-cyan-600 dark:text-cyan-400">PO Amount</p>
                <p className="font-mono font-bold text-cyan-800 dark:text-cyan-200">{fmtCurrency(selectedPO.poAmount)}</p>
              </div>
              <div className="bg-amber-100 dark:bg-amber-900/30 rounded-md p-2 text-center">
                <p className="text-[10px] text-amber-600 dark:text-amber-400">Used</p>
                <p className="font-mono font-bold text-amber-800 dark:text-amber-200">{fmtCurrency(poUsedAmount)}</p>
              </div>
              <div className={`rounded-md p-2 text-center ${isBillExceedsPO ? 'bg-red-100 dark:bg-red-900/30' : 'bg-green-100 dark:bg-green-900/30'}`}>
                <p className={`text-[10px] ${isBillExceedsPO ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>Balance</p>
                <p className={`font-mono font-bold ${isBillExceedsPO ? 'text-red-800 dark:text-red-200' : 'text-green-800 dark:text-green-200'}`}>{fmtCurrency(poBalance)}</p>
              </div>
            </div>
          )}
          {selectedPO && billAmount > poBalance && !bypassPO && (
            <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 text-xs bg-red-50 dark:bg-red-950/30 rounded-md px-2.5 py-1.5">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Bill Amount exceeds PO remaining balance. Turn on "Bypass PO" to save anyway.</span>
            </div>
          )}
          {bypassPO && (
            <div className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400 text-xs bg-orange-50 dark:bg-orange-950/30 rounded-md px-2.5 py-1.5">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Bypass PO is ON — PO balance check will be skipped.</span>
            </div>
          )}
          {!clientName && (
            <p className="text-[10px] text-muted-foreground">Select a client first to see available POs</p>
          )}
          {clientName && clientPOs.length === 0 && (
            <p className="text-[10px] text-muted-foreground">No POs found for this client. Add POs in the Purchase Orders tab.</p>
          )}
        </div>
      </div>

      <div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 rounded-xl p-3 space-y-3 border border-orange-200 dark:border-orange-800">
        <p className="text-xs font-bold text-orange-700 dark:text-orange-400 uppercase tracking-wide">GST Calculation</p>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1"><Percent className="w-3 h-3" /> GST %</Label>
            <Input type="number" value={gstPercent || ""} onChange={(e) => setGstPercent(Number(e.target.value))} className="h-9 font-mono text-sm" min={0} data-testid="input-gst-percent" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-orange-600 dark:text-orange-400">GST Amount</Label>
            <div className="h-9 flex items-center px-3 bg-orange-100 dark:bg-orange-900/30 rounded-md font-mono text-sm" data-testid="text-gst-amount">{fmtCurrency(gstAmount)}</div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-orange-600 dark:text-orange-400 font-bold">Total Bill</Label>
            <div className="h-9 flex items-center px-3 bg-orange-200 dark:bg-orange-800/40 rounded-md font-mono text-sm font-bold" data-testid="text-total-bill">{fmtCurrency(totalBillAmount)}</div>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-950/20 dark:to-pink-950/20 rounded-xl p-3 space-y-3 border border-red-200 dark:border-red-800">
        <p className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wide">TDS Deduction</p>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1"><Percent className="w-3 h-3" /> TDS %</Label>
            <Input type="number" value={tdsPercent || ""} onChange={(e) => setTdsPercent(Number(e.target.value))} className="h-9 font-mono text-sm" min={0} data-testid="input-tds-percent" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-red-600 dark:text-red-400">TDS Amount</Label>
            <div className="h-9 flex items-center px-3 bg-red-100 dark:bg-red-900/30 rounded-md font-mono text-sm" data-testid="text-tds-amount">{fmtCurrency(tdsAmount)}</div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1"><IndianRupee className="w-3 h-3" /> To Receive</Label>
            <div className="h-9 flex items-center px-3 bg-emerald-200 dark:bg-emerald-800/40 rounded-md font-mono text-sm font-bold text-emerald-700 dark:text-emerald-300" data-testid="text-to-receive">{fmtCurrency(Math.round((totalBillAmount - tdsAmount) * 100) / 100)}</div>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 rounded-xl p-3 space-y-3 border border-green-200 dark:border-green-800">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-wide">Payment Received</p>
          {(paymentReceivedDate || paymentReceivedAmount > 0 || utrNo) && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 gap-1 px-2"
              onClick={() => { setPaymentReceivedDate(undefined); setPaymentReceivedAmount(0); setUtrNo(""); }}
              data-testid="button-clear-payment"
            >
              <Trash2 className="w-3 h-3" /> Delete Payment
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1"><CalendarDays className="w-3 h-3" /> Payment Date</Label>
            <div className="flex gap-1">
              <div className="flex-1">
                <DatePicker date={paymentReceivedDate} setDate={(d) => setPaymentReceivedDate(d)} placeholder="Not received yet" />
              </div>
              {paymentReceivedDate && (
                <Button type="button" size="icon" variant="ghost" className="h-9 w-9 text-gray-400 hover:text-red-500 shrink-0" onClick={() => setPaymentReceivedDate(undefined)} data-testid="button-clear-pmt-date" title="Clear date">
                  <X className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1"><IndianRupee className="w-3 h-3" /> Amount Received</Label>
            <Input type="number" value={paymentReceivedAmount || ""} onChange={(e) => setPaymentReceivedAmount(Number(e.target.value))} className="h-9 font-mono text-sm" min={0} data-testid="input-payment-received" />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1"><FileText className="w-3 h-3" /> UTR No. (Transaction Reference)</Label>
          <Input value={utrNo} onChange={(e) => setUtrNo(e.target.value)} placeholder="Enter UTR / reference number" className="h-9 font-mono text-sm tracking-wider" data-testid="input-utr-no" />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="outline" onClick={onClose} data-testid="button-cancel-invoice">Cancel</Button>
        <Button onClick={handleSave} disabled={isPending} className="bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white" data-testid="button-save-invoice">
          {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          {isEdit ? "Update" : "Save"} Invoice
        </Button>
      </div>
    </div>
  );
}

function POFormDialog({ po, onClose, clients }: { po?: PurchaseOrderType | null; onClose: () => void; clients: any[] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = !!po;

  const [poNumber, setPoNumber] = useState(po?.poNumber || "");
  const [poDate, setPoDate] = useState<Date>(po?.poDate ? new Date(po.poDate) : new Date());
  const [poAmount, setPoAmount] = useState(po ? Number(po.poAmount) : 0);
  const [clientName, setClientName] = useState(po?.clientName || "");

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/purchase-orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data), credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to create Purchase Order");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      toast({ title: "Success", description: "Purchase Order created" });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/purchase-orders/${po!.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data), credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to update Purchase Order");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      toast({ title: "Success", description: "Purchase Order updated" });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!clientName) {
      toast({ title: "Error", description: "Select a client", variant: "destructive" });
      return;
    }
    if (!poNumber.trim()) {
      toast({ title: "Error", description: "Enter PO Number", variant: "destructive" });
      return;
    }
    if (poAmount <= 0) {
      toast({ title: "Error", description: "PO Amount must be greater than 0", variant: "destructive" });
      return;
    }
    const payload = {
      poNumber: poNumber.trim(),
      poDate: format(poDate, "yyyy-MM-dd"),
      poAmount,
      clientName,
    };
    if (isEdit) updateMutation.mutate(payload);
    else createMutation.mutate(payload);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5" /> Client Name
          </Label>
          <Select value={clientName} onValueChange={setClientName} data-testid="select-po-client">
            <SelectTrigger className="h-10 border-indigo-200 dark:border-indigo-800" data-testid="select-po-client-trigger">
              <SelectValue placeholder="Select client" />
            </SelectTrigger>
            <SelectContent>
              {clients?.map((c: any) => (
                <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold text-cyan-700 dark:text-cyan-400 flex items-center gap-1.5">
            <ClipboardList className="w-3.5 h-3.5" /> PO Number
          </Label>
          <Input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="e.g. PO-2025-001" className="h-10" data-testid="input-po-number" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5" /> PO Date
          </Label>
          <DatePicker date={poDate} setDate={(d) => d && setPoDate(d)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
            <IndianRupee className="w-3.5 h-3.5" /> PO Amount
          </Label>
          <Input type="number" value={poAmount || ""} onChange={(e) => setPoAmount(Number(e.target.value))} className="h-10 font-mono" min={0} data-testid="input-po-amount" />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="outline" onClick={onClose} data-testid="button-cancel-po">Cancel</Button>
        <Button onClick={handleSave} disabled={isPending} className="bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white" data-testid="button-save-po">
          {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          {isEdit ? "Update" : "Save"} PO
        </Button>
      </div>
    </div>
  );
}

export default function SalesInvoicePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: clients = [] } = useClientNames();
  const { data: currentUser } = useCurrentUser();
  const canSeeDataEntry = currentUser?.role === "admin" ||
    currentUser?.permissions?.includes("dateentry_ubl") ||
    currentUser?.permissions?.includes("dateentry_cipla");
  const { data: invoices = [], isLoading } = useQuery<SalesInvoice[]>({
    queryKey: ["/api/sales-invoices"],
  });
  const { data: purchaseOrders = [], isLoading: posLoading } = useQuery<PurchaseOrderType[]>({
    queryKey: ["/api/purchase-orders"],
  });

  const [activeTab, setActiveTab] = useState("invoices");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<SalesInvoice | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<SalesInvoice | null>(null);
  const [poDialogOpen, setPoDialogOpen] = useState(false);
  const [editingPO, setEditingPO] = useState<PurchaseOrderType | null>(null);
  const [viewingPo, setViewingPo] = useState<PurchaseOrderType | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterClient, setFilterClient] = useState("all");
  const [filterMonth, setFilterMonth] = useState("all");
  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()));
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterUtrNo, setFilterUtrNo] = useState("");

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/sales-invoices/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-invoices"] });
      toast({ title: "Deleted", description: "Sales invoice deleted" });
    },
  });

  const deletePoMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/purchase-orders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      toast({ title: "Deleted", description: "Purchase Order deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const years = Array.from(new Set(invoices.map(i => {
    try { return new Date(i.billDate).getFullYear(); } catch { return new Date().getFullYear(); }
  }))).sort((a, b) => b - a);
  if (!years.includes(new Date().getFullYear())) years.unshift(new Date().getFullYear());

  const filteredInvoices = invoices.filter(inv => {
    if (filterClient !== "all" && inv.clientName !== filterClient) return false;
    if (filterMonth !== "all" || filterYear !== "all") {
      try {
        const d = new Date(inv.billDate);
        if (filterYear !== "all" && d.getFullYear() !== Number(filterYear)) return false;
        if (filterMonth !== "all" && d.getMonth() !== Number(filterMonth)) return false;
      } catch { return false; }
    }
    if (filterStatus !== "all") {
      const toRec = Math.round((Number(inv.totalBillAmount) - Number(inv.tdsAmount)) * 100) / 100;
      const rcvd = Math.round(Number(inv.paymentReceivedAmount) * 100) / 100;
      const st = toRec > 0 && rcvd >= toRec ? "received" : toRec > 0 && rcvd > 0 && rcvd < toRec ? "partial" : "pending";
      if (filterStatus === "pending" && st !== "pending") return false;
      if (filterStatus === "received" && st !== "received") return false;
      if (filterStatus === "partial" && st !== "partial") return false;
    }
    if (filterUtrNo.trim()) {
      const u = filterUtrNo.trim().toLowerCase();
      if (!inv.utrNo || !inv.utrNo.toLowerCase().includes(u)) return false;
    }
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      return inv.billNumber.toLowerCase().includes(s) || inv.clientName.toLowerCase().includes(s);
    }
    return true;
  });

  const totalBilled = filteredInvoices.reduce((s, i) => s + Number(i.totalBillAmount), 0);
  const totalReceived = filteredInvoices.reduce((s, i) => s + Number(i.paymentReceivedAmount), 0);
  const totalOutstanding = totalBilled - totalReceived;
  const paidCount = filteredInvoices.filter(i => { const tr = Math.round((Number(i.totalBillAmount) - Number(i.tdsAmount)) * 100) / 100; const rc = Math.round(Number(i.paymentReceivedAmount) * 100) / 100; return tr > 0 && rc >= tr; }).length;

  const openNew = () => { setEditingInvoice(null); setDialogOpen(true); };
  const openEdit = (inv: SalesInvoice) => { setViewingInvoice(null); setEditingInvoice(inv); setDialogOpen(true); };
  const openView = (inv: SalesInvoice) => { setViewingInvoice(inv); };
  const closeDialog = () => { setDialogOpen(false); setEditingInvoice(null); };
  const openNewPO = () => { setEditingPO(null); setPoDialogOpen(true); };
  const openEditPO = (po: PurchaseOrderType) => { setEditingPO(po); setPoDialogOpen(true); };
  const closePoDialog = () => { setPoDialogOpen(false); setEditingPO(null); };

  const getPoBalance = (po: PurchaseOrderType) => {
    const used = invoices.filter(inv => inv.poId === po.id).reduce((sum, inv) => sum + Number(inv.billAmount), 0);
    return Math.round((Number(po.poAmount) - used) * 100) / 100;
  };

  const getPoUsed = (po: PurchaseOrderType) => {
    return invoices.filter(inv => inv.poId === po.id).reduce((sum, inv) => sum + Number(inv.billAmount), 0);
  };

  const getPoLinkedCount = (po: PurchaseOrderType) => {
    return invoices.filter(inv => inv.poId === po.id).length;
  };

  const getPoName = (poId: number | null) => {
    if (!poId) return null;
    const po = purchaseOrders.find(p => p.id === poId);
    return po?.poNumber || null;
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-2 sm:px-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-violet-200 dark:shadow-violet-900/30">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold" data-testid="text-sales-title">Sales Invoice Ledger</h2>
              <p className="text-xs sm:text-sm text-muted-foreground">Track all your sales invoices & payments</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/sales-dashboard">
              <Button variant="outline" size="sm" className="border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-400" data-testid="button-sales-dashboard">
                <BarChart3 className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Dashboard</span>
              </Button>
            </Link>
          </div>

          <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) closeDialog(); }}>
            <DialogContent className="max-w-lg sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-violet-600" />
                  {editingInvoice ? "Edit Sales Invoice" : "New Sales Invoice"}
                </DialogTitle>
              </DialogHeader>
              {dialogOpen && <InvoiceFormDialog key={editingInvoice?.id || 'new'} invoice={editingInvoice} onClose={closeDialog} clients={clients} purchaseOrders={purchaseOrders} allInvoices={invoices} />}
            </DialogContent>
          </Dialog>

          {viewingInvoice && <ViewInvoiceDialog invoice={viewingInvoice} onClose={() => setViewingInvoice(null)} poName={getPoName(viewingInvoice.poId)} onEdit={() => openEdit(viewingInvoice)} />}

          <Dialog open={poDialogOpen} onOpenChange={(o) => { if (!o) closePoDialog(); }}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-cyan-600" />
                  {editingPO ? "Edit Purchase Order" : "New Purchase Order"}
                </DialogTitle>
              </DialogHeader>
              {poDialogOpen && <POFormDialog key={editingPO?.id || 'new-po'} po={editingPO} onClose={closePoDialog} clients={clients} />}
            </DialogContent>
          </Dialog>

          {/* PO Linked Invoices Dialog */}
          <Dialog open={!!viewingPo} onOpenChange={(o) => { if (!o) setViewingPo(null); }}>
            <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <ClipboardList className="w-5 h-5 text-violet-600" />
                  <span>Invoices linked to PO: <span className="text-violet-700 dark:text-violet-300">{viewingPo?.poNumber}</span></span>
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">{viewingPo?.clientName} &nbsp;•&nbsp; PO Amount: <span className="font-mono font-semibold">{fmtCurrency(viewingPo?.poAmount ?? 0)}</span> &nbsp;•&nbsp; Date: {fmtDate(viewingPo?.poDate)}</p>
              </DialogHeader>
              {viewingPo && (() => {
                const linked = invoices.filter(inv => inv.poId === viewingPo.id);
                const totalBill = linked.reduce((s, i) => s + Number(i.billAmount), 0);
                const totalReceived = linked.reduce((s, i) => s + Number(i.paymentReceivedAmount), 0);
                const balance = Number(viewingPo.poAmount) - totalBill;
                return (
                  <div className="flex flex-col gap-3 overflow-hidden">
                    {/* Summary strip */}
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: "Invoices", value: String(linked.length), cls: "bg-violet-50 dark:bg-violet-950/20 text-violet-700 dark:text-violet-300" },
                        { label: "Total Billed", value: fmtCurrency(totalBill), cls: "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300" },
                        { label: "Received", value: fmtCurrency(totalReceived), cls: "bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300" },
                        { label: "PO Balance", value: fmtCurrency(balance), cls: `${balance >= 0 ? "bg-cyan-50 dark:bg-cyan-950/20 text-cyan-700 dark:text-cyan-300" : "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300"}` },
                      ].map(s => (
                        <div key={s.label} className={`rounded-lg p-2 text-center ${s.cls}`}>
                          <p className="text-[10px] opacity-70 font-medium">{s.label}</p>
                          <p className="font-mono font-bold text-xs sm:text-sm">{s.value}</p>
                        </div>
                      ))}
                    </div>
                    {/* Invoice list */}
                    <div className="overflow-y-auto flex-1 border rounded-lg">
                      {linked.length === 0 ? (
                        <p className="text-center text-sm text-muted-foreground py-8">No invoices linked to this PO.</p>
                      ) : (
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300">
                            <tr>
                              <th className="py-2 px-2 text-center font-semibold">#</th>
                              <th className="py-2 px-2 text-left font-semibold">Bill No</th>
                              <th className="py-2 px-2 text-center font-semibold">Date</th>
                              <th className="py-2 px-2 text-right font-semibold">Bill Amt</th>
                              <th className="py-2 px-2 text-right font-semibold">GST</th>
                              <th className="py-2 px-2 text-right font-semibold">Total</th>
                              <th className="py-2 px-2 text-center font-semibold">Status</th>
                              <th className="py-2 px-2 text-right font-semibold">Received</th>
                            </tr>
                          </thead>
                          <tbody>
                            {linked.map((inv, idx) => {
                              const paid = Number(inv.paymentReceivedAmount) > 0;
                              const pending = Number(inv.totalBillAmount) - Number(inv.paymentReceivedAmount);
                              return (
                                <tr key={inv.id} className={`border-t border-violet-100 dark:border-violet-900/30 ${idx % 2 === 0 ? '' : 'bg-slate-50/50 dark:bg-slate-800/20'}`}>
                                  <td className="py-1.5 px-2 text-center text-muted-foreground">{inv.slNo}</td>
                                  <td className="py-1.5 px-2 font-mono font-medium text-slate-700 dark:text-slate-200">{inv.billNumber}</td>
                                  <td className="py-1.5 px-2 text-center text-muted-foreground">{fmtDate(inv.billDate)}</td>
                                  <td className="py-1.5 px-2 text-right font-mono">{fmtCurrency(inv.billAmount)}</td>
                                  <td className="py-1.5 px-2 text-right font-mono text-slate-500">{fmtCurrency(inv.gstAmount)}</td>
                                  <td className="py-1.5 px-2 text-right font-mono font-semibold">{fmtCurrency(inv.totalBillAmount)}</td>
                                  <td className="py-1.5 px-2 text-center">
                                    {paid && pending <= 0
                                      ? <span className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded-full font-medium">Paid</span>
                                      : paid
                                      ? <span className="text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded-full font-medium">Partial</span>
                                      : <span className="text-[10px] bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-full font-medium">Pending</span>}
                                  </td>
                                  <td className="py-1.5 px-2 text-right font-mono text-green-600 dark:text-green-400">{fmtCurrency(inv.paymentReceivedAmount)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot className="bg-violet-50 dark:bg-violet-950/20 sticky bottom-0">
                            <tr className="border-t-2 border-violet-200 dark:border-violet-700">
                              <td colSpan={3} className="py-2 px-2 text-right font-bold text-violet-700 dark:text-violet-300">Total</td>
                              <td className="py-2 px-2 text-right font-mono font-bold">{fmtCurrency(totalBill)}</td>
                              <td className="py-2 px-2 text-right font-mono font-bold text-slate-500">{fmtCurrency(linked.reduce((s,i) => s+Number(i.gstAmount), 0))}</td>
                              <td className="py-2 px-2 text-right font-mono font-bold">{fmtCurrency(linked.reduce((s,i) => s+Number(i.totalBillAmount), 0))}</td>
                              <td />
                              <td className="py-2 px-2 text-right font-mono font-bold text-green-600 dark:text-green-400">{fmtCurrency(totalReceived)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      )}
                    </div>
                  </div>
                );
              })()}
            </DialogContent>
          </Dialog>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-5">
          <div className="tabs-scroll-wrap">
            <TabsList className="bg-violet-100 dark:bg-violet-950/30 inline-flex min-w-full sm:w-auto">
              <TabsTrigger value="invoices" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 flex items-center gap-1 text-xs sm:text-sm sm:gap-1.5 whitespace-nowrap min-h-[44px] flex-1 sm:flex-none" data-testid="tab-invoices">
                <FileText className="w-3.5 h-3.5 shrink-0" /> <span className="hidden sm:inline">Sales&nbsp;</span>Invoices
              </TabsTrigger>
              <TabsTrigger value="purchase-orders" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 flex items-center gap-1 text-xs sm:text-sm sm:gap-1.5 whitespace-nowrap min-h-[44px] flex-1 sm:flex-none" data-testid="tab-purchase-orders">
                <ClipboardList className="w-3.5 h-3.5 shrink-0" /> <span className="hidden sm:inline">Purchase&nbsp;</span>PO
                {purchaseOrders.length > 0 && <Badge variant="secondary" className="ml-0.5 h-5 text-[10px]">{purchaseOrders.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="gst-report" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 flex items-center gap-1 text-xs sm:text-sm sm:gap-1.5 whitespace-nowrap min-h-[44px] flex-1 sm:flex-none" data-testid="tab-gst-report">
                <Percent className="w-3.5 h-3.5 shrink-0" /> GST
              </TabsTrigger>
              <TabsTrigger value="tds-report" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 flex items-center gap-1 text-xs sm:text-sm sm:gap-1.5 whitespace-nowrap min-h-[44px] flex-1 sm:flex-none" data-testid="tab-tds-report">
                <IndianRupee className="w-3.5 h-3.5 shrink-0" /> TDS
              </TabsTrigger>
              <TabsTrigger value="pankaj-report" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 flex items-center gap-1 text-xs sm:text-sm sm:gap-1.5 whitespace-nowrap min-h-[44px] flex-1 sm:flex-none" data-testid="tab-pankaj-report">
                <User className="w-3.5 h-3.5 shrink-0" /> Pankaj
              </TabsTrigger>
              {canSeeDataEntry && (
              <TabsTrigger value="date-entry" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 flex items-center gap-1 text-xs sm:text-sm sm:gap-1.5 whitespace-nowrap min-h-[44px] flex-1 sm:flex-none" data-testid="tab-date-entry">
                <CalendarDays className="w-3.5 h-3.5 shrink-0" /> Date Entry
              </TabsTrigger>
              )}
            </TabsList>
          </div>

          <TabsContent value="purchase-orders" className="mt-4">
            <div className="flex justify-end mb-4">
              <Button className="bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white shadow-lg" onClick={openNewPO} data-testid="button-new-po">
                <Plus className="w-4 h-4 mr-2" /> New Purchase Order
              </Button>
            </div>

            {posLoading ? (
              <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-cyan-500" /></div>
            ) : purchaseOrders.length === 0 ? (
              <Card className="border-0 shadow-md">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <ClipboardList className="w-12 h-12 text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground text-sm">No purchase orders yet</p>
                  <Button className="mt-4" onClick={openNewPO} data-testid="button-new-po-empty">
                    <Plus className="w-4 h-4 mr-2" /> Create First PO
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {purchaseOrders.map(po => {
                  const balance = getPoBalance(po);
                  const used = getPoUsed(po);
                  const linked = getPoLinkedCount(po);
                  const usedPercent = Number(po.poAmount) > 0 ? Math.round((used / Number(po.poAmount)) * 100) : 0;
                  return (
                    <Card key={po.id} className="border-0 shadow-md overflow-hidden" data-testid={`card-po-${po.id}`}>
                      <div className={`h-1 ${balance > 0 ? 'bg-gradient-to-r from-cyan-400 to-teal-500' : 'bg-gradient-to-r from-orange-400 to-red-500'}`} />
                      <CardContent className="p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-600 text-white flex items-center justify-center">
                              <ClipboardList className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-bold text-sm">{po.poNumber}</p>
                              <p className="text-xs text-muted-foreground">{po.clientName} • {fmtDate(po.poDate)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" className="h-7 text-xs border-blue-200 text-blue-600" onClick={() => openEditPO(po)} data-testid={`button-edit-po-${po.id}`}>
                              <Pencil className="w-3 h-3 mr-1" /> Edit
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs border-red-200 text-red-500" onClick={() => { if (confirm("Delete this PO?")) deletePoMutation.mutate(po.id); }} data-testid={`button-delete-po-${po.id}`}>
                              <Trash2 className="w-3 h-3 mr-1" /> Delete
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mt-3">
                          <div className="bg-cyan-50 dark:bg-cyan-950/20 rounded-lg p-2 text-center">
                            <p className="text-[10px] text-cyan-600 dark:text-cyan-400">PO Amount</p>
                            <p className="font-mono font-bold text-xs sm:text-sm text-cyan-800 dark:text-cyan-200">{fmtCurrency(po.poAmount)}</p>
                          </div>
                          <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-2 text-center">
                            <p className="text-[10px] text-amber-600 dark:text-amber-400">Used ({usedPercent}%)</p>
                            <p className="font-mono font-bold text-xs sm:text-sm text-amber-800 dark:text-amber-200">{fmtCurrency(used)}</p>
                          </div>
                          <div className={`rounded-lg p-2 text-center ${balance > 0 ? 'bg-green-50 dark:bg-green-950/20' : 'bg-red-50 dark:bg-red-950/20'}`}>
                            <p className={`text-[10px] ${balance > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>Balance</p>
                            <p className={`font-mono font-bold text-xs sm:text-sm ${balance > 0 ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>{fmtCurrency(balance)}</p>
                          </div>
                          <button
                            onClick={() => linked > 0 && setViewingPo(po)}
                            className={`bg-violet-50 dark:bg-violet-950/20 rounded-lg p-2 text-center w-full transition-all ${linked > 0 ? 'cursor-pointer hover:bg-violet-100 dark:hover:bg-violet-900/30 hover:shadow-md ring-1 ring-transparent hover:ring-violet-300 dark:hover:ring-violet-700' : 'cursor-default'}`}
                            data-testid={`button-po-invoices-${po.id}`}
                          >
                            <p className="text-[10px] text-violet-600 dark:text-violet-400 flex items-center justify-center gap-1">
                              Invoices {linked > 0 && <span className="text-[9px] opacity-60">(tap)</span>}
                            </p>
                            <p className={`font-mono font-bold text-xs sm:text-sm ${linked > 0 ? 'text-violet-700 dark:text-violet-300' : 'text-violet-800 dark:text-violet-200'}`}>{linked}</p>
                          </button>
                        </div>
                        <div className="mt-2">
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                            <div className={`h-1.5 rounded-full ${usedPercent >= 100 ? 'bg-red-500' : usedPercent >= 75 ? 'bg-amber-500' : 'bg-cyan-500'}`} style={{ width: `${Math.min(usedPercent, 100)}%` }} />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="invoices" className="mt-4">
            <div className="flex justify-end gap-2 mb-4 flex-wrap">
              <Button variant="outline" size="sm" className="h-9" onClick={() => {
                if (filteredInvoices.length === 0) return;
                const pw = window.open("", "_blank");
                if (!pw) return;
                const today = new Date();
                const dateStr = `${String(today.getDate()).padStart(2,"0")}/${String(today.getMonth()+1).padStart(2,"0")}/${today.getFullYear()}`;
                const clientLabel = filterClient === "all" ? "All Clients" : filterClient;
                const monthLabel = filterMonth === "all" ? "All Months" : MONTHS[Number(filterMonth)];
                const yearLabel = filterYear === "all" ? "All Years" : filterYear;
                const totalBill = filteredInvoices.reduce((s, i) => s + Number(i.billAmount), 0);
                const totalGst = filteredInvoices.reduce((s, i) => s + Number(i.gstAmount), 0);
                const totalTotalBill = filteredInvoices.reduce((s, i) => s + Number(i.totalBillAmount), 0);
                const totalTds = filteredInvoices.reduce((s, i) => s + Number(i.tdsAmount), 0);
                const totalToReceive = filteredInvoices.reduce((s, i) => s + (Number(i.totalBillAmount) - Number(i.tdsAmount)), 0);
                const uniqueClients = [...new Set(filteredInvoices.map(i => i.clientName))];
                const isSingleClient = uniqueClients.length === 1;
                const footColspan = isSingleClient ? 5 : 6;
                pw.document.write(`<!DOCTYPE html><html><head><title>Sales Invoice Ledger</title>
                  <style>
                    body { font-family: Arial, sans-serif; margin: 20px 30px; color: #000; }
                    .company { text-align: center; font-size: 16px; font-weight: bold; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 2px; }
                    .title { text-align: center; font-size: 14px; font-weight: bold; padding: 6px 0; border-bottom: 1px solid #000; margin-bottom: 8px; }
                    .meta-row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 10px; padding: 0 4px; }
                    table { width: 100%; border-collapse: collapse; font-size: 11px; }
                    th, td { border: 1px solid #000; padding: 5px 6px; }
                    th { background: #f0f0f0; font-weight: bold; text-align: center; font-size: 10px; }
                    td { text-align: left; }
                    td.right { text-align: right; font-family: 'Courier New', monospace; }
                    td.center { text-align: center; }
                    tfoot td { font-weight: bold; background: #f5f5f5; }
                    @media print { body { margin: 10px 15px; } }
                  </style></head><body>
                  <div class="company">DJ Hospitality & Facility Management Private Limited</div>
                  <div class="title">Sales Invoice Ledger</div>
                  <div class="meta-row">
                    <span><b>Date:</b> ${dateStr}</span>
                    ${isSingleClient ? `<span><b>Client:</b> ${uniqueClients[0]}</span>` : ""}
                    <span><b>Period:</b> ${monthLabel} ${yearLabel}</span>
                  </div>
                  <table>
                    <thead><tr>
                      <th>Sl No</th>${isSingleClient ? "" : "<th>Client Name</th>"}<th>PO No</th><th>PO Date</th>
                      <th>Bill No</th><th>Bill Date</th>
                      <th>Bill Amount</th><th>GST Amount</th><th>Total Bill</th>
                      <th>TDS</th><th>To Receive</th>
                    </tr></thead>
                    <tbody>${filteredInvoices.map((inv, idx) => {
                      const po = inv.poId ? purchaseOrders.find(p => p.id === inv.poId) : null;
                      const toRec = Number(inv.totalBillAmount) - Number(inv.tdsAmount);
                      return `<tr>
                        <td class="center">${idx + 1}</td>
                        ${isSingleClient ? "" : `<td>${inv.clientName}</td>`}
                        <td>${po ? po.poNumber : "-"}</td>
                        <td class="center">${po ? fmtDate(po.poDate) : "-"}</td>
                        <td>${inv.billNumber}</td>
                        <td class="center">${fmtDate(inv.billDate)}</td>
                        <td class="right">${Number(inv.billAmount).toLocaleString("en-IN", {minimumFractionDigits:2})}</td>
                        <td class="right">${Number(inv.gstAmount).toLocaleString("en-IN", {minimumFractionDigits:2})}</td>
                        <td class="right">${Number(inv.totalBillAmount).toLocaleString("en-IN", {minimumFractionDigits:2})}</td>
                        <td class="right">${Number(inv.tdsAmount).toLocaleString("en-IN", {minimumFractionDigits:2})}</td>
                        <td class="right" style="font-weight:bold">${toRec.toLocaleString("en-IN", {minimumFractionDigits:2})}</td>
                      </tr>`;
                    }).join("")}</tbody>
                    <tfoot><tr>
                      <td colspan="${footColspan}" style="text-align:center"><b>Grand Total (${filteredInvoices.length} invoices)</b></td>
                      <td class="right">${totalBill.toLocaleString("en-IN", {minimumFractionDigits:2})}</td>
                      <td class="right">${totalGst.toLocaleString("en-IN", {minimumFractionDigits:2})}</td>
                      <td class="right">${totalTotalBill.toLocaleString("en-IN", {minimumFractionDigits:2})}</td>
                      <td class="right">${totalTds.toLocaleString("en-IN", {minimumFractionDigits:2})}</td>
                      <td class="right" style="font-weight:bold">${totalToReceive.toLocaleString("en-IN", {minimumFractionDigits:2})}</td>
                    </tr></tfoot>
                  </table>
                  <script>window.onload=function(){window.print();}<\/script>
                </body></html>`);
                pw.document.close();
              }} data-testid="button-print-invoices">
                <Printer className="w-4 h-4 mr-1.5" /> Print
              </Button>
              <Button className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white shadow-lg" onClick={openNew} data-testid="button-new-invoice">
                <Plus className="w-4 h-4 mr-2" /> New Invoice
              </Button>
            </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <Card className="border-0 shadow-md bg-gradient-to-br from-blue-500 to-indigo-600 text-white" data-testid="card-total-invoices">
            <CardContent className="p-3 sm:p-4">
              <p className="text-xs opacity-80">Total Invoices</p>
              <p className="text-lg sm:text-2xl font-bold">{filteredInvoices.length}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md bg-gradient-to-br from-emerald-500 to-teal-600 text-white" data-testid="card-total-billed">
            <CardContent className="p-3 sm:p-4">
              <p className="text-xs opacity-80">Total Billed</p>
              <p className="text-sm sm:text-xl font-bold">{fmtCurrency(totalBilled)}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md bg-gradient-to-br from-green-500 to-emerald-600 text-white" data-testid="card-total-received">
            <CardContent className="p-3 sm:p-4">
              <p className="text-xs opacity-80">Received</p>
              <p className="text-sm sm:text-xl font-bold">{fmtCurrency(totalReceived)}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md bg-gradient-to-br from-orange-500 to-red-500 text-white" data-testid="card-outstanding">
            <CardContent className="p-3 sm:p-4">
              <p className="text-xs opacity-80">Outstanding</p>
              <p className="text-sm sm:text-xl font-bold">{fmtCurrency(totalOutstanding)}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-0 shadow-lg overflow-hidden mb-5" data-testid="card-filters">
          <CardContent className="p-3 sm:p-4">
            <div className="space-y-3 sm:space-y-0">
              <div className="w-full sm:hidden">
                <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mb-1">
                  <Search className="w-3 h-3" /> Search
                </Label>
                <Input
                  placeholder="Search bill no. or client..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-9"
                  data-testid="input-search-invoices-mobile"
                />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:gap-3 sm:items-end">
                <div className="hidden sm:block flex-1">
                  <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mb-1">
                    <Search className="w-3 h-3" /> Search
                  </Label>
                  <Input
                    placeholder="Search bill number or client..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-9"
                    data-testid="input-search-invoices"
                  />
                </div>
                <div className="col-span-2 sm:w-40">
                  <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mb-1">
                    <Building2 className="w-3 h-3" /> Client
                  </Label>
                  <Select value={filterClient} onValueChange={setFilterClient}>
                    <SelectTrigger className="h-9" data-testid="select-filter-client">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Clients</SelectItem>
                      {clients.map((c: any) => (
                        <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:w-36">
                  <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mb-1">
                    <CalendarDays className="w-3 h-3" /> Month
                  </Label>
                  <Select value={filterMonth} onValueChange={setFilterMonth}>
                    <SelectTrigger className="h-9" data-testid="select-filter-month">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Months</SelectItem>
                      {MONTHS.map((m, i) => (
                        <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:w-28">
                  <Label className="text-xs font-semibold text-muted-foreground mb-1 block">Year</Label>
                  <Select value={filterYear} onValueChange={setFilterYear}>
                    <SelectTrigger className="h-9" data-testid="select-filter-year">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {years.map(y => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:w-32">
                  <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mb-1">
                    <CheckCircle2 className="w-3 h-3" /> Status
                  </Label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="h-9" data-testid="select-filter-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="pending">Due</SelectItem>
                      <SelectItem value="partial">Partial Received</SelectItem>
                      <SelectItem value="received">Full Paid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:w-44">
                  <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mb-1">
                    <FileText className="w-3 h-3" /> UTR No.
                  </Label>
                  <Input
                    placeholder="Search UTR..."
                    value={filterUtrNo}
                    onChange={(e) => setFilterUtrNo(e.target.value)}
                    className="h-9 font-mono text-sm"
                    data-testid="input-filter-utr"
                  />
                </div>
                {(filterClient !== "all" || filterMonth !== "all" || filterYear !== String(new Date().getFullYear()) || filterStatus !== "all" || searchTerm || filterUtrNo) && (
                  <Button variant="ghost" size="sm" className="text-muted-foreground h-9 self-end" onClick={() => { setFilterClient("all"); setFilterMonth("all"); setFilterYear(String(new Date().getFullYear())); setFilterStatus("all"); setSearchTerm(""); setFilterUtrNo(""); }} data-testid="button-clear-filters">
                    <X className="w-3.5 h-3.5 mr-1" /> Clear
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-violet-500" /></div>
        ) : filteredInvoices.length === 0 ? (
          <Card className="border-0 shadow-md">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <FileText className="w-12 h-12 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground text-sm">No invoices found</p>
              <Button className="mt-4" onClick={openNew} data-testid="button-new-invoice-empty">
                <Plus className="w-4 h-4 mr-2" /> Create First Invoice
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="hidden lg:block">
              <Card className="border-0 shadow-lg overflow-hidden" data-testid="card-invoice-table">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gradient-to-r from-violet-500 to-purple-600 text-white">
                        <th className="text-left py-3 px-3 font-semibold text-xs">Sl#</th>
                        <th className="text-left py-3 px-3 font-semibold text-xs">Client</th>
                        <th className="text-left py-3 px-3 font-semibold text-xs">PO No.</th>
                        <th className="text-left py-3 px-3 font-semibold text-xs">Bill Date</th>
                        <th className="text-left py-3 px-3 font-semibold text-xs">Bill No.</th>
                        <th className="text-right py-3 px-3 font-semibold text-xs">Bill Amt</th>
                        <th className="text-right py-3 px-3 font-semibold text-xs">GST%</th>
                        <th className="text-right py-3 px-3 font-semibold text-xs">GST Amt</th>
                        <th className="text-right py-3 px-3 font-semibold text-xs">Total</th>
                        <th className="text-right py-3 px-3 font-semibold text-xs">TDS%</th>
                        <th className="text-right py-3 px-3 font-semibold text-xs">TDS Amt</th>
                        <th className="text-right py-3 px-3 font-semibold text-xs">To Receive</th>
                        <th className="text-left py-3 px-3 font-semibold text-xs">Pmt Date</th>
                        <th className="text-right py-3 px-3 font-semibold text-xs">Pmt Rcvd</th>
                        <th className="text-left py-3 px-3 font-semibold text-xs">UTR No.</th>
                        <th className="text-center py-3 px-3 font-semibold text-xs">Status</th>
                        <th className="text-center py-3 px-3 font-semibold text-xs w-20">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInvoices.map((inv, idx) => {
                        const toReceiveAmt = Math.round((Number(inv.totalBillAmount) - Number(inv.tdsAmount)) * 100) / 100;
                        const receivedAmt = Math.round(Number(inv.paymentReceivedAmount) * 100) / 100;
                        const paymentStatus = toReceiveAmt > 0 && receivedAmt >= toReceiveAmt ? "full" : toReceiveAmt > 0 && receivedAmt > 0 && receivedAmt < toReceiveAmt ? "partial" : "due";
                        return (
                          <tr key={inv.id} className={`border-b border-gray-100 dark:border-gray-800 hover:bg-violet-50/50 dark:hover:bg-violet-950/20 transition-colors cursor-pointer ${idx % 2 === 0 ? "bg-white dark:bg-gray-950" : "bg-gray-50/50 dark:bg-gray-900/50"}`} onClick={() => openView(inv)} data-testid={`row-invoice-${inv.id}`}>
                            <td className="py-2.5 px-3">
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300 text-xs font-bold">{inv.slNo}</span>
                            </td>
                            <td className="py-2.5 px-3 font-medium text-xs">{inv.clientName}</td>
                            <td className="py-2.5 px-3 text-xs">{getPoName(inv.poId) ? <Badge variant="outline" className="text-[10px] border-cyan-300 text-cyan-700 dark:border-cyan-700 dark:text-cyan-400">{getPoName(inv.poId)}</Badge> : <span className="text-muted-foreground">—</span>}</td>
                            <td className="py-2.5 px-3 text-xs">{fmtDate(inv.billDate)}</td>
                            <td className="py-2.5 px-3 font-mono text-xs">{inv.billNumber}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-xs">{fmtCurrency(inv.billAmount)}</td>
                            <td className="py-2.5 px-3 text-right text-xs">{Number(inv.gstPercent)}%</td>
                            <td className="py-2.5 px-3 text-right font-mono text-xs">{fmtCurrency(inv.gstAmount)}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-xs font-bold">{fmtCurrency(inv.totalBillAmount)}</td>
                            <td className="py-2.5 px-3 text-right text-xs">{Number(inv.tdsPercent)}%</td>
                            <td className="py-2.5 px-3 text-right font-mono text-xs text-red-600">{fmtCurrency(inv.tdsAmount)}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-xs font-bold text-blue-600">{fmtCurrency(toReceiveAmt)}</td>
                            <td className="py-2.5 px-3 text-xs">{fmtDate(inv.paymentReceivedDate)}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-xs text-green-600">{fmtCurrency(inv.paymentReceivedAmount)}</td>
                            <td className="py-2.5 px-3 text-xs font-mono text-cyan-700 dark:text-cyan-400">{inv.utrNo || <span className="text-muted-foreground">—</span>}</td>
                            <td className="py-2.5 px-3 text-center">
                              {paymentStatus === "full" ? (
                                <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px]"><CheckCircle2 className="w-3 h-3 mr-0.5" /> Full Paid</Badge>
                              ) : paymentStatus === "partial" ? (
                                <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px]"><IndianRupee className="w-3 h-3 mr-0.5" /> Partial Received</Badge>
                              ) : (
                                <Badge variant="outline" className="text-red-600 border-red-300 dark:border-red-700 text-[10px]"><XCircle className="w-3 h-3 mr-0.5" /> Due</Badge>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center gap-1">
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-blue-500 hover:text-blue-700 hover:bg-blue-50" onClick={() => openEdit(inv)} data-testid={`button-edit-${inv.id}`}><Pencil className="w-3.5 h-3.5" /></Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => { if (confirm("Delete this invoice?")) deleteMutation.mutate(inv.id); }} data-testid={`button-delete-${inv.id}`}><Trash2 className="w-3.5 h-3.5" /></Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gradient-to-r from-violet-100 to-purple-100 dark:from-violet-950/40 dark:to-purple-950/40 font-bold">
                        <td colSpan={5} className="py-2.5 px-3 text-xs">Totals ({filteredInvoices.length} invoices)</td>
                        <td className="py-2.5 px-3 text-right font-mono text-xs">{fmtCurrency(filteredInvoices.reduce((s, i) => s + Number(i.billAmount), 0))}</td>
                        <td className="py-2.5 px-3"></td>
                        <td className="py-2.5 px-3 text-right font-mono text-xs">{fmtCurrency(filteredInvoices.reduce((s, i) => s + Number(i.gstAmount), 0))}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-xs">{fmtCurrency(totalBilled)}</td>
                        <td className="py-2.5 px-3"></td>
                        <td className="py-2.5 px-3 text-right font-mono text-xs text-red-600">{fmtCurrency(filteredInvoices.reduce((s, i) => s + Number(i.tdsAmount), 0))}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-xs text-blue-600">{fmtCurrency(filteredInvoices.reduce((s, i) => s + Number(i.billAmount) + Number(i.gstAmount) - Number(i.tdsAmount), 0))}</td>
                        <td className="py-2.5 px-3"></td>
                        <td className="py-2.5 px-3 text-right font-mono text-xs text-green-600">{fmtCurrency(totalReceived)}</td>
                        <td className="py-2.5 px-3"></td>
                        <td colSpan={2} className="py-2.5 px-3 text-center text-xs">{paidCount} paid</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Card>
            </div>

            <div className="lg:hidden space-y-3">
              {filteredInvoices.map((inv) => {
                const mToReceive = Math.round((Number(inv.totalBillAmount) - Number(inv.tdsAmount)) * 100) / 100;
                const mReceived = Math.round(Number(inv.paymentReceivedAmount) * 100) / 100;
                const mStatus = mToReceive > 0 && mReceived >= mToReceive ? "full" : mToReceive > 0 && mReceived > 0 && mReceived < mToReceive ? "partial" : "due";
                return (
                  <Card key={inv.id} className="border-0 shadow-md overflow-hidden cursor-pointer" onClick={() => openView(inv)} data-testid={`card-invoice-mobile-${inv.id}`}>
                    <div className={`h-1 ${mStatus === "full" ? 'bg-gradient-to-r from-green-400 to-emerald-500' : mStatus === "partial" ? 'bg-gradient-to-r from-amber-400 to-yellow-500' : 'bg-gradient-to-r from-orange-400 to-red-500'}`} />
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-white text-xs font-bold">{inv.slNo}</span>
                          <div>
                            <p className="font-semibold text-sm">{inv.clientName}</p>
                            <p className="text-xs text-muted-foreground">{inv.billNumber} • {fmtDate(inv.billDate)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {mStatus === "full" ? (
                            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 text-[10px]"><CheckCircle2 className="w-3 h-3 mr-0.5" /> Full Paid</Badge>
                          ) : mStatus === "partial" ? (
                            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 text-[10px]"><IndianRupee className="w-3 h-3 mr-0.5" /> Partial Received</Badge>
                          ) : (
                            <Badge variant="outline" className="text-red-600 border-red-300 text-[10px]"><XCircle className="w-3 h-3 mr-0.5" /> Due</Badge>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5 text-xs mt-2">
                        <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-1.5 text-center">
                          <p className="text-[9px] text-blue-600 dark:text-blue-400">Bill Amount</p>
                          <p className="font-mono font-bold text-[11px] text-blue-700 dark:text-blue-300">{fmtCurrency(inv.billAmount)}</p>
                        </div>
                        <div className="bg-orange-50 dark:bg-orange-950/20 rounded-lg p-1.5 text-center">
                          <p className="text-[9px] text-orange-600 dark:text-orange-400">GST ({Number(inv.gstPercent)}%)</p>
                          <p className="font-mono font-bold text-[11px] text-orange-700 dark:text-orange-300">{fmtCurrency(inv.gstAmount)}</p>
                        </div>
                        <div className="bg-violet-50 dark:bg-violet-950/20 rounded-lg p-1.5 text-center">
                          <p className="text-[9px] text-violet-600 dark:text-violet-400">Total</p>
                          <p className="font-mono font-bold text-[11px] text-violet-700 dark:text-violet-300">{fmtCurrency(inv.totalBillAmount)}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 text-xs mt-1.5">
                        <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-1.5 text-center">
                          <p className="text-[9px] text-red-600 dark:text-red-400">TDS ({Number(inv.tdsPercent)}%)</p>
                          <p className="font-mono font-bold text-[11px] text-red-700 dark:text-red-300">{fmtCurrency(inv.tdsAmount)}</p>
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-1.5 text-center">
                          <p className="text-[9px] text-blue-600 dark:text-blue-400">To Receive</p>
                          <p className="font-mono font-bold text-[11px] text-blue-700 dark:text-blue-300">{fmtCurrency(Number(inv.billAmount) + Number(inv.gstAmount) - Number(inv.tdsAmount))}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 text-xs mt-1.5">
                        <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-1.5 text-center">
                          <p className="text-[9px] text-green-600 dark:text-green-400">Received</p>
                          <p className="font-mono font-bold text-[11px] text-green-700 dark:text-green-300">{fmtCurrency(inv.paymentReceivedAmount)}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-900/30 rounded-lg p-1.5 text-center">
                          <p className="text-[9px] text-muted-foreground">Pmt Date</p>
                          <p className="font-mono font-bold text-[11px]">{fmtDate(inv.paymentReceivedDate)}</p>
                        </div>
                      </div>
                      {inv.utrNo && (
                        <div className="mt-1.5 bg-cyan-50 dark:bg-cyan-950/20 rounded-lg p-1.5">
                          <p className="text-[9px] text-cyan-600 dark:text-cyan-400">UTR No.</p>
                          <p className="font-mono font-bold text-[11px] text-cyan-700 dark:text-cyan-300 break-all">{inv.utrNo}</p>
                        </div>
                      )}

                      <div className="flex justify-end gap-2 mt-3 pt-2 border-t" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="outline" className="h-7 text-xs border-blue-200 text-blue-600" onClick={() => openEdit(inv)} data-testid={`button-edit-mobile-${inv.id}`}>
                          <Pencil className="w-3 h-3 mr-1" /> Edit
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs border-red-200 text-red-500" onClick={() => { if (confirm("Delete?")) deleteMutation.mutate(inv.id); }} data-testid={`button-delete-mobile-${inv.id}`}>
                          <Trash2 className="w-3 h-3 mr-1" /> Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
          </TabsContent>

          <TabsContent value="gst-report" className="mt-4">
            <GstTdsReport invoices={invoices} type="gst" clients={clients.map((c: any) => c.name)} />
          </TabsContent>

          <TabsContent value="tds-report" className="mt-4">
            <GstTdsReport invoices={invoices} type="tds" clients={clients.map((c: any) => c.name)} />
          </TabsContent>

          <TabsContent value="pankaj-report" className="mt-4">
            <PankajReport invoices={invoices} clients={clients.map((c: any) => c.name)} />
          </TabsContent>

          <TabsContent value="date-entry" className="mt-4">
            <DateEntryTab />
          </TabsContent>
        </Tabs>
      </div>

    </Layout>
  );
}

function GstTdsReport({ invoices, type, clients }: { invoices: any[]; type: "gst" | "tds"; clients: string[] }) {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [clientFilter, setClientFilter] = useState("all");

  const filtered = invoices.filter((inv) => {
    if (!inv.billDate) return false;
    const d = new Date(inv.billDate);
    if (d.getMonth() + 1 !== Number(month) || d.getFullYear() !== Number(year)) return false;
    if (clientFilter !== "all" && inv.clientName !== clientFilter) return false;
    return true;
  });

  const isGst = type === "gst";
  const title = isGst ? "GST Report" : "TDS Report";
  const amountKey = isGst ? "gstAmount" : "tdsAmount";

  const total = filtered.reduce((s, inv) => s + Number(inv[amountKey]), 0);

  const months = [
    { v: "1", l: "January" }, { v: "2", l: "February" }, { v: "3", l: "March" },
    { v: "4", l: "April" }, { v: "5", l: "May" }, { v: "6", l: "June" },
    { v: "7", l: "July" }, { v: "8", l: "August" }, { v: "9", l: "September" },
    { v: "10", l: "October" }, { v: "11", l: "November" }, { v: "12", l: "December" },
  ];

  const years: string[] = [];
  for (let y = now.getFullYear(); y >= now.getFullYear() - 5; y--) years.push(String(y));

  const handlePrint = () => {
    const monthName = months.find(m => m.v === month)?.l || "";
    const clientLabel = clientFilter === "all" ? "All Clients" : clientFilter;
    const totalBillAmt = filtered.reduce((s, i) => s + Number(i.billAmount), 0);
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html><head><title>${title} - ${monthName} ${year}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
        h2 { text-align: center; margin-bottom: 4px; }
        .sub { text-align: center; font-size: 13px; color: #666; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { background: ${isGst ? "#059669" : "#dc2626"}; color: white; padding: 8px 10px; text-align: left; }
        th.right { text-align: right; }
        td { padding: 6px 10px; border-bottom: 1px solid #e5e7eb; }
        td.right { text-align: right; font-family: monospace; }
        tr:nth-child(even) { background: #f9fafb; }
        tfoot td { font-weight: bold; border-top: 2px solid #333; padding-top: 8px; }
        .summary { display: flex; justify-content: space-around; margin-bottom: 16px; }
        .summary-card { text-align: center; padding: 10px 20px; border: 1px solid #e5e7eb; border-radius: 8px; }
        .summary-card .label { font-size: 11px; color: #666; }
        .summary-card .value { font-size: 18px; font-weight: bold; font-family: monospace; }
        @media print { body { margin: 10px; } }
      </style></head><body>
      <h2>${title}</h2>
      <p class="sub">${monthName} ${year} | ${clientLabel}</p>
      <div class="summary">
        <div class="summary-card"><div class="label">Total Invoices</div><div class="value">${filtered.length}</div></div>
        <div class="summary-card"><div class="label">Total Bill Amount</div><div class="value" style="color:#7c3aed">₹${totalBillAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div></div>
        <div class="summary-card"><div class="label">Total ${isGst ? "GST" : "TDS"} Amount</div><div class="value" style="color:${isGst ? "#059669" : "#dc2626"}">₹${total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div></div>
      </div>
      <table>
        <thead><tr>
          <th>Sl#</th><th>Client</th><th>Bill Date</th><th>Bill Number</th>
          <th class="right">Bill Amount</th><th class="right">${isGst ? "GST %" : "TDS %"}</th><th class="right">${isGst ? "GST Amount" : "TDS Amount"}</th>
        </tr></thead>
        <tbody>${filtered.map((inv: any, idx: number) => `<tr>
          <td>${idx + 1}</td><td>${inv.clientName}</td><td>${fmtDate(inv.billDate)}</td><td>${inv.billNumber}</td>
          <td class="right">${fmtCurrency(inv.billAmount)}</td><td class="right">${Number(isGst ? inv.gstPercent : inv.tdsPercent)}%</td>
          <td class="right" style="font-weight:bold;color:${isGst ? "#059669" : "#dc2626"}">${fmtCurrency(inv[amountKey])}</td>
        </tr>`).join("")}</tbody>
        <tfoot><tr>
          <td colspan="4">Total (${filtered.length} invoices)</td>
          <td class="right">₹${totalBillAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
          <td></td>
          <td class="right" style="color:${isGst ? "#059669" : "#dc2626"}">₹${total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
        </tr></tfoot>
      </table>
      <script>window.onload=function(){window.print();}<\/script>
    </body></html>`);
    printWindow.document.close();
  };

  return (
    <div>
      <Card className="border-0 shadow-md mb-4">
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {isGst ? <Percent className="w-5 h-5 text-emerald-600" /> : <IndianRupee className="w-5 h-5 text-red-600" />}
              <h3 className="font-bold text-lg">{title}</h3>
            </div>
            <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2 sm:gap-2 sm:items-center sm:flex-wrap">
              <div className="col-span-2 sm:w-auto">
                <Select value={clientFilter} onValueChange={setClientFilter}>
                  <SelectTrigger className="w-full sm:w-[180px] h-9" data-testid={`select-${type}-client`}>
                    <Building2 className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clients</SelectItem>
                    {clients.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="w-full sm:w-[130px] h-9" data-testid={`select-${type}-month`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map(m => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger className="w-full sm:w-[90px] h-9" data-testid={`select-${type}-year`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" className="h-9 shrink-0" onClick={handlePrint} data-testid={`button-print-${type}`}>
                  <BarChart3 className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">Print</span>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 mb-4">
        <Card className="border-0 shadow-md">
          <CardContent className="p-3 sm:p-4 text-center">
            <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">Total Invoices</p>
            <p className="text-xl sm:text-2xl font-bold">{filtered.length}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md">
          <CardContent className="p-3 sm:p-4 text-center">
            <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">Total {isGst ? "GST" : "TDS"}</p>
            <p className={`text-sm sm:text-2xl font-bold font-mono ${isGst ? "text-emerald-600" : "text-red-600"}`}>₹{total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md col-span-2 sm:col-span-1">
          <CardContent className="p-3 sm:p-4 text-center">
            <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">Total Bill Amount</p>
            <p className="text-sm sm:text-2xl font-bold font-mono text-violet-600">₹{filtered.reduce((s, i) => s + Number(i.billAmount), 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
      </div>

      {filtered.length === 0 ? (
        <Card className="border-0 shadow-md">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground text-sm">No invoices for {months.find(m => m.v === month)?.l} {year}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="hidden lg:block">
            <Card className="border-0 shadow-lg overflow-hidden" data-testid={`card-${type}-report-table`}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className={`bg-gradient-to-r ${isGst ? "from-emerald-500 to-green-600" : "from-red-500 to-rose-600"} text-white`}>
                      <th className="text-left py-3 px-4 font-semibold text-xs">Sl#</th>
                      <th className="text-left py-3 px-4 font-semibold text-xs">Client</th>
                      <th className="text-left py-3 px-4 font-semibold text-xs">Bill Date</th>
                      <th className="text-left py-3 px-4 font-semibold text-xs">Bill Number</th>
                      <th className="text-right py-3 px-4 font-semibold text-xs">Bill Amount</th>
                      <th className="text-right py-3 px-4 font-semibold text-xs">{isGst ? "GST %" : "TDS %"}</th>
                      <th className="text-right py-3 px-4 font-semibold text-xs">{isGst ? "GST Amount" : "TDS Amount"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((inv, idx) => (
                      <tr key={inv.id} className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50 ${idx % 2 === 0 ? "bg-white dark:bg-gray-950" : "bg-gray-50/50 dark:bg-gray-900/50"}`} data-testid={`row-${type}-${inv.id}`}>
                        <td className="py-2.5 px-4">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${isGst ? "bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300" : "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300"} text-xs font-bold`}>{idx + 1}</span>
                        </td>
                        <td className="py-2.5 px-4 font-medium text-xs">{inv.clientName}</td>
                        <td className="py-2.5 px-4 text-xs">{fmtDate(inv.billDate)}</td>
                        <td className="py-2.5 px-4 font-mono text-xs">{inv.billNumber}</td>
                        <td className="py-2.5 px-4 text-right font-mono text-xs">{fmtCurrency(inv.billAmount)}</td>
                        <td className="py-2.5 px-4 text-right text-xs">{Number(isGst ? inv.gstPercent : inv.tdsPercent)}%</td>
                        <td className={`py-2.5 px-4 text-right font-mono text-xs font-bold ${isGst ? "text-emerald-600" : "text-red-600"}`}>{fmtCurrency(inv[amountKey])}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className={`bg-gradient-to-r ${isGst ? "from-emerald-100 to-green-100 dark:from-emerald-950/40 dark:to-green-950/40" : "from-red-100 to-rose-100 dark:from-red-950/40 dark:to-rose-950/40"} font-bold`}>
                      <td colSpan={4} className="py-2.5 px-4 text-xs">Total ({filtered.length} invoices)</td>
                      <td className="py-2.5 px-4 text-right font-mono text-xs">{fmtCurrency(filtered.reduce((s, i) => s + Number(i.billAmount), 0))}</td>
                      <td className="py-2.5 px-4"></td>
                      <td className={`py-2.5 px-4 text-right font-mono text-xs ${isGst ? "text-emerald-600" : "text-red-600"}`}>{fmtCurrency(total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          </div>

          <div className="lg:hidden space-y-3">
            {filtered.map((inv, idx) => (
              <Card key={inv.id} className="border-0 shadow-md overflow-hidden" data-testid={`card-${type}-mobile-${inv.id}`}>
                <div className={`h-1 bg-gradient-to-r ${isGst ? "from-emerald-400 to-green-500" : "from-red-400 to-rose-500"}`} />
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br ${isGst ? "from-emerald-500 to-green-600" : "from-red-500 to-rose-600"} text-white text-xs font-bold`}>{idx + 1}</span>
                    <div>
                      <p className="font-semibold text-sm">{inv.clientName}</p>
                      <p className="text-xs text-muted-foreground">{inv.billNumber} • {fmtDate(inv.billDate)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-violet-50 dark:bg-violet-950/20 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-violet-600 dark:text-violet-400">Bill Amount</p>
                      <p className="font-mono font-bold text-violet-700 dark:text-violet-300">{fmtCurrency(inv.billAmount)}</p>
                    </div>
                    <div className={`${isGst ? "bg-emerald-50 dark:bg-emerald-950/20" : "bg-red-50 dark:bg-red-950/20"} rounded-lg p-2 text-center`}>
                      <p className={`text-[10px] ${isGst ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{isGst ? `GST (${Number(inv.gstPercent)}%)` : `TDS (${Number(inv.tdsPercent)}%)`}</p>
                      <p className={`font-mono font-bold ${isGst ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}>{fmtCurrency(inv[amountKey])}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function PankajReport({ invoices, clients }: { invoices: any[]; clients: string[] }) {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [filterPankajStatus, setFilterPankajStatus] = useState("all");
  const [filterInvStatus, setFilterInvStatus] = useState("all");
  type Payment = { date: string; amount: string };
  const [fixedAmounts, setFixedAmounts] = useState<Record<string, number>>({});
  // clientPayments: saved installment history per client
  const [clientPayments, setClientPayments] = useState<Record<string, Payment[]>>({});
  // newPayment: the "add payment" form fields per client
  const [newPayment, setNewPayment] = useState<Record<string, { date: string; amount: string }>>({});
  const [editingRows, setEditingRows] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: savedRecords = [], isLoading: loadingSaved } = useQuery<any[]>({
    queryKey: ["/api/pankaj-reports", month, year],
    queryFn: async () => {
      const res = await fetch(`/api/pankaj-reports?month=${month}&year=${year}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  useEffect(() => {
    const fa: Record<string, number> = {};
    const cp: Record<string, Payment[]> = {};
    savedRecords.forEach((r: any) => {
      fa[r.clientName] = Number(r.fixedAmount) || 0;
      // Parse payments JSON if present; else fall back to single givenDate/givenAmount
      if (r.payments) {
        try { cp[r.clientName] = JSON.parse(r.payments); } catch { cp[r.clientName] = []; }
      } else if (r.givenDate && r.givenAmount) {
        cp[r.clientName] = [{ date: r.givenDate.split("T")[0], amount: String(Number(r.givenAmount)) }];
      } else {
        cp[r.clientName] = [];
      }
    });
    setFixedAmounts(fa);
    setClientPayments(cp);
  }, [savedRecords]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setClientDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggleClient = (c: string) => setSelectedClients(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  const selectAllClients = (pool: string[]) => setSelectedClients(pool);
  const clearAllClients = () => setSelectedClients([]);

  // All clients that have invoices in the selected month/year
  const allRows = clients
    .filter(clientName => invoices.some(inv => {
      if (!inv.billDate || inv.clientName !== clientName) return false;
      const d = new Date(inv.billDate);
      return d.getMonth() + 1 === Number(month) && d.getFullYear() === Number(year);
    }))
    .map((clientName, idx) => {
      // All invoices for this client in the selected month/year
      const clientInvoices = invoices.filter(inv => {
        if (!inv.billDate || inv.clientName !== clientName) return false;
        const d = new Date(inv.billDate);
        return d.getMonth() + 1 === Number(month) && d.getFullYear() === Number(year);
      });

      // Compute per-invoice status to find Full Paid ones
      const fullPaidInvoices = clientInvoices.filter(inv => {
        const invToReceive = Math.round((Number(inv.totalBillAmount) - Number(inv.tdsAmount)) * 100) / 100;
        const invReceived = Math.round(Number(inv.paymentReceivedAmount) * 100) / 100;
        return invToReceive > 0 && invReceived >= invToReceive;
      });

      // Amounts calculated from FULL PAID invoices only
      const totalBill = fullPaidInvoices.reduce((s, i) => s + Number(i.billAmount), 0);
      const totalGst = fullPaidInvoices.reduce((s, i) => s + Number(i.gstAmount), 0);
      const totalTds = fullPaidInvoices.reduce((s, i) => s + Number(i.tdsAmount), 0);
      const toReceive = Math.round((totalBill + totalGst - totalTds) * 100) / 100;
      const gstMinusTds = Math.round((totalGst - totalTds) * 100) / 100;
      const fixedAmt = fixedAmounts[clientName] || 0;
      const total = Math.round((gstMinusTds + fixedAmt) * 100) / 100;

      // Invoice status based on ALL invoices (for the status filter/badge)
      const totalAllToReceive = clientInvoices.reduce((s, i) => s + Math.round((Number(i.totalBillAmount) - Number(i.tdsAmount)) * 100) / 100, 0);
      const totalReceived = clientInvoices.reduce((s, i) => s + Number(i.paymentReceivedAmount), 0);
      const invStatus: "due" | "partial" | "full" =
        totalReceived <= 0 ? "due" :
        totalReceived >= totalAllToReceive ? "full" : "partial";

      const savedRec = savedRecords.find((r: any) => r.clientName === clientName);
      const payments = clientPayments[clientName] || [];
      const givenAmt = Math.round(payments.reduce((s, p) => s + (Number(p.amount) || 0), 0) * 100) / 100;
      // Latest given date across all payments
      const givenDate = payments.map(p => p.date).filter(Boolean).sort().at(-1) || "";
      const pankajStatus: "given" | "partial" | "not_given" =
        givenAmt > 0 && givenAmt >= total ? "given" :
        givenAmt > 0 && givenAmt < total ? "partial" : "not_given";

      // Latest payment received date across full-paid invoices
      const paymentDates = fullPaidInvoices
        .map(i => i.paymentReceivedDate)
        .filter(Boolean) as string[];
      const latestPaymentDate = paymentDates.length > 0
        ? paymentDates.sort().at(-1)!
        : "";

      // Track counts for display
      const fullPaidCount = fullPaidInvoices.length;
      const totalInvCount = clientInvoices.length;

      return { idx: idx + 1, clientName, toReceive, totalReceived, invStatus, gstMinusTds, fixedAmt, total, givenDate, givenAmt, payments, latestPaymentDate, savedId: savedRec?.id || null, pankajStatus, fullPaidCount, totalInvCount };
    });

  // Apply client + status filters for display
  const rows = allRows
    .filter(r => selectedClients.length === 0 || selectedClients.includes(r.clientName))
    .filter(r => filterPankajStatus === "all" || r.pankajStatus === filterPankajStatus)
    .filter(r => filterInvStatus === "all" || r.invStatus === filterInvStatus)
    .map((r, i) => ({ ...r, idx: i + 1 }));

  const grandToReceive = rows.reduce((s, r) => s + r.toReceive, 0);
  const grandGstMinusTds = rows.reduce((s, r) => s + r.gstMinusTds, 0);
  const grandFixedAmt = rows.reduce((s, r) => s + r.fixedAmt, 0);
  const grandTotal = rows.reduce((s, r) => s + r.total, 0);
  const grandGivenAmt = rows.reduce((s, r) => s + r.givenAmt, 0);
  const grandPendingAmt = rows.reduce((s, r) => s + Math.max(r.total - r.givenAmt, 0), 0);

  const buildPayload = (r: typeof allRows[0]) => {
    const pmts = r.payments || [];
    const latestDate = pmts.map(p => p.date).filter(Boolean).sort().at(-1) || null;
    const totalGiven = pmts.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    return {
      slNo: r.idx,
      clientName: r.clientName,
      month: Number(month),
      year: Number(year),
      toReceive: String(r.toReceive),
      gstMinusTds: String(r.gstMinusTds),
      fixedAmount: String(r.fixedAmt),
      total: String(r.total),
      givenDate: latestDate,
      givenAmount: totalGiven > 0 ? String(Math.round(totalGiven * 100) / 100) : null,
      payments: JSON.stringify(pmts),
    };
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      for (let i = 0; i < allRows.length; i++) {
        const r = allRows[i];
        const payload = buildPayload(r);
        if (r.savedId) {
          await apiRequest("PUT", `/api/pankaj-reports/${r.savedId}`, payload);
        } else {
          await apiRequest("POST", `/api/pankaj-reports`, payload);
        }
      }
      const savedIds = savedRecords.map((r: any) => r.id);
      const currentSavedIds = allRows.filter(r => r.savedId).map(r => r.savedId);
      const toDelete = savedIds.filter((id: number) => !currentSavedIds.includes(id));
      for (const id of toDelete) await apiRequest("DELETE", `/api/pankaj-reports/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pankaj-reports", month, year] });
      toast({ title: "Saved", description: `Pankaj report for ${monthName} ${year} saved successfully` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save report", variant: "destructive" });
    },
  });

  // Per-row update mutation for editing individual saved rows
  const updateRowMutation = useMutation({
    mutationFn: async (r: typeof allRows[0]) => {
      const payload = buildPayload(r);
      if (r.savedId) {
        await apiRequest("PUT", `/api/pankaj-reports/${r.savedId}`, payload);
      } else {
        await apiRequest("POST", `/api/pankaj-reports`, payload);
      }
    },
    onSuccess: (_data, r) => {
      setEditingRows(prev => { const s = new Set(prev); s.delete(r.clientName); return s; });
      queryClient.invalidateQueries({ queryKey: ["/api/pankaj-reports", month, year] });
      toast({ title: "Saved", description: `${r.clientName} payment record updated` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update row", variant: "destructive" });
    },
  });

  const toggleEditRow = (clientName: string) =>
    setEditingRows(prev => {
      const s = new Set(prev);
      if (s.has(clientName)) s.delete(clientName); else s.add(clientName);
      return s;
    });

  // Add a payment entry for a client
  const addPayment = (clientName: string) => {
    const np = newPayment[clientName] || { date: "", amount: "" };
    if (!np.date || !np.amount || Number(np.amount) <= 0) {
      toast({ title: "Invalid", description: "Enter a valid date and amount", variant: "destructive" });
      return;
    }
    setClientPayments(prev => ({
      ...prev,
      [clientName]: [...(prev[clientName] || []), { date: np.date, amount: String(Number(np.amount)) }],
    }));
    setNewPayment(prev => ({ ...prev, [clientName]: { date: "", amount: "" } }));
  };

  // Remove a payment entry for a client by index
  const removePayment = (clientName: string, idx: number) => {
    setClientPayments(prev => ({
      ...prev,
      [clientName]: (prev[clientName] || []).filter((_, i) => i !== idx),
    }));
  };

  const monthsList = [
    { v: "1", l: "January" }, { v: "2", l: "February" }, { v: "3", l: "March" },
    { v: "4", l: "April" }, { v: "5", l: "May" }, { v: "6", l: "June" },
    { v: "7", l: "July" }, { v: "8", l: "August" }, { v: "9", l: "September" },
    { v: "10", l: "October" }, { v: "11", l: "November" }, { v: "12", l: "December" },
  ];

  const years: string[] = [];
  for (let y = now.getFullYear(); y >= now.getFullYear() - 5; y--) years.push(String(y));

  const monthName = monthsList.find(m => m.v === month)?.l || "";

  const hasSavedData = savedRecords.length > 0;

  const handlePrint = () => {
    if (rows.length === 0) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const today = new Date();
    const dateStr = `${String(today.getDate()).padStart(2,"0")}/${String(today.getMonth()+1).padStart(2,"0")}/${today.getFullYear()}`;
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Amount Give To Pankaj - ${monthName} ${year}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 30px 40px; color: #000; }
        .company { text-align: center; font-size: 16px; font-weight: bold; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 2px; }
        .title { text-align: center; font-size: 14px; font-weight: bold; padding: 6px 0; border-bottom: 1px solid #000; margin-bottom: 8px; }
        .meta-row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 10px; padding: 0 4px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #000; padding: 6px 8px; }
        th { background: #f0f0f0; font-weight: bold; text-align: center; font-size: 11px; }
        td { text-align: left; }
        td.right { text-align: right; font-family: 'Courier New', monospace; }
        td.center { text-align: center; }
        tfoot td { font-weight: bold; background: #f5f5f5; }
        .note { font-size: 11px; margin-top: 10px; font-style: italic; color: #444; }
        @media print { body { margin: 15px 20px; } }
      </style></head><body>
      <div class="company">DJ Hospitality & Facility Management Private Limited</div>
      <div class="title">Amount Give To Pankaj</div>
      <div class="meta-row">
        <span><b>Date:</b> ${dateStr}</span>
        <span><b>Month:</b> ${monthName} ${year}</span>
      </div>
      <table>
        <thead><tr>
          <th>Sl</th><th>Client Name</th>
          <th>To Receive</th><th>GST Amt</th><th>Fixed Amt</th><th>Total</th>
          <th>Pymnt Date</th><th>Instalment #</th><th>Given Date</th><th>Given Amt</th>
          <th>Total Given</th><th>Pending Amt</th><th>Status</th>
        </tr></thead>
        <tbody>${rows.map(r => {
          const fmtD = (d: string) => { const p = d.split("-"); return `${p[2]}/${p[1]}/${p[0]}`; };
          const pd = r.latestPaymentDate ? fmtD(r.latestPaymentDate) : "-";
          const pmts = r.payments || [];
          const pendingAmt = r.total - r.givenAmt;
          const pendingStr = r.givenAmt <= 0 ? "-" : pendingAmt <= 0 ? "0.00" : pendingAmt.toLocaleString("en-IN", {minimumFractionDigits:2});
          const pendingStyle = pendingAmt <= 0 && r.givenAmt > 0 ? "color:#15803d;" : r.givenAmt > 0 ? "color:#dc2626;font-weight:bold;" : "";
          const badge = r.pankajStatus === "given" ? "Full Paid" : r.pankajStatus === "partial" ? "Pending" : "Not Given";
          const badgeStyle = r.pankajStatus === "given" ? "color:#15803d;background:#dcfce7;" : r.pankajStatus === "partial" ? "color:#b45309;background:#fef3c7;" : "color:#4b5563;background:#f3f4f6;";
          if (pmts.length === 0) {
            return `<tr>
            <td class="center">${r.idx}</td><td>${r.clientName}</td>
            <td class="right">${r.toReceive.toLocaleString("en-IN", {minimumFractionDigits:2})}</td>
            <td class="right">${r.gstMinusTds.toLocaleString("en-IN", {minimumFractionDigits:2})}</td>
            <td class="right">${r.fixedAmt > 0 ? r.fixedAmt.toLocaleString("en-IN", {minimumFractionDigits:2}) : "-"}</td>
            <td class="right" style="font-weight:bold">${r.total.toLocaleString("en-IN", {minimumFractionDigits:2})}</td>
            <td class="center">${pd}</td>
            <td class="center">-</td><td class="center">-</td><td class="right">-</td>
            <td class="right">-</td><td class="right">-</td>
            <td class="center"><span style="padding:2px 6px;border-radius:4px;font-size:10px;font-weight:bold;${badgeStyle}">${badge}</span></td>
          </tr>`;
          }
          return pmts.map((p: any, pi: number) => {
            const isFirst = pi === 0;
            const isLast = pi === pmts.length - 1;
            const rowspan = pmts.length;
            const gd = p.date ? fmtD(p.date) : "-";
            return `<tr>
            ${isFirst ? `<td class="center" rowspan="${rowspan}">${r.idx}</td><td rowspan="${rowspan}">${r.clientName}</td>
            <td class="right" rowspan="${rowspan}">${r.toReceive.toLocaleString("en-IN", {minimumFractionDigits:2})}</td>
            <td class="right" rowspan="${rowspan}">${r.gstMinusTds.toLocaleString("en-IN", {minimumFractionDigits:2})}</td>
            <td class="right" rowspan="${rowspan}">${r.fixedAmt > 0 ? r.fixedAmt.toLocaleString("en-IN", {minimumFractionDigits:2}) : "-"}</td>
            <td class="right" rowspan="${rowspan}" style="font-weight:bold">${r.total.toLocaleString("en-IN", {minimumFractionDigits:2})}</td>
            <td class="center" rowspan="${rowspan}">${pd}</td>` : ""}
            <td class="center" style="background:#faf5ff;font-weight:bold">Inst. ${pi + 1}</td>
            <td class="center" style="background:#faf5ff">${gd}</td>
            <td class="right" style="background:#faf5ff;color:#15803d;font-weight:bold">${Number(p.amount).toLocaleString("en-IN", {minimumFractionDigits:2})}</td>
            ${isLast ? `<td class="right" rowspan="1" style="font-weight:bold;color:#7c3aed">${r.givenAmt.toLocaleString("en-IN", {minimumFractionDigits:2})}</td>
            <td class="right" rowspan="1" style="${pendingStyle}">${pendingStr}</td>
            <td class="center" rowspan="1"><span style="padding:2px 6px;border-radius:4px;font-size:10px;font-weight:bold;${badgeStyle}">${badge}</span></td>` : ""}
          </tr>`;
          }).join("");
        }).join("")}</tbody>
        <tfoot><tr>
          <td colspan="2" style="text-align:center"><b>Grand Total</b></td>
          <td class="right">${grandToReceive.toLocaleString("en-IN", {minimumFractionDigits:2})}</td>
          <td class="right">${grandGstMinusTds.toLocaleString("en-IN", {minimumFractionDigits:2})}</td>
          <td class="right">${grandFixedAmt > 0 ? grandFixedAmt.toLocaleString("en-IN", {minimumFractionDigits:2}) : "-"}</td>
          <td class="right">${grandTotal.toLocaleString("en-IN", {minimumFractionDigits:2})}</td>
          <td colspan="4"></td>
          <td class="right" style="color:#7c3aed;font-weight:bold">${grandGivenAmt > 0 ? grandGivenAmt.toLocaleString("en-IN", {minimumFractionDigits:2}) : "-"}</td>
          <td class="right" style="${grandPendingAmt > 0 ? "color:#dc2626;font-weight:bold" : "color:#15803d;font-weight:bold"}">${grandPendingAmt > 0 ? grandPendingAmt.toLocaleString("en-IN", {minimumFractionDigits:2}) : "0.00"}</td>
          <td></td>
        </tr></tfoot>
      </table>
      <p class="note">GST Amount = GST Amount - TDS Amount &nbsp;|&nbsp; Total = (GST - TDS) + Fixed Amount</p>
      <script>window.onload=function(){window.print();}<\/script>
    </body></html>`);
    printWindow.document.close();
  };

  const handleExportExcel = async () => {
    if (rows.length === 0) return;
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Amount Give To Pankaj");

    const TOTAL_COLS = 13;
    const fmtD = (d: string) => { const p = d.split("-"); return `${p[2]}/${p[1]}/${p[0]}`; };
    const today = new Date();
    const dateStr = `${String(today.getDate()).padStart(2,"0")}/${String(today.getMonth()+1).padStart(2,"0")}/${today.getFullYear()}`;

    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: "thin" }, bottom: { style: "thin" },
      left: { style: "thin" }, right: { style: "thin" },
    };
    const violet = "FF7C3AED";
    const green = "FF15803D";
    const red = "FFDC2626";
    const amber = "FFB45309";
    const grey = "FFF5F5F5";
    const darkBg = "FF1A237E";
    const white = "FFFFFFFF";

    // Row 1 — Company
    ws.mergeCells(1, 1, 1, TOTAL_COLS);
    const r1 = ws.getRow(1);
    r1.getCell(1).value = "DJ Hospitality & Facility Management Private Limited";
    r1.getCell(1).font = { bold: true, size: 14 };
    r1.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
    r1.height = 24;

    // Row 2 — Title
    ws.mergeCells(2, 1, 2, TOTAL_COLS);
    const r2 = ws.getRow(2);
    r2.getCell(1).value = "Amount Give To Pankaj";
    r2.getCell(1).font = { bold: true, size: 13 };
    r2.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
    r2.height = 20;

    // Row 3 — Date / Month meta
    ws.mergeCells(3, 1, 3, 6);
    ws.getRow(3).getCell(1).value = `Date: ${dateStr}`;
    ws.getRow(3).getCell(1).font = { bold: true, size: 10 };
    ws.mergeCells(3, 8, 3, TOTAL_COLS);
    ws.getRow(3).getCell(8).value = `Month: ${monthName} ${year}`;
    ws.getRow(3).getCell(8).font = { bold: true, size: 10 };
    ws.getRow(3).getCell(8).alignment = { horizontal: "right" };
    ws.getRow(3).height = 16;

    // Row 4 — blank spacer
    ws.getRow(4).height = 6;

    // Row 5 — Column headers
    const headers = [
      "Sl", "Client Name", "To Receive", "GST Amt", "Fixed Amt", "Total",
      "Pymnt Date", "Instalment #", "Given Date", "Given Amt",
      "Total Given", "Pending Amt", "Status"
    ];
    const headerRow = ws.getRow(5);
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: darkBg } };
      cell.font = { bold: true, color: { argb: white }, size: 10 };
      cell.border = thinBorder;
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    });
    headerRow.height = 30;

    // Column widths
    ws.getColumn(1).width = 5;
    ws.getColumn(2).width = 30;
    ws.getColumn(3).width = 14;
    ws.getColumn(4).width = 13;
    ws.getColumn(5).width = 12;
    ws.getColumn(6).width = 14;
    ws.getColumn(7).width = 13;
    ws.getColumn(8).width = 13;
    ws.getColumn(9).width = 13;
    ws.getColumn(10).width = 13;
    ws.getColumn(11).width = 13;
    ws.getColumn(12).width = 13;
    ws.getColumn(13).width = 12;

    // Data rows
    let rowIdx = 6;
    rows.forEach(r => {
      const pmts = r.payments || [];
      const pendingAmt = Math.max(r.total - r.givenAmt, 0);
      const badge = r.pankajStatus === "given" ? "Full Paid" : r.pankajStatus === "partial" ? "Pending" : "Not Given";
      const badgeColor = r.pankajStatus === "given" ? green : r.pankajStatus === "partial" ? amber : "FF4B5563";
      const pd = r.latestPaymentDate ? fmtD(r.latestPaymentDate) : "-";

      if (pmts.length === 0) {
        const dr = ws.getRow(rowIdx++);
        const rowBg = (rowIdx % 2 === 0) ? "FFFAF5FF" : white;
        const cells: [number, any, string, boolean][] = [
          [1, r.idx, "center", false],
          [2, r.clientName, "left", false],
          [3, r.toReceive, "right", false],
          [4, r.gstMinusTds, "right", false],
          [5, r.fixedAmt > 0 ? r.fixedAmt : "-", "right", false],
          [6, r.total, "right", true],
          [7, pd, "center", false],
          [8, "-", "center", false],
          [9, "-", "center", false],
          [10, "-", "right", false],
          [11, "-", "right", false],
          [12, "-", "right", false],
          [13, badge, "center", false],
        ];
        cells.forEach(([col, val, align, bold]) => {
          const c = dr.getCell(col);
          c.value = val;
          c.border = thinBorder;
          c.alignment = { horizontal: align as any, vertical: "middle" };
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowBg } };
          if (bold) c.font = { bold: true };
          if (col === 3 || col === 4 || col === 6) c.numFmt = '#,##0.00';
          if (col === 13) c.font = { bold: true, color: { argb: badgeColor } };
        });
      } else {
        pmts.forEach((p: any, pi: number) => {
          const dr = ws.getRow(rowIdx++);
          const instBg = "FFFAF5FF";
          const rowBg = pi % 2 === 0 ? "FFFAF5FF" : "FFF3F0FF";
          const gd = p.date ? fmtD(p.date) : "-";
          const isLast = pi === pmts.length - 1;

          // Client-level data only on the first instalment row
          if (pi === 0) {
            [[1, r.idx], [2, r.clientName], [3, r.toReceive], [4, r.gstMinusTds],
             [5, r.fixedAmt > 0 ? r.fixedAmt : "-"], [6, r.total], [7, pd]].forEach(([col, val]) => {
              const c = dr.getCell(col as number);
              c.value = val;
              c.border = thinBorder;
              c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowBg } };
              c.alignment = { horizontal: col === 1 || col === 7 ? "center" : col === 2 ? "left" : "right" as any, vertical: "middle" };
              if (col === 3 || col === 4 || col === 6) { if (typeof val === "number") c.numFmt = '#,##0.00'; }
              if (col === 6) c.font = { bold: true };
            });
          } else {
            // Subsequent instalment rows — keep border + bg, no value
            [1, 2, 3, 4, 5, 6, 7].forEach(col => {
              const c = dr.getCell(col);
              c.border = thinBorder;
              c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowBg } };
            });
          }

          const instCell = dr.getCell(8);
          instCell.value = `Inst. ${pi + 1}`;
          instCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: instBg } };
          instCell.font = { bold: true, color: { argb: violet } };
          instCell.border = thinBorder;
          instCell.alignment = { horizontal: "center", vertical: "middle" };

          const gdCell = dr.getCell(9);
          gdCell.value = gd;
          gdCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: instBg } };
          gdCell.border = thinBorder;
          gdCell.alignment = { horizontal: "center", vertical: "middle" };

          const amtCell = dr.getCell(10);
          amtCell.value = Number(p.amount);
          amtCell.numFmt = '#,##0.00';
          amtCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: instBg } };
          amtCell.font = { bold: true, color: { argb: green } };
          amtCell.border = thinBorder;
          amtCell.alignment = { horizontal: "right", vertical: "middle" };

          if (isLast) {
            const tgCell = dr.getCell(11);
            tgCell.value = r.givenAmt;
            tgCell.numFmt = '#,##0.00';
            tgCell.font = { bold: true, color: { argb: violet } };
            tgCell.border = thinBorder;
            tgCell.alignment = { horizontal: "right", vertical: "middle" };
            tgCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: instBg } };

            const paCell = dr.getCell(12);
            paCell.value = pendingAmt > 0 ? pendingAmt : (r.givenAmt > 0 ? 0 : "-" as any);
            if (typeof paCell.value === "number") paCell.numFmt = '#,##0.00';
            paCell.font = { bold: pendingAmt > 0, color: { argb: pendingAmt <= 0 && r.givenAmt > 0 ? green : pendingAmt > 0 ? red : "FF4B5563" } };
            paCell.border = thinBorder;
            paCell.alignment = { horizontal: "right", vertical: "middle" };
            paCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: instBg } };

            const stCell = dr.getCell(13);
            stCell.value = badge;
            stCell.font = { bold: true, color: { argb: badgeColor } };
            stCell.border = thinBorder;
            stCell.alignment = { horizontal: "center", vertical: "middle" };
            stCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: instBg } };
          } else {
            [11, 12, 13].forEach(col => {
              const c = dr.getCell(col);
              c.border = thinBorder;
              c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowBg } };
            });
          }
        });
      }
    });

    // Grand Total row
    const gtRow = ws.getRow(rowIdx);
    ws.mergeCells(rowIdx, 1, rowIdx, 2);
    gtRow.getCell(1).value = "Grand Total";
    gtRow.getCell(1).font = { bold: true, size: 11 };
    gtRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
    gtRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: grey } };
    gtRow.getCell(1).border = thinBorder;

    [[3, grandToReceive], [4, grandGstMinusTds], [5, grandFixedAmt > 0 ? grandFixedAmt : "-"], [6, grandTotal],
     [11, grandGivenAmt > 0 ? grandGivenAmt : "-"], [12, grandPendingAmt > 0 ? grandPendingAmt : 0]
    ].forEach(([col, val]) => {
      const c = gtRow.getCell(col as number);
      c.value = val;
      if (typeof val === "number") c.numFmt = '#,##0.00';
      c.font = { bold: true, color: { argb: col === 11 ? violet : col === 12 ? (grandPendingAmt > 0 ? red : green) : "FF000000" } };
      c.border = thinBorder;
      c.alignment = { horizontal: "right", vertical: "middle" };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: grey } };
    });
    [7, 8, 9, 10, 13].forEach(col => {
      const c = gtRow.getCell(col);
      c.border = thinBorder;
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: grey } };
    });
    gtRow.height = 20;

    // Note row
    ws.mergeCells(rowIdx + 2, 1, rowIdx + 2, TOTAL_COLS);
    ws.getRow(rowIdx + 2).getCell(1).value = "GST Amount = GST Amount – TDS Amount  |  Total = (GST – TDS) + Fixed Amount";
    ws.getRow(rowIdx + 2).getCell(1).font = { italic: true, size: 9, color: { argb: "FF555555" } };

    // Download
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Pankaj_Report_${monthName}_${year}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* ── Filter bar (matches main Sales Invoice style) ── */}
      <Card className="border-0 shadow-sm mb-4">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md">
              <User className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-sm leading-tight" data-testid="text-pankaj-title">Amount Give To Pankaj</h3>
              <p className="text-[10px] text-muted-foreground">
                {monthName} {year}
                {hasSavedData && <Badge variant="outline" className="ml-2 text-[10px] border-green-300 text-green-600 bg-green-50 dark:bg-green-950/30">Saved</Badge>}
              </p>
            </div>
            <div className="ml-auto flex gap-2">
              <Button size="sm" className="h-9 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white shadow-md" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || allRows.length === 0} data-testid="button-save-pankaj">
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                {hasSavedData ? "Update" : "Save"}
              </Button>
              <Button size="sm" variant="outline" className="h-9 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400" onClick={handleExportExcel} disabled={rows.length === 0} data-testid="button-excel-pankaj">
                <FileDown className="w-4 h-4 mr-1" /> Excel
              </Button>
              <Button size="sm" className="h-9 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-md" onClick={handlePrint} data-testid="button-print-pankaj">
                <Printer className="w-4 h-4 mr-1" /> Print
              </Button>
            </div>
          </div>
          {/* Filters row */}
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 flex-wrap">
            {/* Multi-client checkbox dropdown */}
            <div className="relative col-span-2 sm:col-span-1" ref={dropdownRef}>
              <Button variant="outline" size="sm" className="h-9 w-full sm:w-auto sm:min-w-[190px] justify-between border-violet-200 dark:border-violet-800 hover:bg-violet-50 dark:hover:bg-violet-950/30" onClick={() => setClientDropdownOpen(!clientDropdownOpen)} data-testid="button-pankaj-client-select">
                <span className="flex items-center gap-1.5 text-xs">
                  <Building2 className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />
                  {selectedClients.length === 0 ? "All Clients" : `${selectedClients.length} client${selectedClients.length > 1 ? "s" : ""} selected`}
                </span>
                <span className="ml-1 text-muted-foreground">▾</span>
              </Button>
              {clientDropdownOpen && (
                <div className="absolute z-50 mt-1 w-72 bg-white dark:bg-gray-900 border border-violet-100 dark:border-violet-900 rounded-xl shadow-2xl shadow-violet-100/50 dark:shadow-violet-950/50 p-2 max-h-64 overflow-y-auto" data-testid="dropdown-pankaj-clients" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                  <div className="flex gap-2 mb-2 px-1">
                    <Button size="sm" variant="outline" className="h-6 text-[10px] border-violet-200" onClick={(e) => { e.stopPropagation(); selectAllClients(allRows.map(r => r.clientName)); }}>Select All</Button>
                    <Button size="sm" variant="outline" className="h-6 text-[10px] border-violet-200" onClick={(e) => { e.stopPropagation(); clearAllClients(); }}>Clear All</Button>
                  </div>
                  {allRows.map(r => (
                    <div key={r.clientName} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-950/30 cursor-pointer transition-colors" onClick={(e) => { e.stopPropagation(); toggleClient(r.clientName); }} data-testid={`checkbox-client-${r.clientName}`}>
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center text-white text-xs transition-all ${selectedClients.includes(r.clientName) ? "bg-violet-600 border-violet-600 shadow-sm shadow-violet-300" : "border-gray-300 dark:border-gray-600"}`}>
                        {selectedClients.includes(r.clientName) && <Check className="w-3.5 h-3.5" />}
                      </div>
                      <span className="text-sm">{r.clientName}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-full sm:w-[140px] h-9 text-sm" data-testid="select-pankaj-month">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthsList.map(m => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-full sm:w-[100px] h-9 text-sm" data-testid="select-pankaj-year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={filterPankajStatus} onValueChange={setFilterPankajStatus}>
              <SelectTrigger className="w-full sm:w-[150px] h-9 text-sm" data-testid="select-pankaj-status">
                <SelectValue placeholder="Pankaj Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Pankaj Status</SelectItem>
                <SelectItem value="given">Given (Full)</SelectItem>
                <SelectItem value="partial">Partial Given</SelectItem>
                <SelectItem value="not_given">Not Given</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterInvStatus} onValueChange={setFilterInvStatus}>
              <SelectTrigger className="w-full sm:w-[160px] h-9 text-sm" data-testid="select-pankaj-inv-status">
                <SelectValue placeholder="Invoice Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Invoice Status</SelectItem>
                <SelectItem value="due">Due</SelectItem>
                <SelectItem value="partial">Partial Received</SelectItem>
                <SelectItem value="full">Full Paid</SelectItem>
              </SelectContent>
            </Select>

            {(selectedClients.length > 0 || filterPankajStatus !== "all" || filterInvStatus !== "all") && (
              <Button variant="ghost" size="sm" className="h-9 text-muted-foreground text-sm col-span-2 sm:col-span-1"
                onClick={() => { clearAllClients(); setFilterPankajStatus("all"); setFilterInvStatus("all"); }}>
                Clear Filters
              </Button>
            )}

            <div className="col-span-2 sm:col-span-1 sm:ml-auto text-xs text-muted-foreground text-right">
              {rows.length} client{rows.length !== 1 ? "s" : ""} shown
              {allRows.length !== rows.length && ` (of ${allRows.length})`}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-5">
        <Card className="border-0 shadow-lg overflow-hidden group hover:shadow-xl transition-shadow">
          <div className="h-1 bg-gradient-to-r from-violet-400 to-violet-600" />
          <CardContent className="p-3 sm:p-4 text-center">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center mx-auto mb-1.5 sm:mb-2">
              <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-violet-600 dark:text-violet-400" />
            </div>
            <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Clients</p>
            <p className="text-2xl sm:text-3xl font-bold text-violet-600" data-testid="text-pankaj-client-count">{rows.length}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-lg overflow-hidden group hover:shadow-xl transition-shadow">
          <div className="h-1 bg-gradient-to-r from-amber-400 to-orange-500" />
          <CardContent className="p-3 sm:p-4 text-center">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center mx-auto mb-1.5 sm:mb-2">
              <IndianRupee className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">To Receive</p>
            <p className="text-xs sm:text-lg font-bold font-mono text-amber-600" data-testid="text-pankaj-to-receive">₹{grandToReceive.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-lg overflow-hidden group hover:shadow-xl transition-shadow">
          <div className="h-1 bg-gradient-to-r from-blue-400 to-indigo-500" />
          <CardContent className="p-3 sm:p-4 text-center">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center mx-auto mb-1.5 sm:mb-2">
              <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">GST - TDS</p>
            <p className="text-xs sm:text-lg font-bold font-mono text-blue-600" data-testid="text-pankaj-gst-tds">₹{grandGstMinusTds.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-lg overflow-hidden group hover:shadow-xl transition-shadow">
          <div className="h-1 bg-gradient-to-r from-emerald-400 to-green-500" />
          <CardContent className="p-3 sm:p-4 text-center">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mx-auto mb-1.5 sm:mb-2">
              <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Total</p>
            <p className="text-xs sm:text-lg font-bold font-mono text-emerald-600" data-testid="text-pankaj-grand-total">₹{grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
      </div>

      {loadingSaved ? (
        <Card className="border-0 shadow-lg">
          <CardContent className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
          </CardContent>
        </Card>
      ) : allRows.length === 0 ? (
        <Card className="border-0 shadow-lg">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center mb-4">
              <Building2 className="w-8 h-8 text-violet-400" />
            </div>
            <p className="text-muted-foreground text-sm font-medium">No invoices found for {monthName} {year}</p>
            <p className="text-muted-foreground/60 text-xs mt-1">Try selecting a different month or year</p>
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card className="border-0 shadow-lg">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center mb-3">
              <Building2 className="w-7 h-7 text-violet-400" />
            </div>
            <p className="text-muted-foreground text-sm font-medium">No records match the selected filters</p>
            <Button variant="ghost" size="sm" className="mt-2 text-violet-600" onClick={() => { clearAllClients(); setFilterPankajStatus("all"); setFilterInvStatus("all"); }}>Clear Filters</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="hidden lg:block">
            <Card className="border-0 shadow-lg overflow-hidden" data-testid="card-pankaj-report-table">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 text-white">
                      <th className="text-center py-3.5 px-4 font-semibold text-xs">Sl No</th>
                      <th className="text-left py-3.5 px-4 font-semibold text-xs">Client Name</th>
                      <th className="text-right py-3.5 px-4 font-semibold text-xs">To Receive</th>
                      <th className="text-right py-3.5 px-4 font-semibold text-xs">GST Amount</th>
                      <th className="text-center py-3.5 px-4 font-semibold text-xs">Fixed Amount</th>
                      <th className="text-right py-3.5 px-4 font-semibold text-xs">Total</th>
                      <th className="text-center py-3.5 px-4 font-semibold text-xs">Pymnt Date</th>
                      <th className="text-center py-3.5 px-4 font-semibold text-xs">Given Dates</th>
                      <th className="text-right py-3.5 px-4 font-semibold text-xs">Given Amts</th>
                      <th className="text-right py-3.5 px-4 font-semibold text-xs">Pending Amt</th>
                      <th className="text-center py-3.5 px-4 font-semibold text-xs">Inv. Status</th>
                      <th className="text-center py-3.5 px-4 font-semibold text-xs">Pankaj</th>
                      <th className="text-center py-3.5 px-4 font-semibold text-xs">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.clientName} className={`border-b border-gray-100 dark:border-gray-800 hover:bg-violet-50/70 dark:hover:bg-violet-950/20 transition-colors ${r.idx % 2 === 0 ? "bg-gray-50/60 dark:bg-gray-900/50" : "bg-white dark:bg-gray-950"}`} data-testid={`row-pankaj-${r.idx}`}>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900 dark:to-purple-900 text-violet-700 dark:text-violet-300 text-xs font-bold">{r.idx}</span>
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-semibold text-sm">{r.clientName}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {r.fullPaidCount}/{r.totalInvCount} inv full paid
                          </p>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-sm">{fmtCurrency(r.toReceive)}</td>
                        <td className="py-3 px-4 text-right font-mono text-sm text-blue-600 dark:text-blue-400">{fmtCurrency(r.gstMinusTds)}</td>
                        <td className="py-2 px-2 text-center">
                          <Input type="number" className="w-24 h-8 text-xs text-center font-mono mx-auto" placeholder="0" disabled={!!r.savedId && !editingRows.has(r.clientName)} value={fixedAmounts[r.clientName] || ""} onChange={(e) => setFixedAmounts(prev => ({ ...prev, [r.clientName]: Number(e.target.value) || 0 }))} data-testid={`input-fixed-amt-${r.idx}`} />
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">{fmtCurrency(r.total)}</td>
                        <td className="py-3 px-3 text-center text-xs text-blue-600 font-medium">
                          {r.latestPaymentDate ? fmtDate(r.latestPaymentDate) : <span className="text-muted-foreground">—</span>}
                        </td>
                        {/* Payment history – date column */}
                        <td className="py-2 px-2 text-center min-w-[130px] align-top">
                          <div className="space-y-1">
                            {(clientPayments[r.clientName] || []).map((p, pi) => (
                              <div key={pi} className="flex items-center gap-1 justify-center">
                                <span className="text-xs font-medium text-violet-700 dark:text-violet-300">{p.date ? fmtDate(p.date) : "—"}</span>
                                {(editingRows.has(r.clientName) || !r.savedId) && (
                                  <button className="text-red-400 hover:text-red-600 text-[10px] ml-0.5" onClick={() => removePayment(r.clientName, pi)}>✕</button>
                                )}
                              </div>
                            ))}
                            {(editingRows.has(r.clientName) || !r.savedId) && (
                              <Input type="date" className="w-[120px] h-7 text-xs text-center mx-auto mt-1" value={newPayment[r.clientName]?.date || ""} onChange={(e) => setNewPayment(prev => ({ ...prev, [r.clientName]: { ...prev[r.clientName], date: e.target.value } }))} data-testid={`input-given-date-${r.idx}`} />
                            )}
                            {(clientPayments[r.clientName] || []).length === 0 && !(editingRows.has(r.clientName) || !r.savedId) && (
                              <span className="text-[11px] text-muted-foreground">Not set</span>
                            )}
                          </div>
                        </td>
                        {/* Payment history – amount column */}
                        <td className="py-2 px-2 text-right min-w-[120px] align-top">
                          <div className="space-y-1">
                            {(clientPayments[r.clientName] || []).map((p, pi) => (
                              <div key={pi} className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 h-5 flex items-center justify-end">
                                {fmtCurrency(Number(p.amount))}
                              </div>
                            ))}
                            {(editingRows.has(r.clientName) || !r.savedId) && (
                              <div className="flex items-center gap-1 mt-1 justify-end">
                                <Input type="number" className="w-24 h-7 text-xs text-right font-mono" placeholder="0.00" value={newPayment[r.clientName]?.amount || ""} onChange={(e) => setNewPayment(prev => ({ ...prev, [r.clientName]: { ...prev[r.clientName], amount: e.target.value } }))} data-testid={`input-given-amt-${r.idx}`} />
                                <button className="h-7 px-2 text-[11px] bg-violet-600 hover:bg-violet-700 text-white rounded font-semibold" onClick={() => addPayment(r.clientName)}>+Add</button>
                              </div>
                            )}
                            {(clientPayments[r.clientName] || []).length === 0 && !(editingRows.has(r.clientName) || !r.savedId) && (
                              <span className="text-[11px] text-muted-foreground">—</span>
                            )}
                          </div>
                        </td>
                        {/* Pending Amt = Total - sum(payments) */}
                        <td className="py-3 px-3 text-right min-w-[90px]">
                          {(() => {
                            const pending = r.total - r.givenAmt;
                            if (r.givenAmt <= 0) return <span className="text-xs text-muted-foreground">—</span>;
                            if (pending <= 0) return <span className="text-xs font-mono font-bold text-emerald-600">₹0.00</span>;
                            return <span className="text-xs font-mono font-bold text-red-600 dark:text-red-400">{fmtCurrency(pending)}</span>;
                          })()}
                        </td>
                        <td className="py-3 px-2 text-center">
                          {r.invStatus === "full" ? (
                            <Badge className="text-[10px] bg-green-100 text-green-700 border-green-300 hover:bg-green-100">Full Paid</Badge>
                          ) : r.invStatus === "partial" ? (
                            <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-100">Partial</Badge>
                          ) : (
                            <Badge className="text-[10px] bg-red-100 text-red-700 border-red-300 hover:bg-red-100">Due</Badge>
                          )}
                        </td>
                        <td className="py-3 px-2 text-center">
                          {r.pankajStatus === "given" ? (
                            <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-300 hover:bg-emerald-100">Given</Badge>
                          ) : r.pankajStatus === "partial" ? (
                            <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-100">Partial</Badge>
                          ) : (
                            <Badge className="text-[10px] bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-100">Not Given</Badge>
                          )}
                        </td>
                        <td className="py-2 px-2 text-center">
                          {r.savedId && !editingRows.has(r.clientName) ? (
                            <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] border-violet-300 text-violet-700 hover:bg-violet-50" onClick={() => toggleEditRow(r.clientName)} data-testid={`button-edit-row-${r.idx}`}>
                              <Pencil className="w-3 h-3 mr-1" /> Edit
                            </Button>
                          ) : editingRows.has(r.clientName) ? (
                            <div className="flex gap-1 justify-center">
                              <Button size="sm" className="h-7 px-2 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => updateRowMutation.mutate(r)} disabled={updateRowMutation.isPending} data-testid={`button-save-row-${r.idx}`}>
                                {updateRowMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
                                Save
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] text-muted-foreground" onClick={() => toggleEditRow(r.clientName)}>✕</Button>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gradient-to-r from-violet-100 via-purple-100 to-fuchsia-100 dark:from-violet-950/50 dark:via-purple-950/50 dark:to-fuchsia-950/50">
                      <td colSpan={2} className="py-3 px-4 text-sm font-bold">Grand Total</td>
                      <td className="py-3 px-4 text-right font-mono text-sm font-bold">{fmtCurrency(grandToReceive)}</td>
                      <td className="py-3 px-4 text-right font-mono text-sm font-bold text-blue-600">{fmtCurrency(grandGstMinusTds)}</td>
                      <td className="py-3 px-4 text-center font-mono text-sm font-bold">{grandFixedAmt > 0 ? fmtCurrency(grandFixedAmt) : "-"}</td>
                      <td className="py-3 px-4 text-right font-mono text-sm font-bold text-emerald-600">{fmtCurrency(grandTotal)}</td>
                      <td className="py-3 px-3"></td>
                      <td className="py-3 px-3"></td>
                      <td className="py-3 px-3 text-right font-mono text-sm font-bold text-violet-700 dark:text-violet-300">{grandGivenAmt > 0 ? fmtCurrency(grandGivenAmt) : "—"}</td>
                      <td className="py-3 px-3 text-right font-mono text-sm font-bold text-red-600 dark:text-red-400">{grandPendingAmt > 0 ? fmtCurrency(grandPendingAmt) : <span className="text-emerald-600">₹0.00</span>}</td>
                      <td colSpan={3}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          </div>

          <div className="lg:hidden space-y-3">
            {rows.map((r) => (
              <Card key={r.clientName} className="border-0 shadow-lg overflow-hidden" data-testid={`card-pankaj-mobile-${r.idx}`}>
                <div className="h-1.5 bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500" />
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3 gap-2">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white text-sm font-bold shadow-md shadow-violet-200 dark:shadow-violet-900/30 flex-shrink-0">{r.idx}</span>
                      <div>
                        <p className="font-bold text-sm">{r.clientName}</p>
                        <p className="text-[10px] text-muted-foreground">{r.fullPaidCount}/{r.totalInvCount} inv full paid</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      {r.invStatus === "full" ? (
                        <Badge className="text-[10px] bg-green-100 text-green-700 border-green-300 hover:bg-green-100">Full Paid</Badge>
                      ) : r.invStatus === "partial" ? (
                        <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-100">Partial</Badge>
                      ) : (
                        <Badge className="text-[10px] bg-red-100 text-red-700 border-red-300 hover:bg-red-100">Due</Badge>
                      )}
                      {r.pankajStatus === "given" ? (
                        <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-300 hover:bg-emerald-100">Given</Badge>
                      ) : r.pankajStatus === "partial" ? (
                        <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-100">Partial</Badge>
                      ) : (
                        <Badge className="text-[10px] bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-100">Not Given</Badge>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl p-2.5 text-center">
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 uppercase tracking-wider font-medium">To Receive</p>
                      <p className="font-mono font-bold text-amber-700 dark:text-amber-300 mt-0.5">{fmtCurrency(r.toReceive)}</p>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-950/20 rounded-xl p-2.5 text-center">
                      <p className="text-[10px] text-blue-600 dark:text-blue-400 uppercase tracking-wider font-medium">GST - TDS</p>
                      <p className="font-mono font-bold text-blue-700 dark:text-blue-300 mt-0.5">{fmtCurrency(r.gstMinusTds)}</p>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-950/20 rounded-xl p-2.5 text-center">
                      <p className="text-[10px] text-purple-600 dark:text-purple-400 uppercase tracking-wider font-medium">Fixed Amount</p>
                      <Input type="number" className="w-20 h-7 text-xs text-center font-mono mx-auto mt-0.5" placeholder="0" disabled={!!r.savedId && !editingRows.has(r.clientName)} value={fixedAmounts[r.clientName] || ""} onChange={(e) => setFixedAmounts(prev => ({ ...prev, [r.clientName]: Number(e.target.value) || 0 }))} data-testid={`input-fixed-amt-mobile-${r.idx}`} />
                    </div>
                    <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-xl p-2.5 text-center">
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase tracking-wider font-medium">Total</p>
                      <p className="font-mono font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">{fmtCurrency(r.total)}</p>
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    {r.latestPaymentDate && (
                      <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-950/20 rounded-lg px-2.5 py-1.5">
                        <CalendarDays className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                        <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">Payment Received: {fmtDate(r.latestPaymentDate)}</span>
                      </div>
                    )}
                    {/* Payment history list */}
                    <div className="border border-dashed border-violet-200 dark:border-violet-800 rounded-xl p-2.5 space-y-1.5">
                      <p className="text-[10px] uppercase tracking-wider text-violet-600 dark:text-violet-400 font-semibold mb-1">Payment History</p>
                      {(clientPayments[r.clientName] || []).map((p, pi) => (
                        <div key={pi} className="flex items-center justify-between bg-violet-50 dark:bg-violet-950/30 rounded-lg px-2.5 py-1.5">
                          <div className="flex items-center gap-2">
                            <CalendarDays className="w-3 h-3 text-violet-500" />
                            <span className="text-xs font-medium text-violet-700 dark:text-violet-300">{p.date ? fmtDate(p.date) : "—"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">{fmtCurrency(Number(p.amount))}</span>
                            {(editingRows.has(r.clientName) || !r.savedId) && (
                              <button className="text-red-400 hover:text-red-600 text-xs font-bold" onClick={() => removePayment(r.clientName, pi)}>✕</button>
                            )}
                          </div>
                        </div>
                      ))}
                      {(clientPayments[r.clientName] || []).length === 0 && !(editingRows.has(r.clientName) || !r.savedId) && (
                        <p className="text-xs text-muted-foreground italic text-center py-1">No payments recorded</p>
                      )}
                      {/* Add payment form */}
                      {(editingRows.has(r.clientName) || !r.savedId) && (
                        <div className="flex items-center gap-1.5 pt-1 border-t border-violet-100 dark:border-violet-900 mt-1">
                          <Input type="date" className="flex-1 h-7 text-xs" value={newPayment[r.clientName]?.date || ""} onChange={(e) => setNewPayment(prev => ({ ...prev, [r.clientName]: { ...prev[r.clientName], date: e.target.value } }))} data-testid={`input-given-date-mobile-${r.idx}`} />
                          <Input type="number" className="w-24 h-7 text-xs font-mono text-right" placeholder="0.00" value={newPayment[r.clientName]?.amount || ""} onChange={(e) => setNewPayment(prev => ({ ...prev, [r.clientName]: { ...prev[r.clientName], amount: e.target.value } }))} data-testid={`input-given-amt-mobile-${r.idx}`} />
                          <button className="h-7 px-2 text-[11px] bg-violet-600 hover:bg-violet-700 text-white rounded font-semibold flex-shrink-0" onClick={() => addPayment(r.clientName)}>+Add</button>
                        </div>
                      )}
                    </div>
                    {/* Pending Amount row */}
                    {r.givenAmt > 0 && (
                      <div className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 ${r.total - r.givenAmt <= 0 ? "bg-emerald-50 dark:bg-emerald-950/20" : "bg-red-50 dark:bg-red-950/20"}`}>
                        <IndianRupee className={`w-3.5 h-3.5 flex-shrink-0 ${r.total - r.givenAmt <= 0 ? "text-emerald-500" : "text-red-500"}`} />
                        <span className="text-xs text-muted-foreground flex-shrink-0">Pending:</span>
                        <span className={`text-xs font-mono font-bold ml-auto ${r.total - r.givenAmt <= 0 ? "text-emerald-600" : "text-red-600 dark:text-red-400"}`}>
                          {r.total - r.givenAmt <= 0 ? "₹0.00 (Full Paid)" : fmtCurrency(r.total - r.givenAmt)}
                        </span>
                      </div>
                    )}
                    {r.savedId && (
                      <div className="flex justify-end pt-1">
                        {!editingRows.has(r.clientName) ? (
                          <Button size="sm" variant="outline" className="h-8 px-3 text-xs border-violet-300 text-violet-700 hover:bg-violet-50" onClick={() => toggleEditRow(r.clientName)} data-testid={`button-edit-row-mobile-${r.idx}`}>
                            <Pencil className="w-3 h-3 mr-1" /> Edit
                          </Button>
                        ) : (
                          <div className="flex gap-2">
                            <Button size="sm" className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => updateRowMutation.mutate(r)} disabled={updateRowMutation.isPending} data-testid={`button-save-row-mobile-${r.idx}`}>
                              {updateRowMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
                              Save
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 px-3 text-xs text-muted-foreground" onClick={() => toggleEditRow(r.clientName)}>Cancel</Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
