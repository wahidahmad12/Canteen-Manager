import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ScanLine, Upload, Loader2, Trash2, Save, X, ReceiptText } from "lucide-react";
import { format } from "date-fns";

type GroceryExpense = { id: number; entryDate: string; itemName: string; quantity: string; cost: string | number; payer: string };
type DraftItem = { itemName: string; quantity: string; cost: number };

export default function GroceryScanTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [draft, setDraft] = useState<DraftItem[]>([]);
  const [payer, setPayer] = useState("");
  const [entryDate, setEntryDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data: expenses = [], isLoading } = useQuery<GroceryExpense[]>({
    queryKey: ["/api/grocery-expenses"],
    queryFn: async () => {
      const res = await fetch("/api/grocery-expenses", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load grocery expenses");
      return res.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (items: { entryDate: string; itemName: string; quantity: string; cost: number; payer: string }[]) => {
      const res = await fetch("/api/grocery-expenses", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }), credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json()).message || "Save failed");
      return res.json();
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["/api/grocery-expenses"] });
      setDraft([]); setPreview(null);
      toast({ title: `Saved ${d.saved} items` });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/grocery-expenses/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok && res.status !== 204) throw new Error("Delete failed");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/grocery-expenses"] }),
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) { toast({ title: "Please choose a photo (JPG/PNG)", variant: "destructive" }); return; }
    if (file.size > 10 * 1024 * 1024) { toast({ title: "Photo too big (max 10 MB)", variant: "destructive" }); return; }
    const reader = new FileReader();
    reader.onload = () => { setPreview(reader.result as string); setDraft([]); };
    reader.readAsDataURL(file);
  };

  const handleScan = async () => {
    if (!preview) return;
    setScanning(true);
    try {
      const res = await fetch("/api/grocery-expenses/scan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: preview }), credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Scan failed");
      if (!data.items?.length) { toast({ title: "No items found in the photo. Try a clearer picture.", variant: "destructive" }); return; }
      setDraft(data.items);
      toast({ title: `Found ${data.items.length} items — check and save` });
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally { setScanning(false); }
  };

  const updateDraft = (idx: number, field: keyof DraftItem, value: string) => {
    setDraft(prev => prev.map((d, i) => i === idx ? { ...d, [field]: field === "cost" ? (Number(value) || 0) : value } : d));
  };

  const handleSave = () => {
    const items = draft.filter(d => d.itemName.trim()).map(d => ({ ...d, entryDate, payer }));
    if (!items.length) { toast({ title: "Nothing to save", variant: "destructive" }); return; }
    saveMutation.mutate(items);
  };

  const draftTotal = draft.reduce((s, d) => s + (d.cost || 0), 0);
  const grandTotal = useMemo(() => expenses.reduce((s, e) => s + (Number(e.cost) || 0), 0), [expenses]);

  return (
    <div className="space-y-4">
      {/* Upload / scan card */}
      <Card className="border-0 shadow-lg overflow-hidden">
        <CardHeader className="pb-3 pt-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
          <CardTitle className="text-base flex items-center gap-2"><ScanLine className="w-5 h-5" /> Scan Handwritten Grocery List</CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} data-testid="input-grocery-photo" />
          {!preview ? (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-emerald-300 dark:border-emerald-700 rounded-xl py-10 flex flex-col items-center gap-2 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
              data-testid="button-upload-area"
            >
              <Upload className="w-8 h-8" />
              <span className="font-semibold">Upload receipt photo</span>
              <span className="text-xs text-muted-foreground">Take a photo of the handwritten list and the AI will read it</span>
            </button>
          ) : (
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative sm:w-64 shrink-0">
                <img src={preview} alt="Receipt preview" className="rounded-lg border w-full object-contain max-h-72" data-testid="img-receipt-preview" />
                <button type="button" onClick={() => { setPreview(null); setDraft([]); }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow" title="Remove photo" data-testid="button-remove-photo">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 space-y-3">
                <div className="flex flex-wrap gap-2 items-end">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Date</label>
                    <Input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} className="h-9 w-40" data-testid="input-grocery-date" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Paid by</label>
                    <Input value={payer} onChange={e => setPayer(e.target.value)} placeholder="Who paid?" className="h-9 w-40" data-testid="input-grocery-payer" />
                  </div>
                  <Button onClick={handleScan} disabled={scanning} className="h-9 bg-emerald-600 hover:bg-emerald-700" data-testid="button-scan-receipt">
                    {scanning ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Reading photo…</> : <><ScanLine className="w-4 h-4 mr-1" /> Read with AI</>}
                  </Button>
                </div>

                {draft.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-xs">
                          <th className="text-left py-2 px-2">Item</th>
                          <th className="text-left py-2 px-2 w-24">Qty</th>
                          <th className="text-right py-2 px-2 w-28">Cost (₹)</th>
                          <th className="w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {draft.map((d, i) => (
                          <tr key={i} className="border-t">
                            <td className="p-1"><Input value={d.itemName} onChange={e => updateDraft(i, "itemName", e.target.value)} className="h-8" data-testid={`input-draft-item-${i}`} /></td>
                            <td className="p-1"><Input value={d.quantity} onChange={e => updateDraft(i, "quantity", e.target.value)} className="h-8" /></td>
                            <td className="p-1"><Input type="number" value={d.cost || ""} onChange={e => updateDraft(i, "cost", e.target.value)} className="h-8 text-right" data-testid={`input-draft-cost-${i}`} /></td>
                            <td className="p-1 text-center">
                              <button type="button" onClick={() => setDraft(prev => prev.filter((_, j) => j !== i))} className="text-red-500 hover:text-red-700" title="Remove">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t bg-emerald-50/60 dark:bg-emerald-950/10 font-semibold">
                          <td className="py-2 px-2 text-right" colSpan={2}>Total:</td>
                          <td className="py-2 px-2 text-right font-mono">₹{draftTotal.toFixed(2)}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                    <div className="p-2 flex justify-end bg-muted/30">
                      <Button onClick={handleSave} disabled={saveMutation.isPending} className="h-9 bg-emerald-600 hover:bg-emerald-700" data-testid="button-save-grocery">
                        {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />} Save {draft.length} items
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Saved expenses table */}
      <Card className="border-0 shadow-lg overflow-hidden">
        <CardHeader className="pb-3 pt-4 bg-gradient-to-r from-teal-600 to-cyan-600 text-white">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2"><ReceiptText className="w-5 h-5" /> Grocery Expenses</span>
            <span className="text-xs font-normal">Total: <span className="font-mono font-bold">₹{grandTotal.toFixed(2)}</span></span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-10 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
          ) : expenses.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">No grocery expenses yet — upload a receipt photo above.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-teal-50 dark:bg-teal-950/20 text-teal-700 dark:text-teal-400 text-xs">
                    <th className="text-left py-2.5 px-3">Date</th>
                    <th className="text-left py-2.5 px-2">Item</th>
                    <th className="text-left py-2.5 px-2">Qty</th>
                    <th className="text-right py-2.5 px-2">Cost (₹)</th>
                    <th className="text-left py-2.5 px-2">Paid By</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map(e => (
                    <tr key={e.id} className="border-t hover:bg-muted/30" data-testid={`row-grocery-${e.id}`}>
                      <td className="py-2 px-3 text-xs">{format(new Date(e.entryDate + "T00:00:00"), "dd-MM-yyyy")}</td>
                      <td className="py-2 px-2 font-medium">{e.itemName}</td>
                      <td className="py-2 px-2 text-muted-foreground">{e.quantity}</td>
                      <td className="py-2 px-2 text-right font-mono">{Number(e.cost).toFixed(2)}</td>
                      <td className="py-2 px-2">{e.payer}</td>
                      <td className="py-2 px-2 text-center">
                        <button type="button" onClick={() => deleteMutation.mutate(e.id)} className="text-red-500 hover:text-red-700" title="Delete" data-testid={`button-delete-grocery-${e.id}`}>
                          <Trash2 className="w-4 h-4" />
                        </button>
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
