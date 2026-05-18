import { useState, useMemo } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, Printer, Save, X, CalendarDays } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const DAYS = [
  { key: "monday",    label: "MONDAY" },
  { key: "tuesday",   label: "TUESDAY" },
  { key: "wednesday", label: "WEDNESDAY" },
  { key: "thursday",  label: "THURSDAY" },
  { key: "friday",    label: "FRIDAY" },
  { key: "saturday",  label: "SATURDAY" },
];

const MEAL_SECTIONS = [
  { key: "breakfast", label: "BREAKFAST",      color: "#e8515a", hasVegNonVeg: false },
  { key: "lunch",     label: "LUNCH",           color: "#f97316", hasVegNonVeg: true  },
  { key: "evening",   label: "EVENING SNACKS",  color: "#f97316", hasVegNonVeg: true  },
  { key: "night",     label: "NIGHT SNACKS",    color: "#3b82f6", hasVegNonVeg: false },
];

const CLIENTS = [
  "Hindustan Unilever Limited",
  "Unichem Laboratories Ltd",
  "United Breweries Limited",
  "Cipla Limited",
  "PEC VENTURES PRIVATE LIMITED",
];

interface MenuItem {
  id: number;
  client_name: string;
  week_day: string;
  meal_type: string;
  category: string;
  dish_name: string;
  quantity: string;
  notes: string | null;
  sort_order: number;
}

interface AddForm {
  dishName: string;
  quantity: string;
  notes: string;
}

const emptyForm: AddForm = { dishName: "", quantity: "", notes: "" };

