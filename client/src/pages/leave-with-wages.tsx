import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useClientNames, useCurrentUser } from "@/hooks/use-reports";
import { ArrowLeft, Plus, Printer, Trash2, Pencil, Loader2, FileText, Building2, Users, RefreshCw } from "lucide-react";
import { Link } from "wouter";
import type { Employee, LeaveWithWages } from "@shared/schema";

export default function LeaveWithWagesPage() {
  const { toast } = useToast();
  const { data: user } = useCurrentUser();
  const isAdmin = user?.role === "admin";
  const { data: clientNames = [] } = useClientNames();
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<LeaveWithWages | null>(null);

  const [formData, setFormData] = useState({
    calendarYear: new Date().getFullYear(),
    daysLeaveEarned: "0",
    daysLeaveBroughtForward: "0",
    layOffDays: "0",
    maternityLeaveDays: "0",
    leaveEarned: "0",
    leaveEnjoyed: "0",
    otherAbsenceDays: "0",
    actualDaysWorked: "0",
    leaveAllowedDate: "NA",
    leaveAllowedDays: "NA",
    rateOfWagesRs: "0",
    rateOfWagesP: "0",
    amountOfWagesRs: "0",
    amountOfWagesP: "0",
    dateOfPayment: "",
    remarks: "",
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees", selectedClient],
    queryFn: () => fetch(`/api/employees?clientName=${encodeURIComponent(selectedClient)}`).then(r => r.json()),
    enabled: !!selectedClient,
  });

  const selectedEmployee = employees.find(e => String(e.id) === selectedEmployeeId);

  const { data: leaveRecords = [], isLoading } = useQuery<LeaveWithWages[]>({
    queryKey: ["/api/leave-with-wages", selectedEmployeeId],
    queryFn: () => fetch(`/api/leave-with-wages?employeeId=${selectedEmployeeId}`).then(r => r.json()),
    enabled: !!selectedEmployeeId,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/leave-with-wages", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leave-with-wages", selectedEmployeeId] });
      setDialogOpen(false);
      toast({ title: "Record added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PUT", `/api/leave-with-wages/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leave-with-wages", selectedEmployeeId] });
      setDialogOpen(false);
      setEditingRecord(null);
      toast({ title: "Record updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/leave-with-wages/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leave-with-wages", selectedEmployeeId] });
      toast({ title: "Record deleted" });
    },
  });

  const generateMutation = useMutation({
    mutationFn: (data: { employeeId: number; clientName: string }) =>
      apiRequest("POST", "/api/leave-with-wages/generate", data),
    onSuccess: async (res: any) => {
      const result = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/leave-with-wages", selectedEmployeeId] });
      toast({ title: result.message || `Generated ${result.generated} year(s)` });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const generateAllMutation = useMutation({
    mutationFn: async () => {
      let totalGenerated = 0;
      for (const emp of employees) {
        try {
          const res = await apiRequest("POST", "/api/leave-with-wages/generate", {
            employeeId: emp.id,
            clientName: selectedClient,
          });
          const result = await res.json();
          totalGenerated += result.generated || 0;
        } catch {}
      }
      return totalGenerated;
    },
    onSuccess: (count: number) => {
      queryClient.invalidateQueries({ queryKey: ["/api/leave-with-wages"] });
      if (selectedEmployeeId) {
        queryClient.invalidateQueries({ queryKey: ["/api/leave-with-wages", selectedEmployeeId] });
      }
      toast({ title: `Generated leave records for all employees (${count} year-records)` });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const resetForm = () => {
    setFormData({
      calendarYear: new Date().getFullYear(),
      daysLeaveEarned: "0",
      daysLeaveBroughtForward: "0",
      layOffDays: "0",
      maternityLeaveDays: "0",
      leaveEarned: "0",
      leaveEnjoyed: "0",
      otherAbsenceDays: "0",
      actualDaysWorked: "0",
      leaveAllowedDate: "NA",
      leaveAllowedDays: "NA",
      rateOfWagesRs: "0",
      rateOfWagesP: "0",
      amountOfWagesRs: "0",
      amountOfWagesP: "0",
      dateOfPayment: "",
      remarks: "",
    });
    setEditingRecord(null);
  };

  const handleSubmit = () => {
    const payload = {
      ...formData,
      employeeId: Number(selectedEmployeeId),
      clientName: selectedClient,
    };
    if (editingRecord) {
      updateMutation.mutate({ id: editingRecord.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const openEditDialog = (record: LeaveWithWages) => {
    setEditingRecord(record);
    setFormData({
      calendarYear: record.calendarYear,
      daysLeaveEarned: record.daysLeaveEarned || "0",
      daysLeaveBroughtForward: record.daysLeaveBroughtForward || "0",
      layOffDays: record.layOffDays || "0",
      maternityLeaveDays: record.maternityLeaveDays || "0",
      leaveEarned: record.leaveEarned || "0",
      leaveEnjoyed: record.leaveEnjoyed || "0",
      otherAbsenceDays: record.otherAbsenceDays || "0",
      actualDaysWorked: record.actualDaysWorked || "0",
      leaveAllowedDate: record.leaveAllowedDate || "NA",
      leaveAllowedDays: record.leaveAllowedDays || "NA",
      rateOfWagesRs: record.rateOfWagesRs || "0",
      rateOfWagesP: record.rateOfWagesP || "0",
      amountOfWagesRs: record.amountOfWagesRs || "0",
      amountOfWagesP: record.amountOfWagesP || "0",
      dateOfPayment: record.dateOfPayment || "",
      remarks: record.remarks || "",
    });
    setDialogOpen(true);
  };

  const handlePrint = () => {
    const style = document.createElement("style");
    style.id = "leave-wages-print";
    style.textContent = `
      @media print {
        @page { size: A3 landscape; margin: 8mm; }
        body * { visibility: hidden !important; }
        #leave-wages-print-area, #leave-wages-print-area * { visibility: visible !important; }
        #leave-wages-print-area { position: fixed; top: 0; left: 0; width: 100%; }
        .no-print { display: none !important; }
      }
    `;
    document.head.appendChild(style);
    setTimeout(() => {
      window.print();
      setTimeout(() => style.remove(), 500);
    }, 200);
  };

  const currentYear = new Date().getFullYear();
  const displayYears: number[] = [];
  if (leaveRecords.length > 0) {
    const minYear = Math.min(...leaveRecords.map(r => r.calendarYear));
    const maxYear = Math.max(...leaveRecords.map(r => r.calendarYear), currentYear);
    for (let y = minYear; y <= maxYear + 3; y++) displayYears.push(y);
  } else if (selectedEmployee?.joiningDate) {
    const startYear = new Date(selectedEmployee.joiningDate).getFullYear();
    for (let y = startYear; y <= currentYear + 3; y++) displayYears.push(y);
  }

  const getRecordForYear = (year: number) => leaveRecords.find(r => r.calendarYear === year);

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link href="/registers">
              <Button variant="ghost" size="icon" className="shrink-0" data-testid="button-back">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold tracking-tight flex items-center gap-2 truncate" data-testid="text-title">
                <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-teal-600 shrink-0" />
                Leave With Wages
              </h1>
              <p className="text-muted-foreground text-[10px] sm:text-sm truncate">Form No. 15 - Rule 88, WB Factories Rule, 1958</p>
            </div>
          </div>
          {selectedEmployee && leaveRecords.length >= 0 && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handlePrint} data-testid="button-print">
                <Printer className="w-4 h-4 mr-1" /> Print
              </Button>
            </div>
          )}
        </div>

        <Card className="no-print">
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5" /> Company / Client
                  </Label>
                  <Select value={selectedClient} onValueChange={(v) => { setSelectedClient(v); setSelectedEmployeeId(""); }}>
                    <SelectTrigger data-testid="select-client"><SelectValue placeholder="Select Company" /></SelectTrigger>
                    <SelectContent>
                      {clientNames.map(c => (
                        <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" /> Employee
                  </Label>
                  <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId} disabled={!selectedClient}>
                    <SelectTrigger data-testid="select-employee"><SelectValue placeholder="Select Employee" /></SelectTrigger>
                    <SelectContent>
                      {employees.map(emp => (
                        <SelectItem key={emp.id} value={String(emp.id)}>{emp.name} ({emp.employeeCode}){emp.leavingDate ? ' [Left]' : ''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {isAdmin && selectedClient && (
                <div className="flex flex-wrap gap-2">
                  {selectedEmployeeId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => generateMutation.mutate({ employeeId: Number(selectedEmployeeId), clientName: selectedClient })}
                      disabled={generateMutation.isPending}
                      data-testid="button-generate"
                    >
                      {generateMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                      Generate
                    </Button>
                  )}
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => { if (confirm(`Generate leave records for all employees of ${selectedClient}?`)) generateAllMutation.mutate(); }}
                    disabled={generateAllMutation.isPending}
                    data-testid="button-generate-all"
                  >
                    {generateAllMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                    Generate All
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {selectedEmployee && (
          <>
            <Card className="no-print">
              <CardHeader className="pb-2 pt-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Leave Records - {selectedEmployee.name}</CardTitle>
                  {isAdmin && (
                    <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
                      <DialogTrigger asChild>
                        <Button size="sm" onClick={resetForm} data-testid="button-add-record">
                          <Plus className="w-4 h-4 mr-1" /> Add Year
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>{editingRecord ? "Edit" : "Add"} Leave Record</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Calendar Year</Label>
                              <Input type="number" value={formData.calendarYear} onChange={e => setFormData({ ...formData, calendarYear: Number(e.target.value) })} data-testid="input-year" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Leave Earned (Col 2) = Days/20</Label>
                              <div className="flex gap-1">
                                <Input value={formData.daysLeaveEarned} onChange={e => setFormData({ ...formData, daysLeaveEarned: e.target.value })} data-testid="input-leave-earned" />
                                <Button type="button" variant="outline" size="sm" className="shrink-0 text-xs px-2" data-testid="button-auto-calc" onClick={async () => {
                                  try {
                                    const res = await fetch(`/api/leave-with-wages/yearly-present?employeeId=${selectedEmployeeId}&year=${formData.calendarYear}`, { credentials: "include" });
                                    const data = await res.json();
                                    const enjoyed = Number(formData.leaveEnjoyed || 0);
                                    const amt = Math.round(data.dailyRate * enjoyed);
                                    const earnedFloored = Math.floor(Number(data.leaveEarned || 0));
                                    setFormData(prev => ({ ...prev, daysLeaveEarned: String(earnedFloored), actualDaysWorked: String(data.actualDaysWorked), rateOfWagesRs: String(data.dailyRate), rateOfWagesP: "0", amountOfWagesRs: String(amt), amountOfWagesP: "0" }));
                                    toast({ title: `Worked: ${data.actualDaysWorked}d, Leave: ${earnedFloored}, Rate: ₹${data.dailyRate}/day` });
                                  } catch { toast({ title: "Failed to fetch attendance", variant: "destructive" }); }
                                }}>Auto</Button>
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Leave B/F (Col 3)</Label>
                              <Input value={formData.daysLeaveBroughtForward} onChange={e => setFormData({ ...formData, daysLeaveBroughtForward: e.target.value })} data-testid="input-leave-bf" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Lay Off Days (Col 4)</Label>
                              <Input value={formData.layOffDays} onChange={e => setFormData({ ...formData, layOffDays: e.target.value })} data-testid="input-layoff" />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Maternity Leave (Col 5)</Label>
                              <Input value={formData.maternityLeaveDays} onChange={e => setFormData({ ...formData, maternityLeaveDays: e.target.value })} data-testid="input-maternity" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Leave Earned (Col 6)</Label>
                              <Input value={formData.leaveEarned} onChange={e => setFormData({ ...formData, leaveEarned: e.target.value })} data-testid="input-col6-earned" />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Leave Enjoyed (Col 6)</Label>
                              <Input value={formData.leaveEnjoyed} onChange={e => { const val = e.target.value; const amt = Math.round(Number(formData.rateOfWagesRs || 0) * Number(val || 0)); setFormData({ ...formData, leaveEnjoyed: val, amountOfWagesRs: String(amt), amountOfWagesP: "0" }); }} data-testid="input-col6-enjoyed" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Other Absence (Col 7)</Label>
                              <Input value={formData.otherAbsenceDays} onChange={e => setFormData({ ...formData, otherAbsenceDays: e.target.value })} data-testid="input-others" />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Actual Days Worked (Col 8)</Label>
                              <Input value={formData.actualDaysWorked} onChange={e => setFormData({ ...formData, actualDaysWorked: e.target.value })} data-testid="input-days-worked" className="bg-muted/30" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Leave Allowed Date (Col 9)</Label>
                              <Input value={formData.leaveAllowedDate} onChange={e => setFormData({ ...formData, leaveAllowedDate: e.target.value })} data-testid="input-allowed-date" />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">No. of Days Allowed (Col 9)</Label>
                              <Input value={formData.leaveAllowedDays} onChange={e => setFormData({ ...formData, leaveAllowedDays: e.target.value })} data-testid="input-allowed-days" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Rate of Wages Rs. (Col 10)</Label>
                              <Input
                                value={formData.rateOfWagesRs}
                                onChange={e => {
                                  const rate = e.target.value;
                                  const amt = Math.round(Number(rate || 0) * Number(formData.leaveEnjoyed || 0));
                                  setFormData({ ...formData, rateOfWagesRs: rate, amountOfWagesRs: String(amt), amountOfWagesP: "0" });
                                }}
                                data-testid="input-rate-rs"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Rate of Wages P. (Col 10)</Label>
                              <Input value={formData.rateOfWagesP} onChange={e => setFormData({ ...formData, rateOfWagesP: e.target.value })} data-testid="input-rate-p" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs font-semibold text-green-700 dark:text-green-400">
                                Amount of Wages Rs. (Col 11)
                              </Label>
                              <Input
                                value={formData.amountOfWagesRs}
                                onChange={e => setFormData({ ...formData, amountOfWagesRs: e.target.value })}
                                className="bg-green-50 dark:bg-green-950 font-bold text-green-800 dark:text-green-300 border-green-300"
                                data-testid="input-amount-rs"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Amount of Wages P. (Col 11)</Label>
                              <Input value={formData.amountOfWagesP} onChange={e => setFormData({ ...formData, amountOfWagesP: e.target.value })} data-testid="input-amount-p" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Date of Payment (Col 12)</Label>
                              <Input value={formData.dateOfPayment} onChange={e => setFormData({ ...formData, dateOfPayment: e.target.value })} placeholder="DD-MM-YYYY" data-testid="input-payment-date" />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Remarks (Col 13)</Label>
                            <Input value={formData.remarks} onChange={e => setFormData({ ...formData, remarks: e.target.value })} data-testid="input-remarks" />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit">
                            {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                            {editingRecord ? "Update" : "Save"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0 sm:p-4 pt-0">
                {isLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="border px-2 py-1.5 text-left">Year</th>
                          <th className="border px-2 py-1.5">Leave Earned</th>
                          <th className="border px-2 py-1.5">Leave B/F</th>
                          <th className="border px-2 py-1.5">Days Worked</th>
                          <th className="border px-2 py-1.5">Rate Rs.</th>
                          <th className="border px-2 py-1.5">Amount Rs.</th>
                          <th className="border px-2 py-1.5">Payment Date</th>
                          {isAdmin && <th className="border px-2 py-1.5">Actions</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {displayYears.map(year => {
                          const rec = getRecordForYear(year);
                          return (
                            <tr key={year} className={rec ? "" : "text-muted-foreground"}>
                              <td className="border px-2 py-1.5 font-medium">{year}</td>
                              <td className="border px-2 py-1.5 text-center">{rec ? Math.floor(Number(rec.daysLeaveEarned || 0)) : ""}</td>
                              <td className="border px-2 py-1.5 text-center">{rec ? Math.floor(Number(rec.daysLeaveBroughtForward || 0)) : ""}</td>
                              <td className="border px-2 py-1.5 text-center">{rec?.actualDaysWorked || ""}</td>
                              <td className="border px-2 py-1.5 text-right">{rec?.rateOfWagesRs || ""}</td>
                              <td className="border px-2 py-1.5 text-right">{rec?.amountOfWagesRs || ""}</td>
                              <td className="border px-2 py-1.5 text-center">{rec?.dateOfPayment || ""}</td>
                              {isAdmin && (
                                <td className="border px-2 py-1.5 text-center">
                                  {rec ? (
                                    <div className="flex gap-1 justify-center">
                                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditDialog(rec)} data-testid={`button-edit-${year}`}>
                                        <Pencil className="w-3 h-3" />
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => { if (confirm("Delete this record?")) deleteMutation.mutate(rec.id); }} data-testid={`button-delete-${year}`}>
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  ) : null}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                        {displayYears.length === 0 && (
                          <tr><td colSpan={isAdmin ? 8 : 7} className="border px-2 py-4 text-center text-muted-foreground">No records yet. Add a year to get started.</td></tr>
                        )}
                        {leaveRecords.length > 0 && (() => {
                          const totalAmt = leaveRecords.reduce((sum, r) => sum + Number(r.amountOfWagesRs || 0), 0);
                          const totalEarned = leaveRecords.reduce((sum, r) => sum + Number(r.daysLeaveEarned || 0), 0);
                          const totalWorked = leaveRecords.reduce((sum, r) => sum + Number(r.actualDaysWorked || 0), 0);
                          return (
                            <tr className="bg-yellow-50 dark:bg-yellow-950 font-bold text-xs border-t-2 border-yellow-400">
                              <td className="border px-2 py-1.5 font-bold text-yellow-800 dark:text-yellow-300">TOTAL</td>
                              <td className="border px-2 py-1.5 text-center text-yellow-800 dark:text-yellow-300">{totalEarned.toFixed(1)}</td>
                              <td className="border px-2 py-1.5 text-center">—</td>
                              <td className="border px-2 py-1.5 text-center text-yellow-800 dark:text-yellow-300">{totalWorked.toFixed(1)}</td>
                              <td className="border px-2 py-1.5 text-right">—</td>
                              <td className="border px-2 py-1.5 text-right font-bold text-green-700 dark:text-green-400">
                                ₹{totalAmt.toLocaleString("en-IN")}
                              </td>
                              <td className="border px-2 py-1.5 text-center">—</td>
                              {isAdmin && <td className="border px-2 py-1.5" />}
                            </tr>
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Government Format Print Area */}
            <div id="leave-wages-print-area" className="hidden print:block" style={{ fontFamily: "Arial, sans-serif", fontSize: "11px", color: "#000" }}>
              <PrintableForm
                employee={selectedEmployee}
                records={leaveRecords}
                displayYears={displayYears}
              />
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}

function PrintableForm({ employee, records, displayYears }: { employee: Employee; records: LeaveWithWages[]; displayYears: number[] }) {
  const getRecord = (year: number) => records.find(r => r.calendarYear === year);
  const joiningDate = employee.joiningDate ? (() => { const dt = new Date(employee.joiningDate); const dd = String(dt.getDate()).padStart(2, "0"); const mm = String(dt.getMonth() + 1).padStart(2, "0"); return `${dd}-${mm}-${dt.getFullYear()}`; })() : "";

  const minRows = 10;
  const years = [...displayYears];
  while (years.length < minRows) {
    const lastYear = years.length > 0 ? years[years.length - 1] + 1 : new Date().getFullYear();
    years.push(lastYear);
  }

  const b = "1px solid #000";
  const cs: React.CSSProperties = { border: b, padding: "3px 5px", textAlign: "center", verticalAlign: "middle", fontSize: "10px" };
  const hs: React.CSSProperties = { ...cs, fontWeight: "bold", fontSize: "8.5px", lineHeight: "1.2", background: "#fff" };

  return (
    <div style={{ width: "100%", padding: "5mm" }}>
      {/* Top Header Area */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "3mm" }}>
        <tbody>
          <tr>
            <td style={{ width: "5%", verticalAlign: "top", fontSize: "10px" }}>
              <b>Page No.</b>&nbsp;&nbsp;1
            </td>
            <td style={{ width: "40%", verticalAlign: "top", paddingLeft: "10px" }}>
              <div style={{ fontSize: "11px", marginBottom: "2px" }}>Name&nbsp;&nbsp;&nbsp;<b style={{ textDecoration: "underline" }}>{employee.name}</b></div>
              <div style={{ fontSize: "11px", marginBottom: "2px" }}>Department&nbsp;&nbsp;&nbsp;<b style={{ textDecoration: "underline" }}>{employee.department || "Canteen"}</b></div>
              <div style={{ fontSize: "11px", marginBottom: "2px" }}>Serial No. In the Register of</div>
              <div style={{ fontSize: "11px", marginBottom: "2px" }}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Adult / Child Workers&nbsp;&nbsp;&nbsp;<b style={{ textDecoration: "underline" }}>Adult</b></div>
              <div style={{ fontSize: "11px" }}>Date of entry into Service&nbsp;&nbsp;&nbsp;<b style={{ textDecoration: "underline" }}>{joiningDate}</b></div>
            </td>
            <td style={{ width: "30%", textAlign: "center", verticalAlign: "top" }}>
              <div style={{ fontSize: "16px", fontWeight: "bold", marginBottom: "3px" }}>Register Of Leave With Wages</div>
              <div style={{ fontSize: "11px", marginBottom: "3px" }}>Prescribed Under Rule 88 of the West Bengal Factories Rule, 1958</div>
              <div style={{ fontSize: "14px", fontWeight: "bold" }}>Form No. 15</div>
            </td>
            <td style={{ width: "25%", verticalAlign: "top", paddingLeft: "15px", fontSize: "10px", lineHeight: "1.6" }}>
              <div>In Case of discharged or dismissed workers</div>
              <div>Date of Discharge or Dismissal _______________</div>
              <div>Date & Amount of Payment mode in lieu of Leave Due</div>
              <div>Amount Of Payment Mode Rs. ____________ P.</div>
              <div>Date of Payment _______________</div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Main Data Table - exact government format */}
      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: "5.5%" }} />{/* 1: Calendar Year */}
          <col style={{ width: "6%" }} />{/* 2: Leave earned */}
          <col style={{ width: "6%" }} />{/* 3: Leave B/F */}
          <col style={{ width: "4.5%" }} />{/* 4: Lay Off */}
          <col style={{ width: "5%" }} />{/* 5: Maternity */}
          <col style={{ width: "5%" }} />{/* 6: Leave Earned (absence) */}
          <col style={{ width: "5%" }} />{/* 6: Leave Enjoyed (absence) */}
          <col style={{ width: "5%" }} />{/* 7: Others */}
          <col style={{ width: "6%" }} />{/* 8: Actual days worked */}
          <col style={{ width: "6%" }} />{/* 9a: Date */}
          <col style={{ width: "5.5%" }} />{/* 9b: No of days */}
          <col style={{ width: "5%" }} />{/* 10a: Rs */}
          <col style={{ width: "3%" }} />{/* 10b: P */}
          <col style={{ width: "5%" }} />{/* 11a: Rs */}
          <col style={{ width: "3%" }} />{/* 11b: P */}
          <col style={{ width: "7.5%" }} />{/* 12: Payment date */}
          <col style={{ width: "5%" }} />{/* 13: Remarks */}
          <col style={{ width: "7%" }} />{/* 14: Signature */}
        </colgroup>
        <thead>
          {/* Header Row 1 */}
          <tr>
            <th rowSpan={4} style={hs}>Calender<br />Year</th>
            <th rowSpan={4} style={hs}>No. of Days<br />Leave earned<br />in the<br />immediately<br />Preceeding<br />Calender Year</th>
            <th rowSpan={4} style={hs}>No. Of days<br />Leave Brought<br />forward (From<br />Previous Year<br />Or Years).</th>
            <th colSpan={5} style={hs}>Date of Absence</th>
            <th rowSpan={4} style={hs}>Actual No.<br />of days<br />worked<br />during the<br />calender<br />year Shown<br />in Column 1</th>
            <th colSpan={2} style={hs}>Date From which the<br />worker is allowed leave<br />(Shown in Coummns 2 &amp;<br />3) and No of days<br />allowed</th>
            <th colSpan={2} style={hs}>Rate of wages for<br />the Period of Leave</th>
            <th colSpan={2} style={hs}>Amount of wages<br />for the period of<br />Leave</th>
            <th rowSpan={4} style={hs}>Date of<br />Payment</th>
            <th rowSpan={4} style={hs}>Remarks</th>
            <th rowSpan={4} style={hs}>Signature of<br />the Manager<br />or his agent</th>
          </tr>
          {/* Header Row 2 */}
          <tr>
            <th rowSpan={3} style={hs}>Lay Off</th>
            <th rowSpan={3} style={hs}>Maternity<br />Leave<br />(Female<br />Worker)</th>
            <th colSpan={2} style={hs}>Leave earned in the<br />Immediately Preceeding<br />calender year and<br />enjoyed during the Year</th>
            <th rowSpan={3} style={hs}>Others</th>
            <th rowSpan={2} style={hs}>Date</th>
            <th rowSpan={2} style={hs}>No of days<br />allowed</th>
            <th rowSpan={2} style={hs}>Rs.</th>
            <th rowSpan={2} style={hs}>P.</th>
            <th rowSpan={2} style={hs}>Rs.</th>
            <th rowSpan={2} style={hs}>P.</th>
          </tr>
          {/* Header Row 3 */}
          <tr>
            <th style={hs}>Leave<br />Earned</th>
            <th style={hs}>Leave<br />Enjoyed</th>
          </tr>
          {/* Header Row 4: Column numbers */}
          <tr>
            {/* cols 4-7 already filled by rowSpan */}
            {/* cols 9-11 P already filled by rowSpan */}
          </tr>
        </thead>
        <tbody>
          {/* Column number labels row */}
          <tr style={{ fontWeight: "bold", fontSize: "8px" }}>
            <td style={cs}>1</td>
            <td style={cs}>2</td>
            <td style={cs}>3</td>
            <td style={cs}>4</td>
            <td style={cs}>5</td>
            <td style={cs}>6</td>
            <td style={cs}></td>
            <td style={cs}>7</td>
            <td style={cs}>8</td>
            <td style={cs}>9</td>
            <td style={cs}></td>
            <td style={cs}>10</td>
            <td style={cs}></td>
            <td style={cs}>11</td>
            <td style={cs}></td>
            <td style={cs}>12</td>
            <td style={cs}>13</td>
            <td style={cs}>14</td>
          </tr>
          {/* Data rows */}
          {years.map(year => {
            const rec = getRecord(year);
            const v = (val: string | null | undefined) => val && val !== "0" && val !== "0.0" ? val : "";
            return (
              <tr key={year} style={{ height: "22px" }}>
                <td style={{ ...cs, textAlign: "left", fontWeight: "bold" }}>{year}</td>
                <td style={cs}>{rec ? (Math.floor(Number(rec.daysLeaveEarned || 0)) || "") : ""}</td>
                <td style={cs}>{rec ? (Math.floor(Number(rec.daysLeaveBroughtForward || 0)) || "") : ""}</td>
                <td style={cs}>{v(rec?.layOffDays)}</td>
                <td style={cs}>{v(rec?.maternityLeaveDays)}</td>
                <td style={cs}>{rec ? (Math.floor(Number(rec.leaveEarned || 0)) || "") : ""}</td>
                <td style={cs}>{v(rec?.leaveEnjoyed)}</td>
                <td style={cs}>{v(rec?.otherAbsenceDays)}</td>
                <td style={cs}>{v(rec?.actualDaysWorked)}</td>
                <td style={cs}>{rec?.leaveAllowedDate || ""}</td>
                <td style={cs}>{rec?.leaveAllowedDays || ""}</td>
                <td style={cs}>{v(rec?.rateOfWagesRs)}</td>
                <td style={cs}>{rec ? rec.rateOfWagesP : ""}</td>
                <td style={cs}>{v(rec?.amountOfWagesRs)}</td>
                <td style={cs}>{rec ? rec.amountOfWagesP : ""}</td>
                <td style={cs}>{rec?.dateOfPayment || ""}</td>
                <td style={cs}>{rec?.remarks || ""}</td>
                <td style={cs}></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
