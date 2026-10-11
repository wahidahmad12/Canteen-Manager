import { Fragment, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Save, Loader2, FileDown } from "lucide-react";

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

export function CustomClientFormTab({ clientId, clientName, month, year, canEdit }: {
  clientId: number; clientName: string; month: number; year: number; canEdit: boolean;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const formKey = ["/api/client-forms", clientId, month, year];

  const { data, isLoading, isError } = useQuery<{ fields: Field[]; entries: Entry[] }>({
    queryKey: formKey,
    queryFn: async () => {
      const res = await fetch(`/api/client-forms/${clientId}?month=${month}&year=${year}`, { credentials: "include" });
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
      await sendJson(`/api/client-forms/${clientId}/fields`, "POST", { label: label.trim(), rate });
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

  const exportMonth = () => {
    const header = ["Date", "Day", ...fields.flatMap(f => [`${f.label} Qty`, `${f.label} Rate`, `${f.label} Amt`]), "Day Total"];
    const rows: (string | number)[][] = dates.map(d => [
      d.label, d.day,
      ...fields.flatMap(f => { const q = qtyOf(f, d.iso); return [q || "", q ? rateFor(f, d.iso) : "", q ? q * rateFor(f, d.iso) : ""]; }),
      rowAmt(d.iso) || "",
    ]);
    rows.push(["Total", "", ...fields.flatMap(f => [fieldQty(f), "", fieldAmt(f)]), grandAmt]);
    downloadXlsx(`${clientName}_${MONTHS[month - 1]}_${year}.xlsx`, "Entry", header, rows);
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
                {fields.filter(f => f.active).map(f => (
                  <div key={f.id} className="flex items-center gap-1 border rounded-md px-2 py-1 bg-background text-xs">
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
              <div className="ml-auto text-sm font-semibold self-center">Grand Total: ₹{fmt(grandAmt)}</div>
            </div>
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-xs">
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
        <CustomClientYearlySummary clientId={clientId} clientName={clientName} year={year} />
      </TabsContent>
    </Tabs>
  );
}

function CustomClientYearlySummary({ clientId, clientName, year }: { clientId: number; clientName: string; year: number }) {
  const { data = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/client-forms/yearly", year],
    queryFn: async () => {
      const res = await fetch(`/api/client-forms/yearly?year=${year}`, { credentials: "include" });
      return res.ok ? res.json() : [];
    },
  });
  const rows = data.filter(r => r.clientId === clientId);
  const labels: string[] = Array.from(new Set(rows.map(r => r.label as string)));
  const cell = (label: string, m: number) => rows.find(r => r.label === label && r.month === m);
  const monthAmt = (m: number) => rows.filter(r => r.month === m).reduce((s, r) => s + r.amount, 0);
  const labelQty = (l: string) => rows.filter(r => r.label === l).reduce((s, r) => s + r.qty, 0);
  const labelAmt = (l: string) => rows.filter(r => r.label === l).reduce((s, r) => s + r.amount, 0);
  const grand = rows.reduce((s, r) => s + r.amount, 0);

  const exportYear = () => {
    const header = ["Month", ...labels.flatMap(l => [`${l} Qty`, `${l} Amt`]), "Total"];
    const out: (string | number)[][] = MONTHS.map((mn, i) => [
      mn, ...labels.flatMap(l => { const c = cell(l, i + 1); return [c?.qty ?? "", c?.amount ?? ""]; }), monthAmt(i + 1) || "",
    ]);
    out.push(["Total", ...labels.flatMap(l => [labelQty(l), labelAmt(l)]), grand]);
    downloadXlsx(`${clientName}_Yearly_${year}.xlsx`, "Yearly", header, out);
  };

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (labels.length === 0) return <div className="text-sm text-muted-foreground py-8 text-center border rounded-lg">{year} me abhi koi saved data nahi hai.</div>;

  return (
    <div>
      <div className="flex items-center mb-3">
        <div className="text-sm font-semibold">{clientName} — {year} Summary</div>
        <Button variant="outline" size="sm" className="ml-auto" onClick={exportYear}><FileDown className="w-4 h-4 mr-1" />Export Excel</Button>
      </div>
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-xs">
          <thead className="bg-muted">
            <tr>
              <th className="p-2 text-left">Month</th>
              {labels.map(l => <th key={l} className="p-2 text-center" colSpan={2}>{l}</th>)}
              <th className="p-2 text-right">Total ₹</th>
            </tr>
            <tr className="text-[10px] text-muted-foreground">
              <th />
              {labels.map(l => <Fragment key={l}><th className="p-1 text-center">Qty</th><th className="p-1 text-center">₹</th></Fragment>)}
              <th />
            </tr>
          </thead>
          <tbody>
            {MONTHS.map((mn, i) => (
              <tr key={mn} className="border-t">
                <td className="p-1.5">{mn}</td>
                {labels.map(l => { const c = cell(l, i + 1); return <Fragment key={l}><td className="p-1.5 text-center">{c ? fmt(c.qty) : ""}</td><td className="p-1.5 text-center">{c ? fmt(c.amount) : ""}</td></Fragment>; })}
                <td className="p-1.5 text-right font-medium">{monthAmt(i + 1) ? fmt(monthAmt(i + 1)) : ""}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-muted font-semibold">
            <tr className="border-t">
              <td className="p-2">Total</td>
              {labels.map(l => <Fragment key={l}><td className="p-2 text-center">{fmt(labelQty(l))}</td><td className="p-2 text-center">{fmt(labelAmt(l))}</td></Fragment>)}
              <td className="p-2 text-right">{fmt(grand)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
