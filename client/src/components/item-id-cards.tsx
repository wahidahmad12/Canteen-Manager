import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useItemMaster, useCreateItemMasterItem } from "@/hooks/use-reports";
import { Printer, Plus, Upload, Trash2, Pencil, Package } from "lucide-react";

type DateOverride = { PurchaseDate?: string; MfgDate?: string; ExpDate?: string };
type LocalItem = { ItemCode: string; ItemName: string } & DateOverride;
type Row = { key: string; ItemCode: string; ItemName: string; Category: string; local: boolean } & DateOverride;

const LOCAL_KEY = "idCardLocalItems";
const DATES_KEY = "idCardDates";

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

const IDC_CSS = `
.idc-board{display:flex;flex-wrap:wrap;gap:2%;row-gap:4mm;align-content:flex-start}
.idc-card{background:#fff;border:2px solid #003366;border-left:8px solid #003366;width:48.5%;height:52mm;padding:4px 6px;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;position:relative;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.idc-remove{position:absolute;top:4px;right:4px;background:#e74c3c;color:#fff;border:none;border-radius:50%;width:22px;height:22px;font-size:10px;cursor:pointer;z-index:10}
.idc-header{text-align:center;border-bottom:2px solid #003366;padding-bottom:3px;margin-bottom:3px;padding-right:20px}
.idc-company{font-size:7.5pt;font-weight:bold;text-transform:uppercase;color:#006400;line-height:1.1;margin-bottom:2px}
.idc-title{font-size:10pt;font-weight:900;color:#003366;letter-spacing:1px}
.idc-body p{margin:2px 0;font-size:8.5pt;color:#000}
.idc-label{font-weight:bold;display:inline-block;width:70px;font-size:8.5pt}
.idc-name{font-size:15pt!important;font-weight:900!important;color:#003366!important;margin:4px 0!important;line-height:1.1;text-align:center!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.idc-date{margin:6px 0!important;display:flex;align-items:center;position:relative;z-index:2}
.idc-blank{display:inline-block;width:135px;border-bottom:1.5px solid}
.idc-dval{font-weight:bold;font-size:9pt}
.idc-qr{position:absolute;bottom:8px;right:8px;width:50px;height:50px;z-index:1}
.idc-qr svg{width:100%!important;height:100%!important}
@media print{
  body *{visibility:hidden!important}
  #idc-print-area,#idc-print-area *{visibility:visible!important}
  #idc-print-area{position:absolute;left:0;top:0;width:100%}
  .idc-remove{display:none!important}
  body.idc-normal .idc-board{justify-content:space-between;gap:0;row-gap:3mm}
  body.idc-normal .idc-card{width:48.5%;height:54mm;margin-bottom:2mm;page-break-inside:avoid}
  body.idc-normal .idc-card:nth-child(10n){page-break-after:always}
  body.idc-landscape .idc-board{display:block}
  body.idc-landscape .idc-card{width:100%;height:175mm;margin:0 auto;border:8px solid #003366;border-left:30px solid #003366;border-radius:15px;padding:40px;page-break-after:always;justify-content:center}
  body.idc-landscape .idc-header{border-bottom:5px solid #003366;padding-bottom:15px;margin-bottom:20px}
  body.idc-landscape .idc-company{font-size:22pt;margin-bottom:10px}
  body.idc-landscape .idc-title{font-size:32pt}
  body.idc-landscape .idc-body p{font-size:20pt;margin:15px 0}
  body.idc-landscape .idc-label{width:160px;font-size:22pt}
  body.idc-landscape .idc-name{font-size:55pt!important;margin:30px 0!important;white-space:normal}
  body.idc-landscape .idc-dval{font-size:24pt}
  body.idc-landscape .idc-blank{width:450px;border-bottom-width:4px}
  body.idc-landscape .idc-qr{width:220px;height:220px;bottom:40px;right:40px}
}
`;

