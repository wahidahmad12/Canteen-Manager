import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Save, Loader2, FileDown, Upload, ChevronLeft, ChevronRight, Printer } from "lucide-react";
import { CLIENT_COUPON_TYPES, couponMonthlySummary, summarizeCouponForm, type CouponFormData } from "@shared/client-coupons";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const PRESETS = ["Breakfast", "Lunch", "Evening Snack", "Dinner", "Tea"];
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

type Field = { id: number; label: string; rate: number; active: boolean };
type Entry = { fieldId: number; entryDate: string; qty: number; rate: number };

const n = (v: any) => (typeof v === "number" ? v : Number(v) || 0);
const fmt = (v: number) => v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
const keyOf = (fieldId: number, date: string) => `${fieldId}|${date}`;

async function sendJson(url: string, method: string, body?: any) {
  const res = await fetch(url, {
    method, credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Request failed");
  }
  return res.json();
}

async function downloadXlsx(fileName: string, sheetName: string, header: string[], rows: (string | number)[][]) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName.slice(0, 30));
  ws.addRow(header).font = { bold: true };
  rows.forEach(r => ws.addRow(r));
  const buf = await wb.xlsx.writeBuffer();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  a.download = fileName;
  a.click();
}

function printTable(title: string, table: HTMLTableElement | null): boolean {
  if (!table) return false;
  const printWindow = window.open("", "_blank");
  if (!printWindow) return false;
  const escapedTitle = title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const printableTable = table.cloneNode(true) as HTMLTableElement;
  printableTable.style.cssText = "width:100%;border-collapse:collapse;table-layout:auto;border:1px solid #94a3b8";
  Array.from(printableTable.querySelectorAll("input")).forEach(input => {
    const value = input.value;
    input.replaceWith(document.createTextNode(value || ""));
  });
  Array.from(printableTable.querySelectorAll("select,textarea")).forEach(control => {
    const value = control instanceof HTMLSelectElement ? control.selectedOptions[0]?.textContent || "" : control.value;
    control.replaceWith(document.createTextNode(value));
  });
  Array.from(printableTable.querySelectorAll("thead th")).forEach((cell, index, cells) => {
    const background = index < 2 ? "#1e3a5f" : index === cells.length - 1 ? "#155e75" : "#0f766e";
    (cell as HTMLElement).style.cssText = `border:1px solid #ffffff;padding:7px 6px;background:${background};color:#ffffff;font-weight:700;text-align:center`;
  });
  Array.from(printableTable.querySelectorAll("tbody tr")).forEach((row, rowIndex) => {
    Array.from(row.children).forEach((cell, cellIndex, cells) => {
      const background = rowIndex % 2 === 0 ? "#ffffff" : "#e8f4f5";
      (cell as HTMLElement).style.cssText = `border:1px solid #b8cbd3;padding:6px 5px;background:${background};color:${cellIndex === cells.length - 1 ? "#0f4c5c" : "#243746"};text-align:${cellIndex < 2 ? "left" : "center"}`;
    });
  });
  Array.from(printableTable.querySelectorAll("tfoot tr")).forEach((row, rowIndex, rows) => {
    const background = rowIndex === rows.length - 1 ? "#0f766e" : "#dbeafe";
    const color = rowIndex === rows.length - 1 ? "#ffffff" : "#172554";
    Array.from(row.children).forEach(cell => {
      (cell as HTMLElement).style.cssText = `border:1px solid #ffffff;padding:7px 5px;background:${background};color:${color};font-weight:700;text-align:center`;
    });
  });
  printWindow.document.write(`<!doctype html><html><head><title>${escapedTitle}</title>
    <style>
      *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      html,body{width:100%;margin:0;padding:0}
      body{font-family:Arial,sans-serif;font-size:10px;color:#172033}
      .report-header{text-align:center;background:#123b5d;color:#fff;padding:9px 12px;border-bottom:5px solid #14b8a6;margin-bottom:8px}
      .company{font-size:16px;font-weight:700;letter-spacing:.3px}
      .report-type{font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:#b8e6e2;margin-top:3px}
      h2{font-size:13px;margin:6px 0 0;color:#fff}
      table{width:100%;max-width:100%;border-collapse:collapse;table-layout:auto}
      th,td{overflow-wrap:anywhere}
      .signature{display:flex;justify-content:flex-end;margin:28px 8px 0;break-inside:avoid;page-break-inside:avoid}
      .signature-block{min-width:220px;text-align:center;border-top:1px solid #334155;padding-top:6px;font-size:10px;font-weight:700}
      @media print{
        @page{size:A4 landscape;margin:8mm 8mm 14mm}
        @page{@bottom-right{content:"Page " counter(page) " of " counter(pages);font:9px Arial,sans-serif;color:#334155}}
        body{margin:0}
        thead{display:table-header-group}
        tr{break-inside:avoid}
      }
    </style></head><body><header class="report-header" style="text-align:center;background:#123b5d;color:#fff;padding:9px 12px;border-bottom:5px solid #14b8a6;margin-bottom:8px">
      <div class="company" style="font-size:16px;font-weight:700;letter-spacing:.3px">DJ Hospitality &amp; Facility Management Private Limited</div>
      <div class="report-type" style="font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:#b8e6e2;margin-top:3px">Client Meal Ledger</div>
      <h2 style="font-size:13px;margin:6px 0 0;color:#fff">${escapedTitle}</h2>
    </header>${printableTable.outerHTML}<footer class="signature"><div class="signature-block">Authorised Signature for<br>DJ Hospitality &amp; Facility Management Private Limited</div></footer></body></html>`);
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => {
    if (!printWindow.closed) printWindow.print();
  }, 500);
  return true;
}

type ClientForm = { id: number; name: string };

