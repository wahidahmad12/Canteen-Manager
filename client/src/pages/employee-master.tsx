import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Loader2, Pencil, Trash2, Users, Search, UserCheck, UserX, Building2, IndianRupee, CreditCard, FileText, MapPin, Shield, Calendar, Printer, Fingerprint, QrCode, Download } from "lucide-react";
import { startRegistration } from "@simplewebauthn/browser";
import { QRCodeSVG } from "qrcode.react";
import QRCodeLib from "qrcode";
import logoPath from "@assets/logo1_1771660912341.png";

const fmtDate = (d: string | null | undefined): string => {
  if (!d) return "-";
  const s = String(d).split("T")[0];
  if (!s) return "-";
  const [y, m, dd] = s.split("-");
  return `${dd}-${m}-${y}`;
};

const storeToDisplay = (v: string): string => {
  if (!v) return "";
  const s = v.split("T")[0].split(" ")[0];
  const [y, m, d] = s.split("-");
  if (y && m && d) return `${d}-${m}-${y}`;
  return v;
};

const displayToStore = (raw: string): string => {
  const clean = raw.replace(/[^\d-]/g, "");
  const parts = clean.split("-");
  if (parts.length === 3 && parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
  }
  return clean;
};

const autoFormatDate = (prev: string, next: string): string => {
  const digits = next.replace(/\D/g, "").slice(0, 8);
  let result = "";
  for (let i = 0; i < digits.length; i++) {
    if (i === 2 || i === 4) result += "-";
    result += digits[i];
  }
  return result;
};

const htmlEntities: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#39;",
};

const escapeHtml = (value: string | null | undefined): string =>
  (value || "").replace(/[&<>"']/g, char => htmlEntities[char]);

async function encodeEmployeePhoto(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Choose a JPG, PNG, or WebP photo.");
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("Choose a photo smaller than 8 MB.");
  }

  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not process the selected photo.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    for (const quality of [0.82, 0.68, 0.54]) {
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      if (dataUrl.length <= 1_400_000) return dataUrl;
    }
    throw new Error("This photo could not be compressed below 1 MB. Choose a smaller image.");
  } finally {
    bitmap.close();
  }
}

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
  religion: string | null; // Naya addition
  maritalStatus: string | null;
  email: string | null; // Naya addition
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
  photoData?: string | null;
  isActive: boolean;
  createdAt: string | null;
}

function renderEmployeeCardSides(
  emp: Employee,
  qrSvg: string,
  photoData: string,
  logoUrl: string,
  workplace: string,
  clientAddress: string,
) {
  const initial = escapeHtml(emp.name.trim().charAt(0).toUpperCase() || "?");
  const sideValue = (value: string | null | undefined) => escapeHtml(value?.trim() || "N/A");
  const formattedClientAddress = escapeHtml(clientAddress.trim() || "N/A").replace(/\r?\n/g, "<br>");
  const safePhotoData = photoData.length <= 1_400_000 &&
    /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/i.test(photoData)
    ? photoData
    : "";
  const portrait = safePhotoData
    ? `<div class="portrait"><img src="${escapeHtml(safePhotoData)}" alt="Employee photo"></div>`
    : `<div class="portrait" aria-label="Employee photo placeholder">${initial}</div>`;
  const front = `
    <section class="card-side front">
      <div class="pattern"></div><div class="cyan cyan-one"></div>
      <header class="brand"><img class="logo" src="${logoUrl}" alt="DJ Hospitality logo"><div class="brand-copy">DJ Hospitality &amp; Facility Management Pvt Ltd<div class="office">${formattedClientAddress}</div></div></header>
      ${portrait}
      <div class="name">${sideValue(emp.name)}</div>
      <div class="designation">${sideValue(emp.designation || emp.department || "Employee")}</div>
      <div class="details">
        <div class="detail"><span class="label">ID No</span><span>:</span><span class="value">${sideValue(emp.employeeCode)}</span></div>
        <div class="detail"><span class="label">Dept</span><span>:</span><span class="value">${sideValue(emp.department || emp.clientName)}</span></div>
        <div class="detail"><span class="label">EPFO No</span><span>:</span><span class="value">${sideValue(emp.uanNo || emp.pfNo)}</span></div>
        <div class="detail"><span class="label">ESIC No</span><span>:</span><span class="value">${sideValue(emp.esicNo)}</span></div>
      </div>
      <div class="workplace"><strong>Work place Address:</strong>${sideValue(workplace)}</div>
      <div class="bottom-cyan"></div><div class="bottom"></div>
    </section>`;
  const back = `
    <section class="card-side back">
      <div class="pattern"></div>
      <header class="brand"><img class="logo" src="${logoUrl}" alt="DJ Hospitality logo"><div class="brand-copy">DJ Hospitality &amp; Facility Management Private Limited<div class="office">Regd. &amp; Head Office:- 730, Tinmade,<br>Sodiem Siolim, Mapusa Bardez,<br>North Goa - 403502</div></div></header>
      <div class="terms-title">TERMS &amp; CONDITIONS</div>
      <div class="terms">This card is not transferable. Show this card when asked. Always co-operate with security checks.</div>
      <div class="details">
        <div class="detail"><span class="label">Name</span><span>:</span><span class="value">${sideValue(emp.name)}</span></div>
        <div class="detail"><span class="label">Father's Name</span><span>:</span><span class="value">${sideValue(emp.fatherName)}</span></div>
        <div class="detail"><span class="label">DOB</span><span>:</span><span class="value">${escapeHtml(fmtDate(emp.dob))}</span></div>
        <div class="detail"><span class="label">Date Of Induction</span><span>:</span><span class="value">${escapeHtml(fmtDate(emp.joiningDate))}</span></div>
        <div class="detail"><span class="label">Status</span><span>:</span><span class="value">${emp.isActive ? "Active" : "Inactive"}</span></div>
      </div>
      <div class="qr">${qrSvg}</div>
      <div class="bottom-cyan"></div><div class="bottom"></div>
    </section>`;
  return { front, back };
}

