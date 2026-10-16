import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { Layout } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Download, FileText, Loader2, Pencil, Plus, Printer, Save, Trash2, X } from "lucide-react";
import { useLocation } from "wouter";

type RecordType = "LICENCE" | "AGREEMENT";
type LicenceRecord = {
  id: number;
  recordType: RecordType;
  clientName: string;
  licenceName: string;
  licenceNumber: string;
  dateOfIssue: string;
  expiryDate: string;
  renewalDate: string;
  validityDays: number;
  attachmentName: string | null;
};
type RecordForm = Omit<LicenceRecord, "id" | "validityDays" | "attachmentName">;

const emptyForm: RecordForm = {
  recordType: "LICENCE",
  clientName: "",
  licenceName: "",
  licenceNumber: "",
  dateOfIssue: "",
  expiryDate: "",
  renewalDate: "",
};

function daysUntil(date: string) {
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.ceil((Date.parse(`${date}T00:00:00Z`) - todayUtc) / 86400000);
}

function renewalStyle(days: number) {
  if (days <= 15) return "bg-red-700 text-white border-red-800";
  if (days <= 30) return "bg-red-100 text-red-900 border-red-300";
  if (days <= 60) return "bg-yellow-100 text-yellow-900 border-yellow-300";
  return "bg-green-50 text-green-800 border-green-200";
}