export function CustomClientFormTab({ clientId, clientName, month, year, canEdit }: {
  clientId: number; clientName: string; month: number; year: number; canEdit: boolean;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedFormId, setSelectedFormId] = useState<number | null>(null);
  const [newFormName, setNewFormName] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [deletingForm, setDeletingForm] = useState(false);
  const { data: forms = [], isLoading, isError } = useQuery<ClientForm[]>({
    queryKey: ["/api/client-forms", clientId, "forms"],
    queryFn: async () => {
      const res = await fetch(`/api/client-forms/${clientId}/forms`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load forms");
      return res.json();
    },
  });
  const selectedForm = forms.find(f => f.id === selectedFormId);
  const hasCouponModules = /3b\s+advanced\s+composites/i.test(clientName);

  useEffect(() => {
    if (forms.length > 0 && !forms.some(f => f.id === selectedFormId)) setSelectedFormId(forms[0].id);
    if (forms.length === 0 && selectedFormId !== null) setSelectedFormId(null);
  }, [forms, selectedFormId]);

  useEffect(() => {
    if (selectedForm) setRenameValue(selectedForm.name);
  }, [selectedForm?.id, selectedForm?.name]);

  const createForm = async () => {
    const name = newFormName.trim();
    if (!name) {
      toast({ title: "Form ka naam bharein", variant: "destructive" });
      return;
    }
    try {
      const created = await sendJson(`/api/client-forms/${clientId}/forms`, "POST", { name });
      setNewFormName("");
      await qc.invalidateQueries({ queryKey: ["/api/client-forms", clientId, "forms"] });
      setSelectedFormId(Number(created.id));
      toast({ title: `"${name}" form create ho gaya` });
    } catch (e: any) {
      toast({ title: "Form create nahi hua", description: e.message, variant: "destructive" });
    }
  };

  const renameForm = async () => {
    if (!selectedForm) return;
    const name = renameValue.trim();
    if (!name) {
      toast({ title: "Form ka naam bharein", variant: "destructive" });
      return;
    }
    try {
      await sendJson(`/api/client-forms/${clientId}/forms/${selectedForm.id}`, "PUT", { name });
      await qc.invalidateQueries({ queryKey: ["/api/client-forms", clientId, "forms"] });
      toast({ title: "Form name update ho gaya" });
    } catch (e: any) {
      toast({ title: "Form name update nahi hua", description: e.message, variant: "destructive" });
    }
  };

  const deleteForm = async () => {
    if (!selectedForm || deletingForm) return;
    const warning = `${clientName} — "${selectedForm.name}" form aur uske saare saved data ko permanently delete karein?`;
    if (!window.confirm(warning)) return;
    if (!window.confirm(`Final confirmation: "${selectedForm.name}" aur iska saara data hamesha ke liye delete hoga. Ye undo nahi ho sakta. Kya aap pakka delete karna chahte hain?`)) return;
    setDeletingForm(true);
    try {
      await sendJson(`/api/client-forms/${clientId}/forms/${selectedForm.id}`, "DELETE");
      setSelectedFormId(null);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["/api/client-forms", clientId, "forms"] }),
        qc.invalidateQueries({ queryKey: ["/api/client-forms/yearly"] }),
      ]);
      toast({ title: `"${selectedForm.name}" form aur uska data delete ho gaya` });
    } catch (e: any) {
      toast({ title: "Form delete nahi hua", description: e.message, variant: "destructive" });
    } finally {
      setDeletingForm(false);
    }
  };

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (isError) return <div className="text-sm text-red-600 py-6">Form load nahi ho paya. Page refresh karke dobara try karein.</div>;

  return (
    <Tabs defaultValue="forms">
      {hasCouponModules && (
        <TabsList className="mb-4 flex-wrap h-auto">
          <TabsTrigger value="forms" data-testid="tab-client-forms">Client Forms</TabsTrigger>
          <TabsTrigger value="coupons" data-testid="tab-client-coupons">Coupon Summary</TabsTrigger>
          <TabsTrigger value="requisition" data-testid="tab-client-requisition">Requisition Amount</TabsTrigger>
        </TabsList>
      )}
      <TabsContent value="forms">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {forms.map(form => (
              <Button key={form.id} size="sm" variant={selectedFormId === form.id ? "default" : "outline"} onClick={() => setSelectedFormId(form.id)}>
                {form.name}
              </Button>
            ))}
            {canEdit && (
              <div className="flex flex-wrap items-center gap-2">
                <Input value={newFormName} onChange={e => setNewFormName(e.target.value)} placeholder="New form name" className="w-44 h-9" data-testid="input-client-form-name" />
                <Button size="sm" onClick={createForm} data-testid="btn-create-client-form"><Plus className="w-4 h-4 mr-1" />Create Form</Button>
              </div>
            )}
          </div>
          {selectedForm && (
            <>
              {canEdit && (
                <div className="flex flex-wrap gap-2 items-center">
                  <Input value={renameValue} onChange={e => setRenameValue(e.target.value)} className="w-56 h-9" aria-label="Form name" data-testid="input-rename-client-form" />
                  <Button size="sm" variant="outline" onClick={renameForm} data-testid="btn-rename-client-form"><Save className="w-4 h-4 mr-1" />Rename Form</Button>
                  <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50" onClick={deleteForm} disabled={deletingForm} data-testid="btn-delete-client-form">
                    {deletingForm ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1" />}
                    {deletingForm ? "Deleting..." : "Delete Form"}
                  </Button>
                </div>
              )}
              <ClientNamedForm key={`${selectedForm.id}-${month}-${year}`} clientId={clientId} clientName={clientName} forms={forms} formId={selectedForm.id} formName={selectedForm.name} month={month} year={year} canEdit={canEdit} />
            </>
          )}
          {!selectedForm && (
            <div className="text-sm text-muted-foreground py-8 text-center border rounded-lg">
              Abhi koi form nahi hai. Is client ke liye form banane ke liye upar naam likh kar Create Form dabayein.
            </div>
          )}
        </div>
      </TabsContent>
      {hasCouponModules && (
        <>
          <TabsContent value="coupons">
            <ClientCouponLedger clientId={clientId} clientName={clientName} forms={forms} month={month} year={year} />
          </TabsContent>
          <TabsContent value="requisition">
            <ClientRequisitionAmountTab clientId={clientId} month={month} year={year} canEdit={canEdit} />
          </TabsContent>
        </>
      )}
    </Tabs>
  );
}

