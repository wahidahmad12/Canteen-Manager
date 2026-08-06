import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useClientNames, useCurrentUser } from "@/hooks/use-reports";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Pencil, Save, Users } from "lucide-react";

type Contractor = { id: number; vendorCode: string; name: string; clientName: string };
type MealEntry = {
  id: number; entryDate: string; month: number; year: number; contractorId: number;
  mealType: string; qty: number; billNo: string; vendorCode: string; contractorName: string; clientName: string;
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function ContractorMealsPage() {
  const { data: user } = useCurrentUser();
  const isAdmin = user?.role === "admin";
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: contractors = [] } = useQuery<Contractor[]>({
    queryKey: ["/api/contractors"],
    queryFn: async () => (await apiRequest("GET", "/api/contractors")).json(),
  });
  const { data: clients = [] } = useClientNames();

  // ---- Meal entry state ----
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [entryDate, setEntryDate] = useState(() => {
    const y = now.getFullYear(), m = String(now.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}-01`;
  });
  // edits[contractorId] = { billNo, breakfast, lunch, dinner } (strings so blanks allowed)
  const [edits, setEdits] = useState<Record<number, { billNo: string; breakfast: string; lunch: string; dinner: string }>>({});

  const { data: entries = [], isFetching } = useQuery<MealEntry[]>({
    queryKey: ["/api/contractor-meals", month, year],
    queryFn: async () => (await apiRequest("GET", `/api/contractor-meals?month=${month}&year=${year}`)).json(),
  });

  const filteredContractors = useMemo(
    () => contractors.filter((c) => clientFilter === "all" || c.clientName === clientFilter),
    [contractors, clientFilter],
  );

  // Merge saved entries + local edits into row values
  const rowValue = (c: Contractor) => {
    const saved = { billNo: "", breakfast: "", lunch: "", dinner: "", entryDate: "" };
    for (const e of entries) {
      if (e.contractorId !== c.id) continue;
      if (e.billNo) saved.billNo = e.billNo;
      if (e.entryDate) saved.entryDate = e.entryDate;
      if (e.mealType === "Breakfast") saved.breakfast = String(e.qty);
      if (e.mealType === "Lunch") saved.lunch = String(e.qty);
      if (e.mealType === "Dinner") saved.dinner = String(e.qty);
    }
    const ed = edits[c.id];
    return {
      billNo: ed?.billNo ?? saved.billNo,
      breakfast: ed?.breakfast ?? saved.breakfast,
      lunch: ed?.lunch ?? saved.lunch,
      dinner: ed?.dinner ?? saved.dinner,
    };
  };

  const setCell = (c: Contractor, key: "billNo" | "breakfast" | "lunch" | "dinner", val: string) => {
    setEdits((prev) => ({ ...prev, [c.id]: { ...rowValue(c), ...prev[c.id], [key]: val } }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const rows = filteredContractors.map((c) => {
        const v = rowValue(c);
        return {
          contractorId: c.id,
          billNo: v.billNo,
          breakfast: v.breakfast === "" ? null : Number(v.breakfast),
          lunch: v.lunch === "" ? null : Number(v.lunch),
          dinner: v.dinner === "" ? null : Number(v.dinner),
        };
      });
      await apiRequest("POST", "/api/contractor-meals/bulk", { entryDate, month, year, rows });
    },
    onSuccess: () => {
      setEdits({});
      qc.invalidateQueries({ queryKey: ["/api/contractor-meals", month, year] });
      toast({ title: "Saved", description: `${MONTHS[month - 1]} ${year} entries saved.` });
    },
    onError: (e: any) => toast({ title: "Save failed", description: e?.message || "", variant: "destructive" }),
  });

  const monthName = MONTHS[month - 1];
  const totals = useMemo(() => {
    let b = 0, l = 0, d = 0;
    for (const c of filteredContractors) {
      const v = rowValue(c);
      b += Number(v.breakfast) || 0;
      l += Number(v.lunch) || 0;
      d += Number(v.dinner) || 0;
    }
    return { b, l, d, all: b + l + d };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredContractors, entries, edits]);

  // ---- Contractor master state ----
  const emptyForm = { vendorCode: "", name: "", clientName: "Cipla Limited" };
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<number | null>(null);

  const nextCode = useMemo(() => {
    let max = 0;
    for (const c of contractors) {
      const m = /^DJ-SKI-(\d+)$/.exec(c.vendorCode || "");
      if (m) max = Math.max(max, Number(m[1]));
    }
    return `DJ-SKI-${String(max + 1).padStart(3, "0")}`;
  }, [contractors]);

  const upsertContractor = useMutation({
    mutationFn: async () => {
      if (editId) await apiRequest("PUT", `/api/contractors/${editId}`, form);
      else await apiRequest("POST", "/api/contractors", form);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/contractors"] });
      setForm(emptyForm);
      setEditId(null);
      toast({ title: editId ? "Contractor updated" : "Contractor added" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message || "", variant: "destructive" }),
  });

  const deleteContractor = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/contractors/${id}`); },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/contractors"] });
      qc.invalidateQueries({ queryKey: ["/api/contractor-meals", month, year] });
      toast({ title: "Contractor deleted" });
    },
    onError: (e: any) => toast({ title: "Delete failed", description: e?.message || "", variant: "destructive" }),
  });

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center gap-2">
        <Users className="h-6 w-6 text-primary" />
        <h1 className="text-xl md:text-2xl font-bold" data-testid="text-page-title">Contractor Meal Entry</h1>
      </div>

      <Tabs defaultValue="entry">
        <TabsList>
          <TabsTrigger value="entry" data-testid="tab-meal-entry">Meal Entry</TabsTrigger>
          <TabsTrigger value="master" data-testid="tab-contractor-list">Contractor List</TabsTrigger>
        </TabsList>

        {/* ============ MEAL ENTRY ============ */}
        <TabsContent value="entry" className="space-y-4">
          <Card>
            <CardContent className="pt-4 flex flex-wrap items-end gap-3">
              <div>
                <Label>Month</Label>
                <Select value={String(month)} onValueChange={(v) => { setMonth(Number(v)); setEdits({}); }}>
                  <SelectTrigger className="w-36" data-testid="select-month"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Year</Label>
                <Select value={String(year)} onValueChange={(v) => { setYear(Number(v)); setEdits({}); }}>
                  <SelectTrigger className="w-28" data-testid="select-year"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[year - 2, year - 1, year, year + 1].filter((v, i, a) => a.indexOf(v) === i).map((y) =>
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" className="w-40" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} data-testid="input-entry-date" />
              </div>
              <div>
                <Label>Client</Label>
                <Select value={clientFilter} onValueChange={setClientFilter}>
                  <SelectTrigger className="w-44" data-testid="select-client-filter"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clients</SelectItem>
                    {clients.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-save-entries">
                <Save className="h-4 w-4 mr-1" /> {saveMutation.isPending ? "Saving..." : "Save All"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">
                {monthName} {year} — qty likhiye (Breakfast / Lunch / Dinner) {isFetching ? "…" : ""}
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left">
                    <th className="p-2">Vendor Code</th>
                    <th className="p-2">Contractor Name</th>
                    <th className="p-2 text-center">Breakfast</th>
                    <th className="p-2 text-center">Lunch</th>
                    <th className="p-2 text-center">Dinner</th>
                    <th className="p-2">Bill No</th>
                    <th className="p-2">Cont &amp; Month</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContractors.map((c) => {
                    const v = rowValue(c);
                    return (
                      <tr key={c.id} className="border-b" data-testid={`row-meal-${c.vendorCode}`}>
                        <td className="p-2 whitespace-nowrap font-mono text-xs">{c.vendorCode}</td>
                        <td className="p-2">{c.name}</td>
                        {(["breakfast", "lunch", "dinner"] as const).map((k) => (
                          <td key={k} className="p-1 text-center">
                            <Input
                              type="number" min={0} inputMode="numeric"
                              className="w-20 h-8 text-center mx-auto"
                              value={v[k]}
                              onChange={(e) => setCell(c, k, e.target.value)}
                              data-testid={`input-${k}-${c.vendorCode}`}
                            />
                          </td>
                        ))}
                        <td className="p-1">
                          <Input
                            className="w-36 h-8"
                            placeholder="DJ-SKI-26-C…"
                            value={v.billNo}
                            onChange={(e) => setCell(c, "billNo", e.target.value)}
                            data-testid={`input-billno-${c.vendorCode}`}
                          />
                        </td>
                        <td className="p-2 text-xs text-muted-foreground whitespace-nowrap">
                          {c.name}{monthName.slice(0, 3)}{year}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredContractors.length === 0 && (
                    <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No contractors. Pehle "Contractor List" tab me add kijiye.</td></tr>
                  )}
                </tbody>
                {filteredContractors.length > 0 && (
                  <tfoot>
                    <tr className="border-t bg-muted/50 font-semibold">
                      <td className="p-2" colSpan={2}>Total</td>
                      <td className="p-2 text-center" data-testid="text-total-breakfast">{totals.b}</td>
                      <td className="p-2 text-center" data-testid="text-total-lunch">{totals.l}</td>
                      <td className="p-2 text-center" data-testid="text-total-dinner">{totals.d}</td>
                      <td className="p-2" colSpan={2}>Grand Total: {totals.all}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ CONTRACTOR MASTER ============ */}
        <TabsContent value="master" className="space-y-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">{editId ? "Edit Contractor" : "Add Contractor"}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end gap-3">
              <div>
                <Label>Vendor Code</Label>
                <Input
                  className="w-36" placeholder={nextCode}
                  value={form.vendorCode}
                  onChange={(e) => setForm({ ...form, vendorCode: e.target.value })}
                  data-testid="input-vendor-code"
                />
              </div>
              <div>
                <Label>Contractor Name</Label>
                <Input
                  className="w-64"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  data-testid="input-contractor-name"
                />
              </div>
              <div>
                <Label>Client</Label>
                <Select value={form.clientName} onValueChange={(v) => setForm({ ...form, clientName: v })}>
                  <SelectTrigger className="w-48" data-testid="select-contractor-client"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => upsertContractor.mutate()}
                disabled={upsertContractor.isPending || !form.name.trim() || !(form.vendorCode.trim() || !editId)}
                data-testid="button-save-contractor"
              >
                <Plus className="h-4 w-4 mr-1" /> {editId ? "Update" : "Add"}
              </Button>
              {editId && (
                <Button variant="outline" onClick={() => { setEditId(null); setForm(emptyForm); }}>Cancel</Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left">
                    <th className="p-2">Vendor Code</th>
                    <th className="p-2">Contractor Name</th>
                    <th className="p-2">Client</th>
                    <th className="p-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {contractors.map((c) => (
                    <tr key={c.id} className="border-b" data-testid={`row-contractor-${c.vendorCode}`}>
                      <td className="p-2 font-mono text-xs whitespace-nowrap">{c.vendorCode}</td>
                      <td className="p-2">{c.name}</td>
                      <td className="p-2">{c.clientName}</td>
                      <td className="p-2 text-right whitespace-nowrap">
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8"
                          onClick={() => { setEditId(c.id); setForm({ vendorCode: c.vendorCode, name: c.name, clientName: c.clientName }); }}
                          data-testid={`button-edit-${c.vendorCode}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {isAdmin && (
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                            onClick={() => { if (confirm(`Delete ${c.name}? Iski saari meal entries bhi delete ho jayengi.`)) deleteContractor.mutate(c.id); }}
                            data-testid={`button-delete-${c.vendorCode}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {contractors.length === 0 && (
                    <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No contractors yet.</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
