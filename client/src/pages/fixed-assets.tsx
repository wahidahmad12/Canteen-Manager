import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useCurrentUser } from "@/hooks/use-reports";
import { useToast } from "@/hooks/use-toast";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Package, Printer, ArrowRightLeft, Plus, Trash2, QrCode, Settings2, Pencil, TrendingDown, ArrowLeft, IndianRupee, Activity, Boxes } from "lucide-react";
import { Link } from "wouter";
import type { FixedAsset, FixedAssetOption } from "@shared/schema";

const DEFAULT_CATEGORIES = ["Kitchen Equipment", "Refrigeration", "Dining Furniture", "POS & Electronics", "Other"];
const DEFAULT_LOCATIONS = ["Main Kitchen", "Dining Hall A", "Dining Hall B", "Cold Storage Unit", "Counter POS"];
const STATUSES = ["Active", "Under Maintenance", "Retired"] as const;

const fmtINR = (n: number) =>
  "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const emptyForm = {
  assetTag: "",
  name: "",
  purchaseDate: new Date().toISOString().slice(0, 10),
  vendor: "",
  category: DEFAULT_CATEGORIES[0],
  location: DEFAULT_LOCATIONS[0],
  cost: "",
  depreciationPercent: "",
  status: "Active",
};

export default function FixedAssetsPage() {
  const { toast } = useToast();
  const { data: user } = useCurrentUser();
  const isAdmin = user?.role === "admin";

  const { data: assets = [], isLoading } = useQuery<FixedAsset[]>({ queryKey: ["/api/fixed-assets"] });
  const { data: options = [] } = useQuery<FixedAssetOption[]>({ queryKey: ["/api/fixed-asset-options"] });

  const [form, setForm] = useState({ ...emptyForm });
  const [selIds, setSelIds] = useState<Set<number>>(new Set());
  const [transferAsset, setTransferAsset] = useState<FixedAsset | null>(null);
  const [transferLoc, setTransferLoc] = useState("");
  const [printItems, setPrintItems] = useState<FixedAsset[]>([]);
  const [manageType, setManageType] = useState<"category" | "location" | null>(null);
  const [newOptionName, setNewOptionName] = useState("");

  const categoryOptions = useMemo(() => options.filter((o) => o.optionType === "category"), [options]);
  const categories = useMemo(() => {
    const s = new Set<string>(categoryOptions.map((o) => o.name));
    if (categoryOptions.length === 0) DEFAULT_CATEGORIES.forEach((c) => s.add(c));
    assets.forEach((a) => a.category && s.add(a.category));
    return Array.from(s);
  }, [categoryOptions, assets]);

  const locationOptions = useMemo(() => options.filter((o) => o.optionType === "location"), [options]);
  const locations = useMemo(() => {
    const s = new Set<string>(locationOptions.map((o) => o.name));
    if (locationOptions.length === 0) DEFAULT_LOCATIONS.forEach((l) => s.add(l));
    assets.forEach((a) => a.location && s.add(a.location));
    return Array.from(s);
  }, [locationOptions, assets]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/fixed-asset-options"] });
    queryClient.invalidateQueries({ queryKey: ["/api/fixed-assets"] });
  };

  const optionErr = (e: any) => toast({ title: "Could not save", description: String(e.message || e), variant: "destructive" });
  const addOptionMut = useMutation({
    mutationFn: async (body: { optionType: string; name: string }) =>
      (await apiRequest("POST", "/api/fixed-asset-options", body)).json(),
    onSuccess: invalidateAll,
    onError: optionErr,
  });
  const renameOptionMut = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) =>
      (await apiRequest("PUT", `/api/fixed-asset-options/${id}`, { name })).json(),
    onSuccess: invalidateAll,
    onError: optionErr,
  });
  const deleteOptionMut = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/fixed-asset-options/${id}`)).json(),
    onSuccess: invalidateAll,
    onError: optionErr,
  });

  // metrics
  const totalValue = assets.reduce((s, a) => s + (Number(a.cost) || 0), 0);
  const avgDep = assets.length
    ? assets.reduce((s, a) => s + (Number(a.depreciationPercent) || 0), 0) / assets.length
    : 0;
  const activeCount = assets.filter((a) => a.status === "Active").length;

  const createMut = useMutation({
    mutationFn: async (body: any) => (await apiRequest("POST", "/api/fixed-assets", body)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fixed-assets"] });
      setForm({ ...emptyForm, purchaseDate: new Date().toISOString().slice(0, 10) });
      toast({ title: "Asset saved" });
    },
    onError: (e: any) => toast({ title: "Could not save asset", description: String(e.message || e), variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: any }) =>
      (await apiRequest("PUT", `/api/fixed-assets/${id}`, body)).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/fixed-assets"] }),
    onError: (e: any) => toast({ title: "Update failed", description: String(e.message || e), variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/fixed-assets/${id}`)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fixed-assets"] });
      toast({ title: "Asset deleted" });
    },
    onError: (e: any) => toast({ title: "Delete failed", description: String(e.message || e), variant: "destructive" }),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    createMut.mutate({
      ...form,
      cost: Number(form.cost) || 0,
      depreciationPercent: Number(form.depreciationPercent) || 0,
    });
  };

  const addNewLocation = () => {
    const loc = window.prompt("Enter new location name:");
    if (loc && loc.trim()) {
      const t = loc.trim();
      addOptionMut.mutate({ optionType: "location", name: t }, {
        onSuccess: () => {
          setForm((f) => ({ ...f, location: t }));
          if (transferAsset) setTransferLoc(t);
        },
      });
    }
  };

  const toggleSel = (id: number) =>
    setSelIds((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const allSelected = assets.length > 0 && selIds.size === assets.length;

  // print: render tags, then print, then clear
  useEffect(() => {
    if (printItems.length > 0) {
      const t = setTimeout(() => {
        window.print();
        setPrintItems([]);
      }, 300);
      return () => clearTimeout(t);
    }
  }, [printItems]);

  const printSelected = () => {
    const items = assets.filter((a) => selIds.has(a.id));
    if (items.length === 0) {
      toast({ title: "Select at least one asset", description: "Tick the checkboxes first.", variant: "destructive" });
      return;
    }
    setPrintItems(items);
  };

  const statusBadge = (status: string | null) => {
    if (status === "Under Maintenance")
      return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Maintenance</Badge>;
    if (status === "Retired")
      return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Retired</Badge>;
    return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Active</Badge>;
  };

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Hide app, show only tags when printing */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          @page { size: 4in 2in; margin: 0; }
          #fa-print-container, #fa-print-container * { visibility: visible; }
          #fa-print-container { display: block !important; position: absolute; left: 0; top: 0; width: 4in; }
          .fa-tag { width: 4in; height: 2in; padding: 0.08in; background: #fff; color: #000; box-sizing: border-box; page-break-after: always; break-after: page; }
          .fa-tag:last-child { page-break-after: avoid; break-after: avoid; }
        }
      `}</style>

      {/* Header banner */}
      <div className="rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white p-4 md:p-5 shadow-lg no-print">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/">
              <Button size="icon" variant="secondary" className="bg-white/15 hover:bg-white/25 text-white border-0 shrink-0" data-testid="button-back-dashboard" title="Back to Dashboard">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
              <Package className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg md:text-2xl font-bold truncate">Fixed Asset Management</h1>
              <p className="text-xs md:text-sm text-white/80 truncate">Asset registry, QR tags, transfers & depreciation</p>
            </div>
          </div>
          <Link href="/">
            <Button variant="secondary" className="bg-white/15 hover:bg-white/25 text-white border-0 hidden sm:inline-flex" data-testid="button-back-dashboard-text">
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Main Dashboard
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-0 shadow-md overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-blue-500 to-cyan-500" />
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
              <Boxes className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] uppercase text-muted-foreground font-semibold tracking-wide">Total Assets</div>
              <div className="text-xl md:text-2xl font-bold">{assets.length}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
              <IndianRupee className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] uppercase text-muted-foreground font-semibold tracking-wide">Total Value</div>
              <div className="text-lg md:text-xl font-bold truncate">{fmtINR(totalValue)}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
              <TrendingDown className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] uppercase text-muted-foreground font-semibold tracking-wide">Avg Depreciation</div>
              <div className="text-xl md:text-2xl font-bold">{avgDep.toFixed(1)}%</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-violet-500 to-purple-500" />
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] uppercase text-muted-foreground font-semibold tracking-wide">Active Assets</div>
              <div className="text-xl md:text-2xl font-bold">{activeCount}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className={isAdmin ? "grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-4 items-start" : "grid grid-cols-1 gap-4 items-start"}>
        {/* Register form (admin only) */}
        {isAdmin && (
        <Card className="border-0 shadow-lg overflow-hidden">
          <CardHeader className="pb-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white pt-4">
            <CardTitle className="text-base flex items-center gap-2"><Plus className="w-4 h-4" /> Register Fixed Asset</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Asset Tag / ID</Label>
                  <Input value={form.assetTag} onChange={(e) => setForm({ ...form, assetTag: e.target.value })} placeholder="CNT-EQ-01" required />
                </div>
                <div>
                  <Label className="text-xs">Purchase Date</Label>
                  <Input type="date" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} required />
                </div>
              </div>
              <div>
                <Label className="text-xs">Asset Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Commercial Oven" required />
              </div>
              <div>
                <Label className="text-xs">Purchased From (Vendor)</Label>
                <Input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} placeholder="KitchenTech Corp" />
              </div>
              <div>
                <Label className="text-xs">Category</Label>
                <div className="flex gap-2">
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" size="icon" onClick={() => setManageType("category")} title="Manage Categories">
                    <Settings2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div>
                <Label className="text-xs">Current Location</Label>
                <div className="flex gap-2">
                  <Select value={form.location} onValueChange={(v) => setForm({ ...form, location: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {locations.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" size="icon" onClick={() => setManageType("location")} title="Manage Locations">
                    <Settings2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Cost (₹)</Label>
                  <Input type="number" min="0" step="0.01" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} placeholder="3500" required />
                </div>
                <div>
                  <Label className="text-xs">Depreciation (%)</Label>
                  <Input type="number" min="0" max="100" step="0.1" value={form.depreciationPercent} onChange={(e) => setForm({ ...form, depreciationPercent: e.target.value })} placeholder="10" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={createMut.isPending}>
                {createMut.isPending ? "Saving..." : "Save Asset Record"}
              </Button>
            </form>
          </CardContent>
        </Card>
        )}

        {/* Registry table */}
        <Card className="border-0 shadow-lg overflow-hidden">
          <CardHeader className="pb-3 pt-4 bg-gradient-to-r from-violet-500 to-purple-500 text-white flex flex-row items-center justify-between space-y-0 flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2"><Package className="w-4 h-4" /> Fixed Asset Master Registry</CardTitle>
            <div className="flex gap-2 flex-wrap">
              <Link href="/depreciation-report">
                <Button size="sm" variant="secondary" className="bg-white/15 hover:bg-white/25 text-white border-0">
                  <TrendingDown className="w-4 h-4 mr-1" /> Depreciation Report
                </Button>
              </Link>
              <Button size="sm" variant="secondary" className="bg-white/15 hover:bg-white/25 text-white border-0" onClick={printSelected}>
                <QrCode className="w-4 h-4 mr-1" /> Print Selected Tags
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead>
                  <tr className="border-b bg-violet-50 dark:bg-violet-950/20 text-violet-700 dark:text-violet-400">
                    <th className="p-2 text-left w-8">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={(v) => setSelIds(v ? new Set(assets.map((a) => a.id)) : new Set())}
                      />
                    </th>
                    <th className="p-2 text-left">Asset ID</th>
                    <th className="p-2 text-left">Name</th>
                    <th className="p-2 text-left">Purchase Date</th>
                    <th className="p-2 text-left">Purchased From</th>
                    <th className="p-2 text-left">Location</th>
                    <th className="p-2 text-right">Cost</th>
                    <th className="p-2 text-right">Depr %</th>
                    <th className="p-2 text-left">Status</th>
                    <th className="p-2 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && (
                    <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">Loading...</td></tr>
                  )}
                  {!isLoading && assets.length === 0 && (
                    <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">No assets registered yet. Use the form to add your first asset.</td></tr>
                  )}
                  {assets.map((a) => (
                    <tr key={a.id} className="border-b hover:bg-muted/30">
                      <td className="p-2">
                        <Checkbox checked={selIds.has(a.id)} onCheckedChange={() => toggleSel(a.id)} />
                      </td>
                      <td className="p-2 font-medium">{a.assetTag}</td>
                      <td className="p-2">{a.name}</td>
                      <td className="p-2">{a.purchaseDate}</td>
                      <td className="p-2">{a.vendor}</td>
                      <td className="p-2 font-semibold">{a.location}</td>
                      <td className="p-2 text-right">{fmtINR(Number(a.cost) || 0)}</td>
                      <td className="p-2 text-right">{Number(a.depreciationPercent) || 0}%</td>
                      <td className="p-2">
                        {isAdmin ? (
                          <Select value={a.status || "Active"} onValueChange={(v) => updateMut.mutate({ id: a.id, body: { status: v } })}>
                            <SelectTrigger className="h-7 w-[130px] border-0 bg-transparent p-0 focus:ring-0 [&>svg]:hidden">
                              <span>{statusBadge(a.status)}</span>
                            </SelectTrigger>
                            <SelectContent>
                              {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : statusBadge(a.status)}
                      </td>
                      <td className="p-2">
                        <div className="flex gap-1">
                          {isAdmin && (
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs"
                              onClick={() => { setTransferAsset(a); setTransferLoc(a.location || locations[0]); }}>
                              <ArrowRightLeft className="w-3 h-3 mr-1" /> Transfer
                            </Button>
                          )}
                          <Button size="sm" className="h-7 px-2 text-xs bg-green-600 hover:bg-green-700"
                            onClick={() => setPrintItems([a])}>
                            <Printer className="w-3 h-3 mr-1" /> Tag
                          </Button>
                          {isAdmin && (
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-red-600"
                              onClick={() => { if (window.confirm(`Delete asset ${a.assetTag}?`)) deleteMut.mutate(a.id); }}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {selIds.size > 0 && (
              <div className="text-xs text-muted-foreground mt-2">{selIds.size} asset(s) selected for tag printing</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Transfer dialog */}
      <Dialog open={!!transferAsset} onOpenChange={(o) => { if (!o) setTransferAsset(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Transfer Asset Location</DialogTitle></DialogHeader>
          {transferAsset && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {transferAsset.assetTag} — {transferAsset.name} (Current: {transferAsset.location})
              </p>
              <div>
                <Label className="text-xs">Select New Location</Label>
                <div className="flex gap-2">
                  <Select value={transferLoc} onValueChange={setTransferLoc}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {locations.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" size="icon" onClick={addNewLocation}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferAsset(null)}>Cancel</Button>
            <Button
              disabled={updateMut.isPending}
              onClick={() => {
                if (transferAsset) {
                  updateMut.mutate(
                    { id: transferAsset.id, body: { location: transferLoc } },
                    { onSuccess: () => { setTransferAsset(null); toast({ title: "Asset transferred", description: `Moved to ${transferLoc}` }); } },
                  );
                }
              }}
            >
              Confirm Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage categories / locations dialog */}
      <Dialog open={!!manageType} onOpenChange={(o) => { if (!o) { setManageType(null); setNewOptionName(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{manageType === "category" ? "Manage Categories" : "Manage Locations"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {(manageType === "category" ? categoryOptions : locationOptions).map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-2 border rounded-md px-3 py-1.5">
                <span className="text-sm truncate">{o.name}</span>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="outline" className="h-7 px-2"
                    onClick={() => {
                      const n = window.prompt(`Rename "${o.name}" to:`, o.name);
                      if (n && n.trim() && n.trim() !== o.name) renameOptionMut.mutate({ id: o.id, name: n.trim() });
                    }}>
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 px-2 text-red-600"
                    onClick={() => {
                      if (window.confirm(`Delete "${o.name}"? Assets already using it will keep their current value.`))
                        deleteOptionMut.mutate(o.id);
                    }}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
            {(manageType === "category" ? categoryOptions : locationOptions).length === 0 && (
              <p className="text-sm text-muted-foreground">No entries yet. Add one below.</p>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              value={newOptionName}
              onChange={(e) => setNewOptionName(e.target.value)}
              placeholder={manageType === "category" ? "New category name" : "New location name"}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newOptionName.trim() && manageType) {
                  e.preventDefault();
                  addOptionMut.mutate({ optionType: manageType, name: newOptionName.trim() }, { onSuccess: () => setNewOptionName("") });
                }
              }}
            />
            <Button
              disabled={!newOptionName.trim() || addOptionMut.isPending}
              onClick={() => {
                if (manageType) addOptionMut.mutate({ optionType: manageType, name: newOptionName.trim() }, { onSuccess: () => setNewOptionName("") });
              }}>
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden 4in x 2in printable QR tags */}
      <div id="fa-print-container" style={{ display: "none" }}>
        {printItems.map((a) => (
          <div key={a.id} className="fa-tag">
            <div style={{
              border: "2px solid #000", width: "100%", height: "100%", padding: "5px 8px",
              boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "space-between",
              fontFamily: "Arial, Helvetica, sans-serif",
            }}>
              <div style={{ textAlign: "center", borderBottom: "1.5px solid #000", paddingBottom: 3 }}>
                <div style={{ fontSize: "8.5pt", fontWeight: "bold", textTransform: "uppercase", lineHeight: 1.1 }}>
                  DJ Hospitality &amp; Facility Management Private Limited
                </div>
                <div style={{ fontSize: "7.5pt", fontWeight: 800, textTransform: "uppercase", marginTop: 2, letterSpacing: "0.8px" }}>
                  CANTEEN FIXED ASSET
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 3, alignItems: "center", flex: 1 }}>
                <div style={{ flex: 1, fontSize: "8pt", lineHeight: 1.3 }}>
                  <div style={{ marginBottom: 2 }}><b>ASSET ID:</b> <strong>{a.assetTag}</strong></div>
                  <div style={{ marginBottom: 2 }}><b>NAME:</b> {a.name}</div>
                  <div style={{ marginBottom: 2 }}><b>PURCHASED:</b> {a.purchaseDate}</div>
                  <div style={{ marginBottom: 2 }}><b>LOCATION:</b> {a.location}</div>
                </div>
                <div style={{ width: "1.1in", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <QRCodeSVG
                    value={`Asset ID: ${a.assetTag}\nName: ${a.name}\nDate: ${a.purchaseDate}\nLoc: ${a.location}\nOwner: DJ Hospitality`}
                    size={96}
                    level="H"
                    style={{ width: "1in", height: "1in" }}
                  />
                  <div style={{ fontSize: "6.5pt", fontWeight: "bold", marginTop: 2 }}>{a.assetTag}</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
