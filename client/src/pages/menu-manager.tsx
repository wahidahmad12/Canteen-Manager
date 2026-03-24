import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { RotateCcw, Download, Loader2, FileSpreadsheet, Save, Plus, X, Upload } from "lucide-react";
import { format, addDays, getDay } from "date-fns";
import { useClientNames, useCreateSavedMenu, useSavedMenu, useSavedItemNames } from "@/hooks/use-reports";
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
  const saveMenuMutation = useCreateSavedMenu();
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
    if (loadedMenu && loadedForId === loadId && loadId > 0) {
      try {
        const saved = JSON.parse(loadedMenu.menuData);
        const defaults = initValues();
        setCellValues({ ...defaults, ...saved });
      } catch {
        setCellValues(initValues());
      }
      setInitialized(true);
    } else if (!initialized) {
      setCellValues(initValues());
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
    const defaults: Record<string, string> = { ...cellValues };
    for (let week = 1; week <= 2; week++) {
      const dates = week === 1 ? week1Dates : week2Dates;
      cats.forEach(cat => {
        dates.forEach((_, di) => {
          defaults[`${mt.prefix}w${week}_c${cat.id}_d${di}`] = cat.def;
        });
      });
    }
    setCellValues(defaults);
    toast({ title: `${mt.label} reset to defaults` });
  };

  const handleClientChange = (val: string) => {
    setClient(val);
  };

  const handleSaveMenu = async () => {
    try {
      await saveMenuMutation.mutateAsync({
        clientName: client,
        startDate: format(rangeStart, "yyyy-MM-dd"),
        endDate: format(rangeEnd, "yyyy-MM-dd"),
        menuData: JSON.stringify(cellValues),
      });
      toast({ title: "Success", description: "Menu saved successfully" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to save menu", variant: "destructive" });
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
    </Layout>
  );
}
