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
import { Plus, Trash2, Printer, Loader2, Gavel, Banknote, Clock, AlertTriangle } from "lucide-react";

const fmt = (n: number) =>
  "\u20B9" + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

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

function FinesTab({ clientName, employees, empMap }: { clientName: string; employees: any[]; empMap: Map<number, string> }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({ employeeId: "", date: "", amount: "", reason: "", realized: "" });

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
      setOpen(false);
      setFormData({ employeeId: "", date: "", amount: "", reason: "", realized: "" });
      toast({ title: "Fine added successfully" });
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

  const handleSubmit = () => {
    if (!formData.employeeId || !formData.date || !formData.amount) {
      toast({ title: "Please fill required fields", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      employeeId: Number(formData.employeeId),
      clientName,
      date: formData.date,
      amount: formData.amount,
      reason: formData.reason,
      realized: formData.realized,
    });
  };

  const handlePrint = () => {
    const printWin = window.open("", "_blank");
    if (!printWin) return;
    const rows = (fines || []).map((f: any, i: number) => `
      <tr><td>${i + 1}</td><td>${empMap.get(f.employeeId) || f.employeeId}</td><td>${f.date}</td><td>${fmt(f.amount)}</td><td>${f.reason || ""}</td><td>${f.realized || ""}</td></tr>
    `).join("");
    printWin.document.write(`<html><head><title>Form XXI - Fines</title><style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px 10px;text-align:left;font-size:13px}th{background:#f5f5f5}</style></head><body>
      <h2>Register of Fines (Form XXI) - ${clientName}</h2>
      <table><thead><tr><th>#</th><th>Employee</th><th>Date</th><th>Amount</th><th>Reason</th><th>Realized</th></tr></thead><tbody>${rows}</tbody></table>
    </body></html>`);
    printWin.document.close();
    printWin.print();
  };

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-semibold text-muted-foreground" data-testid="text-fines-title">Form XXI - Register of Fines</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} data-testid="button-print-fines" disabled={!fines?.length}>
            <Printer className="w-4 h-4 mr-1" /> Print
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-add-fine"><Plus className="w-4 h-4 mr-1" /> Add Fine</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Fine</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Employee *</Label>
                  <Select value={formData.employeeId} onValueChange={(v) => setFormData({ ...formData, employeeId: v })}>
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
                <Button className="w-full" onClick={handleSubmit} disabled={createMutation.isPending} data-testid="button-submit-fine">
                  {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Save Fine
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {!fines?.length ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">No fines recorded</CardContent></Card>
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
                    {fines.map((f: any, i: number) => (
                      <tr key={f.id} className="border-b last:border-0" data-testid={`row-fine-${f.id}`}>
                        <td className="px-3 py-2.5">{i + 1}</td>
                        <td className="px-3 py-2.5 font-medium">{empMap.get(f.employeeId) || f.employeeId}</td>
                        <td className="px-3 py-2.5">{f.date}</td>
                        <td className="px-3 py-2.5 text-right font-mono">{fmt(f.amount)}</td>
                        <td className="px-3 py-2.5">{f.reason || "-"}</td>
                        <td className="px-3 py-2.5">{f.realized || "-"}</td>
                        <td className="px-3 py-2.5 text-right">
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
            {fines.map((f: any, i: number) => (
              <Card key={f.id} data-testid={`card-fine-${f.id}`}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">{empMap.get(f.employeeId) || f.employeeId}</p>
                      <p className="text-xs text-muted-foreground">{f.date}</p>
                    </div>
                    <Badge variant="secondary" className="font-mono">{fmt(f.amount)}</Badge>
                  </div>
                  {f.reason && <p className="text-xs text-muted-foreground">Reason: {f.reason}</p>}
                  {f.realized && <p className="text-xs text-muted-foreground">Realized: {f.realized}</p>}
                  <div className="flex justify-end">
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

function AdvancesTab({ clientName, employees, empMap }: { clientName: string; employees: any[]; empMap: Map<number, string> }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({ employeeId: "", date: "", amount: "", purpose: "", installments: "", recoveredAmount: "" });

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
      setOpen(false);
      setFormData({ employeeId: "", date: "", amount: "", purpose: "", installments: "", recoveredAmount: "" });
      toast({ title: "Advance added successfully" });
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

  const handleSubmit = () => {
    if (!formData.employeeId || !formData.date || !formData.amount) {
      toast({ title: "Please fill required fields", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      employeeId: Number(formData.employeeId),
      clientName,
      date: formData.date,
      amount: formData.amount,
      purpose: formData.purpose,
      installments: formData.installments ? Number(formData.installments) : undefined,
      recoveredAmount: formData.recoveredAmount || undefined,
    });
  };

  const handlePrint = () => {
    const printWin = window.open("", "_blank");
    if (!printWin) return;
    const rows = (advances || []).map((a: any, i: number) => `
      <tr><td>${i + 1}</td><td>${empMap.get(a.employeeId) || a.employeeId}</td><td>${a.date}</td><td>${fmt(a.amount)}</td><td>${a.purpose || ""}</td><td>${a.installments || ""}</td><td>${a.recoveredAmount ? fmt(a.recoveredAmount) : ""}</td></tr>
    `).join("");
    printWin.document.write(`<html><head><title>Form XXII - Advances</title><style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px 10px;text-align:left;font-size:13px}th{background:#f5f5f5}</style></head><body>
      <h2>Register of Advances (Form XXII) - ${clientName}</h2>
      <table><thead><tr><th>#</th><th>Employee</th><th>Date</th><th>Amount</th><th>Purpose</th><th>Installments</th><th>Recovered</th></tr></thead><tbody>${rows}</tbody></table>
    </body></html>`);
    printWin.document.close();
    printWin.print();
  };

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-semibold text-muted-foreground" data-testid="text-advances-title">Form XXII - Register of Advances</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} data-testid="button-print-advances" disabled={!advances?.length}>
            <Printer className="w-4 h-4 mr-1" /> Print
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-add-advance"><Plus className="w-4 h-4 mr-1" /> Add Advance</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Advance</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Employee *</Label>
                  <Select value={formData.employeeId} onValueChange={(v) => setFormData({ ...formData, employeeId: v })}>
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
                <Button className="w-full" onClick={handleSubmit} disabled={createMutation.isPending} data-testid="button-submit-advance">
                  {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Save Advance
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {!advances?.length ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">No advances recorded</CardContent></Card>
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
                    {advances.map((a: any, i: number) => (
                      <tr key={a.id} className="border-b last:border-0" data-testid={`row-advance-${a.id}`}>
                        <td className="px-3 py-2.5">{i + 1}</td>
                        <td className="px-3 py-2.5 font-medium">{empMap.get(a.employeeId) || a.employeeId}</td>
                        <td className="px-3 py-2.5">{a.date}</td>
                        <td className="px-3 py-2.5 text-right font-mono">{fmt(a.amount)}</td>
                        <td className="px-3 py-2.5">{a.purpose || "-"}</td>
                        <td className="px-3 py-2.5 text-right">{a.installments || "-"}</td>
                        <td className="px-3 py-2.5 text-right font-mono">{a.recoveredAmount ? fmt(a.recoveredAmount) : "-"}</td>
                        <td className="px-3 py-2.5 text-right">
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
            {advances.map((a: any) => (
              <Card key={a.id} data-testid={`card-advance-${a.id}`}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">{empMap.get(a.employeeId) || a.employeeId}</p>
                      <p className="text-xs text-muted-foreground">{a.date}</p>
                    </div>
                    <Badge variant="secondary" className="font-mono">{fmt(a.amount)}</Badge>
                  </div>
                  {a.purpose && <p className="text-xs text-muted-foreground">Purpose: {a.purpose}</p>}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      {a.installments && <span>Installments: {a.installments}</span>}
                      {a.recoveredAmount && <span>Recovered: {fmt(a.recoveredAmount)}</span>}
                    </div>
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
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function OvertimeTab({ clientName, employees, empMap }: { clientName: string; employees: any[]; empMap: Map<number, string> }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({ employeeId: "", date: "", normalHours: "", overtimeHours: "", overtimeRate: "", overtimeAmount: "" });

  const { data: overtime, isLoading } = useQuery({
    queryKey: ["/api/overtime", clientName],
    queryFn: async () => {
      const res = await fetch(`/api/overtime?clientName=${encodeURIComponent(clientName)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch overtime");
      return res.json() as Promise<any[]>;
    },
    enabled: !!clientName,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => { const res = await apiRequest("POST", "/api/overtime", data); return res.json(); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/overtime", clientName] });
      setOpen(false);
      setFormData({ employeeId: "", date: "", normalHours: "", overtimeHours: "", overtimeRate: "", overtimeAmount: "" });
      toast({ title: "Overtime record added successfully" });
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

  const calcOtAmount = (hours: string, rate: string) => {
    const h = parseFloat(hours) || 0;
    const r = parseFloat(rate) || 0;
    return h && r ? (h * r).toFixed(2) : "";
  };

  const updateOvertimeHours = (val: string) => {
    setFormData(prev => ({ ...prev, overtimeHours: val, overtimeAmount: calcOtAmount(val, prev.overtimeRate) }));
  };

  const updateOvertimeRate = (val: string) => {
    setFormData(prev => ({ ...prev, overtimeRate: val, overtimeAmount: calcOtAmount(prev.overtimeHours, val) }));
  };

  const handleSubmit = () => {
    if (!formData.employeeId || !formData.date) {
      toast({ title: "Please fill required fields", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      employeeId: Number(formData.employeeId),
      clientName,
      date: formData.date,
      normalHours: formData.normalHours ? Number(formData.normalHours) : undefined,
      overtimeHours: formData.overtimeHours ? Number(formData.overtimeHours) : undefined,
      overtimeRate: formData.overtimeRate || undefined,
      overtimeAmount: formData.overtimeAmount || undefined,
    });
  };

  const handlePrint = () => {
    const printWin = window.open("", "_blank");
    if (!printWin) return;
    const rows = (overtime || []).map((o: any, i: number) => `
      <tr><td>${i + 1}</td><td>${empMap.get(o.employeeId) || o.employeeId}</td><td>${o.date}</td><td>${o.normalHours || ""}</td><td>${o.overtimeHours || ""}</td><td>${o.overtimeRate ? fmt(o.overtimeRate) : ""}</td><td>${o.overtimeAmount ? fmt(o.overtimeAmount) : ""}</td></tr>
    `).join("");
    printWin.document.write(`<html><head><title>Form XXIII - Overtime</title><style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px 10px;text-align:left;font-size:13px}th{background:#f5f5f5}</style></head><body>
      <h2>Register of Overtime (Form XXIII) - ${clientName}</h2>
      <table><thead><tr><th>#</th><th>Employee</th><th>Date</th><th>Normal Hrs</th><th>OT Hrs</th><th>OT Rate</th><th>OT Amount</th></tr></thead><tbody>${rows}</tbody></table>
    </body></html>`);
    printWin.document.close();
    printWin.print();
  };

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-semibold text-muted-foreground" data-testid="text-overtime-title">Form XXIII - Register of Overtime</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} data-testid="button-print-overtime" disabled={!overtime?.length}>
            <Printer className="w-4 h-4 mr-1" /> Print
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-add-overtime"><Plus className="w-4 h-4 mr-1" /> Add Overtime</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Overtime Record</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Employee *</Label>
                  <Select value={formData.employeeId} onValueChange={(v) => setFormData({ ...formData, employeeId: v })}>
                    <SelectTrigger data-testid="select-overtime-employee"><SelectValue placeholder="Select employee" /></SelectTrigger>
                    <SelectContent>{employees.map((e: any) => <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Date *</Label>
                  <Input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} data-testid="input-overtime-date" />
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
                <Button className="w-full" onClick={handleSubmit} disabled={createMutation.isPending} data-testid="button-submit-overtime">
                  {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Save Overtime
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {!overtime?.length ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">No overtime records</CardContent></Card>
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
                        <th className="px-3 py-2.5 text-right text-xs font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overtime.map((o: any, i: number) => (
                        <tr key={o.id} className="border-b last:border-0" data-testid={`row-overtime-${o.id}`}>
                          <td className="px-3 py-2.5">{i + 1}</td>
                          <td className="px-3 py-2.5 font-medium">{empMap.get(o.employeeId) || o.employeeId}</td>
                          <td className="px-3 py-2.5">{o.date}</td>
                          <td className="px-3 py-2.5 text-right">{o.normalHours || "-"}</td>
                          <td className="px-3 py-2.5 text-right">{o.overtimeHours || "-"}</td>
                          <td className="px-3 py-2.5 text-right font-mono">{o.overtimeRate ? fmt(o.overtimeRate) : "-"}</td>
                          <td className="px-3 py-2.5 text-right font-mono">{o.overtimeAmount ? fmt(o.overtimeAmount) : "-"}</td>
                          <td className="px-3 py-2.5 text-right">
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
            {overtime.map((o: any) => (
              <Card key={o.id} data-testid={`card-overtime-${o.id}`}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">{empMap.get(o.employeeId) || o.employeeId}</p>
                      <p className="text-xs text-muted-foreground">{o.date}</p>
                    </div>
                    {o.overtimeAmount && <Badge variant="secondary" className="font-mono">{fmt(o.overtimeAmount)}</Badge>}
                  </div>
                  <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
                    {o.normalHours && <span>Normal: {o.normalHours}h</span>}
                    {o.overtimeHours && <span>OT: {o.overtimeHours}h</span>}
                    {o.overtimeRate && <span>Rate: {fmt(o.overtimeRate)}</span>}
                  </div>
                  <div className="flex justify-end">
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

function DamageTab({ clientName, employees, empMap }: { clientName: string; employees: any[]; empMap: Map<number, string> }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({ employeeId: "", date: "", amount: "", description: "" });

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
      setOpen(false);
      setFormData({ employeeId: "", date: "", amount: "", description: "" });
      toast({ title: "Damage deduction added successfully" });
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

  const handleSubmit = () => {
    if (!formData.employeeId || !formData.date || !formData.amount) {
      toast({ title: "Please fill required fields", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      employeeId: Number(formData.employeeId),
      clientName,
      date: formData.date,
      amount: formData.amount,
      description: formData.description,
    });
  };

  const handlePrint = () => {
    const printWin = window.open("", "_blank");
    if (!printWin) return;
    const rows = (deductions || []).map((d: any, i: number) => `
      <tr><td>${i + 1}</td><td>${empMap.get(d.employeeId) || d.employeeId}</td><td>${d.date}</td><td>${fmt(d.amount)}</td><td>${d.description || ""}</td></tr>
    `).join("");
    printWin.document.write(`<html><head><title>Form XX - Damage/Loss</title><style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px 10px;text-align:left;font-size:13px}th{background:#f5f5f5}</style></head><body>
      <h2>Register of Damage/Loss Deductions (Form XX) - ${clientName}</h2>
      <table><thead><tr><th>#</th><th>Employee</th><th>Date</th><th>Amount</th><th>Description</th></tr></thead><tbody>${rows}</tbody></table>
    </body></html>`);
    printWin.document.close();
    printWin.print();
  };

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-semibold text-muted-foreground" data-testid="text-damage-title">Form XX - Register of Damage/Loss Deductions</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} data-testid="button-print-damage" disabled={!deductions?.length}>
            <Printer className="w-4 h-4 mr-1" /> Print
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-add-damage"><Plus className="w-4 h-4 mr-1" /> Add Deduction</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Damage/Loss Deduction</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Employee *</Label>
                  <Select value={formData.employeeId} onValueChange={(v) => setFormData({ ...formData, employeeId: v })}>
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
                <Button className="w-full" onClick={handleSubmit} disabled={createMutation.isPending} data-testid="button-submit-damage">
                  {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Save Deduction
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {!deductions?.length ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">No damage/loss deductions recorded</CardContent></Card>
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
                    {deductions.map((d: any, i: number) => (
                      <tr key={d.id} className="border-b last:border-0" data-testid={`row-damage-${d.id}`}>
                        <td className="px-3 py-2.5">{i + 1}</td>
                        <td className="px-3 py-2.5 font-medium">{empMap.get(d.employeeId) || d.employeeId}</td>
                        <td className="px-3 py-2.5">{d.date}</td>
                        <td className="px-3 py-2.5 text-right font-mono">{fmt(d.amount)}</td>
                        <td className="px-3 py-2.5">{d.description || "-"}</td>
                        <td className="px-3 py-2.5 text-right">
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
            {deductions.map((d: any) => (
              <Card key={d.id} data-testid={`card-damage-${d.id}`}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">{empMap.get(d.employeeId) || d.employeeId}</p>
                      <p className="text-xs text-muted-foreground">{d.date}</p>
                    </div>
                    <Badge variant="secondary" className="font-mono">{fmt(d.amount)}</Badge>
                  </div>
                  {d.description && <p className="text-xs text-muted-foreground">Description: {d.description}</p>}
                  <div className="flex justify-end">
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
  const [selectedClient, setSelectedClient] = useState("");
  const { data: clients } = useClientNames();

  const clientNames = useMemo(() => {
    if (!clients) return [];
    return clients.map((c: any) => (typeof c === "string" ? c : c.name));
  }, [clients]);

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

        <div className="max-w-xs">
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
              <FinesTab clientName={selectedClient} employees={employees || []} empMap={empMap} />
            </TabsContent>
            <TabsContent value="advances">
              <AdvancesTab clientName={selectedClient} employees={employees || []} empMap={empMap} />
            </TabsContent>
            <TabsContent value="overtime">
              <OvertimeTab clientName={selectedClient} employees={employees || []} empMap={empMap} />
            </TabsContent>
            <TabsContent value="damage">
              <DamageTab clientName={selectedClient} employees={employees || []} empMap={empMap} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </Layout>
  );
}
