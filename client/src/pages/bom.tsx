import { useState, useMemo } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Pencil, Trash2, Save, X, Printer, Download, Calculator, Package } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const CLIENTS = [
  "HUL - KPF",
  "HUL - TEC",
  "UBL",
  "Unichem",
  "Cipla",
  "PEC Ventures",
];

const MEAL_TYPES = [
  { key: "breakfast",    label: "Breakfast",       color: "#f59e0b", bg: "#fffbeb" },
  { key: "lunch",        label: "Lunch",            color: "#16a34a", bg: "#f0fdf4" },
  { key: "evening",      label: "Evening Snacks",   color: "#7c3aed", bg: "#f5f3ff" },
  { key: "dinner",       label: "Dinner",           color: "#1d4ed8", bg: "#eff6ff" },
  { key: "night",        label: "Night Snacks",     color: "#be123c", bg: "#fff1f2" },
];

const BASE_CATEGORIES = [
  "Plain Rice", "Dal Fry", "Chapati / Roti", "Sabzi 1", "Sabzi 2",
  "Khichdi / Pulao", "Poha / Upma", "Idli / Dosa", "Salad", "Pickle",
  "Papad", "Curd", "Sweets / Dessert", "Chicken", "Fish / Egg",
  "Bread / Toast", "Butter / Jam", "Boiled Egg", "Tea", "Coffee",
  "Cold Drink", "Biscuit", "Chips", "Snacks Pack", "Other",
];

const UOM_OPTIONS = ["kg", "gm", "litre", "ml", "pcs", "dozen", "packet", "box", "bundle", "nos"];

interface BomItem {
  id: number;
  clientName: string;
  mealType: string;
  categoryName: string;
  ingredientName: string;
  qtyPerPerson: string;
  uom: string;
  notes: string | null;
  sortOrder: number;
}

interface AddForm {
  categoryName: string;
  ingredientName: string;
  qtyPerPerson: string;
  uom: string;
  notes: string;
}

const emptyAdd: AddForm = {
  categoryName: BASE_CATEGORIES[0],
  ingredientName: "",
  qtyPerPerson: "0.1",
  uom: "kg",
  notes: "",
};

