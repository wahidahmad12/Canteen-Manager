import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { format } from "date-fns";
import { Label } from "@/components/ui/label";
import { Save, Loader2, ArrowLeft, CalendarDays, Sun, ChefHat, Cookie, Package, PackageOpen, PackageMinus, ClipboardList } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCreateInventory, useUpdateInventory, useInventory } from "@/hooks/use-reports";
import { useLocation, useSearch } from "wouter";

const DEFAULT_KITCHEN_STOCK = [
  { name: "Banana", unit: "Pcs" },
  { name: "Dahi Khatta", unit: "Pcs" },
  { name: "Dahi Mithai", unit: "Pcs" },
  { name: "Dahi 84g", unit: "Pcs" },
  { name: "Dahi 1Kg", unit: "Kg" },
  { name: "Rosgulla", unit: "Pcs" },
  { name: "Chicken", unit: "Plate" },
  { name: "Fish", unit: "Plate" },
  { name: "Lunch Egg", unit: "Pcs" },
  { name: "Eve Egg", unit: "Pcs" },
  { name: "Night Egg", unit: "Pcs" },
];

const DEFAULT_BISCUITS = [
  { name: "Biscuit KPF" },
  { name: "Bisc/Chira" },
];

export default function DailyInventory() {
  const [date, setDate] = useState<Date>(new Date());
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const createMutation = useCreateInventory();
  const updateMutation = useUpdateInventory();

  // Edit mode: /inventory?edit=<id> (reactive to URL changes)
  const search = useSearch();
  const editId = (() => {
    const m = new URLSearchParams(search).get("edit");
    return m && /^\d+$/.test(m) ? Number(m) : null;
  })();
  const { data: editData, isLoading: editLoading } = useInventory(editId);
  const [loadedEditId, setLoadedEditId] = useState<number | null>(null);

  const [kitchenStock, setKitchenStock] = useState(
    DEFAULT_KITCHEN_STOCK.map(item => ({
      ...item,
      open: 0,
      used: 0,
      balance: 0,
      remarks: "",
    }))
  );

  const [biscuits, setBiscuits] = useState(
    DEFAULT_BISCUITS.map(item => ({
      ...item,
      expDate: "",
      brand: "",
      given: 0,
      used: 0,
      balance: 0,
    }))
  );

  const updateKitchenStock = (index: number, field: string, value: any) => {
    setKitchenStock(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      if (field === "open" || field === "used") {
        const open = field === "open" ? Number(value) : Number(updated[index].open);
        const used = field === "used" ? Number(value) : Number(updated[index].used);
        updated[index].balance = open - used;
      }
      return updated;
    });
  };

  const updateBiscuit = (index: number, field: string, value: any) => {
    setBiscuits(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      if (field === "given" || field === "used") {
        const given = field === "given" ? Number(value) : Number(updated[index].given);
        const used = field === "used" ? Number(value) : Number(updated[index].used);
        updated[index].balance = given - used;
      }
      return updated;
    });
  };

  // Reset form whenever the edit target changes (edit A -> edit B, or edit -> new)
  useEffect(() => {
    if (loadedEditId !== null && loadedEditId !== editId) {
      setLoadedEditId(null);
      setDate(new Date());
      setKitchenStock(DEFAULT_KITCHEN_STOCK.map(item => ({ ...item, open: 0, used: 0, balance: 0, remarks: "" })));
      setBiscuits(DEFAULT_BISCUITS.map(item => ({ ...item, expDate: "", brand: "", given: 0, used: 0, balance: 0 })));
    }
  }, [editId, loadedEditId]);

  // Populate form when editing an existing record (re-hydrates when fresh data arrives)
  useEffect(() => {
    if (!editId || !editData || editData.id !== editId) return;
    setDate(new Date(editData.date));
    if (editData.kitchenStock?.length) {
      setKitchenStock(editData.kitchenStock.map((i: any) => ({
        name: i.name, unit: i.unit,
        open: Number(i.open) || 0, used: Number(i.used) || 0,
        balance: Number(i.balance) || (Number(i.open) || 0) - (Number(i.used) || 0),
        remarks: i.remarks || "",
      })));
    }
    if (editData.biscuits?.length) {
      setBiscuits(editData.biscuits.map((i: any) => ({
        name: i.name, expDate: i.expDate || "", brand: i.brand || "",
        given: Number(i.given) || 0, used: Number(i.used) || 0,
        balance: Number(i.balance) || (Number(i.given) || 0) - (Number(i.used) || 0),
      })));
    }
    setLoadedEditId(editId);
  }, [editId, editData]);

  const handleSave = async () => {
    try {
      const payload = {
        date: format(date, "yyyy-MM-dd"),
        kitchenStock: kitchenStock.map(item => ({
          name: item.name,
          unit: item.unit,
          open: Number(item.open),
          used: Number(item.used),
          balance: Number(item.balance),
          remarks: item.remarks,
        })),
        biscuits: biscuits.map(item => ({
          name: item.name,
          expDate: item.expDate,
          brand: item.brand,
          given: Number(item.given),
          used: Number(item.used),
          balance: Number(item.balance),
        })),
      };
      if (editId) {
        await updateMutation.mutateAsync({ id: editId, ...payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      toast({ title: "Success", description: editId ? "Daily Inventory updated successfully" : "Daily Inventory saved successfully" });
      navigate("/");
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to save inventory", variant: "destructive" });
    }
  };

  const totalKitchenOpen = kitchenStock.reduce((sum, i) => sum + Number(i.open), 0);
  const totalKitchenUsed = kitchenStock.reduce((sum, i) => sum + Number(i.used), 0);
  const totalKitchenBalance = kitchenStock.reduce((sum, i) => sum + Number(i.balance), 0);
  const totalBiscuitGiven = biscuits.reduce((sum, i) => sum + Number(i.given), 0);
  const totalBiscuitUsed = biscuits.reduce((sum, i) => sum + Number(i.used), 0);
  const totalBiscuitBalance = biscuits.reduce((sum, i) => sum + Number(i.balance), 0);

  return (
    <Layout>
      <div className="space-y-6 pb-32 sm:pb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-4">
            <Button variant="outline" size="icon" onClick={() => navigate("/")} type="button" className="shrink-0 rounded-xl border-orange-200 hover:bg-orange-50 dark:border-orange-800 dark:hover:bg-orange-900/30" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold tracking-tight bg-gradient-to-r from-orange-600 via-amber-600 to-yellow-500 bg-clip-text text-transparent" data-testid="text-inventory-title">
                Daily Inventory{editId ? " (Edit)" : ""}
              </h1>
              <p className="text-muted-foreground text-xs sm:text-sm">Kitchen stock & biscuit tracking</p>
            </div>
          </div>
          <div className="flex gap-2 sm:gap-3 ml-12 sm:ml-0">
            <Button variant="outline" type="button" onClick={() => navigate("/")} className="text-xs sm:text-sm h-9 sm:h-10 rounded-xl">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending || (!!editId && editLoading)}
              className="shadow-lg shadow-orange-500/20 text-xs sm:text-sm h-9 sm:h-10 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 border-0"
              data-testid="button-save-inventory"
            >
              {createMutation.isPending || updateMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {editId ? "Update Inventory" : "Save Inventory"}
            </Button>
          </div>
        </div>

        <Card className="border-0 shadow-lg overflow-hidden" data-testid="card-date-info">
          <CardHeader className="bg-gradient-to-r from-slate-600 to-slate-700 text-white pb-3 pt-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="w-5 h-5" />
              Date Information
            </CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-4 p-4 sm:p-6 bg-gradient-to-b from-slate-50/50 to-transparent dark:from-slate-900/20">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5" /> Date
              </label>
              <DatePicker date={date} setDate={(d) => d && setDate(d)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-orange-600 dark:text-orange-400 flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5" /> Day
              </label>
              <Input value={format(date, "EEEE")} readOnly className="bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 font-semibold" data-testid="input-day" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg overflow-hidden" data-testid="card-kitchen-stock">
          <CardHeader className="bg-gradient-to-r from-indigo-500 to-violet-500 text-white pb-3 pt-4">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <ChefHat className="w-5 h-5" />
              Kitchen Stock
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-indigo-50 dark:bg-indigo-950/20 border-b border-indigo-200 dark:border-indigo-800">
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-indigo-700 dark:text-indigo-400">#</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-indigo-700 dark:text-indigo-400">Name</th>
                    <th className="px-3 py-2.5 text-center w-16 text-xs font-semibold text-indigo-700 dark:text-indigo-400">Unit</th>
                    <th className="px-3 py-2.5 text-center w-24 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20">Open</th>
                    <th className="px-3 py-2.5 text-center w-24 text-xs font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20">Used</th>
                    <th className="px-3 py-2.5 text-center w-24 text-xs font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20">Balance</th>
                    <th className="px-3 py-2.5 text-center w-32 text-xs font-semibold text-indigo-700 dark:text-indigo-400">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {kitchenStock.map((item, idx) => (
                    <tr key={idx} className="border-b hover:bg-indigo-50/50 dark:hover:bg-indigo-950/10">
                      <td className="px-3 py-2">
                        <span className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 text-white text-[10px] inline-flex items-center justify-center font-bold">{idx + 1}</span>
                      </td>
                      <td className="px-3 py-2 font-semibold">{item.name}</td>
                      <td className="px-3 py-2 text-center">
                        <span className="text-xs text-indigo-600 dark:text-indigo-400 font-mono bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-full font-semibold">{item.unit}</span>
                      </td>
                      <td className="px-1 py-1 bg-emerald-50/50 dark:bg-emerald-950/10">
                        <Input
                          type="number"
                          className="h-8 text-center bg-transparent border-0 focus-visible:ring-1 focus-visible:ring-emerald-400 font-mono no-spinner"
                          value={item.open || ""}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => updateKitchenStock(idx, "open", Number(e.target.value))}
                          data-testid={`input-kitchen-open-${idx}`}
                        />
                      </td>
                      <td className="px-1 py-1 bg-rose-50/50 dark:bg-rose-950/10">
                        <Input
                          type="number"
                          className="h-8 text-center bg-transparent border-0 focus-visible:ring-1 focus-visible:ring-rose-400 font-mono no-spinner"
                          value={item.used || ""}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => updateKitchenStock(idx, "used", Number(e.target.value))}
                          data-testid={`input-kitchen-used-${idx}`}
                        />
                      </td>
                      <td className="px-1 py-1 bg-blue-50/50 dark:bg-blue-950/10">
                        <div className={`h-8 flex items-center justify-center font-mono font-semibold text-sm ${item.balance < 0 ? 'text-red-600' : 'text-blue-600 dark:text-blue-400'}`} data-testid={`input-kitchen-balance-${idx}`}>
                          {item.balance || 0}
                        </div>
                      </td>
                      <td className="px-1 py-1">
                        <Input
                          className="h-8 text-center border-0 focus-visible:ring-1 text-xs"
                          value={item.remarks}
                          onChange={(e) => updateKitchenStock(idx, "remarks", e.target.value)}
                          placeholder="..."
                          data-testid={`input-kitchen-remarks-${idx}`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="sm:hidden divide-y">
              {kitchenStock.map((item, idx) => (
                <div key={idx} className="p-3 space-y-2" data-testid={`mobile-kitchen-item-${idx}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm flex items-center gap-1.5">
                      <span className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 text-white text-[10px] flex items-center justify-center font-bold shrink-0">{idx + 1}</span>
                      {item.name}
                    </span>
                    <span className="text-xs text-indigo-600 dark:text-indigo-400 font-mono bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-full font-semibold">{item.unit}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-emerald-600 uppercase font-semibold">Open</label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        className="h-9 text-center bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 font-mono no-spinner"
                        value={item.open || ""}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => updateKitchenStock(idx, "open", Number(e.target.value))}
                        data-testid={`input-mobile-kitchen-open-${idx}`}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-rose-600 uppercase font-semibold">Used</label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        className="h-9 text-center bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800 font-mono no-spinner"
                        value={item.used || ""}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => updateKitchenStock(idx, "used", Number(e.target.value))}
                        data-testid={`input-mobile-kitchen-used-${idx}`}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-blue-600 uppercase font-semibold">Balance</label>
                      <div className={`h-9 flex items-center justify-center font-mono font-bold text-sm rounded-md ${item.balance < 0 ? 'bg-red-50 dark:bg-red-900/20 text-red-600' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'}`} data-testid={`input-mobile-kitchen-balance-${idx}`}>
                        {item.balance || 0}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase font-semibold">Remarks</label>
                    <Input
                      className="h-8 text-sm"
                      value={item.remarks}
                      onChange={(e) => updateKitchenStock(idx, "remarks", e.target.value)}
                      placeholder="Add remarks..."
                      data-testid={`input-mobile-kitchen-remarks-${idx}`}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 sm:p-4 bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/20 dark:to-violet-950/20 border-t border-indigo-200 dark:border-indigo-800/30">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold flex items-center gap-2 text-indigo-700 dark:text-indigo-400">
                  <ChefHat className="w-4 h-4" />
                  Kitchen Total
                </div>
                <div className="flex gap-4 text-xs font-semibold">
                  <span className="flex items-center gap-1 text-emerald-600"><PackageOpen className="w-3 h-3" /> Open: <span className="font-mono text-sm">{totalKitchenOpen}</span></span>
                  <span className="flex items-center gap-1 text-rose-600"><PackageMinus className="w-3 h-3" /> Used: <span className="font-mono text-sm">{totalKitchenUsed}</span></span>
                  <span className="flex items-center gap-1 text-blue-600"><Package className="w-3 h-3" /> Bal: <span className="font-mono text-sm">{totalKitchenBalance}</span></span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg overflow-hidden" data-testid="card-biscuits">
          <CardHeader className="bg-gradient-to-r from-amber-500 to-orange-500 text-white pb-3 pt-4">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Cookie className="w-5 h-5" />
              Biscuits
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-800">
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-amber-700 dark:text-amber-400">#</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-amber-700 dark:text-amber-400">Name</th>
                    <th className="px-3 py-2.5 text-center w-28 text-xs font-semibold text-amber-700 dark:text-amber-400">Exp. Date</th>
                    <th className="px-3 py-2.5 text-center w-28 text-xs font-semibold text-amber-700 dark:text-amber-400">Brand</th>
                    <th className="px-3 py-2.5 text-center w-24 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20">Given</th>
                    <th className="px-3 py-2.5 text-center w-24 text-xs font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20">Used</th>
                    <th className="px-3 py-2.5 text-center w-24 text-xs font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {biscuits.map((item, idx) => (
                    <tr key={idx} className="border-b hover:bg-amber-50/50 dark:hover:bg-amber-950/10">
                      <td className="px-3 py-2">
                        <span className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white text-[10px] inline-flex items-center justify-center font-bold">{idx + 1}</span>
                      </td>
                      <td className="px-3 py-2 font-semibold">{item.name}</td>
                      <td className="px-1 py-1">
                        <DatePicker
                          date={item.expDate ? new Date(item.expDate) : undefined}
                          setDate={(d) => updateBiscuit(idx, "expDate", d ? format(d, "yyyy-MM-dd") : "")}
                          className="h-8 text-xs border-0 focus-visible:ring-1"
                          dateFormat="dd/MM/yy"
                          placeholder="Exp Date"
                          data-testid={`input-biscuit-expdate-${idx}`}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <Input
                          className="h-8 text-center border-0 focus-visible:ring-1 text-xs"
                          value={item.brand}
                          onChange={(e) => updateBiscuit(idx, "brand", e.target.value)}
                          placeholder="Brand..."
                          data-testid={`input-biscuit-brand-${idx}`}
                        />
                      </td>
                      <td className="px-1 py-1 bg-emerald-50/50 dark:bg-emerald-950/10">
                        <Input
                          type="number"
                          className="h-8 text-center bg-transparent border-0 focus-visible:ring-1 focus-visible:ring-emerald-400 font-mono no-spinner"
                          value={item.given || ""}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => updateBiscuit(idx, "given", Number(e.target.value))}
                          data-testid={`input-biscuit-given-${idx}`}
                        />
                      </td>
                      <td className="px-1 py-1 bg-rose-50/50 dark:bg-rose-950/10">
                        <Input
                          type="number"
                          className="h-8 text-center bg-transparent border-0 focus-visible:ring-1 focus-visible:ring-rose-400 font-mono no-spinner"
                          value={item.used || ""}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => updateBiscuit(idx, "used", Number(e.target.value))}
                          data-testid={`input-biscuit-used-${idx}`}
                        />
                      </td>
                      <td className="px-1 py-1 bg-blue-50/50 dark:bg-blue-950/10">
                        <div className={`h-8 flex items-center justify-center font-mono font-semibold text-sm ${item.balance < 0 ? 'text-red-600' : 'text-blue-600 dark:text-blue-400'}`} data-testid={`input-biscuit-balance-${idx}`}>
                          {item.balance || 0}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="sm:hidden divide-y">
              {biscuits.map((item, idx) => (
                <div key={idx} className="p-3 space-y-2" data-testid={`mobile-biscuit-item-${idx}`}>
                  <div className="flex items-center gap-1.5">
                    <span className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white text-[10px] flex items-center justify-center font-bold shrink-0">{idx + 1}</span>
                    <span className="font-semibold text-sm">{item.name}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-amber-600 uppercase font-semibold">Exp. Date</label>
                      <DatePicker
                        date={item.expDate ? new Date(item.expDate) : undefined}
                        setDate={(d) => updateBiscuit(idx, "expDate", d ? format(d, "yyyy-MM-dd") : "")}
                        className="h-9 text-xs"
                        dateFormat="dd/MM/yy"
                        placeholder="Exp Date"
                        data-testid={`input-mobile-biscuit-expdate-${idx}`}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-amber-600 uppercase font-semibold">Brand</label>
                      <Input
                        className="h-9 text-sm"
                        value={item.brand}
                        onChange={(e) => updateBiscuit(idx, "brand", e.target.value)}
                        placeholder="Brand..."
                        data-testid={`input-mobile-biscuit-brand-${idx}`}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-emerald-600 uppercase font-semibold">Given</label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        className="h-9 text-center bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 font-mono no-spinner"
                        value={item.given || ""}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => updateBiscuit(idx, "given", Number(e.target.value))}
                        data-testid={`input-mobile-biscuit-given-${idx}`}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-rose-600 uppercase font-semibold">Used</label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        className="h-9 text-center bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800 font-mono no-spinner"
                        value={item.used || ""}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => updateBiscuit(idx, "used", Number(e.target.value))}
                        data-testid={`input-mobile-biscuit-used-${idx}`}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-blue-600 uppercase font-semibold">Balance</label>
                      <div className={`h-9 flex items-center justify-center font-mono font-bold text-sm rounded-md ${item.balance < 0 ? 'bg-red-50 dark:bg-red-900/20 text-red-600' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'}`} data-testid={`input-mobile-biscuit-balance-${idx}`}>
                        {item.balance || 0}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 sm:p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-t border-amber-200 dark:border-amber-800/30">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <Cookie className="w-4 h-4" />
                  Biscuit Total
                </div>
                <div className="flex gap-4 text-xs font-semibold">
                  <span className="flex items-center gap-1 text-emerald-600"><PackageOpen className="w-3 h-3" /> Given: <span className="font-mono text-sm">{totalBiscuitGiven}</span></span>
                  <span className="flex items-center gap-1 text-rose-600"><PackageMinus className="w-3 h-3" /> Used: <span className="font-mono text-sm">{totalBiscuitUsed}</span></span>
                  <span className="flex items-center gap-1 text-blue-600"><Package className="w-3 h-3" /> Bal: <span className="font-mono text-sm">{totalBiscuitBalance}</span></span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="fixed bottom-0 left-0 right-0 sm:static bg-background/80 backdrop-blur-md sm:bg-transparent border-t sm:border-0 p-3 sm:p-0 z-10">
          <Card className="border-0 shadow-xl overflow-hidden">
            <CardContent className="p-0">
              <div className="grid grid-cols-3 sm:grid-cols-3">
                <div className="p-3 sm:p-5 bg-gradient-to-br from-emerald-500 to-green-600 text-white">
                  <p className="text-[10px] sm:text-xs uppercase tracking-wider font-semibold text-white/80 flex items-center gap-1">
                    <PackageOpen className="w-3 h-3" /> Opening
                  </p>
                  <p className="text-lg sm:text-2xl font-bold font-mono" data-testid="text-summary-open">{totalKitchenOpen + totalBiscuitGiven}</p>
                  <p className="text-[10px] text-white/60 mt-0.5">Kitchen: {totalKitchenOpen} | Biscuit: {totalBiscuitGiven}</p>
                </div>
                <div className="p-3 sm:p-5 bg-gradient-to-br from-rose-500 to-pink-600 text-white">
                  <p className="text-[10px] sm:text-xs uppercase tracking-wider font-semibold text-white/80 flex items-center gap-1">
                    <PackageMinus className="w-3 h-3" /> Used
                  </p>
                  <p className="text-lg sm:text-2xl font-bold font-mono" data-testid="text-summary-used">{totalKitchenUsed + totalBiscuitUsed}</p>
                  <p className="text-[10px] text-white/60 mt-0.5">Kitchen: {totalKitchenUsed} | Biscuit: {totalBiscuitUsed}</p>
                </div>
                <div className={`p-3 sm:p-5 ${(totalKitchenBalance + totalBiscuitBalance) < 0 ? 'bg-gradient-to-br from-red-600 to-rose-700' : 'bg-gradient-to-br from-blue-500 to-indigo-600'} text-white`}>
                  <p className="text-[10px] sm:text-xs uppercase tracking-wider font-semibold text-white/80 flex items-center gap-1">
                    <Package className="w-3 h-3" /> Balance
                  </p>
                  <p className="text-lg sm:text-2xl font-bold font-mono" data-testid="text-summary-balance">{totalKitchenBalance + totalBiscuitBalance}</p>
                  <p className="text-[10px] text-white/60 mt-0.5">Kitchen: {totalKitchenBalance} | Biscuit: {totalBiscuitBalance}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
