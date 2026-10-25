import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Printer, Save, FileDown, FileUp, Loader2 } from "lucide-react";

type Contractor = { id: number; name: string; sortOrder: number; isActive: boolean };
type MealType = { mealType: string; enabled: boolean };
type Entry = { entryDate: string; contractorId: number; mealType: string; qty: number };

const MEALS: { key: string; label: string }[] = [
  { key: "breakfast", label: "Contractor Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "evening_snacks", label: "Evening Snacks" },
  { key: "dinner", label: "Dinner" },
];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WEEKDAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const pad = (n: number) => String(n).padStart(2, "0");
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmt = (iso: string) => { const [y, m, d] = iso.split("-"); return `${d}-${m}-${y}`; };

function billingDates(month: number, year: number): string[] {
  const nm = month === 12 ? 1 : month + 1;
  const ny = month === 12 ? year + 1 : year;
  const cur = new Date(`${year}-${pad(month)}-21T00:00:00`);
  const end = new Date(`${ny}-${pad(nm)}-20T00:00:00`);
  const out: string[] = [];
  while (cur <= end) { out.push(toIso(cur)); cur.setDate(cur.getDate() + 1); }
  return out;
}

function parseImportDate(v: any): string {
  if (v instanceof Date) return toIso(new Date(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()));
  const s = String(v ?? "").trim();
  if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(s)) { const [d, m, y] = s.split(/[-/]/); return `${y}-${m}-${d}`; }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return "";
}

