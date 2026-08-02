import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useVendors, useClientNames, useCurrentUser } from "@/hooks/use-reports";
import { IndianRupee, Loader2, Save, Trash2, Wallet, ListChecks, BadgeCheck } from "lucide-react";
import { format } from "date-fns";

type UnpaidInvoice = { id: number; djInvoiceNo: string | null; vendorInvoiceNo: string | null; clientName: string; date: string; grandTotal: number; paid: number; balance: number };
type PaymentOut = { id: number; vendorName: string; clientName: string; paymentDate: string; amount: number; utrNo: string; allocatedAmount: number; advance: number; createdBy: string };

const fmt = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function parseLinkedClients(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export default function PaymentOutTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: user } = useCurrentUser();
  const { data: vendorsList } = useVendors();
  const { data: clientsList } = useClientNames();

  const [vendorName, setVendorName] = useState("");
  const [clientName, setClientName] = useState("");
  const [paymentDate, setPaymentDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [amount, setAmount] = useState("");
  const [utrNo, setUtrNo] = useState("");
  const [allocs, setAllocs] = useState<Record<number, string>>({});

  const { data: unpaidInvoices = [], isLoading: loadingUnpaid } = useQuery<UnpaidInvoice[]>({
    queryKey: ["/api/payment-outs/unpaid-invoices", vendorName, clientName],
    queryFn: async () => {
      const clientParam = clientName ? `&client=${encodeURIComponent(clientName)}` : "";
      const res = await fetch(`/api/payment-outs/unpaid-invoices?vendor=${encodeURIComponent(vendorName)}${clientParam}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load pending bills");
      return res.json();
    },
    enabled: !!vendorName,
  });

  const { data: paymentOuts = [] } = useQuery<PaymentOut[]>({
    queryKey: ["/api/payment-outs"],
    queryFn: async () => {
      const res = await fetch("/api/payment-outs", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load payment outs");
      return res.json();
    },
  });

  // Show only the selected client's vendors (vendors with no linked clients always show)
  const filteredVendors = ((vendorsList as any[]) || []).filter((v: any) => {
    const linked = parseLinkedClients(v.linkedClients);
    if (linked.length === 0) return true;
    if (!clientName) return true;
    return linked.includes(clientName);
  });

  const payAmount = Math.round((Number(amount) || 0) * 100) / 100;
  const totalTagged = useMemo(
    () => Object.values(allocs).reduce((s, v) => s + (Math.round((Number(v) || 0) * 100) / 100), 0),
    [allocs],
  );
  const excess = Math.round((payAmount - totalTagged) * 100) / 100;
  const totalPendingBalance = unpaidInvoices.reduce((s, i) => s + i.balance, 0);

  const autoTag = () => {
    if (payAmount <= 0) { toast({ title: "Enter the payment amount first", variant: "destructive" }); return; }
    let remaining = Math.round(payAmount * 100);
    const next: Record<number, string> = {};
    for (const inv of unpaidInvoices) {
      if (remaining <= 0) break;
      const bal = Math.round(inv.balance * 100);
      const use = Math.min(bal, remaining);
      if (use > 0) next[inv.id] = (use / 100).toFixed(2);
      remaining -= use;
    }
    setAllocs(next);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const allocations = Object.entries(allocs)
        .map(([id, v]) => ({ invoiceId: Number(id), amount: Math.round((Number(v) || 0) * 100) / 100 }))
        .filter(a => a.amount > 0);
      const res = await fetch("/api/payment-outs", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ vendorName, clientName, paymentDate, amount: payAmount, utrNo, allocations }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Save failed");
      return data;
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["/api/payment-outs"] });
      qc.invalidateQueries({ queryKey: ["/api/payment-outs/unpaid-invoices"] });
      qc.invalidateQueries({ queryKey: ["/api/purchase-invoices"] });
      setAmount(""); setUtrNo(""); setAllocs({});
      toast({
        title: "Payment Out saved",
        description: d.advance > 0 ? `₹${fmt(d.advance)} saved as advance — it will be tagged to this vendor's next bill automatically.` : `₹${fmt(d.allocated)} tagged to bills.`,
      });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/payment-outs/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok && res.status !== 204) {
        let msg = "Delete failed"; try { msg = (await res.json()).message || msg; } catch {}
        throw new Error(msg);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/payment-outs"] });
      qc.invalidateQueries({ queryKey: ["/api/payment-outs/unpaid-invoices"] });
      qc.invalidateQueries({ queryKey: ["/api/purchase-invoices"] });
      toast({ title: "Payment Out deleted" });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const handleSave = () => {
    if (!vendorName) { toast({ title: "Please select a vendor", variant: "destructive" }); return; }
    if (payAmount <= 0) { toast({ title: "Please enter the payment amount", variant: "destructive" }); return; }
    if (totalTagged > payAmount + 0.001) { toast({ title: "Tagged total is more than the payment amount", variant: "destructive" }); return; }
    saveMutation.mutate();
  };

  const totalAdvance = paymentOuts.reduce((s, p) => s + p.advance, 0);

  return (
    <div className="space-y-4">
      {/* New payment out */}
      <Card className="border-0 shadow-lg overflow-hidden">
        <CardHeader className="pb-3 pt-4 bg-gradient-to-r from-indigo-500 to-violet-600 text-white">
          <CardTitle className="text-base flex items-center gap-2"><Wallet className="w-5 h-5" /> New Payment Out</CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <Label className="text-xs">Client</Label>
              <Select value={clientName || "__all__"} onValueChange={(v) => {
                const c = v === "__all__" ? "" : v;
                setClientName(c);
                setAllocs({});
                // clear vendor if it doesn't belong to the newly selected client
                if (vendorName && c) {
                  const stillValid = (vendorsList || []).some((vd: any) => {
                    if (vd.name !== vendorName) return false;
                    const linked = parseLinkedClients(vd.linkedClients);
                    return linked.length === 0 || linked.includes(c);
                  });
                  if (!stillValid) setVendorName("");
                }
              }}>
                <SelectTrigger data-testid="select-po-client"><SelectValue placeholder="All clients" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All clients</SelectItem>
                  {(clientsList || []).map((c: any) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Vendor</Label>
              <Select value={vendorName} onValueChange={(v) => { setVendorName(v); setAllocs({}); }}>
                <SelectTrigger data-testid="select-po-vendor"><SelectValue placeholder="Select vendor" /></SelectTrigger>
                <SelectContent>
                  {filteredVendors.map((v: any) => <SelectItem key={v.id} value={v.name}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Payment Date</Label>
              <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} data-testid="input-po-date" />
            </div>
            <div>
              <Label className="text-xs">Payment Amount (₹)</Label>
              <Input type="number" min="0" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} data-testid="input-po-amount" />
            </div>
            <div>
              <Label className="text-xs">UTR No.</Label>
              <Input placeholder="Bank UTR / reference" value={utrNo} onChange={e => setUtrNo(e.target.value)} data-testid="input-po-utr" />
            </div>
          </div>

          {vendorName && (
            <div className="border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-indigo-50 dark:bg-indigo-950/20">
                <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
                  <ListChecks className="w-4 h-4" /> Pending Bills of {vendorName}
                  {totalPendingBalance > 0 && <span className="text-xs font-normal">(balance ₹{fmt(totalPendingBalance)})</span>}
                </span>
                {unpaidInvoices.length > 0 && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={autoTag} data-testid="button-auto-tag">
                    Auto Tag (oldest first)
                  </Button>
                )}
              </div>
              {loadingUnpaid ? (
                <div className="py-6 text-center"><Loader2 className="w-5 h-5 animate-spin inline text-muted-foreground" /></div>
              ) : unpaidInvoices.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">No pending bills — the full amount will be saved as advance for the next bill.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-muted-foreground border-b">
                        <th className="text-left py-2 px-3">Date</th>
                        <th className="text-left py-2 px-2">Bill No.</th>
                        <th className="text-left py-2 px-2">Client</th>
                        <th className="text-right py-2 px-2">Bill Amount</th>
                        <th className="text-right py-2 px-2">Balance</th>
                        <th className="text-right py-2 px-2 w-36">Tag Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unpaidInvoices.map(inv => (
                        <tr key={inv.id} className="border-b last:border-0" data-testid={`row-unpaid-${inv.id}`}>
                          <td className="py-2 px-3 text-xs">{format(new Date(String(inv.date).slice(0, 10) + "T00:00:00"), "dd-MM-yyyy")}</td>
                          <td className="py-2 px-2 font-mono text-xs">{inv.djInvoiceNo || inv.vendorInvoiceNo || `#${inv.id}`}</td>
                          <td className="py-2 px-2 text-xs">{inv.clientName || "-"}</td>
                          <td className="py-2 px-2 text-right font-mono">₹{fmt(inv.grandTotal)}</td>
                          <td className="py-2 px-2 text-right font-mono text-rose-600">₹{fmt(inv.balance)}</td>
                          <td className="py-1 px-2">
                            <Input
                              type="number" min="0" max={inv.balance} placeholder="0.00"
                              value={allocs[inv.id] || ""}
                              onChange={e => setAllocs(prev => ({ ...prev, [inv.id]: e.target.value }))}
                              className="h-8 text-right"
                              data-testid={`input-tag-${inv.id}`}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {payAmount > 0 && (
            <div className={`rounded-lg px-4 py-3 text-sm font-medium ${excess > 0 ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`} data-testid="text-excess-info">
              Payment ₹{fmt(payAmount)} — Tagged ₹{fmt(totalTagged)}
              {excess > 0 && <> — <b>₹{fmt(excess)} excess amount will be saved as advance and tagged to the next bill</b></>}
              {excess < 0 && <span className="text-rose-600"> — Tagged more than the payment amount!</span>}
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saveMutation.isPending} className="bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white gap-2" data-testid="button-save-payment-out">
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Payment Out
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* History */}
      <Card className="border-0 shadow-lg overflow-hidden">
        <CardHeader className="pb-3 pt-4 bg-gradient-to-r from-violet-600 to-purple-600 text-white">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2"><IndianRupee className="w-5 h-5" /> Payment Out History</span>
            {totalAdvance > 0 && <span className="text-xs font-normal">Advance waiting: <b className="font-mono">₹{fmt(totalAdvance)}</b></span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {paymentOuts.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No payment outs yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-violet-50 dark:bg-violet-950/20 text-violet-700 dark:text-violet-400 text-xs">
                    <th className="text-left py-2.5 px-3">Date</th>
                    <th className="text-left py-2.5 px-2">Vendor</th>
                    <th className="text-left py-2.5 px-2">Client</th>
                    <th className="text-right py-2.5 px-2">Amount</th>
                    <th className="text-left py-2.5 px-2">UTR No.</th>
                    <th className="text-right py-2.5 px-2">Tagged</th>
                    <th className="text-right py-2.5 px-2">Advance</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {paymentOuts.map(p => (
                    <tr key={p.id} className="border-t hover:bg-muted/30" data-testid={`row-po-${p.id}`}>
                      <td className="py-2 px-3 text-xs">{format(new Date(p.paymentDate + "T00:00:00"), "dd-MM-yyyy")}</td>
                      <td className="py-2 px-2 font-medium">{p.vendorName}</td>
                      <td className="py-2 px-2 text-xs">{p.clientName || "-"}</td>
                      <td className="py-2 px-2 text-right font-mono">₹{fmt(p.amount)}</td>
                      <td className="py-2 px-2 font-mono text-xs">{p.utrNo || "-"}</td>
                      <td className="py-2 px-2 text-right font-mono text-emerald-600">₹{fmt(p.allocatedAmount)}</td>
                      <td className="py-2 px-2 text-right font-mono">
                        {p.advance > 0
                          ? <span className="text-amber-600 font-semibold">₹{fmt(p.advance)}</span>
                          : <span className="text-emerald-600 inline-flex items-center gap-1"><BadgeCheck className="w-3.5 h-3.5" /> Fully tagged</span>}
                      </td>
                      <td className="py-2 px-2 text-center">
                        {user?.role === "admin" && (
                          <button type="button" onClick={() => { if (confirm("Delete this payment out? Its tagged amounts will be removed from the bills too.")) deleteMutation.mutate(p.id); }} className="text-red-500 hover:text-red-700" title="Delete" data-testid={`button-delete-po-${p.id}`}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
