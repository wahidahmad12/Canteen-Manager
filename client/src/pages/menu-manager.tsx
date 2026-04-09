import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { RotateCcw, Download, Loader2, FileSpreadsheet, Save, Plus, X, Upload, Eye, Pencil, Trash2, History, RefreshCw, MessageCircle, Copy, CheckCheck, Printer } from "lucide-react";
import { format, addDays, getDay } from "date-fns";
import { useClientNames, useCreateSavedMenu, useSavedMenu, useSavedMenus, useUpdateSavedMenu, useDeleteSavedMenu, useSavedItemNames } from "@/hooks/use-reports";
import { useToast } from "@/hooks/use-toast";
import { useSearch } from "wouter";

interface Category {
  id: number;
  name: string;
  options: string[];
  def: string;
  isRed?: boolean;
}

const baseCategories: Category[] = [
  { id: 1, name: "1. Rice", options: ["Plain Rice", "Fried Rice", "Basmati Rice", "Peas Pulao"], def: "Plain Rice" },
  { id: 2, name: "2. Roti", options: ["Chapati", "Paratha", "Phulka", "Puri", "Peas Puri"], def: "Chapati" },
  { id: 3, name: "3. Dal", options: ["Dal Fry", "Rasam", "Mixed Dal", "Sambhar", "Dal Tarka", "Chana Dal", "Dal Lehsuni", "Dal Makhani", "Moong Dal", "Masoor Dal"], def: "Dal Fry" },
  { id: 4, name: "4. Dry Sabji", options: ["Baigan Bharta", "Mix Veg", "Salad Bhaji", "Cabbage Foogath", "Potato Caferial", "Veg Kofta", "White Peas Usal", "Matar Gobhi Gajar", "Veg Pakora", "Soya Chilli", "Aloo Chokha", "Karela Bhaja", "Aloo Jhuri Bhaja"], def: "Mix Veg" },
  { id: 5, name: "5. Gravy Sabji", options: ["Masoor Masala", "White Peas Masala", "Khatkhate", "Red Chana", "Matar Paneer", "Harabhara Masala", "Punjabi Chhole", "Baigan Masala", "Sev Tamatar Bhaji", "Bhindi Masala", "Mixed Veg", "Aloo Parwal", "Palak Saag"], def: "Masoor Masala" },
];

const unichem_extras: Category[] = [
  { id: 6, name: "6. Salad", options: ["Salad"], def: "Salad" },
  { id: 7, name: "7. Pickle", options: ["Pickle"], def: "Pickle" },
  { id: 8, name: "8. Papad", options: ["Papad"], def: "Papad" },
];

const hul_extras: Category[] = [
  { id: 6, name: "6. Chicken/Fish/Egg", options: ["Chicken Masala", "Fish Curry", "Egg Curry", "Chicken Fry", "Fish Fry"], def: "Chicken Masala", isRed: true },
  { id: 7, name: "7. Curd", options: ["Dahi", "Misti Doi", "Tok Doi"], def: "Dahi" },
  { id: 8, name: "8. Paneer", options: ["Paneer Masala", "Masoor Masala", "Butter Paneer Masala", "Matar Paneer"], def: "Paneer Masala" },
  { id: 9, name: "9. Sweets", options: ["Gulab Jamun", "Rasgulla", "Kheer", "Siwai"], def: "Gulab Jamun" },
];

const snackCategories: Category[] = [
  { id: 101, name: "1. Main Item", options: ["Bread", "Puri", "Pav", "Poha", "Upma", "Roti", "Paratha", "Pasta", "Khichri", "Biscuit", "Banana"], def: "Bread" },
  { id: 102, name: "2. Sabji", options: ["Aloo Sabji", "Mix Veg", "Chana Masala", "Dal Fry", "Paneer Bhurji"], def: "Aloo Sabji" },
  { id: 103, name: "3. Sweets", options: ["Gulab Jamun", "Rasgulla", "Kheer", "Halwa", "Ladoo"], def: "Gulab Jamun" },
  { id: 104, name: "4. Fruits", options: ["Banana", "Apple", "Orange", "Seasonal Fruit", "Mixed Fruit"], def: "Banana" },
];

type MealType = "lunch" | "dinner" | "breakfast" | "evening" | "night";

const MEAL_TYPES: { key: MealType; label: string; color: string; prefix: string }[] = [
  { key: "lunch", label: "Lunch Menu", color: "#1a3a5a", prefix: "" },
  { key: "dinner", label: "Dinner Menu", color: "#4a1a5a", prefix: "dinner_" },
  { key: "breakfast", label: "Breakfast", color: "#5a3a1a", prefix: "breakfast_" },
  { key: "evening", label: "Evening Snacks", color: "#1a5a3a", prefix: "evening_" },
  { key: "night", label: "Night Snacks", color: "#1a3a5a", prefix: "night_" },
];

const DEFAULT_CLIENTS = [
  "Unichem Laboratories Ltd",
  "Hindustan Unilever Limited",
  "United Breweries Limited",
];

const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function getWeekDates(startDate: Date, daysToDisplay: number, skipSunday: boolean): Date[] {
  const dates: Date[] = [];
  let current = new Date(startDate);
  while (dates.length < daysToDisplay) {
    if (skipSunday && getDay(current) === 0) {
      current = addDays(current, 1);
      continue;
    }
    dates.push(new Date(current));
    current = addDays(current, 1);
  }
  return dates;
}