export function UblFormat3Tab({ month, year, loadKey = 0 }: { month: number; year: number; loadKey?: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const [meal, setMeal] = useState("breakfast");
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [newName, setNewName] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  const dates = useMemo(() => billingDates(month, year), [month, year]);
  const key = (d: string, c: number, m: string) => `${d}|${c}|${m}`;

  const { data: contractors = [] } = useQuery<Contractor[]>({
    queryKey: ["/api/ubl-f3/contractors"],
    queryFn: async () => (await fetch("/api/ubl-f3/contractors", { credentials: "include" })).json(),
  });
  const { data: mealTypes = [] } = useQuery<MealType[]>({
    queryKey: ["/api/ubl-f3/meal-types"],
    queryFn: async () => (await fetch("/api/ubl-f3/meal-types", { credentials: "include" })).json(),
  });
  const { data: entries = [], isLoading, refetch } = useQuery<Entry[]>({
    queryKey: ["/api/ubl-f3/entries", month, year],
    queryFn: async () => (await fetch(`/api/ubl-f3/entries?month=${month}&year=${year}`, { credentials: "include" })).json(),
  });

  useEffect(() => {
    const m: Record<string, number> = {};
    (Array.isArray(entries) ? entries : []).forEach(e => { m[key(String(e.entryDate).slice(0, 10), e.contractorId, e.mealType)] = e.qty; });
    setDraft(m); setDirty(new Set());
  }, [entries]);
  useEffect(() => { if (loadKey > 0) refetch(); }, [loadKey]);

  const active = (Array.isArray(contractors) ? contractors : []).filter(c => c.isActive);
  const enabledMeals = new Set(["breakfast", ...(Array.isArray(mealTypes) ? mealTypes : []).filter(m => m.enabled).map(m => m.mealType)]);
  const curMeal = enabledMeals.has(meal) ? meal : "breakfast";
  const label = MEALS.find(m => m.key === curMeal)!.label;

  const val = (d: string, c: number, m = curMeal) => draft[key(d, c, m)] || 0;
  const dayTotal = (d: string, m = curMeal) => active.reduce((s, c) => s + val(d, c.id, m), 0);
  const colTotal = (c: number, m = curMeal) => dates.reduce((s, d) => s + val(d, c, m), 0);
  const grand = (m = curMeal) => dates.reduce((s, d) => s + dayTotal(d, m), 0);
  const hasData = (m: string) => grand(m) > 0;

  const setCell = (d: string, c: number, v: string) => {
    const k = key(d, c, curMeal);
    setDraft(p => ({ ...p, [k]: Math.max(0, parseInt(v) || 0) }));
    setDirty(p => new Set(p).add(k));
  };

  const saveMut = useMutation({
    mutationFn: async (list: Entry[]) => {
      const res = await fetch("/api/ubl-f3/entries/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ entries: list }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "Save failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/ubl-f3/entries", month, year] });
      qc.invalidateQueries({ queryKey: ["/api/ubl-date-entries"] });
    },
  });

  const saveAll = async () => {
    if (!dirty.size) { toast({ title: "Nothing to save" }); return; }
    const list: Entry[] = Array.from(dirty).map(k => {
      const [entryDate, c, mealType] = k.split("|");
      return { entryDate, contractorId: Number(c), mealType, qty: draft[k] || 0 };
    });
    try {
      await saveMut.mutateAsync(list);
      toast({ title: "Saved", description: curMeal === "breakfast" ? "Cont. Brkft in Format 1 updated." : undefined });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };

  const api = async (url: string, method: string, body: any) => {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body) });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "Request failed");
  };

  const addContractor = async () => {
    try {
      await api("/api/ubl-f3/contractors", "POST", { name: newName });
      setNewName(""); setShowAdd(false);
      qc.invalidateQueries({ queryKey: ["/api/ubl-f3/contractors"] });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };
  const renameContractor = async (id: number) => {
    try {
      await api(`/api/ubl-f3/contractors/${id}`, "PUT", { name: editName });
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ["/api/ubl-f3/contractors"] });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };
  const toggleContractor = async (c: Contractor) => {
    try {
      await api(`/api/ubl-f3/contractors/${c.id}`, "PUT", { isActive: !c.isActive });
      qc.invalidateQueries({ queryKey: ["/api/ubl-f3/contractors"] });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };
  const toggleMeal = async (m: string, enabled: boolean) => {
    try {
      await api(`/api/ubl-f3/meal-types/${m}`, "PUT", { enabled });
      if (!enabled && meal === m) setMeal("breakfast");
      qc.invalidateQueries({ queryKey: ["/api/ubl-f3/meal-types"] });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };

  const exportExcel = async () => {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(label.slice(0, 30));
    const thin = { top: { style: "thin" as const }, bottom: { style: "thin" as const }, left: { style: "thin" as const }, right: { style: "thin" as const } };
    const hdr = ws.addRow(["SI", "Date", "Month", "Day", ...active.map(c => c.name), "Total"]);
    hdr.eachCell(cell => { cell.font = { bold: true, color: { argb: "FFFFFFFF" } }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A3A5A" } }; cell.border = thin; cell.alignment = { horizontal: "center" }; });
    dates.forEach((d, i) => {
      const r = ws.addRow([i + 1, fmt(d), Number(d.split("-")[1]), WEEKDAYS[new Date(d + "T00:00:00").getDay()], ...active.map(c => val(d, c.id) || ""), dayTotal(d) || ""]);
      r.eachCell(cell => { cell.border = thin; cell.alignment = { horizontal: "center" }; });
    });
    const t = ws.addRow(["", "Total", "", "", ...active.map(c => colTotal(c.id)), grand()]);
    t.eachCell(cell => { cell.font = { bold: true }; cell.border = thin; cell.alignment = { horizontal: "center" }; });
    ws.columns.forEach(c => { c.width = 14; });
    const buf = await wb.xlsx.writeBuffer();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    a.download = `UBL_Format3_${label.replace(/\s+/g, "")}_${MONTHS[month - 1]}_${year}.xlsx`;
    a.click();
  };

  const importExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    e.target.value = "";
    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const ws = wb.worksheets[0];
      const headers: string[] = [];
      ws.getRow(1).eachCell({ includeEmpty: true }, (cell, ci) => { headers[ci - 1] = String(cell.value ?? "").trim(); });
      const dateCol = headers.indexOf("Date");
      const colMap = new Map<number, number>();
      active.forEach(c => { const i = headers.findIndex(h => h.toLowerCase() === c.name.toLowerCase()); if (i >= 0) colMap.set(i, c.id); });
      if (dateCol < 0 || colMap.size === 0) { toast({ title: "Import Failed", description: "Header must have 'Date' and contractor name columns.", variant: "destructive" }); return; }
      const allowed = new Set(dates);
      const next = { ...draft }; const nd = new Set(dirty);
      let count = 0; let outside = 0;
      ws.eachRow((row, ri) => {
        if (ri === 1) return;
        const d = parseImportDate(row.getCell(dateCol + 1).value);
        if (!d) return;
        if (!allowed.has(d)) { outside++; return; }
        colMap.forEach((cid, ci) => {
          const raw = row.getCell(ci + 1).value;
          const q = Math.max(0, parseInt(String((raw as any)?.result ?? raw ?? 0)) || 0);
          const k = key(d, cid, curMeal);
          if ((next[k] || 0) !== q) { next[k] = q; nd.add(k); }
        });
        count++;
      });
      if (outside > 0 && count === 0) { toast({ title: "Date Mismatch — Import Cancelled", description: "File dates are outside the selected billing period.", variant: "destructive" }); return; }
      setDraft(next); setDirty(nd);
      toast({ title: `Imported ${count} rows`, description: "Review and click Save All to persist." });
    } catch (err: any) { toast({ title: "Import Failed", description: err.message, variant: "destructive" }); }
  };

  const printable = [...enabledMeals].map(m => MEALS.find(x => x.key === m)!).filter(m => m && hasData(m.key));

  const handlePrint = () => {
    if (!printable.length) { toast({ title: "Nothing to print", description: "No Format 3 data in this period." }); return; }
    const html = printRef.current?.innerHTML; if (!html) return;
    const win = window.open("", "_blank"); if (!win) return;
    win.document.write(`<html><head><title>UBL Format 3</title><style>
      body{font-family:"Times New Roman",serif;margin:0;font-size:11pt;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      h3,h4,p{text-align:center;margin:2px 0;}
      table{width:100%;border-collapse:collapse;margin:6px 0 14px;}
      th,td{border:1px solid #333;padding:1px 3px;text-align:center;font-size:10pt;white-space:nowrap;}
      th{background:#1a3a5a!important;color:#fff!important;}
      .tot{font-weight:bold;background:#e8f0fe!important;}
      .pb{page-break-after:always;}
      @media print{@page{margin:5mm;size:A4 portrait;}tr{page-break-inside:avoid;}}
    </style></head><body>${html}</body></html>`);
    win.document.close(); win.print();
  };

  const periodLabel = `${fmt(dates[0])} – ${fmt(dates[dates.length - 1])}`;

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        {MEALS.filter(m => enabledMeals.has(m.key)).map(m => (
          <Button key={m.key} size="sm" variant={curMeal === m.key ? "default" : "outline"} onClick={() => setMeal(m.key)} className="h-9 text-sm">{m.label}</Button>
        ))}
        <span className="flex items-center gap-2 text-xs text-muted-foreground ml-2">
          Optional:
          {MEALS.filter(m => m.key !== "breakfast").map(m => (
            <label key={m.key} className="flex items-center gap-1 cursor-pointer">
              <input type="checkbox" checked={enabledMeals.has(m.key)} onChange={e => toggleMeal(m.key, e.target.checked)} />{m.label}
            </label>
          ))}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <Button size="sm" onClick={saveAll} className="bg-green-600 text-white h-10 px-4 text-sm" disabled={saveMut.isPending}><Save className="w-4 h-4 mr-1.5" />Save All</Button>
        <Button size="sm" variant="outline" onClick={() => setShowAdd(s => !s)} className="h-10 px-4 text-sm"><Plus className="w-4 h-4 mr-1.5" />Add Contractor</Button>
        <Button size="sm" variant="outline" onClick={handlePrint} className="h-10 px-4 text-sm"><Printer className="w-4 h-4 mr-1.5" />Print</Button>
        <Button size="sm" variant="outline" onClick={exportExcel} className="h-10 px-4 text-sm text-green-700 border-green-300" disabled={!active.length}><FileDown className="w-4 h-4 mr-1.5" />Export Excel</Button>
        <Button size="sm" variant="outline" onClick={() => importRef.current?.click()} className="h-10 px-4 text-sm text-blue-700 border-blue-300" disabled={!active.length}><FileUp className="w-4 h-4 mr-1.5" />Import Excel</Button>
        <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={importExcel} />
      </div>

      {showAdd && (
        <div className="flex gap-2 mb-3">
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Contractor name" className="border rounded px-2 h-9 text-sm" maxLength={100} />
          <Button size="sm" onClick={addContractor} disabled={!newName.trim()}>Add</Button>
        </div>
      )}

      {contractors.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3 text-xs">
          {contractors.map(c => (
            <span key={c.id} className={`border rounded px-2 py-1 flex items-center gap-1 ${c.isActive ? "" : "opacity-50"}`}>
              {editingId === c.id ? (
                <>
                  <input value={editName} onChange={e => setEditName(e.target.value)} className="border rounded px-1 h-6 w-32" maxLength={100} />
                  <button className="text-green-700" onClick={() => renameContractor(c.id)}>Save</button>
                  <button onClick={() => setEditingId(null)}>Cancel</button>
                </>
              ) : (
                <>
                  {c.name}
                  <button title="Edit" onClick={() => { setEditingId(c.id); setEditName(c.name); }}><Pencil className="w-3 h-3" /></button>
                  <button className="underline" onClick={() => toggleContractor(c)}>{c.isActive ? "Hide" : "Show"}</button>
                </>
              )}
            </span>
          ))}
        </div>
      )}

      {active.length === 0 ? (
        <div className="text-sm text-muted-foreground py-6 text-center">No contractors yet. Click "Add Contractor" to begin.</div>
      ) : (
        <div className="overflow-x-auto">
          <div className="text-center font-bold text-sm py-1.5 mb-1" style={{ background: "#1a3a5a", color: "#fff" }}>UBL — Format 3: Bill Data Sheet — {label} — {periodLabel}</div>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr style={{ background: "#1a3a5a", color: "#fff" }}>
                <th className="border px-1">SI</th><th className="border px-1">Date</th><th className="border px-1">Month</th><th className="border px-1">Day</th>
                {active.map(c => <th key={c.id} className="border px-1">{c.name}</th>)}
                <th className="border px-1">Total</th>
              </tr>
            </thead>
            <tbody>
              {dates.map((d, i) => {
                const wd = new Date(d + "T00:00:00").getDay();
                return (
                  <tr key={d} style={{ background: wd === 0 ? "#ffa500" : wd === 3 ? "#90EE90" : undefined }}>
                    <td className="border text-center">{i + 1}</td>
                    <td className="border text-center whitespace-nowrap">{fmt(d)}</td>
                    <td className="border text-center">{Number(d.split("-")[1])}</td>
                    <td className="border text-center">{WEEKDAYS[wd]}</td>
                    {active.map(c => (
                      <td key={c.id} className="border text-center">
                        <input type="number" min={0} value={val(d, c.id) || ""} onChange={e => setCell(d, c.id, e.target.value)}
                          style={{ width: 56, border: "none", background: "transparent", textAlign: "center", outline: "none" }} />
                      </td>
                    ))}
                    <td className="border text-center font-semibold">{dayTotal(d) || ""}</td>
                  </tr>
                );
              })}
              <tr className="font-bold" style={{ background: "#e8f0fe" }}>
                <td className="border text-center" colSpan={4}>Total</td>
                {active.map(c => <td key={c.id} className="border text-center">{colTotal(c.id)}</td>)}
                <td className="border text-center">{grand()}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: "none" }}>
        <div ref={printRef}>
          {printable.map((m, idx) => (
            <div key={m.key} className={idx < printable.length - 1 ? "pb" : ""}>
              <h3>DJ Hospitality &amp; Facility Management Pvt Ltd</h3>
              <h4>United Breweries Ltd, Kalyani</h4>
              <p>Bill Data Sheet — {m.label} — {periodLabel}</p>
              <table>
                <thead>
                  <tr><th>SI</th><th>Date</th><th>Month</th><th>Day</th>{active.map(c => <th key={c.id}>{c.name}</th>)}<th>Total</th></tr>
                </thead>
                <tbody>
                  {dates.map((d, i) => (
                    <tr key={d}>
                      <td>{i + 1}</td><td>{fmt(d)}</td><td>{Number(d.split("-")[1])}</td><td>{WEEKDAYS[new Date(d + "T00:00:00").getDay()]}</td>
                      {active.map(c => <td key={c.id}>{val(d, c.id, m.key) || ""}</td>)}
                      <td>{dayTotal(d, m.key) || ""}</td>
                    </tr>
                  ))}
                  <tr className="tot"><td colSpan={4}>Total</td>{active.map(c => <td key={c.id}>{colTotal(c.id, m.key)}</td>)}<td>{grand(m.key)}</td></tr>
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
