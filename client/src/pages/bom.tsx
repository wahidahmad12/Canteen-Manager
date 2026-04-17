import { useState, useMemo, useRef, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Pencil, Trash2, Save, X, Printer, Download, Calculator, Package, ChefHat, Layers } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const CLIENTS = [
  "HUL - KPF", "HUL - TEC", "UBL", "Unichem", "Cipla", "PEC Ventures",
];

const MEAL_TYPES = [
  { key: "breakfast", label: "Breakfast",     color: "#b45309", bg: "#fffbeb", border: "#fcd34d" },
  { key: "lunch",     label: "Lunch",          color: "#15803d", bg: "#f0fdf4", border: "#86efac" },
  { key: "evening",   label: "Evening Snacks", color: "#6d28d9", bg: "#f5f3ff", border: "#c4b5fd" },
  { key: "dinner",    label: "Dinner",         color: "#1d4ed8", bg: "#eff6ff", border: "#93c5fd" },
  { key: "night",     label: "Night Snacks",   color: "#be123c", bg: "#fff1f2", border: "#fda4af" },
];

const INGREDIENT_SECTIONS = [
  "Main Item",
  "Aromatics",
  "Marinade & Dairy",
  "Spice Profile (Dry)",
  "Whole Spices",
  "Vegetables",
  "Garnish & Finishing",
  "Oil & Fat",
  "Other",
];

const UOM_OPTIONS = ["kg","gm","litre","ml","pcs","tbsp","tsp","cup","inch","medium","large","small","dozen","packet","box","nos"];

function normalizeUom(raw: string): string {
  const m = (raw ?? "").trim().toLowerCase();
  const map: Record<string, string> = {
    kg: "kg", kgs: "kg", kilogram: "kg", kilograms: "kg",
    gm: "gm", g: "gm", gram: "gm", grams: "gm",
    litre: "litre", ltr: "litre", l: "litre", liter: "litre", liters: "litre", litres: "litre",
    ml: "ml", milliliter: "ml", millilitre: "ml",
    pcs: "pcs", pc: "pcs", pieces: "pcs", piece: "pcs",
    nos: "nos", no: "nos", number: "nos",
    tbsp: "tbsp", tablespoon: "tbsp",
    tsp: "tsp", teaspoon: "tsp",
    cup: "cup", cups: "cup",
    packet: "packet", pack: "packet",
    box: "box", dozen: "dozen",
    inch: "inch", medium: "medium", large: "large", small: "small",
  };
  return map[m] ?? (UOM_OPTIONS.find(u => u === m) ?? "");
}

function fmtTotal(qtyPerPerson: string | number, uom: string, headcount: number): { value: string; unit: string } {
  const raw = parseFloat(String(qtyPerPerson)) * headcount;
  if (uom === "gm" && raw >= 1000) return { value: (raw / 1000).toFixed(3), unit: "kg" };
  if (uom === "ml"  && raw >= 1000) return { value: (raw / 1000).toFixed(3), unit: "L"  };
  return { value: raw.toFixed(3), unit: uom };
}

const SECTION_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  "Main Item":              { bg: "#1e3a5f", color: "#ffffff", border: "#1e3a5f" },
  "Aromatics":              { bg: "#fff7ed", color: "#c2410c", border: "#fed7aa" },
  "Marinade & Dairy":       { bg: "#fdf4ff", color: "#7e22ce", border: "#e9d5ff" },
  "Spice Profile (Dry)":    { bg: "#fffbeb", color: "#b45309", border: "#fcd34d" },
  "Whole Spices":           { bg: "#f0fdf4", color: "#15803d", border: "#86efac" },
  "Vegetables":             { bg: "#ecfdf5", color: "#065f46", border: "#6ee7b7" },
  "Garnish & Finishing":    { bg: "#f0f9ff", color: "#0369a1", border: "#7dd3fc" },
  "Oil & Fat":              { bg: "#fefce8", color: "#854d0e", border: "#fde047" },
  "Other":                  { bg: "#f8fafc", color: "#475569", border: "#cbd5e1" },
};

// Convert BOM qty (in bomUom) to the invoice's UOM for correct cost calculation
function qtyInInvoiceUom(qty: number, bomUom: string, invoiceUom: string): number {
  const b = bomUom.toLowerCase().trim();
  const iv = invoiceUom.toLowerCase().trim();
  if (b === iv) return qty;
  if ((b === 'gm' || b === 'g') && iv === 'kg') return qty / 1000;
  if (b === 'ml' && (iv === 'l' || iv === 'litre' || iv === 'liter' || iv === 'litr' || iv === 'ltr')) return qty / 1000;
  if (b === 'kg' && (iv === 'gm' || iv === 'g')) return qty * 1000;
  if ((b === 'l' || b === 'litre') && iv === 'ml') return qty * 1000;
  return qty; // same or unknown — use as-is
}

interface BomItem {
  id: number;
  clientName: string;
  mealType: string;
  dishName: string;
  categoryName: string;
  ingredientName: string;
  qtyPerPerson: string;
  uom: string;
  notes: string | null;
  sortOrder: number;
}

