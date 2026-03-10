import { useState, useEffect } from "react";
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
import { useClientNames } from "@/hooks/use-reports";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText, Plus, Save, Loader2, Pencil, Trash2, Search,
  CalendarDays, Building2, Receipt, IndianRupee, Percent,
  CheckCircle2, XCircle, X, BarChart3, ClipboardList, AlertTriangle
} from "lucide-react";
import { Link } from "wouter";

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
      const res = await apiRequest("POST", "/api/sales-invoices", data);
      return res.json();
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
      const res = await apiRequest("PUT", `/api/sales-invoices/${invoice!.id}`, data);
      return res.json();
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
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1"><Percent className="w-3 h-3" /> TDS %</Label>
            <Input type="number" value={tdsPercent || ""} onChange={(e) => setTdsPercent(Number(e.target.value))} className="h-9 font-mono text-sm" min={0} data-testid="input-tds-percent" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-red-600 dark:text-red-400">TDS Amount</Label>
            <div className="h-9 flex items-center px-3 bg-red-100 dark:bg-red-900/30 rounded-md font-mono text-sm" data-testid="text-tds-amount">{fmtCurrency(tdsAmount)}</div>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 rounded-xl p-3 space-y-3 border border-green-200 dark:border-green-800">
        <p className="text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-wide">Payment Received</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1"><CalendarDays className="w-3 h-3" /> Payment Date</Label>
            <DatePicker date={paymentReceivedDate} setDate={(d) => setPaymentReceivedDate(d)} placeholder="Not received yet" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1"><IndianRupee className="w-3 h-3" /> Amount Received</Label>
            <Input type="number" value={paymentReceivedAmount || ""} onChange={(e) => setPaymentReceivedAmount(Number(e.target.value))} className="h-9 font-mono text-sm" min={0} data-testid="input-payment-received" />
          </div>
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
      const res = await apiRequest("POST", "/api/purchase-orders", data);
      return res.json();
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
      const res = await apiRequest("PUT", `/api/purchase-orders/${po!.id}`, data);
      return res.json();
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
  const { data: invoices = [], isLoading } = useQuery<SalesInvoice[]>({
    queryKey: ["/api/sales-invoices"],
  });
  const { data: purchaseOrders = [], isLoading: posLoading } = useQuery<PurchaseOrderType[]>({
    queryKey: ["/api/purchase-orders"],
  });

  const [activeTab, setActiveTab] = useState("invoices");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<SalesInvoice | null>(null);
  const [poDialogOpen, setPoDialogOpen] = useState(false);
  const [editingPO, setEditingPO] = useState<PurchaseOrderType | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterClient, setFilterClient] = useState("all");
  const [filterMonth, setFilterMonth] = useState("all");
  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()));

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
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      return inv.billNumber.toLowerCase().includes(s) || inv.clientName.toLowerCase().includes(s);
    }
    return true;
  });

  const totalBilled = filteredInvoices.reduce((s, i) => s + Number(i.totalBillAmount), 0);
  const totalReceived = filteredInvoices.reduce((s, i) => s + Number(i.paymentReceivedAmount), 0);
  const totalOutstanding = totalBilled - totalReceived;
  const paidCount = filteredInvoices.filter(i => Number(i.paymentReceivedAmount) >= Number(i.totalBillAmount)).length;

  const openNew = () => { setEditingInvoice(null); setDialogOpen(true); };
  const openEdit = (inv: SalesInvoice) => { setEditingInvoice(inv); setDialogOpen(true); };
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
              <Button variant="outline" className="border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-400" data-testid="button-sales-dashboard">
                <BarChart3 className="w-4 h-4 mr-2" /> Dashboard
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
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-5">
          <TabsList className="bg-violet-100 dark:bg-violet-950/30">
            <TabsTrigger value="invoices" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 flex items-center gap-1.5" data-testid="tab-invoices">
              <FileText className="w-3.5 h-3.5" /> Sales Invoices
            </TabsTrigger>
            <TabsTrigger value="purchase-orders" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 flex items-center gap-1.5" data-testid="tab-purchase-orders">
              <ClipboardList className="w-3.5 h-3.5" /> Purchase Orders
              {purchaseOrders.length > 0 && <Badge variant="secondary" className="ml-1 h-5 text-[10px]">{purchaseOrders.length}</Badge>}
            </TabsTrigger>
          </TabsList>

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
                        <div className="grid grid-cols-4 gap-3 mt-3">
                          <div className="bg-cyan-50 dark:bg-cyan-950/20 rounded-lg p-2 text-center">
                            <p className="text-[10px] text-cyan-600 dark:text-cyan-400">PO Amount</p>
                            <p className="font-mono font-bold text-sm text-cyan-800 dark:text-cyan-200">{fmtCurrency(po.poAmount)}</p>
                          </div>
                          <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-2 text-center">
                            <p className="text-[10px] text-amber-600 dark:text-amber-400">Used ({usedPercent}%)</p>
                            <p className="font-mono font-bold text-sm text-amber-800 dark:text-amber-200">{fmtCurrency(used)}</p>
                          </div>
                          <div className={`rounded-lg p-2 text-center ${balance > 0 ? 'bg-green-50 dark:bg-green-950/20' : 'bg-red-50 dark:bg-red-950/20'}`}>
                            <p className={`text-[10px] ${balance > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>Balance</p>
                            <p className={`font-mono font-bold text-sm ${balance > 0 ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>{fmtCurrency(balance)}</p>
                          </div>
                          <div className="bg-violet-50 dark:bg-violet-950/20 rounded-lg p-2 text-center">
                            <p className="text-[10px] text-violet-600 dark:text-violet-400">Invoices</p>
                            <p className="font-mono font-bold text-sm text-violet-800 dark:text-violet-200">{linked}</p>
                          </div>
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
            <div className="flex justify-end mb-4">
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
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
              <div className="flex-1 w-full sm:w-auto">
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
              <div className="w-full sm:w-40">
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
              <div className="w-full sm:w-36">
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
              <div className="w-full sm:w-28">
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
              {(filterClient !== "all" || filterMonth !== "all" || filterYear !== String(new Date().getFullYear()) || searchTerm) && (
                <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => { setFilterClient("all"); setFilterMonth("all"); setFilterYear(String(new Date().getFullYear())); setSearchTerm(""); }} data-testid="button-clear-filters">
                  <X className="w-3.5 h-3.5 mr-1" /> Clear
                </Button>
              )}
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
                        <th className="text-left py-3 px-3 font-semibold text-xs">Pmt Date</th>
                        <th className="text-right py-3 px-3 font-semibold text-xs">Pmt Rcvd</th>
                        <th className="text-center py-3 px-3 font-semibold text-xs">Status</th>
                        <th className="text-center py-3 px-3 font-semibold text-xs w-20">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInvoices.map((inv, idx) => {
                        const isPaid = Number(inv.paymentReceivedAmount) >= Number(inv.totalBillAmount) && Number(inv.totalBillAmount) > 0;
                        return (
                          <tr key={inv.id} className={`border-b border-gray-100 dark:border-gray-800 hover:bg-violet-50/50 dark:hover:bg-violet-950/20 transition-colors ${idx % 2 === 0 ? "bg-white dark:bg-gray-950" : "bg-gray-50/50 dark:bg-gray-900/50"}`} data-testid={`row-invoice-${inv.id}`}>
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
                            <td className="py-2.5 px-3 text-xs">{fmtDate(inv.paymentReceivedDate)}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-xs text-green-600">{fmtCurrency(inv.paymentReceivedAmount)}</td>
                            <td className="py-2.5 px-3 text-center">
                              {isPaid ? (
                                <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px]"><CheckCircle2 className="w-3 h-3 mr-0.5" /> Paid</Badge>
                              ) : (
                                <Badge variant="outline" className="text-orange-600 border-orange-300 dark:border-orange-700 text-[10px]"><XCircle className="w-3 h-3 mr-0.5" /> Pending</Badge>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center">
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
                        <td className="py-2.5 px-3"></td>
                        <td className="py-2.5 px-3 text-right font-mono text-xs text-green-600">{fmtCurrency(totalReceived)}</td>
                        <td colSpan={2} className="py-2.5 px-3 text-center text-xs">{paidCount} paid</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Card>
            </div>

            <div className="lg:hidden space-y-3">
              {filteredInvoices.map((inv) => {
                const isPaid = Number(inv.paymentReceivedAmount) >= Number(inv.totalBillAmount) && Number(inv.totalBillAmount) > 0;
                return (
                  <Card key={inv.id} className="border-0 shadow-md overflow-hidden" data-testid={`card-invoice-mobile-${inv.id}`}>
                    <div className={`h-1 ${isPaid ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 'bg-gradient-to-r from-orange-400 to-amber-500'}`} />
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
                          {isPaid ? (
                            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 text-[10px]"><CheckCircle2 className="w-3 h-3 mr-0.5" /> Paid</Badge>
                          ) : (
                            <Badge variant="outline" className="text-orange-600 border-orange-300 text-[10px]"><XCircle className="w-3 h-3 mr-0.5" /> Due</Badge>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs mt-2">
                        <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-2 text-center">
                          <p className="text-[10px] text-blue-600 dark:text-blue-400">Bill Amount</p>
                          <p className="font-mono font-bold text-blue-700 dark:text-blue-300">{fmtCurrency(inv.billAmount)}</p>
                        </div>
                        <div className="bg-orange-50 dark:bg-orange-950/20 rounded-lg p-2 text-center">
                          <p className="text-[10px] text-orange-600 dark:text-orange-400">GST ({Number(inv.gstPercent)}%)</p>
                          <p className="font-mono font-bold text-orange-700 dark:text-orange-300">{fmtCurrency(inv.gstAmount)}</p>
                        </div>
                        <div className="bg-violet-50 dark:bg-violet-950/20 rounded-lg p-2 text-center">
                          <p className="text-[10px] text-violet-600 dark:text-violet-400">Total</p>
                          <p className="font-mono font-bold text-violet-700 dark:text-violet-300">{fmtCurrency(inv.totalBillAmount)}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs mt-2">
                        <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-2 text-center">
                          <p className="text-[10px] text-red-600 dark:text-red-400">TDS ({Number(inv.tdsPercent)}%)</p>
                          <p className="font-mono font-bold text-red-700 dark:text-red-300">{fmtCurrency(inv.tdsAmount)}</p>
                        </div>
                        <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-2 text-center">
                          <p className="text-[10px] text-green-600 dark:text-green-400">Received</p>
                          <p className="font-mono font-bold text-green-700 dark:text-green-300">{fmtCurrency(inv.paymentReceivedAmount)}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-900/30 rounded-lg p-2 text-center">
                          <p className="text-[10px] text-muted-foreground">Pmt Date</p>
                          <p className="font-mono font-bold text-xs">{fmtDate(inv.paymentReceivedDate)}</p>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 mt-3 pt-2 border-t">
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
        </Tabs>
      </div>

    </Layout>
  );
}