export default function BomPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [client, setClient] = useState(CLIENTS[0]);
  const [mealType, setMealType] = useState("lunch");
  const [headcount, setHeadcount] = useState("100");
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>(emptyAdd);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<AddForm>>({});

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
    onSuccess: () => { qc.invalidateQueries({ queryKey: qKey }); setShowAdd(false); setAddForm(emptyAdd); toast({ title: "Ingredient added" }); },
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

  const hc = Number(headcount) || 0;

  const grouped = useMemo(() => {
    const g: Record<string, BomItem[]> = {};
    items.forEach(item => {
      if (!g[item.categoryName]) g[item.categoryName] = [];
      g[item.categoryName].push(item);
    });
    return g;
  }, [items]);

  const activeMt = MEAL_TYPES.find(m => m.key === mealType)!;

  const handleAdd = () => {
    if (!addForm.ingredientName.trim()) { toast({ title: "Enter ingredient name", variant: "destructive" }); return; }
    createMut.mutate({
      clientName: client,
      mealType,
      categoryName: addForm.categoryName,
      ingredientName: addForm.ingredientName.trim(),
      qtyPerPerson: String(parseFloat(addForm.qtyPerPerson) || 0),
      uom: addForm.uom,
      notes: addForm.notes || null,
      sortOrder: items.length,
    });
  };

  const handleUpdate = (item: BomItem) => {
    updateMut.mutate({
      id: item.id,
      data: {
        categoryName: editForm.categoryName ?? item.categoryName,
        ingredientName: (editForm.ingredientName ?? item.ingredientName).trim(),
        qtyPerPerson: String(parseFloat(editForm.qtyPerPerson ?? item.qtyPerPerson) || 0),
        uom: editForm.uom ?? item.uom,
        notes: editForm.notes ?? item.notes ?? null,
      },
    });
  };

  const handlePrint = () => {
    const mtLabel = activeMt.label;
    const rows = items.map(item => {
      const total = (parseFloat(item.qtyPerPerson) * hc).toFixed(3);
      return `<tr>
        <td style="border:1px solid #d1d5db;padding:5px 8px;font-size:11px;">${item.categoryName}</td>
        <td style="border:1px solid #d1d5db;padding:5px 8px;font-size:11px;font-weight:600;">${item.ingredientName}</td>
        <td style="border:1px solid #d1d5db;padding:5px 8px;font-size:11px;text-align:center;">${parseFloat(item.qtyPerPerson).toFixed(4)}</td>
        <td style="border:1px solid #d1d5db;padding:5px 8px;font-size:11px;text-align:center;">${item.uom}</td>
        <td style="border:1px solid #d1d5db;padding:5px 8px;font-size:11px;text-align:center;font-weight:700;color:#16a34a;">${total}</td>
        <td style="border:1px solid #d1d5db;padding:5px 8px;font-size:11px;text-align:center;">${item.uom}</td>
        <td style="border:1px solid #d1d5db;padding:5px 8px;font-size:10px;color:#6b7280;">${item.notes || ''}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><title>BOM - ${client} - ${mtLabel}</title>
    <style>body{font-family:Arial,sans-serif;margin:20px;}h2{color:#1e3a5f;margin:0;}p{margin:2px 0;font-size:12px;color:#374151;}table{border-collapse:collapse;width:100%;margin-top:12px;}th{background:#1e3a5f;color:#fff;padding:6px 8px;font-size:11px;text-align:left;}@media print{button{display:none}}</style>
    </head><body>
    <h2>DJ Hospitality & Facility Management Pvt. Ltd.</h2>
    <p><strong>Bill of Material — ${mtLabel}</strong></p>
    <p>Client: <strong>${client}</strong> &nbsp;|&nbsp; Headcount: <strong>${hc}</strong> &nbsp;|&nbsp; Date: <strong>${new Date().toLocaleDateString('en-IN')}</strong></p>
    <table><thead><tr>
      <th>Menu Category</th><th>Ingredient / Material</th>
      <th>Qty/Person</th><th>UOM</th><th>Total Qty</th><th>UOM</th><th>Notes</th>
    </tr></thead><tbody>${rows}</tbody></table>
    <script>window.onload=()=>{window.print();}</script></body></html>`;

    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  };

  const handleExportExcel = async () => {
    try {
      const ExcelJS = (await import('exceljs')).default;
      const { saveAs } = await import('file-saver');
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(`BOM ${client} ${activeMt.label}`);
      const thin = { top:{style:'thin' as const}, bottom:{style:'thin' as const}, left:{style:'thin' as const}, right:{style:'thin' as const} };
      const mkFill = (argb: string) => ({ type:'pattern' as const, pattern:'solid' as const, fgColor:{argb} });

      ws.mergeCells('A1:G1');
      const t1 = ws.getCell('A1');
      t1.value = 'DJ Hospitality & Facility Management Pvt. Ltd.';
      t1.font = { name:'Arial', bold:true, size:13, color:{argb:'FF1A3A5A'} };
      t1.alignment = { horizontal:'center' }; ws.getRow(1).height = 22;

      ws.mergeCells('A2:G2');
      const t2 = ws.getCell('A2');
      t2.value = `Bill of Material — ${activeMt.label} | Client: ${client} | Headcount: ${hc}`;
      t2.font = { name:'Arial', bold:true, size:11, color:{argb:'FFA52A2A'} };
      t2.alignment = { horizontal:'center' }; ws.getRow(2).height = 18;

      const hdr = ws.addRow(['Menu Category','Ingredient / Material','Qty / Person','UOM','Total Qty','UOM','Notes']);
      hdr.font = { bold:true, color:{argb:'FFFFFFFF'}, size:10 };
      hdr.fill = mkFill('FF1E3A5F'); hdr.height = 18;
      hdr.eachCell(c => { (c as any).border = thin; (c as any).alignment = { horizontal:'center', vertical:'middle' }; });

      items.forEach((item, idx) => {
        const total = (parseFloat(item.qtyPerPerson) * hc).toFixed(3);
        const row = ws.addRow([item.categoryName, item.ingredientName, parseFloat(item.qtyPerPerson), item.uom, Number(total), item.uom, item.notes || '']);
        row.height = 16;
        const rowBg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';
        row.eachCell((c, ci) => {
          (c as any).border = thin;
          (c as any).alignment = { vertical:'middle', horizontal: ci > 2 && ci < 7 ? 'center' : 'left' };
          if (ci === 5) {
            (c as any).font = { bold:true, color:{argb:'FF16A34A'} };
            (c as any).fill = mkFill('FFD1FAE5');
          } else {
            (c as any).fill = mkFill(rowBg);
          }
        });
      });

      ws.getColumn(1).width = 22; ws.getColumn(2).width = 28; ws.getColumn(3).width = 12;
      ws.getColumn(4).width = 10; ws.getColumn(5).width = 14; ws.getColumn(6).width = 10; ws.getColumn(7).width = 24;

      const buf = await wb.xlsx.writeBuffer();
      saveAs(new Blob([buf]), `BOM_${client.replace(/\s+/g,'_')}_${activeMt.key}.xlsx`);
    } catch (e: any) { toast({ title: 'Export failed', description: e.message, variant: 'destructive' }); }
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-3 sm:p-5 space-y-4">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Package className="w-6 h-6 text-indigo-600" />
            <div>
              <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Bill of Material</h1>
              <p className="text-xs text-muted-foreground">Ingredient requirements per meal type & client</p>
            </div>
          </div>

          {/* Client Selector */}
          <Select value={client} onValueChange={setClient}>
            <SelectTrigger className="w-44 sm:w-52 font-semibold" data-testid="select-bom-client">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CLIENTS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Meal Type Tabs */}
        <div className="flex flex-wrap gap-1.5">
          {MEAL_TYPES.map(mt => (
            <button
              key={mt.key}
              onClick={() => setMealType(mt.key)}
              className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-semibold border transition-all ${mealType === mt.key ? 'shadow-md scale-105' : 'opacity-60 hover:opacity-90'}`}
              style={mealType === mt.key
                ? { background: mt.color, color: '#fff', borderColor: mt.color }
                : { background: mt.bg, color: mt.color, borderColor: mt.color }}
              data-testid={`tab-bom-${mt.key}`}
            >
              {mt.label}
            </button>
          ))}
        </div>

        {/* Headcount Calculator + Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2.5">
          <Calculator className="w-4 h-4 text-indigo-500 shrink-0" />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 shrink-0">Headcount:</span>
          <Input
            type="number"
            min={1}
            value={headcount}
            onChange={e => setHeadcount(e.target.value)}
            className="w-24 h-8 text-sm font-bold text-center"
            data-testid="input-headcount"
          />
          <span className="text-xs text-muted-foreground">persons → Total Qty = Qty/Person × Headcount</span>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={handlePrint} data-testid="button-bom-print">
              <Printer className="w-3.5 h-3.5 mr-1" /> Print
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportExcel} className="text-green-700 border-green-300 hover:bg-green-50" data-testid="button-bom-excel">
              <Download className="w-3.5 h-3.5 mr-1" /> Excel
            </Button>
            <Button size="sm" onClick={() => setShowAdd(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white" data-testid="button-bom-add">
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Ingredient
            </Button>
          </div>
        </div>

        {/* Add Form */}
        {showAdd && (
          <Card className="border-indigo-200 bg-indigo-50 dark:bg-indigo-950/30">
            <CardContent className="p-4">
              <p className="text-sm font-bold text-indigo-700 mb-3">New Ingredient — {client} / {activeMt.label}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                <div className="lg:col-span-1">
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Menu Category</label>
                  <Select value={addForm.categoryName} onValueChange={v => setAddForm(f => ({ ...f, categoryName: v }))}>
                    <SelectTrigger className="h-8 text-xs" data-testid="select-add-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BASE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="lg:col-span-2">
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Ingredient / Material *</label>
                  <Input
                    placeholder="e.g. Rice, Dal, Oil..."
                    value={addForm.ingredientName}
                    onChange={e => setAddForm(f => ({ ...f, ingredientName: e.target.value }))}
                    className="h-8 text-sm"
                    data-testid="input-ingredient-name"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Qty / Person</label>
                  <Input
                    type="number"
                    step="0.001"
                    min={0}
                    value={addForm.qtyPerPerson}
                    onChange={e => setAddForm(f => ({ ...f, qtyPerPerson: e.target.value }))}
                    className="h-8 text-sm"
                    data-testid="input-qty-per-person"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">UOM</label>
                  <Select value={addForm.uom} onValueChange={v => setAddForm(f => ({ ...f, uom: v }))}>
                    <SelectTrigger className="h-8 text-xs" data-testid="select-add-uom"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {UOM_OPTIONS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Notes</label>
                  <Input
                    placeholder="optional"
                    value={addForm.notes}
                    onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))}
                    className="h-8 text-sm"
                    data-testid="input-notes"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <Button size="sm" onClick={handleAdd} disabled={createMut.isPending} className="bg-indigo-600 text-white" data-testid="button-confirm-add">
                  {createMut.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />} Add
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setShowAdd(false); setAddForm(emptyAdd); }}>
                  <X className="w-3.5 h-3.5 mr-1" /> Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-xl">
            <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-muted-foreground text-sm font-semibold">No ingredients added yet</p>
            <p className="text-muted-foreground text-xs mt-1">Click "Add Ingredient" to define raw material requirements for {client} — {activeMt.label}</p>
          </div>
        ) : (
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ background: activeMt.bg }}>
                <span className="text-sm font-bold" style={{ color: activeMt.color }}>{activeMt.label}</span>
                <span className="text-xs text-muted-foreground">— {client}</span>
                <span className="ml-auto text-xs font-semibold text-slate-600">{items.length} ingredient{items.length !== 1 ? 's' : ''}</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-700 text-white text-xs">
                    <th className="px-3 py-2 text-left font-semibold w-40">Menu Category</th>
                    <th className="px-3 py-2 text-left font-semibold">Ingredient / Material</th>
                    <th className="px-3 py-2 text-center font-semibold w-24">Qty / Person</th>
                    <th className="px-3 py-2 text-center font-semibold w-16">UOM</th>
                    <th className="px-3 py-2 text-center font-semibold w-28" style={{ background: '#166534' }}>
                      Total Qty ({hc} pax)
                    </th>
                    <th className="px-3 py-2 text-center font-semibold w-16">UOM</th>
                    <th className="px-3 py-2 text-left font-semibold w-32">Notes</th>
                    <th className="px-3 py-2 text-center font-semibold w-20">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(grouped).map(([catName, catItems]) =>
                    catItems.map((item, idx) => {
                      const total = (parseFloat(item.qtyPerPerson) * hc);
                      const isEditing = editId === item.id;
                      const rowBg = idx % 2 === 0 ? '#ffffff' : '#f9fafb';
                      return (
                        <tr key={item.id} style={{ background: isEditing ? '#eef2ff' : rowBg }}>
                          {/* Category */}
                          <td className="border-b border-slate-100 px-3 py-1.5">
                            {isEditing ? (
                              <Select value={editForm.categoryName ?? item.categoryName} onValueChange={v => setEditForm(f => ({ ...f, categoryName: v }))}>
                                <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
                                <SelectContent>{BASE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                              </Select>
                            ) : (
                              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{item.categoryName}</span>
                            )}
                          </td>
                          {/* Ingredient */}
                          <td className="border-b border-slate-100 px-3 py-1.5 font-semibold text-slate-800 dark:text-slate-100">
                            {isEditing
                              ? <Input value={editForm.ingredientName ?? item.ingredientName} onChange={e => setEditForm(f => ({ ...f, ingredientName: e.target.value }))} className="h-7 text-sm w-44" data-testid="input-edit-ingredient" />
                              : item.ingredientName}
                          </td>
                          {/* Qty/Person */}
                          <td className="border-b border-slate-100 px-3 py-1.5 text-center">
                            {isEditing
                              ? <Input type="number" step="0.001" value={editForm.qtyPerPerson ?? item.qtyPerPerson} onChange={e => setEditForm(f => ({ ...f, qtyPerPerson: e.target.value }))} className="h-7 text-sm w-20 text-center mx-auto" data-testid="input-edit-qty" />
                              : <span className="text-xs font-mono">{parseFloat(item.qtyPerPerson).toFixed(4)}</span>}
                          </td>
                          {/* UOM */}
                          <td className="border-b border-slate-100 px-3 py-1.5 text-center text-xs text-slate-500">
                            {isEditing
                              ? <Select value={editForm.uom ?? item.uom} onValueChange={v => setEditForm(f => ({ ...f, uom: v }))}><SelectTrigger className="h-7 text-xs w-16"><SelectValue /></SelectTrigger><SelectContent>{UOM_OPTIONS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select>
                              : item.uom}
                          </td>
                          {/* Total Qty */}
                          <td className="border-b border-slate-100 px-3 py-1.5 text-center">
                            <span className="font-bold text-green-700 text-sm">{total.toFixed(3)}</span>
                          </td>
                          {/* UOM for total */}
                          <td className="border-b border-slate-100 px-3 py-1.5 text-center text-xs text-slate-500">
                            {isEditing ? (editForm.uom ?? item.uom) : item.uom}
                          </td>
                          {/* Notes */}
                          <td className="border-b border-slate-100 px-3 py-1.5 text-xs text-slate-400">
                            {isEditing
                              ? <Input value={editForm.notes ?? (item.notes || '')} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} className="h-7 text-xs w-28" data-testid="input-edit-notes" />
                              : (item.notes || '—')}
                          </td>
                          {/* Actions */}
                          <td className="border-b border-slate-100 px-3 py-1.5 text-center">
                            {isEditing ? (
                              <div className="flex items-center gap-1 justify-center">
                                <Button size="icon" variant="ghost" className="h-6 w-6 text-green-600 hover:bg-green-50" onClick={() => handleUpdate(item)} disabled={updateMut.isPending} data-testid={`button-save-${item.id}`}>
                                  {updateMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                </Button>
                                <Button size="icon" variant="ghost" className="h-6 w-6 text-slate-400 hover:bg-slate-100" onClick={() => setEditId(null)} data-testid={`button-cancel-${item.id}`}>
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 justify-center">
                                <Button size="icon" variant="ghost" className="h-6 w-6 text-blue-500 hover:bg-blue-50" onClick={() => { setEditId(item.id); setEditForm({}); }} data-testid={`button-edit-${item.id}`}>
                                  <Pencil className="w-3 h-3" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-6 w-6 text-red-400 hover:bg-red-50" onClick={() => { if (confirm('Delete this ingredient?')) deleteMut.mutate(item.id); }} disabled={deleteMut.isPending} data-testid={`button-delete-${item.id}`}>
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {/* Grand Total Row */}
                {items.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-700 text-white">
                      <td colSpan={4} className="px-3 py-2 text-xs font-bold text-right">Grand Total for {hc} persons:</td>
                      <td className="px-3 py-2 text-center">
                        <span className="text-sm font-bold text-green-300">
                          {Object.entries(
                            items.reduce((acc: Record<string, number>, item) => {
                              const k = item.uom;
                              acc[k] = (acc[k] || 0) + parseFloat(item.qtyPerPerson) * hc;
                              return acc;
                            }, {})
                          ).map(([uom, qty]) => `${qty.toFixed(3)} ${uom}`).join(' + ')}
                        </span>
                      </td>
                      <td colSpan={3} className="px-3 py-2 text-xs text-slate-300">(grouped by UOM)</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </CardContent>
          </Card>
        )}

        {/* Summary by UOM card */}
        {items.length > 0 && hc > 0 && (
          <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
            <CardContent className="p-4">
              <p className="text-sm font-bold text-green-800 dark:text-green-200 mb-3">
                Procurement Summary — {activeMt.label} for {hc} persons ({client})
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {Object.entries(
                  items.reduce((acc: Record<string, { items: string[]; total: number; uom: string }>, item) => {
                    if (!acc[item.uom]) acc[item.uom] = { items: [], total: 0, uom: item.uom };
                    acc[item.uom].items.push(item.ingredientName);
                    acc[item.uom].total += parseFloat(item.qtyPerPerson) * hc;
                    return acc;
                  }, {})
                ).map(([uom, data]) => (
                  <div key={uom} className="bg-white dark:bg-slate-800 rounded-lg border border-green-200 px-3 py-2 shadow-sm">
                    <p className="text-xs text-muted-foreground">{data.items.length} ingredient{data.items.length !== 1 ? 's' : ''} in {uom}</p>
                    <p className="text-lg font-bold text-green-700">{data.total.toFixed(3)} <span className="text-sm font-semibold">{uom}</span></p>
                    <p className="text-xs text-slate-400 truncate">{data.items.slice(0, 3).join(', ')}{data.items.length > 3 ? '...' : ''}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