function formattedDate(value: string) {
  if (!value) return "";
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}-${month}-${year}`;
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("Could not read the selected PDF"));
    reader.readAsDataURL(file);
  });
}

export default function LicenceAgreementsPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<RecordForm>(emptyForm);
  const [editId, setEditId] = useState<number | null>(null);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [existingAttachmentName, setExistingAttachmentName] = useState<string | null>(null);

  const { data: records = [], isLoading, isError, error } = useQuery<LicenceRecord[]>({
    queryKey: ["/api/licence-agreements"],
    queryFn: async () => (await apiRequest("GET", "/api/licence-agreements")).json(),
  });
  const { data: clients = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/clients");
      return response.json();
    },
  });

  const resetForm = () => {
    setForm(emptyForm);
    setEditId(null);
    setAttachment(null);
    setExistingAttachmentName(null);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.clientName.trim() || !form.licenceName.trim() || !form.licenceNumber.trim()
        || !form.dateOfIssue || !form.expiryDate || !form.renewalDate) {
        throw new Error("Fill all required fields before saving.");
      }
      if (form.expiryDate < form.dateOfIssue) throw new Error("Expiry date cannot be before issue date.");
      if (attachment && (!attachment.name.toLowerCase().endsWith(".pdf") || attachment.size > 10 * 1024 * 1024)) {
        throw new Error("Choose a PDF file no larger than 10 MB.");
      }
      const payload: RecordForm & { attachmentBase64?: string; attachmentName?: string } = { ...form };
      if (attachment) {
        payload.attachmentBase64 = await fileToBase64(attachment);
        payload.attachmentName = attachment.name;
      }
      return apiRequest(editId ? "PUT" : "POST", editId ? `/api/licence-agreements/${editId}` : "/api/licence-agreements", payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/licence-agreements"] });
      toast({ title: editId ? "Record updated" : "Record saved" });
      resetForm();
    },
    onError: (e: Error) => toast({ title: "Could not save record", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/licence-agreements/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/licence-agreements"] });
      toast({ title: "Record deleted" });
    },
    onError: (e: Error) => toast({ title: "Could not delete record", description: e.message, variant: "destructive" }),
  });

  const sortedRecords = useMemo(() => [...records].sort((a, b) => a.renewalDate.localeCompare(b.renewalDate)), [records]);

  const editRecord = (record: LicenceRecord) => {
    setEditId(record.id);
    setForm({
      recordType: record.recordType,
      clientName: record.clientName,
      licenceName: record.licenceName,
      licenceNumber: record.licenceNumber,
      dateOfIssue: record.dateOfIssue.slice(0, 10),
      expiryDate: record.expiryDate.slice(0, 10),
      renewalDate: record.renewalDate.slice(0, 10),
    });
    setExistingAttachmentName(record.attachmentName);
    setAttachment(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const exportExcel = () => {
    const data = sortedRecords.map((record) => ({
      Type: record.recordType === "LICENCE" ? "Licence" : "Agreement",
      "Client Name": record.clientName,
      "Licence / Agreement Name": record.licenceName,
      "Licence / Agreement Number": record.licenceNumber,
      "Date of Issue": formattedDate(record.dateOfIssue),
      "Expiry Date": formattedDate(record.expiryDate),
      "Renewal Date": formattedDate(record.renewalDate),
      "Validity Days": record.validityDays,
      "PDF Attachment": record.attachmentName || "",
    }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data), "Licence & Agreement");
    XLSX.writeFile(workbook, "licence-agreement-records.xlsx");
  };

  return (
    <Layout>
      <style>{`.print-only { display: none; } @media print { @page { size: landscape; margin: 10mm; } .no-print { display: none !important; } .print-only { display: block !important; } body { background: white !important; } .print-records { box-shadow: none !important; border: 1px solid #aaa !important; } .overflow-x-auto { overflow: visible !important; } .print-records table { min-width: 0 !important; width: 100% !important; font-size: 9px !important; } .print-records tr { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`}</style>
      <div className="space-y-5 pb-8">
        <h1 className="print-only text-xl font-bold">Licence Record &amp; Agreement</h1>
        <div className="no-print flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate("/admin")} aria-label="Back to admin"><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="text-2xl font-bold">Licence Record &amp; Agreement</h1>
            <p className="text-sm text-muted-foreground">Manage client licences, agreements, renewals and PDF copies.</p>
          </div>
        </div>

        <Card className="no-print">
          <CardHeader><CardTitle>{editId ? "Edit Record" : "Add Licence or Agreement"}</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label>Record Type *</Label>
                <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.recordType} onChange={(e) => setForm({ ...form, recordType: e.target.value as RecordType })}>
                  <option value="LICENCE">Licence</option><option value="AGREEMENT">Agreement</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Client Name *</Label>
                <Input list="licence-client-list" value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} placeholder="Select or enter client name" />
                <datalist id="licence-client-list">{clients.map((client) => <option key={client.id} value={client.name} />)}</datalist>
              </div>
              <div className="space-y-2"><Label>Licence / Agreement Name *</Label><Input value={form.licenceName} onChange={(e) => setForm({ ...form, licenceName: e.target.value })} placeholder="e.g. FSSAI Licence" /></div>
              <div className="space-y-2"><Label>Licence / Agreement Number *</Label><Input value={form.licenceNumber} onChange={(e) => setForm({ ...form, licenceNumber: e.target.value })} /></div>
              <div className="space-y-2"><Label>Date of Issue *</Label><Input type="date" value={form.dateOfIssue} onChange={(e) => setForm({ ...form, dateOfIssue: e.target.value })} /></div>
              <div className="space-y-2"><Label>Expiry Date *</Label><Input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} /></div>
              <div className="space-y-2"><Label>Renewal Date *</Label><Input type="date" value={form.renewalDate} onChange={(e) => setForm({ ...form, renewalDate: e.target.value })} /></div>
              <div className="space-y-2"><Label>Validity Days</Label><Input readOnly value={form.dateOfIssue && form.expiryDate && form.expiryDate >= form.dateOfIssue ? daysUntil(form.expiryDate) - daysUntil(form.dateOfIssue) : ""} placeholder="Calculated from issue to expiry" /></div>
              <div className="space-y-2">
                <Label>Original Licence / Agreement (PDF, max 10 MB)</Label>
                <Input type="file" accept="application/pdf,.pdf" onChange={(e) => setAttachment(e.target.files?.[0] || null)} />
                {existingAttachmentName && <p className="text-xs text-muted-foreground">Current: {existingAttachmentName}</p>}
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {editId ? "Update Record" : "Save Record"}
              </Button>
              {editId && <Button variant="outline" onClick={resetForm}><X className="mr-2 h-4 w-4" />Cancel Edit</Button>}
            </div>
          </CardContent>
        </Card>

        <Card className="print-records">
          <CardHeader className="no-print flex flex-row flex-wrap items-center justify-between gap-3">
            <CardTitle>Saved Records <Badge variant="secondary">{records.length}</Badge></CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print</Button>
              <Button variant="outline" onClick={exportExcel}><Download className="mr-2 h-4 w-4" />Export Excel</Button>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <div className="mb-3 flex flex-wrap gap-2 text-xs">
              <Badge className="border-yellow-300 bg-yellow-100 text-yellow-900 hover:bg-yellow-100">Renewal within 60 days</Badge>
              <Badge className="border-red-300 bg-red-100 text-red-900 hover:bg-red-100">Within 30 days</Badge>
              <Badge className="border-red-800 bg-red-700 text-white hover:bg-red-700">Within 15 days / overdue</Badge>
            </div>
            {isLoading ? <div className="py-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
              : isError ? <p className="py-5 text-center text-destructive">{error instanceof Error ? error.message : "Could not load records."}</p>
              : sortedRecords.length === 0 ? <p className="py-8 text-center text-muted-foreground">No licence or agreement records saved.</p>
              : <table className="w-full min-w-[1050px] border-collapse text-sm">
                <thead><tr className="border-b text-left">
                  {["Type", "Client", "Licence / Agreement", "Number", "Issue Date", "Expiry Date", "Renewal Date", "Validity Days", "PDF", "Actions"].map((heading) => <th className={`p-2 font-semibold ${heading === "Actions" ? "no-print" : ""}`} key={heading}>{heading}</th>)}
                </tr></thead>
                <tbody>{sortedRecords.map((record) => {
                  const days = daysUntil(record.renewalDate);
                  return <tr key={record.id} className={`border-b ${renewalStyle(days)}`}>
                    <td className="p-2">{record.recordType === "LICENCE" ? "Licence" : "Agreement"}</td>
                    <td className="p-2">{record.clientName}</td>
                    <td className="p-2">{record.licenceName}</td>
                    <td className="p-2">{record.licenceNumber}</td>
                    <td className="p-2">{formattedDate(record.dateOfIssue)}</td>
                    <td className="p-2">{formattedDate(record.expiryDate)}</td>
                    <td className="p-2"><strong>{formattedDate(record.renewalDate)}</strong><div className="text-xs">{days < 0 ? `${Math.abs(days)} days overdue` : `in ${days} days`}</div></td>
                    <td className="p-2">{record.validityDays}</td>
                    <td className="p-2">{record.attachmentName ? <a className="inline-flex items-center gap-1 underline" href={`/api/licence-agreements/${record.id}/attachment`}><FileText className="h-4 w-4" />PDF</a> : "—"}</td>
                    <td className="no-print p-2"><div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => editRecord(record)} aria-label="Edit record"><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => { if (window.confirm("Delete this record and its PDF?")) deleteMutation.mutate(record.id); }} aria-label="Delete record"><Trash2 className="h-4 w-4" /></Button>
                    </div></td>
                  </tr>;
                })}</tbody>
              </table>}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
