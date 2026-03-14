import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { apiRequest } from "@/lib/queryClient";
import { queryClient as qc } from "@/lib/queryClient";
import { useClientNames } from "@/hooks/use-reports";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Printer, Loader2, Gavel, Banknote, Clock, AlertTriangle, Calendar, RefreshCw, Pencil } from "lucide-react";

const fmt = (n: number) =>
  "\u20B9" + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const fmtDate = (d: string | null | undefined): string => {
  if (!d) return "-";
  const s = String(d).split("T")[0];
  if (!s) return "-";
  const [y, m, dd] = s.split("-");
  return `${dd}-${m}-${y}`;
};

function filterByMonth(records: any[] | undefined, month: string, year: string): any[] {
  if (!records) return [];
  const m = month && month !== "all" ? parseInt(month) : 0;
  const y = year ? parseInt(year) : 0;
  if (!m && !y) return records;
  return records.filter((r: any) => {
    if (!r.date) return false;
    const d = new Date(r.date);
    if (m && y) return d.getMonth() + 1 === m && d.getFullYear() === y;
    if (m) return d.getMonth() + 1 === m;
    if (y) return d.getFullYear() === y;
    return true;
  });
}

function useEmployees(clientName: string) {
  return useQuery({
    queryKey: ["/api/employees", clientName],
    queryFn: async () => {
      const res = await fetch(`/api/employees?clientName=${encodeURIComponent(clientName)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch employees");
      return res.json() as Promise<{ id: number; name: string; employeeId?: string }[]>;
    },
    enabled: !!clientName,
  });
}

function FinesTab({ clientName, clientAddress, employees, empMap, filterMonth, filterYear }: { clientName: string; clientAddress: string; employees: any[]; empMap: Map<number, string>; filterMonth: string; filterYear: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ employeeId: "", date: "", amount: "", reason: "", realized: "" });
  const emptyForm = { employeeId: "", date: "", amount: "", reason: "", realized: "" };

  const { data: fines, isLoading } = useQuery({
    queryKey: ["/api/fines", clientName],
    queryFn: async () => {
      const res = await fetch(`/api/fines?clientName=${encodeURIComponent(clientName)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch fines");
      return res.json() as Promise<any[]>;
    },
    enabled: !!clientName,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/fines", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fines", clientName] });
      setOpen(false); setEditingId(null); setFormData(emptyForm);
      toast({ title: "Fine added successfully" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PUT", `/api/fines/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fines", clientName] });
      setOpen(false); setEditingId(null); setFormData(emptyForm);
      toast({ title: "Fine updated successfully" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/fines/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fines", clientName] });
      toast({ title: "Fine deleted" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const openEdit = (record: any) => {
    setEditingId(record.id);
    setFormData({
      employeeId: String(record.employeeId),
      date: record.date?.split("T")[0] || record.date || "",
      amount: record.amount || "",
      reason: record.reason || "",
      realized: record.realized || "",
    });
    setOpen(true);
  };

  const openAdd = () => {
    setEditingId(null); setFormData(emptyForm); setOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.employeeId || !formData.date || !formData.amount) {
      toast({ title: "Please fill required fields", variant: "destructive" });
      return;
    }
    const payload = {
      employeeId: Number(formData.employeeId),
      clientName,
      date: formData.date,
      amount: formData.amount,
      reason: formData.reason,
      realized: formData.realized,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const filtered = useMemo(() => filterByMonth(fines, filterMonth, filterYear), [fines, filterMonth, filterYear]);

  const handlePrint = () => {
    const printWin = window.open("", "_blank");
    if (!printWin) return;
    const rows = filtered.map((f: any, i: number) => `
      <tr><td>${i + 1}</td><td>${empMap.get(f.employeeId) || f.employeeId}</td><td>${f.date?.split("T")[0] || f.date}</td><td>${fmt(f.amount)}</td><td>${f.reason || ""}</td><td>${f.realized || ""}</td></tr>
    `).join("");
    const period = filterMonth && filterMonth !== "all" && filterYear ? ` - ${MONTHS[parseInt(filterMonth) - 1]} ${filterYear}` : filterYear ? ` - ${filterYear}` : "";
    printWin.document.write(`<html><head><title>Form XXI - Fines</title><style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px 10px;text-align:left;font-size:13px}th{background:#f5f5f5}</style></head><body>
      <h2>Register of Fines (Form XXI) - ${clientName}${period}</h2>
      <table><thead><tr><th>#</th><th>Employee</th><th>Date</th><th>Amount</th><th>Reason</th><th>Realized</th></tr></thead><tbody>${rows}</tbody></table>
    </body></html>`);
    printWin.document.close();
    printWin.print();
  };

  const handleGovPrint = () => {
    const printWin = window.open("", "_blank");
    if (!printWin) return;

    const empFullMap = new Map<number, any>();
    employees.forEach((e: any) => empFullMap.set(e.id, e));

    const period = filterMonth && filterMonth !== "all" && filterYear ? `${MONTHS[parseInt(filterMonth) - 1]} ${filterYear}` : filterYear ? filterYear : "";

    const formatDate = (d: string) => {
      if (!d) return "";
      const dt = new Date(d);
      const dd = String(dt.getDate()).padStart(2, "0");
      const mm = String(dt.getMonth() + 1).padStart(2, "0");
      return `${dd}-${mm}-${dt.getFullYear()}`;
    };

    const rows = filtered.map((f: any, i: number) => {
      const emp = empFullMap.get(f.employeeId);
      return `<tr>
        <td>${i + 1}</td>
        <td style="text-align:left;white-space:nowrap">${emp?.name || ""}</td>
        <td style="text-align:left;white-space:nowrap">${emp?.fatherName || ""}</td>
        <td style="text-align:left;white-space:nowrap">${emp?.designation || ""}</td>
        <td style="text-align:left">${f.reason || ""}</td>
        <td>${formatDate(f.date)}</td>
        <td></td>
        <td></td>
        <td></td>
        <td style="text-align:right">${fmt(f.amount)}</td>
        <td>${f.realized || ""}</td>
        <td></td>
      </tr>`;
    }).join("");

    const monthNum = filterMonth && filterMonth !== "all" ? parseInt(filterMonth) : null;
    const periodDisplay = monthNum && filterYear ? `${MONTHS[monthNum - 1]} ${filterYear} (${monthNum})` : period;

    printWin.document.write(`<html><head><title>Form XXI - Register of Fines</title>
    <style>
      @page { size: landscape; margin: 10mm; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: Arial, sans-serif; font-size: 10px; padding: 10px; }
      .header-title { text-align: left; font-size: 11px; font-weight: bold; margin-bottom: 2px; }
      .header-main { text-align: center; font-size: 16px; font-weight: bold; margin-bottom: 2px; }
      .header-rule { text-align: center; font-size: 9px; margin-bottom: 8px; }
      .info-table { width: 100%; border-collapse: collapse; margin-bottom: 6px; font-size: 10px; }
      .info-table td { padding: 2px 6px; vertical-align: top; }
      .info-label { font-weight: bold; white-space: nowrap; }
      .period-label { font-size: 14px; font-weight: bold; }
      table.main { width: 100%; border-collapse: collapse; font-size: 9px; table-layout: auto; }
      table.main th, table.main td { border: 1px solid #000; padding: 4px 6px; text-align: center; vertical-align: middle; height: 28px; }
      table.main th { background: #f0f0f0; font-weight: bold; font-size: 8px; }
      table.main td { font-size: 9px; }
      .col-num-row th { font-size: 8px; font-weight: normal; font-style: italic; }
      .footnote { font-size: 8px; margin-top: 12px; font-style: italic; }
    </style></head><body>
      <div class="header-title">FORM XXI</div>
      <div class="header-main">Register of Fines</div>
      <div class="header-rule">1[See rule 78 (1) a) (ii)]</div>

      <table class="info-table">
        <tr>
          <td class="info-label" style="width:22%">Name and Address of the Contractor</td>
          <td style="width:28%">DJ HOSPITALITY &amp; FACILITY MANAGEMENT PVT LTD</td>
          <td class="info-label" style="width:22%">Name and address of the establishment in /</td>
          <td style="width:28%">${clientName}${clientAddress ? '<br/>' + clientAddress : ''}</td>
        </tr>
        <tr>
          <td></td>
          <td>7 Crimatorium Street, Kolkata- 700014</td>
          <td class="info-label">Under which contract is carried on</td>
          <td></td>
        </tr>
        <tr>
          <td class="info-label">Nature and location of Work</td>
          <td>Canteen</td>
          <td class="info-label">Name and address of the Principal Employer</td>
          <td>${clientName}${clientAddress ? '<br/>' + clientAddress : ''}</td>
        </tr>
        <tr>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
        </tr>
        <tr>
          <td></td>
          <td></td>
          <td class="info-label">For The Month of</td>
          <td class="period-label">${periodDisplay}</td>
        </tr>
      </table>

      <table class="main">
        <thead>
          <tr>
            <th>Sl. No.</th>
            <th>Name of<br/>workmen</th>
            <th>Father's /<br/>Husband's name</th>
            <th>Designation /<br/>Nature of<br/>employment</th>
            <th>Act/Omission for<br/>which fine imposed</th>
            <th>Date of<br/>offence</th>
            <th>Whether workmen<br/>showed against fine</th>
            <th>Name of person in whose<br/>presence employer's<br/>explanation was heard</th>
            <th>Wage period and<br/>wages payable</th>
            <th>Amount of<br/>fine imposed</th>
            <th>Date on which<br/>fine realised</th>
            <th>Remarks</th>
          </tr>
          <tr class="col-num-row">
            <th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th>
            <th>7</th><th>8</th><th>9</th><th>10</th><th>11</th><th>12</th>
          </tr>
        </thead>
        <tbody>
          ${rows || Array.from({length: 8}, (_, i) => `<tr>${Array.from({length: 12}, () => '<td style="height:28px">&nbsp;</td>').join('')}</tr>`).join('')}
        </tbody>
      </table>

      <div class="footnote">* Substituted for the brackets, words, figures and letter "[See Rule 78(2) (d)]" by GSR948 dated 12-7-1978, w.e.f. 22-7-1978.</div>
    </body></html>`);
    printWin.document.close();
    printWin.print();
  };

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-semibold text-muted-foreground" data-testid="text-fines-title">Form XXI - Register of Fines</h3>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handlePrint} data-testid="button-print-fines" disabled={!filtered.length}>
            <Printer className="w-4 h-4 mr-1" /> Print
          </Button>
          <Button variant="outline" size="sm" onClick={handleGovPrint} data-testid="button-gov-print-fines">
            <Printer className="w-4 h-4 mr-1" /> Form XXI
          </Button>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); setFormData(emptyForm); } }}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openAdd} data-testid="button-add-fine"><Plus className="w-4 h-4 mr-1" /> Add</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingId ? "Edit Fine" : "Add Fine"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Employee *</Label>
                  <Select value={formData.employeeId} onValueChange={(v) => setFormData({ ...formData, employeeId: v })} disabled={!!editingId}>
                    <SelectTrigger data-testid="select-fine-employee"><SelectValue placeholder="Select employee" /></SelectTrigger>
                    <SelectContent>{employees.map((e: any) => <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Date *</Label>
                  <Input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} data-testid="input-fine-date" />
                </div>
                <div>
                  <Label>Amount *</Label>
                  <Input inputMode="decimal" placeholder="0.00" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} data-testid="input-fine-amount" />
                </div>
                <div>
                  <Label>Reason</Label>
                  <Input value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })} data-testid="input-fine-reason" />
                </div>
                <div>
                  <Label>Realized</Label>
                  <Input value={formData.realized} onChange={(e) => setFormData({ ...formData, realized: e.target.value })} data-testid="input-fine-realized" />
                </div>
                <Button className="w-full" onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-fine">
                  {(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} {editingId ? "Update Fine" : "Save Fine"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {!filtered.length ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">No fines recorded{filterMonth && filterMonth !== "all" ? " for this month" : ""}</CardContent></Card>
      ) : (
        <>
          <div className="hidden md:block">
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2.5 text-left text-xs font-semibold">#</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold">Employee</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold">Date</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold">Amount</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold">Reason</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold">Realized</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((f: any, i: number) => (
                      <tr key={f.id} className="border-b last:border-0" data-testid={`row-fine-${f.id}`}>
                        <td className="px-3 py-2.5">{i + 1}</td>
                        <td className="px-3 py-2.5 font-medium">{empMap.get(f.employeeId) || f.employeeId}</td>
                        <td className="px-3 py-2.5">{fmtDate(f.date)}</td>
                        <td className="px-3 py-2.5 text-right font-mono">{fmt(f.amount)}</td>
                        <td className="px-3 py-2.5">{f.reason || "-"}</td>
                        <td className="px-3 py-2.5">{f.realized || "-"}</td>
                        <td className="px-3 py-2.5 text-right">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(f)} data-testid={`button-edit-fine-${f.id}`}><Pencil className="w-4 h-4" /></Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" data-testid={`button-delete-fine-${f.id}`}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>Delete Fine?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteMutation.mutate(f.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
          <div className="md:hidden space-y-3">
            {filtered.map((f: any, i: number) => (
              <Card key={f.id} data-testid={`card-fine-${f.id}`}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">{empMap.get(f.employeeId) || f.employeeId}</p>
                      <p className="text-xs text-muted-foreground">{fmtDate(f.date)}</p>
                    </div>
                    <Badge variant="secondary" className="font-mono">{fmt(f.amount)}</Badge>
                  </div>
                  {f.reason && <p className="text-xs text-muted-foreground">Reason: {f.reason}</p>}
                  {f.realized && <p className="text-xs text-muted-foreground">Realized: {f.realized}</p>}
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(f)} data-testid={`button-edit-fine-mobile-${f.id}`}><Pencil className="w-4 h-4" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid={`button-delete-fine-mobile-${f.id}`}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Delete Fine?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteMutation.mutate(f.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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

function AdvancesTab({ clientName, clientAddress, employees, empMap, filterMonth, filterYear }: { clientName: string; clientAddress: string; employees: any[]; empMap: Map<number, string>; filterMonth: string; filterYear: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ employeeId: "", date: "", amount: "", purpose: "", installments: "", recoveredAmount: "" });
  const emptyForm = { employeeId: "", date: "", amount: "", purpose: "", installments: "", recoveredAmount: "" };

  const { data: advances, isLoading } = useQuery({
    queryKey: ["/api/advances", clientName],
    queryFn: async () => {
      const res = await fetch(`/api/advances?clientName=${encodeURIComponent(clientName)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch advances");
      return res.json() as Promise<any[]>;
    },
    enabled: !!clientName,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => { const res = await apiRequest("POST", "/api/advances", data); return res.json(); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/advances", clientName] });
      setOpen(false); setEditingId(null); setFormData(emptyForm);
      toast({ title: "Advance added successfully" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PUT", `/api/advances/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/advances", clientName] });
      setOpen(false); setEditingId(null); setFormData(emptyForm);
      toast({ title: "Advance updated successfully" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/advances/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/advances", clientName] });
      toast({ title: "Advance deleted" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const openEdit = (record: any) => {
    setEditingId(record.id);
    setFormData({
      employeeId: String(record.employeeId),
      date: record.date?.split("T")[0] || record.date || "",
      amount: record.amount || "",
      purpose: record.purpose || "",
      installments: record.installments ? String(record.installments) : "",
      recoveredAmount: record.recoveredAmount || "",
    });
    setOpen(true);
  };

  const openAdd = () => {
    setEditingId(null); setFormData(emptyForm); setOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.employeeId || !formData.date || !formData.amount) {
      toast({ title: "Please fill required fields", variant: "destructive" });
      return;
    }
    const payload = {
      employeeId: Number(formData.employeeId),
      clientName,
      date: formData.date,
      amount: formData.amount,
      purpose: formData.purpose,
      installments: formData.installments ? Number(formData.installments) : null,
      recoveredAmount: formData.recoveredAmount || null,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const filtered = useMemo(() => filterByMonth(advances, filterMonth, filterYear), [advances, filterMonth, filterYear]);

  const handlePrint = () => {
    const printWin = window.open("", "_blank");
    if (!printWin) return;
    const rows = filtered.map((a: any, i: number) => `
      <tr><td>${i + 1}</td><td>${empMap.get(a.employeeId) || a.employeeId}</td><td>${a.date?.split("T")[0] || a.date}</td><td>${fmt(a.amount)}</td><td>${a.purpose || ""}</td><td>${a.installments || ""}</td><td>${a.recoveredAmount ? fmt(a.recoveredAmount) : ""}</td></tr>
    `).join("");
    const period = filterMonth && filterMonth !== "all" && filterYear ? ` - ${MONTHS[parseInt(filterMonth) - 1]} ${filterYear}` : filterYear ? ` - ${filterYear}` : "";
    printWin.document.write(`<html><head><title>Form XXII - Advances</title><style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px 10px;text-align:left;font-size:13px}th{background:#f5f5f5}</style></head><body>
      <h2>Register of Advances (Form XXII) - ${clientName}${period}</h2>
      <table><thead><tr><th>#</th><th>Employee</th><th>Date</th><th>Amount</th><th>Purpose</th><th>Installments</th><th>Recovered</th></tr></thead><tbody>${rows}</tbody></table>
    </body></html>`);
    printWin.document.close();
    printWin.print();
  };

  const handleGovPrint = () => {
    const printWin = window.open("", "_blank");
    if (!printWin) return;

    const empFullMap = new Map<number, any>();
    employees.forEach((e: any) => empFullMap.set(e.id, e));

    const period = filterMonth && filterMonth !== "all" && filterYear ? `${MONTHS[parseInt(filterMonth) - 1]} ${filterYear}` : filterYear ? filterYear : "";

    const formatDate = (d: string) => {
      if (!d) return "";
      const dt = new Date(d);
      const dd = String(dt.getDate()).padStart(2, "0");
      const mm = String(dt.getMonth() + 1).padStart(2, "0");
      return `${dd}-${mm}-${dt.getFullYear()}`;
    };

    const rows = filtered.map((a: any, i: number) => {
      const emp = empFullMap.get(a.employeeId);
      return `<tr>
        <td>${i + 1}</td>
        <td style="text-align:left;white-space:nowrap">${emp?.name || ""}</td>
        <td style="text-align:left;white-space:nowrap">${emp?.fatherName || ""}</td>
        <td style="text-align:left;white-space:nowrap">${emp?.designation || ""}</td>
        <td></td>
        <td>${formatDate(a.date)}<br/>${fmt(a.amount)}</td>
        <td style="text-align:left">${a.purpose || ""}</td>
        <td>${a.installments || ""}</td>
        <td>${a.recoveredAmount ? fmt(a.recoveredAmount) : ""}</td>
        <td></td>
        <td></td>
      </tr>`;
    }).join("");

    const monthNum = filterMonth && filterMonth !== "all" ? parseInt(filterMonth) : null;
    const periodDisplay = monthNum && filterYear ? `${MONTHS[monthNum - 1]} ${filterYear}` : period;

    printWin.document.write(`<html><head><title>Form XXII - Register of Advances</title>
    <style>
      @page { size: landscape; margin: 10mm; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: Arial, sans-serif; font-size: 10px; padding: 10px; }
      .header-title { text-align: left; font-size: 11px; font-weight: bold; margin-bottom: 2px; }
      .header-main { text-align: center; font-size: 16px; font-weight: bold; margin-bottom: 2px; }
      .header-rule { text-align: center; font-size: 9px; margin-bottom: 8px; }
      .info-table { width: 100%; border-collapse: collapse; margin-bottom: 6px; font-size: 10px; }
      .info-table td { padding: 2px 6px; vertical-align: top; }
      .info-label { font-weight: bold; white-space: nowrap; }
      .period-label { font-size: 14px; font-weight: bold; }
      table.main { width: 100%; border-collapse: collapse; font-size: 9px; table-layout: auto; }
      table.main th, table.main td { border: 1px solid #000; padding: 4px 6px; text-align: center; vertical-align: middle; height: 28px; }
      table.main th { background: #f0f0f0; font-weight: bold; font-size: 8px; }
      table.main td { font-size: 9px; }
      .col-num-row th { font-size: 8px; font-weight: normal; font-style: italic; }
      .footnote { font-size: 8px; margin-top: 12px; font-style: italic; }
    </style></head><body>
      <div class="header-title">FORM XVII</div>
      <div class="header-main">Register of Advances</div>
      <div class="header-rule">[1][See Rule 78(1)(a)(ii)]</div>

      <table class="info-table">
        <tr>
          <td class="info-label" style="width:22%">Name and Address of the Contractor</td>
          <td style="width:28%">DJ HOSPITALITY &amp; FACILITY MANAGEMENT PVT LTD</td>
          <td class="info-label" style="width:22%">Name and address of the establishment in /</td>
          <td style="width:28%">${clientName}${clientAddress ? '<br/>' + clientAddress : ''}</td>
        </tr>
        <tr>
          <td></td>
          <td>7 Crimatorium Street, Kolkata- 700014</td>
          <td class="info-label">Under which contract is carried on</td>
          <td></td>
        </tr>
        <tr>
          <td class="info-label">Nature and location of Work</td>
          <td>Canteen</td>
          <td class="info-label">Name and address of the Principal Employer</td>
          <td>${clientName}${clientAddress ? '<br/>' + clientAddress : ''}</td>
        </tr>
        <tr>
          <td></td>
          <td></td>
          <td></td>
          <td>JL No. 284 (Kendua Panchayat) Howrah</td>
        </tr>
        <tr>
          <td></td>
          <td></td>
          <td class="info-label">For The Month of</td>
          <td class="period-label">${periodDisplay}</td>
        </tr>
      </table>

      <table class="main">
        <thead>
          <tr>
            <th>Sl. No.</th>
            <th>Name</th>
            <th>Father's /<br/>Husband's name</th>
            <th>Nature of employment /<br/>Designation</th>
            <th>Wage period and<br/>wages payable</th>
            <th>Date and amount<br/>of advance given</th>
            <th>Purpose(s) for which<br/>advance made</th>
            <th>No. of instalments<br/>by which advance<br/>to be repaid</th>
            <th>Date and amount of<br/>each instalment repaid</th>
            <th>Date on which last<br/>instalment was repaid</th>
            <th>Remarks</th>
          </tr>
          <tr class="col-num-row">
            <th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th>
            <th>7</th><th>8</th><th>9</th><th>10</th><th>11</th>
          </tr>
        </thead>
        <tbody>
          ${rows || Array.from({length: 8}, () => `<tr>${Array.from({length: 11}, () => '<td style="height:28px">&nbsp;</td>').join('')}</tr>`).join('')}
        </tbody>
      </table>

      <div class="footnote">[1] Substituted for the brackets, words, figures and letter "[See Rule 78(2) (d)]" by GSR948 dated 12-7-1978, w.e.f. 22-7-1978.</div>
    </body></html>`);
    printWin.document.close();
    printWin.print();
  };

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-semibold text-muted-foreground" data-testid="text-advances-title">Form XXII - Register of Advances</h3>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handlePrint} data-testid="button-print-advances" disabled={!filtered.length}>
            <Printer className="w-4 h-4 mr-1" /> Print
          </Button>
          <Button variant="outline" size="sm" onClick={handleGovPrint} data-testid="button-gov-print-advances">
            <Printer className="w-4 h-4 mr-1" /> Form XXII
          </Button>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); setFormData(emptyForm); } }}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openAdd} data-testid="button-add-advance"><Plus className="w-4 h-4 mr-1" /> Add</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingId ? "Edit Advance" : "Add Advance"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Employee *</Label>
                  <Select value={formData.employeeId} onValueChange={(v) => setFormData({ ...formData, employeeId: v })} disabled={!!editingId}>
                    <SelectTrigger data-testid="select-advance-employee"><SelectValue placeholder="Select employee" /></SelectTrigger>
                    <SelectContent>{employees.map((e: any) => <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Date *</Label>
                  <Input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} data-testid="input-advance-date" />
                </div>
                <div>
                  <Label>Amount *</Label>
                  <Input inputMode="decimal" placeholder="0.00" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} data-testid="input-advance-amount" />
                </div>
                <div>
                  <Label>Purpose</Label>
                  <Input value={formData.purpose} onChange={(e) => setFormData({ ...formData, purpose: e.target.value })} data-testid="input-advance-purpose" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Installments</Label>
                    <Input inputMode="numeric" placeholder="0" value={formData.installments} onChange={(e) => setFormData({ ...formData, installments: e.target.value })} data-testid="input-advance-installments" />
                  </div>
                  <div>
                    <Label>Recovered Amount</Label>
                    <Input inputMode="decimal" placeholder="0.00" value={formData.recoveredAmount} onChange={(e) => setFormData({ ...formData, recoveredAmount: e.target.value })} data-testid="input-advance-recovered" />
                  </div>
                </div>
                <Button className="w-full" onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-advance">
                  {(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} {editingId ? "Update Advance" : "Save Advance"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {!filtered.length ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">No advances recorded{filterMonth && filterMonth !== "all" ? " for this month" : ""}</CardContent></Card>
      ) : (
        <>
          <div className="hidden md:block">
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2.5 text-left text-xs font-semibold">#</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold">Employee</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold">Date</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold">Amount</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold">Purpose</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold">Installments</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold">Recovered</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((a: any, i: number) => (
                      <tr key={a.id} className="border-b last:border-0" data-testid={`row-advance-${a.id}`}>
                        <td className="px-3 py-2.5">{i + 1}</td>
                        <td className="px-3 py-2.5 font-medium">{empMap.get(a.employeeId) || a.employeeId}</td>
                        <td className="px-3 py-2.5">{fmtDate(a.date)}</td>
                        <td className="px-3 py-2.5 text-right font-mono">{fmt(a.amount)}</td>
                        <td className="px-3 py-2.5">{a.purpose || "-"}</td>
                        <td className="px-3 py-2.5 text-right">{a.installments || "-"}</td>
                        <td className="px-3 py-2.5 text-right font-mono">{a.recoveredAmount ? fmt(a.recoveredAmount) : "-"}</td>
                        <td className="px-3 py-2.5 text-right">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(a)} data-testid={`button-edit-advance-${a.id}`}><Pencil className="w-4 h-4" /></Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" data-testid={`button-delete-advance-${a.id}`}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>Delete Advance?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteMutation.mutate(a.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
          <div className="md:hidden space-y-3">
            {filtered.map((a: any) => (
              <Card key={a.id} data-testid={`card-advance-${a.id}`}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">{empMap.get(a.employeeId) || a.employeeId}</p>
                      <p className="text-xs text-muted-foreground">{fmtDate(a.date)}</p>
                    </div>
                    <Badge variant="secondary" className="font-mono">{fmt(a.amount)}</Badge>
                  </div>
                  {a.purpose && <p className="text-xs text-muted-foreground">Purpose: {a.purpose}</p>}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      {a.installments && <span>Installments: {a.installments}</span>}
                      {a.recoveredAmount && <span>Recovered: {fmt(a.recoveredAmount)}</span>}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(a)} data-testid={`button-edit-advance-mobile-${a.id}`}><Pencil className="w-4 h-4" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`button-delete-advance-mobile-${a.id}`}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>Delete Advance?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteMutation.mutate(a.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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

function OvertimeTab({ clientName, clientAddress, employees, empMap, filterMonth, filterYear }: { clientName: string; clientAddress: string; employees: any[]; empMap: Map<number, string>; filterMonth: string; filterYear: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ employeeId: "", date: "", normalHours: "", overtimeHours: "", overtimeRate: "", overtimeAmount: "", paidDate: "" });
  const emptyForm = { employeeId: "", date: "", normalHours: "", overtimeHours: "", overtimeRate: "", overtimeAmount: "", paidDate: "" };
  const [formulaDailyRate, setFormulaDailyRate] = useState<number | null>(null);

  const { data: overtime, isLoading } = useQuery({
    queryKey: ["/api/overtime", clientName],
    queryFn: async () => {
      const res = await fetch(`/api/overtime?clientName=${encodeURIComponent(clientName)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch overtime");
      return res.json() as Promise<any[]>;
    },
    enabled: !!clientName,
  });

  const { data: salaryRecords } = useQuery({
    queryKey: ["/api/salary", clientName, filterMonth, filterYear],
    queryFn: async () => {
      const params = new URLSearchParams({ clientName });
      if (filterMonth && filterMonth !== "all") params.set("month", filterMonth);
      if (filterYear) params.set("year", filterYear);
      const res = await fetch(`/api/salary?${params}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json() as Promise<any[]>;
    },
    enabled: !!clientName,
  });

  const salaryPaidDateMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!salaryRecords) return map;
    for (const s of salaryRecords) {
      if (s.paidOn) {
        const key = `${s.employeeId}-${s.month}-${s.year}`;
        map.set(key, s.paidOn);
      }
    }
    return map;
  }, [salaryRecords]);

  const getSalaryPaidDate = (employeeId: number, dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const m = d.getMonth() + 1;
    const y = d.getFullYear();
    return salaryPaidDateMap.get(`${employeeId}-${m}-${y}`) || "";
  };

  const createMutation = useMutation({
    mutationFn: async (data: any) => { const res = await apiRequest("POST", "/api/overtime", data); return res.json(); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/overtime", clientName] });
      setOpen(false); setEditingId(null); setFormData(emptyForm);
      toast({ title: "Overtime record added successfully" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PUT", `/api/overtime/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/overtime", clientName] });
      setOpen(false); setEditingId(null); setFormData(emptyForm);
      toast({ title: "Overtime record updated successfully" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/overtime/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/overtime", clientName] });
      toast({ title: "Overtime record deleted" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const recalcMutation = useMutation({
    mutationFn: async () => { const res = await apiRequest("POST", "/api/overtime/recalculate-rates", { clientName }); return res.json(); },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/overtime", clientName] });
      toast({ title: `Recalculated OT rates for ${data.updated} records` });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const calcOtRate = (dailyRate: number) => {
    // Formula: (Basic Rate + Basic Rate×5%) / 4
    return (dailyRate * 1.05) / 4;
  };

  const calcOtAmount = (hours: string, rate: string) => {
    const h = parseFloat(hours) || 0;
    const r = parseFloat(rate) || 0;
    return h && r ? String(Math.round(h * r)) : "";
  };

  const fetchSkillRate = async (skill: string, month: number, year: number): Promise<number | null> => {
    try {
      const res = await fetch(`/api/skill-wage-rates/lookup?skillCategory=${encodeURIComponent(skill)}&month=${month}&year=${year}`, { credentials: "include" });
      const data = await res.json();
      return data ? Number(data.dailyRate) : null;
    } catch { return null; }
  };

  const recalcOtRate = async (empId: string, dateStr: string) => {
    const emp = employees.find((e: any) => String(e.id) === empId);
    if (!emp) return;
    let dailyRate = parseFloat(emp.dailyRate) || 0;
    if (dateStr && emp.skills) {
      const d = new Date(dateStr);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();
      const skillRate = await fetchSkillRate(emp.skills, m, y);
      if (skillRate && skillRate > 0) dailyRate = skillRate;
    }
    const rate = calcOtRate(dailyRate).toFixed(2);
    setFormulaDailyRate(dailyRate > 0 ? dailyRate : null);
    setFormData(prev => ({ ...prev, overtimeRate: rate, overtimeAmount: calcOtAmount(prev.overtimeHours, rate) }));
  };

  const handleEmployeeChange = (empId: string) => {
    setFormData(prev => ({ ...prev, employeeId: empId }));
    recalcOtRate(empId, formData.date);
  };

  const updateOvertimeHours = (val: string) => {
    setFormData(prev => ({ ...prev, overtimeHours: val, overtimeAmount: calcOtAmount(val, prev.overtimeRate) }));
  };

  const updateOvertimeRate = (val: string) => {
    setFormData(prev => ({ ...prev, overtimeRate: val, overtimeAmount: calcOtAmount(prev.overtimeHours, val) }));
  };

  const openEdit = (record: any) => {
    setEditingId(record.id);
    setFormData({
      employeeId: String(record.employeeId),
      date: record.date?.split("T")[0] || record.date || "",
      normalHours: record.normalHours ? String(record.normalHours) : "",
      overtimeHours: record.overtimeHours ? String(record.overtimeHours) : "",
      overtimeRate: record.overtimeRate || "",
      overtimeAmount: record.overtimeAmount || "",
      paidDate: record.paidDate?.split("T")[0] || record.paidDate || "",
    });
    // derive daily rate from OT rate: dailyRate = otRate * 4 / 1.05
    const otR = parseFloat(record.overtimeRate) || 0;
    setFormulaDailyRate(otR > 0 ? Math.round((otR * 4 / 1.05) * 100) / 100 : null);
    setOpen(true);
  };

  const openAdd = () => {
    setEditingId(null); setFormData(emptyForm); setFormulaDailyRate(null); setOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.employeeId || !formData.date) {
      toast({ title: "Please fill required fields", variant: "destructive" });
      return;
    }
    const payload = {
      employeeId: Number(formData.employeeId),
      clientName,
      date: formData.date,
      normalHours: formData.normalHours ? Number(formData.normalHours) : null,
      overtimeHours: formData.overtimeHours ? Number(formData.overtimeHours) : null,
      overtimeRate: formData.overtimeRate || null,
      overtimeAmount: formData.overtimeAmount || null,
      paidDate: formData.paidDate || null,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const filtered = useMemo(() => filterByMonth(overtime, filterMonth, filterYear), [overtime, filterMonth, filterYear]);

  const handlePrint = () => {
    const printWin = window.open("", "_blank");
    if (!printWin) return;
    const rows = filtered.map((o: any, i: number) => `
      <tr><td>${i + 1}</td><td>${empMap.get(o.employeeId) || o.employeeId}</td><td>${o.date?.split("T")[0] || o.date}</td><td>${o.normalHours || ""}</td><td>${o.overtimeHours || ""}</td><td>${o.overtimeRate ? fmt(o.overtimeRate) : ""}</td><td>${o.overtimeAmount ? fmt(o.overtimeAmount) : ""}</td><td>${(o.paidDate || getSalaryPaidDate(o.employeeId, o.date) || "").split("T")[0] || ""}</td></tr>
    `).join("");
    const period = filterMonth && filterMonth !== "all" && filterYear ? ` - ${MONTHS[parseInt(filterMonth) - 1]} ${filterYear}` : filterYear ? ` - ${filterYear}` : "";
    printWin.document.write(`<html><head><title>Form XXIII - Overtime</title><style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px 10px;text-align:left;font-size:13px}th{background:#f5f5f5}</style></head><body>
      <h2>Register of Overtime (Form XXIII) - ${clientName}${period}</h2>
      <table><thead><tr><th>#</th><th>Employee</th><th>Date</th><th>Normal Hrs</th><th>OT Hrs</th><th>OT Rate</th><th>OT Amount</th><th>Paid Date</th></tr></thead><tbody>${rows}</tbody></table>
    </body></html>`);
    printWin.document.close();
    printWin.print();
  };

  const handleGovPrint = () => {
    const printWin = window.open("", "_blank");
    if (!printWin) return;

    const empFullMap = new Map<number, any>();
    employees.forEach((e: any) => empFullMap.set(e.id, e));

    const period = filterMonth && filterMonth !== "all" && filterYear ? `${MONTHS[parseInt(filterMonth) - 1]} ${filterYear}` : filterYear ? filterYear : "";

    const formatDate = (d: string) => {
      if (!d) return "";
      const dt = new Date(d);
      const dd = String(dt.getDate()).padStart(2, "0");
      const mm = String(dt.getMonth() + 1).padStart(2, "0");
      return `${dd}-${mm}-${dt.getFullYear()}`;
    };

    const splitRsP = (val: any) => {
      const n = parseFloat(val) || 0;
      const rs = Math.floor(n);
      const p = ((n - rs) * 100).toFixed(0).padStart(2, "0");
      return { rs, p };
    };

    const rows = filtered.map((o: any, i: number) => {
      const emp = empFullMap.get(o.employeeId);
      const name = emp?.name || o.employeeId;
      const father = emp?.fatherName || "";
      const sex = emp?.gender === "Female" ? "F" : "M";
      const desg = emp?.designation || "";
      const dailyRate = parseFloat(emp?.dailyRate || "0");
      const normalRate = splitRsP(dailyRate);
      const otRate = splitRsP(o.overtimeRate);
      const otEarnings = splitRsP(o.overtimeAmount);
      return `<tr>
        <td>${i + 1}</td>
        <td style="text-align:left;white-space:nowrap">${name}</td>
        <td style="text-align:left;white-space:nowrap">${father}</td>
        <td>${sex}</td>
        <td style="text-align:left;white-space:nowrap">${desg}</td>
        <td>${formatDate(o.date)}</td>
        <td>${o.overtimeHours || ""}</td>
        <td>${normalRate.rs}</td><td>${normalRate.p}</td>
        <td>${otRate.rs}</td><td>${otRate.p}</td>
        <td>${otEarnings.rs}</td><td>${otEarnings.p}</td>
        <td>${o.paidDate ? formatDate(o.paidDate) : (getSalaryPaidDate(o.employeeId, o.date) ? formatDate(getSalaryPaidDate(o.employeeId, o.date)) : "")}</td>
        <td></td>
      </tr>`;
    }).join("");

    printWin.document.write(`<html><head><title>Form XXIII - Register of Overtime</title>
    <style>
      @page { size: landscape; margin: 10mm; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: Arial, sans-serif; font-size: 11px; padding: 10px; }
      .header-title { text-align: left; font-size: 11px; font-weight: bold; margin-bottom: 2px; }
      .header-main { text-align: center; font-size: 16px; font-weight: bold; margin-bottom: 4px; text-decoration: underline; }
      .header-rule { text-align: center; font-size: 9px; margin-bottom: 8px; }
      .info-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 10px; }
      .info-table td { padding: 2px 6px; vertical-align: top; }
      .info-label { font-weight: bold; white-space: nowrap; }
      .info-val { font-weight: normal; }
      .period-label { font-size: 14px; font-weight: bold; }
      table.main { width: 100%; border-collapse: collapse; font-size: 9px; }
      table.main th, table.main td { border: 1px solid #000; padding: 3px 4px; text-align: center; vertical-align: middle; height: 28px; }
      table.main th { background: #f0f0f0; font-weight: bold; font-size: 8px; }
      table.main td { font-size: 9px; }
      .col-num-row th { font-size: 8px; font-weight: normal; font-style: italic; }
      .sub-head { font-size: 7px; font-weight: normal; }
    </style></head><body>
      <div class="header-title">FORM XXIII</div>
      <div class="header-main">REGISTER OF OVERTIME</div>
      <div class="header-rule">[Prescribed Under Rule 78 (2)(a)/78(a)(i) of the West Bengal / Central Contract Labour ( Regulation &amp; Abolition) Rules, 1972/1971]</div>

      <table class="info-table">
        <tr>
          <td class="info-label" style="width:22%">Name and Address of the Contractor</td>
          <td class="info-val" style="width:28%">DJ HOSPITALITY &amp; FACILITY MANAGEMENT PVT LTD<br/>7 Crimatorium Street, Kolkata- 700014</td>
          <td class="info-label" style="width:22%">Name and address of the establishment in /</td>
          <td class="info-val" style="width:28%">${clientName}${clientAddress ? '<br/>' + clientAddress : ''}</td>
        </tr>
        <tr>
          <td></td>
          <td></td>
          <td class="info-label">Under which contract is carried on</td>
          <td></td>
        </tr>
        <tr>
          <td class="info-label">Nature and location of Work</td>
          <td class="info-val">Canteen</td>
          <td class="info-label">Name and address of the Principal Employer</td>
          <td class="info-val">${clientName}${clientAddress ? '<br/>' + clientAddress : ''}</td>
        </tr>
        <tr>
          <td></td>
          <td></td>
          <td></td>
          <td class="info-val">JL No. 284 (Kendua Panchayat) Howrah</td>
        </tr>
        <tr>
          <td></td>
          <td></td>
          <td class="info-label">For The Month of</td>
          <td class="period-label">${period}</td>
        </tr>
      </table>

      <table class="main">
        <thead>
          <tr>
            <th rowspan="2">Serial<br/>No</th>
            <th rowspan="2">Name of the<br/>Workman</th>
            <th rowspan="2">Father's /<br/>Husband's Name</th>
            <th rowspan="2">Sex</th>
            <th rowspan="2">Designation/<br/>Nature of<br/>Employment</th>
            <th rowspan="2">Date on Which<br/>Overtime<br/>Worked</th>
            <th rowspan="2">Total Overtime<br/>Worked or<br/>Production in<br/>case of<br/>Piecerated</th>
            <th colspan="2">Normal Rate of<br/>Wages</th>
            <th colspan="2">Overtime Rate of<br/>Wages</th>
            <th colspan="2">Overtime Earnings</th>
            <th rowspan="2">Date on which<br/>overtime wages<br/>paid</th>
            <th rowspan="2">Remarks</th>
          </tr>
          <tr>
            <th>Rs.</th><th>P.</th>
            <th>Rs.</th><th>P.</th>
            <th>Rs.</th><th>P.</th>
          </tr>
          <tr class="col-num-row">
            <th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th>
            <th colspan="2">8</th><th colspan="2">9</th><th colspan="2">10</th><th>11</th><th>12</th>
          </tr>
        </thead>
        <tbody>
          ${rows || Array.from({length: 8}, () => `<tr>${Array.from({length: 15}, () => '<td style="height:28px">&nbsp;</td>').join('')}</tr>`).join('')}
        </tbody>
      </table>
    </body></html>`);
    printWin.document.close();
    printWin.print();
  };

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-semibold text-muted-foreground" data-testid="text-overtime-title">Form XXIII - Register of Overtime</h3>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handlePrint} data-testid="button-print-overtime" disabled={!filtered.length}>
            <Printer className="w-4 h-4 mr-1" /> Print
          </Button>
          <Button variant="outline" size="sm" onClick={handleGovPrint} data-testid="button-gov-print-overtime">
            <Printer className="w-4 h-4 mr-1" /> Form XXIII
          </Button>
          <Button variant="outline" size="sm" onClick={() => recalcMutation.mutate()} disabled={recalcMutation.isPending} data-testid="button-recalc-overtime">
            {recalcMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />} Recalculate Rates
          </Button>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); setFormData(emptyForm); } }}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openAdd} data-testid="button-add-overtime"><Plus className="w-4 h-4 mr-1" /> Add</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingId ? "Edit Overtime Record" : "Add Overtime Record"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Employee *</Label>
                  <Select value={formData.employeeId} onValueChange={handleEmployeeChange} disabled={!!editingId}>
                    <SelectTrigger data-testid="select-overtime-employee"><SelectValue placeholder="Select employee" /></SelectTrigger>
                    <SelectContent>{employees.map((e: any) => <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Date *</Label>
                  <Input type="date" value={formData.date} onChange={(e) => { const val = e.target.value; setFormData(prev => ({ ...prev, date: val })); if (formData.employeeId) recalcOtRate(formData.employeeId, val); }} data-testid="input-overtime-date" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Normal Hours</Label>
                    <Input inputMode="decimal" placeholder="8" value={formData.normalHours} onChange={(e) => setFormData({ ...formData, normalHours: e.target.value })} data-testid="input-overtime-normal-hours" />
                  </div>
                  <div>
                    <Label>Overtime Hours</Label>
                    <Input inputMode="decimal" placeholder="0" value={formData.overtimeHours} onChange={(e) => updateOvertimeHours(e.target.value)} data-testid="input-overtime-hours" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>OT Rate</Label>
                    <Input inputMode="decimal" placeholder="0.00" value={formData.overtimeRate} onChange={(e) => updateOvertimeRate(e.target.value)} data-testid="input-overtime-rate" />
                  </div>
                  <div>
                    <Label>OT Amount</Label>
                    <Input inputMode="decimal" placeholder="0.00" value={formData.overtimeAmount} readOnly className="bg-muted" data-testid="input-overtime-amount" />
                  </div>
                </div>

                {/* Formula breakdown */}
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-900 space-y-1.5">
                  <div className="font-bold text-amber-800 mb-1">OT Rate Calculation Formula</div>
                  <div className="font-mono text-[11px] bg-amber-100 rounded px-2 py-1 text-amber-900 border border-amber-300 tracking-tight">
                    ROUND(((Basic + Basic×5%) ÷ 4) × OT Hrs, 0)
                  </div>
                  {formulaDailyRate ? (
                    <>
                      <div className="flex items-center justify-between border-t border-amber-200 pt-1">
                        <span className="text-slate-600">Basic Rate</span>
                        <span className="font-mono font-semibold">₹{formulaDailyRate.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Basic + 5% = {formulaDailyRate.toFixed(2)} × 1.05</span>
                        <span className="font-mono font-semibold">₹{(formulaDailyRate * 1.05).toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between border-t border-amber-200 pt-1">
                        <span className="text-slate-600">OT Rate = ÷ 4</span>
                        <span className="font-mono font-semibold text-amber-700">₹{formData.overtimeRate || "0.00"}/hr</span>
                      </div>
                      {formData.overtimeHours && parseFloat(formData.overtimeHours) > 0 && (
                        <div className="flex items-center justify-between border-t border-amber-200 pt-1">
                          <span className="text-slate-600">ROUND({formData.overtimeRate} × {formData.overtimeHours} hrs, 0)</span>
                          <span className="font-mono font-bold text-green-700">₹{formData.overtimeAmount || "0"}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-slate-500 mt-1">
                      Select employee &amp; date to auto-calculate.
                    </div>
                  )}
                </div>

                <div>
                  <Label>Paid Date</Label>
                  <Input type="date" value={formData.paidDate} onChange={(e) => setFormData(prev => ({ ...prev, paidDate: e.target.value }))} data-testid="input-overtime-paid-date" />
                </div>
                <Button className="w-full" onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-overtime">
                  {(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} {editingId ? "Update Overtime" : "Save Overtime"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {!filtered.length ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">No overtime records{filterMonth && filterMonth !== "all" ? " for this month" : ""}</CardContent></Card>
      ) : (
        <>
          <div className="hidden md:block">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-3 py-2.5 text-left text-xs font-semibold">#</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold">Employee</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold">Date</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold">Normal Hrs</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold">OT Hrs</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold">OT Rate</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold">OT Amount</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold">Paid Date</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((o: any, i: number) => (
                        <tr key={o.id} className="border-b last:border-0" data-testid={`row-overtime-${o.id}`}>
                          <td className="px-3 py-2.5">{i + 1}</td>
                          <td className="px-3 py-2.5 font-medium">{empMap.get(o.employeeId) || o.employeeId}</td>
                          <td className="px-3 py-2.5">{fmtDate(o.date)}</td>
                          <td className="px-3 py-2.5 text-right">{o.normalHours || "-"}</td>
                          <td className="px-3 py-2.5 text-right">{o.overtimeHours || "-"}</td>
                          <td className="px-3 py-2.5 text-right font-mono">{o.overtimeRate ? fmt(o.overtimeRate) : "-"}</td>
                          <td className="px-3 py-2.5 text-right font-mono">{o.overtimeAmount ? fmt(o.overtimeAmount) : "-"}</td>
                          <td className="px-3 py-2.5">{fmtDate(o.paidDate || getSalaryPaidDate(o.employeeId, o.date))}</td>
                          <td className="px-3 py-2.5 text-right">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(o)} data-testid={`button-edit-overtime-${o.id}`}><Pencil className="w-4 h-4" /></Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" data-testid={`button-delete-overtime-${o.id}`}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Delete Overtime Record?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteMutation.mutate(o.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="md:hidden space-y-3">
            {filtered.map((o: any) => (
              <Card key={o.id} data-testid={`card-overtime-${o.id}`}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">{empMap.get(o.employeeId) || o.employeeId}</p>
                      <p className="text-xs text-muted-foreground">{fmtDate(o.date)}</p>
                    </div>
                    {o.overtimeAmount && <Badge variant="secondary" className="font-mono">{fmt(o.overtimeAmount)}</Badge>}
                  </div>
                  <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
                    {o.normalHours && <span>Normal: {o.normalHours}h</span>}
                    {o.overtimeHours && <span>OT: {o.overtimeHours}h</span>}
                    {o.overtimeRate && <span>Rate: {fmt(o.overtimeRate)}</span>}
                    {(o.paidDate || getSalaryPaidDate(o.employeeId, o.date)) && <span>Paid: {fmtDate(o.paidDate || getSalaryPaidDate(o.employeeId, o.date))}</span>}
                  </div>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(o)} data-testid={`button-edit-overtime-mobile-${o.id}`}><Pencil className="w-4 h-4" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid={`button-delete-overtime-mobile-${o.id}`}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Delete Overtime Record?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteMutation.mutate(o.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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

function DamageTab({ clientName, clientAddress, employees, empMap, filterMonth, filterYear }: { clientName: string; clientAddress: string; employees: any[]; empMap: Map<number, string>; filterMonth: string; filterYear: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ employeeId: "", date: "", amount: "", description: "" });
  const emptyForm = { employeeId: "", date: "", amount: "", description: "" };

  const { data: deductions, isLoading } = useQuery({
    queryKey: ["/api/damage-deductions", clientName],
    queryFn: async () => {
      const res = await fetch(`/api/damage-deductions?clientName=${encodeURIComponent(clientName)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch damage deductions");
      return res.json() as Promise<any[]>;
    },
    enabled: !!clientName,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => { const res = await apiRequest("POST", "/api/damage-deductions", data); return res.json(); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/damage-deductions", clientName] });
      setOpen(false); setEditingId(null); setFormData(emptyForm);
      toast({ title: "Damage deduction added successfully" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PUT", `/api/damage-deductions/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/damage-deductions", clientName] });
      setOpen(false); setEditingId(null); setFormData(emptyForm);
      toast({ title: "Damage deduction updated successfully" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/damage-deductions/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/damage-deductions", clientName] });
      toast({ title: "Damage deduction deleted" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const openEdit = (record: any) => {
    setEditingId(record.id);
    setFormData({
      employeeId: String(record.employeeId),
      date: record.date?.split("T")[0] || record.date || "",
      amount: record.amount || "",
      description: record.description || "",
    });
    setOpen(true);
  };

  const openAdd = () => {
    setEditingId(null); setFormData(emptyForm); setOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.employeeId || !formData.date || !formData.amount) {
      toast({ title: "Please fill required fields", variant: "destructive" });
      return;
    }
    const payload = {
      employeeId: Number(formData.employeeId),
      clientName,
      date: formData.date,
      amount: formData.amount,
      description: formData.description,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const filtered = useMemo(() => filterByMonth(deductions, filterMonth, filterYear), [deductions, filterMonth, filterYear]);

  const handlePrint = () => {
    const printWin = window.open("", "_blank");
    if (!printWin) return;
    const rows = filtered.map((d: any, i: number) => `
      <tr><td>${i + 1}</td><td>${empMap.get(d.employeeId) || d.employeeId}</td><td>${d.date?.split("T")[0] || d.date}</td><td>${fmt(d.amount)}</td><td>${d.description || ""}</td></tr>
    `).join("");
    const period = filterMonth && filterMonth !== "all" && filterYear ? ` - ${MONTHS[parseInt(filterMonth) - 1]} ${filterYear}` : filterYear ? ` - ${filterYear}` : "";
    printWin.document.write(`<html><head><title>Form XX - Damage/Loss</title><style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px 10px;text-align:left;font-size:13px}th{background:#f5f5f5}</style></head><body>
      <h2>Register of Damage/Loss Deductions (Form XX) - ${clientName}${period}</h2>
      <table><thead><tr><th>#</th><th>Employee</th><th>Date</th><th>Amount</th><th>Description</th></tr></thead><tbody>${rows}</tbody></table>
    </body></html>`);
    printWin.document.close();
    printWin.print();
  };

  const handleGovPrint = () => {
    const printWin = window.open("", "_blank");
    if (!printWin) return;

    const empFullMap = new Map<number, any>();
    employees.forEach((e: any) => empFullMap.set(e.id, e));

    const period = filterMonth && filterMonth !== "all" && filterYear ? `${MONTHS[parseInt(filterMonth) - 1]} ${filterYear}` : filterYear ? filterYear : "";

    const formatDate = (d: string) => {
      if (!d) return "";
      const dt = new Date(d);
      const dd = String(dt.getDate()).padStart(2, "0");
      const mm = String(dt.getMonth() + 1).padStart(2, "0");
      return `${dd}-${mm}-${dt.getFullYear()}`;
    };

    const rows = filtered.map((d: any, i: number) => {
      const emp = empFullMap.get(d.employeeId);
      return `<tr>
        <td>${i + 1}</td>
        <td style="text-align:left;white-space:nowrap">${emp?.name || ""}</td>
        <td style="text-align:left;white-space:nowrap">${emp?.fatherName || ""}</td>
        <td style="text-align:left;white-space:nowrap">${emp?.designation || ""}</td>
        <td style="text-align:left">${d.description || ""}</td>
        <td>${formatDate(d.date)}</td>
        <td></td>
        <td></td>
        <td style="text-align:right">${fmt(d.amount)}</td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
      </tr>`;
    }).join("");

    const monthNum = filterMonth && filterMonth !== "all" ? parseInt(filterMonth) : null;
    const periodDisplay = monthNum && filterYear ? `${MONTHS[monthNum - 1]} ${filterYear} (${monthNum})` : period;

    printWin.document.write(`<html><head><title>Form XX - Register of Deductions for Damage or Loss</title>
    <style>
      @page { size: landscape; margin: 10mm; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: Arial, sans-serif; font-size: 10px; padding: 10px; }
      .header-title { text-align: left; font-size: 11px; font-weight: bold; margin-bottom: 2px; }
      .header-main { text-align: center; font-size: 16px; font-weight: bold; margin-bottom: 2px; }
      .header-rule { text-align: center; font-size: 9px; margin-bottom: 8px; }
      .info-table { width: 100%; border-collapse: collapse; margin-bottom: 6px; font-size: 10px; }
      .info-table td { padding: 2px 6px; vertical-align: top; }
      .info-label { font-weight: bold; white-space: nowrap; }
      .period-label { font-size: 14px; font-weight: bold; }
      table.main { width: 100%; border-collapse: collapse; font-size: 9px; table-layout: auto; }
      table.main th, table.main td { border: 1px solid #000; padding: 4px 6px; text-align: center; vertical-align: middle; height: 28px; }
      table.main th { background: #f0f0f0; font-weight: bold; font-size: 8px; }
      table.main td { font-size: 9px; }
      .col-num-row th { font-size: 8px; font-weight: normal; font-style: italic; }
    </style></head><body>
      <div class="header-title">FORM XX</div>
      <div class="header-main">Register of Deductions for Damage or Loss</div>
      <div class="header-rule">See Rule 78(1)(a)(ii)</div>

      <table class="info-table">
        <tr>
          <td class="info-label" style="width:22%">Name and Address of the Contractor</td>
          <td style="width:28%">DJ HOSPITALITY &amp; FACILITY MANAGEMENT PVT LTD</td>
          <td class="info-label" style="width:22%">Name and address of the establishment in /</td>
          <td style="width:28%">${clientName}${clientAddress ? '<br/>' + clientAddress : ''}</td>
        </tr>
        <tr>
          <td></td>
          <td>7 Crimatorium Street, Kolkata- 700014</td>
          <td class="info-label">Under which contract is carried on</td>
          <td></td>
        </tr>
        <tr>
          <td class="info-label">Nature and location of Work</td>
          <td>Canteen</td>
          <td class="info-label">Name and address of the Principal Employer</td>
          <td>${clientName}${clientAddress ? '<br/>' + clientAddress : ''}</td>
        </tr>
        <tr>
          <td></td>
          <td></td>
          <td></td>
          <td>JL No. 284 (Kendua Panchayat) Howrah</td>
        </tr>
        <tr>
          <td></td>
          <td></td>
          <td class="info-label">For The Month of</td>
          <td class="period-label">${periodDisplay}</td>
        </tr>
      </table>

      <table class="main">
        <thead>
          <tr>
            <th rowspan="2">Sl. No.</th>
            <th rowspan="2">Name of<br/>workman</th>
            <th rowspan="2">Father's /<br/>husband's name</th>
            <th rowspan="2">Designation /<br/>Nature of<br/>employment</th>
            <th rowspan="2">Particulars of<br/>damage or loss</th>
            <th rowspan="2">Date of Damage<br/>or loss</th>
            <th rowspan="2">Whether workman<br/>showed cause<br/>against deduction</th>
            <th rowspan="2">Name of person in whose<br/>presence employee's<br/>explanation was heard</th>
            <th rowspan="2">Amount of<br/>deduction<br/>imposed</th>
            <th rowspan="2">No. of<br/>instalments</th>
            <th colspan="2">Date of recovery</th>
            <th rowspan="2">Remarks</th>
          </tr>
          <tr>
            <th>First instalment</th>
            <th>Last<br/>Instalment</th>
          </tr>
          <tr class="col-num-row">
            <th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th>
            <th>7</th><th>8</th><th>9</th><th>10</th><th>11</th><th>12</th><th>13</th>
          </tr>
        </thead>
        <tbody>
          ${rows || Array.from({length: 8}, () => `<tr>${Array.from({length: 13}, () => '<td style="height:28px">&nbsp;</td>').join('')}</tr>`).join('')}
        </tbody>
      </table>
    </body></html>`);
    printWin.document.close();
    printWin.print();
  };

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-semibold text-muted-foreground" data-testid="text-damage-title">Form XX - Register of Damage/Loss Deductions</h3>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handlePrint} data-testid="button-print-damage" disabled={!filtered.length}>
            <Printer className="w-4 h-4 mr-1" /> Print
          </Button>
          <Button variant="outline" size="sm" onClick={handleGovPrint} data-testid="button-gov-print-damage">
            <Printer className="w-4 h-4 mr-1" /> Form XX
          </Button>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); setFormData(emptyForm); } }}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openAdd} data-testid="button-add-damage"><Plus className="w-4 h-4 mr-1" /> Add</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingId ? "Edit Damage/Loss Deduction" : "Add Damage/Loss Deduction"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Employee *</Label>
                  <Select value={formData.employeeId} onValueChange={(v) => setFormData({ ...formData, employeeId: v })} disabled={!!editingId}>
                    <SelectTrigger data-testid="select-damage-employee"><SelectValue placeholder="Select employee" /></SelectTrigger>
                    <SelectContent>{employees.map((e: any) => <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Date *</Label>
                  <Input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} data-testid="input-damage-date" />
                </div>
                <div>
                  <Label>Amount *</Label>
                  <Input inputMode="decimal" placeholder="0.00" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} data-testid="input-damage-amount" />
                </div>
                <div>
                  <Label>Description</Label>
                  <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} data-testid="input-damage-description" />
                </div>
                <Button className="w-full" onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-damage">
                  {(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} {editingId ? "Update Deduction" : "Save Deduction"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {!filtered.length ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">No damage/loss deductions recorded{filterMonth && filterMonth !== "all" ? " for this month" : ""}</CardContent></Card>
      ) : (
        <>
          <div className="hidden md:block">
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2.5 text-left text-xs font-semibold">#</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold">Employee</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold">Date</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold">Amount</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold">Description</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((d: any, i: number) => (
                      <tr key={d.id} className="border-b last:border-0" data-testid={`row-damage-${d.id}`}>
                        <td className="px-3 py-2.5">{i + 1}</td>
                        <td className="px-3 py-2.5 font-medium">{empMap.get(d.employeeId) || d.employeeId}</td>
                        <td className="px-3 py-2.5">{fmtDate(d.date)}</td>
                        <td className="px-3 py-2.5 text-right font-mono">{fmt(d.amount)}</td>
                        <td className="px-3 py-2.5">{d.description || "-"}</td>
                        <td className="px-3 py-2.5 text-right">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(d)} data-testid={`button-edit-damage-${d.id}`}><Pencil className="w-4 h-4" /></Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" data-testid={`button-delete-damage-${d.id}`}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>Delete Deduction?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteMutation.mutate(d.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
          <div className="md:hidden space-y-3">
            {filtered.map((d: any) => (
              <Card key={d.id} data-testid={`card-damage-${d.id}`}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">{empMap.get(d.employeeId) || d.employeeId}</p>
                      <p className="text-xs text-muted-foreground">{fmtDate(d.date)}</p>
                    </div>
                    <Badge variant="secondary" className="font-mono">{fmt(d.amount)}</Badge>
                  </div>
                  {d.description && <p className="text-xs text-muted-foreground">Description: {d.description}</p>}
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(d)} data-testid={`button-edit-damage-mobile-${d.id}`}><Pencil className="w-4 h-4" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid={`button-delete-damage-mobile-${d.id}`}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Delete Deduction?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteMutation.mutate(d.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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

export default function RegistersPage() {
  const now = new Date();
  const [selectedClient, setSelectedClient] = useState("");
  const [filterMonth, setFilterMonth] = useState(String(now.getMonth() + 1));
  const [filterYear, setFilterYear] = useState(String(now.getFullYear()));
  const { data: clients } = useClientNames();

  const clientNames = useMemo(() => {
    if (!clients) return [];
    return clients.map((c: any) => (typeof c === "string" ? c : c.name));
  }, [clients]);

  const clientAddress = useMemo(() => {
    const c = clients?.find((cl: any) => cl.name === selectedClient);
    return c?.address || "";
  }, [clients, selectedClient]);

  const { data: employees } = useEmployees(selectedClient);

  const empMap = useMemo(() => {
    const map = new Map<number, string>();
    if (employees) {
      employees.forEach((e: any) => map.set(e.id, e.name));
    }
    return map;
  }, [employees]);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight" data-testid="text-registers-title">
              Registers (Form XX-XXIII)
            </h1>
            <p className="text-muted-foreground mt-1 text-xs sm:text-sm">Fines, Advances, Overtime & Damage/Loss Deductions</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1 block">Client Name</Label>
            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger data-testid="select-client-name">
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                {clientNames.map((name: string) => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1 block">Month</Label>
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger data-testid="select-filter-month">
                <SelectValue placeholder="All Months" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Months</SelectItem>
                {MONTHS.map((m, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1 block">Year</Label>
            <Input
              type="number"
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              min={2020}
              max={2099}
              data-testid="input-filter-year"
            />
          </div>
          <div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => { setFilterMonth("all"); setFilterYear(""); }}
              data-testid="button-clear-filter"
            >
              Clear Filter
            </Button>
          </div>
        </div>

        {!selectedClient ? (
          <Card>
            <CardContent className="py-16 text-center">
              <p className="text-muted-foreground text-sm">Please select a client to view registers</p>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="fines" className="space-y-4">
            <div className="overflow-x-auto -mx-1 px-1 pb-1">
              <TabsList className="inline-flex w-auto min-w-full sm:grid sm:w-full sm:grid-cols-4 h-auto rounded-xl p-1" data-testid="tabs-registers">
                <TabsTrigger value="fines" className="text-xs sm:text-sm py-2 px-2 sm:px-3 whitespace-nowrap rounded-lg gap-1" data-testid="tab-fines">
                  <Gavel className="w-3.5 h-3.5 shrink-0" />
                  <span>Fines</span>
                </TabsTrigger>
                <TabsTrigger value="advances" className="text-xs sm:text-sm py-2 px-2 sm:px-3 whitespace-nowrap rounded-lg gap-1" data-testid="tab-advances">
                  <Banknote className="w-3.5 h-3.5 shrink-0" />
                  <span>Advances</span>
                </TabsTrigger>
                <TabsTrigger value="overtime" className="text-xs sm:text-sm py-2 px-2 sm:px-3 whitespace-nowrap rounded-lg gap-1" data-testid="tab-overtime">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>Overtime</span>
                </TabsTrigger>
                <TabsTrigger value="damage" className="text-xs sm:text-sm py-2 px-2 sm:px-3 whitespace-nowrap rounded-lg gap-1" data-testid="tab-damage">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Damage/Loss</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="fines">
              <FinesTab clientName={selectedClient} clientAddress={clientAddress} employees={employees || []} empMap={empMap} filterMonth={filterMonth} filterYear={filterYear} />
            </TabsContent>
            <TabsContent value="advances">
              <AdvancesTab clientName={selectedClient} clientAddress={clientAddress} employees={employees || []} empMap={empMap} filterMonth={filterMonth} filterYear={filterYear} />
            </TabsContent>
            <TabsContent value="overtime">
              <OvertimeTab clientName={selectedClient} clientAddress={clientAddress} employees={employees || []} empMap={empMap} filterMonth={filterMonth} filterYear={filterYear} />
            </TabsContent>
            <TabsContent value="damage">
              <DamageTab clientName={selectedClient} clientAddress={clientAddress} employees={employees || []} empMap={empMap} filterMonth={filterMonth} filterYear={filterYear} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </Layout>
  );
}
