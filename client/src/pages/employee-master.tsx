import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Layout } from "@/components/layout";
import { useClientNames } from "@/hooks/use-reports";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Loader2, Pencil, Trash2, Users, Search, UserCheck, UserX, Building2, IndianRupee, CreditCard, FileText, MapPin, Shield, Calendar, Printer, ScanFace, CheckCircle2, Fingerprint } from "lucide-react";
import { FaceEnrollDialog } from "@/components/face-enroll-dialog";
import { startRegistration } from "@simplewebauthn/browser";

const fmtDate = (d: string | null | undefined): string => {
  if (!d) return "-";
  const s = String(d).split("T")[0];
  if (!s) return "-";
  const [y, m, dd] = s.split("-");
  return `${dd}-${m}-${y}`;
};

// YYYY-MM-DD → DD-MM-YYYY for display in text input
const storeToDisplay = (v: string): string => {
  if (!v) return "";
  const s = v.split("T")[0].split(" ")[0];
  const [y, m, d] = s.split("-");
  if (y && m && d) return `${d}-${m}-${y}`;
  return v;
};

// DD-MM-YYYY → YYYY-MM-DD for storage; returns raw string while typing
const displayToStore = (raw: string): string => {
  const clean = raw.replace(/[^\d-]/g, "");
  const parts = clean.split("-");
  if (parts.length === 3 && parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
  }
  return clean;
};

// Auto-insert dashes while typing: "101" → "10-1", "1006" → "10-06", "10062000" → "10-06-2000"
const autoFormatDate = (prev: string, next: string): string => {
  const digits = next.replace(/\D/g, "").slice(0, 8);
  let result = "";
  for (let i = 0; i < digits.length; i++) {
    if (i === 2 || i === 4) result += "-";
    result += digits[i];
  }
  return result;
};

interface Employee {
  id: number;
  employeeCode: string;
  name: string;
  fatherName: string | null;
  designation: string | null;
  department: string | null;
  clientName: string;
  esicNo: string | null;
  pfNo: string | null;
  uanNo: string | null;
  aadhaarNo: string | null;
  panNo: string | null;
  bankName: string | null;
  accountNo: string | null;
  ifscCode: string | null;
  dailyRate: string | null;
  fixedHra: string | null;
  gender: string | null;
  dob: string | null;
  address: string | null;
  permanentAddress: string | null;
  localAddress: string | null;
  skills: string | null;
  joiningDate: string | null;
  leavingDate: string | null;
  leavingReason: string | null;
  mobile: string | null;
  weeklyOffDay: string | null;
  identificationMarks: string | null;
  isActive: boolean;
  createdAt: string | null;
}

const emptyForm = {
  employeeCode: "",
  name: "",
  fatherName: "",
  designation: "",
  department: "",
  clientName: "",
  esicNo: "",
  pfNo: "",
  uanNo: "",
  aadhaarNo: "",
  panNo: "",
  bankName: "",
  accountNo: "",
  ifscCode: "",
  dailyRate: "",
  fixedHra: "",
  gender: "Male",
  dob: "",
  address: "",
  permanentAddress: "",
  localAddress: "",
  skills: "",
  joiningDate: "",
  leavingDate: "",
  leavingReason: "",
  mobile: "",
  weeklyOffDay: "",
  identificationMarks: "",
  isActive: true,
};

