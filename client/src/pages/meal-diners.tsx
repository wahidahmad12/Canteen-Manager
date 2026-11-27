import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookUser, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useLang } from "@/contexts/language-context";
import { apiRequest } from "@/lib/queryClient";
import { normalizeDinerCode } from "@shared/meal-register";

type Diner = {
  id: number;
  dinerCode: string;
  name: string;
  companyName: string;
  department: string;
  designation: string;
  mobile: string;
  dinerType: string;
  notes: string;
  isActive: boolean;
};

type DinerForm = Omit<Diner, "id">;
const emptyDiner: DinerForm = {
  dinerCode: "", name: "", companyName: "", department: "", designation: "",
  mobile: "", dinerType: "regular", notes: "", isActive: true,
};

export default function MealDinersPage() {
  const { tr } = useLang();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [active, setActive] = useState("true");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Diner | null>(null);
  const [form, setForm] = useState<DinerForm>(emptyDiner);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Diner | null>(null);

  const query = useQuery({
    queryKey: ["/api/meal-diners", { search, active }],
    queryFn: async () => {
      const params = new URLSearchParams({ active });
      if (search.trim()) params.set("search", search.trim());
      const response = await apiRequest("GET", `/api/meal-diners?${params}`);
      return response.json() as Promise<Diner[]>;
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["/api/meal-diners"] });
  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...form, dinerCode: normalizeDinerCode(form.dinerCode) };
      return editing
        ? apiRequest("PATCH", `/api/meal-diners/${editing.id}`, payload)
        : apiRequest("POST", "/api/meal-diners", payload);
    },
    onSuccess: () => {
      toast({ title: tr("save") });
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyDiner);
      refresh();
    },
    onError: (error: Error) => toast({ title: error.message, variant: "destructive" }),
  });
  const deactivate = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/meal-diners/${id}`),
    onSuccess: () => { setPendingDelete(null); refresh(); },
    onError: (error: Error) => toast({ title: error.message, variant: "destructive" }),
  });
  const bulkImport = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/meal-diners/bulk", { lines: bulkText });
      return response.json() as Promise<{ created: number; updated: number; skipped: number }>;
    },
    onSuccess: (counts) => {
      toast({ title: `${tr("created")}: ${counts.created} · ${tr("updated")}: ${counts.updated} · ${tr("skipped")}: ${counts.skipped}` });
      setBulkOpen(false);
      setBulkText("");
      refresh();
    },
    onError: (error: Error) => toast({ title: error.message, variant: "destructive" }),
  });
  const diners = useMemo(() => query.data || [], [query.data]);
  const openNew = () => {
    setEditing(null);
    setForm(emptyDiner);
    setDialogOpen(true);
  };
  const openEdit = (diner: Diner) => {
    setEditing(diner);
    setForm({ ...diner, isActive: Boolean(diner.isActive) });
    setDialogOpen(true);
  };
  const setField = (field: keyof DinerForm, value: string | boolean) => setForm((current) => ({ ...current, [field]: value }));
  const fields: Array<[keyof DinerForm, string]> = [
    ["dinerCode", "dinerCode"], ["name", "dinerName"], ["companyName", "company"],
    ["department", "department"], ["designation", "designation"], ["mobile", "mobile"],
    ["dinerType", "dinerType"], ["notes", "notes"],
  ];

  return (
    <Layout>
      <div className="space-y-4">
        <header className="flex flex-col gap-4 rounded-2xl bg-slate-900 p-4 text-white shadow-md sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white"><BookUser className="h-5 w-5" /></div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight sm:text-xl">{tr("canteenEmployeeMaster")}</h1>
              <p className="text-xs text-slate-300">{tr("dinerCode")} · {tr("dinerName")}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button className="border-slate-600 bg-slate-800 text-amber-300 hover:bg-slate-700" variant="outline" onClick={() => setBulkOpen(true)}><Upload className="mr-2 h-4 w-4" />{tr("bulkImport")}</Button>
            <Button className="bg-amber-500 font-bold text-slate-950 hover:bg-amber-400" onClick={openNew}><Plus className="mr-2 h-4 w-4" />{tr("addDiner")}</Button>
          </div>
        </header>

        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <CardHeader className="border-b bg-slate-50 p-3 pb-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tr("searchDiners")} className="pl-9" />
              </div>
              <select aria-label={tr("active")} value={active} onChange={(event) => setActive(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm sm:w-44">
                <option value="all">{tr("allDiners")}</option>
                <option value="true">{tr("active")}</option>
                <option value="false">{tr("inactive")}</option>
              </select>
            </div>
          </CardHeader>
          <CardContent>
            {query.isLoading ? <p className="py-8 text-center text-muted-foreground">…</p> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead><tr className="border-b bg-slate-800 text-left text-[11px] font-bold uppercase text-white">
                    <th className="p-2">{tr("dinerCode")}</th><th className="p-2">{tr("dinerName")}</th>
                    <th className="p-2">{tr("company")}</th><th className="p-2">{tr("department")}</th>
                    <th className="p-2">{tr("mobile")}</th><th className="p-2">{tr("active")}</th><th className="p-2">{tr("actions")}</th>
                  </tr></thead>
                  <tbody>
                    {diners.map((diner) => (
                      <tr key={diner.id} className={`border-b border-slate-200 text-xs last:border-0 ${Boolean(diner.isActive) ? "odd:bg-white even:bg-slate-50" : "bg-slate-100 text-slate-500"}`}>
                        <td className="p-2 font-semibold">{diner.dinerCode}</td><td className="p-2">{diner.name || "—"}</td>
                        <td className="p-2">{diner.companyName || "—"}</td><td className="p-2">{diner.department || "—"}</td>
                        <td className="p-2">{diner.mobile || "—"}</td>
                        <td className="p-2">{Boolean(diner.isActive) ? tr("active") : tr("inactive")}</td>
                        <td className="p-2">
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => openEdit(diner)} aria-label={tr("editDiner")}><Pencil className="h-4 w-4" /></Button>
                            <Button size="sm" variant="outline" onClick={() => setPendingDelete(diner)} aria-label={tr("inactive")}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!diners.length && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">{tr("noDiners")}</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader><DialogTitle>{editing ? tr("editDiner") : tr("addDiner")}</DialogTitle><DialogDescription>{tr("canteenEmployeeMaster")}</DialogDescription></DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              {fields.map(([field, label]) => (
                <div key={field} className="space-y-1">
                  <Label htmlFor={`diner-${field}`}>{tr(label as Parameters<typeof tr>[0])}</Label>
                  <Input id={`diner-${field}`} maxLength={field === "notes" ? 500 : field === "mobile" ? 20 : 255} value={form[field] as string} onChange={(event) => setField(field, event.target.value)} />
                </div>
              ))}
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={(event) => setField("isActive", event.target.checked)} />{tr("active")}</label>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>{tr("cancel")}</Button>
              <Button disabled={save.isPending || !form.dinerCode.trim()} onClick={() => save.mutate()}>{tr("save")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{tr("bulkImport")}</DialogTitle><DialogDescription>{tr("bulkImportPlaceholder")}</DialogDescription></DialogHeader>
            <Textarea rows={8} value={bulkText} onChange={(event) => setBulkText(event.target.value)} placeholder={`${tr("dinerCode")},${tr("dinerName")},${tr("company")},${tr("department")},${tr("mobile")}`} />
            <DialogFooter><Button variant="outline" onClick={() => setBulkOpen(false)}>{tr("cancel")}</Button><Button disabled={bulkImport.isPending} onClick={() => bulkImport.mutate()}>{tr("import")}</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>{tr("inactive")}</DialogTitle><DialogDescription>{pendingDelete?.dinerCode} — {pendingDelete?.name}</DialogDescription></DialogHeader>
            <p className="text-sm">{tr("confirmDeactivate")}</p>
            <DialogFooter><Button variant="outline" onClick={() => setPendingDelete(null)}>{tr("cancel")}</Button><Button variant="destructive" disabled={deactivate.isPending} onClick={() => pendingDelete && deactivate.mutate(pendingDelete.id)}>{tr("inactive")}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