const employeeCardStyles = `
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #101820; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  .card-side { width: 54mm; height: 92mm; position: relative; overflow: hidden; background: #f8f8f6; break-inside: avoid; }
  .pattern { position: absolute; inset: 0; opacity: .32; background: repeating-linear-gradient(135deg, #e8e8e5 0, #e8e8e5 1px, #f8f8f6 1px, #f8f8f6 5px); }
  .cyan { position: absolute; background: #35b5ed; }
  .brand { position: relative; z-index: 1; height: 26mm; padding: 3mm 2.5mm 2mm; display: flex; align-items: flex-start; gap: 2mm; color: #fff; background: #0751ae; clip-path: polygon(0 0,100% 0,100% 75%,91% 100%,9% 100%,0 75%); }
  .logo { width: 12mm; height: 12mm; border-radius: 50%; object-fit: contain; background: #fff; flex: none; }
  .brand-copy { font-size: 8pt; line-height: 1.17; font-weight: 700; }
  .office { font-size: 5.5pt; line-height: 1.1; margin-top: .7mm; font-weight: 600; overflow: hidden; }
  .front .cyan-one { z-index: 0; width: 19mm; height: 19mm; top: 21mm; right: -4mm; transform: rotate(45deg); }
  .front .portrait { position: absolute; z-index: 2; left: 50%; top: 20mm; transform: translateX(-50%); width: 27mm; height: 27mm; border-radius: 50%; border: 1.1mm solid #0751ae; background: #dce7f3; display: flex; justify-content: center; align-items: center; color: #0751ae; font-size: 20pt; font-weight: 700; overflow: hidden; }
  .front .portrait img { width: 100%; height: 100%; object-fit: cover; }
  .front .name { position: absolute; z-index: 2; top: 47mm; width: 100%; height: 8mm; padding: 0 2mm; display: flex; align-items: center; justify-content: center; text-align: center; font-size: 9pt; line-height: 1.05; font-weight: 800; text-transform: uppercase; overflow-wrap: anywhere; }
  .front .designation { position: absolute; z-index: 2; top: 55.5mm; width: 100%; padding: 0 2mm; text-align: center; font-size: 7pt; letter-spacing: 1.1px; line-height: 1.15; text-transform: uppercase; }
  .front .details { position: absolute; z-index: 2; top: 61.5mm; left: 6mm; right: 3mm; font-size: 6.5pt; line-height: 1.25; }
  .detail { display: grid; grid-template-columns: 18mm 2mm 1fr; margin-bottom: .4mm; }
  .detail .label { white-space: nowrap; }
  .detail .value { overflow-wrap: anywhere; }
  .front .workplace { position: absolute; z-index: 2; bottom: 8mm; width: 100%; padding: 0 3mm; text-align: center; font-size: 6pt; line-height: 1.2; }
  .front .workplace strong { display: block; margin-bottom: 1mm; font-size: 7pt; }
  .front .bottom, .back .bottom { position: absolute; z-index: 1; left: 0; right: 0; bottom: 0; height: 8mm; background: #0751ae; clip-path: polygon(0 48%,31% 0,63% 35%,100% 0,100% 100%,0 100%); }
  .front .bottom-cyan, .back .bottom-cyan { position: absolute; z-index: 1; left: 0; right: 0; bottom: 0; height: 9mm; background: #35b5ed; clip-path: polygon(0 0,100% 78%,100% 100%,0 100%); }
  .back .brand { height: 24mm; padding-top: 3mm; }
  .back .brand-copy { font-size: 7.5pt; }
  .back .office { font-size: 5.2pt; }
  .terms-title { position: absolute; z-index: 2; top: 24.5mm; left: 3mm; right: 3mm; padding: 1mm; text-align: center; background: #35b5ed; font-size: 7pt; line-height: 1.1; font-weight: 800; white-space: nowrap; }
  .terms { position: absolute; z-index: 2; top: 30mm; left: 4mm; right: 3mm; text-align: center; font-size: 6.3pt; line-height: 1.25; }
  .back .details { position: absolute; z-index: 2; top: 41mm; left: 7mm; right: 3mm; font-size: 6.5pt; line-height: 1.25; font-weight: 700; }
  .back .detail { grid-template-columns: 19mm 2mm 1fr; margin-bottom: .4mm; }
  .qr { position: absolute; z-index: 2; width: 23mm; height: 23mm; left: 50%; bottom: 8mm; transform: translateX(-50%); background: white; padding: 1mm; }
  .qr svg { display: block; width: 100%; height: 100%; }
`;

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
  religion: "",
  maritalStatus: "Unmarried",
  email: "",
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
  photoData: "",
  isActive: true,
};

