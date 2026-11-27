import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpenCheck, Download, FileUp, Printer, Search, Trash2, UserRoundPlus, UtensilsCrossed } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMealRegisterClient } from "@/hooks/use-meal-register-client";
import { useToast } from "@/hooks/use-toast";
import { useLang } from "@/contexts/language-context";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import {
  addLunch20,
  addLunchDue,
  evaluateEntry,
  MEAL_TYPES,
  normalizeDinerCode,
  settleEntry,
  TP_MEAL_CATALOG,
  type MealEntry,
  type MealType,
  type TpMealCode,
} from "@shared/meal-register";

type Diner = { id: number; dinerCode: string; name: string };
type RegisterEntry = MealEntry & { id: number; date: string };
type TpEntry = { id: number; date: string; mealCode: TpMealCode; qty: number; unitPrice: number; totalAmount: number };
type RegisterData = { entries: RegisterEntry[]; tpEntries: TpEntry[] };
type DuplicateError = Error & { entry?: RegisterEntry };

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function weekdayFor(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).getDay();
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatMoney(value: number) {
  return `₹${Number(value || 0).toFixed(2).replace(/\.00$/, "")}`;
}

export default function MealRegisterPage() {
  const { tr, lang } = useLang();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user, clients, clientsLoading, selectedClient, setSelectedClient, canSelectClient, hasClientAssignment } = useMealRegisterClient();
  const [date, setDate] = useState(() => localDateKey());
  const [dinerCode, setDinerCode] = useState("");
  const [dinerName, setDinerName] = useState("");
  const [customMeal, setCustomMeal] = useState<MealType>("Both");
  const [customCash, setCustomCash] = useState("");
  const [filter, setFilter] = useState<"all" | "pending">("all");
  const [search, setSearch] = useState("");
  const [duplicate, setDuplicate] = useState<RegisterEntry | null>(null);
  const [confirmEntry, setConfirmEntry] = useState<RegisterEntry | null>(null);
  const [tapQty, setTapQty] = useState(1);
  const [showAllMenu, setShowAllMenu] = useState(false);
  const [confirmClearTp, setConfirmClearTp] = useState(false);
  const legacyFileRef = useRef<HTMLInputElement>(null);
  const today = localDateKey();

  const dinersQuery = useQuery({
    queryKey: ["/api/meal-diners", selectedClient, { active: "true" }],
    queryFn: async () => (await apiRequest("GET", `/api/meal-diners?active=true&clientName=${encodeURIComponent(selectedClient)}`)).json() as Promise<Diner[]>,
    enabled: !!selectedClient,
  });
  const registerQuery = useQuery({
    queryKey: ["/api/meal-register", date, selectedClient],
    queryFn: async () => (await apiRequest("GET", `/api/meal-register?date=${encodeURIComponent(date)}&clientName=${encodeURIComponent(selectedClient)}`)).json() as Promise<RegisterData>,
    enabled: !!selectedClient,
  });
  const entries = registerQuery.data?.entries || [];
  const tpEntries = registerQuery.data?.tpEntries || [];
  const diners = dinersQuery.data || [];
  const weekday = weekdayFor(date);
  const locale = lang === "hi" ? "hi-IN" : lang === "bn" ? "bn-BD" : "en";
  const weekdayName = new Date(2025, 0, 5 + weekday).toLocaleDateString(locale, { weekday: "long" });
  const weekdayShort = new Date(2025, 0, 5 + weekday).toLocaleDateString(locale, { weekday: "short" });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/meal-register", date, selectedClient] });
  const tpInvalidate = () => qc.invalidateQueries({ queryKey: ["/api/meal-register", date, selectedClient] });

  const entryMutation = useMutation({
    mutationFn: async ({ mealType, cash }: { mealType: MealType; cash: number }) => {
      const code = normalizeDinerCode(dinerCode);
      if (!/^[A-Z0-9_-]{1,30}$/.test(code)) throw new Error(tr("dinerCode"));
      const response = await fetch("/api/meal-register/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ date, dinerCode: code, mealType, cash, clientName: selectedClient }),
      });
      const data = await response.json();
      if (response.status === 409) throw Object.assign(new Error(data.message), { entry: data.entry as RegisterEntry });
      if (response.status === 404) throw new Error(tr("dinerNotFoundForClient"));
      if (!response.ok) throw new Error(data.message || response.statusText);
      return data as RegisterEntry;
    },
    onSuccess: (entry) => {
      toast({ title: `${entry.dinerCode} · ${evaluateEntry(entry).statusLabel}` });
      setDinerCode("");
      setDinerName("");
      invalidate();
    },
    onError: (error: DuplicateError) => {
      if (error.entry) setDuplicate(error.entry);
      else toast({ title: error.message, variant: "destructive" });
    },
  });
  const actionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: number; action: "settle" | "add_lunch_20" | "add_lunch_due" }) =>
      apiRequest("PATCH", `/api/meal-register/entries/${id}/action`, { action, clientName: selectedClient }),
    onSuccess: () => { setDuplicate(null); invalidate(); },
    onError: (error: Error) => toast({ title: error.message, variant: "destructive" }),
  });
  const deleteEntryMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/meal-register/entries/${id}?clientName=${encodeURIComponent(selectedClient)}`),
    onSuccess: () => { setConfirmEntry(null); invalidate(); },
    onError: (error: Error) => toast({ title: error.message, variant: "destructive" }),
  });
  const tpAddMutation = useMutation({
    mutationFn: ({ mealCode, qty }: { mealCode: TpMealCode; qty: number }) =>
      apiRequest("POST", "/api/meal-register/tp-entries", { date, mealCode, qty, clientName: selectedClient }),
    onSuccess: () => invalidate(),
    onError: (error: Error) => toast({ title: error.message, variant: "destructive" }),
  });
  const tpDeleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/meal-register/tp-entries/${id}?clientName=${encodeURIComponent(selectedClient)}`),
    onSuccess: tpInvalidate,
    onError: (error: Error) => toast({ title: error.message, variant: "destructive" }),
  });
  const tpClearMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/meal-register/tp-entries?date=${encodeURIComponent(date)}&clientName=${encodeURIComponent(selectedClient)}`),
    onSuccess: () => { setConfirmClearTp(false); invalidate(); },
    onError: (error: Error) => toast({ title: error.message, variant: "destructive" }),
  });

  const permanentStats = useMemo(() => entries.reduce((stats, item) => {
    const evaluated = evaluateEntry(item);
    if (item.mealType === "BF" || item.mealType === "Both") stats.bfCount++;
    if (item.mealType === "Lunch" || item.mealType === "Both") stats.lunchCount++;
    stats.due += evaluated.activeDue;
    stats.returnAmount += evaluated.activeReturn;
    stats.net += evaluated.netPaid;
    stats.pending += evaluated.activeDue > 0 || evaluated.activeReturn > 0 ? 1 : 0;
    stats.bfAmount += evaluated.bfPaidAmt;
    stats.lunchAmount += evaluated.lunchPaidAmt;
    stats.morningCash += Number(item.morningCash);
    stats.lunchCash += Number(item.lunchCash);
    return stats;
  }, { bfCount: 0, lunchCount: 0, bfAmount: 0, lunchAmount: 0, morningCash: 0, lunchCash: 0, due: 0, returnAmount: 0, net: 0, pending: 0 }), [entries]);
  const thirdPartyStats = useMemo(() => {
    const totals = Object.fromEntries(Object.keys(TP_MEAL_CATALOG).map((code) => [code, { qty: 0, amount: 0 }])) as Record<TpMealCode, { qty: number; amount: number }>;
    tpEntries.forEach((entry) => {
      totals[entry.mealCode].qty += Number(entry.qty);
      totals[entry.mealCode].amount += Number(entry.totalAmount);
    });
    return {
      totals,
      breakfastCount: totals.TP_BF.qty,
      lunchCount: Object.entries(totals).filter(([code]) => code !== "TP_BF").reduce((sum, [, value]) => sum + value.qty, 0),
      amount: Object.values(totals).reduce((sum, value) => sum + value.amount, 0),
    };
  }, [tpEntries]);
  const filteredEntries = useMemo(() => entries.filter((entry) => {
    const evaluated = evaluateEntry(entry);
    const isPending = evaluated.activeDue > 0 || evaluated.activeReturn > 0;
    const matchesSearch = `${entry.dinerCode} ${entry.dinerName}`.toLowerCase().includes(search.trim().toLowerCase());
    return matchesSearch && (filter === "all" || isPending);
  }), [entries, filter, search]);
  const addEntry = (mealType: MealType, cash: number) => {
    if (!selectedClient) {
      toast({ title: tr("clientRequired"), variant: "destructive" });
      return;
    }
    if (!dinerCode.trim()) {
      toast({ title: tr("dinerCode"), variant: "destructive" });
      return;
    }
    if (!Number.isFinite(cash) || cash < 0 || cash > 100000) {
      toast({ title: tr("cash"), variant: "destructive" });
      return;
    }
    entryMutation.mutate({ mealType, cash });
  };
  const onCodeChange = (value: string) => {
    setDinerCode(value);
    const normalized = normalizeDinerCode(value);
    const matched = diners.find((diner) => diner.dinerCode === normalized);
    setDinerName(matched?.name || "");
  };
  const applyAction = (entry: RegisterEntry, action: "settle" | "add_lunch_20" | "add_lunch_due") => {
    actionMutation.mutate({ id: entry.id, action });
  };

  const exportExcel = async () => {
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      const summary = workbook.addWorksheet("Daily Summary");
      summary.addRows([
        ["Daily Canteen Register", selectedClient, date, weekdayName],
        ["Category", "Count", "Amount"],
        ["Permanent Breakfast", permanentStats.bfCount, permanentStats.bfAmount],
        ["Permanent Lunch", permanentStats.lunchCount, permanentStats.lunchAmount],
        ["Pending Due", "", permanentStats.due],
        ["Pending Return", "", permanentStats.returnAmount],
        ["Permanent Net", "", permanentStats.net],
        ["Third Party Meals", thirdPartyStats.breakfastCount + thirdPartyStats.lunchCount, thirdPartyStats.amount],
        ["Grand Net", "", permanentStats.net + thirdPartyStats.amount],
      ]);
      const register = workbook.addWorksheet("Register");
      register.addRow(["#", "Diner Code", "Name", "Meal", "BF ₹", "Lunch ₹", "Morning Cash", "Due", "Return", "Lunch Cash", "Net", "Status"]);
      entries.slice().reverse().forEach((entry, index) => {
        const ev = evaluateEntry(entry);
        register.addRow([index + 1, entry.dinerCode, entry.dinerName, entry.mealType, ev.bfPaidAmt, ev.lunchPaidAmt,
          entry.morningCash, entry.originalDue, entry.originalReturn, entry.lunchCash, ev.netPaid, ev.statusLabel]);
      });
      const thirdParty = workbook.addWorksheet("Third Party");
      thirdParty.addRow(["Meal", "Rate", "Count", "Amount"]);
      (Object.keys(TP_MEAL_CATALOG) as TpMealCode[]).forEach((code) => {
        thirdParty.addRow([TP_MEAL_CATALOG[code].label, TP_MEAL_CATALOG[code].price, thirdPartyStats.totals[code].qty, thirdPartyStats.totals[code].amount]);
      });
      const buffer = await workbook.xlsx.writeBuffer();
      const clientFilePart = selectedClient.replace(/[^A-Za-z0-9_-]+/g, "_");
      downloadBlob(new Blob([new Uint8Array(buffer)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `Canteen_Register_${clientFilePart}_${date}.xlsx`);
    } catch (error) {
      toast({ title: tr("exportExcel"), description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    }
  };
  const exportPdf = async () => {
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      doc.setFontSize(15);
      doc.text(`Daily Canteen Register — ${selectedClient} — ${date} (${weekdayName})`, 12, 14);
      doc.setFontSize(9);
      doc.text(`Permanent net ${formatMoney(permanentStats.net)} · Third party ${formatMoney(thirdPartyStats.amount)} · Grand net ${formatMoney(permanentStats.net + thirdPartyStats.amount)}`, 12, 21);
      const rows = entries.slice().reverse();
      let y = 30;
      const headings = ["#", "Code", "Name", "Meal", "BF", "Lunch", "Morning", "Due", "Return", "Lunch cash", "Net", "Status"];
      const widths = [9, 22, 38, 17, 15, 15, 19, 17, 17, 19, 17, 52];
      let x = 10;
      headings.forEach((heading, index) => {
        doc.text(heading, x, y);
        x += widths[index];
      });
      y += 6;
      rows.forEach((entry, index) => {
        if (y > 190) { doc.addPage(); y = 16; }
        const ev = evaluateEntry(entry);
        const cells = [String(index + 1), entry.dinerCode, entry.dinerName || "-", entry.mealType,
          String(ev.bfPaidAmt), String(ev.lunchPaidAmt), String(entry.morningCash), String(ev.activeDue),
          String(ev.activeReturn), String(entry.lunchCash), String(ev.netPaid), ev.statusLabel];
        let cellX = 10;
        cells.forEach((cell, cellIndex) => {
          doc.text(doc.splitTextToSize(cell, widths[cellIndex] - 2), cellX, y);
          cellX += widths[cellIndex];
        });
        y += 6;
      });
      if (y > 180) { doc.addPage(); y = 16; }
      y += 4;
      doc.setFontSize(11);
      doc.text(tr("thirdParty"), 10, y);
      y += 7;
      doc.setFontSize(8);
      (Object.keys(TP_MEAL_CATALOG) as TpMealCode[]).forEach((code) => {
        if (y > 195) { doc.addPage(); y = 16; }
        const labelKey = { TP_BF: "tpBreakfast", TP_VEG: "tpVegLunch", TP_EGG: "tpEggLunch", TP_FISH: "tpFishLunch", TP_CHICKEN: "tpChickenLunch", TP_OUTSIDE: "tpOutsideLunch" }[code] as Parameters<typeof tr>[0];
        const meal = TP_MEAL_CATALOG[code];
        const total = thirdPartyStats.totals[code];
        doc.text(`${tr(labelKey)} · ${tr("cash")} ${formatMoney(meal.price)} · ${tr("count")} ${total.qty} · ${tr("netCollection")} ${formatMoney(total.amount)}`, 12, y);
        y += 5;
      });
      doc.save(`Canteen_Register_${date}.pdf`);
    } catch (error) {
      toast({ title: tr("exportPdf"), description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    }
  };
  const importLegacy = async (file?: File) => {
    if (!file) return;
    try {
      const data: unknown = JSON.parse(await file.text());
      if (typeof data !== "object" || data === null || Array.isArray(data)) throw new Error(tr("importLegacy"));
      const response = await apiRequest("POST", "/api/meal-register/import-legacy", { ...data, clientName: selectedClient });
      const counts = await response.json();
      toast({
        title: tr("importLegacyComplete"),
        description: `${tr("created")}: ${counts.diners.created} · ${tr("updated")}: ${counts.diners.updated} · ${tr("skipped")}: ${counts.diners.skipped}; entries ${counts.entries.imported}/${counts.entries.skipped}; third party ${counts.tpEntries.imported}/${counts.tpEntries.skipped}`,
      });
      invalidate();
      qc.invalidateQueries({ queryKey: ["/api/meal-diners"] });
    } catch (error) {
      toast({ title: tr("importLegacy"), description: error instanceof Error ? error.message : "Invalid backup", variant: "destructive" });
    } finally {
      if (legacyFileRef.current) legacyFileRef.current.value = "";
    }
  };

  const cards = [
    { title: tr("breakfastStat"), value: `${permanentStats.bfCount + thirdPartyStats.breakfastCount} ${tr("count")} · ${formatMoney(permanentStats.bfAmount + thirdPartyStats.totals.TP_BF.amount)}`, detail: `Perm: ${permanentStats.bfCount} (${formatMoney(permanentStats.bfAmount)}) + TP: ${thirdPartyStats.breakfastCount} (${formatMoney(thirdPartyStats.totals.TP_BF.amount)})`, color: "border-emerald-200 text-emerald-800", badge: "bg-emerald-100 text-emerald-800" },
    { title: tr("lunchStat"), value: `${permanentStats.lunchCount + thirdPartyStats.lunchCount} ${tr("count")} · ${formatMoney(permanentStats.lunchAmount + thirdPartyStats.amount - thirdPartyStats.totals.TP_BF.amount)}`, detail: `Perm: ${permanentStats.lunchCount} (${formatMoney(permanentStats.lunchAmount)}) + TP: ${thirdPartyStats.lunchCount} (${formatMoney(thirdPartyStats.amount - thirdPartyStats.totals.TP_BF.amount)})`, color: "border-indigo-200 text-indigo-800", badge: "bg-indigo-100 text-indigo-800" },
    { title: tr("pendingDue"), value: `${formatMoney(permanentStats.due)} (${permanentStats.pending})`, detail: `${tr("pendingReturn")}: ${formatMoney(permanentStats.returnAmount)}`, color: "border-amber-300 bg-amber-50 text-amber-900", badge: "bg-amber-100 text-amber-900" },
    { title: tr("netStat"), value: `${tr("netStat")}: ${formatMoney(permanentStats.net)} Perm`, detail: `${formatMoney(thirdPartyStats.amount)} TP · Morn ${formatMoney(permanentStats.morningCash)} · Lunch ${formatMoney(permanentStats.lunchCash)}`, color: "border-slate-200 text-blue-800", badge: "bg-slate-100 text-slate-700" },
    { title: tr("netCollection"), value: formatMoney(permanentStats.net + thirdPartyStats.amount), detail: `${permanentStats.bfCount + permanentStats.lunchCount + thirdPartyStats.breakfastCount + thirdPartyStats.lunchCount} ${tr("count")} · Perm + TP`, color: "border-slate-900 bg-slate-900 text-emerald-400", badge: "bg-amber-500/20 text-amber-300" },
  ];

  return (
    <Layout>
      <div className="meal-register-print space-y-4">
        <style>{`@page{size:A4 portrait;margin:8mm}@media print{body *{visibility:hidden!important}.meal-register-print,.meal-register-print *{visibility:visible!important}.meal-register-print{position:absolute;left:0;top:0;width:100%;max-width:none!important;padding:0!important}.meal-register-print .no-print{display:none!important}.meal-register-print table{border-collapse:collapse;width:100%}.meal-register-print th,.meal-register-print td{border:1px solid #64748b;padding:4px;font-size:8pt}.meal-register-print tr{break-inside:avoid}.meal-register-print .print-card{break-inside:avoid}}`}</style>
        <header className="flex flex-col gap-4 rounded-2xl bg-slate-900 p-4 text-white shadow-md sm:p-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-xl font-black text-slate-950 shadow-inner">₹</div>
            <div>
              <h1 className="flex flex-wrap items-center gap-2 text-lg font-bold tracking-tight sm:text-xl">{tr("canteenRegister")}<span className="rounded-full border border-emerald-500/40 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-extrabold text-emerald-300">{weekdayName}</span></h1>
              <p className="text-xs text-slate-300">{selectedClient || tr("selectClient")} · BF ₹5 · Lunch ₹20 · Both ₹25</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canSelectClient ? (
              <div className="min-w-52 space-y-1">
                <Label htmlFor="meal-register-client" className="text-xs text-slate-300">{tr("selectClient")}</Label>
                <select id="meal-register-client" value={selectedClient} disabled={clientsLoading} onChange={(event) => setSelectedClient(event.target.value)} className="h-10 w-full rounded-md border border-slate-600 bg-slate-800 px-3 text-sm text-white">
                  <option value="">{tr("selectClient")}</option>
                  {clients.map((client) => <option key={client.id} value={client.name}>{client.name}</option>)}
                </select>
              </div>
            ) : <div className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm"><span className="text-slate-300">{tr("selectClient")}: </span><strong>{selectedClient || "—"}</strong></div>}
            <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5">
              <Label htmlFor="register-date" className="text-xs font-medium text-slate-300">{tr("date")}</Label>
              <Input id="register-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} className="no-print h-8 w-auto border-0 bg-transparent px-1 text-sm font-semibold text-white [color-scheme:dark]" />
            </div>
            <div className="no-print flex flex-wrap gap-2">
              <Button className="border-0 bg-emerald-600 text-white hover:bg-emerald-500" onClick={exportExcel}><Download className="mr-2 h-4 w-4" />{tr("exportExcel")}</Button>
              <Button className="border-0 bg-rose-600 text-white hover:bg-rose-500" onClick={exportPdf}><Download className="mr-2 h-4 w-4" />{tr("exportPdf")}</Button>
              <Button className="border-0 bg-blue-600 text-white hover:bg-blue-500" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />{tr("printA4")}</Button>
            </div>
            {user?.role === "admin" && (
              <>
                <input ref={legacyFileRef} type="file" accept=".json,application/json" className="hidden" onChange={(event) => void importLegacy(event.target.files?.[0])} />
                <Button disabled={!selectedClient} className="no-print border-amber-500 bg-slate-800 text-amber-300 hover:bg-slate-700" variant="outline" onClick={() => legacyFileRef.current?.click()}><FileUp className="mr-2 h-4 w-4" />{tr("importLegacy")}</Button>
              </>
            )}
          </div>
          </header>
        {!selectedClient && <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">{hasClientAssignment ? tr("clientRequired") : tr("clientAssignmentMissing")}</div>}
        {date !== today && <div role="alert" className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800">{tr("selectedDateWarning")} {date}</div>}

        <section className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-5">
          {cards.map((card, index) => <Card key={card.title} className={`rounded-xl border-2 shadow-sm ${card.color}`}>
            <CardHeader className="flex-row items-center justify-between space-y-0 p-3 pb-1">
              <CardTitle className={`text-[11px] font-bold uppercase ${index === 4 ? "text-amber-300" : ""}`}>{card.title}</CardTitle>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${card.badge}`}>{index < 2 ? (index === 0 ? "BF" : "LUNCH") : index === 4 ? "₹" : "TOTAL"}</span>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className={`text-xl font-extrabold ${index === 4 ? "text-emerald-400" : ""}`}>{card.value}</div>
              <p className={`mt-1 text-[11px] ${index === 4 ? "text-slate-300" : "text-slate-600"}`}>{card.detail}</p>
            </CardContent>
          </Card>)}
        </section>

        <div className="grid items-start gap-4 xl:grid-cols-12">
          <section className="space-y-4 xl:col-span-7">
        <Card className="no-print overflow-hidden border-2 border-blue-200 shadow-sm">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 border-b border-blue-100 bg-blue-50 p-3">
            <CardTitle className="flex items-center gap-2 text-sm font-extrabold text-slate-900"><span className="rounded-md bg-blue-600 px-2 py-0.5 text-[11px] text-white">PERMANENT</span><BookOpenCheck className="h-4 w-4 text-blue-700" />{tr("quickEntry")}</CardTitle>
            <Link href={`/meal-diners${selectedClient ? `?clientName=${encodeURIComponent(selectedClient)}` : ""}`} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 bg-white px-2.5 py-1.5 text-xs font-bold text-blue-800 hover:bg-blue-100">
              <UserRoundPlus className="h-3.5 w-3.5" />{tr("manageDiners")}
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
              <div className="space-y-1"><Label htmlFor="quick-diner-code">{tr("dinerCode")}</Label><Input id="quick-diner-code" list="meal-diner-options" value={dinerCode} onChange={(event) => onCodeChange(event.target.value)} onKeyDown={(event) => event.key === "Enter" && (event.preventDefault(), addEntry("Both", 25))} placeholder={tr("dinerCodePlaceholder")} autoComplete="off" className="uppercase" /><datalist id="meal-diner-options">{diners.map((diner) => <option key={diner.id} value={diner.dinerCode}>{diner.name}</option>)}</datalist></div>
              <div className="space-y-1"><Label htmlFor="quick-diner-name">{tr("dinerName")}</Label><Input id="quick-diner-name" value={dinerName} onChange={(event) => setDinerName(event.target.value)} readOnly={!!diners.find((diner) => diner.dinerCode === normalizeDinerCode(dinerCode))} /></div>
              <div className="flex items-end gap-2">
                <div className="min-w-0 flex-1 space-y-1"><Label htmlFor="custom-meal">{tr("mealType")}</Label><select id="custom-meal" value={customMeal} onChange={(event) => setCustomMeal(event.target.value as MealType)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">{MEAL_TYPES.map((type) => <option key={type} value={type}>{type === "BF" ? `${tr("breakfast")} ₹5` : type === "Lunch" ? `${tr("lunch")} ₹20` : `${tr("bothMeals")} ₹25`}</option>)}</select></div>
                <div className="w-24 space-y-1"><Label htmlFor="custom-cash">{tr("cash")}</Label><Input id="custom-cash" inputMode="decimal" type="number" min="0" max="100000" value={customCash} onChange={(event) => setCustomCash(event.target.value)} /></div>
                <Button disabled={!selectedClient || entryMutation.isPending || customCash === ""} onClick={() => { addEntry(customMeal, Number(customCash)); setCustomCash(""); }}>{tr("addEntry")}</Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold uppercase text-slate-600">2. {tr("oneTapEntry")}</p>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {([
                  ["BF", 5, "☕", tr("breakfastPaid"), tr("morningClear"), "border-emerald-500 bg-emerald-50 text-emerald-950 hover:bg-emerald-100"],
                  ["Both", 25, "🍱", tr("comboPaid"), tr("comboDetail"), "border-blue-500 bg-blue-50 text-blue-950 hover:bg-blue-100"],
                  ["BF", 0, "⏳", tr("breakfastDue"), tr("collectAtLunch"), "border-amber-500 bg-amber-50 text-amber-950 hover:bg-amber-100"],
                  ["Lunch", 20, "🍛", tr("lunchOnly"), tr("lunchOnlyDetail"), "border-indigo-400 bg-indigo-50 text-indigo-950 hover:bg-indigo-100"],
                ] as const).map(([meal, cash, icon, title, detail, color]) => (
                  <Button key={title} type="button" disabled={!selectedClient || entryMutation.isPending} variant="outline" className={`h-auto min-h-[62px] justify-start rounded-xl border-2 px-2.5 py-2 text-left ${color}`} onClick={() => addEntry(meal, cash)}>
                    <span className="min-w-0 whitespace-normal">
                      <span className="block text-xs font-extrabold">{icon} {title}</span>
                      <span className="block text-[10px] font-medium">{detail}</span>
                    </span>
                  </Button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {[50, 100, 200, 500].map((cash) => (
                  <Button key={cash} type="button" disabled={!selectedClient || entryMutation.isPending} variant="outline" className="h-auto min-h-11 justify-between gap-1 rounded-xl border-rose-400 bg-rose-50 px-2.5 py-1.5 text-rose-950 hover:bg-rose-100" onClick={() => addEntry("Both", cash)}>
                    <span className="text-xs font-extrabold">💵 {tr("note")} ₹{cash}</span>
                    <span className="rounded border border-rose-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-rose-700">{tr("changeReturn")} ₹{cash - 25}</span>
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border border-slate-300 shadow-sm">
          <CardHeader className="flex flex-col gap-3 bg-slate-800 p-3 text-white sm:flex-row sm:items-center sm:justify-between">
            <div><CardTitle className="text-sm font-extrabold">{tr("canteenRegister")} · {date} ({weekdayShort})</CardTitle><p className="text-[11px] text-slate-300">BF ₹5 · Lunch ₹20 · Both ₹25</p></div>
            <div className="no-print flex flex-wrap items-center gap-2">
              <Button className="border-slate-600 bg-slate-700 text-white hover:bg-slate-600" size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>{tr("allEntries")} ({entries.length})</Button>
              <Button className="border-slate-600 bg-slate-700 text-white hover:bg-slate-600" size="sm" variant={filter === "pending" ? "default" : "outline"} onClick={() => setFilter("pending")}>{tr("pendingEntries")} ({permanentStats.pending})</Button>
              <div className="relative min-w-44 flex-1 sm:flex-none"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tr("searchDiners")} className="border-slate-600 bg-slate-700 pl-8 text-white placeholder:text-slate-400" /></div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-sm">
                <thead><tr className="border-b bg-slate-100 text-left text-[11px] font-bold uppercase text-slate-700">
                  <th className="p-2">#</th><th className="p-2">{tr("dinerCode")}</th><th className="p-2">{tr("dinerName")}</th><th className="p-2">{tr("mealType")}</th>
                  <th className="p-2 text-right">BF ₹</th><th className="p-2 text-right">L. ₹</th><th className="p-2 text-right">Morn</th><th className="p-2 text-right">{tr("due")}</th>
                  <th className="p-2 text-right">{tr("returnStat")}</th><th className="p-2 text-right">{tr("lunch")}</th><th className="p-2 text-right">Net</th><th className="p-2">{tr("status")}</th><th className="no-print p-2">{tr("actions")}</th>
                </tr></thead>
                <tbody>
                  {filteredEntries.map((entry, index) => {
                    const ev = evaluateEntry(entry);
                    return <tr key={entry.id} className={`border-b border-slate-200 text-xs last:border-0 ${ev.statusType === "due" ? "bg-amber-50" : ev.statusType === "return" ? "bg-rose-50" : index % 2 ? "bg-slate-50" : "bg-white"}`}>
                      <td className="p-2">{index + 1}</td><td className="p-2 font-semibold">{entry.dinerCode}</td><td className="p-2">{entry.dinerName || "—"}</td><td className="p-2">{entry.mealType}</td>
                      <td className="p-2 text-right">{formatMoney(ev.bfPaidAmt)}</td><td className="p-2 text-right">{formatMoney(ev.lunchPaidAmt)}</td>
                      <td className="p-2 text-right">{formatMoney(entry.morningCash)}</td>
                      <td className="p-2 text-right">{entry.originalDue ? <span className={entry.dueSettled ? "line-through text-muted-foreground" : "font-bold text-amber-700"}>{formatMoney(entry.originalDue)}</span> : "—"}</td>
                      <td className="p-2 text-right">{entry.originalReturn ? <span className={entry.returnSettled ? "line-through text-muted-foreground" : "font-bold text-rose-700"}>{formatMoney(entry.originalReturn)}</span> : "—"}</td>
                      <td className="p-2 text-right">{formatMoney(entry.lunchCash)}</td><td className="p-2 text-right font-bold">{formatMoney(ev.netPaid)}</td>
                      <td className="p-2">{ev.statusLabel}</td>
                      <td className="no-print p-2"><div className="flex flex-wrap gap-1">
                        {(ev.activeDue > 0 || ev.activeReturn > 0 || (entry.mealType === "BF" && entry.originalDue === 0)) &&
                          <Button size="sm" variant="outline" onClick={() => applyAction(entry, "settle")}>{ev.activeDue ? `${tr("settle")} ${formatMoney(entry.mealType === "BF" ? entry.originalDue + 20 : entry.originalDue)}` : ev.activeReturn ? `${tr("settle")} ${formatMoney(ev.activeReturn)}` : "+L ₹20"}</Button>}
                        <Button size="sm" variant="ghost" aria-label={tr("confirmDelete")} onClick={() => setConfirmEntry(entry)}><Trash2 className="h-4 w-4" /></Button>
                      </div></td>
                    </tr>;
                  })}
                  {!filteredEntries.length && <tr><td colSpan={13} className="p-8 text-center text-muted-foreground">{tr("noEntries")}</td></tr>}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
          </section>
          <section className="space-y-4 xl:col-span-5">
        <Card className="no-print overflow-hidden border-2 border-purple-300 shadow-sm">
          <CardHeader className="flex flex-col gap-2 border-b border-purple-200 bg-purple-50 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div><CardTitle className="text-sm font-extrabold text-purple-950">{tr("thirdParty")}</CardTitle><p className="text-xs text-purple-800">{weekdayName}: BF ₹20 · {tr("lunchMenu")}</p></div>
            <div className="no-print flex flex-wrap items-center gap-2">
              <Label htmlFor="tap-quantity">{tr("tapQuantity")}</Label>
              <select id="tap-quantity" value={tapQty} onChange={(event) => setTapQty(Number(event.target.value))} className="h-9 rounded-md border border-purple-300 bg-white px-2 text-sm">{[1, 2, 5, 10].map((qty) => <option key={qty} value={qty}>+{qty}</option>)}</select>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showAllMenu} onChange={(event) => setShowAllMenu(event.target.checked)} />{tr("showAllMenu")}</label>
              {user?.role === "admin" && <Button disabled={!selectedClient} size="sm" variant="destructive" onClick={() => setConfirmClearTp(true)}>{tr("clearTp")}</Button>}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="no-print grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {(Object.values(TP_MEAL_CATALOG)).map((meal) => {
                const available = (meal.days as readonly number[]).includes(weekday);
                const isHidden = !available && !showAllMenu && meal.category === "LUNCH";
                if (isHidden) return null;
                const labelKey = { TP_BF: "tpBreakfast", TP_VEG: "tpVegLunch", TP_EGG: "tpEggLunch", TP_FISH: "tpFishLunch", TP_CHICKEN: "tpChickenLunch", TP_OUTSIDE: "tpOutsideLunch" }[meal.code] as Parameters<typeof tr>[0];
                return <Button key={meal.code} variant="outline" disabled={!selectedClient || !available || tpAddMutation.isPending} className={`h-auto min-h-16 justify-between whitespace-normal border-purple-200 bg-white text-left hover:bg-purple-50 ${meal.code === "TP_BF" ? "border-emerald-300 bg-emerald-50 hover:bg-emerald-100" : ""}`} onClick={() => tpAddMutation.mutate({ mealCode: meal.code as TpMealCode, qty: tapQty })}>
                  <span>{tr(labelKey)} · ₹{meal.price}{!available ? ` · ${tr("notAvailable")}` : ""}</span><span className="font-bold">+{tapQty} ({formatMoney(tapQty * meal.price)})</span>
                </Button>;
              })}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[460px] text-sm">
                <thead><tr className="border-b bg-purple-900 text-left text-[11px] font-bold text-white"><th className="p-2">{tr("thirdParty")}</th><th className="p-2 text-right">{tr("cash")}</th><th className="p-2 text-right">{tr("count")}</th><th className="p-2 text-right">{tr("netCollection")}</th></tr></thead>
                <tbody>{(Object.keys(TP_MEAL_CATALOG) as TpMealCode[]).map((code) => {
                  const labelKey = { TP_BF: "tpBreakfast", TP_VEG: "tpVegLunch", TP_EGG: "tpEggLunch", TP_FISH: "tpFishLunch", TP_CHICKEN: "tpChickenLunch", TP_OUTSIDE: "tpOutsideLunch" }[code] as Parameters<typeof tr>[0];
                  return <tr key={code} className="border-b last:border-0"><td className="p-2">{tr(labelKey)}</td><td className="p-2 text-right">{formatMoney(TP_MEAL_CATALOG[code].price)}</td><td className="p-2 text-right">{thirdPartyStats.totals[code].qty}</td><td className="p-2 text-right">{formatMoney(thirdPartyStats.totals[code].amount)}</td></tr>;
                })}</tbody>
              </table>
            </div>
            <div className="no-print flex flex-wrap gap-2 border-t pt-3">
              {tpEntries.map((entry) => <span key={entry.id} className="inline-flex items-center gap-2 rounded-md border border-purple-200 bg-purple-50 px-2 py-1 text-xs">
                {TP_MEAL_CATALOG[entry.mealCode].shortLabel} ×{entry.qty} · {formatMoney(Number(entry.totalAmount))}
                <button aria-label={tr("confirmDelete")} onClick={() => tpDeleteMutation.mutate(entry.id)} className="font-bold text-destructive">×</button>
              </span>)}
              {!tpEntries.length && <span className="text-sm text-muted-foreground">{tr("noEntries")}</span>}
            </div>
          </CardContent>
        </Card>
          </section>
        </div>
        <Card className="overflow-hidden border border-slate-300 shadow-sm">
          <CardHeader className="bg-slate-900 p-3 text-white">
            <CardTitle className="text-sm font-extrabold uppercase tracking-wide">{tr("canteenRegister")} · {tr("netCollection")}</CardTitle>
            <p className="text-[11px] text-slate-300">Permanent + {tr("thirdParty")} · {date} ({weekdayName})</p>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[640px] text-xs">
              <thead><tr className="bg-slate-100 text-left font-bold text-slate-700"><th className="p-2">{tr("mealType")}</th><th className="p-2 text-right">Permanent</th><th className="p-2 text-right">{tr("thirdParty")}</th><th className="bg-emerald-50 p-2 text-right text-emerald-950">{tr("netCollection")}</th></tr></thead>
              <tbody>
                <tr className="border-b"><td className="p-2 font-semibold">{tr("breakfastStat")}</td><td className="p-2 text-right">{permanentStats.bfCount} · {formatMoney(permanentStats.bfAmount)}</td><td className="p-2 text-right">{thirdPartyStats.breakfastCount} · {formatMoney(thirdPartyStats.totals.TP_BF.amount)}</td><td className="bg-emerald-50 p-2 text-right font-bold">{permanentStats.bfCount + thirdPartyStats.breakfastCount} · {formatMoney(permanentStats.bfAmount + thirdPartyStats.totals.TP_BF.amount)}</td></tr>
                <tr className="border-b"><td className="p-2 font-semibold">{tr("lunchStat")}</td><td className="p-2 text-right">{permanentStats.lunchCount} · {formatMoney(permanentStats.lunchAmount)}</td><td className="p-2 text-right">{thirdPartyStats.lunchCount} · {formatMoney(thirdPartyStats.amount - thirdPartyStats.totals.TP_BF.amount)}</td><td className="bg-emerald-50 p-2 text-right font-bold">{permanentStats.lunchCount + thirdPartyStats.lunchCount} · {formatMoney(permanentStats.lunchAmount + thirdPartyStats.amount - thirdPartyStats.totals.TP_BF.amount)}</td></tr>
                <tr className="bg-slate-100 font-extrabold"><td className="p-2">{tr("netCollection")}</td><td className="p-2 text-right">{formatMoney(permanentStats.net)}</td><td className="p-2 text-right">{formatMoney(thirdPartyStats.amount)}</td><td className="bg-emerald-100 p-2 text-right">{formatMoney(permanentStats.net + thirdPartyStats.amount)}</td></tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!duplicate} onOpenChange={(open) => !open && setDuplicate(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{tr("duplicateEntry")}</DialogTitle><DialogDescription>{duplicate?.dinerCode} — {duplicate?.dinerName}</DialogDescription></DialogHeader>
          {duplicate && (() => {
            const ev = evaluateEntry(duplicate);
            return <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted p-3 text-center text-sm">
                <div><span className="text-muted-foreground">{tr("mealType")}</span><p className="font-semibold">{duplicate.mealType}</p></div>
                <div><span className="text-muted-foreground">{tr("cash")}</span><p className="font-semibold">{formatMoney(duplicate.morningCash + duplicate.lunchCash)}</p></div>
                <div><span className="text-muted-foreground">{tr("due")}</span><p className="font-semibold">{formatMoney(ev.activeDue || ev.activeReturn)}</p></div>
              </div>
              {ev.activeDue > 0 && <Button className="w-full" onClick={() => applyAction(duplicate, "settle")}>{tr("settle")} · {formatMoney(duplicate.mealType === "BF" ? duplicate.originalDue + 20 : duplicate.originalDue)}</Button>}
              {ev.activeReturn > 0 && <Button className="w-full" onClick={() => applyAction(duplicate, "settle")}>{tr("settle")} · {formatMoney(ev.activeReturn)}</Button>}
              {duplicate.mealType === "BF" && ev.activeDue === 0 && ev.activeReturn === 0 && <>
                <Button className="w-full" onClick={() => applyAction(duplicate, "add_lunch_20")}>{tr("addLunchPaid")}</Button>
                <Button variant="outline" className="w-full" onClick={() => applyAction(duplicate, "add_lunch_due")}>{tr("addLunchDue")}</Button>
              </>}
              {duplicate.mealType === "Lunch" && <p className="rounded-lg bg-indigo-50 p-3 text-sm">{tr("lunch")} · {tr("duplicateEntry")}</p>}
              {duplicate.mealType === "Both" && <p className="rounded-lg bg-emerald-50 p-3 text-sm">{tr("bothMeals")} · {tr("duplicateEntry")}</p>}
            </div>;
          })()}
          <DialogFooter><Button variant="outline" onClick={() => setDuplicate(null)}>{tr("cancel")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmEntry} onOpenChange={(open) => !open && setConfirmEntry(null)}>
        <DialogContent><DialogHeader><DialogTitle>{tr("confirmDelete")}</DialogTitle><DialogDescription>{confirmEntry?.dinerCode} — {confirmEntry?.dinerName}</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setConfirmEntry(null)}>{tr("cancel")}</Button><Button variant="destructive" disabled={deleteEntryMutation.isPending} onClick={() => confirmEntry && deleteEntryMutation.mutate(confirmEntry.id)}>{tr("confirmDelete")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={confirmClearTp} onOpenChange={setConfirmClearTp}>
        <DialogContent><DialogHeader><DialogTitle>{tr("clearTp")}</DialogTitle><DialogDescription>{tr("confirmDelete")} · {date}</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setConfirmClearTp(false)}>{tr("cancel")}</Button><Button variant="destructive" disabled={tpClearMutation.isPending} onClick={() => tpClearMutation.mutate()}>{tr("clearTp")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