export default function WeeklyBomPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [client, setClient] = useState(CLIENTS[0]);
  const [editCell, setEditCell] = useState<{ day: string; meal: string; cat: string } | null>(null);
  const [addForm, setAddForm] = useState<AddForm>(emptyForm);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<AddForm>(emptyForm);
  const [deleting, setDeleting] = useState<number | null>(null);

  const qKey = ["/api/weekly-menu", client];

  const { data: items = [], isLoading } = useQuery<MenuItem[]>({
    queryKey: qKey,
    queryFn: async () => {
      const r = await fetch(`/api/weekly-menu?clientName=${encodeURIComponent(client)}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load menu");
      return r.json();
    },
  });

  const createMut = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/weekly-menu", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: qKey }); setAddForm(emptyForm); toast({ title: "Item added" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PUT", `/api/weekly-menu/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: qKey }); setEditId(null); toast({ title: "Updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/weekly-menu/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: qKey }); setDeleting(null); toast({ title: "Deleted" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Group: day → meal → category → items
  const grouped = useMemo(() => {
    const g: Record<string, Record<string, Record<string, MenuItem[]>>> = {};
    DAYS.forEach(d => {
      g[d.key] = {};
      MEAL_SECTIONS.forEach(m => {
        g[d.key][m.key] = { veg: [], nonveg: [], all: [] };
      });
    });
    items.forEach(item => {
      const day = item.week_day;
      const meal = item.meal_type;
      const cat = item.category;
      if (g[day]?.[meal]?.[cat]) g[day][meal][cat].push(item);
    });
    return g;
  }, [items]);

  const openCell = (day: string, meal: string, cat: string) => {
    setEditCell({ day, meal, cat });
    setAddForm(emptyForm);
    setEditId(null);
  };

  const handleAdd = () => {
    if (!editCell || !addForm.dishName.trim()) return;
    const cellItems = grouped[editCell.day]?.[editCell.meal]?.[editCell.cat] ?? [];
    createMut.mutate({
      clientName: client,
      weekDay: editCell.day,
      mealType: editCell.meal,
      category: editCell.cat,
      dishName: addForm.dishName.trim(),
      quantity: addForm.quantity.trim(),
      notes: addForm.notes.trim() || null,
      sortOrder: cellItems.length,
    });
  };

  const handleUpdate = (item: MenuItem) => {
    updateMut.mutate({
      id: item.id,
      data: {
        dishName: editForm.dishName.trim() || item.dish_name,
        quantity: editForm.quantity.trim(),
        category: item.category,
        notes: editForm.notes.trim() || null,
        sortOrder: item.sort_order,
      },
    });
  };

  const getCellItems = (day: string, meal: string, cat: string) =>
    grouped[day]?.[meal]?.[cat] ?? [];

  // ── Print ──────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });

    const cellHtml = (day: string, meal: string, cat: string) => {
      const its = getCellItems(day, meal, cat);
      if (!its.length) return `<div style="color:#aaa;font-size:9px;text-align:center;padding:4px;">—</div>`;
      return its.map(i => `<div style="font-size:9px;line-height:1.5;">
        <span style="font-weight:600;">${i.dish_name}</span>
        ${i.quantity ? `<span style="color:#555;"> ${i.quantity}</span>` : ""}
      </div>`).join("");
    };

    let sections = "";
    MEAL_SECTIONS.forEach(ms => {
      const hasVN = ms.hasVegNonVeg;
      const hdrStyle = `background:${ms.color};color:#fff;font-weight:bold;font-size:11pt;text-align:center;padding:6px;`;

      if (hasVN) {
        const subHdrStyle = `background:#fff3e0;font-size:8pt;font-weight:bold;text-align:center;padding:3px;border:1px solid #eee;`;
        let rows = "";
        DAYS.forEach(d => {
          rows += `<td style="border:1px solid #ddd;vertical-align:top;padding:4px;min-width:80px;">
            <div style="font-size:8px;font-weight:bold;color:#4CAF50;margin-bottom:2px;">VEG</div>${cellHtml(d.key, ms.key, "veg")}
            <div style="font-size:8px;font-weight:bold;color:#E91E63;margin-top:4px;margin-bottom:2px;">NON-VEG</div>${cellHtml(d.key, ms.key, "nonveg")}
          </td>`;
        });
        sections += `<tr><td colspan="7" style="${hdrStyle}">${ms.label}</td></tr>
          <tr><td style="border:1px solid #ddd;background:#f5f5f5;font-size:9pt;font-weight:bold;text-align:center;padding:4px;">Item</td>
            ${DAYS.map(d => `<td style="${subHdrStyle}">${d.label}</td>`).join("")}
          </tr><tr>${rows}</tr>`;
      } else {
        let rows = "";
        DAYS.forEach(d => {
          rows += `<td style="border:1px solid #ddd;vertical-align:top;padding:6px;min-width:80px;">${cellHtml(d.key, ms.key, "all")}</td>`;
        });
        sections += `<tr><td colspan="7" style="${hdrStyle}">${ms.label}</td></tr>
          <tr><td style="border:1px solid #ddd;background:#f5f5f5;font-size:9pt;font-weight:bold;text-align:center;padding:4px;">Item</td>
            ${DAYS.map(d => `<td style="border:1px solid #ddd;background:#f5f5f5;font-size:9pt;font-weight:bold;text-align:center;padding:4px;">${d.label}</td>`).join("")}
          </tr><tr>${rows}</tr>`;
      }
    });

    const html = `<!DOCTYPE html><html><head><title>Weekly Menu BOM — ${client}</title>
    <style>
      @page { size: A4 landscape; margin: 8mm; }
      * { box-sizing: border-box; }
      body { font-family: Arial, sans-serif; margin: 0; }
      table { border-collapse: collapse; width: 100%; }
      @media print { button { display: none; } }
    </style></head><body>
    <div style="text-align:center;margin-bottom:8px;padding-bottom:6px;border-bottom:2px solid #333;">
      <div style="font-size:14pt;font-weight:bold;letter-spacing:1px;">HINDUSTAN UNILEVER LIMITED</div>
      <div style="font-size:10pt;color:#555;">KIDDERPORE FACTORY</div>
      <div style="background:#e8515a;color:#fff;font-size:14pt;font-weight:bold;display:inline-block;padding:3px 32px;margin-top:4px;letter-spacing:2px;">MENU</div>
    </div>
    <table>
      <thead><tr>
        <th style="border:1px solid #ddd;background:#f5f5f5;padding:5px;font-size:9pt;text-align:center;width:60px;">MEAL</th>
        ${DAYS.map(d => `<th style="border:1px solid #ddd;background:#f5f5f5;padding:5px;font-size:9pt;text-align:center;">${d.label}</th>`).join("")}
      </tr></thead>
      <tbody>${sections}</tbody>
    </table>
    <div style="margin-top:8px;display:flex;justify-content:space-between;font-size:8pt;color:#555;border-top:1px solid #ccc;padding-top:4px;">
      <div><strong>TIMINGS:</strong> Breakfast: 7:30–8:30 am &nbsp;|&nbsp; Lunch: 11:30 am–1:30 pm &nbsp;|&nbsp; Evening Snacks: 4:30–6:30 pm</div>
      <div><strong>SUBSIDISED PRICES:</strong> Breakfast: ₹5 &nbsp;|&nbsp; Lunch: ₹20 &nbsp;|&nbsp; Evening: ₹10 &nbsp;|&nbsp; Night: ₹15</div>
      <div>Printed: ${today}</div>
    </div>
    <script>window.onload=()=>window.print();</script>
    </body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  };

  // ── Render cell ───────────────────────────────────────────────────────────
  const renderCell = (day: string, meal: string, cat: string) => {
    const its = getCellItems(day, meal, cat);
    return (
      <div
        className="min-h-[60px] p-1 cursor-pointer hover:bg-orange-50/50 transition-colors group"
        onClick={() => openCell(day, meal, cat)}
      >
        {its.length === 0 && (
          <div className="text-[10px] text-slate-300 text-center pt-3 group-hover:text-slate-400">+ add</div>
        )}
        {its.map(item => (
          <div key={item.id} className="flex items-start gap-0.5 text-[10px] leading-tight mb-0.5">
            <span className="font-semibold text-slate-700 flex-1">{item.dish_name}</span>
            {item.quantity && <span className="text-slate-400 shrink-0">{item.quantity}</span>}
          </div>
        ))}
      </div>
    );
  };

  // ── Current cell items for dialog ─────────────────────────────────────────
  const dialogItems = editCell ? getCellItems(editCell.day, editCell.meal, editCell.cat) : [];
  const dialogMeal = MEAL_SECTIONS.find(m => m.key === editCell?.meal);
  const dialogDay = DAYS.find(d => d.key === editCell?.day);

  return (
    <Layout>
      <div className="max-w-full space-y-3 p-2 sm:p-4">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-orange-500" />
            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight">Weekly Menu Plan</h1>
              <p className="text-xs text-muted-foreground">Click any cell to add/edit menu items</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <Select value={client} onValueChange={v => { setClient(v); }}>
              <SelectTrigger className="w-52 font-semibold h-9" data-testid="select-weekly-client">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLIENTS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handlePrint} data-testid="button-weekly-print">
              <Printer className="w-4 h-4 mr-1.5" /> Print Menu
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border shadow-sm">
            <table className="w-full border-collapse" style={{ minWidth: 700 }}>
              {/* Day headers */}
              <thead>
                <tr>
                  <th className="border border-slate-200 bg-slate-800 text-white px-2 py-2 text-xs font-bold w-24">MEAL</th>
                  {DAYS.map(d => (
                    <th key={d.key} className="border border-slate-200 bg-slate-800 text-white px-2 py-2 text-xs font-bold text-center">
                      {d.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MEAL_SECTIONS.map(ms => (
                  <>
                    {/* Meal section header */}
                    <tr key={`hdr-${ms.key}`}>
                      <td
                        colSpan={7}
                        className="py-1.5 px-3 text-white text-xs font-bold tracking-wider text-center"
                        style={{ background: ms.color }}
                      >
                        {ms.label}
                      </td>
                    </tr>

                    {ms.hasVegNonVeg ? (
                      <>
                        {/* VEG row */}
                        <tr key={`${ms.key}-veg`} className="bg-green-50/40">
                          <td className="border border-slate-200 px-1 py-1 text-center">
                            <span className="text-[9px] font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded">VEG</span>
                          </td>
                          {DAYS.map(d => (
                            <td key={d.key} className="border border-slate-200 align-top p-0">
                              {renderCell(d.key, ms.key, "veg")}
                            </td>
                          ))}
                        </tr>
                        {/* NON-VEG row */}
                        <tr key={`${ms.key}-nonveg`} className="bg-red-50/30">
                          <td className="border border-slate-200 px-1 py-1 text-center">
                            <span className="text-[9px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded">NON-VEG</span>
                          </td>
                          {DAYS.map(d => (
                            <td key={d.key} className="border border-slate-200 align-top p-0">
                              {renderCell(d.key, ms.key, "nonveg")}
                            </td>
                          ))}
                        </tr>
                      </>
                    ) : (
                      <tr key={`${ms.key}-all`}>
                        <td className="border border-slate-200 px-1 py-1 text-center">
                          <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">ITEMS</span>
                        </td>
                        {DAYS.map(d => (
                          <td key={d.key} className="border border-slate-200 align-top p-0">
                            {renderCell(d.key, ms.key, "all")}
                          </td>
                        ))}
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer legend */}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground border rounded-lg px-3 py-2 bg-muted/20">
          <span className="font-semibold text-slate-600">Timings:</span>
          <span>Breakfast 7:30–8:30 am</span>
          <span>|</span>
          <span>Lunch 11:30 am–1:30 pm</span>
          <span>|</span>
          <span>Evening Snacks 4:30–6:30 pm</span>
          <span className="ml-4 font-semibold text-slate-600">Subsidised Prices:</span>
          <span>Breakfast ₹5</span>
          <span>Lunch ₹20</span>
          <span>Evening ₹10</span>
          <span>Night ₹15</span>
        </div>
      </div>

      {/* ── Edit Cell Dialog ── */}
      <Dialog open={!!editCell} onOpenChange={open => { if (!open) { setEditCell(null); setEditId(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <span
                className="px-2 py-0.5 rounded text-white text-xs font-bold"
                style={{ background: dialogMeal?.color ?? "#666" }}
              >
                {dialogMeal?.label}
              </span>
              <span className="text-slate-600">{dialogDay?.label}</span>
              {editCell?.cat !== "all" && (
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${editCell?.cat === "veg" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                  {editCell?.cat?.toUpperCase()}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {/* Existing items */}
          <div className="space-y-1 max-h-52 overflow-y-auto">
            {dialogItems.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">No items yet — add below</p>
            )}
            {dialogItems.map(item => (
              <div key={item.id} className="flex items-center gap-2 border rounded px-2 py-1.5 bg-slate-50">
                {editId === item.id ? (
                  <>
                    <Input
                      value={editForm.dishName}
                      onChange={e => setEditForm(f => ({ ...f, dishName: e.target.value }))}
                      className="h-7 text-xs flex-1"
                      placeholder="Dish name"
                      data-testid={`edit-dish-${item.id}`}
                    />
                    <Input
                      value={editForm.quantity}
                      onChange={e => setEditForm(f => ({ ...f, quantity: e.target.value }))}
                      className="h-7 text-xs w-20"
                      placeholder="Qty"
                      data-testid={`edit-qty-${item.id}`}
                    />
                    <Button
                      size="icon" variant="ghost" className="h-7 w-7 text-green-600"
                      onClick={() => handleUpdate(item)}
                      disabled={updateMut.isPending}
                      data-testid={`save-item-${item.id}`}
                    >
                      {updateMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditId(null)}>
                      <X className="w-3 h-3" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-xs font-semibold">{item.dish_name}</span>
                    {item.quantity && <span className="text-xs text-slate-500">{item.quantity}</span>}
                    <button
                      className="text-[10px] text-blue-500 hover:underline px-1"
                      onClick={() => { setEditId(item.id); setEditForm({ dishName: item.dish_name, quantity: item.quantity, notes: item.notes ?? "" }); }}
                      data-testid={`edit-btn-${item.id}`}
                    >
                      Edit
                    </button>
                    <button
                      className="text-red-400 hover:text-red-600"
                      onClick={() => deleteMut.mutate(item.id)}
                      disabled={deleteMut.isPending}
                      data-testid={`delete-btn-${item.id}`}
                    >
                      {deleteMut.isPending && deleting === item.id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <Trash2 className="w-3 h-3" />
                      }
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Add new item */}
          <div className="border-t pt-3 space-y-2">
            <p className="text-xs font-semibold text-slate-500">Add new item</p>
            <div className="flex gap-2">
              <Input
                placeholder="Dish / item name (e.g. Rice, Dal, Fish)"
                value={addForm.dishName}
                onChange={e => setAddForm(f => ({ ...f, dishName: e.target.value }))}
                className="h-8 text-sm flex-1"
                data-testid="input-new-dish"
                onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
              />
              <Input
                placeholder="Qty (e.g. 200 gm)"
                value={addForm.quantity}
                onChange={e => setAddForm(f => ({ ...f, quantity: e.target.value }))}
                className="h-8 text-sm w-28"
                data-testid="input-new-qty"
                onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleAdd}
                disabled={createMut.isPending || !addForm.dishName.trim()}
                className="bg-orange-500 hover:bg-orange-600 text-white"
                data-testid="button-add-menu-item"
              >
                {createMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Plus className="w-3.5 h-3.5 mr-1" />}
                Add
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setEditCell(null); setEditId(null); }}>
                <X className="w-3.5 h-3.5 mr-1" /> Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
