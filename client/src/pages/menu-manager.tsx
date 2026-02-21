import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { RotateCcw, Download, Loader2, FileSpreadsheet, Save } from "lucide-react";
import { format, addDays, getDay } from "date-fns";
import { useClientNames, useCreateSavedMenu, useSavedMenu } from "@/hooks/use-reports";
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
  const clientList = useMemo(() => {
    if (dbClients && dbClients.length > 0) return dbClients.map(c => c.name);
    return DEFAULT_CLIENTS;
  }, [dbClients]);

  const [client, setClient] = useState("");
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const captureRef = useRef<HTMLDivElement>(null);
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
      setStartDate(loadedMenu.startDate);
      setLoadedForId(loadId);
    }
  }, [loadedMenu, loadId, loadedForId]);

  const isHUL_UB = client === "Hindustan Unilever Limited" || client === "United Breweries Limited";
  const daysToDisplay = isHUL_UB ? 7 : 6;
  const categories = useMemo(() => {
    return [...baseCategories, ...(isHUL_UB ? hul_extras : unichem_extras)];
  }, [isHUL_UB]);

  const parsedStart = useMemo(() => new Date(startDate + "T00:00:00"), [startDate]);

  const week1Dates = useMemo(() => getWeekDates(parsedStart, daysToDisplay, !isHUL_UB), [parsedStart, daysToDisplay, isHUL_UB]);
  const week2Start = useMemo(() => addDays(week1Dates[week1Dates.length - 1], 1), [week1Dates]);
  const week2Dates = useMemo(() => getWeekDates(week2Start, daysToDisplay, !isHUL_UB), [week2Start, daysToDisplay, isHUL_UB]);

  const rangeStart = week1Dates[0];
  const rangeEnd = week2Dates[week2Dates.length - 1];

  const initValues = useCallback(() => {
    const vals: Record<string, string> = {};
    for (let week = 1; week <= 2; week++) {
      const dates = week === 1 ? week1Dates : week2Dates;
      categories.forEach(cat => {
        dates.forEach((_, di) => {
          vals[`w${week}_c${cat.id}_d${di}`] = cat.def;
        });
      });
    }
    return vals;
  }, [categories, week1Dates, week2Dates]);

  const [cellValues, setCellValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (loadedMenu && loadedForId === loadId && loadId > 0) {
      try {
        const saved = JSON.parse(loadedMenu.menuData);
        const defaults = initValues();
        setCellValues({ ...defaults, ...saved });
      } catch {
        setCellValues(initValues());
      }
    } else {
      setCellValues(initValues());
    }
  }, [initValues, loadedMenu, loadedForId, loadId]);

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
    setCellValues(initValues());
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
    const canvas = await html2canvas(el, {
      scale: 3,
      useCORS: true,
      backgroundColor: "#ffffff",
      windowWidth: 1800,
    });
    const link = document.createElement("a");
    link.download = `DJ_Menu_Schedule_${format(rangeStart, "dd-MM-yyyy")}.jpg`;
    link.href = canvas.toDataURL("image/jpeg", 1.0);
    link.click();
  };

  const handleExcelDownload = async () => {
    const ExcelJS = await import("exceljs");
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

    const dateText = `LUNCH MENU: ${format(rangeStart, "dd-MM-yyyy")} TO ${format(rangeEnd, "dd-MM-yyyy")}`;
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

      categories.forEach((cat) => {
        const rowData = [cat.name];
        dates.forEach((_, di) => {
          rowData.push(cellValues[`w${weekNum}_c${cat.id}_d${di}`] || cat.def);
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
    const fileName = `Menu_${safeClientName}${dateSuffix}.xlsx`;

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), fileName);
  };

  const renderWeekTable = (weekNum: number, dates: Date[]) => (
    <div key={weekNum}>
      <div
        style={{
          background: "#1a3a5a",
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
            border: "2px solid #1a3a5a",
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
                  color: "#1a3a5a",
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
                    color: "#1a3a5a",
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
            {categories.map(cat => (
              <tr key={cat.id}>
                <td
                  style={{
                    textAlign: "left",
                    paddingLeft: "10px",
                    background: cat.isRed ? "#ffebee" : "#f1f4f7",
                    fontWeight: "bold",
                    color: cat.isRed ? "#d32f2f" : "#1a3a5a",
                    border: "1px solid #444",
                    height: "45px",
                    fontSize: "13px",
                    width: "160px",
                  }}
                >
                  {cat.name}
                </td>
                {dates.map((_, di) => {
                  const key = `w${weekNum}_c${cat.id}_d${di}`;
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
                        data-testid={`input-menu-w${weekNum}-c${cat.id}-d${di}`}
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

  return (
    <Layout>
      {categories.map(cat => (
        <datalist key={cat.id} id={`list_${cat.id}`}>
          {cat.options.map(opt => (
            <option key={opt} value={opt} />
          ))}
        </datalist>
      ))}

      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight" data-testid="text-menu-title">
            Menu Manager
          </h2>
          <p className="text-muted-foreground mt-1">Create and manage weekly lunch menus</p>
        </div>
      </div>

      <div
        className="flex flex-wrap items-center gap-4 p-4 rounded-xl mb-6"
        style={{ background: "#1a3a5a" }}
      >
        <div className="flex items-center gap-2">
          <label className="text-white font-medium text-sm">Client:</label>
          <select
            value={client}
            onChange={e => handleClientChange(e.target.value)}
            className="px-3 py-2 rounded font-bold text-sm"
            data-testid="select-menu-client"
          >
            {clientList.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-white font-medium text-sm">Start Date:</label>
          <input
            type="date"
            value={startDate}
            onChange={e => {
              setStartDate(e.target.value);
              setTimeout(() => setCellValues(initValues()), 0);
            }}
            className="px-3 py-2 rounded font-bold text-sm"
            data-testid="input-menu-start-date"
          />
        </div>
        <Button
          onClick={handleSaveMenu}
          className="bg-[#2196F3] text-white font-bold"
          disabled={saveMenuMutation.isPending}
          data-testid="button-menu-save"
        >
          {saveMenuMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save Menu
        </Button>
        <Button
          onClick={handleDownload}
          className="bg-[#25D366] text-white font-bold"
          data-testid="button-menu-download"
        >
          <Download className="w-4 h-4 mr-2" />
          Save as Image
        </Button>
        <Button
          onClick={handleExcelDownload}
          className="bg-[#217346] text-white font-bold"
          data-testid="button-menu-excel"
        >
          <FileSpreadsheet className="w-4 h-4 mr-2" />
          Save as Excel
        </Button>
        <Button
          onClick={handleReset}
          variant="secondary"
          className="bg-[#7f8c8d] text-white font-bold"
          data-testid="button-menu-reset"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Reset Menu
        </Button>
      </div>

      <div
        ref={captureRef}
        className="bg-white p-6 rounded-xl shadow-lg"
        style={{ fontFamily: "'Segoe UI', Arial, sans-serif" }}
      >
        <div
          style={{
            textAlign: "center",
            borderBottom: "4px solid #6b8e23",
            paddingBottom: "20px",
            marginBottom: "20px",
          }}
        >
          <h2
            style={{
              margin: 0,
              color: "#1a3a5a",
              fontSize: "24px",
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
              fontSize: "20px",
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
              color: "#555",
              marginTop: "8px",
            }}
            data-testid="text-menu-date-range"
          >
            LUNCH MENU: {format(rangeStart, "dd-MM-yyyy")} TO {format(rangeEnd, "dd-MM-yyyy")}
          </div>
        </div>

        {renderWeekTable(1, week1Dates)}
        {renderWeekTable(2, week2Dates)}
      </div>
    </Layout>
  );
}