export default function EmployeeMaster() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: clients } = useClientNames();

  const [filterClient, setFilterClient] = useState<string>("all");
  const [filterActive, setFilterActive] = useState<string>("active");
  const [searchText, setSearchText] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [enrollingEmployee, setEnrollingEmployee] = useState<any>(null);
  const [registeringFingerprintId, setRegisteringFingerprintId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const queryKey = filterClient && filterClient !== "all"
    ? ["/api/employees", filterClient]
    : ["/api/employees"];

  const { data: employees, isLoading } = useQuery<Employee[]>({
    queryKey,
    queryFn: async () => {
      const url = filterClient && filterClient !== "all"
        ? `/api/employees?clientName=${encodeURIComponent(filterClient)}`
        : "/api/employees";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch employees");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof emptyForm) => {
      const res = await apiRequest("POST", "/api/employees", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({ title: "Employee created successfully" });
      closeDialog();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof emptyForm }) => {
      const res = await apiRequest("PUT", `/api/employees/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({ title: "Employee updated successfully" });
      closeDialog();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/employees/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({ title: "Employee deleted successfully" });
      setDeleteId(null);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setForm({ ...emptyForm });
  };

  const handleRegisterFingerprint = async (emp: any) => {
    if (!window.PublicKeyCredential) {
      toast({ title: "Not Supported", description: "This device or browser does not support fingerprint/biometric authentication.", variant: "destructive" }); return;
    }
    setRegisteringFingerprintId(emp.id);
    try {
      const challengeRes = await fetch("/api/webauthn/register/challenge", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: emp.id }),
      });
      if (!challengeRes.ok) { const e = await challengeRes.json(); throw new Error(e.message); }
      const options = await challengeRes.json();
      const registrationResponse = await startRegistration({ optionsJSON: options });
      const verifyRes = await fetch("/api/webauthn/register/verify", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: emp.id, registrationResponse }),
      });
      if (!verifyRes.ok) { const e = await verifyRes.json(); throw new Error(e.message); }
      toast({ title: "Fingerprint Registered!", description: `${emp.name} can now use fingerprint for attendance.` });
    } catch (err: any) {
      if (err?.name === "NotAllowedError") {
        toast({ title: "Cancelled", description: "Fingerprint registration was cancelled.", variant: "destructive" });
      } else {
        toast({ title: "Registration Failed", description: err.message || "Could not register fingerprint.", variant: "destructive" });
      }
    } finally {
      setRegisteringFingerprintId(null);
    }
  };

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setDialogOpen(true);
  };

  const openEdit = (emp: Employee) => {
    setEditingId(emp.id);
    setForm({
      employeeCode: emp.employeeCode || "",
      name: emp.name || "",
      fatherName: emp.fatherName || "",
      designation: emp.designation || "",
      department: emp.department || "",
      clientName: emp.clientName || "",
      esicNo: emp.esicNo || "",
      pfNo: emp.pfNo || "",
      uanNo: emp.uanNo || "",
      aadhaarNo: emp.aadhaarNo || "",
      panNo: emp.panNo || "",
      bankName: emp.bankName || "",
      accountNo: emp.accountNo || "",
      ifscCode: emp.ifscCode || "",
      dailyRate: emp.dailyRate || "",
      fixedHra: emp.fixedHra || "",
      gender: emp.gender || "Male",
      dob: emp.dob ? storeToDisplay(String(emp.dob)) : "",
      address: emp.address || "",
      permanentAddress: emp.permanentAddress || "",
      localAddress: emp.localAddress || "",
      skills: emp.skills || "",
      joiningDate: emp.joiningDate ? storeToDisplay(String(emp.joiningDate)) : "",
      leavingDate: emp.leavingDate ? storeToDisplay(String(emp.leavingDate)) : "",
      leavingReason: emp.leavingReason || "",
      mobile: emp.mobile || "",
      weeklyOffDay: emp.weeklyOffDay || "",
      identificationMarks: emp.identificationMarks || "",
      isActive: emp.isActive,
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.employeeCode.trim() || !form.name.trim() || !form.clientName) {
      toast({ title: "Please fill required fields", description: "Employee Code, Name, and Client are required.", variant: "destructive" });
      return;
    }
    const payload = {
      ...form,
      dob: form.dob ? displayToStore(form.dob) || null : null,
      joiningDate: form.joiningDate ? displayToStore(form.joiningDate) || null : null,
      leavingDate: form.leavingDate ? displayToStore(form.leavingDate) || null : null,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload as any });
    } else {
      createMutation.mutate(payload as any);
    }
  };

  const setField = (key: string, value: string | boolean) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const filteredEmployees = (employees || []).filter(emp => {
    if (filterActive === "active" && !emp.isActive) return false;
    if (filterActive === "inactive" && emp.isActive) return false;
    if (searchText) {
      const s = searchText.toLowerCase();
      return (
        emp.employeeCode.toLowerCase().includes(s) ||
        emp.name.toLowerCase().includes(s) ||
        (emp.designation || "").toLowerCase().includes(s) ||
        (emp.department || "").toLowerCase().includes(s)
      );
    }
    return true;
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const clientNamesList = clients?.map((c: any) => typeof c === "string" ? c : c.name) || [];

  const handlePrintWeekOfReport = () => {
    const win = window.open("", "_blank", "width=1100,height=750");
    if (!win) return;

    const today = new Date();
    const printDate = `${String(today.getDate()).padStart(2,"0")}-${String(today.getMonth()+1).padStart(2,"0")}-${today.getFullYear()}`;
    const clientLabel = filterClient && filterClient !== "all" ? filterClient : "All Clients";
    const statusLabel = filterActive === "active" ? "Active" : filterActive === "inactive" ? "Inactive" : "All";

    const th = `border:1px solid #000;padding:5px 7px;text-align:center;font-size:10pt;font-weight:bold;background:#c6efce;white-space:nowrap;`;
    const td = `border:1px solid #000;padding:4px 6px;font-size:9.5pt;`;
    const tdc = `border:1px solid #000;padding:4px 6px;font-size:9.5pt;text-align:center;`;

    const showClient = !filterClient || filterClient === "all";

    const rows = filteredEmployees.map((emp, i) => `
      <tr style="${i % 2 === 0 ? "" : "background:#f5f5f5;"}">
        <td style="${tdc}">${i + 1}</td>
        <td style="${td}">${emp.employeeCode}</td>
        <td style="${td}">${emp.name}</td>
        <td style="${td}">${emp.fatherName || "-"}</td>
        ${showClient ? `<td style="${td}">${emp.clientName}</td>` : ""}
        <td style="${td}">${emp.designation || "-"}</td>
        <td style="${td}">${emp.skills || "-"}</td>
        <td style="${tdc}">${fmtDate(emp.joiningDate)}</td>
        <td style="${tdc}">${emp.weeklyOffDay || "-"}</td>
        <td style="${tdc}">${emp.dailyRate && emp.dailyRate !== "0" ? `₹${emp.dailyRate}` : "-"}</td>
        <td style="${tdc}">${emp.mobile || "-"}</td>
        <td style="${tdc}">${emp.esicNo || "-"}</td>
        <td style="${tdc}">${emp.uanNo || "-"}</td>
        <td style="${tdc}">${emp.isActive ? "Active" : "Inactive"}</td>
      </tr>`).join("");

    win.document.write(`<html><head><title>Employee Week Of Report</title>
      <style>
        @media print { body { margin: 8mm; } @page { size: A3 landscape; margin: 8mm; } }
        body { font-family: Arial, sans-serif; }
        table { border-collapse: collapse; width: 100%; }
      </style>
    </head><body>
      <div style="text-align:center;margin-bottom:6px;">
        <div style="font-size:14pt;font-weight:bold;">DJ Hospitality &amp; Facility Management Pvt. Ltd.</div>
        <div style="font-size:12pt;font-weight:bold;margin-top:2px;">Employee Week Of Report</div>
        <div style="font-size:10pt;margin-top:2px;">Client: ${clientLabel} &nbsp;|&nbsp; Status: ${statusLabel} &nbsp;|&nbsp; Date: ${printDate} &nbsp;|&nbsp; Total: ${filteredEmployees.length}</div>
      </div>
      <table>
        <thead>
          <tr>
            <th style="${th}">Sr.</th>
            <th style="${th}">Emp Code</th>
            <th style="${th}">Name</th>
            <th style="${th}">Father's Name</th>
            ${showClient ? `<th style="${th}">Client</th>` : ""}
            <th style="${th}">Designation</th>
            <th style="${th}">Skills</th>
            <th style="${th}">Joining Date</th>
            <th style="${th}">Weekly Off</th>
            <th style="${th}">Daily Rate</th>
            <th style="${th}">Mobile</th>
            <th style="${th}">ESIC No</th>
            <th style="${th}">UAN No</th>
            <th style="${th}">Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="margin-top:40px;display:flex;justify-content:space-between;font-size:10pt;">
        <span>Prepared by: ________________</span>
        <span>Checked by: ________________</span>
        <span>Authorised by: ________________</span>
      </div>
    </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight" data-testid="text-employee-master-title">Employee Master</h1>
            <p className="text-muted-foreground text-xs sm:text-sm mt-1">Manage employee records</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePrintWeekOfReport} data-testid="button-print-weekof-report">
              <Printer className="w-4 h-4 mr-2" />
              Print Week Of Report
            </Button>
            <Button onClick={openAdd} data-testid="button-add-employee">
              <Plus className="w-4 h-4 mr-2" />
              Add Employee
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by code, name, designation..."
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-employee"
                />
              </div>
              <Select value={filterClient} onValueChange={setFilterClient}>
                <SelectTrigger className="w-full sm:w-48" data-testid="select-filter-client">
                  <SelectValue placeholder="All Clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                  {clientNamesList.map((name: string) => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterActive} onValueChange={setFilterActive}>
                <SelectTrigger className="w-full sm:w-36" data-testid="select-filter-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredEmployees.length === 0 ? (
          <Card>
            <CardContent className="text-center py-16">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-1">No employees found</h3>
              <p className="text-muted-foreground text-sm">Add your first employee or adjust filters.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="md:hidden space-y-3">
              {filteredEmployees.map(emp => (
                <Card key={emp.id} data-testid={`card-employee-${emp.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm truncate">{emp.name}</span>
                          {emp.isActive ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded">
                              <UserCheck className="w-3 h-3" /> Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/30 px-1.5 py-0.5 rounded">
                              <UserX className="w-3 h-3" /> Inactive
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{emp.employeeCode}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                          {emp.clientName && (
                            <span className="flex items-center gap-1">
                              <Building2 className="w-3 h-3" /> {emp.clientName}
                            </span>
                          )}
                          {emp.designation && <span>{emp.designation}</span>}
                          {emp.dob && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" /> DOB: {fmtDate(emp.dob)}
                            </span>
                          )}
                          {emp.joiningDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" /> Joined: {fmtDate(emp.joiningDate)}
                            </span>
                          )}
                          {emp.weeklyOffDay && (
                            <span className="flex items-center gap-1 text-blue-700 dark:text-blue-400">
                              <span className="font-semibold">WO:</span> {emp.weeklyOffDay}
                            </span>
                          )}
                          {emp.dailyRate && emp.dailyRate !== "0" && (
                            <span className="flex items-center gap-1">
                              <IndianRupee className="w-3 h-3" /> {emp.dailyRate}/day
                            </span>
                          )}
                          {emp.fixedHra && emp.fixedHra !== "0" && (
                            <span className="text-emerald-600 dark:text-emerald-400">HRA: ₹{emp.fixedHra}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="icon" variant="ghost" className="text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20" title="Enroll Face" onClick={() => setEnrollingEmployee(emp)} data-testid={`button-enroll-face-mobile-${emp.id}`}>
                          {emp.faceDescriptor ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <ScanFace className="w-4 h-4" />}
                        </Button>
                        <Button size="icon" variant="ghost" className="text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20" title="Register Fingerprint" onClick={() => handleRegisterFingerprint(emp)} disabled={registeringFingerprintId === emp.id} data-testid={`button-fingerprint-mobile-${emp.id}`}>
                          {registeringFingerprintId === emp.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Fingerprint className="w-4 h-4" />}
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => openEdit(emp)} data-testid={`button-edit-employee-${emp.id}`}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setDeleteId(emp.id)} data-testid={`button-delete-employee-${emp.id}`}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="hidden md:block">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="table-employees">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Code</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Name</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Client</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Designation</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">DOB</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Joining Date</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground">Daily Rate</th>
                        <th className="px-3 py-2.5 text-center text-xs font-semibold text-muted-foreground">Status</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEmployees.map(emp => (
                        <tr key={emp.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors" data-testid={`row-employee-${emp.id}`}>
                          <td className="px-3 py-2.5 font-medium">{emp.employeeCode}</td>
                          <td className="px-3 py-2.5">{emp.name}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{emp.clientName}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{emp.designation || "-"}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{fmtDate(emp.dob)}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{fmtDate(emp.joiningDate)}</td>
                          <td className="px-3 py-2.5 text-right font-mono">{emp.dailyRate && emp.dailyRate !== "0" ? `₹${emp.dailyRate}` : "-"}</td>
                          <td className="px-3 py-2.5 text-center">
                            {emp.isActive ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded">
                                <UserCheck className="w-3 h-3" /> Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/30 px-1.5 py-0.5 rounded">
                                <UserX className="w-3 h-3" /> Inactive
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <div className="flex justify-end gap-1">
                              <Button size="icon" variant="ghost" className="text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20" title={emp.faceDescriptor ? "Face enrolled — click to update" : "Enroll face"} onClick={() => setEnrollingEmployee(emp)} data-testid={`button-enroll-face-${emp.id}`}>
                                {emp.faceDescriptor ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <ScanFace className="w-4 h-4" />}
                              </Button>
                              <Button size="icon" variant="ghost" className="text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20" title="Register Fingerprint for attendance" onClick={() => handleRegisterFingerprint(emp)} disabled={registeringFingerprintId === emp.id} data-testid={`button-fingerprint-${emp.id}`}>
                                {registeringFingerprintId === emp.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Fingerprint className="w-4 h-4" />}
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => openEdit(emp)} data-testid={`button-edit-employee-${emp.id}`}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => setDeleteId(emp.id)} data-testid={`button-delete-employee-${emp.id}`}>
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <p className="text-xs text-muted-foreground text-center" data-testid="text-employee-count">
              Showing {filteredEmployees.length} of {employees?.length || 0} employees
            </p>
          </>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={open => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="text-dialog-title">
              {editingId ? "Edit Employee" : "Add Employee"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-2">
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Users className="w-4 h-4" /> Basic Info
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="employeeCode">Employee Code *</Label>
                  <Input id="employeeCode" value={form.employeeCode} onChange={e => setField("employeeCode", e.target.value)} data-testid="input-employee-code" />
                </div>
                <div>
                  <Label htmlFor="name">Name *</Label>
                  <Input id="name" value={form.name} onChange={e => setField("name", e.target.value)} data-testid="input-name" />
                </div>
                <div>
                  <Label htmlFor="fatherName">Father's Name</Label>
                  <Input id="fatherName" value={form.fatherName} onChange={e => setField("fatherName", e.target.value)} data-testid="input-father-name" />
                </div>
                <div>
                  <Label htmlFor="gender">Gender</Label>
                  <Select value={form.gender} onValueChange={v => setField("gender", v)}>
                    <SelectTrigger data-testid="select-gender">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="dob">Date of Birth</Label>
                  <Input id="dob" type="text" inputMode="numeric" placeholder="DD-MM-YYYY"
                    value={form.dob}
                    onChange={e => setField("dob", autoFormatDate(form.dob, e.target.value))}
                    data-testid="input-dob" />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="identificationMarks">Identification Marks</Label>
                  <Input id="identificationMarks" value={form.identificationMarks} onChange={e => setField("identificationMarks", e.target.value)} placeholder="e.g. Mole on left cheek, scar on right hand" data-testid="input-identification-marks" />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Building2 className="w-4 h-4" /> Work Info
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="designation">Designation</Label>
                  <Input id="designation" value={form.designation} onChange={e => setField("designation", e.target.value)} data-testid="input-designation" />
                </div>
                <div>
                  <Label htmlFor="department">Department</Label>
                  <Input id="department" value={form.department} onChange={e => setField("department", e.target.value)} data-testid="input-department" />
                </div>
                <div>
                  <Label htmlFor="clientName">Client / Company *</Label>
                  <Select value={form.clientName} onValueChange={v => setField("clientName", v)}>
                    <SelectTrigger data-testid="select-client-name">
                      <SelectValue placeholder="Select client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientNamesList.map((name: string) => (
                        <SelectItem key={name} value={name}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="dailyRate">Daily Rate</Label>
                  <Input id="dailyRate" value={form.dailyRate} onChange={e => setField("dailyRate", e.target.value)} inputMode="decimal" data-testid="input-daily-rate" />
                </div>
                <div>
                  <Label htmlFor="fixedHra">Fixed HRA (Monthly)</Label>
                  <Input id="fixedHra" value={form.fixedHra} onChange={e => setField("fixedHra", e.target.value)} inputMode="decimal" placeholder="0" data-testid="input-fixed-hra" />
                </div>
                <div>
                  <Label htmlFor="weeklyOffDay">Weekly Off Day</Label>
                  <Select value={form.weeklyOffDay || "none"} onValueChange={v => setField("weeklyOffDay", v === "none" ? "" : v)}>
                    <SelectTrigger data-testid="select-weekly-off-day">
                      <SelectValue placeholder="Select day" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      <SelectItem value="Sunday">Sunday</SelectItem>
                      <SelectItem value="Monday">Monday</SelectItem>
                      <SelectItem value="Tuesday">Tuesday</SelectItem>
                      <SelectItem value="Wednesday">Wednesday</SelectItem>
                      <SelectItem value="Thursday">Thursday</SelectItem>
                      <SelectItem value="Friday">Friday</SelectItem>
                      <SelectItem value="Saturday">Saturday</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="joiningDate">Joining Date</Label>
                  <Input id="joiningDate" type="text" inputMode="numeric" placeholder="DD-MM-YYYY"
                    value={form.joiningDate}
                    onChange={e => setField("joiningDate", autoFormatDate(form.joiningDate, e.target.value))}
                    data-testid="input-joining-date" />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" /> Government IDs
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="esicNo">ESIC No</Label>
                  <Input id="esicNo" value={form.esicNo} onChange={e => setField("esicNo", e.target.value)} data-testid="input-esic-no" />
                </div>
                <div>
                  <Label htmlFor="pfNo">PF No</Label>
                  <Input id="pfNo" value={form.pfNo} onChange={e => setField("pfNo", e.target.value)} data-testid="input-pf-no" />
                </div>
                <div>
                  <Label htmlFor="uanNo">UAN No</Label>
                  <Input id="uanNo" value={form.uanNo} onChange={e => setField("uanNo", e.target.value)} data-testid="input-uan-no" />
                </div>
                <div>
                  <Label htmlFor="aadhaarNo">Aadhaar No</Label>
                  <Input id="aadhaarNo" value={form.aadhaarNo} onChange={e => setField("aadhaarNo", e.target.value)} inputMode="numeric" data-testid="input-aadhaar-no" />
                </div>
                <div>
                  <Label htmlFor="panNo">PAN No</Label>
                  <Input id="panNo" value={form.panNo} onChange={e => setField("panNo", e.target.value)} data-testid="input-pan-no" />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <CreditCard className="w-4 h-4" /> Bank Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="bankName">Bank Name</Label>
                  <Input id="bankName" value={form.bankName} onChange={e => setField("bankName", e.target.value)} data-testid="input-bank-name" />
                </div>
                <div>
                  <Label htmlFor="accountNo">Account No</Label>
                  <Input id="accountNo" value={form.accountNo} onChange={e => setField("accountNo", e.target.value)} inputMode="numeric" data-testid="input-account-no" />
                </div>
                <div>
                  <Label htmlFor="ifscCode">IFSC Code</Label>
                  <Input id="ifscCode" value={form.ifscCode} onChange={e => setField("ifscCode", e.target.value)} data-testid="input-ifsc-code" />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4" /> Address & Contact
              </h3>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="permanentAddress">Permanent Address</Label>
                  <Textarea id="permanentAddress" value={form.permanentAddress} onChange={e => setField("permanentAddress", e.target.value)} rows={2} data-testid="input-permanent-address" />
                </div>
                <div>
                  <Label htmlFor="localAddress">Local Address</Label>
                  <Textarea id="localAddress" value={form.localAddress} onChange={e => setField("localAddress", e.target.value)} rows={2} data-testid="input-local-address" />
                </div>
                <div>
                  <Label htmlFor="address">Address (Legacy)</Label>
                  <Textarea id="address" value={form.address} onChange={e => setField("address", e.target.value)} rows={2} data-testid="input-address" />
                </div>
                <div>
                  <Label htmlFor="skills">Skills / Category</Label>
                  <Select value={form.skills || ""} onValueChange={v => setField("skills", v)}>
                    <SelectTrigger data-testid="select-skills">
                      <SelectValue placeholder="Select skill category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Unskilled">Unskilled</SelectItem>
                      <SelectItem value="Semi Skilled">Semi Skilled</SelectItem>
                      <SelectItem value="Skilled">Skilled</SelectItem>
                      <SelectItem value="High Skilled">High Skilled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="mobile">Mobile No.</Label>
                  <Input id="mobile" value={form.mobile} onChange={e => setField("mobile", e.target.value)} inputMode="tel" data-testid="input-mobile" />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4" /> Status
              </h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Switch checked={form.isActive} onCheckedChange={v => setField("isActive", v)} data-testid="switch-is-active" />
                  <Label>{form.isActive ? "Active" : "Inactive"}</Label>
                </div>
                {!form.isActive && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="leavingDate">Leaving Date</Label>
                      <Input id="leavingDate" type="text" inputMode="numeric" placeholder="DD-MM-YYYY"
                        value={form.leavingDate ?? ""}
                        onChange={e => setField("leavingDate", autoFormatDate(form.leavingDate ?? "", e.target.value))}
                        data-testid="input-leaving-date" />
                    </div>
                    <div>
                      <Label htmlFor="leavingReason">Leaving Reason</Label>
                      <Input id="leavingReason" value={form.leavingReason} onChange={e => setField("leavingReason", e.target.value)} data-testid="input-leaving-reason" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeDialog} data-testid="button-cancel">Cancel</Button>
            <Button onClick={handleSubmit} disabled={isSaving} data-testid="button-save-employee">
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {enrollingEmployee && (
        <FaceEnrollDialog
          employeeId={enrollingEmployee.id}
          employeeName={enrollingEmployee.name}
          hasExisting={!!enrollingEmployee.faceDescriptor}
          onClose={() => setEnrollingEmployee(null)}
          onSuccess={() => { setEnrollingEmployee(null); queryClient.invalidateQueries({ queryKey: ["/api/employees"] }); }}
        />
      )}

      <AlertDialog open={deleteId !== null} onOpenChange={open => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Employee</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this employee? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