function ClientNamedForm({ clientId, clientName, forms, formId, formName, month, year, canEdit }: {
  clientId: number; clientName: string; forms: ClientForm[]; formId: number; formName: string; month: number; year: number; canEdit: boolean;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const formKey = ["/api/client-forms", clientId, formId, month, year];

  const { data, isLoading, isError } = useQuery<{ fields: Field[]; entries: Entry[] }>({
    queryKey: formKey,
    queryFn: async () => {
      const res = await fetch(`/api/client-forms/${clientId}/forms/${formId}?month=${month}&year=${year}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load form");
      return res.json();
    },
  });
  const fields = data?.fields ?? [];

  const [qtys, setQtys] = useState<Record<string, string>>({});
  const [rateSnap, setRateSnap] = useState<Record<string, number>>({});
  const [newLabel, setNewLabel] = useState("");
  const [newRate, setNewRate] = useState("");
  const [saving, setSaving] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const dataImportRef = useRef<HTMLInputElement>(null);
  const monthlyTableRef = useRef<HTMLTableElement>(null);

  useEffect(() => {
    const q: Record<string, string> = {};
    const r: Record<string, number> = {};
    (data?.entries ?? []).forEach(e => { q[keyOf(e.fieldId, e.entryDate)] = String(e.qty); r[keyOf(e.fieldId, e.entryDate)] = e.rate; });
    setQtys(q);
    setRateSnap(r);
  }, [data]);

  const dates = useMemo(() => {
    const last = new Date(year, month, 0).getDate();
    return Array.from({ length: last }, (_, i) => {
      const d = i + 1;
      const iso = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      return { iso, label: `${String(d).padStart(2, "0")}-${String(month).padStart(2, "0")}-${year}`, day: DAYS[new Date(year, month - 1, d).getDay()] };
    });
  }, [month, year]);

  const rateFor = (f: Field, iso: string) => rateSnap[keyOf(f.id, iso)] ?? f.rate;
  const qtyOf = (f: Field, iso: string) => n(qtys[keyOf(f.id, iso)]);
  const fieldQty = (f: Field) => dates.reduce((s, d) => s + qtyOf(f, d.iso), 0);
  const fieldAmt = (f: Field) => dates.reduce((s, d) => s + qtyOf(f, d.iso) * rateFor(f, d.iso), 0);
  const rowAmt = (iso: string) => fields.reduce((s, f) => s + qtyOf(f, iso) * rateFor(f, iso), 0);
  const grandAmt = fields.reduce((s, f) => s + fieldAmt(f), 0);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["/api/client-forms", clientId] });
    qc.invalidateQueries({ queryKey: ["/api/client-forms/yearly"] });
  };

  const addField = async (label: string, rateStr: string) => {
    const rate = Number(rateStr);
    if (!label.trim() || !Number.isFinite(rate) || rate < 0 || rateStr.trim() === "") {
      toast({ title: "Column name aur rate dono bharein", variant: "destructive" });
      return;
    }
    try {
      await sendJson(`/api/client-forms/${clientId}/forms/${formId}/fields`, "POST", { label: label.trim(), rate });
      setNewLabel(""); setNewRate("");
      refresh();
      toast({ title: `"${label.trim()}" column add ho gaya` });
    } catch (e: any) {
      toast({ title: "Add nahi hua", description: e.message, variant: "destructive" });
    }
  };

  const removeField = async (f: Field) => {
    if (!window.confirm(`"${f.label}" column hata dein? Purana saved data summary me rahega.`)) return;
    try {
      await sendJson(`/api/client-forms/fields/${f.id}`, "DELETE");
      refresh();
    } catch (e: any) {
      toast({ title: "Remove nahi hua", description: e.message, variant: "destructive" });
    }
  };

  const moveField = async (f: Field, dir: -1 | 1) => {
    const ids = fields.filter(x => x.active).map(x => x.id);
    const i = ids.indexOf(f.id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    try {
      await sendJson(`/api/client-forms/${clientId}/forms/${formId}/field-order`, "PUT", { ids });
      refresh();
    } catch (e: any) {
      toast({ title: "Move nahi hua", description: e.message, variant: "destructive" });
    }
  };

  const changeRate = async (f: Field, v: string) => {
    const rate = Number(v);
    if (!Number.isFinite(rate) || rate < 0 || rate === f.rate) return;
    try {
      await sendJson(`/api/client-forms/fields/${f.id}`, "PUT", { rate });
      refresh();
    } catch (e: any) {
      toast({ title: "Rate update nahi hua", description: e.message, variant: "destructive" });
    }
  };

  const downloadTemplate = () => {
    const rows = fields.filter(f => f.active).length > 0
      ? fields.filter(f => f.active).map(f => [f.label, f.rate])
      : PRESETS.map(p => [p, 0]);
    downloadXlsx(`${formName.replace(/[^\w-]+/g, "_")}_Form_Template.xlsx`, "Columns", ["Column Name", "Rate"], rows);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const ws = wb.worksheets[0];
      const cellText = (v: any) => String(v && typeof v === "object" ? (v.text ?? v.result ?? "") : (v ?? "")).trim();
      const items: { label: string; rate: number }[] = [];
      ws.eachRow((row, i) => {
        const label = cellText(row.getCell(1).value);
        const rateTxt = cellText(row.getCell(2).value);
        const rate = Number(rateTxt);
        if (i === 1 && /column|name|label/i.test(label)) return;
        if (!label || rateTxt === "" || !Number.isFinite(rate) || rate < 0) return;
        items.push({ label, rate });
      });
      if (items.length === 0) {
        toast({ title: "File me koi valid row nahi mili", description: "Format: Column Name | Rate", variant: "destructive" });
        return;
      }
      let added = 0, updated = 0;
      for (const it of items) {
        const existing = fields.find(f => f.active && f.label.toLowerCase() === it.label.toLowerCase());
        if (existing) {
          if (existing.rate !== it.rate) {
            await sendJson(`/api/client-forms/fields/${existing.id}`, "PUT", { rate: it.rate });
            updated++;
          }
        } else {
          await sendJson(`/api/client-forms/${clientId}/forms/${formId}/fields`, "POST", { label: it.label, rate: it.rate });
          added++;
        }
      }
      refresh();
      toast({ title: "Import ho gaya", description: `${added} column add, ${updated} rate update` });
    } catch (err: any) {
      refresh();
      toast({ title: "Import nahi hua", description: err.message, variant: "destructive" });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const entries: Entry[] = [];
      fields.forEach(f => dates.forEach(d => {
        const k = keyOf(f.id, d.iso);
        if (qtys[k] !== undefined || rateSnap[k] !== undefined) {
          entries.push({ fieldId: f.id, entryDate: d.iso, qty: qtyOf(f, d.iso), rate: rateFor(f, d.iso) });
        }
      }));
      await sendJson("/api/client-forms/entries", "PUT", { entries });
      refresh();
      toast({ title: "Saved", description: `${clientName} — ${MONTHS[month - 1]} ${year}` });
    } catch (e: any) {
      toast({ title: "Save nahi hua", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const deleteMonthData = async () => {
    if (!window.confirm(`${clientName} — ${MONTHS[month - 1]} ${year} ka saara data delete karein? Ye undo nahi hoga.`)) return;
    try {
      await sendJson(`/api/client-forms/${clientId}/forms/${formId}/entries?month=${month}&year=${year}`, "DELETE");
      setQtys({});
      setRateSnap({});
      refresh();
      toast({ title: "Data delete ho gaya", description: `${MONTHS[month - 1]} ${year}` });
    } catch (e: any) {
      toast({ title: "Delete nahi hua", description: e.message, variant: "destructive" });
    }
  };

  const downloadDataTemplate = () => {
    const header = ["Date", ...fields.map(f => f.label)];
    const rows = dates.map(d => [d.label, ...fields.map(f => qtyOf(f, d.iso) || "")]);
    downloadXlsx(`${clientName}_${formName}_Data_Template_${MONTHS[month - 1]}_${year}.xlsx`, "Data", header, rows);
  };

  const handleDataImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const ws = wb.worksheets[0];
      const text = (v: any) => String(v && typeof v === "object" && !(v instanceof Date) ? (v.text ?? v.result ?? "") : (v ?? "")).trim();
      const colByField = new Map<number, number>();
      ws.getRow(1).eachCell((cell, col) => {
        const h = text(cell.value).toLowerCase().replace(/\s+qty$/, "");
        const f = fields.find(x => x.label.toLowerCase() === h);
        if (f) colByField.set(f.id, col);
      });
      if (colByField.size === 0) {
        toast({ title: "Header me koi column match nahi hua", description: "Pehle Template download karke use bharein", variant: "destructive" });
        return;
      }
      const toIso = (v: any): string | null => {
        if (v instanceof Date) {
          return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, "0")}-${String(v.getUTCDate()).padStart(2, "0")}`;
        }
        const s = text(v);
        const m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
        if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
        if (/^\d{1,2}$/.test(s)) return `${year}-${String(month).padStart(2, "0")}-${s.padStart(2, "0")}`;
        return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
      };
      const valid = new Set(dates.map(d => d.iso));
      const next = { ...qtys };
      let count = 0;
      ws.eachRow((row, i) => {
        if (i === 1) return;
        const iso = toIso(row.getCell(1).value);
        if (!iso || !valid.has(iso)) return;
        colByField.forEach((col, fieldId) => {
          const raw = text(row.getCell(col).value);
          if (raw === "") return;
          const q = Number(raw);
          if (!Number.isFinite(q) || q < 0) return;
          next[keyOf(fieldId, iso)] = String(q);
          count++;
        });
      });
      setQtys(next);
      toast({ title: "Import ho gaya", description: `${count} entries load hui. Save dabana na bhoolein.` });
    } catch (err: any) {
      toast({ title: "Import nahi hua", description: err.message, variant: "destructive" });
    }
  };

  const exportMonth = () => {
    const header = ["Date", "Day", ...fields.flatMap(f => [`${f.label} Qty`, `${f.label} Rate`, `${f.label} Amt`]), "Day Total"];
    const rows: (string | number)[][] = dates.map(d => [
      d.label, d.day,
      ...fields.flatMap(f => { const q = qtyOf(f, d.iso); return [q || "", q ? rateFor(f, d.iso) : "", q ? q * rateFor(f, d.iso) : ""]; }),
      rowAmt(d.iso) || "",
    ]);
    rows.push(["Total", "", ...fields.flatMap(f => [fieldQty(f), "", fieldAmt(f)]), grandAmt]);
    downloadXlsx(`${clientName}_${formName}_${MONTHS[month - 1]}_${year}.xlsx`, "Entry", header, rows);
  };

  const unusedPresets = PRESETS.filter(p => !fields.some(f => f.label.toLowerCase() === p.toLowerCase()));

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (isError) return <div className="text-sm text-red-600 py-6">Form load nahi ho paya. Page refresh karke dobara try karein.</div>;

  return (
    <Tabs defaultValue="entry">
      <TabsList className="mb-4 flex-wrap h-auto">
        <TabsTrigger value="entry" data-testid="tab-custom-entry">Data Entry</TabsTrigger>
        <TabsTrigger value="summary" data-testid="tab-custom-summary">Yearly Summary</TabsTrigger>
      </TabsList>

      <TabsContent value="entry">
        {canEdit && (
          <div className="mb-4 p-3 rounded-lg border bg-muted/30 space-y-2">
            <div className="text-sm font-semibold">Form Builder — columns (Breakfast, Lunch, Tea ...) aur unka rate</div>
            <div className="flex flex-wrap gap-2 items-center">
              <Input placeholder="Column name (e.g. Lemon Tea)" value={newLabel} onChange={e => setNewLabel(e.target.value)} className="w-52 h-9" data-testid="input-custom-field-label" />
              <Input type="number" min="0" step="0.01" placeholder="Rate ₹" value={newRate} onChange={e => setNewRate(e.target.value)} className="w-28 h-9" data-testid="input-custom-field-rate" />
              <Button size="sm" onClick={() => addField(newLabel, newRate)} data-testid="btn-add-custom-field"><Plus className="w-4 h-4 mr-1" />Add Column</Button>
                            <Button size="sm" variant="outline" onClick={downloadTemplate} data-testid="btn-form-template"><FileDown className="w-4 h-4 mr-1" />Template</Button>
                            <Button size="sm" variant="outline" onClick={() => importRef.current?.click()} data-testid="btn-form-import"><Upload className="w-4 h-4 mr-1" />Import</Button>
                            <input ref={importRef} type="file" accept=".xlsx" className="hidden" onChange={handleImport} />
                          </div>
            {unusedPresets.length > 0 && (
              <div className="flex flex-wrap gap-1 items-center text-xs text-muted-foreground">
                Quick add:
                {unusedPresets.map(p => (
                  <Button key={p} size="sm" variant="outline" className="h-7 text-xs" onClick={() => setNewLabel(p)}>{p}</Button>
                ))}
              </div>
            )}
            {fields.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {fields.filter(f => f.active).map((f, idx, arr) => (
                  <div key={f.id} className="flex items-center gap-1 border rounded-md px-2 py-1 bg-background text-xs">
                    <Button size="icon" variant="ghost" className="h-6 w-6" disabled={idx === 0} onClick={() => moveField(f, -1)} title="Move left"><ChevronLeft className="w-3.5 h-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6" disabled={idx === arr.length - 1} onClick={() => moveField(f, 1)} title="Move right"><ChevronRight className="w-3.5 h-3.5" /></Button>
                    <span className="font-medium">{f.label}</span>
                    <span>₹</span>
                    <Input key={`${f.id}-${f.rate}`} type="number" min="0" step="0.01" defaultValue={f.rate} onBlur={e => changeRate(f, e.target.value)} className="w-20 h-7 text-xs" title="Naye entries ke liye rate (purane saved din same rahenge)" />
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-red-600" onClick={() => removeField(f)} title="Remove column"><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {fields.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center border rounded-lg">
            Abhi koi column nahi hai. Upar se Breakfast / Lunch / Tea jaisa column add karke form banayein.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-3">
              {canEdit && (
                <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="btn-custom-save">
                  {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}Save
                </Button>
              )}
              <Button variant="outline" onClick={exportMonth} data-testid="btn-custom-export"><FileDown className="w-4 h-4 mr-1" />Export Excel</Button>
              <Button variant="outline" onClick={() => {
                if (!printTable(`${clientName} — ${formName} — ${MONTHS[month - 1]} ${year}`, monthlyTableRef.current)) {
                  toast({ title: "Print window nahi khula", description: "Browser me pop-up allow karein.", variant: "destructive" });
                }
              }} data-testid="btn-custom-print"><Printer className="w-4 h-4 mr-1" />Print</Button>
              <Button variant="outline" onClick={downloadDataTemplate} data-testid="btn-data-template"><FileDown className="w-4 h-4 mr-1" />Data Template</Button>
              {canEdit && (
                <>
                  <Button variant="outline" onClick={() => dataImportRef.current?.click()} data-testid="btn-data-import"><Upload className="w-4 h-4 mr-1" />Import Data</Button>
                  <input ref={dataImportRef} type="file" accept=".xlsx" className="hidden" onChange={handleDataImport} />
                  <Button variant="outline" className="border-red-300 text-red-600 hover:bg-red-50" onClick={deleteMonthData} data-testid="btn-data-delete"><Trash2 className="w-4 h-4 mr-1" />Delete Data</Button>
                </>
              )}
              <div className="ml-auto text-sm font-semibold self-center">Grand Total: ₹{fmt(grandAmt)}</div>
            </div>
            <div className="overflow-x-auto border rounded-lg">
              <table ref={monthlyTableRef} className="w-full text-xs">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-2 text-left">Date</th>
                    <th className="p-2 text-left">Day</th>
                    {fields.map(f => <th key={f.id} className="p-2 text-center">{f.label}<div className="font-normal text-[10px]">₹{fmt(f.rate)}</div></th>)}
                    <th className="p-2 text-right">Day Total ₹</th>
                  </tr>
                </thead>
                <tbody>
                  {dates.map(d => (
                    <tr key={d.iso} className={`border-t ${d.day === "Sun" ? "bg-amber-50 dark:bg-amber-900/10" : ""}`}>
                      <td className="p-1.5 whitespace-nowrap">{d.label}</td>
                      <td className="p-1.5">{d.day}</td>
                      {fields.map(f => (
                        <td key={f.id} className="p-1">
                          <Input
                            type="number" min="0" step="any" disabled={!canEdit}
                            value={qtys[keyOf(f.id, d.iso)] ?? ""}
                            onChange={e => setQtys(p => ({ ...p, [keyOf(f.id, d.iso)]: e.target.value }))}
                            onKeyDown={e => {
                              const step = e.key === "Enter" || e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
                              if (!step) return;
                              e.preventDefault();
                              const idx = dates.findIndex(x => x.iso === d.iso) + step;
                              if (idx < 0 || idx >= dates.length) return;
                              const nextEl = document.querySelector<HTMLInputElement>(`[data-testid="input-custom-${f.id}-${dates[idx].iso}"]`);
                              nextEl?.focus();
                              nextEl?.select();
                            }}
                            className="h-8 w-20 mx-auto text-center text-xs"
                            data-testid={`input-custom-${f.id}-${d.iso}`}
                          />
                        </td>
                      ))}
                      <td className="p-1.5 text-right font-medium">{rowAmt(d.iso) ? fmt(rowAmt(d.iso)) : ""}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted font-semibold">
                  <tr className="border-t">
                    <td className="p-2" colSpan={2}>Total Qty</td>
                    {fields.map(f => <td key={f.id} className="p-2 text-center">{fmt(fieldQty(f))}</td>)}
                    <td />
                  </tr>
                  <tr>
                    <td className="p-2" colSpan={2}>Total Amount ₹</td>
                    {fields.map(f => <td key={f.id} className="p-2 text-center">{fmt(fieldAmt(f))}</td>)}
                    <td className="p-2 text-right">{fmt(grandAmt)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </TabsContent>

      <TabsContent value="summary">
        <CustomClientYearlySummary clientId={clientId} clientName={clientName} forms={forms} year={year} />
      </TabsContent>
    </Tabs>
  );
}

type CouponKind = "employeeCount" | "contractorCount";
const couponEntryKey = (entryDate: string, couponType: string) => `${entryDate}|${couponType}`;

function ClientCouponLedger({ clientId, clientName, forms, month, year }: {
  clientId: number; clientName: string; forms: ClientForm[]; month: number; year: number;
}) {
  const { toast } = useToast();
  const formByName = (name: string) => forms.find(form => form.name.trim().replace(/\s+/g, " ").toLowerCase() === name);
  const employeeForm = formByName("employee coupon");
  const contractorForm = formByName("contractor coupon");
  const { data, isFetching, isError } = useQuery<{ employee: CouponFormData; contractor: CouponFormData }>({
    queryKey: ["/api/client-coupon-summary", clientId, employeeForm?.id, contractorForm?.id, month, year],
    enabled: Boolean(employeeForm && contractorForm),
    refetchOnMount: "always",
    refetchInterval: false,
    queryFn: async () => {
      if (!employeeForm || !contractorForm) throw new Error("Coupon forms not found");
      const loadForm = async (formId: number): Promise<CouponFormData> => {
        const res = await fetch(`/api/client-forms/${clientId}/forms/${formId}?month=${month}&year=${year}`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to load coupon form");
        return res.json();
      };
      const [employee, contractor] = await Promise.all([loadForm(employeeForm.id), loadForm(contractorForm.id)]);
      return { employee, contractor };
    },
  });

  const dates = useMemo(() => {
    const last = new Date(year, month, 0).getDate();
    return Array.from({ length: last }, (_, index) =>
      `${year}-${String(month).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`,
    );
  }, [month, year]);

  if (!employeeForm || !contractorForm) {
    const missing = [!employeeForm && "Employee Coupon", !contractorForm && "Contractor Coupon"].filter(Boolean).join(", ");
    return <div className="text-sm text-red-600 py-6">Coupon summary ke liye ye existing form nahi mila: {missing}.</div>;
  }
  if (isFetching) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (isError || !data) return <div className="text-sm text-red-600 py-6">Coupon forms load nahi ho paye. Page refresh karke dobara try karein.</div>;

  const employee = summarizeCouponForm(data.employee);
  const contractor = summarizeCouponForm(data.contractor);
  const errors = [
    employee.missing.length && `Employee Coupon: columns missing — ${employee.missing.join(", ")}`,
    contractor.missing.length && `Contractor Coupon: columns missing — ${contractor.missing.join(", ")}`,
    employee.unrecognized.length && `Employee Coupon: saved columns not recognized — ${employee.unrecognized.join(", ")}`,
    contractor.unrecognized.length && `Contractor Coupon: saved columns not recognized — ${contractor.unrecognized.join(", ")}`,
  ].filter(Boolean);
  if (errors.length) {
    return <div className="text-sm text-red-600 py-6"><p>Coupon summary nahi ban sakti. Form columns check karein:</p>{errors.map(error => <p key={error}>{error}</p>)}</div>;
  }

  const getCount = (entryDate: string, couponType: string, kind: CouponKind) =>
    (kind === "employeeCount" ? employee : contractor).counts[couponEntryKey(entryDate, couponType)] ?? 0;
  const summary = couponMonthlySummary(employee.counts, contractor.counts, dates);
  const grandAmount = summary.reduce((total, row) => total + row.totalAmount, 0);
  const printMonthlyReport = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast({ title: "Print window nahi khula", description: "Browser me pop-up allow karein.", variant: "destructive" });
      return;
    }
    const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const employeeTotals = CLIENT_COUPON_TYPES.map(type =>
      dates.reduce((total, date) => total + getCount(date, type.value, "employeeCount"), 0));
    const contractorTotals = CLIENT_COUPON_TYPES.map(type =>
      dates.reduce((total, date) => total + getCount(date, type.value, "contractorCount"), 0));
    const dailyTable = `<table class="daily-table">
      <colgroup><col class="date-column">${CLIENT_COUPON_TYPES.map(() => '<col class="qty-column">').join("")}${CLIENT_COUPON_TYPES.map(() => '<col class="qty-column">').join("")}</colgroup>
      <thead>
        <tr><th rowspan="2">Date</th><th colspan="${CLIENT_COUPON_TYPES.length}">Denominations Qty - Employee</th><th colspan="${CLIENT_COUPON_TYPES.length}">Denominations Qty - Contractors</th></tr>
        <tr>${CLIENT_COUPON_TYPES.map(type => `<th>${type.label}</th>`).join("")}${CLIENT_COUPON_TYPES.map(type => `<th>${type.label}</th>`).join("")}</tr>
      </thead>
      <tbody>${dates.map(date => `<tr><td>${date.slice(-2)}-${String(month).padStart(2, "0")}-${year}</td>${CLIENT_COUPON_TYPES.map(type => `<td>${getCount(date, type.value, "employeeCount") || ""}</td>`).join("")}${CLIENT_COUPON_TYPES.map(type => `<td>${getCount(date, type.value, "contractorCount") || ""}</td>`).join("")}</tr>`).join("")}</tbody>
      <tfoot><tr><th>TOTAL</th>${employeeTotals.map(total => `<th>${total || ""}</th>`).join("")}${contractorTotals.map(total => `<th>${total || ""}</th>`).join("")}</tr></tfoot>
    </table>`;
    const summaryTable = `<table class="summary"><thead><tr><th colspan="5">Monthly Summary</th></tr><tr><th>Coupon Amount</th><th>Employee Coupon</th><th>Contractor Coupon</th><th>Total Coupon</th><th>Total Amount</th></tr></thead>
      <tbody>${summary.map(row => `<tr><td>${row.label}</td><td>${row.employeeCount}</td><td>${row.contractorCount}</td><td>${row.totalCoupon}</td><td>₹${fmt(row.totalAmount)}</td></tr>`).join("")}</tbody>
      <tfoot><tr><th colspan="4">Total Amount</th><th>₹${fmt(grandAmount)}</th></tr></tfoot></table>`;
    const title = `${clientName} — Coupon Report — ${MONTHS[month - 1]} ${year}`;
    printWindow.document.write(`<!doctype html><html><head><title>${escapeHtml(title)}</title><style>
      @page{size:A4 landscape;margin:5mm}
      *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      body{font-family:Arial,sans-serif;font-size:7px;margin:0;color:#111}
      h1{text-align:center;font-size:12px;margin:0 0 5px}
      table{width:100%;border-collapse:collapse;table-layout:fixed}
      th,td{border:1px solid #444;text-align:center;padding:1px;white-space:nowrap}
      thead{background:#e5e7eb;font-weight:bold}
      tfoot{font-weight:bold;background:#e5e7eb}
      .daily-table{width:auto;margin:0 auto;font-size:7px}
      .date-column{width:76px}
      .qty-column{width:40px}
      .daily-table thead th{padding:2px 0}
      .daily-table tbody td{font-variant-numeric:tabular-nums}
      .summary{width:38%;margin:5px auto 0;font-size:8px}
      .summary thead tr:first-child{background:#1f4e79;color:#fff}
      .summary thead tr:nth-child(2){background:#e6b8b7}
    </style></head><body><h1>${escapeHtml(title)}</h1>${dailyTable}${summaryTable}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => {
      if (!printWindow.closed) printWindow.print();
    }, 500);
  };

  return (
    <div>
        <p className="text-sm text-muted-foreground mb-3">Saved Employee Coupon aur Contractor Coupon forms ka monthly summary. Changes ke baad pehle form save karein.</p>
        <div className="mb-3">
          <Button variant="outline" onClick={printMonthlyReport} data-testid="btn-print-coupon-report">
            <Printer className="w-4 h-4 mr-1" />Print Full Monthly Report
          </Button>
        </div>
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full min-w-[560px] text-sm border-collapse" data-testid="table-coupon-monthly-summary">
            <thead>
              <tr><th colSpan={5} className="bg-[#1f4e79] text-white text-base p-2">Monthly Summary</th></tr>
              <tr className="bg-[#e6b8b7] text-center">
                <th className="border p-2">Coupon Amount</th>
                <th className="border p-2">Employee Coupon</th>
                <th className="border p-2">Contractor Coupon</th>
                <th className="border p-2">Total Coupon</th>
                <th className="border p-2">Total Amount</th>
              </tr>
            </thead>
            <tbody>
              {summary.map(row => (
                <tr key={row.value} className="text-center">
                  <td className="border p-1.5">{row.label}</td>
                  <td className="border p-1.5">{row.employeeCount || ""}</td>
                  <td className="border p-1.5">{row.contractorCount || ""}</td>
                  <td className="border p-1.5">{row.totalCoupon || ""}</td>
                  <td className="border p-1.5">{row.totalAmount ? `₹${fmt(row.totalAmount)}` : ""}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="font-semibold">
              <tr>
                <td colSpan={4} className="border p-2 text-right">Total Amount</td>
                <td className="border p-2 text-center">₹{fmt(grandAmount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
    </div>
  );
}

type RequisitionAmountRow = {
  id?: number;
  slNo: number;
  dateOfSupply: string;
  particulars: string;
  qty: number;
  ratePerPlate: number;
  total: number;
  _dirty?: boolean;
};

function emptyRequisitionRow(slNo: number): RequisitionAmountRow {
  return { slNo, dateOfSupply: "", particulars: "", qty: 0, ratePerPlate: 0, total: 0, _dirty: false };
}

function ClientRequisitionAmountTab({ clientId, month, year, canEdit }: {
  clientId: number; month: number; year: number; canEdit: boolean;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [rows, setRows] = useState<RequisitionAmountRow[]>([emptyRequisitionRow(1)]);
  const [saving, setSaving] = useState(false);
  const queryKey = ["/api/client-requisition-amounts", clientId, month, year];
  const { data = [], isLoading, isError } = useQuery<RequisitionAmountRow[]>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/client-forms/${clientId}/requisition-amounts?month=${month}&year=${year}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load requisition amounts");
      return res.json();
    },
    refetchInterval: false,
  });

  useEffect(() => {
    setRows(data.length > 0
      ? data.map(row => ({ ...row, qty: Number(row.qty) || 0, ratePerPlate: Number(row.ratePerPlate) || 0, total: Number(row.total) || 0, _dirty: false }))
      : [emptyRequisitionRow(1)]);
  }, [data, month, year]);

  const updateRow = (index: number, field: keyof RequisitionAmountRow, value: string | number) => {
    setRows(previous => {
      const next = [...previous];
      const row = { ...next[index], [field]: value, _dirty: true };
      if (field === "qty" || field === "ratePerPlate") {
        const qty = field === "qty" ? Number(value) : Number(next[index].qty);
        const rate = field === "ratePerPlate" ? Number(value) : Number(next[index].ratePerPlate);
        row.total = Number((qty * rate).toFixed(2));
      }
      next[index] = row;
      return next;
    });
  };

  const addRow = () => setRows(previous => [...previous, emptyRequisitionRow(previous.length + 1)]);

  const deleteRow = async (index: number) => {
    const row = rows[index];
    if (row.id) {
      try {
        const res = await fetch(`/api/client-forms/${clientId}/requisition-amounts/${row.id}`, { method: "DELETE", credentials: "include" });
        if (!res.ok) {
          const error = await res.json().catch(() => ({}));
          throw new Error(error.message || "Could not delete requisition row");
        }
      } catch (error: any) {
        toast({ title: "Delete failed", description: error.message, variant: "destructive" });
        return;
      }
    }
    setRows(previous => previous
      .filter((_, rowIndex) => rowIndex !== index)
      .map((item, rowIndex) => ({ ...item, slNo: rowIndex + 1, _dirty: Boolean(item.id) })));
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      for (let index = 0; index < rows.length; index++) {
        const row = rows[index];
        if (!row._dirty) continue;
        const payload = {
          month, year, slNo: index + 1, dateOfSupply: row.dateOfSupply,
          particulars: row.particulars, qty: row.qty, ratePerPlate: row.ratePerPlate,
        };
        const res = await fetch(
          row.id
            ? `/api/client-forms/${clientId}/requisition-amounts/${row.id}`
            : `/api/client-forms/${clientId}/requisition-amounts`,
          {
            method: row.id ? "PUT" : "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
        );
        if (!res.ok) {
          const error = await res.json().catch(() => ({}));
          throw new Error(error.message || `Could not save row ${index + 1}`);
        }
      }
      await qc.invalidateQueries({ queryKey });
      toast({ title: "Requisition amounts saved" });
    } catch (error: any) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (isError) return <div className="text-sm text-red-600 py-6">Requisition amounts could not be loaded. Refresh and try again.</div>;

  const grandTotal = rows.reduce((total, row) => total + row.total, 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-base text-blue-900">Requisition Amount — {MONTHS[month - 1]} {year}</h3>
        {canEdit && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={addRow} data-testid="btn-add-requisition-row">
              <Plus className="w-4 h-4 mr-1" />Add Row
            </Button>
            <Button size="sm" onClick={saveAll} disabled={saving} data-testid="btn-save-requisition-amounts">
              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
              Save All
            </Button>
          </div>
        )}
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[780px] border-collapse text-sm" data-testid="table-requisition-amounts">
          <thead>
            <tr className="bg-[#1f4e79] text-white">
              <th className="border border-blue-300 px-3 py-2.5 text-center">Sl. No.</th>
              <th className="border border-blue-300 px-3 py-2.5 text-center">Date of Supply</th>
              <th className="border border-blue-300 px-4 py-2.5 text-center">Particulars</th>
              <th className="border border-blue-300 px-3 py-2.5 text-center">Qty</th>
              <th className="border border-blue-300 px-3 py-2.5 text-center">Rate Per Plate</th>
              <th className="border border-blue-300 px-3 py-2.5 text-center">Total</th>
              {canEdit && <th className="border border-blue-300 px-2 py-2.5" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id ?? `new-${index}`} className={row._dirty ? "bg-amber-50" : index % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                <td className="border border-slate-200 px-2 py-1 text-center text-slate-500">{index + 1}</td>
                <td className="border border-slate-200 px-2 py-1">
                  <Input type="date" value={row.dateOfSupply} disabled={!canEdit} onChange={event => updateRow(index, "dateOfSupply", event.target.value)} className="h-8 min-w-36 text-xs" />
                </td>
                <td className="border border-slate-200 px-2 py-1">
                  <Input value={row.particulars} disabled={!canEdit} onChange={event => updateRow(index, "particulars", event.target.value)} className="h-8 min-w-48 text-xs" />
                </td>
                <td className="border border-slate-200 px-2 py-1">
                  <Input type="number" min="0" step="any" value={row.qty || ""} disabled={!canEdit} onChange={event => updateRow(index, "qty", Number(event.target.value) || 0)} className="h-8 min-w-20 text-center text-xs" />
                </td>
                <td className="border border-slate-200 px-2 py-1">
                  <Input type="number" min="0" step="0.01" value={row.ratePerPlate || ""} disabled={!canEdit} onChange={event => updateRow(index, "ratePerPlate", Number(event.target.value) || 0)} className="h-8 min-w-28 text-center text-xs" />
                </td>
                <td className="border border-slate-200 px-2 py-1 text-right font-medium">{fmt(row.total)}</td>
                {canEdit && (
                  <td className="border border-slate-200 px-1 py-1 text-center">
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600" onClick={() => deleteRow(index)} aria-label={`Delete requisition row ${index + 1}`}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-muted font-semibold">
            <tr>
              <td colSpan={canEdit ? 5 : 4} className="border p-2 text-right">Total Amount</td>
              <td className="border p-2 text-right">{fmt(grandTotal)}</td>
              {canEdit && <td className="border" />}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function CustomClientYearlySummary({ clientId, clientName, forms, year }: { clientId: number; clientName: string; forms: ClientForm[]; year: number }) {
  const { toast } = useToast();
  const tableRef = useRef<HTMLTableElement>(null);
  const { data = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/client-forms/yearly", year, clientId],
    queryFn: async () => {
      const res = await fetch(`/api/client-forms/yearly?year=${year}&clientId=${clientId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load yearly summary");
      return res.json();
    },
  });
  const monthAmount = (formId: number, month: number) =>
    Number(data.find(r => r.formId === formId && r.month === month)?.amount) || 0;
  const formTotal = (formId: number) => MONTHS.reduce((sum, _, i) => sum + monthAmount(formId, i + 1), 0);
  const monthTotal = (month: number) => forms.reduce((sum, form) => sum + monthAmount(form.id, month), 0);
  const grand = forms.reduce((sum, form) => sum + formTotal(form.id), 0);

  const exportYear = () => {
    const header = ["Month", ...forms.map(f => f.name), "All Forms Total"];
    const out: (string | number)[][] = MONTHS.map((mn, i) => [
      mn, ...forms.map(f => monthAmount(f.id, i + 1) || ""), monthTotal(i + 1) || "",
    ]);
    out.push(["Year Total", ...forms.map(f => formTotal(f.id)), grand]);
    downloadXlsx(`${clientName}_All_Forms_Yearly_${year}.xlsx`, "Yearly", header, out);
  };

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (forms.length === 0) return <div className="text-sm text-muted-foreground py-8 text-center border rounded-lg">Abhi koi form nahi hai.</div>;

  return (
    <div>
      <div className="flex items-center mb-3">
        <div className="text-sm font-semibold">{clientName} — All Forms — Monthly &amp; Yearly Summary ({year})</div>
        <Button variant="outline" size="sm" className="ml-auto" onClick={exportYear}><FileDown className="w-4 h-4 mr-1" />Export Excel</Button>
        <Button variant="outline" size="sm" className="ml-2" onClick={() => {
          if (!printTable(`${clientName} — All Forms — Monthly & Yearly Summary (${year})`, tableRef.current)) {
            toast({ title: "Print window nahi khula", description: "Browser me pop-up allow karein.", variant: "destructive" });
          }
        }} data-testid="btn-custom-yearly-print"><Printer className="w-4 h-4 mr-1" />Print</Button>
      </div>
      <div className="overflow-x-auto border rounded-lg">
        <table ref={tableRef} className="w-full text-xs">
          <thead className="bg-muted">
            <tr>
              <th className="p-2 text-left">Month</th>
              {forms.map(form => <th key={form.id} className="p-2 text-right">{form.name} ₹</th>)}
              <th className="p-2 text-right">All Forms Total ₹</th>
            </tr>
          </thead>
          <tbody>
            {MONTHS.map((mn, i) => (
              <tr key={mn} className="border-t">
                <td className="p-1.5">{mn}</td>
                {forms.map(form => <td key={form.id} className="p-1.5 text-right">{monthAmount(form.id, i + 1) ? fmt(monthAmount(form.id, i + 1)) : ""}</td>)}
                <td className="p-1.5 text-right font-medium">{monthTotal(i + 1) ? fmt(monthTotal(i + 1)) : ""}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-muted font-semibold">
            <tr className="border-t">
              <td className="p-2">Year Total</td>
              {forms.map(form => <td key={form.id} className="p-2 text-right">{fmt(formTotal(form.id))}</td>)}
              <td className="p-2 text-right">{fmt(grand)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
