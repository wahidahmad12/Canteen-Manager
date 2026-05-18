import { useState, useMemo } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, Printer, Save, X, CalendarDays, ClipboardList, RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const DAYS = [
  { key: "monday",    label: "MONDAY",    short: "Mon" },
  { key: "tuesday",   label: "TUESDAY",   short: "Tue" },
  { key: "wednesday", label: "WEDNESDAY", short: "Wed" },
  { key: "thursday",  label: "THURSDAY",  short: "Thu" },
  { key: "friday",    label: "FRIDAY",    short: "Fri" },
  { key: "saturday",  label: "SATURDAY",  short: "Sat" },
];

const MEAL_SECTIONS = [
  { key: "breakfast", label: "BREAKFAST",     color: "#e8515a", hasVegNonVeg: false },
  { key: "lunch",     label: "LUNCH",          color: "#f97316", hasVegNonVeg: true  },
  { key: "evening",   label: "EVENING SNACKS", color: "#22a06b", hasVegNonVeg: true  },
  { key: "night",     label: "NIGHT SNACKS",   color: "#3b82f6", hasVegNonVeg: false },
];

const CLIENTS = [
  "Hindustan Unilever Limited",
  "Unichem Laboratories Ltd",
  "United Breweries Limited",
  "Cipla Limited",
  "PEC VENTURES PRIVATE LIMITED",
];

