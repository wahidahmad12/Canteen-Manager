import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useClientNames } from "@/hooks/use-reports";
import { FileSpreadsheet, Plus, Trash2, Loader2, Save, Pencil, X, Clock, Link2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface QuotationItem { id?: number; itemName: string; qty: number; rate: number; amount: number; }
interface Quotation {
  id: number; quotationNo: string; quotationDate: string; quotationThru: string;
  clientName: string; totalAmount: number; status: "open" | "converted" | "closed";
  remarks: string; createdBy: string; items: QuotationItem[];
  poNumber?: string; poDate?: string; poId?: number | null;
  taxInvoiceNo?: string | null; taxInvoiceDate?: string | null;
}

const fmt = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const pendingDays = (dateStr: string) => {
  const d = new Date(String(dateStr).slice(0, 10) + "T00:00:00");
  if (isNaN(d.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
};
const fmtDate = (s: string) => {
  const d = new Date(String(s).slice(0, 10) + "T00:00:00");
  return isNaN(d.getTime()) ? s : d.toLocaleDateString("en-GB").replace(/\//g, "-");
};

const STATUS_LABELS: Record<string, string> = { open: "Open", converted: "Converted to Invoice", closed: "Closed" };
const STATUS_COLORS: Record<string, string> = {
  open: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  converted: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  closed: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

const emptyItem = (): QuotationItem => ({ itemName: "", qty: 0, rate: 0, amount: 0 });

export function OpenQuotationTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: clientsList = [] } = useClientNames();

  // form state
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [quotationNo, setQuotationNo] = useState("");
  const [quotationDate, setQuotationDate] = useState(todayStr());
  const [quotationThru, setQuotationThru] = useState("");
  const [clientName, setClientName] = useState("");
  const [remarks, setRemarks] = useState("");
  const [status, setStatus] = useState<"open" | "converted" | "closed">("open");
  const [items, setItems] = useState<QuotationItem[]>([emptyItem()]);

  // list filters
  const [statusFilter, setStatusFilter] = useState("open");

  // Add PO dialog
  const [poFor, setPoFor] = useState<Quotation | null>(null);
  const [poNumber, setPoNumber] = useState("");
  const [poDate, setPoDate] = useState(todayStr());
  const [poAmount, setPoAmount] = useState("");

  const { data: quotations = [], isLoading } = useQuery<Quotation[]>({
    queryKey: ["/api/quotations"],
    queryFn: () => fetch("/api/quotations", { credentials: "include" }).then(r => r.json()),
  });

  const resetForm = () => {
    setEditId(null); setQuotationNo(""); setQuotationDate(todayStr());
    setQuotationThru(""); setClientName(""); setRemarks(""); setStatus("open");
    setItems([emptyItem()]); setShowForm(false);
  };

  const startEdit = (q: Quotation) => {
    setEditId(q.id); setQuotationNo(q.quotationNo || ""); setQuotationDate(String(q.quotationDate).slice(0, 10));
    setQuotationThru(q.quotationThru || ""); setClientName(q.clientName || ""); setRemarks(q.remarks || "");
    setStatus(q.status); setItems(q.items.length > 0 ? q.items.map(i => ({ ...i })) : [emptyItem()]);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const updateItem = (idx: number, field: keyof QuotationItem, value: string) => {
    setItems(prev => {
      const next = [...prev];
      const it = { ...next[idx] } as any;
      it[field] = field === "itemName" ? value : Number(value) || 0;
      if (field === "qty" || field === "rate") it.amount = parseFloat((Number(it.qty) * Number(it.rate)).toFixed(2));
      next[idx] = it;
      return next;
    });
  };

  const totalAmount = useMemo(() => items.reduce((s, it) => s + (Number(it.amount) || 0), 0), [items]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { quotationNo, quotationDate, quotationThru, clientName, remarks, status, items: items.filter(i => i.itemName.trim()) };
      const res = editId
        ? await fetch(`/api/quotations/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), credentials: "include" })
        : await fetch("/api/quotations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Save failed (error ${res.status})`);
      }
      return res.json().catch(() => ({})) as Promise<{ quotationNo?: string }>;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/quotations"] });
      toast({ title: editId ? "Quotation updated" : `Quotation saved${data?.quotationNo ? `: ${data.quotationNo}` : ""}` });
      resetForm();
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await fetch(`/api/quotations/${id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }), credentials: "include" });
      if (!res.ok) throw new Error("Could not update status");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/quotations"] }); toast({ title: "Status updated" }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const poMutation = useMutation({
    mutationFn: async () => {
      if (!poFor) return;
      const res = await fetch(`/api/quotations/${poFor.id}/po`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ poNumber, poDate, poAmount: Number(poAmount) || 0 }), credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Could not save PO");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/quotations"] });
      qc.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      toast({ title: "PO added", description: "The PO is now linked to this quotation and shows in the Purchase Orders tab too." });
      setPoFor(null);
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/quotations/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok && res.status !== 204) throw new Error("Delete failed");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/quotations"] }); toast({ title: "Quotation deleted" }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const handleSave = () => {
    if (!quotationDate) { toast({ title: "Please select a quotation date", variant: "destructive" }); return; }
    if (!items.some(i => i.itemName.trim())) { toast({ title: "Please add at least one item", variant: "destructive" }); return; }
    saveMutation.mutate();
  };

  const filtered = quotations.filter(q => statusFilter === "all" || q.status === statusFilter);
  const openCount = quotations.filter(q => q.status === "open").length;
  const openTotal = quotations.filter(q => q.status === "open").reduce((s, q) => s + q.totalAmount, 0);

  return (
    <div className="space-y-4">
      {/* Summary + new button */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-3">
          <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 px-4 py-2">
            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold uppercase">Open Quotations</p>
            <p className="text-xl font-bold text-amber-700 dark:text-amber-300" data-testid="text-open-count">{openCount}</p>
          </div>
          <div className="rounded-xl bg-violet-50 dark:bg-violet-950/30 px-4 py-2">
            <p className="text-[11px] text-violet-600 dark:text-violet-400 font-semibold uppercase">Open Amount</p>
            <p className="text-xl font-bold text-violet-700 dark:text-violet-300" data-testid="text-open-total">₹{fmt(openTotal)}</p>
          </div>
        </div>
        {!showForm && (
          <Button onClick={() => { resetForm(); setShowForm(true); }} className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg" data-testid="button-new-quotation">
            <Plus className="w-4 h-4 mr-2" /> New Quotation
          </Button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <Card className="border-0 shadow-lg overflow-hidden">
          <CardHeader className="pb-3 pt-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><FileSpreadsheet className="w-5 h-5" /> {editId ? "Edit Quotation" : "New Quotation"}</CardTitle>
            <button onClick={resetForm} className="text-white/80 hover:text-white" data-testid="button-close-form"><X className="w-5 h-5" /></button>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <Label className="text-xs">Quotation No.</Label>
                <Input value={editId ? quotationNo : "Auto (e.g. DJ-KOL-26-Q001)"} readOnly disabled className="bg-muted/60 text-muted-foreground" data-testid="input-q-no" />
              </div>
              <div>
                <Label className="text-xs">Quotation Date</Label>
                <Input type="date" value={quotationDate} onChange={e => setQuotationDate(e.target.value)} data-testid="input-q-date" />
              </div>
              <div>
                <Label className="text-xs">Quotation Thru</Label>
                <Input placeholder="Person / Email / WhatsApp" value={quotationThru} onChange={e => setQuotationThru(e.target.value)} data-testid="input-q-thru" />
              </div>
              <div>
                <Label className="text-xs">Client</Label>
                <Select value={clientName || "__none__"} onValueChange={v => setClientName(v === "__none__" ? "" : v)}>
                  <SelectTrigger data-testid="select-q-client"><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— None —</SelectItem>
                    {(clientsList || []).map((c: any) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {editId && (
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select value={status} onValueChange={v => setStatus(v as any)}>
                    <SelectTrigger data-testid="select-q-status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="converted">Converted to Invoice</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Items */}
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b bg-amber-50 dark:bg-amber-950/20">
                    <th className="text-left py-2 px-3">Item Name</th>
                    <th className="text-right py-2 px-2 w-24">Qty</th>
                    <th className="text-right py-2 px-2 w-28">Rate (₹)</th>
                    <th className="text-right py-2 px-2 w-32">Amount (₹)</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={idx} className="border-b last:border-0">
                      <td className="py-1 px-2"><Input placeholder="Item name" value={it.itemName} onChange={e => updateItem(idx, "itemName", e.target.value)} className="h-8" data-testid={`input-item-name-${idx}`} /></td>
                      <td className="py-1 px-2"><Input type="number" min="0" value={it.qty || ""} onChange={e => updateItem(idx, "qty", e.target.value)} className="h-8 text-right" data-testid={`input-item-qty-${idx}`} /></td>
                      <td className="py-1 px-2"><Input type="number" min="0" value={it.rate || ""} onChange={e => updateItem(idx, "rate", e.target.value)} className="h-8 text-right" data-testid={`input-item-rate-${idx}`} /></td>
                      <td className="py-1 px-2 text-right font-mono">₹{fmt(it.amount)}</td>
                      <td className="py-1 px-1 text-center">
                        {items.length > 1 && (
                          <button onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-700" data-testid={`button-remove-item-${idx}`}><Trash2 className="w-4 h-4" /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/50 font-semibold">
                    <td className="py-2 px-3">Total</td>
                    <td /><td />
                    <td className="py-2 px-2 text-right font-mono" data-testid="text-form-total">₹{fmt(totalAmount)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
            <Button size="sm" variant="outline" onClick={() => setItems(prev => [...prev, emptyItem()])} data-testid="button-add-item">
              <Plus className="w-4 h-4 mr-1" /> Add Item
            </Button>

            <div>
              <Label className="text-xs">Remarks</Label>
              <Input placeholder="Optional notes" value={remarks} onChange={e => setRemarks(e.target.value)} data-testid="input-q-remarks" />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={resetForm} data-testid="button-cancel-quotation">Cancel</Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending} className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white gap-2" data-testid="button-save-quotation">
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {editId ? "Update Quotation" : "Save Quotation"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* List */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-2 flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">Quotation Tracking</CardTitle>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44 h-8 text-xs" data-testid="select-status-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open only</SelectItem>
              <SelectItem value="converted">Converted</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value="all">All statuses</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0 sm:p-4 sm:pt-0">
          {isLoading ? (
            <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin inline text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No quotations {statusFilter !== "all" ? `with status "${STATUS_LABELS[statusFilter] || statusFilter}"` : "yet"}.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b">
                    <th className="text-left py-2 px-3">Date</th>
                    <th className="text-left py-2 px-2">Quotation No.</th>
                    <th className="text-left py-2 px-2">Client</th>
                    <th className="text-left py-2 px-2">Thru</th>
                    <th className="text-left py-2 px-2">Items</th>
                    <th className="text-right py-2 px-2">Amount (₹)</th>
                    <th className="text-left py-2 px-2">PO No / Date</th>
                    <th className="text-left py-2 px-2">Tax Invoice</th>
                    <th className="text-center py-2 px-2">Pending</th>
                    <th className="text-center py-2 px-2">Status</th>
                    <th className="text-center py-2 px-2 w-24">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(q => (
                    <tr key={q.id} className="border-b last:border-0 hover:bg-amber-50/40 dark:hover:bg-amber-950/10" data-testid={`row-quotation-${q.id}`}>
                      <td className="py-2 px-3 text-xs whitespace-nowrap">{fmtDate(q.quotationDate)}</td>
                      <td className="py-2 px-2 font-mono text-xs">{q.quotationNo || `#${q.id}`}</td>
                      <td className="py-2 px-2 text-xs">{q.clientName || "-"}</td>
                      <td className="py-2 px-2 text-xs">{q.quotationThru || "-"}</td>
                      <td className="py-2 px-2 text-xs max-w-[220px]">
                        {q.items.map(it => `${it.itemName} (${it.qty} × ₹${fmt(it.rate)})`).join(", ") || "-"}
                      </td>
                      <td className="py-2 px-2 text-right font-mono font-semibold">₹{fmt(q.totalAmount)}</td>
                      <td className="py-2 px-2 text-xs whitespace-nowrap">
                        {q.poNumber ? (
                          <div>
                            <div className="font-mono font-semibold">{q.poNumber}</div>
                            {q.poDate && <div className="text-muted-foreground">{fmtDate(q.poDate)}</div>}
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => { setPoFor(q); setPoNumber(""); setPoDate(todayStr()); setPoAmount(String(q.totalAmount || "")); }} data-testid={`button-add-po-${q.id}`}>
                            <Link2 className="w-3 h-3" /> Add PO
                          </Button>
                        )}
                      </td>
                      <td className="py-2 px-2 text-xs whitespace-nowrap">
                        {q.taxInvoiceNo ? (
                          <div>
                            <div className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">{q.taxInvoiceNo}</div>
                            {q.taxInvoiceDate && <div className="text-muted-foreground">{q.taxInvoiceDate}</div>}
                          </div>
                        ) : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="py-2 px-2 text-center">
                        {q.status === "open" ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${pendingDays(q.quotationDate) > 15 ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"}`} data-testid={`text-pending-${q.id}`}>
                            <Clock className="w-3 h-3" /> {pendingDays(q.quotationDate)} days
                          </span>
                        ) : <span className="text-slate-400 text-xs">—</span>}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <Select value={q.status} onValueChange={v => statusMutation.mutate({ id: q.id, status: v })}>
                          <SelectTrigger className={`h-7 w-32 text-[11px] font-semibold border-0 ${STATUS_COLORS[q.status]}`} data-testid={`select-row-status-${q.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="converted">Converted to Invoice</SelectItem>
                            <SelectItem value="closed">Closed</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-2 px-2 text-center whitespace-nowrap">
                        <button onClick={() => startEdit(q)} className="text-blue-500 hover:text-blue-700 mr-3" title="Edit" data-testid={`button-edit-${q.id}`}><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => { if (confirm("Delete this quotation?")) deleteMutation.mutate(q.id); }} className="text-red-500 hover:text-red-700" title="Delete" data-testid={`button-delete-${q.id}`}><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add PO dialog */}
      <Dialog open={!!poFor} onOpenChange={(open) => { if (!open) setPoFor(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Add Purchase Order</DialogTitle>
          </DialogHeader>
          {poFor && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                For quotation <span className="font-mono font-semibold">{poFor.quotationNo}</span> — {poFor.clientName || "no client"}.
                The PO will also appear in the Purchase Orders tab.
              </p>
              <div>
                <Label className="text-xs">PO Number</Label>
                <Input placeholder="e.g. PO17926276" value={poNumber} onChange={e => setPoNumber(e.target.value)} data-testid="input-po-number" />
              </div>
              <div>
                <Label className="text-xs">PO Date</Label>
                <Input type="date" value={poDate} onChange={e => setPoDate(e.target.value)} data-testid="input-po-date" />
              </div>
              <div>
                <Label className="text-xs">PO Amount (₹)</Label>
                <Input type="number" min="0" value={poAmount} onChange={e => setPoAmount(e.target.value)} data-testid="input-po-amount" />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setPoFor(null)} data-testid="button-cancel-po">Cancel</Button>
                <Button onClick={() => { if (!poNumber.trim()) { toast({ title: "Please enter the PO number", variant: "destructive" }); return; } poMutation.mutate(); }} disabled={poMutation.isPending} className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white gap-2" data-testid="button-save-po">
                  {poMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save PO
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