export default function EmployeeMaster() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: clients } = useClientNames();

  const [filterClient, setFilterClient] = useState<string>("all");
  const [filterActive, setFilterActive] = useState<string>("active");
  const [searchText, setSearchText] = useState("");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<number>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [registeringFingerprintId, setRegisteringFingerprintId] = useState<number | null>(null);
  const [qrEmp, setQrEmp] = useState<any>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const photoLoadToken = useRef(0);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoLoadFailed, setPhotoLoadFailed] = useState(false);

  const queryKey = filterClient && filterClient !== "all"
    ? ["/api/employees", filterClient]
    : ["/api/employees"];

  const { data: employees, isLoading, isError, error } = useQuery<Employee[]>({
    queryKey,
    queryFn: async () => {
      const url = filterClient && filterClient !== "all"
        ? `/api/employees?clientName=${encodeURIComponent(filterClient)}`
        : "/api/employees";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(`Failed to fetch employees (${res.status})`);
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
    photoLoadToken.current++;
    setDialogOpen(false);
    setEditingId(null);
    setForm({ ...emptyForm });
    setPhotoLoading(false);
    setPhotoLoadFailed(false);
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
    photoLoadToken.current++;
    setEditingId(null);
    setForm({ ...emptyForm });
    setPhotoLoading(false);
    setPhotoLoadFailed(false);
    setDialogOpen(true);
  };

  const openEdit = (emp: Employee) => {
    const requestToken = ++photoLoadToken.current;
    setEditingId(emp.id);
    setPhotoLoading(true);
    setPhotoLoadFailed(false);
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
      religion: emp.religion || "",
      maritalStatus: emp.maritalStatus || "Unmarried",
      email: emp.email || "",
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
      photoData: "",
      isActive: emp.isActive,
    });
    setDialogOpen(true);
    fetch(`/api/employees/${emp.id}/photo`, { credentials: "include" })
      .then(async response => {
        if (!response.ok) throw new Error(`Could not load employee photo (${response.status})`);
        return response.json();
      })
      .then(data => {
        if (photoLoadToken.current === requestToken) {
          setForm(prev => ({ ...prev, photoData: data.photoData || "" }));
        }
      })
      .catch(error => {
        if (photoLoadToken.current === requestToken) {
          setPhotoLoadFailed(true);
          toast({ title: "Could not load employee photo", description: error.message, variant: "destructive" });
        }
      })
      .finally(() => {
        if (photoLoadToken.current === requestToken) setPhotoLoading(false);
      });
  };

  const handleSubmit = () => {
    if (!form.employeeCode.trim() || !form.name.trim() || !form.clientName) {
      toast({ title: "Please fill required fields", description: "Employee Code, Name, and Client are required.", variant: "destructive" });
      return;
    }
    const payload = {
      ...form,
      ...(editingId && photoLoadFailed ? { photoData: undefined } : {}),
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
  const selectedEmployees = filteredEmployees.filter(emp => selectedEmployeeIds.has(emp.id));
  const allFilteredSelected = filteredEmployees.length > 0 && filteredEmployees.every(emp => selectedEmployeeIds.has(emp.id));

  const toggleEmployeeSelection = (employeeId: number, checked: boolean) => {
    setSelectedEmployeeIds(current => {
      const next = new Set(current);
      if (checked) next.add(employeeId);
      else next.delete(employeeId);
      return next;
    });
  };

  const toggleFilteredSelection = () => {
    setSelectedEmployeeIds(current => {
      const next = new Set(current);
      if (allFilteredSelected) filteredEmployees.forEach(emp => next.delete(emp.id));
      else filteredEmployees.forEach(emp => next.add(emp.id));
      return next;
    });
  };

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

  const handlePrintAllQR = async () => {
    if (!filteredEmployees.length) return;
    const win = window.open("", "_blank");
    if (!win) return;
    const today = new Date();
    const printDate = `${String(today.getDate()).padStart(2,"0")}-${String(today.getMonth()+1).padStart(2,"0")}-${today.getFullYear()}`;
    const clientLabel = filterClient && filterClient !== "all" ? filterClient : "All Clients";

    const cards = await Promise.all(filteredEmployees.map(async (emp) => {
      const data = `CODE:${emp.employeeCode}\nNAME:${emp.name}\nCLIENT:${emp.clientName}`;
      const svg = await QRCodeLib.toString(data, { type: "svg", width: 130, margin: 1 });
      return `
        <div class="qr-card">
          <div class="qr-img">${svg}</div>
          <div class="emp-name">${emp.name}</div>
          <div class="emp-code">${emp.employeeCode}</div>
          <div class="emp-client">${emp.clientName}</div>
        </div>`;
    }));

    win.document.write(`<!DOCTYPE html><html><head><title>Employee QR Codes — ${clientLabel}</title>
    <style>
      @page { size: A4 portrait; margin: 10mm; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; background: #fff; }
      .header { text-align: center; margin-bottom: 8mm; padding-bottom: 4mm; border-bottom: 1.5px solid #333; }
      .header h1 { font-size: 13pt; font-weight: bold; }
      .header p { font-size: 9pt; color: #555; margin-top: 2px; }
      .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5mm; }
      .qr-card { border: 1px solid #ccc; border-radius: 6px; padding: 4mm; text-align: center; page-break-inside: avoid; background: #fafafa; }
      .qr-img svg { width: 100%; height: auto; display: block; }
      .emp-name { font-size: 8.5pt; font-weight: bold; margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .emp-code { font-size: 7.5pt; font-family: monospace; color: #555; margin-top: 1px; }
      .emp-client { font-size: 7pt; color: #777; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .footer { margin-top: 8mm; font-size: 8pt; color: #888; text-align: center; border-top: 1px solid #ddd; padding-top: 3mm; }
    </style></head><body>
    <div class="header">
      <h1>DJ Hospitality &amp; Facility Management Pvt. Ltd.</h1>
      <p>Employee QR Code Sheet &nbsp;|&nbsp; ${clientLabel} &nbsp;|&nbsp; ${printDate} &nbsp;|&nbsp; Total: ${filteredEmployees.length}</p>
    </div>
    <div class="grid">${cards.join("")}</div>
    <div class="footer">DJ KPF &mdash; Employee Identification QR Codes &mdash; Printed: ${printDate}</div>
    </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  };

  const handlePrintEmployeeCard = async (emp: Employee) => {
    const win = window.open("", "_blank", "width=900,height=900");
    if (!win) {
      toast({ title: "Print window blocked", description: "Allow pop-ups for this site, then try printing the employee card.", variant: "destructive" });
      return;
    }
    try {
      const photoResponse = await fetch(`/api/employees/${emp.id}/photo`, { credentials: "include" });
      if (!photoResponse.ok) throw new Error(`Could not load employee photo (${photoResponse.status})`);
      const { photoData } = await photoResponse.json() as { photoData?: string };
      const qrData = `CODE:${emp.employeeCode}\nNAME:${emp.name}\nCLIENT:${emp.clientName}`;
      const qrSvg = await QRCodeLib.toString(qrData, { type: "svg", width: 220, margin: 1, errorCorrectionLevel: "M" });
      const client = (clients || []).find((entry: any) => entry.name === emp.clientName);
      const workplace = client?.address || emp.localAddress || emp.address || emp.permanentAddress || "";
      const logoUrl = new URL(logoPath, window.location.origin).href;
      const { front, back } = renderEmployeeCardSides(emp, qrSvg, photoData || "", logoUrl, workplace, client?.address || "");

      win.document.write(`<!DOCTYPE html>
        <html><head><meta charset="utf-8"><title>Employee Card - ${escapeHtml(emp.employeeCode)}</title>
        <style>${employeeCardStyles}
          @page { size: A4 portrait; margin: 5mm; }
          html, body { width: 200mm; height: 287mm; margin: 0; }
          .card-pair { width: 200mm; height: 287mm; display: flex; align-items: center; justify-content: center; gap: 8mm; break-inside: avoid; }
          .card-side { flex: none; }
          @media screen { body { margin: 8mm auto; outline: 1px solid #bbb; } }
        </style></head><body><main class="card-pair">${front}${back}</main></body></html>`);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 500);
    } catch (err: any) {
      win.close();
      toast({ title: "Could not create employee card", description: err.message || "Please try again.", variant: "destructive" });
    }
  };

  const handlePrintCardsA4 = async () => {
    if (!selectedEmployees.length) {
      toast({ title: "No employees selected", description: "Select one or more employees to print their cards.", variant: "destructive" });
      return;
    }
    const win = window.open("", "_blank", "width=1100,height=800");
    if (!win) {
      toast({ title: "Print window blocked", description: "Allow pop-ups for this site, then try printing employee cards.", variant: "destructive" });
      return;
    }
    try {
      const logoUrl = new URL(logoPath, window.location.origin).href;
      const cards: Array<{ front: string; back: string }> = [];
      for (let start = 0; start < selectedEmployees.length; start += 4) {
        const group = selectedEmployees.slice(start, start + 4);
        const rendered = await Promise.all(group.map(async emp => {
          const [photoResponse, qrSvg] = await Promise.all([
            fetch(`/api/employees/${emp.id}/photo`, { credentials: "include" }),
            QRCodeLib.toString(`CODE:${emp.employeeCode}\nNAME:${emp.name}\nCLIENT:${emp.clientName}`, {
              type: "svg", width: 220, margin: 1, errorCorrectionLevel: "M",
            }),
          ]);
          if (!photoResponse.ok) throw new Error(`Could not load photo for ${emp.name} (${photoResponse.status})`);
          const { photoData } = await photoResponse.json() as { photoData?: string };
          const client = (clients || []).find((entry: any) => entry.name === emp.clientName);
          const workplace = client?.address || emp.localAddress || emp.address || emp.permanentAddress || "";
          return renderEmployeeCardSides(emp, qrSvg, photoData || "", logoUrl, workplace, client?.address || "");
        }));
        cards.push(...rendered);
      }

      const sheets: string[] = [];
      for (let start = 0; start < cards.length; start += 4) {
        const group = cards.slice(start, start + 4);
        const frontCards = [0, 1, 2, 3].map(index =>
          `<div class="card-slot">${group[index]?.front || ""}</div>`
        ).join("");
        const backCards = [1, 0, 3, 2].map(index =>
          `<div class="card-slot">${group[index]?.back || ""}</div>`
        ).join("");
        sheets.push(`<section class="sheet fronts">${frontCards}</section>`);
        sheets.push(`<section class="sheet backs">${backCards}</section>`);
      }
      win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Employee Cards - A4 Portrait</title>
        <style>
          ${employeeCardStyles}
          @page { size: A4 portrait; margin: 5mm; }
          html, body { width: 200mm; margin: 0; }
          .print-help { margin: 0 0 4mm; text-align: center; font: 10pt Arial, sans-serif; }
          .sheet { width: 200mm; height: 287mm; display: grid; grid-template-columns: repeat(2, 1fr); grid-template-rows: repeat(2, 1fr); gap: 2mm; page-break-after: always; break-after: page; }
          .card-slot { display: flex; align-items: center; justify-content: center; min-width: 0; min-height: 0; }
          .card-slot .card-side { transform: scale(1.54); transform-origin: center; }
          .sheet:last-child { page-break-after: auto; break-after: auto; }
          @media print { .print-help { display: none; } }
          @media screen { body { margin: 8mm auto; width: 200mm; } .sheet { outline: 1px solid #bbb; margin-bottom: 8mm; } }
        </style></head><body><div class="print-help">Print A4 portrait, double-sided, flip on long edge. Each back sheet matches the front sheet immediately before it.</div>${sheets.join("")}</body></html>`);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 700);
    } catch (error: any) {
      win.close();
      toast({ title: "Could not prepare employee cards", description: error.message || "Please try again.", variant: "destructive" });
    }
  };

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Employee Master</h1>
            <p className="text-muted-foreground text-xs sm:text-sm mt-1">Manage employee records</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={toggleFilteredSelection} disabled={!filteredEmployees.length}>
              {allFilteredSelected ? "Unselect visible" : "Select visible"}
            </Button>
            {selectedEmployeeIds.size > 0 && (
              <Button variant="ghost" onClick={() => setSelectedEmployeeIds(new Set())}>
                Clear selection ({selectedEmployeeIds.size})
              </Button>
            )}
            <Button variant="outline" onClick={handlePrintCardsA4} disabled={!selectedEmployees.length} className="gap-2 border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400">
              <Printer className="w-4 h-4" /> Print Selected ({selectedEmployees.length}, 4 per page)
            </Button>
            <Button variant="outline" onClick={handlePrintAllQR} className="gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400">
              <QrCode className="w-4 h-4" /> Print All QR
            </Button>
            <Button variant="outline" onClick={handlePrintWeekOfReport}>
              <Printer className="w-4 h-4 mr-2" />
              Print Week Of Report
            </Button>
            <Button onClick={openAdd}>
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
                />
              </div>
              <Select value={filterClient} onValueChange={setFilterClient}>
                <SelectTrigger className="w-full sm:w-48">
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
                <SelectTrigger className="w-full sm:w-36">
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
        ) : isError ? (
          <Card>
            <CardContent className="text-center py-16">
              <Users className="w-12 h-12 text-destructive mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-1">Could not load employees</h3>
              <p className="text-muted-foreground text-sm">
                {error instanceof Error ? error.message : "An unexpected error occurred while loading employees."}
              </p>
            </CardContent>
          </Card>
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
                <Card key={emp.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <Checkbox
                        checked={selectedEmployeeIds.has(emp.id)}
                        onCheckedChange={checked => toggleEmployeeSelection(emp.id, checked === true)}
                        aria-label={`Select ${emp.name} for card printing`}
                        className="mt-1"
                      />
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
                        <Button size="icon" variant="ghost" className="text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20" title="Register Fingerprint" onClick={() => handleRegisterFingerprint(emp)} disabled={registeringFingerprintId === emp.id}>
                          {registeringFingerprintId === emp.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Fingerprint className="w-4 h-4" />}
                        </Button>
                        <Button size="icon" variant="ghost" className="text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20" title="Generate QR Code" onClick={() => setQrEmp(emp)}>
                          <QrCode className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 gap-1 px-2 text-xs" title="Print Employee Card" onClick={() => handlePrintEmployeeCard(emp)}>
                          <Printer className="w-4 h-4" /> Print Card
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => openEdit(emp)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setDeleteId(emp.id)}>
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
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-3 py-2.5 text-center">
                          <Checkbox
                            checked={allFilteredSelected}
                            onCheckedChange={() => toggleFilteredSelection()}
                            aria-label="Select all visible employees"
                          />
                        </th>
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
                        <tr key={emp.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="px-3 py-2.5 text-center">
                            <Checkbox
                              checked={selectedEmployeeIds.has(emp.id)}
                              onCheckedChange={checked => toggleEmployeeSelection(emp.id, checked === true)}
                              aria-label={`Select ${emp.name} for card printing`}
                            />
                          </td>
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
                              <Button size="icon" variant="ghost" className="text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20" title="Register Fingerprint for attendance" onClick={() => handleRegisterFingerprint(emp)} disabled={registeringFingerprintId === emp.id}>
                                {registeringFingerprintId === emp.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Fingerprint className="w-4 h-4" />}
                              </Button>
                              <Button size="icon" variant="ghost" className="text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20" title="Generate QR Code" onClick={() => setQrEmp(emp)}>
                                <QrCode className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="outline" className="h-8 gap-1 px-2 text-xs" title="Print Employee Card" onClick={() => handlePrintEmployeeCard(emp)}>
                                <Printer className="w-4 h-4" /> Print Card
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => openEdit(emp)}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => setDeleteId(emp.id)}>
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

            <p className="text-xs text-muted-foreground text-center">
              Showing {filteredEmployees.length} of {employees?.length || 0} employees
            </p>
          </>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={open => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Employee" : "Add Employee"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-2">
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Users className="w-4 h-4" /> Basic Info
              </h3>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                {form.photoData ? (
                  <img src={form.photoData} alt="Employee preview" className="h-20 w-20 rounded-full border object-cover" />
                ) : (
                  <div className="h-20 w-20 rounded-full border bg-muted flex items-center justify-center text-muted-foreground text-xs">No photo</div>
                )}
                <div className="space-y-1">
                  <Label htmlFor="employeePhoto">Employee Photo</Label>
                  <Input
                    id="employeePhoto"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="max-w-xs"
                    disabled={photoLoading}
                    onChange={async event => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      try {
                        setField("photoData", await encodeEmployeePhoto(file));
                        setPhotoLoadFailed(false);
                      } catch (error: any) {
                        toast({ title: "Photo upload failed", description: error.message || "Choose another photo.", variant: "destructive" });
                      } finally {
                        event.target.value = "";
                      }
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    {photoLoading
                      ? "Loading saved photo..."
                      : photoLoadFailed
                        ? "Saved photo could not be loaded; saving will keep the existing photo."
                        : "JPG, PNG, or WebP. Photo is resized before saving."}
                  </p>
                </div>
                {form.photoData && (
                  <Button type="button" variant="outline" size="sm" onClick={() => { setField("photoData", ""); setPhotoLoadFailed(false); }}>
                    Remove Photo
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="employeeCode">Employee Code *</Label>
                  <Input id="employeeCode" value={form.employeeCode} onChange={e => setField("employeeCode", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="name">Name *</Label>
                  <Input id="name" value={form.name} onChange={e => setField("name", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="fatherName">Father's Name</Label>
                  <Input id="fatherName" value={form.fatherName} onChange={e => setField("fatherName", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="gender">Gender</Label>
                  <Select value={form.gender} onValueChange={v => setField("gender", v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Marital Status */}
                <div>
                  <Label htmlFor="maritalStatus">Marital Status</Label>
                  <Select value={form.maritalStatus} onValueChange={v => setField("maritalStatus", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Unmarried">Unmarried</SelectItem>
                      <SelectItem value="Married">Married</SelectItem>
                      <SelectItem value="Widowed">Widowed</SelectItem>
                      <SelectItem value="Divorced">Divorced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Religion */}
                <div>
                  <Label htmlFor="religion">Religion</Label>
                  <Input id="religion" value={form.religion} onChange={e => setField("religion", e.target.value)} placeholder="e.g. Hindu, Muslim, Christian" />
                </div>

                <div>
                  <Label htmlFor="dob">Date of Birth</Label>
                  <Input id="dob" type="text" inputMode="numeric" placeholder="DD-MM-YYYY"
                    value={form.dob}
                    onChange={e => setField("dob", autoFormatDate(form.dob, e.target.value))} />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="identificationMarks">Identification Marks</Label>
                  <Input id="identificationMarks" value={form.identificationMarks} onChange={e => setField("identificationMarks", e.target.value)} placeholder="e.g. Mole on left cheek, scar on right hand" />
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
                  <Input id="designation" value={form.designation} onChange={e => setField("designation", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="department">Department</Label>
                  <Input id="department" value={form.department} onChange={e => setField("department", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="clientName">Client / Company *</Label>
                  <Select value={form.clientName} onValueChange={v => setField("clientName", v)}>
                    <SelectTrigger>
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
                  <Input id="dailyRate" value={form.dailyRate} onChange={e => setField("dailyRate", e.target.value)} inputMode="decimal" />
                </div>
                <div>
                  <Label htmlFor="fixedHra">Fixed HRA (Monthly)</Label>
                  <Input id="fixedHra" value={form.fixedHra} onChange={e => setField("fixedHra", e.target.value)} inputMode="decimal" placeholder="0" />
                </div>
                <div>
                  <Label htmlFor="weeklyOffDay">Weekly Off Day</Label>
                  <Select value={form.weeklyOffDay || "none"} onValueChange={v => setField("weeklyOffDay", v === "none" ? "" : v)}>
                    <SelectTrigger>
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
                    onChange={e => setField("joiningDate", autoFormatDate(form.joiningDate, e.target.value))} />
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
                  <Input id="esicNo" value={form.esicNo} onChange={e => setField("esicNo", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="pfNo">PF No</Label>
                  <Input id="pfNo" value={form.pfNo} onChange={e => setField("pfNo", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="uanNo">UAN No</Label>
                  <Input id="uanNo" value={form.uanNo} onChange={e => setField("uanNo", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="aadhaarNo">Aadhaar No</Label>
                  <Input id="aadhaarNo" value={form.aadhaarNo} onChange={e => setField("aadhaarNo", e.target.value)} inputMode="numeric" />
                </div>
                <div>
                  <Label htmlFor="panNo">PAN No</Label>
                  <Input id="panNo" value={form.panNo} onChange={e => setField("panNo", e.target.value)} />
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
                  <Input id="bankName" value={form.bankName} onChange={e => setField("bankName", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="accountNo">Account No</Label>
                  <Input id="accountNo" value={form.accountNo} onChange={e => setField("accountNo", e.target.value)} inputMode="numeric" />
                </div>
                <div>
                  <Label htmlFor="ifscCode">IFSC Code</Label>
                  <Input id="ifscCode" value={form.ifscCode} onChange={e => setField("ifscCode", e.target.value)} />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4" /> Address & Contact
              </h3>
              <div className="space-y-3">
                {/* Email Address */}
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" type="email" value={form.email} onChange={e => setField("email", e.target.value)} placeholder="example@email.com" />
                </div>

                <div>
                  <Label htmlFor="permanentAddress">Permanent Address</Label>
                  <Textarea id="permanentAddress" value={form.permanentAddress} onChange={e => setField("permanentAddress", e.target.value)} rows={2} />
                </div>
                <div>
                  <Label htmlFor="localAddress">Local Address</Label>
                  <Textarea id="localAddress" value={form.localAddress} onChange={e => setField("localAddress", e.target.value)} rows={2} />
                </div>
                <div>
                  <Label htmlFor="address">Address (Legacy)</Label>
                  <Textarea id="address" value={form.address} onChange={e => setField("address", e.target.value)} rows={2} />
                </div>
                <div>
                  <Label htmlFor="skills">Skills / Category</Label>
                  <Select value={form.skills || ""} onValueChange={v => setField("skills", v)}>
                    <SelectTrigger>
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
                  <Input id="mobile" value={form.mobile} onChange={e => setField("mobile", e.target.value)} inputMode="tel" />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4" /> Status
              </h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Switch checked={form.isActive} onCheckedChange={v => setField("isActive", v)} />
                  <Label>{form.isActive ? "Active" : "Inactive"}</Label>
                </div>
                {!form.isActive && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="leavingDate">Leaving Date</Label>
                      <Input id="leavingDate" type="text" inputMode="numeric" placeholder="DD-MM-YYYY"
                        value={form.leavingDate ?? ""}
                        onChange={e => setField("leavingDate", autoFormatDate(form.leavingDate ?? "", e.target.value))} />
                    </div>
                    <div>
                      <Label htmlFor="leavingReason">Leaving Reason</Label>
                      <Input id="leavingReason" value={form.leavingReason} onChange={e => setField("leavingReason", e.target.value)} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isSaving || photoLoading}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* QR Code Dialog */}
      <Dialog open={!!qrEmp} onOpenChange={open => { if (!open) setQrEmp(null); }}>
        <DialogContent className="max-w-xs text-center">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-center gap-2">
              <QrCode className="w-4 h-4 text-emerald-600" /> Employee QR Code
            </DialogTitle>
          </DialogHeader>
          {qrEmp && (
            <div className="flex flex-col items-center gap-4 py-2">
              <div id="emp-qr-canvas" className="p-4 bg-white rounded-xl border shadow-sm">
                <QRCodeSVG
                  value={`CODE:${qrEmp.employeeCode}\nNAME:${qrEmp.name}\nCLIENT:${qrEmp.clientName}`}
                  size={200}
                  level="M"
                  includeMargin={false}
                />
              </div>
              <div className="space-y-0.5 text-sm">
                <p className="font-bold text-base">{qrEmp.name}</p>
                <p className="text-muted-foreground font-mono text-xs">{qrEmp.employeeCode}</p>
                <p className="text-muted-foreground text-xs">{qrEmp.clientName}</p>
              </div>
              <Button
                size="sm"
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white w-full"
                onClick={() => {
                  const svg = document.querySelector("#emp-qr-canvas svg") as SVGElement;
                  if (!svg) return;
                  const canvas = document.createElement("canvas");
                  const size = 280;
                  canvas.width = size; canvas.height = size + 70;
                  const ctx = canvas.getContext("2d")!;
                  ctx.fillStyle = "#ffffff";
                  ctx.fillRect(0, 0, canvas.width, canvas.height);
                  const img = new Image();
                  const svgData = new XMLSerializer().serializeToString(svg);
                  img.onload = () => {
                    ctx.drawImage(img, (size - 200) / 2, 10, 200, 200);
                    ctx.fillStyle = "#111827";
                    ctx.font = "bold 14px sans-serif";
                    ctx.textAlign = "center";
                    ctx.fillText(qrEmp.name, size / 2, 230);
                    ctx.fillStyle = "#6b7280";
                    ctx.font = "12px monospace";
                    ctx.fillText(qrEmp.employeeCode, size / 2, 248);
                    ctx.font = "11px sans-serif";
                    ctx.fillText(qrEmp.clientName, size / 2, 264);
                    const a = document.createElement("a");
                    a.href = canvas.toDataURL("image/png");
                    a.download = `qr-${qrEmp.employeeCode}.png`;
                    a.click();
                  };
                  img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
                }}
              >
                <Download className="w-4 h-4" /> Download QR
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={open => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Employee</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this employee? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
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