// ── HUL Kidderpore Factory Standard Menu Template ───────────────────────────
const HUL_TEMPLATE: Array<{ weekDay: string; mealType: string; category: string; dishName: string; quantity: string; sortOrder: number }> = [
  // ── MONDAY ──
  { weekDay:"monday", mealType:"breakfast", category:"all",    dishName:"Luchi",       quantity:"4 pcs",   sortOrder:1 },
  { weekDay:"monday", mealType:"breakfast", category:"all",    dishName:"Chana Dal",   quantity:"25 gm",   sortOrder:2 },
  { weekDay:"monday", mealType:"lunch",     category:"veg",    dishName:"Rice",        quantity:"200 gm",  sortOrder:1 },
  { weekDay:"monday", mealType:"lunch",     category:"veg",    dishName:"Roti",        quantity:"4 pcs",   sortOrder:2 },
  { weekDay:"monday", mealType:"lunch",     category:"veg",    dishName:"Dal",         quantity:"25 gm",   sortOrder:3 },
  { weekDay:"monday", mealType:"lunch",     category:"veg",    dishName:"Sabji",       quantity:"100 gm",  sortOrder:4 },
  { weekDay:"monday", mealType:"lunch",     category:"veg",    dishName:"Bhaja",       quantity:"50 gm",   sortOrder:5 },
  { weekDay:"monday", mealType:"lunch",     category:"veg",    dishName:"Banana",      quantity:"1 pc",    sortOrder:6 },
  { weekDay:"monday", mealType:"lunch",     category:"veg",    dishName:"Dahi",        quantity:"100 gm",  sortOrder:7 },
  { weekDay:"monday", mealType:"lunch",     category:"nonveg", dishName:"Rice",        quantity:"200 gm",  sortOrder:1 },
  { weekDay:"monday", mealType:"lunch",     category:"nonveg", dishName:"Roti",        quantity:"4 pcs",   sortOrder:2 },
  { weekDay:"monday", mealType:"lunch",     category:"nonveg", dishName:"Dal",         quantity:"25 gm",   sortOrder:3 },
  { weekDay:"monday", mealType:"lunch",     category:"nonveg", dishName:"Sabji",       quantity:"100 gm",  sortOrder:4 },
  { weekDay:"monday", mealType:"lunch",     category:"nonveg", dishName:"Bhaja",       quantity:"50 gm",   sortOrder:5 },
  { weekDay:"monday", mealType:"lunch",     category:"nonveg", dishName:"Fish",        quantity:"70 gm",   sortOrder:6 },
  { weekDay:"monday", mealType:"lunch",     category:"nonveg", dishName:"Dahi",        quantity:"100 gm",  sortOrder:7 },
  { weekDay:"monday", mealType:"evening",   category:"veg",    dishName:"Paratha",     quantity:"1 pc",    sortOrder:1 },
  { weekDay:"monday", mealType:"evening",   category:"veg",    dishName:"Aloo Sabji",  quantity:"100 gm",  sortOrder:2 },
  { weekDay:"monday", mealType:"evening",   category:"veg",    dishName:"Salad",       quantity:"50 gm",   sortOrder:3 },
  { weekDay:"monday", mealType:"night",     category:"all",    dishName:"Cake",        quantity:"1 pkt",   sortOrder:1 },
  { weekDay:"monday", mealType:"night",     category:"all",    dishName:"Biscuit",     quantity:"1 pkt",   sortOrder:2 },

  // ── TUESDAY ──
  { weekDay:"tuesday", mealType:"breakfast", category:"all",    dishName:"Roti",        quantity:"4 pcs",   sortOrder:1 },
  { weekDay:"tuesday", mealType:"breakfast", category:"all",    dishName:"Aloo Dum",    quantity:"100 gm",  sortOrder:2 },
  { weekDay:"tuesday", mealType:"lunch",     category:"veg",    dishName:"Rice",        quantity:"200 gm",  sortOrder:1 },
  { weekDay:"tuesday", mealType:"lunch",     category:"veg",    dishName:"Roti",        quantity:"4 pcs",   sortOrder:2 },
  { weekDay:"tuesday", mealType:"lunch",     category:"veg",    dishName:"Dal",         quantity:"25 gm",   sortOrder:3 },
  { weekDay:"tuesday", mealType:"lunch",     category:"veg",    dishName:"Sabji",       quantity:"100 gm",  sortOrder:4 },
  { weekDay:"tuesday", mealType:"lunch",     category:"veg",    dishName:"Bhaja",       quantity:"50 gm",   sortOrder:5 },
  { weekDay:"tuesday", mealType:"lunch",     category:"veg",    dishName:"Banana",      quantity:"1 pc",    sortOrder:6 },
  { weekDay:"tuesday", mealType:"lunch",     category:"veg",    dishName:"Dahi",        quantity:"100 gm",  sortOrder:7 },
  { weekDay:"tuesday", mealType:"lunch",     category:"nonveg", dishName:"Rice",        quantity:"200 gm",  sortOrder:1 },
  { weekDay:"tuesday", mealType:"lunch",     category:"nonveg", dishName:"Roti",        quantity:"4 pcs",   sortOrder:2 },
  { weekDay:"tuesday", mealType:"lunch",     category:"nonveg", dishName:"Dal",         quantity:"25 gm",   sortOrder:3 },
  { weekDay:"tuesday", mealType:"lunch",     category:"nonveg", dishName:"Sabji",       quantity:"100 gm",  sortOrder:4 },
  { weekDay:"tuesday", mealType:"lunch",     category:"nonveg", dishName:"Bhaja",       quantity:"50 gm",   sortOrder:5 },
  { weekDay:"tuesday", mealType:"lunch",     category:"nonveg", dishName:"Chicken",     quantity:"100 gm",  sortOrder:6 },
  { weekDay:"tuesday", mealType:"lunch",     category:"nonveg", dishName:"Egg",         quantity:"1 pc",    sortOrder:7 },
  { weekDay:"tuesday", mealType:"lunch",     category:"nonveg", dishName:"Dahi",        quantity:"100 gm",  sortOrder:8 },
  { weekDay:"tuesday", mealType:"evening",   category:"veg",    dishName:"Kachuri",     quantity:"4 pcs",   sortOrder:1 },
  { weekDay:"tuesday", mealType:"evening",   category:"veg",    dishName:"Chana Masala",quantity:"100 gm",  sortOrder:2 },
  { weekDay:"tuesday", mealType:"night",     category:"all",    dishName:"Cake",        quantity:"1 pkt",   sortOrder:1 },
  { weekDay:"tuesday", mealType:"night",     category:"all",    dishName:"Biscuit",     quantity:"1 pkt",   sortOrder:2 },

  // ── WEDNESDAY ──
  { weekDay:"wednesday", mealType:"breakfast", category:"all",    dishName:"Paratha",      quantity:"2 pcs",  sortOrder:1 },
  { weekDay:"wednesday", mealType:"breakfast", category:"all",    dishName:"Chana Masala", quantity:"100 gm", sortOrder:2 },
  { weekDay:"wednesday", mealType:"lunch",     category:"veg",    dishName:"Rice",         quantity:"200 gm", sortOrder:1 },
  { weekDay:"wednesday", mealType:"lunch",     category:"veg",    dishName:"Roti",         quantity:"4 pcs",  sortOrder:2 },
  { weekDay:"wednesday", mealType:"lunch",     category:"veg",    dishName:"Dal",          quantity:"25 gm",  sortOrder:3 },
  { weekDay:"wednesday", mealType:"lunch",     category:"veg",    dishName:"Sabji",        quantity:"100 gm", sortOrder:4 },
  { weekDay:"wednesday", mealType:"lunch",     category:"veg",    dishName:"Bhaja",        quantity:"50 gm",  sortOrder:5 },
  { weekDay:"wednesday", mealType:"lunch",     category:"veg",    dishName:"Banana",       quantity:"1 pc",   sortOrder:6 },
  { weekDay:"wednesday", mealType:"lunch",     category:"veg",    dishName:"Dahi",         quantity:"100 gm", sortOrder:7 },
  { weekDay:"wednesday", mealType:"lunch",     category:"nonveg", dishName:"Rice",         quantity:"200 gm", sortOrder:1 },
  { weekDay:"wednesday", mealType:"lunch",     category:"nonveg", dishName:"Roti",         quantity:"4 pcs",  sortOrder:2 },
  { weekDay:"wednesday", mealType:"lunch",     category:"nonveg", dishName:"Dal",          quantity:"25 gm",  sortOrder:3 },
  { weekDay:"wednesday", mealType:"lunch",     category:"nonveg", dishName:"Sabji",        quantity:"100 gm", sortOrder:4 },
  { weekDay:"wednesday", mealType:"lunch",     category:"nonveg", dishName:"Bhaja",        quantity:"50 gm",  sortOrder:5 },
  { weekDay:"wednesday", mealType:"lunch",     category:"nonveg", dishName:"Chicken",      quantity:"100 gm", sortOrder:6 },
  { weekDay:"wednesday", mealType:"lunch",     category:"nonveg", dishName:"Egg",          quantity:"1 pc",   sortOrder:7 },
  { weekDay:"wednesday", mealType:"lunch",     category:"nonveg", dishName:"Dahi",         quantity:"100 gm", sortOrder:8 },
  { weekDay:"wednesday", mealType:"evening",   category:"veg",    dishName:"Veg Roll",     quantity:"1 pc",   sortOrder:1 },
  { weekDay:"wednesday", mealType:"evening",   category:"veg",    dishName:"Salad",        quantity:"50 gm",  sortOrder:2 },
  { weekDay:"wednesday", mealType:"evening",   category:"veg",    dishName:"Mishti",       quantity:"1 pc",   sortOrder:3 },
  { weekDay:"wednesday", mealType:"night",     category:"all",    dishName:"Cake",         quantity:"1 pkt",  sortOrder:1 },
  { weekDay:"wednesday", mealType:"night",     category:"all",    dishName:"Biscuit",      quantity:"1 pkt",  sortOrder:2 },

  // ── THURSDAY ──
  { weekDay:"thursday", mealType:"breakfast", category:"all",    dishName:"Luchi",        quantity:"4 pcs",  sortOrder:1 },
  { weekDay:"thursday", mealType:"breakfast", category:"all",    dishName:"Aloo Sabji",   quantity:"100 gm", sortOrder:2 },
  { weekDay:"thursday", mealType:"lunch",     category:"veg",    dishName:"Rice",         quantity:"200 gm", sortOrder:1 },
  { weekDay:"thursday", mealType:"lunch",     category:"veg",    dishName:"Roti",         quantity:"4 pcs",  sortOrder:2 },
  { weekDay:"thursday", mealType:"lunch",     category:"veg",    dishName:"Dal",          quantity:"25 gm",  sortOrder:3 },
  { weekDay:"thursday", mealType:"lunch",     category:"veg",    dishName:"Sabji",        quantity:"100 gm", sortOrder:4 },
  { weekDay:"thursday", mealType:"lunch",     category:"veg",    dishName:"Bhaja",        quantity:"50 gm",  sortOrder:5 },
  { weekDay:"thursday", mealType:"lunch",     category:"veg",    dishName:"Banana",       quantity:"1 pc",   sortOrder:6 },
  { weekDay:"thursday", mealType:"lunch",     category:"veg",    dishName:"Dahi",         quantity:"100 gm", sortOrder:7 },
  { weekDay:"thursday", mealType:"lunch",     category:"nonveg", dishName:"Rice",         quantity:"200 gm", sortOrder:1 },
  { weekDay:"thursday", mealType:"lunch",     category:"nonveg", dishName:"Roti",         quantity:"4 pcs",  sortOrder:2 },
  { weekDay:"thursday", mealType:"lunch",     category:"nonveg", dishName:"Dal",          quantity:"25 gm",  sortOrder:3 },
  { weekDay:"thursday", mealType:"lunch",     category:"nonveg", dishName:"Sabji",        quantity:"100 gm", sortOrder:4 },
  { weekDay:"thursday", mealType:"lunch",     category:"nonveg", dishName:"Bhaja",        quantity:"50 gm",  sortOrder:5 },
  { weekDay:"thursday", mealType:"lunch",     category:"nonveg", dishName:"Paneer",       quantity:"100 gm", sortOrder:6 },
  { weekDay:"thursday", mealType:"lunch",     category:"nonveg", dishName:"Dahi",         quantity:"100 gm", sortOrder:7 },
  { weekDay:"thursday", mealType:"lunch",     category:"nonveg", dishName:"Mishti",       quantity:"1 pc",   sortOrder:8 },
  { weekDay:"thursday", mealType:"evening",   category:"veg",    dishName:"Egg Roll",     quantity:"1 pc",   sortOrder:1 },
  { weekDay:"thursday", mealType:"evening",   category:"veg",    dishName:"Ghugni",       quantity:"100 gm", sortOrder:2 },
  { weekDay:"thursday", mealType:"evening",   category:"veg",    dishName:"Mishti",       quantity:"1 pc",   sortOrder:3 },
  { weekDay:"thursday", mealType:"evening",   category:"veg",    dishName:"Banana",       quantity:"1 pc",   sortOrder:4 },
  { weekDay:"thursday", mealType:"night",     category:"all",    dishName:"Cake",         quantity:"1 pkt",  sortOrder:1 },
  { weekDay:"thursday", mealType:"night",     category:"all",    dishName:"Biscuit",      quantity:"1 pkt",  sortOrder:2 },

  // ── FRIDAY ──
  { weekDay:"friday", mealType:"breakfast", category:"all",    dishName:"Roti",           quantity:"4 pcs",  sortOrder:1 },
  { weekDay:"friday", mealType:"breakfast", category:"all",    dishName:"Aloo Masala",    quantity:"100 gm", sortOrder:2 },
  { weekDay:"friday", mealType:"lunch",     category:"veg",    dishName:"Fried Rice",     quantity:"200 gm", sortOrder:1 },
  { weekDay:"friday", mealType:"lunch",     category:"veg",    dishName:"Roti",           quantity:"4 pcs",  sortOrder:2 },
  { weekDay:"friday", mealType:"lunch",     category:"veg",    dishName:"Dal",            quantity:"25 gm",  sortOrder:3 },
  { weekDay:"friday", mealType:"lunch",     category:"veg",    dishName:"Sabji",          quantity:"100 gm", sortOrder:4 },
  { weekDay:"friday", mealType:"lunch",     category:"veg",    dishName:"Bhaja",          quantity:"50 gm",  sortOrder:5 },
  { weekDay:"friday", mealType:"lunch",     category:"veg",    dishName:"Banana",         quantity:"1 pc",   sortOrder:6 },
  { weekDay:"friday", mealType:"lunch",     category:"veg",    dishName:"Dahi",           quantity:"100 gm", sortOrder:7 },
  { weekDay:"friday", mealType:"lunch",     category:"nonveg", dishName:"Fried Rice",     quantity:"200 gm", sortOrder:1 },
  { weekDay:"friday", mealType:"lunch",     category:"nonveg", dishName:"Roti",           quantity:"4 pcs",  sortOrder:2 },
  { weekDay:"friday", mealType:"lunch",     category:"nonveg", dishName:"Dal",            quantity:"25 gm",  sortOrder:3 },
  { weekDay:"friday", mealType:"lunch",     category:"nonveg", dishName:"Sabji",          quantity:"100 gm", sortOrder:4 },
  { weekDay:"friday", mealType:"lunch",     category:"nonveg", dishName:"Bhaja",          quantity:"50 gm",  sortOrder:5 },
  { weekDay:"friday", mealType:"lunch",     category:"nonveg", dishName:"Chilli Chicken", quantity:"100 gm", sortOrder:6 },
  { weekDay:"friday", mealType:"lunch",     category:"nonveg", dishName:"Egg",            quantity:"1 pc",   sortOrder:7 },
  { weekDay:"friday", mealType:"lunch",     category:"nonveg", dishName:"Banana",         quantity:"1 pc",   sortOrder:8 },
  { weekDay:"friday", mealType:"evening",   category:"veg",    dishName:"Bread",          quantity:"5 pcs",  sortOrder:1 },
  { weekDay:"friday", mealType:"evening",   category:"veg",    dishName:"Ghugni",         quantity:"100 gm", sortOrder:2 },
  { weekDay:"friday", mealType:"evening",   category:"veg",    dishName:"Banana",         quantity:"1 pc",   sortOrder:3 },
  { weekDay:"friday", mealType:"evening",   category:"nonveg", dishName:"Taaka",          quantity:"100 gm", sortOrder:1 },
  { weekDay:"friday", mealType:"evening",   category:"nonveg", dishName:"Egg",            quantity:"1 pc",   sortOrder:2 },
  { weekDay:"friday", mealType:"night",     category:"all",    dishName:"Cake",           quantity:"1 pkt",  sortOrder:1 },
  { weekDay:"friday", mealType:"night",     category:"all",    dishName:"Biscuit",        quantity:"1 pkt",  sortOrder:2 },

  // ── SATURDAY ──
  { weekDay:"saturday", mealType:"breakfast", category:"all",    dishName:"Paratha",     quantity:"2 pcs",  sortOrder:1 },
  { weekDay:"saturday", mealType:"breakfast", category:"all",    dishName:"Ghugni",      quantity:"100 gm", sortOrder:2 },
  { weekDay:"saturday", mealType:"lunch",     category:"veg",    dishName:"Rice",        quantity:"200 gm", sortOrder:1 },
  { weekDay:"saturday", mealType:"lunch",     category:"veg",    dishName:"Roti",        quantity:"4 pcs",  sortOrder:2 },
  { weekDay:"saturday", mealType:"lunch",     category:"veg",    dishName:"Dal",         quantity:"25 gm",  sortOrder:3 },
  { weekDay:"saturday", mealType:"lunch",     category:"veg",    dishName:"Sabji",       quantity:"100 gm", sortOrder:4 },
  { weekDay:"saturday", mealType:"lunch",     category:"veg",    dishName:"Bhaja",       quantity:"50 gm",  sortOrder:5 },
  { weekDay:"saturday", mealType:"lunch",     category:"veg",    dishName:"Banana",      quantity:"1 pc",   sortOrder:6 },
  { weekDay:"saturday", mealType:"lunch",     category:"veg",    dishName:"Mishti",      quantity:"1 pc",   sortOrder:7 },
  { weekDay:"saturday", mealType:"lunch",     category:"nonveg", dishName:"Rice",        quantity:"200 gm", sortOrder:1 },
  { weekDay:"saturday", mealType:"lunch",     category:"nonveg", dishName:"Roti",        quantity:"4 pcs",  sortOrder:2 },
  { weekDay:"saturday", mealType:"lunch",     category:"nonveg", dishName:"Dal",         quantity:"25 gm",  sortOrder:3 },
  { weekDay:"saturday", mealType:"lunch",     category:"nonveg", dishName:"Sabji",       quantity:"100 gm", sortOrder:4 },
  { weekDay:"saturday", mealType:"lunch",     category:"nonveg", dishName:"Bhaja",       quantity:"50 gm",  sortOrder:5 },
  { weekDay:"saturday", mealType:"lunch",     category:"nonveg", dishName:"Fish",        quantity:"70 gm",  sortOrder:6 },
  { weekDay:"saturday", mealType:"lunch",     category:"nonveg", dishName:"Banana",      quantity:"1 pc",   sortOrder:7 },
  { weekDay:"saturday", mealType:"lunch",     category:"nonveg", dishName:"Mishti",      quantity:"1 pc",   sortOrder:8 },
  { weekDay:"saturday", mealType:"evening",   category:"veg",    dishName:"Rui",         quantity:"4 pcs",  sortOrder:1 },
  { weekDay:"saturday", mealType:"evening",   category:"veg",    dishName:"Aloo Sabji",  quantity:"100 gm", sortOrder:2 },
  { weekDay:"saturday", mealType:"evening",   category:"veg",    dishName:"Mishti",      quantity:"1 pc",   sortOrder:3 },
  { weekDay:"saturday", mealType:"night",     category:"all",    dishName:"Cake",        quantity:"1 pkt",  sortOrder:1 },
  { weekDay:"saturday", mealType:"night",     category:"all",    dishName:"Biscuit",     quantity:"1 pkt",  sortOrder:2 },
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

// Parse "200 gm" → { qty: 200, unit: "gm" }
function parseQty(q: string): { qty: number; unit: string } {
  const m = q.trim().match(/^([\d.]+)\s*(.*)$/);
  if (!m) return { qty: 0, unit: q.trim() };
  return { qty: parseFloat(m[1]), unit: m[2].trim().toLowerCase() };
}

// Convert raw unit to a practical display unit
// gm → kg (÷1000),  ml → L (÷1000),  others unchanged
function getDisplayUnit(unit: string): { displayUnit: string; divisor: number } {
  const u = unit.toLowerCase().trim();
  if (["gm", "g", "gram", "grams"].includes(u)) return { displayUnit: "kg", divisor: 1000 };
  if (["ml", "milliliter", "millilitre"].includes(u)) return { displayUnit: "L", divisor: 1000 };
  return { displayUnit: unit, divisor: 1 };
}

export default function WeeklyBomPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [client, setClient] = useState(CLIENTS[0]);
  const [editCell, setEditCell] = useState<{ day: string; meal: string; cat: string } | null>(null);
  const [addForm, setAddForm] = useState({ dishName: "", quantity: "" });
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ dishName: "", quantity: "" });
  const [loadingTemplate, setLoadingTemplate] = useState(false);

  // Headcount state: { day_meal_cat: number }
  const [headcount, setHeadcount] = useState<Record<string, number>>({});

  // Rates state loaded from DB: { "ingredientName|unit": rate }
  const [rates, setRates] = useState<Record<string, number>>({});

  const qKey      = ["/api/weekly-menu", client];
  const ratesQKey = ["/api/weekly-menu-rates", client];

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
    onSuccess: () => { qc.invalidateQueries({ queryKey: qKey }); setAddForm({ dishName: "", quantity: "" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PUT", `/api/weekly-menu/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: qKey }); setEditId(null); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/weekly-menu/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: qKey }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Load rates from DB
  useQuery({
    queryKey: ratesQKey,
    queryFn: async () => {
      const r = await fetch(`/api/weekly-menu-rates?clientName=${encodeURIComponent(client)}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load rates");
      const rows: any[] = await r.json();
      const map: Record<string, number> = {};
      rows.forEach(row => { map[`${row.ingredient_name.toLowerCase()}|${(row.unit || "").toLowerCase()}`] = parseFloat(row.rate) || 0; });
      setRates(map);
      return rows;
    },
  });

  // Save rate to DB (called on blur / change)
  const saveRateMut = useMutation({
    mutationFn: (data: { ingredientName: string; unit: string; rate: number }) =>
      apiRequest("POST", "/api/weekly-menu-rates", { clientName: client, ...data }),
  });

  const setRate = (key: string, ingredientName: string, unit: string, val: number) => {
    setRates(prev => ({ ...prev, [key]: val }));
    saveRateMut.mutate({ ingredientName, unit, rate: val });
  };

  // Group items for fast lookup
  const grouped = useMemo(() => {
    const g: Record<string, Record<string, Record<string, MenuItem[]>>> = {};
    DAYS.forEach(d => {
      g[d.key] = {};
      MEAL_SECTIONS.forEach(m => {
        g[d.key][m.key] = { veg: [], nonveg: [], all: [] };
      });
    });
    items.forEach(item => {
      const cat = item.category as "veg" | "nonveg" | "all";
      if (g[item.week_day]?.[item.meal_type]?.[cat] !== undefined)
        g[item.week_day][item.meal_type][cat].push(item);
    });
    return g;
  }, [items]);

  const getCellItems = (day: string, meal: string, cat: string) =>
    grouped[day]?.[meal]?.[cat] ?? [];

  // ── Load HUL Template ─────────────────────────────────────────────────────
  const loadTemplate = async () => {
    if (!window.confirm(`This will CLEAR all current menu items for "${client}" and load the HUL Kidderpore standard menu. Continue?`)) return;
    setLoadingTemplate(true);
    try {
      // Delete all existing
      for (const item of items) {
        await apiRequest("DELETE", `/api/weekly-menu/${item.id}`);
      }
      // Insert template
      for (const t of HUL_TEMPLATE) {
        await apiRequest("POST", "/api/weekly-menu", { ...t, clientName: client });
      }
      qc.invalidateQueries({ queryKey: qKey });
      toast({ title: "HUL Kidderpore template loaded!" });
    } catch (e: any) {
      toast({ title: "Error loading template", description: e.message, variant: "destructive" });
    } finally {
      setLoadingTemplate(false);
    }
  };

  // ── BOM Calculation ───────────────────────────────────────────────────────
  const bomRows = useMemo(() => {
    const map: Record<string, { dishName: string; unit: string; byDay: Record<string, number>; total: number }> = {};

    items.forEach(item => {
      const { qty, unit } = parseQty(item.quantity);
      if (qty === 0) return;
      const key = `${item.dish_name.toLowerCase()}|${unit}`;
      if (!map[key]) map[key] = { dishName: item.dish_name, unit, byDay: {}, total: 0 };

      const hk = `${item.week_day}_${item.meal_type}_${item.category}`;
      const hc = headcount[hk] ?? 0;
      const dayTotal = qty * hc;
      map[key].byDay[item.week_day] = (map[key].byDay[item.week_day] ?? 0) + dayTotal;
      map[key].total += dayTotal;
    });

    return Object.values(map)
      .sort((a, b) => a.dishName.localeCompare(b.dishName))
      .map(row => {
        const rateKey = `${row.dishName.toLowerCase()}|${row.unit}`;
        const rate = rates[rateKey] ?? 0;
        const { displayUnit, divisor } = getDisplayUnit(row.unit);
        const displayTotal = row.total / divisor;
        // Day totals also converted for display
        const displayByDay: Record<string, number> = {};
        Object.entries(row.byDay).forEach(([d, v]) => { displayByDay[d] = v / divisor; });
        const cost = rate > 0 ? displayTotal * rate : 0;
        return { ...row, rateKey, rate, cost, displayUnit, displayTotal, displayByDay };
      });
  }, [items, headcount, rates]);

  const hcKey = (day: string, meal: string, cat: string) => `${day}_${meal}_${cat}`;

  // ── Print ─────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
    const cellHtml = (day: string, meal: string, cat: string) => {
      const its = getCellItems(day, meal, cat);
      if (!its.length) return `<span style="color:#ccc;font-size:8px;">—</span>`;
      return its.map(i => `<div style="font-size:8px;line-height:1.5;"><b>${i.dish_name}</b>${i.quantity ? ` <span style="color:#555;">${i.quantity}</span>` : ""}</div>`).join("");
    };
    let sections = "";
    MEAL_SECTIONS.forEach(ms => {
      if (ms.hasVegNonVeg) {
        sections += `<tr><td colspan="7" style="background:${ms.color};color:#fff;font-weight:bold;text-align:center;padding:5px;font-size:10pt;">${ms.label}</td></tr>
          <tr><td style="border:1px solid #ddd;background:#f9fbe7;font-size:8pt;font-weight:bold;text-align:center;padding:3px;font-size:8px;">VEG</td>
            ${DAYS.map(d => `<td style="border:1px solid #ddd;vertical-align:top;padding:3px;">${cellHtml(d.key, ms.key, "veg")}</td>`).join("")}</tr>
          <tr><td style="border:1px solid #ddd;background:#fff3e0;font-size:8pt;font-weight:bold;text-align:center;padding:3px;font-size:8px;">NON-VEG</td>
            ${DAYS.map(d => `<td style="border:1px solid #ddd;vertical-align:top;padding:3px;">${cellHtml(d.key, ms.key, "nonveg")}</td>`).join("")}</tr>`;
      } else {
        sections += `<tr><td colspan="7" style="background:${ms.color};color:#fff;font-weight:bold;text-align:center;padding:5px;font-size:10pt;">${ms.label}</td></tr>
          <tr><td style="border:1px solid #ddd;background:#f5f5f5;font-size:8px;text-align:center;padding:3px;">ITEMS</td>
            ${DAYS.map(d => `<td style="border:1px solid #ddd;vertical-align:top;padding:3px;">${cellHtml(d.key, ms.key, "all")}</td>`).join("")}</tr>`;
      }
    });
    const html = `<!DOCTYPE html><html><head><title>Weekly Menu — ${client}</title>
    <style>@page{size:A4 landscape;margin:6mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0}table{border-collapse:collapse;width:100%}</style></head>
    <body>
    <div style="text-align:center;margin-bottom:6px;padding-bottom:5px;border-bottom:2px solid #333;">
      <div style="font-size:14pt;font-weight:bold;">HINDUSTAN UNILEVER LIMITED</div>
      <div style="font-size:9pt;color:#555;letter-spacing:2px;">KIDDERPORE FACTORY</div>
      <div style="display:inline-block;background:#e8515a;color:#fff;font-size:13pt;font-weight:bold;padding:2px 28px;margin-top:3px;letter-spacing:3px;">MENU</div>
    </div>
    <table>
      <thead><tr><th style="border:1px solid #ddd;background:#1e293b;color:#fff;padding:4px;font-size:8pt;width:55px;">MEAL</th>
        ${DAYS.map(d => `<th style="border:1px solid #ddd;background:#1e293b;color:#fff;padding:4px;font-size:8pt;text-align:center;">${d.label}</th>`).join("")}
      </tr></thead>
      <tbody>${sections}</tbody>
    </table>
    <div style="margin-top:6px;display:flex;justify-content:space-between;font-size:7.5pt;color:#555;border-top:1px solid #ccc;padding-top:3px;">
      <span><b>TIMINGS:</b> Breakfast 7:30–8:30am &nbsp;|&nbsp; Lunch 11:30am–1:30pm &nbsp;|&nbsp; Evening 4:30–6:30pm</span>
      <span><b>SUBSIDISED PRICES:</b> Breakfast ₹5 &nbsp;|&nbsp; Lunch ₹20 &nbsp;|&nbsp; Evening ₹10 &nbsp;|&nbsp; Night ₹10</span>
      <span>Printed: ${today}</span>
    </div>
    <script>window.onload=()=>window.print();</script></body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  };

  // ── Cell renderer ─────────────────────────────────────────────────────────
  const renderCell = (day: string, meal: string, cat: string) => {
    const its = getCellItems(day, meal, cat);
    return (
      <div
        className="min-h-[52px] p-1 cursor-pointer hover:bg-orange-50/60 transition-colors group relative"
        onClick={() => { setEditCell({ day, meal, cat }); setAddForm({ dishName: "", quantity: "" }); setEditId(null); }}
      >
        {its.length === 0 && <div className="text-[9px] text-slate-300 text-center pt-2.5 group-hover:text-orange-400">+ add</div>}
        {its.map(item => (
          <div key={item.id} className="text-[9px] leading-tight mb-0.5 flex gap-0.5">
            <span className="font-semibold text-slate-700">{item.dish_name}</span>
            {item.quantity && <span className="text-slate-400">{item.quantity}</span>}
          </div>
        ))}
      </div>
    );
  };

  const dialogItems = editCell ? getCellItems(editCell.day, editCell.meal, editCell.cat) : [];
  const dialogMeal = MEAL_SECTIONS.find(m => m.key === editCell?.meal);
  const dialogDay = DAYS.find(d => d.key === editCell?.day);

  return (
    <Layout>
      <div className="max-w-full p-2 sm:p-4 space-y-3">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-orange-500" />
            <div>
              <h1 className="text-lg sm:text-xl font-bold">Weekly Menu BOM</h1>
              <p className="text-xs text-muted-foreground">HUL Kidderpore Factory — Mon to Sat</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <Select value={client} onValueChange={setClient}>
              <SelectTrigger className="w-52 h-9 font-semibold" data-testid="select-weekly-client">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLIENTS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button
              variant="outline" size="sm"
              onClick={loadTemplate}
              disabled={loadingTemplate}
              data-testid="button-load-template"
            >
              {loadingTemplate ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
              Load HUL Template
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} data-testid="button-weekly-print">
              <Printer className="w-4 h-4 mr-1.5" /> Print Menu
            </Button>
          </div>
        </div>

        <Tabs defaultValue="menu">
          <TabsList>
            <TabsTrigger value="menu" className="gap-1.5"><CalendarDays className="w-3.5 h-3.5" /> Menu Grid</TabsTrigger>
            <TabsTrigger value="bom"  className="gap-1.5"><ClipboardList className="w-3.5 h-3.5" /> BOM Calculator</TabsTrigger>
          </TabsList>

          {/* ── MENU GRID TAB ──────────────────────────────────────────── */}
          <TabsContent value="menu" className="mt-3">
            {isLoading ? (
              <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-xl border shadow-sm">
                  <table className="w-full border-collapse" style={{ minWidth: 680 }}>
                    <thead>
                      <tr>
                        <th className="border border-slate-200 bg-slate-800 text-white px-2 py-2 text-[10px] font-bold w-16">MEAL</th>
                        {DAYS.map(d => (
                          <th key={d.key} className="border border-slate-200 bg-slate-800 text-white px-1 py-2 text-[10px] font-bold text-center">
                            {d.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {MEAL_SECTIONS.map(ms => (
                        <>
                          <tr key={`hdr-${ms.key}`}>
                            <td colSpan={7} className="py-1 px-2 text-white text-[10px] font-bold tracking-widest text-center"
                              style={{ background: ms.color }}>
                              {ms.label}
                            </td>
                          </tr>
                          {ms.hasVegNonVeg ? (
                            <>
                              <tr key={`${ms.key}-veg`}>
                                <td className="border border-slate-200 bg-green-50 px-1 py-1 text-center align-middle">
                                  <span className="text-[8px] font-bold text-green-700 bg-green-100 px-1 py-0.5 rounded block">VEG</span>
                                </td>
                                {DAYS.map(d => (
                                  <td key={d.key} className="border border-slate-200 align-top p-0 bg-green-50/20">
                                    {renderCell(d.key, ms.key, "veg")}
                                  </td>
                                ))}
                              </tr>
                              <tr key={`${ms.key}-nonveg`}>
                                <td className="border border-slate-200 bg-red-50 px-1 py-1 text-center align-middle">
                                  <span className="text-[8px] font-bold text-red-700 bg-red-100 px-1 py-0.5 rounded block">N-VEG</span>
                                </td>
                                {DAYS.map(d => (
                                  <td key={d.key} className="border border-slate-200 align-top p-0 bg-red-50/20">
                                    {renderCell(d.key, ms.key, "nonveg")}
                                  </td>
                                ))}
                              </tr>
                            </>
                          ) : (
                            <tr key={`${ms.key}-all`}>
                              <td className="border border-slate-200 bg-slate-50 px-1 py-1 text-center align-middle">
                                <span className="text-[8px] font-bold text-slate-500">ITEMS</span>
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

                {/* Footer */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground border rounded-lg px-3 py-2 bg-muted/20 mt-2">
                  <span className="font-semibold text-slate-600">Timings:</span>
                  <span>Breakfast 7:30–8:30 am</span><span>|</span>
                  <span>Lunch 11:30 am–1:30 pm</span><span>|</span>
                  <span>Evening 4:30–6:30 pm</span>
                  <span className="ml-4 font-semibold text-slate-600">Prices:</span>
                  <span>Breakfast ₹5</span><span>Lunch ₹20</span><span>Evening ₹10</span><span>Night ₹10</span>
                </div>
              </>
            )}
          </TabsContent>

          {/* ── BOM CALCULATOR TAB ─────────────────────────────────────── */}
          <TabsContent value="bom" className="mt-3 space-y-4">
            {/* Headcount inputs */}
            <div>
              <h2 className="text-sm font-bold text-slate-700 mb-2">Step 1 — Enter Headcount per Meal / Day</h2>
              <div className="overflow-x-auto rounded-lg border">
                <table className="border-collapse text-xs" style={{ minWidth: 560 }}>
                  <thead>
                    <tr>
                      <th className="border border-slate-200 bg-slate-800 text-white px-3 py-2 text-left">Meal / Category</th>
                      {DAYS.map(d => (
                        <th key={d.key} className="border border-slate-200 bg-slate-800 text-white px-2 py-2 text-center w-20">{d.short}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {MEAL_SECTIONS.map(ms => (
                      ms.hasVegNonVeg ? (
                        <>
                          <tr key={`hc-${ms.key}-veg`}>
                            <td className="border border-slate-200 px-3 py-1.5 bg-green-50 font-semibold text-green-800">
                              {ms.label} — VEG
                            </td>
                            {DAYS.map(d => (
                              <td key={d.key} className="border border-slate-200 p-1 bg-green-50/20">
                                <Input
                                  type="number" min="0"
                                  className="h-7 text-xs text-center w-full"
                                  placeholder="0"
                                  value={headcount[hcKey(d.key, ms.key, "veg")] || ""}
                                  onChange={e => setHeadcount(prev => ({ ...prev, [hcKey(d.key, ms.key, "veg")]: parseInt(e.target.value) || 0 }))}
                                  data-testid={`hc-${d.key}-${ms.key}-veg`}
                                />
                              </td>
                            ))}
                          </tr>
                          <tr key={`hc-${ms.key}-nonveg`}>
                            <td className="border border-slate-200 px-3 py-1.5 bg-red-50 font-semibold text-red-800">
                              {ms.label} — NON-VEG
                            </td>
                            {DAYS.map(d => (
                              <td key={d.key} className="border border-slate-200 p-1 bg-red-50/20">
                                <Input
                                  type="number" min="0"
                                  className="h-7 text-xs text-center w-full"
                                  placeholder="0"
                                  value={headcount[hcKey(d.key, ms.key, "nonveg")] || ""}
                                  onChange={e => setHeadcount(prev => ({ ...prev, [hcKey(d.key, ms.key, "nonveg")]: parseInt(e.target.value) || 0 }))}
                                  data-testid={`hc-${d.key}-${ms.key}-nonveg`}
                                />
                              </td>
                            ))}
                          </tr>
                        </>
                      ) : (
                        <tr key={`hc-${ms.key}-all`}>
                          <td className="border border-slate-200 px-3 py-1.5 bg-slate-50 font-semibold text-slate-700">
                            {ms.label}
                          </td>
                          {DAYS.map(d => (
                            <td key={d.key} className="border border-slate-200 p-1">
                              <Input
                                type="number" min="0"
                                className="h-7 text-xs text-center w-full"
                                placeholder="0"
                                value={headcount[hcKey(d.key, ms.key, "all")] || ""}
                                onChange={e => setHeadcount(prev => ({ ...prev, [hcKey(d.key, ms.key, "all")]: parseInt(e.target.value) || 0 }))}
                                data-testid={`hc-${d.key}-${ms.key}-all`}
                              />
                            </td>
                          ))}
                        </tr>
                      )
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* BOM Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-bold text-slate-700">Step 2 — Raw Material Requirements (BOM)</h2>
                <Button size="sm" variant="outline" onClick={() => {
                  const rows = [["Ingredient","Unit","Mon","Tue","Wed","Thu","Fri","Sat","Total (pax)","Rate (₹/unit)","Cost (₹)"]];
                  bomRows.forEach(r => rows.push([
                    r.dishName, r.displayUnit,
                    ...DAYS.map(d => r.displayByDay[d.key] ? r.displayByDay[d.key].toFixed(3) : "0"),
                    r.displayTotal.toFixed(3),
                    String(r.rate),
                    String(r.cost.toFixed(2)),
                  ]));
                  const totalCost = bomRows.reduce((s, r) => s + r.cost, 0);
                  rows.push(["","","","","","","","","GRAND TOTAL","", totalCost.toFixed(2)]);
                  const csv = rows.map(r => r.join(",")).join("\n");
                  const blob = new Blob([csv], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a"); a.href = url; a.download = "weekly_bom.csv"; a.click();
                  URL.revokeObjectURL(url);
                }}>
                  Export CSV
                </Button>
              </div>
              {items.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-8 border rounded-lg bg-muted/10">
                  No menu items found — add items in the Menu Grid tab or load the HUL Template
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="border-collapse w-full text-xs" style={{ minWidth: 780 }}>
                    <thead>
                      <tr className="bg-slate-800 text-white">
                        <th className="border border-slate-600 px-3 py-2 text-left">Ingredient</th>
                        <th className="border border-slate-600 px-2 py-2 text-center">Unit</th>
                        {DAYS.map(d => <th key={d.key} className="border border-slate-600 px-2 py-2 text-center">{d.short}</th>)}
                        <th className="border border-slate-600 px-3 py-2 text-center bg-orange-600">Total (pax)</th>
                        <th className="border border-slate-600 px-3 py-2 text-center bg-blue-700">Rate (₹/unit)</th>
                        <th className="border border-slate-600 px-3 py-2 text-center bg-green-700">Cost (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bomRows.map((row, i) => (
                        <tr key={row.dishName + row.unit} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                          <td className="border border-slate-200 px-3 py-1 font-semibold">{row.dishName}</td>
                          <td className="border border-slate-200 px-2 py-1 text-center text-slate-500 font-medium">{row.displayUnit}</td>
                          {DAYS.map(d => (
                            <td key={d.key} className="border border-slate-200 px-2 py-1 text-center">
                              {row.displayByDay[d.key]
                                ? <span>{row.displayByDay[d.key].toFixed(3)}</span>
                                : <span className="text-slate-300">—</span>}
                            </td>
                          ))}
                          <td className="border border-slate-200 px-3 py-1 text-center font-bold text-orange-700 bg-orange-50">
                            {row.displayTotal > 0
                              ? <span>{row.displayTotal.toFixed(3)} <span className="text-xs font-normal text-orange-500">{row.displayUnit}</span></span>
                              : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="border border-slate-200 p-1 bg-blue-50">
                            <Input
                              type="number" min="0" step="0.01"
                              className="h-7 text-xs text-center w-full font-semibold text-blue-900 border border-blue-300 bg-white rounded focus-visible:ring-1 focus-visible:ring-blue-500"
                              placeholder={`₹ per ${row.displayUnit}`}
                              value={row.rate || ""}
                              onChange={e => setRate(row.rateKey, row.dishName, row.unit, parseFloat(e.target.value) || 0)}
                              data-testid={`rate-${row.rateKey}`}
                            />
                          </td>
                          <td className="border border-slate-200 px-3 py-1 bg-green-50">
                            {row.cost > 0 ? (
                              <div className="text-center">
                                <div className="font-bold text-green-700">₹{row.cost.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                <div className="text-[9px] text-slate-400">{row.displayTotal.toFixed(3)} × ₹{row.rate}</div>
                              </div>
                            ) : <span className="text-slate-300 block text-center">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {bomRows.some(r => r.cost > 0) && (
                      <tfoot>
                        <tr className="bg-green-800 text-white font-bold">
                          <td colSpan={8} className="border border-green-700 px-3 py-2 text-right text-xs tracking-wide">GRAND TOTAL COST</td>
                          <td colSpan={2} className="border border-green-700 px-3 py-2 text-center text-sm">
                            ₹{bomRows.reduce((s, r) => s + r.cost, 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Edit Cell Dialog ─────────────────────────────────────────────── */}
      <Dialog open={!!editCell} onOpenChange={open => { if (!open) { setEditCell(null); setEditId(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <span className="px-2 py-0.5 rounded text-white text-xs font-bold" style={{ background: dialogMeal?.color ?? "#666" }}>
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

          <div className="space-y-1 max-h-52 overflow-y-auto">
            {dialogItems.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No items — add below</p>}
            {dialogItems.map(item => (
              <div key={item.id} className="flex items-center gap-2 border rounded px-2 py-1.5 bg-slate-50">
                {editId === item.id ? (
                  <>
                    <Input value={editForm.dishName} onChange={e => setEditForm(f => ({ ...f, dishName: e.target.value }))}
                      className="h-7 text-xs flex-1" placeholder="Dish name" data-testid={`edit-dish-${item.id}`} />
                    <Input value={editForm.quantity} onChange={e => setEditForm(f => ({ ...f, quantity: e.target.value }))}
                      className="h-7 text-xs w-20" placeholder="Qty" data-testid={`edit-qty-${item.id}`} />
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" disabled={updateMut.isPending}
                      onClick={() => updateMut.mutate({ id: item.id, data: { dishName: editForm.dishName, quantity: editForm.quantity, category: item.category, sortOrder: item.sort_order } })}
                      data-testid={`save-item-${item.id}`}>
                      {updateMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditId(null)}>
                      <X className="w-3 h-3" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-xs font-semibold">{item.dish_name}</span>
                    {item.quantity && <span className="text-xs text-slate-400">{item.quantity}</span>}
                    <button className="text-[10px] text-blue-500 hover:underline px-1"
                      onClick={() => { setEditId(item.id); setEditForm({ dishName: item.dish_name, quantity: item.quantity }); }}
                      data-testid={`edit-btn-${item.id}`}>Edit</button>
                    <button className="text-red-400 hover:text-red-600" onClick={() => deleteMut.mutate(item.id)}
                      data-testid={`delete-btn-${item.id}`}>
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="border-t pt-3 space-y-2">
            <p className="text-xs font-semibold text-slate-500">Add new item</p>
            <div className="flex gap-2">
              <Input placeholder="Dish name (e.g. Rice, Dal, Fish)" value={addForm.dishName}
                onChange={e => setAddForm(f => ({ ...f, dishName: e.target.value }))}
                className="h-8 text-sm flex-1" data-testid="input-new-dish"
                onKeyDown={e => { if (e.key === "Enter" && addForm.dishName.trim()) createMut.mutate({ clientName: client, weekDay: editCell!.day, mealType: editCell!.meal, category: editCell!.cat, dishName: addForm.dishName.trim(), quantity: addForm.quantity.trim(), sortOrder: dialogItems.length }); }} />
              <Input placeholder="Qty" value={addForm.quantity}
                onChange={e => setAddForm(f => ({ ...f, quantity: e.target.value }))}
                className="h-8 text-sm w-24" data-testid="input-new-qty" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => { if (!editCell || !addForm.dishName.trim()) return; createMut.mutate({ clientName: client, weekDay: editCell.day, mealType: editCell.meal, category: editCell.cat, dishName: addForm.dishName.trim(), quantity: addForm.quantity.trim(), sortOrder: dialogItems.length }); }}
                disabled={createMut.isPending || !addForm.dishName.trim()} className="bg-orange-500 hover:bg-orange-600 text-white" data-testid="button-add-menu-item">
                {createMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Plus className="w-3.5 h-3.5 mr-1" />}Add
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setEditCell(null); setEditId(null); }}>
                <X className="w-3.5 h-3.5 mr-1" />Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
