import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpenCheck, Download, FileUp, Printer, Search, Trash2, UtensilsCrossed } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentUser } from "@/hooks/use-reports";
import { useToast } from "@/hooks/use-toast";
import { useLang } from "@/contexts/language-context";
import { apiRequest } from "@/lib/queryClient";
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
  const { data: user } = useCurrentUser();
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
    queryKey: ["/api/meal-diners", { active: "true" }],
    queryFn: async () => (await apiRequest("GET", "/api/meal-diners?active=true")).json() as Promise<Diner[]>,
  });
  const registerQuery = useQuery({
    queryKey: ["/api/meal-register", date],
    queryFn: async () => (await apiRequest("GET", `/api/meal-register?date=${encodeURIComponent(date)}`)).json() as Promise<RegisterData>,
  });
  const entries = registerQuery.data?.entries || [];
  const tpEntries = registerQuery.data?.tpEntries || [];
  const diners = dinersQuery.data || [];
  const weekday = weekdayFor(date);
  const locale = lang === "hi" ? "hi-IN" : lang === "bn" ? "bn-BD" : "en";
  const weekdayName = new Date(2025, 0, 5 + weekday).toLocaleDateString(locale, { weekday: "long" });
  const weekdayShort = new Date(2025, 0, 5 + weekday).toLocaleDateString(locale, { weekday: "short" });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/meal-register", date] });
  const tpInvalidate = () => qc.invalidateQueries({ queryKey: ["/api/meal-register", date] });

  const entryMutation = useMutation({
    mutationFn: async ({ mealType, cash }: { mealType: MealType; cash: number }) => {
      const code = normalizeDinerCode(dinerCode);
      if (!/^[A-Z0-9_-]{1,30}$/.test(code)) throw new Error(tr("dinerCode"));
      const response = await fetch("/api/meal-register/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ date, dinerCode: code, mealType, cash }),
      });
      const data = await response.json();
      if (response.status === 409) throw Object.assign(new Error(data.message), { entry: data.entry as RegisterEntry });
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
      apiRequest("PATCH", `/api/meal-register/entries/${id}/action`, { action }),
    onSuccess: () => { setDuplicate(null); invalidate(); },
    onError: (error: Error) => toast({ title: error.message, variant: "destructive" }),
  });
  const deleteEntryMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/meal-register/entries/${id}`),
    onSuccess: () => { setConfirmEntry(null); invalidate(); },
    onError: (error: Error) => toast({ title: error.message, variant: "destructive" }),
  });
  const tpAddMutation = useMutation({
    mutationFn: ({ mealCode, qty }: { mealCode: TpMealCode; qty: number }) =>
      apiRequest("POST", "/api/meal-register/tp-entries", { date, mealCode, qty }),
    onSuccess: () => invalidate(),
    onError: (error: Error) => toast({ title: error.message, variant: "destructive" }),
  });
  const tpDeleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/meal-register/tp-entries/${id}`),
    onSuccess: tpInvalidate,
    onError: (error: Error) => toast({ title: error.message, variant: "destructive" }),
  });
  const tpClearMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/meal-register/tp-entries?date=${encodeURIComponent(date)}`),
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
    return stats;
  }, { bfCount: 0, lunchCount: 0, bfAmount: 0, lunchAmount: 0, due: 0, returnAmount: 0, net: 0, pending: 0 }), [entries]);
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
        ["Daily Canteen Register", date, weekdayName],
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
      downloadBlob(new Blob([new Uint8Array(buffer)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `Canteen_Register_${date}.xlsx`);
    } catch (error) {
      toast({ title: tr("exportExcel"), description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    }
  };
  const exportPdf = async () => {
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      doc.setFontSize(15);
      doc.text(`Daily Canteen Register — ${date} (${weekdayName})`, 12, 14);
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
      const response = await apiRequest("POST", "/api/meal-register/import-legacy", data);
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
    { title: tr("breakfastStat"), value: `${permanentStats.bfCount + thirdPartyStats.breakfastCount} · ${formatMoney(permanentStats.bfAmount + thirdPartyStats.totals.TP_BF.amount)}`, detail: `${tr("active")}: ${permanentStats.bfCount} (${formatMoney(permanentStats.bfAmount)}) · TP: ${thirdPartyStats.breakfastCount} (${formatMoney(thirdPartyStats.totals.TP_BF.amount)})` },
    { title: tr("lunchStat"), value: `${permanentStats.lunchCount + thirdPartyStats.lunchCount} · ${formatMoney(permanentStats.lunchAmount + thirdPartyStats.amount - thirdPartyStats.totals.TP_BF.amount)}`, detail: `${tr("active")}: ${permanentStats.lunchCount} (${formatMoney(permanentStats.lunchAmount)}) · TP: ${thirdPartyStats.lunchCount} (${formatMoney(thirdPartyStats.amount - thirdPartyStats.totals.TP_BF.amount)})` },
    { title: tr("pendingDue"), value: formatMoney(permanentStats.due), detail: `${permanentStats.pending} ${tr("pendingEntries")}` },
    { title: tr("pendingReturn"), value: formatMoney(permanentStats.returnAmount), detail: tr("returnStat") },
    { title: tr("netCollection"), value: formatMoney(permanentStats.net + thirdPartyStats.amount), detail: `${tr("thirdPartyStat")}: ${formatMoney(thirdPartyStats.amount)}` },
    { title: tr("thirdParty"), value: formatMoney(thirdPartyStats.amount), detail: `${thirdPartyStats.breakfastCount + thirdPartyStats.lunchCount} ${tr("count")}` },
  ];

  return (
    <Layout>
      <div className="meal-register-print space-y-4">
        <style>{`@page{size:A4 portrait;margin:8mm}@media print{body *{visibility:hidden!important}.meal-register-print,.meal-register-print *{visibility:visible!important}.meal-register-print{position:absolute;left:0;top:0;width:100%;max-width:none!important;padding:0!important}.meal-register-print .no-print{display:none!important}.meal-register-print table{border-collapse:collapse;width:100%}.meal-register-print th,.meal-register-print td{border:1px solid #64748b;padding:4px;font-size:8pt}.meal-register-print tr{break-inside:avoid}.meal-register-print .print-card{break-inside:avoid}}`}</style>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="h-6 w-6" />
            <div><h1 className="text-2xl font-bold">{tr("canteenRegister")}</h1><p className="text-sm text-muted-foreground">{weekdayName}</p></div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="register-date">{tr("date")}</Label>
            <Input id="register-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} className="no-print w-auto" />
            <div className="no-print flex flex-wrap gap-2">
              <Button variant="outline" onClick={exportExcel}><Download className="mr-2 h-4 w-4" />{tr("exportExcel")}</Button>
              <Button variant="outline" onClick={exportPdf}><Download className="mr-2 h-4 w-4" />{tr("exportPdf")}</Button>
              <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />{tr("printA4")}</Button>
            </div>
            {user?.role === "admin" && (
              <>
                <input ref={legacyFileRef} type="file" accept=".json,application/json" className="hidden" onChange={(event) => void importLegacy(event.target.files?.[0])} />
                <Button className="no-print" variant="outline" onClick={() => legacyFileRef.current?.click()}><FileUp className="mr-2 h-4 w-4" />{tr("importLegacy")}</Button>
              </>
            )}
          </div>
        </div>
        {date !== today && <div role="alert" className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800">{tr("selectedDateWarning")} {date}</div>}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {cards.map((card) => <Card key={card.title}><CardHeader className="pb-2"><CardTitle className="text-sm">{card.title}</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{card.value}</div><p className="text-xs text-muted-foreground">{card.detail}</p></CardContent></Card>)}
        </section>

        <Card className="no-print border-blue-200">
          <CardHeader><CardTitle className="flex items-center gap-2"><BookOpenCheck className="h-5 w-5" />{tr("quickEntry")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
              <div className="space-y-1"><Label htmlFor="quick-diner-code">{tr("dinerCode")}</Label><Input id="quick-diner-code" list="meal-diner-options" value={dinerCode} onChange={(event) => onCodeChange(event.target.value)} onKeyDown={(event) => event.key === "Enter" && (event.preventDefault(), addEntry("Both", 25))} placeholder={tr("dinerCodePlaceholder")} autoComplete="off" className="uppercase" /><datalist id="meal-diner-options">{diners.map((diner) => <option key={diner.id} value={diner.dinerCode}>{diner.name}</option>)}</datalist></div>
              <div className="space-y-1"><Label htmlFor="quick-diner-name">{tr("dinerName")}</Label><Input id="quick-diner-name" value={dinerName} onChange={(event) => setDinerName(event.target.value)} readOnly={!!diners.find((diner) => diner.dinerCode === normalizeDinerCode(dinerCode))} /></div>
              <div className="flex items-end gap-2">
                <div className="min-w-0 flex-1 space-y-1"><Label htmlFor="custom-meal">{tr("mealType")}</Label><select id="custom-meal" value={customMeal} onChange={(event) => setCustomMeal(event.target.value as MealType)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">{MEAL_TYPES.map((type) => <option key={type} value={type}>{type === "BF" ? `${tr("breakfast")} ₹5` : type === "Lunch" ? `${tr("lunch")} ₹20` : `${tr("bothMeals")} ₹25`}</option>)}</select></div>
                <div className="w-24 space-y-1"><Label htmlFor="custom-cash">{tr("cash")}</Label><Input id="custom-cash" inputMode="decimal" type="number" min="0" max="100000" value={customCash} onChange={(event) => setCustomCash(event.target.value)} /></div>
                <Button disabled={entryMutation.isPending || customCash === ""} onClick={() => { addEntry(customMeal, Number(customCash)); setCustomCash(""); }}>{tr("addEntry")}</Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Button variant="outline" className="h-auto min-h-12" onClick={() => addEntry("BF", 5)}>☕ {tr("breakfast")} ₹5</Button>
              <Button variant="outline" className="h-auto min-h-12" onClick={() => addEntry("Lunch", 20)}>🍛 {tr("lunch")} ₹20</Button>
              <Button variant="outline" className="h-auto min-h-12" onClick={() => addEntry("Both", 25)}>🍱 {tr("bothMeals")} ₹25</Button>
              <Button variant="outline" className="h-auto min-h-12" onClick={() => addEntry("BF", 0)}>⏳ {tr("due")}</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>{tr("canteenRegister")} · {date} ({weekdayShort})</CardTitle>
            <div className="no-print flex flex-wrap items-center gap-2">
              <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>{tr("allEntries")} ({entries.length})</Button>
              <Button size="sm" variant={filter === "pending" ? "default" : "outline"} onClick={() => setFilter("pending")}>{tr("pendingEntries")} ({permanentStats.pending})</Button>
              <div className="relative min-w-44 flex-1 sm:flex-none"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tr("searchDiners")} className="pl-8" /></div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-sm">
                <thead><tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="p-2">#</th><th className="p-2">{tr("dinerCode")}</th><th className="p-2">{tr("dinerName")}</th><th className="p-2">{tr("mealType")}</th>
                  <th className="p-2 text-right">BF ₹</th><th className="p-2 text-right">L. ₹</th><th className="p-2 text-right">Morn</th><th className="p-2 text-right">{tr("due")}</th>
                  <th className="p-2 text-right">{tr("returnStat")}</th><th className="p-2 text-right">{tr("lunch")}</th><th className="p-2 text-right">Net</th><th className="p-2">{tr("status")}</th><th className="no-print p-2">{tr("actions")}</th>
                </tr></thead>
                <tbody>
                  {filteredEntries.map((entry, index) => {
                    const ev = evaluateEntry(entry);
                    return <tr key={entry.id} className={`border-b last:border-0 ${ev.statusType === "due" ? "bg-amber-50" : ev.statusType === "return" ? "bg-rose-50" : ""}`}>
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

        <Card className="border-purple-200">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div><CardTitle>{tr("thirdParty")}</CardTitle><p className="text-sm text-muted-foreground">{weekdayName}: BF ₹20 · {tr("lunchMenu")}</p></div>
            <div className="no-print flex flex-wrap items-center gap-2">
              <Label htmlFor="tap-quantity">{tr("tapQuantity")}</Label>
              <select id="tap-quantity" value={tapQty} onChange={(event) => setTapQty(Number(event.target.value))} className="h-9 rounded-md border bg-background px-2 text-sm">{[1, 2, 5, 10].map((qty) => <option key={qty} value={qty}>+{qty}</option>)}</select>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showAllMenu} onChange={(event) => setShowAllMenu(event.target.checked)} />{tr("showAllMenu")}</label>
              {user?.role === "admin" && <Button size="sm" variant="destructive" onClick={() => setConfirmClearTp(true)}>{tr("clearTp")}</Button>}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="no-print grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {(Object.values(TP_MEAL_CATALOG)).map((meal) => {
                const available = (meal.days as readonly number[]).includes(weekday);
                const isHidden = !available && !showAllMenu && meal.category === "LUNCH";
                if (isHidden) return null;
                const labelKey = { TP_BF: "tpBreakfast", TP_VEG: "tpVegLunch", TP_EGG: "tpEggLunch", TP_FISH: "tpFishLunch", TP_CHICKEN: "tpChickenLunch", TP_OUTSIDE: "tpOutsideLunch" }[meal.code] as Parameters<typeof tr>[0];
                return <Button key={meal.code} variant="outline" disabled={!available || tpAddMutation.isPending} className="h-auto min-h-16 justify-between whitespace-normal text-left" onClick={() => tpAddMutation.mutate({ mealCode: meal.code as TpMealCode, qty: tapQty })}>
                  <span>{tr(labelKey)} · ₹{meal.price}{!available ? ` · ${tr("notAvailable")}` : ""}</span><span className="font-bold">+{tapQty} ({formatMoney(tapQty * meal.price)})</span>
                </Button>;
              })}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[460px] text-sm">
                <thead><tr className="border-b text-left text-muted-foreground"><th className="p-2">{tr("thirdParty")}</th><th className="p-2 text-right">{tr("cash")}</th><th className="p-2 text-right">{tr("count")}</th><th className="p-2 text-right">{tr("netCollection")}</th></tr></thead>
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
