import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Save, Loader2, FileDown, Upload, ChevronLeft, ChevronRight, Printer } from "lucide-react";

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
  printWindow.document.write(`<!doctype html><html><head><title>${escapedTitle}</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:12px;margin:24px;color:#111}
      h2{margin:0 0 12px}
      table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #999;padding:5px 7px}
      th{background:#eee}
      @media print{body{margin:8px}thead{display:table-header-group}}
    </style></head><body><h2>${escapedTitle}</h2>${table.outerHTML}</body></html>`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
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