function DateSpan({ value, color }: { value?: string; color: string }) {
  if (value && value.trim() !== "") {
    return <span className="idc-dval" style={{ color }}>{value}</span>;
  }
  return <span className="idc-blank" style={{ borderBottomColor: color }}>&nbsp;</span>;
}

export function ItemIdCards() {
  const { toast } = useToast();
  const { data: masterItems = [] } = useItemMaster();
  const createItem = useCreateItemMasterItem();

  const [localItems, setLocalItems] = useState<LocalItem[]>(() => load<LocalItem[]>(LOCAL_KEY, []));
  const [dates, setDates] = useState<Record<string, DateOverride>>(() => load(DATES_KEY, {}));
  const [board, setBoard] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [editing, setEditing] = useState<{ row: Row | null; isNew: boolean } | null>(null);
  const [form, setForm] = useState({ ItemCode: "", ItemName: "", PurchaseDate: "", MfgDate: "", ExpDate: "" });

  const saveLocal = (items: LocalItem[]) => {
    setLocalItems(items);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(items));
  };
  const saveDates = (d: Record<string, DateOverride>) => {
    setDates(d);
    localStorage.setItem(DATES_KEY, JSON.stringify(d));
  };

  const rows: Row[] = useMemo(() => {
    const db: Row[] = (masterItems as any[]).map((it) => ({
      key: `db-${it.id}`,
      ItemCode: `P${String(it.id).padStart(4, "0")}`,
      ItemName: it.itemName,
      Category: it.itemCategory || "General",
      local: false,
      ...(dates[`db-${it.id}`] || {}),
    }));
    const loc: Row[] = localItems.map((it, i) => ({ key: `local-${i}`, local: true, Category: "", ...it }));
    return [...db, ...loc];
  }, [masterItems, localItems, dates]);

  const categories = useMemo(
    () => Array.from(new Set(rows.map((r) => r.Category).filter(Boolean))).sort(),
    [rows],
  );

  const filtered = rows.filter((r) => {
    const q = search.toLowerCase();
    const matchText =
      r.ItemCode.toLowerCase().includes(q) ||
      r.ItemName.toLowerCase().includes(q) ||
      r.Category.toLowerCase().includes(q);
    return matchText && (categoryFilter === "all" || r.Category === categoryFilter);
  });

  const nextCode = () => {
    let max = 0;
    rows.forEach((r) => {
      const m = r.ItemCode.match(/^P(\d+)$/i);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return `P${String(max + 1).padStart(4, "0")}`;
  };

  const openAdd = () => {
    setForm({ ItemCode: nextCode(), ItemName: "", PurchaseDate: "", MfgDate: "", ExpDate: "" });
    setEditing({ row: null, isNew: true });
  };
  const openEdit = (row: Row) => {
    setForm({
      ItemCode: row.ItemCode,
      ItemName: row.ItemName,
      PurchaseDate: row.PurchaseDate || "",
      MfgDate: row.MfgDate || "",
      ExpDate: row.ExpDate || "",
    });
    setEditing({ row, isNew: false });
  };

  const handleSave = async () => {
    if (!editing) return;
    const dateFields: DateOverride = { PurchaseDate: form.PurchaseDate, MfgDate: form.MfgDate, ExpDate: form.ExpDate };
    try {
      if (editing.isNew) {
        if (!form.ItemName.trim()) {
          toast({ title: "Item name required", variant: "destructive" });
          return;
        }
        const created: any = await createItem.mutateAsync({ itemName: form.ItemName.trim(), itemType: "purchase" });
        saveDates({ ...dates, [`db-${created.id}`]: dateFields });
      } else if (editing.row?.local) {
        const idx = Number(editing.row.key.replace("local-", ""));
        const next = [...localItems];
        next[idx] = { ItemCode: form.ItemCode, ItemName: form.ItemName, ...dateFields };
        saveLocal(next);
      } else if (editing.row) {
        saveDates({ ...dates, [editing.row.key]: dateFields });
      }
      setEditing(null);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const deleteLocal = (row: Row) => {
    if (!confirm("Delete this imported item?")) return;
    const idx = Number(row.key.replace("local-", ""));
    saveLocal(localItems.filter((_, i) => i !== idx));
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = XLSX.read(new Uint8Array(ev.target?.result as ArrayBuffer), { type: "array" });
      const json = XLSX.utils.sheet_to_json<any>(wb.Sheets[wb.SheetNames[0]], { raw: false });
      const imported: LocalItem[] = json
        .filter((r) => r.ItemName)
        .map((r) => ({
          ItemCode: String(r.ItemCode || ""),
          ItemName: String(r.ItemName),
          PurchaseDate: r.PurchaseDate ? String(r.PurchaseDate) : "",
          MfgDate: r.MfgDate ? String(r.MfgDate) : "",
          ExpDate: r.ExpDate ? String(r.ExpDate) : "",
        }));
      saveLocal([...localItems, ...imported]);
      toast({ title: "Imported", description: `${imported.length} items imported` });
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const addCards = (row: Row) => {
    const qty = parseInt(prompt("Ek saath kitne cards print board par add karne hain? (e.g., 1, 10)", "1") || "");
    if (!isNaN(qty) && qty > 0) setBoard((b) => [...b, ...Array.from({ length: qty }, () => row)]);
  };

  const addAll = () => {
    setBoard((b) => [...b, ...filtered]);
    toast({ title: `${filtered.length} items added to Print Board` });
  };

  const triggerPrint = (mode: "normal" | "landscape") => {
    let style = document.getElementById("idc-page-style");
    if (!style) {
      style = document.createElement("style");
      style.id = "idc-page-style";
      document.head.appendChild(style);
    }
    style.innerHTML =
      mode === "landscape"
        ? "@media print { @page { size: A4 landscape; margin: 10mm; } }"
        : "@media print { @page { size: A4 portrait; margin: 5mm; } }";
    document.body.classList.remove("idc-normal", "idc-landscape");
    document.body.classList.add(mode === "landscape" ? "idc-landscape" : "idc-normal");
    setTimeout(() => window.print(), 100);
  };

  return (
    <Card className="border-0 shadow-lg overflow-hidden" data-testid="card-item-id-cards">
      <style>{IDC_CSS}</style>
      <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white pb-3 pt-4">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Package className="w-5 h-5" /> Item ID Cards
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={openAdd} className="bg-purple-600 hover:bg-purple-700"><Plus className="w-4 h-4 mr-1" />Add New Item</Button>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <Upload className="w-4 h-4" /> Import Excel:
            <input type="file" accept=".xlsx,.xls" onChange={handleImport} />
          </label>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="destructive" onClick={() => confirm("Clear all cards from the Print Board?") && setBoard([])}>Clear Print Board</Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={() => triggerPrint("normal")}><Printer className="w-4 h-4 mr-1" />Print (10/Page)</Button>
            <Button className="bg-orange-600 hover:bg-orange-700" onClick={() => triggerPrint("landscape")}><Printer className="w-4 h-4 mr-1" />Print Big (1/Page)</Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 justify-between">
          <h3 className="font-bold">Item Master (Database)</h3>
          <div className="flex gap-2 items-center">
            <select className="h-9 rounded-md border bg-background px-2 text-sm" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="all">All Categories</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <Input className="w-64" placeholder="Search by Name, Code or Category..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <Button variant="secondary" onClick={addAll}>Add All to Board</Button>
          </div>
        </div>

        <div className="border rounded-md overflow-auto max-h-[60vh]">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0">
              <tr>
                <th className="p-2 text-left">Item Code</th>
                <th className="p-2 text-left">Item Name</th>
                <th className="p-2 text-left">Category</th>
                <th className="p-2 text-left">Purchase Date</th>
                <th className="p-2 text-left">Mfg Date</th>
                <th className="p-2 text-left">Exp Date</th>
                <th className="p-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.key} className="border-t">
                  <td className="p-2">{r.ItemCode}</td>
                  <td className="p-2">{r.ItemName}</td>
                  <td className="p-2">{r.Category}</td>
                  <td className="p-2">{r.PurchaseDate}</td>
                  <td className="p-2">{r.MfgDate}</td>
                  <td className="p-2">{r.ExpDate}</td>
                  <td className="p-2">
                    <div className="flex gap-1">
                      <Button size="sm" onClick={() => addCards(r)}>+ Card</Button>
                      <Button size="sm" variant="outline" onClick={() => openEdit(r)}><Pencil className="w-3 h-3" /></Button>
                      {r.local && <Button size="sm" variant="destructive" onClick={() => deleteLocal(r)}><Trash2 className="w-3 h-3" /></Button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="font-bold">
          ID Card Print Board (Preview){" "}
          <span className="ml-2 bg-red-500 text-white text-xs px-3 py-1 rounded-full">Total Cards: {board.length}</span>
        </h3>
        <div id="idc-print-area">
          <div className="idc-board">
            {board.map((item, i) => (
              <div className="idc-card" key={i}>
                <button className="idc-remove" onClick={() => setBoard((b) => b.filter((_, j) => j !== i))} title="Remove Card">✖</button>
                <div className="idc-header">
                  <div className="idc-company">DJ Hospitality & Facility Management Private Limited</div>
                  <div className="idc-title">ITEM ID CARD</div>
                </div>
                <div className="idc-body">
                  <p><span className="idc-label">ID:</span> <b>{item.ItemCode}</b></p>
                  <p className="idc-name">{item.ItemName}</p>
                  {item.Category && <p style={{ textAlign: "center", fontWeight: "bold", color: "#555", fontSize: "7pt", margin: 0 }}>({item.Category})</p>}
                  <p className="idc-date"><span className="idc-label" style={{ color: "#0055ff" }}>Pur. Date:</span> <DateSpan value={item.PurchaseDate} color="#0055ff" /></p>
                  <p className="idc-date"><span className="idc-label" style={{ color: "#00b050" }}>MFG Date:</span> <DateSpan value={item.MfgDate} color="#00b050" /></p>
                  <p className="idc-date"><span className="idc-label" style={{ color: "#ff0000" }}>EXP Date:</span> <DateSpan value={item.ExpDate} color="#ff0000" /></p>
                  <div className="idc-qr">
                    <QRCodeSVG value={`Code: ${item.ItemCode}\nName: ${item.ItemName}`} fgColor="#003366" level="L" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={() => setEditing(null)}>
          <div className="bg-white dark:bg-slate-900 p-5 rounded-lg w-[350px] space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold">{editing.isNew ? "Add New Item" : "Edit Item Details"}</h3>
            <div>
              <label className="text-xs font-semibold">Item Code</label>
              <Input value={form.ItemCode} disabled={!editing.isNew && !editing.row?.local} readOnly={editing.isNew} onChange={(e) => setForm({ ...form, ItemCode: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold">Item Name</label>
              <Input value={form.ItemName} disabled={!editing.isNew && !editing.row?.local} onChange={(e) => setForm({ ...form, ItemName: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold">Purchase Date (e.g. DD/MM/YYYY)</label>
              <Input value={form.PurchaseDate} onChange={(e) => setForm({ ...form, PurchaseDate: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold">Mfg Date</label>
              <Input value={form.MfgDate} onChange={(e) => setForm({ ...form, MfgDate: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold">Exp Date</label>
              <Input value={form.ExpDate} onChange={(e) => setForm({ ...form, ExpDate: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={handleSave} disabled={createItem.isPending}>Save Item</Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