interface AddForm {
  dishName: string;
  categoryName: string;
  ingredientName: string;
  qtyPerPerson: string;
  uom: string;
  notes: string;
}

const emptyAdd: AddForm = {
  dishName: "",
  categoryName: "Main Item",
  ingredientName: "",
  qtyPerPerson: "0.100",
  uom: "kg",
  notes: "",
};

export default function BomPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [client, setClient] = useState(CLIENTS[0]);
  const [mealType, setMealType] = useState("lunch");
  const [headcount, setHeadcount] = useState("100");
  const [activeDish, setActiveDish] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newDishMode, setNewDishMode] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>(emptyAdd);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<AddForm>>({});

  const [ingredientSearch, setIngredientSearch] = useState("");
  const [showIngDropdown, setShowIngDropdown] = useState(false);
  const ingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ingRef.current && !ingRef.current.contains(e.target as Node)) {
        setShowIngDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const qKey = ['/api/bom-items', client, mealType];

  const { data: items = [], isLoading } = useQuery<BomItem[]>({
    queryKey: qKey,
    queryFn: async () => {
      const r = await fetch(`/api/bom-items?clientName=${encodeURIComponent(client)}&mealType=${mealType}`, { credentials: 'include' });
      if (!r.ok) throw new Error("Failed to load BOM items");
      return r.json();
    },
  });

  const createMut = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/bom-items', data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: qKey });
      setShowAdd(false);
      setNewDishMode(false);
      setIngredientSearch("");
      if (vars.dishName) setActiveDish(vars.dishName);
      setAddForm(f => ({ ...emptyAdd, dishName: f.dishName }));
      toast({ title: "Ingredient added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest('PUT', `/api/bom-items/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: qKey }); setEditId(null); toast({ title: "Updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/bom-items/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: qKey }); toast({ title: "Deleted" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const { data: itemMasterList = [] } = useQuery<{ id: number; itemName: string; uom: string; rate?: string }[]>({
    queryKey: ['/api/item-master'],
    queryFn: async () => {
      const r = await fetch('/api/item-master', { credentials: 'include' });
      if (!r.ok) throw new Error("Failed to load item master");
      return r.json();
    },
  });

  const { data: lastPriceList = [] } = useQuery<{ itemName: string; unitPrice: number; gstRate: number; uom: string }[]>({
    queryKey: ['/api/purchase-invoices/last-prices'],
    queryFn: async () => {
      const r = await fetch('/api/purchase-invoices/last-prices', { credentials: 'include' });
      if (!r.ok) return [];
      return r.json();
    },
  });

  const lastPriceMap = useMemo(() =>
    new Map(lastPriceList.map(p => [p.itemName.toLowerCase(), p])),
    [lastPriceList]
  );

  // Item Master rate as fallback when no purchase invoice exists yet
  const itemMasterRateMap = useMemo(() =>
    new Map(itemMasterList.map(i => [i.itemName.toLowerCase(), { unitPrice: parseFloat(i.rate || '0') || 0, uom: i.uom || '' }])),
    [itemMasterList]
  );

  // Resolve price for an ingredient: purchase invoice first, then item master
  const resolvePrice = (ingredientName: string): { unitPrice: number; uom: string; source: 'invoice' | 'master' | null } => {
    const key = ingredientName.toLowerCase();
    const lp = lastPriceMap.get(key);
    if (lp && lp.unitPrice > 0) return { unitPrice: lp.unitPrice, uom: lp.uom, source: 'invoice' };
    const im = itemMasterRateMap.get(key);
    if (im && im.unitPrice > 0) return { unitPrice: im.unitPrice, uom: im.uom, source: 'master' };
    return { unitPrice: 0, uom: '', source: null };
  };

  const filteredIngredients = useMemo(() => {
    if (!ingredientSearch.trim()) return itemMasterList;
    const q = ingredientSearch.toLowerCase();
    return itemMasterList.filter(i => i.itemName.toLowerCase().includes(q));
  }, [itemMasterList, ingredientSearch]);

  const hc = Math.max(1, Number(headcount) || 1);

  // Group: dishName → sectionName → BomItem[]
  const grouped = useMemo(() => {
    const g: Record<string, Record<string, BomItem[]>> = {};
    items.forEach(item => {
      const dish = item.dishName || "(Unassigned)";
      if (!g[dish]) g[dish] = {};
      const sec = item.categoryName || "Other";
      if (!g[dish][sec]) g[dish][sec] = [];
      g[dish][sec].push(item);
    });
    return g;
  }, [items]);

  const dishNames = useMemo(() => Object.keys(grouped), [grouped]);

  // Keep activeDish in sync when dishes load
  const currentDish = activeDish && grouped[activeDish] ? activeDish : (dishNames[0] ?? null);

  const activeMt = MEAL_TYPES.find(m => m.key === mealType)!;

  const handleAdd = () => {
    const dish = addForm.dishName.trim();
    if (!dish) { toast({ title: "Enter dish / menu item name", variant: "destructive" }); return; }
    if (!addForm.ingredientName.trim()) { toast({ title: "Enter ingredient name", variant: "destructive" }); return; }
    const qty = parseFloat(addForm.qtyPerPerson);
    if (isNaN(qty) || qty < 0) { toast({ title: "Enter valid quantity", variant: "destructive" }); return; }
    createMut.mutate({
      clientName: client,
      mealType,
      dishName: dish,
      categoryName: addForm.categoryName,
      ingredientName: addForm.ingredientName.trim(),
      qtyPerPerson: qty.toFixed(4),
      uom: addForm.uom,
      notes: addForm.notes.trim() || null,
      sortOrder: items.filter(i => i.dishName === dish).length,
    });
  };

  const handleUpdate = (item: BomItem) => {
    const qty = parseFloat(editForm.qtyPerPerson ?? item.qtyPerPerson);
    updateMut.mutate({
      id: item.id,
      data: {
        dishName: (editForm.dishName ?? item.dishName).trim(),
        categoryName: editForm.categoryName ?? item.categoryName,
        ingredientName: (editForm.ingredientName ?? item.ingredientName).trim(),
        qtyPerPerson: (isNaN(qty) ? parseFloat(item.qtyPerPerson) : qty).toFixed(4),
        uom: editForm.uom ?? item.uom,
        notes: (editForm.notes ?? item.notes ?? "").trim() || null,
      },
    });
  };

  const handlePrint = () => {
    const mtLabel = activeMt.label;
    const dishesToPrint = currentDish ? { [currentDish]: grouped[currentDish] } : grouped;
    let bodyHtml = '';
    Object.entries(dishesToPrint).forEach(([dish, sections]) => {
      const allItems = Object.values(sections).flat();
      const dishTotalKg = allItems.filter(i => i.uom === 'kg').reduce((s, i) => s + parseFloat(i.qtyPerPerson) * hc, 0);
      bodyHtml += `<tr style="background:#1e3a5f;"><td colspan="8" style="padding:6px 10px;font-size:13px;font-weight:bold;color:#fff;">🍽 ${dish}</td></tr>`;
      Object.entries(sections).forEach(([section, secItems]) => {
        const sc = SECTION_COLORS[section] ?? SECTION_COLORS["Other"];
        bodyHtml += `<tr style="background:${sc.bg};"><td colspan="8" style="padding:4px 12px;font-size:11px;font-weight:700;color:${sc.color};border-bottom:1px solid ${sc.border};">▸ ${section}</td></tr>`;
        secItems.forEach((item, idx) => {
          const ft = fmtTotal(item.qtyPerPerson, item.uom, hc);
          const rp = resolvePrice(item.ingredientName);
          const rate = rp.source ? `₹${rp.unitPrice.toFixed(2)}/${rp.uom}` : '—';
          const cost = rp.source ? `₹${(rp.unitPrice * qtyInInvoiceUom(parseFloat(item.qtyPerPerson), item.uom, rp.uom) * hc).toFixed(2)}` : '—';
          bodyHtml += `<tr style="background:${idx%2===0?'#fff':'#f9fafb'};">
            <td style="border:1px solid #e2e8f0;padding:4px 8px;font-size:11px;color:#64748b;">${section}</td>
            <td style="border:1px solid #e2e8f0;padding:4px 8px;font-size:11px;font-weight:600;">${item.ingredientName}</td>
            <td style="border:1px solid #e2e8f0;padding:4px 8px;font-size:11px;text-align:center;">${parseFloat(item.qtyPerPerson).toFixed(4)}</td>
            <td style="border:1px solid #e2e8f0;padding:4px 8px;font-size:11px;text-align:center;">${item.uom}</td>
            <td style="border:1px solid #e2e8f0;padding:4px 8px;font-size:11px;text-align:center;font-weight:700;color:#16a34a;">${ft.value}</td>
            <td style="border:1px solid #e2e8f0;padding:4px 8px;font-size:11px;text-align:center;">${ft.unit}</td>
            <td style="border:1px solid #e2e8f0;padding:4px 8px;font-size:11px;text-align:center;color:#1d4ed8;">${rate}</td>
            <td style="border:1px solid #e2e8f0;padding:4px 8px;font-size:11px;text-align:center;font-weight:700;color:#7e22ce;">${cost}</td>
          </tr>`;
        });
      });
      bodyHtml += `<tr><td colspan="8" style="padding:2px;background:#f1f5f9;"></td></tr>`;
    });
    const html = `<!DOCTYPE html><html><head><title>BOM — ${client} — ${mtLabel}</title>
    <style>body{font-family:Arial,sans-serif;margin:16px;}h2{color:#1e3a5f;margin:0;}p{margin:2px 0;font-size:12px;}table{border-collapse:collapse;width:100%;margin-top:10px;}th{background:#1e3a5f;color:#fff;padding:5px 8px;font-size:11px;}@media print{button{display:none}}</style></head><body>
    <h2>DJ Hospitality & Facility Management Pvt. Ltd.</h2>
    <p><strong>Bill of Material — ${mtLabel}</strong></p>
    <p>Client: <strong>${client}</strong> &nbsp;|&nbsp; Headcount: <strong>${hc}</strong> &nbsp;|&nbsp; Date: ${new Date().toLocaleDateString('en-IN')}</p>
    <table><thead><tr><th>Section</th><th>Ingredient / Material</th><th>Qty/Person</th><th>UOM</th><th>Total Qty</th><th>UOM</th><th>Rate (₹)</th><th>Cost (₹)</th></tr></thead>
    <tbody>${bodyHtml}</tbody></table>
    <script>window.onload=()=>{window.print();}</script></body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  };

  const handleExcelExport = async () => {
    try {
      const ExcelJS = (await import('exceljs')).default;
      const { saveAs } = await import('file-saver');
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(`BOM ${activeMt.label}`);
      const thin = { top:{style:'thin' as const}, bottom:{style:'thin' as const}, left:{style:'thin' as const}, right:{style:'thin' as const} };
      const mkFill = (argb: string) => ({ type:'pattern' as const, pattern:'solid' as const, fgColor:{argb} });

      ws.mergeCells('A1:F1');
      ws.getCell('A1').value = 'DJ Hospitality & Facility Management Pvt. Ltd.';
      ws.getCell('A1').font = { name:'Arial', bold:true, size:13, color:{argb:'FF1A3A5A'} };
      ws.getCell('A1').alignment = { horizontal:'center' };
      ws.getRow(1).height = 22;

      ws.mergeCells('A2:F2');
      ws.getCell('A2').value = `Bill of Material — ${activeMt.label} | Client: ${client} | Headcount: ${hc}`;
      ws.getCell('A2').font = { name:'Arial', bold:true, size:11, color:{argb:'FFA52A2A'} };
      ws.getCell('A2').alignment = { horizontal:'center' };
      ws.getRow(2).height = 18;

      const hdrRow = ws.addRow(['Section / Group','Ingredient / Material','Qty / Person','UOM','Total Qty','Total UOM','Rate (₹/UOM)','Cost (₹)','Notes']);
      hdrRow.font = { bold:true, color:{argb:'FFFFFFFF'}, size:10 };
      hdrRow.fill = mkFill('FF1E3A5F'); hdrRow.height = 18;
      hdrRow.eachCell(c => { (c as any).border = thin; (c as any).alignment = { horizontal:'center', vertical:'middle' }; });

      const dishesToExport = currentDish ? { [currentDish]: grouped[currentDish] } : grouped;
      Object.entries(dishesToExport).forEach(([dish, sections]) => {
        const dr = ws.addRow([`🍽 ${dish}`]);
        ws.mergeCells(`A${dr.number}:I${dr.number}`);
        dr.font = { bold:true, size:11, color:{argb:'FFFFFFFF'} };
        dr.fill = mkFill('FF1E3A5F'); dr.height = 20;
        dr.getCell(1).border = thin;
        dr.getCell(1).alignment = { horizontal:'left', vertical:'middle' };

        Object.entries(sections).forEach(([section, secItems]) => {
          const secRow = ws.addRow([`▸ ${section}`, '', '', '', '', '', '', '', '']);
          secRow.font = { bold:true, size:10, color:{argb:'FF374151'} };
          secRow.fill = mkFill('FFF1F5F9'); secRow.height = 16;
          secRow.eachCell(c => { (c as any).border = thin; });

          secItems.forEach((item, idx) => {
            const ft = fmtTotal(item.qtyPerPerson, item.uom, hc);
            const rp = resolvePrice(item.ingredientName);
            const rate = rp.source ? rp.unitPrice : null;
            const cost = rp.source ? rp.unitPrice * qtyInInvoiceUom(parseFloat(item.qtyPerPerson), item.uom, rp.uom) * hc : null;
            const row = ws.addRow([section, item.ingredientName, parseFloat(item.qtyPerPerson), item.uom, Number(ft.value), ft.unit, rate, cost, item.notes || '']);
            row.height = 16;
            const rowBg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';
            row.eachCell((c, ci) => {
              (c as any).border = thin;
              (c as any).alignment = { vertical:'middle', horizontal: ci > 2 && ci < 9 ? 'center' : 'left' };
              if (ci === 5) { (c as any).font = { bold:true, color:{argb:'FF16A34A'} }; (c as any).fill = mkFill('FFD1FAE5'); }
              else if (ci === 7) { (c as any).font = { bold:true, color:{argb:'FF1D4ED8'} }; (c as any).fill = mkFill('FFDBEAFE'); (c as any).numFmt = '₹#,##0.00'; }
              else if (ci === 8) { (c as any).font = { bold:true, color:{argb:'FF7E22CE'} }; (c as any).fill = mkFill('FFF3E8FF'); (c as any).numFmt = '₹#,##0.00'; }
              else { (c as any).fill = mkFill(rowBg); (c as any).font = { size:10 }; }
            });
          });
        });
        ws.addRow([]);
      });

      ws.getColumn(1).width = 22; ws.getColumn(2).width = 30; ws.getColumn(3).width = 14;
      ws.getColumn(4).width = 10; ws.getColumn(5).width = 14; ws.getColumn(6).width = 12;
      ws.getColumn(7).width = 16; ws.getColumn(8).width = 16; ws.getColumn(9).width = 28;

      const buf = await wb.xlsx.writeBuffer();
      saveAs(new Blob([buf]), `BOM_${client.replace(/\s+/g,'_')}_${activeMt.key}.xlsx`);
    } catch (e: any) { toast({ title: 'Export failed', description: e.message, variant: 'destructive' }); }
  };

  const dishItems = currentDish && grouped[currentDish] ? Object.values(grouped[currentDish]).flat() : [];
  const allMealItems = items;

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-3 sm:p-5 space-y-4">

        {/* ── Header ── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Package className="w-6 h-6 text-indigo-600" />
            <div>
              <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Bill of Material</h1>
              <p className="text-xs text-muted-foreground">Ingredient requirements per dish, meal type & client</p>
            </div>
          </div>
          <Select value={client} onValueChange={v => { setClient(v); setActiveDish(null); }}>
            <SelectTrigger className="w-44 sm:w-52 font-semibold" data-testid="select-bom-client"><SelectValue /></SelectTrigger>
            <SelectContent>{CLIENTS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        {/* ── Meal Type Tabs ── */}
        <div className="flex flex-wrap gap-1.5">
          {MEAL_TYPES.map(mt => (
            <button key={mt.key} onClick={() => { setMealType(mt.key); setActiveDish(null); setShowAdd(false); }}
              className="px-3 py-1.5 rounded-full text-xs sm:text-sm font-semibold border transition-all"
              style={mealType === mt.key
                ? { background: mt.color, color: '#fff', borderColor: mt.color, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }
                : { background: mt.bg, color: mt.color, borderColor: mt.border }}
              data-testid={`tab-bom-${mt.key}`}>
              {mt.label}
            </button>
          ))}
        </div>

        {/* ── Headcount bar ── */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border px-3 py-2">
          <Calculator className="w-4 h-4 text-indigo-500" />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Headcount:</span>
          <Input type="number" min={1} value={headcount} onChange={e => setHeadcount(e.target.value)}
            className="w-24 h-8 text-sm font-bold text-center" data-testid="input-headcount" />
          <span className="text-xs text-muted-foreground">persons &nbsp;→&nbsp; Total = Qty/Person × Headcount</span>
          <div className="flex gap-2 ml-auto flex-wrap">
            <Button variant="outline" size="sm" onClick={handlePrint} data-testid="button-bom-print">
              <Printer className="w-3.5 h-3.5 mr-1" /> Print
            </Button>
            <Button variant="outline" size="sm" onClick={handleExcelExport} className="text-green-700 border-green-300 hover:bg-green-50" data-testid="button-bom-excel">
              <Download className="w-3.5 h-3.5 mr-1" /> Excel
            </Button>
            <Button size="sm" onClick={() => { setShowAdd(true); setNewDishMode(true); setAddForm(emptyAdd); setIngredientSearch(""); }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white" data-testid="button-add-dish">
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Ingredient
            </Button>
          </div>
        </div>

        {/* ── Add Ingredient Form ── */}
        {showAdd && (
          <Card className="border-indigo-300 bg-indigo-50 dark:bg-indigo-950/30">
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300">
                Add Ingredient — {client} / {activeMt.label}
              </p>
              {/* Dish Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Dish / Menu Item *</label>
                  <div className="flex gap-1">
                    <Input
                      placeholder="e.g. Chicken Kassa, Dal Fry, Poha..."
                      value={addForm.dishName}
                      onChange={e => setAddForm(f => ({ ...f, dishName: e.target.value }))}
                      className="h-8 text-sm" list="dish-options"
                      data-testid="input-dish-name"
                    />
                    <datalist id="dish-options">
                      {dishNames.map(d => <option key={d} value={d} />)}
                    </datalist>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Section / Group *</label>
                  <Select value={addForm.categoryName} onValueChange={v => setAddForm(f => ({ ...f, categoryName: v }))}>
                    <SelectTrigger className="h-8 text-xs" data-testid="select-add-section"><SelectValue /></SelectTrigger>
                    <SelectContent>{INGREDIENT_SECTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              {/* Ingredient Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">
                    Ingredient / Material *
                    <span className="ml-1 font-normal text-indigo-500">(from Item Master)</span>
                  </label>
                  <div className="relative" ref={ingRef}>
                    <Input
                      placeholder="Search item master…"
                      value={ingredientSearch || addForm.ingredientName}
                      onChange={e => {
                        setIngredientSearch(e.target.value);
                        setAddForm(f => ({ ...f, ingredientName: e.target.value }));
                        setShowIngDropdown(true);
                      }}
                      onFocus={() => setShowIngDropdown(true)}
                      className="h-8 text-sm"
                      data-testid="input-ingredient-name"
                      autoComplete="off"
                    />
                    {showIngDropdown && filteredIngredients.length > 0 && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-lg max-h-52 overflow-y-auto">
                        {filteredIngredients.slice(0, 50).map(item => {
                          const lp = resolvePrice(item.itemName);
                          return (
                            <button
                              key={item.id}
                              type="button"
                              className="w-full text-left px-3 py-1.5 text-sm hover:bg-indigo-50 dark:hover:bg-indigo-950/40 flex items-center justify-between gap-2"
                              onMouseDown={e => {
                                e.preventDefault();
                                const normUom = normalizeUom(item.uom);
                                setAddForm(f => ({
                                  ...f,
                                  ingredientName: item.itemName,
                                  uom: normUom || f.uom,
                                }));
                                setIngredientSearch("");
                                setShowIngDropdown(false);
                              }}
                            >
                              <span className="font-medium truncate">{item.itemName}</span>
                              <span className="flex items-center gap-2 shrink-0">
                                {lp.source && (
                                  <span className={`text-xs font-semibold ${lp.source === 'invoice' ? 'text-emerald-600' : 'text-amber-600'}`}>
                                    ₹{lp.unitPrice.toFixed(2)}/{lp.uom || item.uom}
                                  </span>
                                )}
                                <span className="text-xs text-slate-400">{item.uom}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {showIngDropdown && ingredientSearch && filteredIngredients.length === 0 && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-sm px-3 py-2 text-xs text-slate-500">
                        No match — item will be saved as typed
                      </div>
                    )}
                    {/* Last price badge — shown when an item is selected */}
                    {addForm.ingredientName && (() => {
                      const rp = resolvePrice(addForm.ingredientName);
                      if (!rp.source) return null;
                      const lp = lastPriceMap.get(addForm.ingredientName.toLowerCase());
                      const label = rp.source === 'invoice' ? 'Last Purchase:' : 'Item Master Rate:';
                      const badgeClass = rp.source === 'invoice'
                        ? "mt-1 inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5"
                        : "mt-1 inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded px-2 py-0.5";
                      const labelClass = rp.source === 'invoice' ? "text-xs text-emerald-700 font-medium" : "text-xs text-amber-700 font-medium";
                      const priceClass = rp.source === 'invoice' ? "text-xs font-bold text-emerald-800" : "text-xs font-bold text-amber-800";
                      const unitClass  = rp.source === 'invoice' ? "text-xs text-emerald-600" : "text-xs text-amber-600";
                      return (
                        <div className={badgeClass}>
                          <span className={labelClass}>{label}</span>
                          <span className={priceClass}>₹{rp.unitPrice.toFixed(2)}</span>
                          <span className={unitClass}>/ {rp.uom || addForm.uom}</span>
                          {lp && lp.gstRate > 0 && (
                            <span className="text-xs text-slate-500 ml-1">+ {Number(lp.gstRate).toFixed(0)}% GST</span>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Qty / Person</label>
                  <Input type="number" step="0.001" min={0} value={addForm.qtyPerPerson}
                    onChange={e => setAddForm(f => ({ ...f, qtyPerPerson: e.target.value }))}
                    className="h-8 text-sm" data-testid="input-qty-per-person" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">UOM</label>
                  <Select value={addForm.uom} onValueChange={v => setAddForm(f => ({ ...f, uom: v }))}>
                    <SelectTrigger className="h-8 text-xs" data-testid="select-add-uom"><SelectValue /></SelectTrigger>
                    <SelectContent>{UOM_OPTIONS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Specification / Notes</label>
                <Input placeholder="e.g. Freshly ground, Finely sliced, Kashmiri variety..."
                  value={addForm.notes} onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))}
                  className="h-8 text-sm" data-testid="input-notes" />
              </div>
              {/* Qty hint */}
              {addForm.qtyPerPerson && addForm.uom && (
                <p className="text-xs text-indigo-600 font-medium">
                  {(() => { const ft = fmtTotal(addForm.qtyPerPerson, addForm.uom, hc); return <>For {hc} persons → Total: <strong>{ft.value} {ft.unit}</strong></>; })()}
                </p>
              )}
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAdd} disabled={createMut.isPending} className="bg-indigo-600 text-white" data-testid="button-confirm-add">
                  {createMut.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />} Add Ingredient
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setShowAdd(false); setNewDishMode(false); setAddForm(emptyAdd); setIngredientSearch(""); }}>
                  <X className="w-3.5 h-3.5 mr-1" /> Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Main Content ── */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        ) : dishNames.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-xl">
            <ChefHat className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-muted-foreground font-semibold text-sm">No dishes defined yet</p>
            <p className="text-muted-foreground text-xs mt-1 max-w-sm mx-auto">
              Click "Add Ingredient" to start building the Bill of Material for {client} — {activeMt.label}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">

            {/* ── Dish Sidebar ── */}
            <div className="lg:col-span-1 space-y-1">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1 mb-2 flex items-center gap-1">
                <ChefHat className="w-3.5 h-3.5" /> Dishes ({dishNames.length})
              </p>
              {dishNames.map(dish => {
                const dishItemsForDish = Object.values(grouped[dish]).flat();
                const isActive = dish === currentDish;
                return (
                  <button key={dish} onClick={() => setActiveDish(dish)}
                    className={`w-full text-left px-3 py-2 rounded-lg border transition-all text-sm ${isActive ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/30'}`}
                    data-testid={`dish-tab-${dish}`}>
                    <div className="font-semibold truncate">{dish}</div>
                    <div className={`text-xs mt-0.5 ${isActive ? 'text-indigo-200' : 'text-muted-foreground'}`}>
                      {dishItemsForDish.length} ingredient{dishItemsForDish.length !== 1 ? 's' : ''}
                      {` · ${(dishItemsForDish.reduce((s, i) => s + parseFloat(i.qtyPerPerson) * hc, 0)).toFixed(2)} ${dishItemsForDish[0]?.uom ?? ''}`}
                    </div>
                  </button>
                );
              })}

              {/* Summary */}
              <div className="mt-4 bg-green-50 dark:bg-green-950/20 border border-green-200 rounded-lg p-3">
                <p className="text-xs font-bold text-green-700 mb-2">Total for {hc} persons</p>
                {Object.entries(
                  allMealItems.reduce((acc: Record<string, number>, item) => {
                    const ft = fmtTotal(item.qtyPerPerson, item.uom, hc);
                    acc[ft.unit] = (acc[ft.unit] || 0) + parseFloat(ft.value);
                    return acc;
                  }, {})
                ).map(([uom, qty]) => (
                  <div key={uom} className="flex justify-between text-xs">
                    <span className="text-slate-500">{uom}</span>
                    <span className="font-bold text-green-700">{qty.toFixed(3)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Dish Detail ── */}
            <div className="lg:col-span-3 space-y-3">
              {currentDish && grouped[currentDish] && (
                <>
                  {/* Dish Header */}
                  <div className="flex items-center justify-between bg-slate-800 text-white rounded-xl px-4 py-3">
                    <div className="flex items-center gap-2">
                      <ChefHat className="w-5 h-5 text-amber-400" />
                      <span className="font-bold text-base">{currentDish}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Total Ingredients</p>
                        <p className="text-sm font-bold text-amber-300">{dishItems.length}</p>
                      </div>
                      <Button size="sm" variant="outline"
                        className="border-white/30 text-white hover:bg-white/10 text-xs h-8"
                        onClick={() => { setShowAdd(true); setAddForm(f => ({ ...emptyAdd, dishName: currentDish })); setIngredientSearch(""); }}
                        data-testid="button-add-to-dish">
                        <Plus className="w-3 h-3 mr-1" /> Add More
                      </Button>
                    </div>
                  </div>

                  {/* Sections */}
                  {Object.entries(grouped[currentDish]).map(([section, secItems]) => {
                    const sc = SECTION_COLORS[section] ?? SECTION_COLORS["Other"];
                    const secSummary = secItems.reduce((acc: Record<string, number>, i) => {
                      const ft = fmtTotal(i.qtyPerPerson, i.uom, hc);
                      acc[ft.unit] = (acc[ft.unit] || 0) + parseFloat(ft.value);
                      return acc;
                    }, {});
                    const secCost = secItems.reduce((s, i) => {
                      const rp = resolvePrice(i.ingredientName);
                      if (!rp.source) return s;
                      return s + rp.unitPrice * qtyInInvoiceUom(parseFloat(i.qtyPerPerson), i.uom, rp.uom) * hc;
                    }, 0);
                    const secHasCost = secItems.some(i => resolvePrice(i.ingredientName).source !== null);
                    return (
                      <Card key={section} className="overflow-hidden" style={{ borderColor: sc.border }}>
                        <div className="flex items-center justify-between px-4 py-2" style={{ background: sc.bg, borderBottom: `1px solid ${sc.border}` }}>
                          <div className="flex items-center gap-2">
                            <Layers className="w-3.5 h-3.5" style={{ color: sc.color }} />
                            <span className="text-sm font-bold" style={{ color: sc.color }}>{section}</span>
                            <span className="text-xs text-muted-foreground">({secItems.length} item{secItems.length !== 1 ? 's' : ''})</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-semibold" style={{ color: sc.color }}>
                              {Object.entries(secSummary).map(([u, q]) => `${q.toFixed(3)} ${u}`).join(' + ')}
                            </span>
                            {secHasCost && (
                              <span className="text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 rounded px-2 py-0.5">
                                ₹{secCost.toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                        <CardContent className="p-0">
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-slate-50 dark:bg-slate-800/50 text-xs border-b">
                                  <th className="px-3 py-2 text-left font-semibold text-slate-600 w-48">Ingredient / Material</th>
                                  <th className="px-3 py-2 text-center font-semibold text-slate-600 w-28">Qty / Person</th>
                                  <th className="px-3 py-2 text-center font-semibold text-slate-600 w-16">UOM</th>
                                  <th className="px-3 py-2 text-center font-semibold text-green-700 w-28">Total ({hc} pax)</th>
                                  <th className="px-3 py-2 text-center font-semibold text-blue-700 w-24">Rate (₹)</th>
                                  <th className="px-3 py-2 text-center font-semibold text-purple-700 w-28">Cost ({hc} pax)</th>
                                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Specification / Notes</th>
                                  <th className="px-3 py-2 text-center font-semibold text-slate-600 w-16">Act.</th>
                                </tr>
                              </thead>
                              <tbody>
                                {secItems.map((item, idx) => {
                                  const isEditing = editId === item.id;
                                  const rp = resolvePrice(item.ingredientName);
                                  const unitRate = rp.source ? rp.unitPrice : null;
                                  const convertedQty = rp.source ? qtyInInvoiceUom(parseFloat(item.qtyPerPerson), item.uom, rp.uom) * hc : null;
                                  const totalCost = unitRate !== null && convertedQty !== null ? unitRate * convertedQty : null;
                                  return (
                                    <tr key={item.id} style={{ background: isEditing ? '#eef2ff' : idx % 2 === 0 ? '#fff' : '#f9fafb' }}>
                                      {/* Ingredient */}
                                      <td className="border-b border-slate-100 px-3 py-1.5 font-semibold text-slate-800 dark:text-slate-100">
                                        {isEditing
                                          ? <Input value={editForm.ingredientName ?? item.ingredientName} onChange={e => setEditForm(f => ({ ...f, ingredientName: e.target.value }))} className="h-7 text-sm w-40" data-testid={`edit-name-${item.id}`} />
                                          : item.ingredientName}
                                      </td>
                                      {/* Qty/Person */}
                                      <td className="border-b border-slate-100 px-3 py-1.5 text-center">
                                        {isEditing
                                          ? <Input type="number" step="0.001" value={editForm.qtyPerPerson ?? item.qtyPerPerson} onChange={e => setEditForm(f => ({ ...f, qtyPerPerson: e.target.value }))} className="h-7 text-sm w-20 text-center mx-auto" data-testid={`edit-qty-${item.id}`} />
                                          : <span className="text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded">{parseFloat(item.qtyPerPerson).toFixed(4)}</span>}
                                      </td>
                                      {/* UOM */}
                                      <td className="border-b border-slate-100 px-3 py-1.5 text-center text-xs text-slate-500">
                                        {isEditing
                                          ? <Select value={editForm.uom ?? item.uom} onValueChange={v => setEditForm(f => ({ ...f, uom: v }))}><SelectTrigger className="h-7 text-xs w-16"><SelectValue /></SelectTrigger><SelectContent>{UOM_OPTIONS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select>
                                          : item.uom}
                                      </td>
                                      {/* Total Qty */}
                                      <td className="border-b border-slate-100 px-3 py-1.5 text-center">
                                        {(() => { const ft = fmtTotal(item.qtyPerPerson, isEditing ? (editForm.uom ?? item.uom) : item.uom, hc); return <><span className="font-bold text-green-700">{ft.value}</span><span className="text-xs text-slate-400 ml-1">{ft.unit}</span></>; })()}
                                      </td>
                                      {/* Rate */}
                                      <td className="border-b border-slate-100 px-3 py-1.5 text-center">
                                        {unitRate !== null
                                          ? <span className="text-xs font-semibold text-blue-700">
                                              ₹{unitRate.toFixed(2)}
                                              <span className="font-normal text-slate-400">/{rp.uom || item.uom}</span>
                                              {rp.source === 'master' && <span className="ml-1 text-[9px] text-amber-500">(IM)</span>}
                                            </span>
                                          : <span className="text-xs text-slate-300">—</span>}
                                      </td>
                                      {/* Total Cost */}
                                      <td className="border-b border-slate-100 px-3 py-1.5 text-center">
                                        {totalCost !== null
                                          ? <span className="text-xs font-bold text-purple-700">₹{totalCost.toFixed(2)}</span>
                                          : <span className="text-xs text-slate-300">—</span>}
                                      </td>
                                      {/* Notes */}
                                      <td className="border-b border-slate-100 px-3 py-1.5 text-xs text-slate-500 italic">
                                        {isEditing
                                          ? <Input value={editForm.notes ?? (item.notes || '')} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} className="h-7 text-xs w-36" data-testid={`edit-notes-${item.id}`} />
                                          : (item.notes || '—')}
                                      </td>
                                      {/* Actions */}
                                      <td className="border-b border-slate-100 px-2 py-1.5">
                                        {isEditing ? (
                                          <div className="flex gap-0.5 justify-center">
                                            <Button size="icon" variant="ghost" className="h-6 w-6 text-green-600" onClick={() => handleUpdate(item)} disabled={updateMut.isPending} data-testid={`save-${item.id}`}>
                                              {updateMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                            </Button>
                                            <Button size="icon" variant="ghost" className="h-6 w-6 text-slate-400" onClick={() => setEditId(null)}>
                                              <X className="w-3 h-3" />
                                            </Button>
                                          </div>
                                        ) : (
                                          <div className="flex gap-0.5 justify-center">
                                            <Button size="icon" variant="ghost" className="h-6 w-6 text-blue-500 hover:bg-blue-50" onClick={() => { setEditId(item.id); setEditForm({}); }} data-testid={`edit-${item.id}`}>
                                              <Pencil className="w-3 h-3" />
                                            </Button>
                                            <Button size="icon" variant="ghost" className="h-6 w-6 text-red-400 hover:bg-red-50" onClick={() => { if (confirm('Delete this ingredient?')) deleteMut.mutate(item.id); }} disabled={deleteMut.isPending} data-testid={`delete-${item.id}`}>
                                              <Trash2 className="w-3 h-3" />
                                            </Button>
                                          </div>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