export default function MenuManager() {
  const { data: dbClients, isLoading: clientsLoading } = useClientNames();
  const { data: savedMenuItems } = useSavedItemNames();
  const clientList = useMemo(() => {
    if (dbClients && dbClients.length > 0) return dbClients.map(c => c.name);
    return DEFAULT_CLIENTS;
  }, [dbClients]);

  const [client, setClient] = useState("");
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [activeMealType, setActiveMealType] = useState<MealType>("lunch");
  const captureRef = useRef<HTMLDivElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const savedImportRef = useRef<HTMLInputElement>(null);
  const justLoadedMenuRef = useRef(false);
  const saveMenuMutation = useCreateSavedMenu();
  const updateMenuMutation = useUpdateSavedMenu();
  const deleteMenuMutation = useDeleteSavedMenu();
  const { data: allSavedMenus, isLoading: savedMenusLoading } = useSavedMenus();
  const [viewingMenu, setViewingMenu] = useState<{ id: number; clientName: string; startDate: string; endDate: string; menuData: string; createdAt: string } | null>(null);
  const [importForSavedId, setImportForSavedId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [whatsappDate, setWhatsappDate] = useState("");
  const [whatsappMsg, setWhatsappMsg] = useState("");
  const [whatsappCopied, setWhatsappCopied] = useState(false);
  const [whatsappSavedMenu, setWhatsappSavedMenu] = useState<{ clientName: string; startDate: string; endDate: string; menuData: string } | null>(null);
  const { toast } = useToast();

  const searchString = useSearch();
  const loadId = useMemo(() => {
    const params = new URLSearchParams(searchString);
    return Number(params.get("load")) || 0;
  }, [searchString]);
  const { data: loadedMenu } = useSavedMenu(loadId);
  const [loadedForId, setLoadedForId] = useState(0);

  useEffect(() => {
    if (clientList.length > 0 && !client && loadId === 0) {
      setClient(clientList[0]);
    }
  }, [clientList, client, loadId]);

  useEffect(() => {
    if (loadedMenu && loadId > 0 && loadedForId !== loadId) {
      setClient(loadedMenu.clientName);
      const sd = loadedMenu.startDate?.includes("T") ? loadedMenu.startDate.split("T")[0] : loadedMenu.startDate;
      setStartDate(sd);
      setLoadedForId(loadId);
    }
  }, [loadedMenu, loadId, loadedForId]);

  const isHUL_UB = client === "Hindustan Unilever Limited" || client === "United Breweries Limited";
  const daysToDisplay = isHUL_UB ? 7 : 6;
  const lunchDinnerCategories = useMemo(() => {
    return [...baseCategories, ...(isHUL_UB ? hul_extras : unichem_extras)];
  }, [isHUL_UB]);

  const activeCats = useMemo(() => {
    return (activeMealType === "lunch" || activeMealType === "dinner") ? lunchDinnerCategories : snackCategories;
  }, [activeMealType, lunchDinnerCategories]);

  const allCategoriesForDialog = useMemo(() => {
    return [...lunchDinnerCategories, ...snackCategories];
  }, [lunchDinnerCategories]);

  const parsedStart = useMemo(() => {
    const d = new Date(startDate + "T00:00:00");
    return isNaN(d.getTime()) ? new Date() : d;
  }, [startDate]);

  const week1Dates = useMemo(() => getWeekDates(parsedStart, daysToDisplay, !isHUL_UB), [parsedStart, daysToDisplay, isHUL_UB]);
  const week2Start = useMemo(() => addDays(week1Dates[week1Dates.length - 1], 1), [week1Dates]);
  const week2Dates = useMemo(() => getWeekDates(week2Start, daysToDisplay, !isHUL_UB), [week2Start, daysToDisplay, isHUL_UB]);

  const rangeStart = week1Dates[0];
  const rangeEnd = week2Dates[week2Dates.length - 1];

  const initValues = useCallback(() => {
    const vals: Record<string, string> = {};
    MEAL_TYPES.forEach(({ prefix, key }) => {
      const cats = (key === "lunch" || key === "dinner") ? lunchDinnerCategories : snackCategories;
      for (let week = 1; week <= 2; week++) {
        const dates = week === 1 ? week1Dates : week2Dates;
        cats.forEach(cat => {
          dates.forEach((_, di) => {
            vals[`${prefix}w${week}_c${cat.id}_d${di}`] = cat.def;
          });
        });
      }
    });
    return vals;
  }, [lunchDinnerCategories, week1Dates, week2Dates]);

  const [cellValues, setCellValues] = useState<Record<string, string>>({});
  const [initialized, setInitialized] = useState(false);
  const [customItems, setCustomItems] = useState<Record<number, string[]>>({});
  const [addItemCatId, setAddItemCatId] = useState<number | null>(null);
  const [newItemName, setNewItemName] = useState("");

  const getCatOptions = useCallback((cat: Category) => {
    return [...cat.options, ...(customItems[cat.id] || [])];
  }, [customItems]);

  const handleAddItem = () => {
    if (!newItemName.trim() || addItemCatId === null) return;
    const cat = allCategoriesForDialog.find(c => c.id === addItemCatId);
    if (!cat) return;
    const allOpts = getCatOptions(cat);
    if (allOpts.some(o => o.toLowerCase() === newItemName.trim().toLowerCase())) {
      toast({ title: "Item already exists in this category", variant: "destructive" });
      return;
    }
    setCustomItems(prev => ({
      ...prev,
      [addItemCatId]: [...(prev[addItemCatId] || []), newItemName.trim()],
    }));
    toast({ title: `"${newItemName.trim()}" added to ${cat.name}` });
    setNewItemName("");
  };

  const handleRemoveCustomItem = (catId: number, item: string) => {
    setCustomItems(prev => ({
      ...prev,
      [catId]: (prev[catId] || []).filter(i => i !== item),
    }));
  };

  useEffect(() => {
    if (justLoadedMenuRef.current) {
      justLoadedMenuRef.current = false;
      return;
    }
    if (initialized) {
      setCellValues({});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate]);

  useEffect(() => {
    if (loadedMenu && loadedForId === loadId && loadId > 0) {
      try {
        const saved = JSON.parse(loadedMenu.menuData);
        setCellValues({ ...saved });
      } catch {
        setCellValues({});
      }
      setInitialized(true);
    } else if (!initialized) {
      setCellValues({});
      setInitialized(true);
    }
  }, [loadedMenu, loadedForId, loadId, initValues]);

  if (clientsLoading || !client) {
    return (
      <Layout>
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  const handleCellChange = (key: string, value: string) => {
    setCellValues(prev => ({ ...prev, [key]: value }));
  };

  const handleReset = () => {
    const mt = MEAL_TYPES.find(m => m.key === activeMealType)!;
    const cats = (activeMealType === "lunch" || activeMealType === "dinner") ? lunchDinnerCategories : snackCategories;
    const cleared: Record<string, string> = { ...cellValues };
    for (let week = 1; week <= 2; week++) {
      const dates = week === 1 ? week1Dates : week2Dates;
      cats.forEach(cat => {
        dates.forEach((_, di) => {
          cleared[`${mt.prefix}w${week}_c${cat.id}_d${di}`] = "";
        });
      });
    }
    setCellValues(cleared);
    toast({ title: `${mt.label} cleared` });
  };

  const handleClientChange = (val: string) => {
    setClient(val);
  };

  const handleSaveMenu = async () => {
    try {
      const rangeStartStr = format(rangeStart, "yyyy-MM-dd");
      const existing = (allSavedMenus || []).find((m: any) => {
        const msd = m.startDate?.includes("T") ? m.startDate.split("T")[0] : m.startDate;
        return m.clientName === client && msd === rangeStartStr;
      });
      if (existing) {
        await updateMenuMutation.mutateAsync({
          id: existing.id,
          data: {
            clientName: client,
            startDate: rangeStartStr,
            endDate: format(rangeEnd, "yyyy-MM-dd"),
            menuData: JSON.stringify(cellValues),
          },
        });
        toast({ title: "Updated", description: "Existing menu updated successfully." });
      } else {
        await saveMenuMutation.mutateAsync({
          clientName: client,
          startDate: rangeStartStr,
          endDate: format(rangeEnd, "yyyy-MM-dd"),
          menuData: JSON.stringify(cellValues),
        });
        toast({ title: "Saved", description: "Menu saved successfully." });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to save menu", variant: "destructive" });
    }
  };

  const handleLoadSavedMenuIntoEditor = (menu: { clientName: string; startDate: string; endDate: string; menuData: string }) => {
    setClient(menu.clientName);
    const sd = menu.startDate?.includes("T") ? menu.startDate.split("T")[0] : menu.startDate;
    justLoadedMenuRef.current = true;
    setStartDate(sd);
    try {
      const saved = JSON.parse(menu.menuData);
      setCellValues({ ...saved });
    } catch {
      setCellValues({});
    }
    toast({ title: "Menu Loaded", description: `${menu.clientName} menu loaded into editor.` });
  };

  const handleUpdateSavedMenu = async (id: number) => {
    try {
      await updateMenuMutation.mutateAsync({
        id,
        data: {
          clientName: client,
          startDate: format(rangeStart, "yyyy-MM-dd"),
          endDate: format(rangeEnd, "yyyy-MM-dd"),
          menuData: JSON.stringify(cellValues),
        },
      });
      toast({ title: "Saved", description: "Menu updated successfully." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to update menu.", variant: "destructive" });
    }
  };

  const handleDeleteSavedMenu = async (id: number) => {
    try {
      await deleteMenuMutation.mutateAsync(id);
      setConfirmDeleteId(null);
      toast({ title: "Deleted", description: "Saved menu removed." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to delete menu.", variant: "destructive" });
    }
  };

  const handleExportSavedExcel = async (menu: { clientName: string; startDate: string; endDate: string; menuData: string }) => {
    try {
      const sd = menu.startDate?.includes("T") ? menu.startDate.split("T")[0] : menu.startDate;
      const parsedSd = new Date(sd + "T00:00:00");
      const isHUL = menu.clientName === "Hindustan Unilever Limited" || menu.clientName === "United Breweries Limited";
      const dd = isHUL ? 7 : 6;
      const w1 = getWeekDates(parsedSd, dd, !isHUL);
      const w2 = getWeekDates(addDays(w1[w1.length - 1], 1), dd, !isHUL);
      const savedCells: Record<string, string> = JSON.parse(menu.menuData || "{}");
      const lunchDinnerCats = [...baseCategories, ...(isHUL ? hul_extras : unichem_extras)];
      const getCellVal = (prefix: string, weekNum: number, catId: number, catDef: string, di: number) => {
        const key = `${prefix}w${weekNum}_c${catId}_d${di}`;
        return (key in savedCells ? savedCells[key] : catDef || "").trim();
      };

      const ExcelJS = (await import("exceljs")).default;
      const { saveAs } = await import("file-saver");
      const workbook = new ExcelJS.Workbook();

      for (const mt of MEAL_TYPES) {
        const cats = (mt.key === "lunch" || mt.key === "dinner") ? lunchDinnerCats : snackCategories;
        // Check if this meal type has any data
        const mealHasData = [1, 2].some(wn =>
          (wn === 1 ? w1 : w2).some((_, di) => cats.some(cat => getCellVal(mt.prefix, wn, cat.id, cat.def, di) !== ""))
        );
        if (!mealHasData) continue;

        const worksheet = workbook.addWorksheet(mt.label);
        const navyFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A3A5A" } } as const;
        const grayFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F4F7" } } as const;
        const whiteFont = { name: "Arial", color: { argb: "FFFFFFFF" }, bold: true, size: 11 };
        const navyFont = { name: "Arial", color: { argb: "FF1A3A5A" }, bold: true, size: 10 };
        const blackFont = { name: "Arial", color: { argb: "FF000000" }, size: 10 };
        const border = { top: { style: "thin" as const }, left: { style: "thin" as const }, bottom: { style: "thin" as const }, right: { style: "thin" as const } };

        const titleRow = worksheet.addRow([`${menu.clientName} — ${mt.label}   (${format(w1[0], "dd MMM")} – ${format(w2[w2.length-1], "dd MMM yyyy")})`]);
        titleRow.font = whiteFont; titleRow.fill = navyFill; titleRow.height = 24;
        worksheet.mergeCells(titleRow.number, 1, titleRow.number, 1 + dd);

        for (let weekNum = 1; weekNum <= 2; weekNum++) {
          const dates = weekNum === 1 ? w1 : w2;
          const visibleCats = cats.filter(cat => dates.some((_, di) => getCellVal(mt.prefix, weekNum, cat.id, cat.def, di) !== ""));
          if (visibleCats.length === 0) continue;
          const wkRow = worksheet.addRow([`WEEK ${weekNum} SCHEDULE`, ...dates.map(d => format(d, "EEE dd"))]);
          wkRow.font = whiteFont; wkRow.fill = navyFill; wkRow.height = 20;
          wkRow.eachCell(c => { c.border = border; c.alignment = { horizontal: "center", vertical: "middle" }; });
          visibleCats.forEach(cat => {
            const row = worksheet.addRow([cat.name, ...dates.map((_, di) => getCellVal(mt.prefix, weekNum, cat.id, cat.def, di))]);
            const catCell = row.getCell(1);
            catCell.font = navyFont; catCell.fill = grayFill;
            row.eachCell((c, ci) => {
              c.border = border;
              c.alignment = { horizontal: ci === 1 ? "left" : "center", vertical: "middle", wrapText: true };
              if (ci > 1) { c.font = blackFont; }
            });
            row.height = 22;
          });
        }
        worksheet.getColumn(1).width = 25;
        for (let i = 2; i <= dd + 1; i++) worksheet.getColumn(i).width = 18;
      }

      const buf = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buf]), `DJ_Menu_${menu.clientName.replace(/\s+/g, "_")}_${format(parsedSd, "dd-MM-yyyy")}.xlsx`);
    } catch (err: any) {
      toast({ title: "Export Failed", description: err.message, variant: "destructive" });
    }
  };

  const handlePrintSavedMenu = (menu: { clientName: string; startDate: string; endDate: string; menuData: string }) => {
    const sd = menu.startDate?.includes("T") ? menu.startDate.split("T")[0] : menu.startDate;
    const ed = menu.endDate?.includes("T") ? menu.endDate.split("T")[0] : menu.endDate;
    const parsedSd = new Date(sd + "T00:00:00");
    const isHUL = menu.clientName === "Hindustan Unilever Limited" || menu.clientName === "United Breweries Limited";
    const dd = isHUL ? 7 : 6;
    const w1 = getWeekDates(parsedSd, dd, !isHUL);
    const w2 = getWeekDates(addDays(w1[w1.length - 1], 1), dd, !isHUL);
    const savedCells: Record<string, string> = JSON.parse(menu.menuData || "{}");
    const lunchDinnerCats = [...baseCategories, ...(isHUL ? hul_extras : unichem_extras)];
    const getCellVal = (prefix: string, weekNum: number, catId: number, catDef: string, di: number) => {
      const key = `${prefix}w${weekNum}_c${catId}_d${di}`;
      return (key in savedCells ? savedCells[key] : catDef || "").trim();
    };

    const th = `border:1px solid #ccc;padding:5px 8px;text-align:center;font-size:10px;font-weight:700;background:#1a3a5a;color:#fff;`;
    const tdH = `border:1px solid #ccc;padding:4px 8px;font-size:10px;font-weight:700;background:#f1f4f7;color:#1a3a5a;text-align:left;`;
    const td = `border:1px solid #ccc;padding:4px 6px;text-align:center;font-size:10px;`;
    const mt_colors: Record<string, string> = { lunch: "#E65100", dinner: "#1565C0", breakfast: "#2E7D32", evening: "#6A1B9A", night: "#37474F" };

    let html = `<html><head><title>${menu.clientName} Menu</title>
    <style>body{font-family:Arial,sans-serif;margin:16px;}table{border-collapse:collapse;width:100%;margin-bottom:14px;}h2{font-size:13px;margin:0 0 4px;}h3{font-size:11px;margin:6px 0 3px;}@media print{body{margin:8px;}}p.date{font-size:10px;color:#555;margin:0 0 12px;}</style>
    </head><body>
    <h2>${menu.clientName} — Weekly Menu</h2>
    <p class="date">${sd} → ${ed}</p>`;

    for (const mt of MEAL_TYPES) {
      const cats = (mt.key === "lunch" || mt.key === "dinner") ? lunchDinnerCats : snackCategories;
      const mealHasData = [1, 2].some(wn =>
        (wn === 1 ? w1 : w2).some((_, di) => cats.some(cat => getCellVal(mt.prefix, wn, cat.id, cat.def, di) !== ""))
      );
      if (!mealHasData) continue;
      const color = mt_colors[mt.key] || "#1a3a5a";
      html += `<h2 style="background:${color};color:#fff;padding:4px 10px;border-radius:4px;font-size:12px;">${mt.label}</h2>`;
      for (let weekNum = 1; weekNum <= 2; weekNum++) {
        const dates = weekNum === 1 ? w1 : w2;
        const visibleCats = cats.filter(cat => dates.some((_, di) => getCellVal(mt.prefix, weekNum, cat.id, cat.def, di) !== ""));
        if (visibleCats.length === 0) continue;
        html += `<h3>Week ${weekNum}</h3><table><thead><tr><th style="${th}width:120px">Category</th>${dates.map(d => `<th style="${th}">${format(d, "EEE dd")}</th>`).join("")}</tr></thead><tbody>`;
        visibleCats.forEach(cat => {
          html += `<tr><td style="${tdH}">${cat.name}</td>${dates.map((_, di) => `<td style="${td}${cat.isRed ? "color:#d32f2f;font-weight:700;" : ""}">${getCellVal(mt.prefix, weekNum, cat.id, cat.def, di)}</td>`).join("")}</tr>`;
        });
        html += `</tbody></table>`;
      }
    }
    html += `</body></html>`;
    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); win.focus(); win.print(); }
  };

  const getClientCode = (name: string): string => {
    const n = name.toUpperCase();
    if (n.includes("UNILEVER") || n.includes("HUL")) return "HUL";
    if (n.includes("BREWERIES") || n.includes("UBL")) return "UBL";
    if (n.includes("UNICHEM") || n.includes("USL")) return "USL";
    if (n.includes("CIPLA")) return "CPL";
    if (n.includes("PEC")) return "PEC";
    return "GEN";
  };

  const menuSerialMap = useMemo(() => {
    if (!allSavedMenus) return {} as Record<number, string>;
    const sorted = [...allSavedMenus].sort((a, b) => a.id - b.id);
    const map: Record<number, string> = {};
    sorted.forEach((m, idx) => {
      const code = getClientCode(m.clientName);
      const sd = m.startDate?.includes("T") ? m.startDate.split("T")[0] : m.startDate;
      let yy = "26";
      try { yy = format(new Date(sd + "T00:00:00"), "yy"); } catch {}
      const serial = String(idx + 1).padStart(3, "0");
      map[m.id] = `DJ-${code}-${yy}-M-${serial}`;
    });
    return map;
  }, [allSavedMenus]);

  const handleExportSavedImage = async (menu: { clientName: string; startDate: string; endDate: string; menuData: string }) => {
    handleLoadSavedMenuIntoEditor(menu);
    toast({ title: "Menu Loaded", description: "Menu loaded into editor. Now click the Image button to export." });
  };

  const WA_MEAL_LABELS: Record<string, string> = { lunch: "Lunch", dinner: "Dinner", breakfast: "Breakfast", evening: "Evening", night: "Night" };
  // Category ids 7 (Curd) and 8 (Paneer) go under "Veg" sub-section in lunch/dinner for HUL
  const VEG_SUB_CAT_IDS = new Set([7, 8]);

  const buildWhatsappMsg = (
    targetDateStr: string,
    cells: Record<string, string>,
    cName: string,
    w1: Date[],
    w2: Date[],
    ldCats: Category[],
  ): string => {
    let weekNum = 0, dayIdx = -1;
    for (let i = 0; i < w1.length; i++) {
      if (format(w1[i], "yyyy-MM-dd") === targetDateStr) { weekNum = 1; dayIdx = i; break; }
    }
    if (!weekNum) {
      for (let i = 0; i < w2.length; i++) {
        if (format(w2[i], "yyyy-MM-dd") === targetDateStr) { weekNum = 2; dayIdx = i; break; }
      }
    }
    if (!weekNum || dayIdx === -1) return "";
    const date = new Date(targetDateStr + "T00:00:00");
    const fullDayName = format(date, "EEEE");
    const dateLabel = format(date, "dd-MM-yyyy");
    let msg = `${fullDayName} ${dateLabel}\n`;
    for (const mt of MEAL_TYPES) {
      const isLunchDinner = mt.key === "lunch" || mt.key === "dinner";
      const cats = isLunchDinner ? ldCats : snackCategories;
      const label = WA_MEAL_LABELS[mt.key] || mt.label;
      // Main items (exclude veg sub cats for lunch/dinner)
      const mainCats = isLunchDinner ? cats.filter(c => !VEG_SUB_CAT_IDS.has(c.id)) : cats;
      const vegCats = isLunchDinner ? cats.filter(c => VEG_SUB_CAT_IDS.has(c.id)) : [];
      // Collect non-empty values only; use default only when key is absent (not when user cleared it)
      const mainItems = mainCats
        .map(cat => { const key = `${mt.prefix}w${weekNum}_c${cat.id}_d${dayIdx}`; return (key in cells ? cells[key] : cat.def || "").trim(); })
        .filter(v => v !== "");
      const vegItems = vegCats
        .map(cat => { const key = `${mt.prefix}w${weekNum}_c${cat.id}_d${dayIdx}`; return (key in cells ? cells[key] : cat.def || "").trim(); })
        .filter(v => v !== "");
      // Skip entire meal section if nothing to show
      if (mainItems.length === 0 && vegItems.length === 0) continue;
      msg += `\n${label}\n`;
      mainItems.forEach((val, i) => { msg += `${i + 1}. ${val}\n`; });
      if (vegItems.length > 0) {
        msg += `Veg\n`;
        vegItems.forEach((val, i) => { msg += `${i + 1}. ${val}\n`; });
      }
    }
    return msg.trimEnd();
  };

  const openWhatsappDialog = (savedMenu?: { clientName: string; startDate: string; endDate: string; menuData: string }) => {
    const src = savedMenu || null;
    setWhatsappSavedMenu(src || null);
    // Default to the first date in range
    let firstDate = "";
    if (src) {
      const sd = src.startDate?.includes("T") ? src.startDate.split("T")[0] : src.startDate;
      firstDate = sd;
    } else {
      firstDate = format(week1Dates[0], "yyyy-MM-dd");
    }
    setWhatsappDate(firstDate);
    setWhatsappCopied(false);
    // Build initial message
    const cells = src ? (() => { try { return JSON.parse(src.menuData || "{}"); } catch { return {}; } })() : cellValues;
    const cName = src ? src.clientName : client;
    const sd = src ? (src.startDate?.includes("T") ? src.startDate.split("T")[0] : src.startDate) : format(week1Dates[0], "yyyy-MM-dd");
    const parsedSd = new Date(sd + "T00:00:00");
    const isH = cName === "Hindustan Unilever Limited" || cName === "United Breweries Limited";
    const dd = isH ? 7 : 6;
    const w1 = src ? getWeekDates(parsedSd, dd, !isH) : week1Dates;
    const w2 = src ? getWeekDates(addDays(w1[w1.length - 1], 1), dd, !isH) : week2Dates;
    const ldCats = [...baseCategories, ...(isH ? hul_extras : unichem_extras)];
    setWhatsappMsg(buildWhatsappMsg(firstDate, cells, cName, w1, w2, ldCats));
    setWhatsappOpen(true);
  };

  const onWhatsappDateChange = (dateStr: string) => {
    setWhatsappDate(dateStr);
    setWhatsappCopied(false);
    const src = whatsappSavedMenu;
    const cells = src ? (() => { try { return JSON.parse(src.menuData || "{}"); } catch { return {}; } })() : cellValues;
    const cName = src ? src.clientName : client;
    const sd = src ? (src.startDate?.includes("T") ? src.startDate.split("T")[0] : src.startDate) : format(week1Dates[0], "yyyy-MM-dd");
    const parsedSd = new Date(sd + "T00:00:00");
    const isH = cName === "Hindustan Unilever Limited" || cName === "United Breweries Limited";
    const dd = isH ? 7 : 6;
    const w1 = src ? getWeekDates(parsedSd, dd, !isH) : week1Dates;
    const w2 = src ? getWeekDates(addDays(w1[w1.length - 1], 1), dd, !isH) : week2Dates;
    const ldCats = [...baseCategories, ...(isH ? hul_extras : unichem_extras)];
    setWhatsappMsg(buildWhatsappMsg(dateStr, cells, cName, w1, w2, ldCats));
  };

  const handleCopyWhatsapp = () => {
    navigator.clipboard.writeText(whatsappMsg).then(() => {
      setWhatsappCopied(true);
      setTimeout(() => setWhatsappCopied(false), 2500);
    });
  };

  const handleOpenWhatsApp = () => {
    const encoded = encodeURIComponent(whatsappMsg);
    window.open(`https://wa.me/?text=${encoded}`, "_blank");
  };

  const handleImportForSaved = (id: number) => {
    setImportForSavedId(id);
    savedImportRef.current?.click();
  };

  const handleSavedImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || importForSavedId === null) return;
    e.target.value = "";
    try {
      const ExcelJS = (await import("exceljs")).default;
      const buf = await file.arrayBuffer();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf);

      const savedMenu = allSavedMenus?.find(m => m.id === importForSavedId);
      if (!savedMenu) return;
      const sd = savedMenu.startDate?.includes("T") ? savedMenu.startDate.split("T")[0] : savedMenu.startDate;
      const parsedSd = new Date(sd + "T00:00:00");
      const isHUL = savedMenu.clientName === "Hindustan Unilever Limited" || savedMenu.clientName === "United Breweries Limited";
      const dd = isHUL ? 7 : 6;
      const w1 = getWeekDates(parsedSd, dd, !isHUL);
      const w2 = getWeekDates(addDays(w1[w1.length - 1], 1), dd, !isHUL);
      const lunchDinnerCats = [...baseCategories, ...(isHUL ? hul_extras : unichem_extras)];

      const existingData: Record<string, string> = JSON.parse(savedMenu.menuData || "{}");

      for (const mt of MEAL_TYPES) {
        const cats = (mt.key === "lunch" || mt.key === "dinner") ? lunchDinnerCats : snackCategories;
        const ws = wb.getWorksheet(mt.label);
        if (!ws) continue;
        let weekNum = 0; let readingData = false;
        ws.eachRow(row => {
          const vals = row.values as (string | number | null | undefined)[];
          const colA = String(vals[1] ?? "").trim().toUpperCase();
          if (colA.includes("WEEK 1")) { weekNum = 1; readingData = false; return; }
          if (colA.includes("WEEK 2")) { weekNum = 2; readingData = false; return; }
          if (weekNum === 0) return;
          if (!readingData) { if (colA === "CATEGORY" || colA.includes("WEEK")) readingData = true; return; }
          if (!vals[1]) { readingData = false; return; }
          const cat = cats.find(c => c.name.toLowerCase() === String(vals[1]).trim().toLowerCase());
          if (!cat) return;
          const dates = weekNum === 1 ? w1 : w2;
          vals.slice(2).forEach((cellVal, colIdx) => {
            if (colIdx >= dates.length) return;
            const val = String(cellVal ?? "").trim();
            if (val) existingData[`${mt.prefix}w${weekNum}_c${cat.id}_d${colIdx}`] = val;
          });
        });
      }

      await updateMenuMutation.mutateAsync({ id: importForSavedId, data: { menuData: JSON.stringify(existingData) } });
      toast({ title: "Imported", description: "Saved menu updated from Excel file." });
      setImportForSavedId(null);
    } catch (err: any) {
      toast({ title: "Import Failed", description: err.message || "Could not read Excel file.", variant: "destructive" });
    }
  };

  const handleDownload = async () => {
    const el = captureRef.current;
    if (!el) return;
    const mod = await import("html2canvas");
    const html2canvas = (mod as any).default || mod;
    const mt = MEAL_TYPES.find(m => m.key === activeMealType)!;
    const canvas = await html2canvas(el, {
      scale: 3,
      useCORS: true,
      backgroundColor: "#ffffff",
      windowWidth: 1800,
    });
    const link = document.createElement("a");
    link.download = `DJ_${mt.label.replace(/ /g, "_")}_${format(rangeStart, "dd-MM-yyyy")}.jpg`;
    link.href = canvas.toDataURL("image/jpeg", 1.0);
    link.click();
  };

  const handleExcelDownload = async () => {
    const ExcelJS = (await import("exceljs")).default;
    const { saveAs } = await import("file-saver");
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Menu");

    const navyFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A3A5A" } } as const;
    const redFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFEBEE" } } as const;
    const grayFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F4F7" } } as const;

    const whiteFont = { name: "Arial", color: { argb: "FFFFFFFF" }, bold: true, size: 11 };
    const navyFont = { name: "Arial", color: { argb: "FF1A3A5A" }, bold: true, size: 10 };
    const redFont = { name: "Arial", color: { argb: "FFD32F2F" }, bold: true, size: 11 };
    const blackFont = { name: "Arial", color: { argb: "FF000000" }, size: 10 };

    const borderStyle = {
      top: { style: "thin" as const },
      left: { style: "thin" as const },
      bottom: { style: "thin" as const },
      right: { style: "thin" as const },
    };

    const mt = MEAL_TYPES.find(m => m.key === activeMealType)!;
    const cats = (activeMealType === "lunch" || activeMealType === "dinner") ? lunchDinnerCategories : snackCategories;
    const totalCols = Math.max(week1Dates.length, week2Dates.length) + 1;
    const lastCol = String.fromCharCode(64 + totalCols);

    const titleRow = worksheet.addRow(["DJ HOSPITALITY & FACILITY MANAGEMENT PVT LTD"]);
    titleRow.font = { size: 16, bold: true, color: { argb: "FF1A3A5A" } };
    titleRow.alignment = { horizontal: "center" };
    worksheet.mergeCells(`A1:${lastCol}1`);

    const clientRow = worksheet.addRow([`CLIENT: ${client}`]);
    clientRow.font = { size: 12, bold: true, color: { argb: "FFA52A2A" } };
    clientRow.alignment = { horizontal: "center" };
    worksheet.mergeCells(`A2:${lastCol}2`);

    const dateText = `${mt.label.toUpperCase()}: ${format(rangeStart, "dd-MM-yyyy")} TO ${format(rangeEnd, "dd-MM-yyyy")}`;
    const dateRow = worksheet.addRow([dateText]);
    dateRow.font = { size: 11, bold: true, color: { argb: "FF555555" } };
    dateRow.alignment = { horizontal: "center" };
    worksheet.mergeCells(`A3:${lastCol}3`);

    worksheet.addRow([]);

    for (let weekNum = 1; weekNum <= 2; weekNum++) {
      const dates = weekNum === 1 ? week1Dates : week2Dates;

      const weekTitleRow = worksheet.addRow([`WEEK ${weekNum} SCHEDULE`]);
      weekTitleRow.font = whiteFont;
      weekTitleRow.fill = navyFill;
      weekTitleRow.alignment = { horizontal: "center", vertical: "middle" };
      worksheet.mergeCells(`A${weekTitleRow.number}:${lastCol}${weekTitleRow.number}`);

      const headerData = ["CATEGORY", ...dates.map(d => `${DAY_NAMES[getDay(d)]} ${format(d, "dd-MM-yyyy")}`)];
      const headerRow = worksheet.addRow(headerData);
      headerRow.height = 30;
      headerRow.eachCell((cell) => {
        cell.fill = navyFill;
        cell.font = whiteFont;
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.border = borderStyle;
      });

      cats.forEach((cat) => {
        const rowData = [cat.name];
        dates.forEach((_, di) => {
          rowData.push(cellValues[`${mt.prefix}w${weekNum}_c${cat.id}_d${di}`] || cat.def);
        });

        const excelRow = worksheet.addRow(rowData);
        excelRow.height = 25;

        const isNonVeg = cat.name.toLowerCase().includes("chicken") || cat.name.toLowerCase().includes("fish") || cat.name.toLowerCase().includes("egg");

        excelRow.eachCell((cell, colNumber) => {
          cell.border = borderStyle;
          cell.alignment = { horizontal: "center", vertical: "middle" };

          if (colNumber === 1) {
            cell.alignment = { horizontal: "left", vertical: "middle" };
            if (isNonVeg) {
              cell.fill = redFill;
              cell.font = redFont;
            } else {
              cell.fill = grayFill;
              cell.font = navyFont;
            }
          } else {
            cell.font = isNonVeg ? redFont : blackFont;
          }
        });
      });

      worksheet.addRow([]);
    }

    worksheet.getColumn(1).width = 25;
    for (let i = 2; i <= totalCols; i++) worksheet.getColumn(i).width = 20;

    const safeClientName = client.toLowerCase().replace(/ /g, "_").replace(/[^a-z0-9_]/g, "");
    const dateSuffix = `_${format(rangeStart, "dd-MM-yyyy")}_${format(rangeEnd, "dd-MM-yyyy")}`;
    const fileName = `${mt.label.replace(/ /g, "_")}_${safeClientName}${dateSuffix}.xlsx`;

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), fileName);
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      const buffer = await file.arrayBuffer();
      await workbook.xlsx.load(buffer);

      const ws = workbook.getWorksheet("Menu");
      if (!ws) throw new Error("No 'Menu' sheet found. Please use a file exported from this app.");

      const mt = MEAL_TYPES.find(m => m.key === activeMealType)!;
      const cats = (activeMealType === "lunch" || activeMealType === "dinner") ? lunchDinnerCategories : snackCategories;
      const newValues: Record<string, string> = { ...cellValues };
      const newCustomItems: Record<number, string[]> = {};
      Object.entries(customItems).forEach(([k, v]) => {
        newCustomItems[Number(k)] = [...v];
      });

      let weekNum = 0;
      let readingData = false;
      let newItemsAdded = 0;

      ws.eachRow((row) => {
        const vals = row.values as (string | number | null | undefined)[];
        const colA = String(vals[1] ?? "").trim();

        if (colA.toUpperCase().includes("WEEK 1")) { weekNum = 1; readingData = false; return; }
        if (colA.toUpperCase().includes("WEEK 2")) { weekNum = 2; readingData = false; return; }
        if (weekNum === 0) return;

        if (!readingData) {
          if (colA.toUpperCase() === "CATEGORY") { readingData = true; }
          return;
        }

        if (!colA) { readingData = false; return; }

        const cat = cats.find(c => c.name.toLowerCase() === colA.toLowerCase());
        if (!cat) return;

        const dates = weekNum === 1 ? week1Dates : week2Dates;
        vals.slice(2).forEach((cellVal, colIdx) => {
          if (colIdx >= dates.length) return;
          const val = String(cellVal ?? "").trim();
          if (!val) return;

          const key = `${mt.prefix}w${weekNum}_c${cat.id}_d${colIdx}`;
          newValues[key] = val;

          const existing = [...cat.options, ...(newCustomItems[cat.id] || [])];
          if (!existing.some(o => o.toLowerCase() === val.toLowerCase())) {
            newCustomItems[cat.id] = [...(newCustomItems[cat.id] || []), val];
            newItemsAdded++;
          }
        });
      });

      setCellValues(newValues);
      setCustomItems(newCustomItems);
      toast({
        title: "Menu Imported",
        description: newItemsAdded > 0
          ? `Menu loaded successfully. ${newItemsAdded} new item(s) added to options.`
          : "Menu loaded successfully from Excel.",
      });
    } catch (err: any) {
      toast({ title: "Import Failed", description: err.message || "Could not read the Excel file.", variant: "destructive" });
    }
  };

  const activeMt = MEAL_TYPES.find(m => m.key === activeMealType)!;

  const renderWeekTable = (weekNum: number, dates: Date[], prefix: string, cats: Category[]) => (
    <div key={weekNum}>
      <div
        style={{
          background: activeMt.color,
          color: "white",
          padding: "10px",
          marginTop: weekNum > 1 ? "30px" : "10px",
          fontWeight: "bold",
          textAlign: "center",
          fontSize: "18px",
          textTransform: "uppercase",
          letterSpacing: "1.5px",
        }}
      >
        WEEK {weekNum} SCHEDULE
      </div>
      <div className="overflow-x-auto">
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginBottom: "20px",
            border: `2px solid ${activeMt.color}`,
            fontFamily: "'Segoe UI', Arial, sans-serif",
            minWidth: "900px",
            tableLayout: "fixed",
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  width: "160px",
                  textAlign: "left",
                  paddingLeft: "10px",
                  background: "#eef2f3",
                  color: activeMt.color,
                  fontWeight: 800,
                  fontSize: "14px",
                  border: "1px solid #444",
                  height: "50px",
                }}
              >
                CATEGORY
              </th>
              {dates.map((d, i) => (
                <th
                  key={i}
                  style={{
                    background: "#eef2f3",
                    color: activeMt.color,
                    fontWeight: 800,
                    fontSize: "14px",
                    border: "1px solid #444",
                    height: "50px",
                    textAlign: "center",
                  }}
                >
                  {DAY_NAMES[getDay(d)]}
                  <br />
                  <span style={{ fontWeight: "normal", fontSize: "12px" }}>
                    {format(d, "dd-MM-yyyy")}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cats.map(cat => (
              <tr key={cat.id}>
                <td
                  style={{
                    textAlign: "left",
                    paddingLeft: "10px",
                    background: cat.isRed ? "#ffebee" : "#f1f4f7",
                    fontWeight: "bold",
                    color: cat.isRed ? "#d32f2f" : activeMt.color,
                    border: "1px solid #444",
                    height: "45px",
                    fontSize: "13px",
                    width: "160px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span>{cat.name}</span>
                    <button
                      onClick={() => { setAddItemCatId(cat.id); setNewItemName(""); }}
                      title={`Add item to ${cat.name}`}
                      data-testid={`button-add-item-cat-${cat.id}`}
                      style={{
                        background: activeMt.color,
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        width: "20px",
                        height: "20px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "14px",
                        lineHeight: 1,
                        marginRight: "4px",
                        flexShrink: 0,
                      }}
                    >+</button>
                  </div>
                </td>
                {dates.map((_, di) => {
                  const key = `${prefix}w${weekNum}_c${cat.id}_d${di}`;
                  return (
                    <td
                      key={di}
                      style={{
                        border: "1px solid #444",
                        height: "45px",
                        fontSize: "13px",
                        textAlign: "center",
                        padding: 0,
                      }}
                    >
                      <input
                        type="text"
                        list={`list_${cat.id}`}
                        value={cellValues[key] || ""}
                        onChange={e => handleCellChange(key, e.target.value)}
                        onBlur={e => {
                          const val = e.target.value.trim();
                          const opts = getCatOptions(cat);
                          if (val && !opts.some(o => o.toLowerCase() === val.toLowerCase())) {
                            const match = opts.find(o => o.toLowerCase().startsWith(val.toLowerCase()));
                            handleCellChange(key, match || cellValues[key] || cat.def);
                          }
                        }}
                        data-testid={`input-menu-${prefix}w${weekNum}-c${cat.id}-d${di}`}
                        style={{
                          width: "98%",
                          height: "100%",
                          border: "none",
                          textAlign: "center",
                          fontSize: "13px",
                          background: "transparent",
                          outline: "none",
                          fontFamily: "inherit",
                          color: cat.isRed ? "#d32f2f" : "#000",
                          fontWeight: cat.isRed ? "bold" : 500,
                          padding: "5px 0",
                        }}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const dialogCat = allCategoriesForDialog.find(c => c.id === addItemCatId);

  return (
    <Layout>
      {allCategoriesForDialog.map(cat => (
        <datalist key={cat.id} id={`list_${cat.id}`}>
          {getCatOptions(cat).map(opt => (
            <option key={opt} value={opt} />
          ))}
        </datalist>
      ))}

      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight" data-testid="text-menu-title">
            Menu Manager
          </h2>
          <p className="text-muted-foreground mt-1">Create and manage weekly meal menus</p>
        </div>
      </div>

      <div
        className="flex flex-wrap items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl mb-4"
        style={{ background: "#1a3a5a" }}
      >
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label className="text-white font-medium text-xs sm:text-sm shrink-0">Client:</label>
          <select
            value={client}
            onChange={e => handleClientChange(e.target.value)}
            className="px-2 sm:px-3 py-2 rounded font-bold text-xs sm:text-sm flex-1 sm:flex-none"
            data-testid="select-menu-client"
          >
            {clientList.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label className="text-white font-medium text-xs sm:text-sm shrink-0">Start:</label>
          <input
            type="date"
            value={startDate}
            onChange={e => {
              setStartDate(e.target.value);
              setTimeout(() => setCellValues(initValues()), 0);
            }}
            className="px-2 sm:px-3 py-2 rounded font-bold text-xs sm:text-sm flex-1 sm:flex-none"
            data-testid="input-menu-start-date"
          />
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button
            onClick={handleSaveMenu}
            className="bg-[#2196F3] text-white font-bold text-xs sm:text-sm h-9 flex-1 sm:flex-none"
            disabled={saveMenuMutation.isPending}
            data-testid="button-menu-save"
          >
            {saveMenuMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
            Save All
          </Button>
          <Button
            onClick={handleDownload}
            className="bg-[#25D366] text-white font-bold text-xs sm:text-sm h-9 flex-1 sm:flex-none"
            data-testid="button-menu-download"
          >
            <Download className="w-4 h-4 mr-1" />
            Image
          </Button>
          <Button
            onClick={handleExcelDownload}
            className="bg-[#217346] text-white font-bold text-xs sm:text-sm h-9 flex-1 sm:flex-none"
            data-testid="button-menu-excel"
          >
            <FileSpreadsheet className="w-4 h-4 mr-1" />
            Excel
          </Button>
          <Button
            onClick={() => importRef.current?.click()}
            className="bg-[#9C27B0] text-white font-bold text-xs sm:text-sm h-9 flex-1 sm:flex-none"
            data-testid="button-menu-import"
          >
            <Upload className="w-4 h-4 mr-1" />
            Import
          </Button>
          <Button
            onClick={handleReset}
            variant="secondary"
            className="bg-[#7f8c8d] text-white font-bold text-xs sm:text-sm h-9 flex-1 sm:flex-none"
            data-testid="button-menu-reset"
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            Reset
          </Button>
          {isHUL_UB && (
            <Button
              onClick={() => {
                const rangeStartStr = format(rangeStart, "yyyy-MM-dd");
                const savedMenu = (allSavedMenus || []).find((m: any) => {
                  const msd = m.startDate?.includes("T") ? m.startDate.split("T")[0] : m.startDate;
                  return m.clientName === client && msd === rangeStartStr;
                });
                if (!savedMenu) {
                  toast({ title: "Menu Not Saved", description: "Please save the menu first to use Daily WhatsApp.", variant: "destructive" });
                  return;
                }
                openWhatsappDialog(savedMenu);
              }}
              className="bg-[#25D366] text-white font-bold text-xs sm:text-sm h-9 flex-1 sm:flex-none"
              data-testid="button-menu-whatsapp"
            >
              <MessageCircle className="w-4 h-4 mr-1" />
              Daily WhatsApp
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {MEAL_TYPES.map(mt => (
          <button
            key={mt.key}
            onClick={() => setActiveMealType(mt.key)}
            data-testid={`tab-meal-${mt.key}`}
            style={{
              background: activeMealType === mt.key ? mt.color : "#e8eaed",
              color: activeMealType === mt.key ? "white" : "#555",
              border: "none",
              borderRadius: "6px",
              padding: "8px 16px",
              fontWeight: 700,
              fontSize: "13px",
              cursor: "pointer",
              transition: "all 0.15s",
              letterSpacing: "0.3px",
            }}
          >
            {mt.label}
          </button>
        ))}
      </div>

      <input
        ref={importRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        data-testid="input-menu-import-file"
        onChange={handleImportExcel}
      />
      <input
        ref={savedImportRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        data-testid="input-saved-menu-import-file"
        onChange={handleSavedImportExcel}
      />

      <div
        ref={captureRef}
        className="bg-white p-3 sm:p-6 rounded-xl shadow-lg overflow-x-auto"
        style={{ fontFamily: "'Segoe UI', Arial, sans-serif" }}
      >
        <div
          style={{
            textAlign: "center",
            borderBottom: `4px solid ${activeMt.color}`,
            paddingBottom: "20px",
            marginBottom: "20px",
          }}
        >
          <h2
            style={{
              margin: 0,
              color: "#1a3a5a",
              fontSize: "clamp(16px, 4vw, 24px)",
              textTransform: "uppercase",
              fontWeight: 900,
            }}
          >
            DJ HOSPITALITY & FACILITY MANAGEMENT PVT LTD
          </h2>
          <div
            style={{
              fontWeight: 900,
              color: "#a52a2a",
              fontSize: "clamp(14px, 3.5vw, 20px)",
              textTransform: "uppercase",
              marginTop: "10px",
              letterSpacing: "0.5px",
            }}
            data-testid="text-menu-client-display"
          >
            CLIENT: {client.toUpperCase()}
          </div>
          <div
            style={{
              fontSize: "16px",
              fontWeight: "bold",
              color: activeMt.color,
              marginTop: "8px",
              textTransform: "uppercase",
            }}
            data-testid="text-menu-date-range"
          >
            {activeMt.label.toUpperCase()}: {format(rangeStart, "dd-MM-yyyy")} TO {format(rangeEnd, "dd-MM-yyyy")}
          </div>
        </div>

        {renderWeekTable(1, week1Dates, activeMt.prefix, activeCats)}
        {renderWeekTable(2, week2Dates, activeMt.prefix, activeCats)}
      </div>

      <Dialog open={addItemCatId !== null} onOpenChange={(o) => { if (!o) setAddItemCatId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-600" />
              Add Item to {dialogCat?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter new item name..."
                value={newItemName}
                onChange={e => setNewItemName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleAddItem(); }}
                data-testid="input-new-menu-item"
                className="flex-1"
              />
              <Button onClick={handleAddItem} disabled={!newItemName.trim()} data-testid="button-add-menu-item">
                <Plus className="w-4 h-4 mr-1" /> Add
              </Button>
            </div>

            {addItemCatId !== null && dialogCat && (
              <div>
                <p className="text-xs text-muted-foreground mb-2 font-medium">Current items:</p>
                <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
                  {getCatOptions(dialogCat).map(item => {
                    const isCustom = (customItems[addItemCatId] || []).includes(item);
                    return (
                      <Badge
                        key={item}
                        variant={isCustom ? "default" : "secondary"}
                        className={`text-xs ${isCustom ? "bg-blue-600 hover:bg-blue-700" : ""}`}
                      >
                        {item}
                        {isCustom && (
                          <button
                            className="ml-1 hover:text-red-200"
                            onClick={() => handleRemoveCustomItem(addItemCatId, item)}
                            data-testid={`button-remove-item-${item}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== SAVED MENUS SECTION ===== */}
      <div className="mt-8">
        <div className="flex items-center gap-3 mb-4">
          <History className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-bold">Saved Menus</h3>
          <Badge variant="secondary">{allSavedMenus?.length ?? 0}</Badge>
        </div>

        {savedMenusLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : !allSavedMenus?.length ? (
          <div className="text-center py-10 text-muted-foreground bg-muted/30 rounded-xl border border-dashed">
            No saved menus yet. Use Save All above to save a menu.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {allSavedMenus.map(menu => {
              const sd = menu.startDate?.includes("T") ? menu.startDate.split("T")[0] : menu.startDate;
              const ed = menu.endDate?.includes("T") ? menu.endDate.split("T")[0] : menu.endDate;
              const createdAt = menu.createdAt ? new Date(menu.createdAt) : null;
              return (
                <div key={menu.id} className="bg-card border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3" data-testid={`saved-menu-row-${menu.id}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm truncate" data-testid={`saved-menu-client-${menu.id}`}>{menu.clientName}</span>
                      {menuSerialMap[menu.id] && (
                        <Badge className="bg-[#1a3a5a] text-white text-[10px] px-2 py-0 font-mono tracking-wider" data-testid={`saved-menu-serial-${menu.id}`}>{menuSerialMap[menu.id]}</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {sd} → {ed}
                      {createdAt && !isNaN(createdAt.getTime()) && (
                        <span className="ml-2 text-xs opacity-60">Saved: {format(createdAt, "dd MMM yyyy")}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => setViewingMenu(menu)} data-testid={`button-view-saved-${menu.id}`}>
                      <Eye className="w-3.5 h-3.5" /> View
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => handleLoadSavedMenuIntoEditor(menu)} data-testid={`button-edit-saved-${menu.id}`}>
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1 text-blue-600 border-blue-300 hover:bg-blue-50" onClick={() => handleUpdateSavedMenu(menu.id)} disabled={updateMenuMutation.isPending} data-testid={`button-save-saved-${menu.id}`}>
                      {updateMenuMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Save
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1 text-green-700 border-green-300 hover:bg-green-50" onClick={() => handleExportSavedExcel(menu)} data-testid={`button-excel-saved-${menu.id}`}>
                      <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1 text-orange-600 border-orange-300 hover:bg-orange-50" onClick={() => handleExportSavedImage(menu)} data-testid={`button-image-saved-${menu.id}`}>
                      <Download className="w-3.5 h-3.5" /> Image
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1 text-purple-600 border-purple-300 hover:bg-purple-50" onClick={() => handleImportForSaved(menu.id)} data-testid={`button-import-saved-${menu.id}`}>
                      <Upload className="w-3.5 h-3.5" /> Import
                    </Button>
                    {(menu.clientName === "Hindustan Unilever Limited" || menu.clientName === "United Breweries Limited") && (
                      <Button size="sm" variant="outline" className="h-8 text-xs gap-1 text-[#25D366] border-[#25D366] hover:bg-green-50" onClick={() => openWhatsappDialog(menu)} data-testid={`button-whatsapp-saved-${menu.id}`}>
                        <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                      </Button>
                    )}
                    <Button size="sm" variant="destructive" className="h-8 text-xs gap-1" onClick={() => setConfirmDeleteId(menu.id)} data-testid={`button-delete-saved-${menu.id}`}>
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ===== VIEW MENU DIALOG ===== */}
      {viewingMenu && (
        <Dialog open={!!viewingMenu} onOpenChange={open => { if (!open) setViewingMenu(null); }}>
          <DialogContent className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 flex-wrap">
                View Saved Menu — {viewingMenu.clientName}
                {menuSerialMap[viewingMenu.id] && (
                  <Badge className="bg-[#1a3a5a] text-white text-[10px] px-2 py-0 font-mono tracking-wider">{menuSerialMap[viewingMenu.id]}</Badge>
                )}
              </DialogTitle>
            </DialogHeader>
            <div className="text-sm text-muted-foreground mb-4">
              {viewingMenu.startDate?.split("T")[0]} → {viewingMenu.endDate?.split("T")[0]}
            </div>
            {(() => {
              const sd = viewingMenu.startDate?.includes("T") ? viewingMenu.startDate.split("T")[0] : viewingMenu.startDate;
              const parsedSd = new Date(sd + "T00:00:00");
              const isHUL = viewingMenu.clientName === "Hindustan Unilever Limited" || viewingMenu.clientName === "United Breweries Limited";
              const dd = isHUL ? 7 : 6;
              const w1 = getWeekDates(parsedSd, dd, !isHUL);
              const w2 = getWeekDates(addDays(w1[w1.length - 1], 1), dd, !isHUL);
              const cells: Record<string, string> = (() => { try { return JSON.parse(viewingMenu.menuData || "{}"); } catch { return {}; } })();
              const lunchDinnerCats = [...baseCategories, ...(isHUL ? hul_extras : unichem_extras)];

              return (
                <div>
                  {MEAL_TYPES.map(mt => {
                    const cats = (mt.key === "lunch" || mt.key === "dinner") ? lunchDinnerCats : snackCategories;
                    const getCellVal = (weekNum: number, cat: { id: number; def: string }, di: number) => {
                      const key = `${mt.prefix}w${weekNum}_c${cat.id}_d${di}`;
                      return (key in cells ? cells[key] : cat.def || "").trim();
                    };
                    // Check if entire meal type has any data at all
                    const mealHasData = [1, 2].some(wn =>
                      (wn === 1 ? w1 : w2).some((_, di) => cats.some(cat => getCellVal(wn, cat, di) !== ""))
                    );
                    if (!mealHasData) return null;
                    return (
                      <div key={mt.key} className="mb-6">
                        <div className="font-bold text-white text-sm px-3 py-2 rounded-t-md mb-0" style={{ background: mt.color }}>{mt.label}</div>
                        {[1, 2].map(weekNum => {
                          const dates = weekNum === 1 ? w1 : w2;
                          // Only show category rows that have at least one non-empty value in this week
                          const visibleCats = cats.filter(cat => dates.some((_, di) => getCellVal(weekNum, cat, di) !== ""));
                          if (visibleCats.length === 0) return null;
                          return (
                            <div key={weekNum} className="overflow-x-auto mb-3">
                              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "600px", border: `2px solid ${mt.color}` }}>
                                <thead>
                                  <tr style={{ background: mt.color }}>
                                    <th style={{ color: "white", padding: "6px 10px", textAlign: "left", fontSize: "12px", width: "140px" }}>Week {weekNum}</th>
                                    {dates.map((d, i) => (
                                      <th key={i} style={{ color: "white", padding: "6px 4px", textAlign: "center", fontSize: "11px" }}>{format(d, "EEE dd")}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {visibleCats.map(cat => (
                                    <tr key={cat.id}>
                                      <td style={{ border: "1px solid #ccc", padding: "4px 8px", fontSize: "11px", fontWeight: 600, background: "#f5f7fa", color: mt.color }}>{cat.name}</td>
                                      {dates.map((_, di) => (
                                        <td key={di} style={{ border: "1px solid #ccc", padding: "4px", textAlign: "center", fontSize: "11px", color: cat.isRed ? "#d32f2f" : "#000", fontWeight: cat.isRed ? "bold" : "normal" }}>
                                          {getCellVal(weekNum, cat, di)}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                  <div className="flex gap-2 mt-4 flex-wrap">
                    <Button className="bg-[#1a3a5a] text-white" onClick={() => { handleLoadSavedMenuIntoEditor(viewingMenu); setViewingMenu(null); }} data-testid="button-view-dialog-edit">
                      <Pencil className="w-4 h-4 mr-1" /> Load into Editor
                    </Button>
                    <Button variant="outline" className="text-green-700 border-green-400 hover:bg-green-50" onClick={() => { handleExportSavedExcel(viewingMenu); }} data-testid="button-view-dialog-excel">
                      <FileSpreadsheet className="w-4 h-4 mr-1" /> Export Excel
                    </Button>
                    <Button variant="outline" className="text-blue-700 border-blue-400 hover:bg-blue-50" onClick={() => handlePrintSavedMenu(viewingMenu)} data-testid="button-view-dialog-print">
                      <Printer className="w-4 h-4 mr-1" /> Print
                    </Button>
                    <Button variant="outline" onClick={() => setViewingMenu(null)} data-testid="button-view-dialog-close">Close</Button>
                  </div>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>
      )}

      {/* ===== DAILY WHATSAPP DIALOG ===== */}
      <Dialog open={whatsappOpen} onOpenChange={open => { if (!open) setWhatsappOpen(false); }}>
        <DialogContent className="max-w-lg w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#25D366]">
              <MessageCircle className="w-5 h-5" /> Daily WhatsApp Menu
            </DialogTitle>
          </DialogHeader>

          {/* Date selector from date range */}
          {(() => {
            const src = whatsappSavedMenu;
            const cName = src ? src.clientName : client;
            const sd = src ? (src.startDate?.includes("T") ? src.startDate.split("T")[0] : src.startDate) : format(week1Dates[0], "yyyy-MM-dd");
            const parsedSd = new Date(sd + "T00:00:00");
            const isH = cName === "Hindustan Unilever Limited" || cName === "United Breweries Limited";
            const dd = isH ? 7 : 6;
            const w1 = src ? getWeekDates(parsedSd, dd, !isH) : week1Dates;
            const w2 = src ? getWeekDates(addDays(w1[w1.length - 1], 1), dd, !isH) : week2Dates;
            const allDates = [...w1, ...w2];
            return (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium shrink-0">Select Date:</label>
                  <select
                    value={whatsappDate}
                    onChange={e => onWhatsappDateChange(e.target.value)}
                    className="flex-1 border rounded px-3 py-1.5 text-sm font-medium"
                    data-testid="select-whatsapp-date"
                  >
                    {allDates.map(d => {
                      const ds = format(d, "yyyy-MM-dd");
                      return (
                        <option key={ds} value={ds}>
                          {format(d, "EEEE, dd-MM-yyyy")}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="relative">
                  <textarea
                    readOnly
                    value={whatsappMsg}
                    rows={16}
                    className="w-full border rounded-lg px-3 py-2 text-sm font-mono bg-gray-50 resize-none focus:outline-none"
                    data-testid="text-whatsapp-preview"
                  />
                </div>

                <div className="flex gap-2 flex-wrap">
                  <Button
                    onClick={handleCopyWhatsapp}
                    className="flex-1 bg-slate-700 hover:bg-slate-800 text-white font-semibold"
                    data-testid="button-copy-whatsapp"
                  >
                    {whatsappCopied ? <><CheckCheck className="w-4 h-4 mr-1 text-green-400" /> Copied!</> : <><Copy className="w-4 h-4 mr-1" /> Copy Message</>}
                  </Button>
                  <Button
                    onClick={handleOpenWhatsApp}
                    className="flex-1 font-semibold text-white"
                    style={{ background: "#25D366" }}
                    data-testid="button-open-whatsapp"
                  >
                    <MessageCircle className="w-4 h-4 mr-1" /> Open WhatsApp
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ===== CONFIRM DELETE DIALOG ===== */}
      {confirmDeleteId !== null && (
        <Dialog open={true} onOpenChange={open => { if (!open) setConfirmDeleteId(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete Saved Menu?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">This action cannot be undone. The saved menu will be permanently removed.</p>
            <div className="flex gap-2 mt-4 justify-end">
              <Button variant="outline" onClick={() => setConfirmDeleteId(null)} data-testid="button-cancel-delete-menu">Cancel</Button>
              <Button variant="destructive" onClick={() => handleDeleteSavedMenu(confirmDeleteId)} disabled={deleteMenuMutation.isPending} data-testid="button-confirm-delete-menu">
                {deleteMenuMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1" />} Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Layout>
  );
}
